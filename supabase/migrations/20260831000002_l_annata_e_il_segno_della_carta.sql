-- =====================================================================
-- L'ANNATA E' UN CAMPO SUO, E IL PRODOTTO DICE SE VA IN CARTA — 31/08/2026
-- =====================================================================
--
-- Due decisioni di Alessio, una migrazione: toccano tutte e due la stessa
-- cosa — quali bottiglie finiscono sulla carta dei vini e come si
-- riconoscono.
--
-- ---------------------------------------------------------------------
-- B · L'ANNATA ESCE DALLA DESCRIZIONE
-- ---------------------------------------------------------------------
-- 🔴 IL DIFETTO E' STATO DICHIARATO IERI NOTTE costruendo la proposta
-- dell'abbinamento (`20260830000009`→`…011`): l'annata vive **dentro la
-- descrizione della confezione**, cioe' dentro un testo libero. Con quaranta
-- etichette e **due annate dello stesso vino** e' esattamente il motivo per
-- cui la proposta sbaglia: due confezioni con lo stesso nome e nessun modo
-- di distinguerle.
--
-- ⚠️ E VA FATTO PRIMA CHE CARICHI LE ETICHETTE. Misurato il 31/08 sul
-- gestionale vero: le confezioni sono **ZERO**. Dopo, sarebbe una
-- rilavorazione su ogni riga gia' scritta.
--
-- ⚠️ NON E' UNA RIGA NUOVA, ed e' la decisione del 30/08 alla lettera:
-- *«l'annata e' una CONFEZIONE, non una riga nuova»*. L'ingrediente resta
-- «Nero d'Avola del produttore X»; l'annata e' un campo della confezione
-- comprata sotto di lui, accanto a marca e formato.
--
-- ⚠️ NASCE VUOTA, e vuoto non e' zero: una confezione senza annata e' la
-- normalita' (l'acqua non ha annata) e un vino di cui nessuno l'ha ancora
-- scritta non e' un vino del 1900.
--
-- ---------------------------------------------------------------------
-- C · IL SEGNO «QUESTO VA IN CARTA»
-- ---------------------------------------------------------------------
-- 🔴 IN MAGAZZINO C'E' ANCHE CIO' CHE NON SI VENDE: il vino da cucina,
-- l'acqua del personale, la birra del bar. Sulla carta va solo cio' che si
-- vende al cliente.
--
-- ⚠️ I SETTE MONDI NON BASTANO, e la ragione e' di Alessio: *dentro «Vini»
-- ci sono anche bottiglie che in carta non ci vanno.* Il mondo dice **che
-- cosa e'**, questo segno dice **se si vende**. Sono due domande diverse, e
-- un filtro sul mondo risponderebbe alla prima credendo di rispondere alla
-- seconda.
--
-- ⚠️ NASCE FALSO PER TUTTI, ed e' la scelta prudente nel verso giusto: un
-- prodotto che dovrebbe stare in carta e non c'e' si vede subito (manca dal
-- menu); uno che non dovrebbe starci e ci finisce **si vende a un cliente**.

-- ---------------------------------------------------------------------
-- 1. L'ANNATA
-- ---------------------------------------------------------------------
alter table articoli_fornitore add column if not exists annata integer;

alter table articoli_fornitore drop constraint if exists articoli_fornitore_annata_check;
alter table articoli_fornitore
  add constraint articoli_fornitore_annata_check
  check (annata is null or (annata between 1900 and 2100));

comment on constraint articoli_fornitore_annata_check on articoli_fornitore is
  'L''annata di una bottiglia sta fra il 1900 e il 2100. Vuota va benissimo: '
  'quasi niente ha un''annata.';

comment on column articoli_fornitore.annata is
  'L''annata della bottiglia (31/08/2026). Prima viveva dentro `descrizione`, '
  'cioe'' dentro un testo libero, e due annate dello stesso vino non si '
  'potevano distinguere. Vuota non e'' zero: vuol dire «non ce l''ha» oppure '
  '«nessuno l''ha ancora scritta».';

-- ---------------------------------------------------------------------
-- 2. IL SEGNO DELLA CARTA
-- ---------------------------------------------------------------------
alter table ingredients add column if not exists va_in_carta boolean not null default false;

