-- ---------------------------------------------------------------------
-- I piccoli accostati fanno quattro
-- ---------------------------------------------------------------------
-- Decisione del proprietario, 12/11/2026: con la sala nuova due tavoli
-- piccoli (70x80, 2 posti) accostati contano 4 coperti, non 2. Le sedie
-- stanno sui lati corti, e accostare i tavoli non ne toglie.
--
-- LA REGOLA, scritta una volta. Coperti di un tavolone = somma dei coperti
-- dei suoi tavoli meno `posti_persi_per_giunzione` per ogni giunzione. Il
-- numero e' del FORMATO (dato di Alessio, si cambia con un UPDATE):
--   - Piccolo 70x80:  0  -> 2 piccoli = 4, N piccoli in fila = 2*N;
--   - ogni altro formato (Grande 160x80, vecchi): 2, come prima.
-- Non cambia niente per i grandi, i divani (non accostabili) e i formati
-- spenti. Cambia solo la funzione `coperti_del_giorno()`, che il resto
-- (posto_per_la_serata, la pianta) gia' chiama: nessun altro chiamante.
-- Specchio puro: `copertiCalcolati()` in src/lib/calcoli/sala.js.
--
-- Le correzioni a mano restano com'erano (vincono sempre sul calcolato).
-- Idempotente. Si auto-registra.

alter table formati_tavolo
  add column if not exists posti_persi_per_giunzione integer not null default 2
    check (posti_persi_per_giunzione between 0 and 10);

comment on column formati_tavolo.posti_persi_per_giunzione is
  'Quanti coperti si perdono per ogni giunzione fra due tavoli di questo formato. 2 = la sedia sul lato accostato sparisce da entrambe le parti (i grandi); 0 = le sedie stanno sui lati corti e accostare non toglie niente (i piccoli 70x80).';

update formati_tavolo
   set posti_persi_per_giunzione = 0
 where nome = 'Piccolo 70x80'
   and posti_persi_per_giunzione <> 0;

comment on column formati_tavolo.coperti_base is
  'Coperti di UN tavolo di questo formato, da solo. Accostandone piu'' d''uno il totale scende di posti_persi_per_giunzione per ogni giunzione (2 per i grandi, 0 per i piccoli).';

