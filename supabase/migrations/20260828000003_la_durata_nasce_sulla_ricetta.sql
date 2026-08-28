-- ============================================================================
-- LA DURATA NASCE SULLA RICETTA — 28/08/2026
-- ============================================================================
--
-- 🔴 DECISIONE DI ALESSIO, presa il 27/08 sera, e SUPERA quella del 25/08 per
--    cui la durata di un prodotto comprato veniva dedotta da MEMO. Tre parti:
--
--      1. la durata esce dai prodotti comprati — non compilata a mano e non
--         dedotta da MEMO: la giudica ingestibile e non la vuole;
--      2. la durata esiste SOLO per le preparazioni fatte in azienda, e la
--         scrive lui;
--      3. si scrive UNA VOLTA sulla ricetta («questo ragu' dura 5 giorni») e
--         ogni produzione registrata calcola da se' la propria scadenza.
--
--    La terza parte e' una scelta fra due, e l'ha fatta lui: l'alternativa era
--    scrivere la data a mano su ogni produzione. Ha preso questa perche' vuole
--    scriverla una volta sola e ritrovarsela pronta quando etichetta i
--    barattoli.
--
-- ⚠️ QUESTA MIGRAZIONE FA SOLO LA META' CHE COSTRUISCE. La meta' che toglie —
--    la colonna dai prodotti comprati e le nove funzioni che la nominano —
--    e' nella `20260828000004`. Sono separate apposta: se entrasse prima
--    quella che toglie, ci sarebbe un momento in cui nessuna durata esiste da
--    nessuna parte.
--
-- ----------------------------------------------------------------------------
-- COSA NON SI CONFONDE CON COSA — sono tre cose diverse
-- ----------------------------------------------------------------------------
--   · la DURATA di una preparazione fatta in casa → da oggi `recipes.durata_giorni`;
--   · la SCADENZA stampata sulla confezione di un prodotto comprato →
--     `stock_lots.expiry_date`, resta dov'e' e MEMO continua a leggerla
--     dall'etichetta;
--   · la DURATA presunta di un prodotto comprato → `ingredients.shelf_life_days`,
--     che e' quella che muore.
--
-- ----------------------------------------------------------------------------
-- COSA CAMBIA PER IL LOCALE
-- ----------------------------------------------------------------------------
--    Oggi niente: nessuna ricetta ha ancora una durata, quindi le produzioni
--    continuano a chiedere la scadenza come prima. Da quando Alessio scrive
--    «5 giorni» sul ragu', ogni vasetto di ragu' nasce con la sua data senza
--    che nessuno la digiti.
-- ============================================================================

alter table recipes add column if not exists durata_giorni integer;

-- ⚠️ IL LIMITE E' UNA RETE, NON UNA REGOLA SULLA CUCINA (24/08): rifiuta lo
--    zero — che vorrebbe dire «scade appena fatto» ed e' quasi sempre un dito
--    scivolato — e i valori che non possono essere una durata di laboratorio.
--    Due anni e' largo apposta: un sottovuoto o un congelato ci stanno dentro,
--    e un numero piu' stretto rifiuterebbe un caso legittimo, che e' peggio di
--    non avere nessun limite.
alter table recipes drop constraint if exists recipes_durata_sensata;
alter table recipes add constraint recipes_durata_sensata
  check (durata_giorni is null or (durata_giorni >= 1 and durata_giorni <= 730));

comment on constraint recipes_durata_sensata on recipes is
  'Quanto dura una preparazione si conta in giorni interi, da 1 a 730. Lo zero vorrebbe dire «scade appena fatta»: se e'' davvero cosi'', la durata si lascia vuota.';

comment on column recipes.durata_giorni is
  'quanti giorni dura questa preparazione una volta fatta (lo scrive Alessio, non lo deduce nessuno). Ogni produzione registrata la usa per calcolare da se'' la propria scadenza. Vuoto vuol dire «non l''ho ancora detto», e allora la scadenza si scrive a mano sulla produzione — mai «non scade».';

CREATE OR REPLACE FUNCTION public.registra_produzione(p_recipe_id uuid, p_dosi numeric, p_quantita_ottenuta numeric, p_scadenza date DEFAULT NULL::date, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ric        recipes%rowtype;
  v_ingr       uuid;
  v_prod       uuid;
  v_lotto      uuid;
  v_riga       record;
  v_lot        record;
  v_da         numeric;
  v_tolto      numeric;
  v_costo      numeric := 0;   -- il totale della produzione
  v_costo_riga numeric;        -- quanto e' costato QUESTO ingrediente
  v_quota      numeric;
  v_mancanti   integer := 0;
  v_scadenza   date;           -- calcolata dalla durata della ricetta
begin
  -- Registrare una produzione e' compito della cucina: il controllo e'
  -- che ci sia un utente vero, non che sia il titolare. Il COSTO pero'
  -- non torna indietro da qui — vive sul lotto, che lo staff non legge.
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_ric from recipes where id = p_recipe_id;
  if v_ric.id is null then raise exception 'Preparazione non trovata'; end if;
  if p_dosi is null or p_dosi <= 0 then
    raise exception 'Quante dosi hai fatto? Il numero serve: senza, un calo e mezza dose sono la stessa cosa';
  end if;
  if p_quantita_ottenuta is null or p_quantita_ottenuta <= 0 then
    raise exception 'Quanto ne e'' uscito? Serve il peso vero, non quello della ricetta';
  end if;

  -- 🔴 LA DURATA VIVE SULLA RICETTA, LA SCADENZA NASCE QUI (28/08/2026).
  --    Decisione di Alessio: la durata si scrive UNA VOLTA sulla ricetta
  --    («questo ragu' dura 5 giorni») e ogni produzione calcola da se' la
  --    propria scadenza — cosi' quando etichetta i barattoli se la ritrova
  --    pronta, invece di rifare il conto a ogni vasetto.
  --
  -- ⚠️ UNA DATA PASSATA A MANO VINCE SEMPRE, e non e' una seconda verita':
  --    e' lo stesso campo, scritto apertamente da chi sa qualcosa che la
  --    ricetta non sa (una dose andata storta, un frigo che ha fatto le bizze).
  --    Quello che sparisce e' l'OBBLIGO di scriverla ogni volta.
  --
  -- ⚠️ E IL GIORNO E' QUELLO DEL CALENDARIO ITALIANO — non `current_date`,
  --    che e' Greenwich e alle 01:30 risponde ieri, e non la serata di
  --    servizio: una data stampata su un'etichetta e' un fatto del
  --    calendario, come la raccolta o una scadenza fiscale.
  if p_scadenza is not null then
    v_scadenza := p_scadenza;
  elsif v_ric.durata_giorni is not null then
    v_scadenza := (now() at time zone 'Europe/Rome')::date + v_ric.durata_giorni;
  else
    v_scadenza := null;
  end if;

  v_ingr := ingrediente_di_preparazione(p_recipe_id);

  insert into produzioni (
    recipe_id, ingredient_id, dosi, quantita_ottenuta, unita,
    resa_attesa, scadenza, note, creato_da
  ) values (
    p_recipe_id, v_ingr, p_dosi, p_quantita_ottenuta,
    coalesce(v_ric.yield_unit::text, 'kg'),
    case when v_ric.yield_quantity is not null then v_ric.yield_quantity * p_dosi end,
    v_scadenza, p_note, auth.uid()
  )
  returning id into v_prod;

  -- 🔴 LE PREPARAZIONI CHE IL MAGAZZINO NON SEGUE (25/08/2026), stessa
  --    regola della sala: `fabbisogno_preparazione_seguito` taglia via
  --    tutto cio' che ha `tenuto_in_magazzino = false`, e per i prodotti
  --    ordinari e' voluto. Un semilavorato CON DELLE PARTITE IN CELLA no:
  --    li' il silenzio nasconde merce che entra e non esce.
  --    ⚠️ Descrizione = SOLO IL NOME: il motivo lo scrive la schermata.
  insert into anomalie_scarico
    (produzione_id, ingredient_id, tipo, descrizione, quantita_mancante)
  select v_prod, f.ingredient_id, 'preparazione_non_seguita', i.name,
         case when pizzico_trascurabile(sum(f.quantita)) then null
              else round(sum(f.quantita), 4) end
    from fabbisogno_preparazione(p_recipe_id, p_dosi) f
    join ingredients i on i.id = f.ingredient_id
   where not i.tenuto_in_magazzino
     and i.preparazione_id is not null
     and exists (select 1 from stock_lots sl where sl.ingredient_id = i.id)
   group by f.ingredient_id, i.name;

  -- ⚠️ E il conteggio che torna alla schermata le comprende: sono righe
  --    non scaricate a tutti gli effetti, e lasciarle fuori direbbe
  --    «e' sceso tutto» proprio nel caso in cui non e' vero.
  get diagnostics v_mancanti = row_count;

  -- Lo scarico, dai lotti che scadono prima (FEFO).
  -- ⚠️ Dal fabbisogno che salta i prodotti fuori magazzino (23/08): senza,
  -- un ragu' scaricherebbe la cannella che la sala non scarica, e i due
  -- posti direbbero due cose diverse.
  for v_riga in
    select f.ingredient_id, f.quantita from fabbisogno_preparazione_seguito(p_recipe_id, p_dosi) f
  loop
    v_da := v_riga.quantita;
    v_tolto := 0;
    v_costo_riga := 0;

    for v_lot in
      select id, quantity_remaining, unit_cost
        from stock_lots
       where ingredient_id = v_riga.ingredient_id and quantity_remaining > 0
       order by expiry_date asc nulls last, received_at asc
       for update
    loop
      exit when v_da <= 0;
      v_quota := least(v_lot.quantity_remaining, v_da);
      update stock_lots set quantity_remaining = quantity_remaining - v_quota where id = v_lot.id;
      v_tolto      := v_tolto + v_quota;
      v_costo_riga := v_costo_riga + v_quota * coalesce(v_lot.unit_cost, 0);
      v_da         := v_da - v_quota;
    end loop;

    v_costo := v_costo + v_costo_riga;

    -- 🔴 Come nello scarico di un conto: sotto il decimo di grammo non
    -- c'e' nessun numero da scrivere (23/08).
    if not pizzico_trascurabile(v_tolto) then
      insert into stock_consumptions
        (ingredient_id, quantity, reason, note, produzione_id, quantita_richiesta, costo)
      values
        (v_riga.ingredient_id, round(v_tolto, 4), 'consumo',
         'Produzione: ' || v_ric.name, v_prod, v_riga.quantita,
         round(v_costo_riga, 4));
    end if;

    -- Non si inventa e non si blocca: il semilavorato e' gia' fatto.
    if not pizzico_trascurabile(v_da) then
      v_mancanti := v_mancanti + 1;
      insert into anomalie_scarico
        (produzione_id, ingredient_id, tipo, descrizione, quantita_mancante)
      values
        (v_prod, v_riga.ingredient_id, 'giacenza_insufficiente',
         (select name from ingredients where id = v_riga.ingredient_id),
         round(v_da, 4));
    end if;
  end loop;

  -- Il lotto del semilavorato, col costo di oggi.
  insert into stock_lots (
    ingredient_id, quantity_received, quantity_remaining, unit_cost, expiry_date, note
  ) values (
    v_ingr, p_quantita_ottenuta, p_quantita_ottenuta,
    round(v_costo / p_quantita_ottenuta, 4), v_scadenza,
    'Produzione del ' || to_char((now() at time zone 'Europe/Rome')::date, 'DD/MM/YYYY')
  )
  returning id into v_lotto;

  update produzioni set lotto_id = v_lotto, costo = round(v_costo, 4) where id = v_prod;

  -- Niente costi nella risposta: la chiama anche la cucina.
  -- ⚠️ I NOMI DEI CAMPI SONO UN PATTO CON LA SCHERMATA: `Produzioni.jsx`
  -- legge `righe_non_scaricate`, e rinominarlo non da' nessun errore —
  -- l'avviso direbbe zero per sempre.
  return jsonb_build_object(
    'produzione_id', v_prod,
    'lotto_id', v_lotto,
    'quantita', p_quantita_ottenuta,
    'righe_non_scaricate', v_mancanti
  );
end;
$function$;

-- ---------------------------------------------------------------------
-- Verifica — provata ROMPENDOLA in due modi diversi
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare  uuid;
  v_lapidi    bigint;
  v_lapidi2   bigint;
  v_miei      uuid[] := '{}';
  v_ric       uuid;
  v_prod      jsonb;
  v_scad      date;
  v_oggi      date := (now() at time zone 'Europe/Rome')::date;
  v_rifiutato boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Serve un titolare per verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select count(*) into v_lapidi from deleted_records;

  -- ⚠️ L'ESEMPIO SI COSTRUISCE, NON SI PRENDE IN PRESTITO (regola del
  --    27/08, nata da questa migrazione che si e' fermata in produzione
  --    proprio per averlo preso in prestito). In produzione le ricette
  --    sono 14 e gli ingredienti ZERO: una verifica che pescasse «una
  --    preparazione qualunque» qui passerebbe e la' no.
  v_ric := gen_random_uuid();
  insert into recipes (id, name, category, recipe_type, portions_yield, yield_quantity, yield_unit)
  values (v_ric, 'PROVA DURATA 28082026', 'primo', 'preparazione', 1, 1, 'kg');
  v_miei := v_miei || v_ric;

  -- (a) IL LIMITE RIFIUTA LO ZERO.
  v_rifiutato := false;
  begin
    update recipes set durata_giorni = 0 where id = v_ric;
  exception when check_violation then
    v_rifiutato := true;
  end;
  if not v_rifiutato then
    raise exception 'Una durata di zero giorni viene accettata.';
  end if;

  -- (b) ⚠️ E ACCETTA UN CASO LEGITTIMO MA INSOLITO. Serve quanto (a) e va
  --     nel verso opposto: un limite che rifiuta anche i casi buoni e'
  --     peggio di nessun limite (regola del 24/08). Un sottovuoto che dura
  --     un anno e mezzo deve passare.
  update recipes set durata_giorni = 540 where id = v_ric;

  -- (c) LA SCADENZA NASCE DALLA DURATA, senza che nessuno la scriva.
  update recipes set durata_giorni = 5 where id = v_ric;
  v_prod := registra_produzione(v_ric, 1, 2, null, 'verifica 28082026');
  select scadenza into v_scad from produzioni where id = (v_prod->>'produzione_id')::uuid;
  if v_scad is distinct from v_oggi + 5 then
    raise exception 'La scadenza calcolata e'' % invece di %.', coalesce(v_scad::text, '<vuota>'), v_oggi + 5;
  end if;

  -- ⚠️ E DEV'ESSERE LA STESSA SUL LOTTO: sono i due posti dove la data
  --    finisce, e uno solo dei due aggiornato non darebbe nessun errore —
  --    darebbe un barattolo in cella con una scadenza diversa da quella
  --    della produzione che l'ha fatto nascere.
  select expiry_date into v_scad from stock_lots
   where id = (select lotto_id from produzioni where id = (v_prod->>'produzione_id')::uuid);
  if v_scad is distinct from v_oggi + 5 then
    raise exception 'Il lotto porta la scadenza % invece di %.', coalesce(v_scad::text, '<vuota>'), v_oggi + 5;
  end if;

  -- (d) UNA DATA SCRITTA A MANO VINCE SULLA DURATA.
  v_prod := registra_produzione(v_ric, 1, 2, v_oggi + 99, 'verifica 28082026');
  select scadenza into v_scad from produzioni where id = (v_prod->>'produzione_id')::uuid;
  if v_scad is distinct from v_oggi + 99 then
    raise exception 'La data scritta a mano non vince: %.', coalesce(v_scad::text, '<vuota>');
  end if;

  -- (e) SENZA DURATA E SENZA DATA, LA SCADENZA RESTA VUOTA — mai una data
  --     inventata. Vuoto vuol dire «non l'ho ancora detto», non «non scade».
  update recipes set durata_giorni = null where id = v_ric;
  v_prod := registra_produzione(v_ric, 1, 2, null, 'verifica 28082026');
  select scadenza into v_scad from produzioni where id = (v_prod->>'produzione_id')::uuid;
  if v_scad is not null then
    raise exception 'Senza durata la scadenza viene inventata: %.', v_scad;
  end if;

  -- --- pulizia: SOLO cio' che ha creato questa verifica, per identificativo
  delete from stock_consumptions where produzione_id in (select id from produzioni where recipe_id = any(v_miei));
  delete from anomalie_scarico  where produzione_id in (select id from produzioni where recipe_id = any(v_miei));
  delete from stock_lots        where id in (select lotto_id from produzioni where recipe_id = any(v_miei));
  delete from produzioni        where recipe_id = any(v_miei);
  delete from ingredients       where preparazione_id = any(v_miei);
  delete from recipes           where id = any(v_miei);

  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'La durata vive sulla ricetta e la scadenza nasce da se''; una data a mano vince, e senza durata resta vuota.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260828000003', 'la_durata_nasce_sulla_ricetta') on conflict (version) do nothing;