comment on column ingredients.va_in_carta is
  'Questo prodotto si vende al cliente e puo'' stare sulla carta (31/08/2026, '
  'decisione di Alessio). ⚠️ NON si deduce dal mondo: dentro «Vini» ci sono '
  'anche il vino da cucina e le bottiglie del personale. Il mondo dice che '
  'cosa e'', questo dice se si vende.';

-- ---------------------------------------------------------------------
-- 3. COSA PUO' ENTRARE IN CARTA
-- ---------------------------------------------------------------------
-- ⚠️ UN PRODOTTO NON E' UNA RIGA DI CARTA, ed e' il rilievo di Alessio: la
--    stessa bottiglia sta in carta **due volte** — al calice e alla
--    bottiglia — a prezzi diversi. Quindi questa funzione dice *cosa si puo'
--    mettere*, non *cosa c'e' gia'*: non riversa il magazzino uno-a-uno.
--    Il campo che dice quante porzioni escono da un'unita' esiste gia'
--    (`bar_items.porzioni_per_unita`) e non si tocca.
create or replace function prodotti_per_la_carta(p_mondo text default null)
returns table (
  ingredient_id uuid, prodotto text, mondo text, mondo_nome text,
  categoria text, prezzo_acquisto numeric,
  confezioni jsonb, gia_in_carta integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- `security definer` gira senza RLS: il portiere va rimesso dentro. E chi
  -- non deve vedere riceve un RIFIUTO, non un elenco vuoto — un elenco vuoto
  -- si leggerebbe «non c'e' niente da mettere in carta» (regola del 13/08).
  if not (select is_titolare()) then
    raise exception 'I prodotti da mettere in carta li vede solo il titolare: portano i prezzi d''acquisto.';
  end if;

  return query
  select i.id, i.name, c.mondo, m.nome, c.nome,
         nullif(i.current_price, 0),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'marca', a.marca, 'formato', a.formato, 'annata', a.annata,
                    'descrizione', a.descrizione, 'fornitore', s.name)
                  order by a.annata desc nulls last, a.aggiornato_il desc)
             from articoli_fornitore a
             left join suppliers s on s.id = a.supplier_id
            where a.ingredient_id = i.id and not a.ignora
         ), '[]'::jsonb),
         (select count(*)::integer from bar_items b
           where b.ingredient_id = i.id and b.active)
    from ingredients i
    join categorie_ingrediente c on c.codice = i.category
    join mondi_magazzino m on m.codice = c.mondo
   where i.active and i.va_in_carta
     and (p_mondo is null or c.mondo = p_mondo)
   order by m.ordine, i.name;
end;
$$;

comment on function prodotti_per_la_carta is
  'I prodotti segnati «va in carta», col conto di quante righe di carta ne '
  'escono gia''. ⚠️ Un prodotto NON e'' una riga di carta: la stessa '
  'bottiglia ci sta due volte, al calice e alla bottiglia.';