-- Cambia solo il corpo, non il tipo di ritorno: basta create or replace.
create or replace function coperti_del_giorno(p_data date)
returns table (
  tavoli            uuid[],
  etichette         text[],
  giunzioni         integer,
  coperti_calcolati integer,
  coperti           integer,
  corretto          boolean,
  ragione           text,
  corretto_il       timestamptz,
  corretto_da_me    boolean
)
language sql
stable
set search_path = public
as $fn$
  with recursive sagome as (
    select p.id,
           p.label,
           t.formato_id,
           f.coperti_base,
           f.posti_persi_per_giunzione,
           p.x                                                                      as x1,
           p.y                                                                      as y1,
           p.x + (case when p.ruotato then p.profondita_cm else p.larghezza_cm end)  as x2,
           p.y + (case when p.ruotato then p.larghezza_cm  else p.profondita_cm end) as y2
      from pianta_del_giorno(p_data) p
      join dining_tables  t on t.id = p.id and t.active
      join formati_tavolo f on f.id = t.formato_id
     where p.tipo = 'tavolo'
  ),
  coppie as (
    -- Due tavoli sono accostati se sono dello STESSO formato e i loro
    -- rettangoli si toccano su un lato. Il formato e' la regola di
    -- Alessio («stesso stile»); il contatto e' geometria.
    select a.id as a, b.id as b
      from sagome a
      join sagome b on a.id < b.id
     where a.formato_id = b.formato_id
       and (
             (     (abs(a.x2 - b.x1) <= 5 or abs(b.x2 - a.x1) <= 5)
               and least(a.y2, b.y2) - greatest(a.y1, b.y1) >= 30 )
          or (     (abs(a.y2 - b.y1) <= 5 or abs(b.y2 - a.y1) <= 5)
               and least(a.x2, b.x2) - greatest(a.x1, b.x1) >= 30 )
           )
  ),
  archi as (
    select a, b from coppie
    union all
    select b, a from coppie
  ),
  raggiunge as (
    select id as nodo, id as altro from sagome
    union
    select r.nodo, ar.b from raggiunge r join archi ar on ar.a = r.altro
  ),
  capo as (
    -- ⚠️ `min(uuid)` non esiste in Postgres: si passa dal testo.
    select nodo, min(altro::text)::uuid as capo from raggiunge group by nodo
  ),
  gruppi as (
    select c.capo,
           array_agg(s.id    order by s.id)    as tavoli,
           array_agg(s.label order by s.label) as etichette,
           sum(s.coperti_base)::integer        as somma,
           -- Tutti i tavoli di un gruppo hanno lo stesso formato: il valore e' uno.
           min(s.posti_persi_per_giunzione)    as persi
      from capo c
      join sagome s on s.id = c.nodo
     group by c.capo
  ),
  gi as (
    select c.capo, count(*)::integer as n
      from coppie p
      join capo c on c.nodo = p.a
     group by c.capo
  )
  select g.tavoli,
         g.etichette,
         coalesce(gi.n, 0),
         greatest(g.somma - g.persi * coalesce(gi.n, 0), 0)::integer,
         coalesce(k.coperti, greatest(g.somma - g.persi * coalesce(gi.n, 0), 0))::integer,
         (k.coperti is not null),
         k.ragione,
         k.aggiornato_il,
         -- ⚠️ `is not distinct from` e non `=`: con `auth.uid()` nullo (una
         -- migrazione, una verifica) un confronto normale darebbe NULL, che
         -- a schermo si legge come «non l'ho fatto io» — cioe' una risposta
         -- al posto di «non lo so».
         (k.corretto_da is not null and k.corretto_da is not distinct from (select auth.uid()))
    from gruppi g
    left join gi on gi.capo = g.capo
    left join correzioni_coperti k on k.data = p_data and k.tavoli = g.tavoli
   order by g.etichette;
$fn$;

comment on function coperti_del_giorno(date) is
  'I tavoloni di una giornata: quali tavoli, quante giunzioni, quanti coperti calcolati e quanti veri. Se c''e'' una correzione a mano vince lei, e la funzione dice anche quando e'' stata scritta e se l''ha scritta chi sta guardando.';

revoke all on function coperti_del_giorno(date) from public, anon, authenticated;
grant execute on function coperti_del_giorno(date) to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_p uuid; v_g uuid; v_n integer;
begin
  select id into v_p from formati_tavolo where nome = 'Piccolo 70x80';
  select id into v_g from formati_tavolo where nome = 'Grande 160x80';
  if v_p is not null and (select posti_persi_per_giunzione from formati_tavolo where id = v_p) <> 0 then
    raise exception 'VERIFICA: il piccolo 70x80 perde ancora posti per giunzione.';
  end if;
  if v_g is not null and (select posti_persi_per_giunzione from formati_tavolo where id = v_g) <> 2 then
    raise exception 'VERIFICA: il grande 160x80 non perde piu'' 2 posti per giunzione.';
  end if;

  -- Sulla sala di sempre (data senza disposizioni): le coppie di piccoli
  -- fanno 4 coperti ciascuna.
  if v_p is not null then
    select count(*) into v_n from coperti_del_giorno('1990-01-01') c
     where cardinality(c.tavoli) = 2 and c.coperti_calcolati <> 4
       and exists (select 1 from dining_tables t where t.id = any(c.tavoli) and t.formato_id = v_p);
    if v_n <> 0 then
      raise exception 'VERIFICA: % coppie di piccoli non fanno 4 coperti.', v_n;
    end if;
  end if;
  raise notice 'Fatto: i piccoli accostati non perdono posti (2 piccoli = 4); i grandi perdono 2 per giunzione.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261112000006', 'i_piccoli_accostati_fanno_quattro')
on conflict (version) do nothing;
