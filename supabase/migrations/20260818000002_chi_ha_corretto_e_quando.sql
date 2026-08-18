-- ---------------------------------------------------------------------
-- Chi ha corretto quel numero, e quando
-- ---------------------------------------------------------------------
-- Condizione posta dal validatore il 18/08/2026 aprendo la correzione dei
-- coperti a tutto lo staff (giro B del mandato sala).
--
-- LA RAGIONE, ED E' PIU' STRETTA DI «TRACCIARE». Non serve a controllare
-- nessuno: serve perche' **una correzione senza autore e' un numero che
-- nessuno puo' spiegare tre giorni dopo**, e quel numero decide se si
-- accetta gente. La ragione scritta accanto dice *perche'*; questo dice
-- *chi lo sa*, cioe' a chi si puo' chiedere.
--
-- ⚠️ IL «QUANDO» NON PRENDE UNA COLONNA NUOVA. `aggiornato_il` c'e' gia'
-- e la scrive lo stesso trigger a ogni scrittura: aggiungerne una seconda
-- sarebbe due colonne che dicono la stessa cosa e possono contraddirsi —
-- la regola del 16/08. Si espone quella.
--
-- ⚠️ E IL «CHI» E' ONESTO SU QUANTO IL GESTIONALE SA DAVVERO. Oggi gli
-- accessi sono per RUOLO, non per persona: `user_roles` ha 2 titolari e 2
-- staff (utenti di prova compresi) e non esiste da nessuna parte il nome
-- di una persona. In piu' `user_roles` si legge **solo per la propria
-- riga** (policy `user_roles_select_own`), quindi una giunzione per
-- mostrare il ruolo di un altro tornerebbe **vuota in silenzio** — che e'
-- il modo di sbagliare che questo progetto passa le giornate a togliere.
-- Quindi:
--   · in tabella si conserva `corretto_da`, cioe' **l'identificativo
--     vero** dell'accesso. E' il fatto durevole, e il giorno che
--     esisteranno accessi per persona rende la storia attribuibile
--     ALL'INDIETRO senza rifare niente;
--   · a schermo si dice cio' che si puo' sapere senza aprire un permesso
--     nuovo: **«l'hai corretto tu»** oppure **«un altro accesso»**, che si
--     calcola confrontando con `auth.uid()`.
-- Il limite e' dichiarato e non nascosto: finche' gli accessi sono per
-- ruolo, «un altro accesso» e' tutto cio' che si puo' dire con verita'.
--
-- Idempotente (§7 punto 3). Si auto-registra (§7 punto 4).

alter table correzioni_coperti
  add column if not exists corretto_da uuid;

comment on column correzioni_coperti.corretto_da is
  'Chi ha scritto la correzione (auth.uid()). ⚠️ Nessuna chiave esterna verso auth.users di proposito: se un accesso venisse tolto, un ON DELETE cancellerebbe proprio la traccia che questa colonna esiste per conservare. Vuoto = scritta da una migrazione o da una verifica, che non hanno un utente.';

-- Lo scrive il database, mai la schermata: un campo che la schermata puo'
-- dimenticare di passare e' un campo che prima o poi si perde in silenzio
-- (il `mezzo` delle mance, 16/08).
create or replace function ordina_tavoli_correzione()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select array_agg(distinct t order by t) into new.tavoli from unnest(new.tavoli) as t;
  if new.tavoli is null or array_length(new.tavoli, 1) is null then
    raise exception 'Una correzione dei coperti deve riferirsi ad almeno un tavolo.';
  end if;
  new.aggiornato_il := now();
  new.corretto_da   := auth.uid();
  return new;
end $$;

-- ⚠️ Il tipo di ritorno cambia: `create or replace` non basta, serve il drop.
drop function if exists coperti_del_giorno(date);

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
           sum(s.coperti_base)::integer        as somma
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
         greatest(g.somma - 2 * coalesce(gi.n, 0), 0)::integer,
         coalesce(k.coperti, greatest(g.somma - 2 * coalesce(gi.n, 0), 0))::integer,
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
-- ⚠️ CHIAMA anche `posto_per_la_serata()`, che NON e' stata ridefinita ma
-- chiama quella che qui e' stata buttata e rifatta. Postgres non traccia
-- le chiamate fra funzioni: si sarebbe potuta lasciare rotta senza che
-- niente lo dicesse fino al primo uso. E' la lezione del 17/08 — «un corpo
-- che si crea non e' un corpo che funziona» — applicata al caso in cui a
-- rompersi e' il CHIAMANTE.
do $verifica$
declare
  d          constant date := date '1995-06-16';
  q          uuid[];
  utente     uuid;
  n          integer;
  gruppo     uuid[];
  v_da_me    boolean;
  v_quando   timestamptz;
  v_scritto  uuid;