revoke all on function prodotti_per_la_carta(text) from public, anon, authenticated;
grant execute on function prodotti_per_la_carta(text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. LA PROPOSTA DELL'ABBINAMENTO USA L'ANNATA
-- ---------------------------------------------------------------------
-- 🔴 IL CORPO E' PRESO DAL DATABASE VIVO, non dalla migrazione che l'ha
--    creata (regola del 18/08): fra i due ci stanno tutte le migrazioni che
--    l'hanno toccata. Cambia SOLO l'oggetto delle confezioni, che ora porta
--    l'annata, e l'ordine con cui le elenca — l'annata piu' recente per
--    prima, che e' quella che si sta comprando.
create or replace function abbinamenti_carta_proposti(p_bar_item_id uuid default null)
returns table (
  bar_item_id uuid, voce text, serving text, produttore_carta text,
  ingredient_id uuid, prodotto text, parole_in_comune integer,
  confezioni jsonb, ultimo_prezzo numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (select is_titolare()) then
    raise exception 'Le proposte di abbinamento le vede solo il titolare: contengono i prezzi d''acquisto.';
  end if;

  return query
  with prodotti as (
    select i.id, i.name,
           array(select w from unnest(string_to_array(nome_ingrediente_chiave(i.name), ' ')) w
                  where length(w) > 2) as parole
      from ingredients i
     where i.active and i.alimentare and i.preparazione_id is null
  ),
  -- 🔴 QUANTO IDENTIFICA UNA PAROLA: in quanti prodotti compare. Si conta,
  --    non si decide.
  peso as (
    select w, count(*)::integer as in_quanti
      from prodotti p, unnest(p.parole) w
     group by w
  ),
  voci as (
    select b.id, b.name, b.serving, b.producer,
           array(select w from unnest(string_to_array(nome_ingrediente_chiave(b.name), ' ')) w
                  where length(w) > 2) as parole
      from bar_items b
     where b.ingredient_id is null and b.active
       and (p_bar_item_id is null or b.id = p_bar_item_id)
  ),
  candidati as (
    select v.id, v.name, v.serving, v.producer, p.id as ing, p.name as prodotto,
           array(select unnest(v.parole) intersect select unnest(p.parole)) as comuni
      from voci v cross join prodotti p
  ),
  vagliati as (
    select c.*,
           cardinality(c.comuni) as quante,
           -- specificità: la parola in comune più rara appartiene a UN solo
           -- prodotto?
           (select min(pe.in_quanti) from peso pe where pe.w = any(c.comuni)) as la_piu_rara
      from candidati c
     where cardinality(c.comuni) > 0
  )
  select v.id, v.name, v.serving, v.producer, v.ing, v.prodotto, v.quante,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'marca', a.marca, 'formato', a.formato,
                    -- ⚠️ L'ANNATA E' IL DATO CHE DISTINGUE DUE CONFEZIONI
                    --    ALTRIMENTI IDENTICHE, ed e' il motivo per cui la
                    --    proposta sbagliava: due bottiglie dello stesso vino
                    --    arrivavano qui indistinguibili.
                    'annata', a.annata,
                    'descrizione', a.descrizione, 'fornitore', s.name)
                  order by a.annata desc nulls last, a.aggiornato_il desc)
             from articoli_fornitore a
             left join suppliers s on s.id = a.supplier_id
            where a.ingredient_id = v.ing and not a.ignora
         ), '[]'::jsonb),
         nullif((select i2.current_price from ingredients i2 where i2.id = v.ing), 0)
    from vagliati v
   -- O QUANTITÀ (due parole) O SPECIFICITÀ (una parola che sta in un
   -- prodotto solo). Niente altro passa.
   where v.quante >= 2 or v.la_piu_rara = 1
   order by v.id, v.quante desc, v.la_piu_rara, v.prodotto;
end;
$$;

