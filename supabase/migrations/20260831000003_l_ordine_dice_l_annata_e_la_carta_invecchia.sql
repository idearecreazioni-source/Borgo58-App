-- =====================================================================
-- L'ORDINE DICE L'ANNATA, E LA CARTA DICE DA QUANTO E' FERMA — 31/08/2026
-- =====================================================================
--
-- 🔴 LA PREMESSA DEL MANDATO NON REGGEVA, E LA MISURA L'HA DETTO. Il mandato
-- dava per mancante *«il pezzo che dalle etichette sotto scorta arriva
-- all'ordine e ne riempie il testo»*. Misurato il 31/08 costruendo un vino
-- sotto scorta e seguendolo per tutta la catena, dentro una transazione
-- annullata:
--   0. `add_below_threshold_items()` lo mette in lista da se'  → 1 riga
--   1. `lista_spesa()` lo mostra                                → 1 riga
--   2. `bozza_ordine(fornitore)` lo raccoglie                   → 1 riga
--   3. e il testo si scrive da solo:
--      «Buongiorno, ordine per Borgo 58 — 31/08/2026 · ZZPROVA Etna Rosso
--       — 6 pz · Grazie!»
-- **La catena c'era gia' intera**, e reinventarla sarebbe stato costruire
-- due volte la stessa cosa.
--
-- 🔴 QUELLO CHE MANCAVA DAVVERO E' PIU' STRETTO E PIU' AFFILATO, e nasce dal
-- campo creato poche ore fa: **un ordine di vino non dice l'annata**. Con due
-- annate dello stesso vino a catalogo, «Nero d'Avola Contrada Sole — 6
-- bottiglie» e' un ordine che il fornitore non sa evadere — e sbaglia in
-- silenzio, perche' la merce arriva comunque, solo dell'annata sbagliata.
-- ⚠️ E' esattamente la ragione per cui l'annata e' uscita dalla descrizione:
-- finche' viveva dentro un testo libero, ci finiva o non ci finiva a seconda
-- di come qualcuno aveva scritto quella riga.