begin
  select count(*) into n from disposizioni_giornaliere where data = d;
  if n <> 0 then raise exception 'La data di prova % non e'' libera (% scostamenti).', d, n; end if;
  select count(*) into n from correzioni_coperti where data = d;
  if n <> 0 then raise exception 'La data di prova % ha gia'' % correzioni.', d, n; end if;

  select array_agg(t.id order by t.label) into q
    from dining_tables t join formati_tavolo f on f.id = t.formato_id
   where t.tipo = 'tavolo' and t.active and f.nome = 'Quadrato 90x90';
  if coalesce(array_length(q, 1), 0) < 2 then
    raise exception 'Servono almeno 2 tavoli quadrati per questa verifica, ce ne sono %.', coalesce(array_length(q, 1), 0);
  end if;

  select user_id into utente from user_roles where role = 'titolare' limit 1;
  if utente is null then raise exception 'Nessun titolare in user_roles: la verifica non puo'' fingere un accesso.'; end if;

  insert into disposizioni_giornaliere (data, dining_table_id, x, y, ruotato)
  select d, t.id, (row_number() over (order by t.label))::integer * 400, 0, false
    from dining_tables t where t.tipo = 'tavolo' and t.active;

  select tavoli into gruppo from coperti_del_giorno(d) where tavoli = array[q[1]];
  if gruppo is null then raise exception 'Il tavolo di prova non compare fra i gruppi.'; end if;

  -- --- Con un accesso vero: «chi» si scrive da solo ---
  perform set_config('request.jwt.claims', json_build_object('sub', utente, 'role', 'authenticated')::text, true);

  insert into correzioni_coperti (data, tavoli, coperti, ragione)
  values (d, gruppo, 3, 'verifica');

  select corretto_da into v_scritto from correzioni_coperti where data = d and tavoli = gruppo;
  if v_scritto is distinct from utente then
    raise exception 'La correzione non ha registrato chi l''ha scritta (atteso %, letto %).', utente, v_scritto;
  end if;

  select corretto_da_me, corretto_il into v_da_me, v_quando
    from coperti_del_giorno(d) where tavoli = gruppo;
  if not v_da_me then raise exception 'Chi ha scritto la correzione non si riconosce come autore.'; end if;
  if v_quando is null then raise exception 'La correzione non dice quando e'' stata scritta.'; end if;

  -- --- Con un accesso DIVERSO: non risulta «tuo» ---
  -- ⚠️ Il caso che conta e' questo: una prova fatta solo col proprio
  -- accesso direbbe «corretto_da_me» anche se la funzione rispondesse
  -- sempre vero.
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  select corretto_da_me into v_da_me from coperti_del_giorno(d) where tavoli = gruppo;
  if v_da_me then raise exception 'La correzione di un altro accesso risulta scritta da chi guarda.'; end if;

  -- --- E il CHIAMANTE che non e' stato ridefinito risponde ancora ---
  perform set_config('request.jwt.claims', null, true);
  select count(*) into n from posto_per_la_serata(d);
  if n <> 1 then raise exception 'posto_per_la_serata() non risponde piu'' dopo il rifacimento di coperti_del_giorno.'; end if;

  -- --- Pulizia, e il perimetro si ricontrolla vuoto ---
  delete from correzioni_coperti       where data = d;
  delete from disposizioni_giornaliere where data = d;
  select count(*) into n from correzioni_coperti where data = d;
  if n <> 0 then raise exception 'Restano % correzioni della prova.', n; end if;
  select count(*) into n from disposizioni_giornaliere where data = d;
  if n <> 0 then raise exception 'Restano % scostamenti della prova.', n; end if;

  raise notice 'Una correzione dice chi l''ha scritta e quando.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260818000002', 'chi_ha_corretto_e_quando')
on conflict (version) do nothing;