revoke all on function abbinamenti_carta_proposti(uuid) from public, anon, authenticated;
grant execute on function abbinamenti_carta_proposti(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. VERIFICA — dentro una sotto-transazione ANNULLATA
-- ---------------------------------------------------------------------
-- ⚠️ Regola del 30/08: una verifica non cancella, ANNULLA — e cosi' il
--    registro delle cancellazioni resta acceso per tutto il tempo e non c'e'
--    niente da ripulire, quindi niente da sbagliare ripulendo.
do $verifica$
declare
  v_lapidi_prima integer; v_lapidi_dopo integer;
  v_ing uuid; v_art uuid; v_cat text; v_forn uuid; v_tit uuid;
  v_conf jsonb; v_quanti integer;
begin
  select count(*) into v_lapidi_prima from deleted_records;

  begin
    -- Le colonne esistono e sono del tipo giusto.
    perform 1 from information_schema.columns
     where table_name = 'articoli_fornitore' and column_name = 'annata';
    if not found then raise exception 'manca articoli_fornitore.annata'; end if;
    perform 1 from information_schema.columns
     where table_name = 'ingredients' and column_name = 'va_in_carta';
    if not found then raise exception 'manca ingredients.va_in_carta'; end if;

    select codice into v_cat from categorie_ingrediente where mondo = 'vini' limit 1;
    if v_cat is null then raise exception 'nessuna categoria nel mondo vini'; end if;

    -- Un prodotto MIO, non uno vero: il perimetro di una prova e' fatto di
    -- roba che la prova ha creato (regola del 16/08).
    -- ⚠️ `entity_id` e' obbligatorio ed e' il vincolo portante del progetto
    --    (§1: ogni tabella economicamente rilevante ha il suo soggetto).
    --    Scoperto applicando, non rileggendo.
    select id into v_forn from entities where entity_type = 'srls' limit 1;
    insert into ingredients (entity_id, name, category, unit, alimentare, va_in_carta)
    values (v_forn, '__prova annata__', v_cat, 'pz', true, true) returning id into v_ing;

    -- Un'annata assurda dev'essere RESPINTA, non accettata in silenzio.
    begin
      insert into articoli_fornitore (descrizione, chiave, ingredient_id, annata)
      values ('__prova__', '__prova__', v_ing, 12);
      raise exception 'ANNATA ASSURDA PASSATA: il vincolo non tiene';
    exception when check_violation then
      null; -- respinta, com'e' giusto
    end;

    -- Un'annata vera passa, e vuota pure.
    insert into articoli_fornitore (descrizione, chiave, ingredient_id, annata)
    values ('__prova 2021__', '__prova2021__', v_ing, 2021) returning id into v_art;
    insert into articoli_fornitore (descrizione, chiave, ingredient_id, annata)
    values ('__prova 2019__', '__prova2019__', v_ing, 2019);
    insert into articoli_fornitore (descrizione, chiave, ingredient_id)
    values ('__prova senza__', '__provasenza__', v_ing);

    -- ⚠️ E LA FUNZIONE RISPONDE, non solo esiste: un corpo che si crea non e'
    --    un corpo che funziona (lezione del 17/08).
    -- 🔴 MA VA CHIAMATA DA UN TITOLARE, e dentro una migrazione non lo e'
    --    nessuno: `is_titolare()` durante una migrazione e' FALSO, perche'
    --    gira come `postgres` e non come utente applicativo (§6). Senza
    --    questa riga il portiere rifiuta e la verifica si ferma sul proprio
    --    controllo — trappola del 16/08, presa applicando e non rileggendo.
    select user_id into v_tit from user_roles where role = 'titolare' limit 1;
    if v_tit is null then raise exception 'nessun titolare per la verifica'; end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

    select confezioni into v_conf
      from prodotti_per_la_carta('vini') where ingredient_id = v_ing;
    if v_conf is null then
      raise exception 'prodotti_per_la_carta non trova un prodotto segnato «va in carta»';
    end if;
    if jsonb_array_length(v_conf) <> 3 then
      raise exception 'le confezioni dovrebbero essere 3, sono %', jsonb_array_length(v_conf);
    end if;
    -- L'annata piu' recente per prima: e' quella che si sta comprando.
    if (v_conf -> 0 ->> 'annata') is distinct from '2021' then
      raise exception 'la prima confezione doveva essere la 2021, e'' %',
        coalesce(v_conf -> 0 ->> 'annata', '(vuota)');
    end if;

    -- Un prodotto NON segnato non esce dall'elenco della carta.
    update ingredients set va_in_carta = false where id = v_ing;
    select count(*)::integer into v_quanti
      from prodotti_per_la_carta('vini') where ingredient_id = v_ing;
    if v_quanti <> 0 then
      raise exception 'un prodotto non segnato compare lo stesso fra quelli da mettere in carta';
    end if;

    perform set_config('request.jwt.claims', null, true);

    raise exception 'ANNULLA';
  exception when others then
    if sqlerrm <> 'ANNULLA' then raise; end if;
  end;

  select count(*) into v_lapidi_dopo from deleted_records;
  if v_lapidi_prima <> v_lapidi_dopo then
    raise exception 'la verifica ha lasciato % lapidi', v_lapidi_dopo - v_lapidi_prima;
  end if;

  raise notice 'Fatto: l''annata e'' un campo suo (assurda respinta, piu'' recente per prima) e il segno della carta filtra. Annullato: zero righe, % lapidi prima e dopo.', v_lapidi_prima;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260831000002', 'l_annata_e_il_segno_della_carta') on conflict (version) do nothing;