-- ---------------------------------------------------------------------
-- 1. LA BOZZA D'ORDINE PORTA L'ANNATA
-- ---------------------------------------------------------------------
-- 🔴 IL CORPO E' PRESO DAL DATABASE VIVO (regola del 18/08). Cambia **una
--    cosa sola**: la descrizione che finisce nel messaggio porta l'annata
--    quando la confezione ce l'ha.
-- ⚠️ E LA PORTA SOLO SE LA DICITURA E' DEL FORNITORE: sul nome interno
--    l'annata non si attacca, perche' quel nome gia' non e' il suo e
--    aggiungerci un dato lo farebbe somigliare a una dicitura vera. La riga
--    resta marcata «non so come lo chiama lui», che e' l'informazione utile.
CREATE OR REPLACE FUNCTION public.bozza_ordine(p_supplier_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_forn      suppliers%rowtype;
  v_righe     jsonb;
  v_testo     text;
  v_telefono  text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' preparare un ordine';
  end if;

  select * into v_forn from suppliers where id = p_supplier_id;
  if v_forn.id is null then
    raise exception 'Fornitore non trovato';
  end if;

  -- Il numero per WhatsApp: si tolgono spazi e simboli e si scarta lo 00
  -- internazionale. Se non c'e' gia' il prefisso, si mette 39.
  --
  -- ⚠️ **Lo zero iniziale NON si toglie.** In quasi tutto il mondo il
  --    prefisso urbano perde lo zero passando al formato internazionale;
  --    **in Italia no**: +39 0932 123456 e' la forma giusta, e togliere
  --    quello zero manderebbe l'ordine a un numero diverso da quello
  --    scritto in rubrica. Un errore che non si vede: il messaggio parte
  --    lo stesso, e arriva a uno sconosciuto.
  --
  -- ⚠️ Un numero gia' internazionale si riconosce da 39 **e** dalla
  --    lunghezza: un cellulare come 391 234 5678 comincia per 39 senza
  --    essere prefissato, e trattarlo come tale lo storpierebbe.
  --
  -- Comunque vada, il numero completo torna indietro e la schermata lo
  -- MOSTRA accanto al pulsante: e' Alessio a vedere dove sta per
  -- scrivere, non il gestionale a indovinare per lui.
  v_telefono := regexp_replace(coalesce(v_forn.contact_phone, ''), '[^0-9]', '', 'g');
  if v_telefono like '00%' then v_telefono := substring(v_telefono from 3); end if;
  if v_telefono <> '' and not (v_telefono like '39%' and length(v_telefono) >= 12) then
    v_telefono := '39' || v_telefono;
  end if;
  v_telefono := nullif(v_telefono, '');

  with righe as (
    select
      sli.id                                             as riga_lista_id,
      sli.ingredient_id,
      a.id                                               as articolo_id,
      -- Se non so come lo chiama lui, uso il nome interno E LO DICO.
      -- 🔴 E QUANDO LA DICITURA E' SUA E LA BOTTIGLIA HA UN'ANNATA, l'annata
      --    si scrive accanto (31/08/2026): senza, un ordine di vino con due
      --    annate a catalogo e' un ordine che il fornitore non sa evadere —
      --    e sbaglia IN SILENZIO, perche' la merce arriva lo stesso, solo
      --    dell'annata sbagliata.
      -- ⚠️ SOLO SULLA DICITURA SUA: sul nome interno l'annata non si
      --    attacca, perche' quel nome gia' non e' il suo e aggiungerci un
      --    dato lo farebbe somigliare a una dicitura vera. La riga resta
      --    marcata «non so come lo chiama lui», che e' l'informazione utile.
      case
        when a.id is not null and a.annata is not null
          then a.descrizione || ' ' || a.annata::text
        else coalesce(a.descrizione, i.name, sli.custom_name)
      end                                                as descrizione,
      (a.id is not null)                                 as dicitura_sua,
      a.annata,
      a.unita_fattura,
      a.fattore,
      sli.quantity_needed                                as quantita_base,
      coalesce(sli.unit, i.unit)::text                   as unita_base,
      -- Quante confezioni chiedere: per eccesso, perche' nessuno vende
      -- due terzi di cassa e mancare merce costa piu' che avanzarne.
      case
        when a.fattore is not null and a.fattore > 0 and sli.quantity_needed is not null
          then ceil(sli.quantity_needed / a.fattore)
        else sli.quantity_needed
      end                                                as quantita,
      -- 🔴 L'UNITA' CHE VA SCRITTA ACCANTO A QUEL NUMERO (23/08/2026), e la
      -- condizione e' la STESSA che sceglie il numero qui sopra: se si
      -- scegliessero con due regole diverse, prima o poi comparirebbe il
      -- numero delle confezioni con l'etichetta dei chili.
      case
        when a.fattore is not null and a.fattore > 0 and sli.quantity_needed is not null
          then a.unita_fattura
        else coalesce(a.unita_fattura, coalesce(sli.unit, i.unit)::text)
      end                                                as unita_da_scrivere,
      ultimo.price                                       as prezzo_atteso
    from shopping_list_items sli
    left join ingredients i on i.id = sli.ingredient_id
    -- Fra le diciture di quel fornitore per quell'ingrediente si prende
    -- quella comprata piu' di recente: e' quella che lui riconosce.
    left join lateral (
      select af.*
        from articoli_fornitore af
        left join lateral (
          select max(ph.recorded_at) as quando
            from price_history ph where ph.articolo_id = af.id
        ) u on true
       where af.supplier_id = p_supplier_id
         and af.ingredient_id = sli.ingredient_id
         and not af.ignora
       order by u.quando desc nulls last, af.creato_il desc
       limit 1
    ) a on true
    left join lateral (
      select ph.price
        from price_history ph
       where ph.articolo_id = a.id
       order by ph.recorded_at desc
       limit 1
    ) ultimo on true
    where sli.supplier_id = p_supplier_id
      and sli.status = 'da_comprare'
    order by coalesce(a.descrizione, i.name, sli.custom_name)
  )
  select
    coalesce(jsonb_agg(to_jsonb(righe)), '[]'::jsonb),
    string_agg(
      '• ' || righe.descrizione
        || case when righe.quantita is not null
             then ' — ' || quantita(righe.quantita)
                  || coalesce(' ' || righe.unita_da_scrivere, '')
             else '' end,
      E'\n' order by righe.descrizione)
  into v_righe, v_testo
  from righe;

  if v_testo is null then
    return jsonb_build_object(
      'fornitore', v_forn.name,
      'supplier_id', v_forn.id,
      'telefono', v_telefono,
      'telefono_scritto', v_forn.contact_phone,
      'email', v_forn.contact_email,
      'canale', v_forn.canale_ordine,
      'oggetto', null,
      'righe', '[]'::jsonb,
      'testo', null);
  end if;

  v_testo :=
    'Buongiorno, ordine per Borgo 58 — '
    || to_char((now() at time zone 'Europe/Rome')::date, 'DD/MM/YYYY')
    || E'\n\n' || v_testo || E'\n\nGrazie!';

  return jsonb_build_object(
    'fornitore', v_forn.name,
    'supplier_id', v_forn.id,
    'telefono', v_telefono,
    'telefono_scritto', v_forn.contact_phone,
    'email', v_forn.contact_email,
    -- Il canale lo ha scritto lui sulla scheda. Vuoto vuol dire «non
    -- l'ha detto»: la schermata offre le strade che i recapiti
    -- permettono, senza preferirne una.
    'canale', v_forn.canale_ordine,
    -- L'oggetto della mail: chi riceve venti ordini al giorno lo legge
    -- prima del corpo, e «Borgo 58» dev'esserci dentro.
    'oggetto', 'Ordine Borgo 58 — '
               || to_char((now() at time zone 'Europe/Rome')::date, 'DD/MM/YYYY'),
    'righe', v_righe,
    'testo', v_testo);
end;
$function$;

revoke all on function bozza_ordine(uuid) from public, anon, authenticated;
grant execute on function bozza_ordine(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. E3 · LA CARTA VECCHIA
-- ---------------------------------------------------------------------
-- 🔴 L'ALLERTA E' SULLA CARTA, NON SULLA GIACENZA — decisione di Alessio, e
-- la ragione e' dentro la decisione stessa: *«non a giacenza zero: quella
-- capita ogni settimana e rientra col carico dopo, e un'allerta che suona
-- sempre si impara a ignorare»*.
--
-- Quello che invecchia non e' la bottiglia: e' **il foglio stampato**. Se da
-- quando l'hai stampato sono entrate sei etichette nuove e ne sono uscite
-- tre, la carta che il cliente ha in mano racconta una cantina che non c'e'
-- piu'.
create table if not exists stampe_carta (
  id uuid primary key default gen_random_uuid(),
  sezione text not null,
  stampata_il timestamptz not null default now(),
  stampata_da uuid,
  quante_voci integer,
  nota text
);

comment on table stampe_carta is
  'Quando la carta e'' stata stampata l''ultima volta (31/08/2026). Serve a '
  'dire da quanto e'' ferma: l''allerta e'' sulla CARTA, non sulla giacenza — '
  'una bottiglia finita rientra col carico dopo, un foglio stampato no.';

alter table stampe_carta enable row level security;

drop policy if exists stampe_carta_select on stampe_carta;
create policy stampe_carta_select on stampe_carta
  for select to authenticated using ((select is_titolare()));

drop policy if exists stampe_carta_scrittura on stampe_carta;
create policy stampe_carta_scrittura on stampe_carta
  for all to authenticated using ((select is_titolare())) with check ((select is_titolare()));

create index if not exists idx_stampe_carta_sezione on stampe_carta (sezione, stampata_il desc);

create or replace function carta_da_ristampare()
returns table (
  sezione text, ultima_stampa timestamptz, giorni_ferma integer,
  entrate_da_allora integer, uscite_da_allora integer, voci_adesso integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (select is_titolare()) then
    raise exception 'Lo stato della carta lo vede solo il titolare';
  end if;

  return query
  with sezioni as (
    select distinct b.section as sez from bar_items b
  ),
  ultima as (
    select s.sez,
           (select max(sc.stampata_il) from stampe_carta sc where sc.sezione = s.sez) as quando
      from sezioni s
  )
  select
    u.sez::text,
    u.quando,
    -- ⚠️ VUOTO NON E' ZERO: una carta mai stampata non e' una carta ferma da
    --    zero giorni. Chi legge deve poter distinguere «non l'hai ancora
    --    stampata» da «l'hai stampata stamattina» (regola del 19/08).
    case when u.quando is null then null
         else ((now() at time zone 'Europe/Rome')::date - (u.quando at time zone 'Europe/Rome')::date)
    end::integer,
    (select count(*)::integer from bar_items b
      where b.section = u.sez and b.active
        and (u.quando is null or b.created_at > u.quando)),
    (select count(*)::integer from bar_items b
      where b.section = u.sez and not b.active
        and (u.quando is null or b.updated_at > u.quando)),
    (select count(*)::integer from bar_items b
      where b.section = u.sez and b.active)
    from ultima u
   order by u.sez;
end;
$$;

comment on function carta_da_ristampare is
  'Da quanto e'' ferma ogni carta, e quante etichette sono entrate e uscite '
  'da allora. ⚠️ Non dice SE ristampare: mostra i numeri e decide Alessio — '
  'una soglia inventata sarebbe una regola scritta da noi sulle sue cose.';

revoke all on function carta_da_ristampare() from public, anon, authenticated;
grant execute on function carta_da_ristampare() to authenticated;

create or replace function segna_carta_stampata(p_sezione text, p_nota text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_quante integer;
begin
  if not (select is_titolare()) then
    raise exception 'Solo il titolare puo'' segnare una carta come stampata';
  end if;
  if p_sezione is null or btrim(p_sezione) = '' then
    raise exception 'Quale carta hai stampato? La sezione serve: le carte sono piu'' di una.';
  end if;

  select count(*)::integer into v_quante
    from bar_items where section = p_sezione and active;

  insert into stampe_carta (sezione, stampata_da, quante_voci, nota)
  values (p_sezione, auth.uid(), v_quante, p_nota)
  returning id into v_id;
  return v_id;
end;
$$;

comment on function segna_carta_stampata is
  'Registra che questa carta e'' stata stampata adesso, fotografando quante '
  'voci aveva. ⚠️ Si FOTOGRAFA e non si ricalcola: ricalcolandolo, il numero '
  'di allora cambierebbe da solo a ogni etichetta aggiunta.';

revoke all on function segna_carta_stampata(text, text) from public, anon, authenticated;
grant execute on function segna_carta_stampata(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. VERIFICA — dentro una sotto-transazione ANNULLATA
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_lap_prima integer; v_lap_dopo integer;
  v_ent uuid; v_forn uuid; v_ing uuid; v_tit uuid; v_art uuid;
  v_boz jsonb; v_testo text; r record; v_id uuid; v_voci integer;
begin
  select count(*) into v_lap_prima from deleted_records;

  begin
    select id into v_ent from entities where entity_type = 'srls';
    select user_id into v_tit from user_roles where role = 'titolare' limit 1;
    select id into v_forn from suppliers limit 1;
    if v_forn is null then raise exception 'ZZ_SALTA'; end if;

    -- Roba MIA, non roba vera (regola del 16/08).
    insert into ingredients (entity_id, name, category, unit, alimentare,
                             stock_minimum_threshold, supplier_id)
    values (v_ent, '__prova annata ordine__', 'vino_rosso', 'pz', true, 6, v_forn)
    returning id into v_ing;

    insert into articoli_fornitore (descrizione, chiave, ingredient_id, supplier_id, annata)
    values ('Etna Rosso Contrada X', '__provaordine__', v_ing, v_forn, 2021)
    returning id into v_art;

    insert into shopping_list_items (ingredient_id, quantity_needed, unit, source, supplier_id, status)
    values (v_ing, 6, 'pz', 'soglia_minima', v_forn, 'da_comprare');

    perform set_config('request.jwt.claims',
      json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

    select bozza_ordine(v_forn) into v_boz;
    v_testo := coalesce(v_boz ->> 'testo', '');
    -- L'ANNATA DEV'ESSERE NEL MESSAGGIO: e' tutto il punto.
    if position('Etna Rosso Contrada X 2021' in v_testo) = 0 then
      raise exception 'L''annata NON e'' finita nell''ordine. Testo: %', left(v_testo, 200);
    end if;

    -- ⚠️ E SUL NOME INTERNO NON SI ATTACCA: senza dicitura del fornitore la
    --    riga resta marcata «non so come lo chiama lui», e appiccicarci
    --    l'annata la farebbe somigliare a una dicitura vera.
    update articoli_fornitore set ignora = true where id = v_art;
    select bozza_ordine(v_forn) into v_boz;
    v_testo := coalesce(v_boz ->> 'testo', '');
    if position('2021' in v_testo) > 0 then
      raise exception 'L''annata si e'' attaccata al nome interno: %', left(v_testo, 200);
    end if;

    -- E3: la carta mai stampata NON dice «ferma da zero giorni».
    -- ⚠️ LA SEZIONE E' UNA VERA, e non e' una scelta di comodo: `section` ha
    --    un vocabolario chiuso (`bar_items_section_check`) e una sezione
    --    inventata viene respinta. Scoperto applicando, non rileggendo.
    --    Non fa danno perche' tutto vive dentro la sotto-transazione che
    --    rientra: `stampe_carta` resta vuota.
    insert into bar_items (section, category, name, serving, selling_price)
    values ('vini', 'Prova', '__prova voce__', 'Calice', 5);

    select * into r from carta_da_ristampare() where sezione = 'vini';
    if r.sezione is null then
      raise exception 'carta_da_ristampare non vede una sezione con voci dentro';
    end if;
    if r.giorni_ferma is not null then
      raise exception 'Una carta mai stampata dichiara % giorni: vuoto non e'' zero', r.giorni_ferma;
    end if;
    v_voci := r.voci_adesso;

    -- Segnata stampata, i giorni diventano zero e le voci si fotografano.
    select segna_carta_stampata('vini') into v_id;
    select * into r from carta_da_ristampare() where sezione = 'vini';
    if r.giorni_ferma is distinct from 0 then
      raise exception 'Dopo la stampa i giorni dovrebbero essere 0, sono %',
        coalesce(r.giorni_ferma::text, '(vuoto)');
    end if;
    -- ⚠️ Si confronta col conteggio VERO letto un attimo prima, non con un
    --    numero scritto a mano: un numero scritto qui sarebbe una fotografia
    --    di questo database travestita da regola (lezione del 16/08).
    if (select quante_voci from stampe_carta where id = v_id) is distinct from v_voci then
      raise exception 'Le voci fotografate (%) non sono quelle che c''erano (%)',
        (select quante_voci from stampe_carta where id = v_id), v_voci;
    end if;

    perform set_config('request.jwt.claims', null, true);
    raise exception 'ZZ_ANNULLA';
  exception when others then
    if sqlerrm not in ('ZZ_ANNULLA', 'ZZ_SALTA') then raise; end if;
    if sqlerrm = 'ZZ_SALTA' then
      raise notice 'Saltata: nessun fornitore su questo database.';
    end if;
  end;

  select count(*) into v_lap_dopo from deleted_records;
  if v_lap_prima <> v_lap_dopo then
    raise exception 'la verifica ha lasciato % lapidi', v_lap_dopo - v_lap_prima;
  end if;

  raise notice 'Fatto: l''ordine dice l''annata (e non se l''attacca al nome interno), e la carta dice da quanto e'' ferma. Annullato: % lapidi prima e dopo.', v_lap_prima;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260831000003', 'l_ordine_dice_l_annata_e_la_carta_invecchia') on conflict (version) do nothing;
