-- =====================================================================
-- LO SCARTO NON SI INDOVINA, LA STAGIONALITA' DICE DA DOVE VIENE
-- 23/08/2026
-- =====================================================================
-- Blocco 4 del mandato del 23/08, le altre cose delle schede.
--
-- ---------------------------------------------------------------------
-- 1 · LO SCARTO ESCE DALLE MANI DELL'ASSISTENTE
-- ---------------------------------------------------------------------
-- Decisione di Alessio, con la sua ragione: *il dato vero emerge dalla
-- PREPARAZIONE — un chilo di alici che diventa un chilo di sugo — e lo
-- stesso ingrediente ha rese diverse a seconda di dove finisce. Un 35%
-- inventato entra nel costo di ogni piatto e nessuno lo verifica mai.*
--
-- ⚠️ **E' lo stesso ragionamento del Blocco 5 del mandato cumulativo**
-- (14/08): *lo scarto e' una proprieta' della coppia ingrediente ×
-- preparazione, non dell'ingrediente*. Le stesse cozze scartano pochissimo
-- per un'impepata e moltissimo se se ne ricava il mollusco. Quel blocco
-- toglie il campo del tutto; questo intanto smette di **riempirlo con un
-- numero inventato**.
--
-- ⚠️ Il campo NON sparisce e i valori esistenti NON si toccano: sparirebbe
-- il costo di ogni ricetta che li usa. Diventa opzionale — sulla scheda si
-- scrive a mano — e smette di far comparire un prodotto fra le schede
-- incomplete.
--
-- ---------------------------------------------------------------------
-- 2 · STAGIONALITA' E DURATA DICONO DA DOVE VENGONO
-- ---------------------------------------------------------------------
-- Il mandato: *«la stagionalita' da fonte certa: esistono calendari
-- regionali affidabili. L'assistente deve DIRE da dove viene, non solo il
-- risultato»*. E per la durata: *«stabilire la data di scadenza e'
-- responsabilita' diretta di Alessio e deve basarsi su linee guida
-- sanitarie consolidate, non improvvisata»*.
--
-- ⚠️ **E' lo stesso principio degli allergeni da confermare, applicato
-- alle durate**: non cambia il numero, cambia che il numero **porta con se'
-- da dove viene**. «Due giorni» e «due giorni secondo questa tabella» sono
-- due affermazioni diverse — la prima non si puo' contestare, la seconda
-- si'.
--
-- ⚠️ UNA COLONNA SOLA, non due (`fonte_stagionalita`, `fonte_durata`, e
-- domani una terza): stessa scelta fatta il 23/08 per `campi_da_confermare`
-- — una mappa regge il campo che nascera' domani.
--
-- ---------------------------------------------------------------------
-- 3 · I NON ALIMENTI
-- ---------------------------------------------------------------------
-- Misurato: **4 prodotti su 127** hanno un nome che lo dice — Carta forno,
-- Detergente per superfici, Sacchetti sottovuoto, Sgrassatore per cucina —
-- e **tutti e quattro sono marcati «e' un alimento»**. Finiscono fra le
-- schede incomplete e ci restano per sempre.
--
-- ⚠️ **NON lo indovina il gestionale da una lista di parole**: sarebbe una
-- regola scritta da noi sulle sue cose, e il giorno che compra un prodotto
-- con un nome inatteso finirebbe dalla parte sbagliata **in silenzio** — la
-- stessa ragione per cui le causali dei costi fissi le spunta lui.
-- Lo propone l'**assistente**, che il nome ce l'ha davanti, e resta fra i
-- campi da confermare finche' Alessio non lo guarda.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Da dove viene un campo messo dalla macchina
-- ---------------------------------------------------------------------
alter table ingredients
  add column if not exists fonti_campi jsonb not null default '{}'::jsonb;

comment on column ingredients.fonti_campi is
  'Da dove viene ciascun campo proposto dall''assistente: {"stagionalita": "...", "durata": "..."}. Non cambia il valore, dichiara su cosa si regge — «due giorni» e «due giorni secondo questa tabella» sono due affermazioni diverse, e la seconda si puo'' contestare. Stabilire una durata di conservazione e'' responsabilita'' di chi la firma.';


-- ---------------------------------------------------------------------
-- 2. Lo scarto esce dai campi che l'assistente compila
-- ---------------------------------------------------------------------
-- ⚠️ Corpi presi da quelli VIVI nel database.
do $riscrivi$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'prodotti_da_compilare';
  if v_def is null then
    raise exception 'prodotti_da_compilare non esiste.';
  end if;

  if position('case when coalesce(i.waste_percentage_default, 0) = 0' in v_def) > 0 then
    -- La riga dell'elenco dei campi mancanti.
    v_def := replace(v_def,
      $x$           case when coalesce(i.waste_percentage_default, 0) = 0
                     and i.campi_compilati_il is null  then 'scarto'          end,$x$,
      $x$           -- 🔴 LO SCARTO NON E' PIU' UN CAMPO CHE MANCA (23/08):
           -- non lo propone piu' nessuno, si scrive a mano quando si sa, e
           -- il dato vero emerge dalla preparazione.
$x$);
    -- E la condizione che fa comparire il prodotto nell'elenco.
    v_def := replace(v_def,
      '          or (coalesce(i.waste_percentage_default, 0) = 0 and i.campi_compilati_il is null)',
      '');
    execute v_def;
    raise notice 'prodotti_da_compilare: lo scarto non e'' piu'' un campo mancante.';
  else
    raise notice 'prodotti_da_compilare: lo scarto era gia'' fuori.';
  end if;
end $riscrivi$;

-- E `applica_scheda_prodotto` smette di scriverlo, anche se arrivasse: un
-- campo che l'assistente non deve piu' proporre non basta toglierlo dalle
-- istruzioni del modello — se un giorno lo rimandasse, qui verrebbe scritto
-- lo stesso, e nessuno se ne accorgerebbe.
--
-- ⚠️ E al suo posto la funzione impara a scrivere DA DOVE VIENE un campo.
do $riscrivi2$
declare
  v_def text;
  v_blocco text;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'applica_scheda_prodotto';
  if v_def is null then
    raise exception 'applica_scheda_prodotto non esiste.';
  end if;

  v_blocco := $x$  if coalesce(v_ing.waste_percentage_default, 0) = 0
     and (p_campi->>'scarto_percento') is not null then
    if (p_campi->>'scarto_percento')::numeric between 0 and 95 then
      update ingredients
         set waste_percentage_default = (p_campi->>'scarto_percento')::numeric
       where id = p_ingredient_id;
      v_scritti := v_scritti || 'scarto'::text;
    else
      v_scartati := v_scartati || ('scarto ' || (p_campi->>'scarto_percento'));
    end if;
  end if;$x$;

  if position(v_blocco in v_def) > 0 then
    v_def := replace(v_def, v_blocco,
      $x$  -- 🔴 LO SCARTO NON SI SCRIVE PIU' QUI (23/08/2026, decisione di
  -- Alessio). Se il modello lo mandasse lo stesso, si dichiara come
  -- scartato invece di finire nel costo dei piatti.
  if (p_campi->>'scarto_percento') is not null then
    v_scartati := v_scartati || 'scarto (non si indovina: lo dice la preparazione)'::text;
  end if;

  -- Da dove viene cio' che la macchina ha proposto. Non cambia il valore:
  -- dichiara su cosa si regge.
  if nullif(p_campi->>'fonte_stagionalita', '') is not null
     or nullif(p_campi->>'fonte_durata', '') is not null then
    update ingredients
       set fonti_campi = fonti_campi
             || jsonb_strip_nulls(jsonb_build_object(
                  'stagionalita', nullif(p_campi->>'fonte_stagionalita', ''),
                  'durata',       nullif(p_campi->>'fonte_durata', '')))
     where id = p_ingredient_id;
  end if;$x$);
    execute v_def;
    raise notice 'applica_scheda_prodotto: lo scarto non si scrive piu'', e le fonti si conservano.';
  elsif position('fonte_stagionalita' in v_def) > 0 then
    -- Gia' fatto — ma se ci fosse rimasta la forma senza il tipo esplicito,
    -- `v_scartati || 'testo'` verrebbe letto come un array e la funzione
    -- fallirebbe al primo uso. ⚠️ Postgres accetta una funzione che non
    -- funziona: il corpo si crea, l'errore arriva solo eseguendola.
    if position($x$|| 'scarto (non si indovina: lo dice la preparazione)';$x$ in v_def) > 0 then
      v_def := replace(v_def,
        $x$|| 'scarto (non si indovina: lo dice la preparazione)';$x$,
        $x$|| 'scarto (non si indovina: lo dice la preparazione)'::text;$x$);
      execute v_def;
      raise notice 'applica_scheda_prodotto: corretto il tipo della riga scartata.';
    else
      raise notice 'applica_scheda_prodotto: gia'' fatto.';
    end if;
  else
    -- ⚠️ Non si riscrive alla cieca una funzione che non si e' riconosciuta.
    raise exception 'applica_scheda_prodotto non ha la forma che mi aspettavo: mi fermo.';
  end if;
end $riscrivi2$;


-- ---------------------------------------------------------------------
-- 3. Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente     uuid;
  v_tit      uuid;
  v_ing      uuid;
  v_n        integer;
  v_lapidi   integer;
  v_lapidi_2 integer;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;

  -- ⚠️ Un prodotto TUTTO NOSTRO, con TUTTI gli altri campi gia' pieni: e'
  -- l'unico stato in cui la domanda «lo scarto lo fa comparire fra le
  -- schede incomplete?» ha una risposta. Con un campo qualsiasi vuoto il
  -- prodotto ci comparirebbe comunque e la prova non proverebbe niente
  -- (regola del caso vuoto, 17/08).
  insert into ingredients (
    name, unit, category, entity_id, alimentare,
    storage_type, shelf_life_days, temperatura_attesa, seasonality,
    origine_allergeni, waste_percentage_default
  ) values (
    'ZZ scarto', 'kg', 'verdura', v_ente, true,
    'dispensa', 30, 'ambiente', array['gen','feb']::month_code[],
    'confermati', 0
  ) returning id into v_ing;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  -- 1. Con lo scarto a zero e tutto il resto pieno, NON e' una scheda
  --    incompleta.
  select count(*) into v_n from prodotti_da_compilare() p where p.id = v_ing;
  if v_n <> 0 then
    raise exception 'Un prodotto con lo scarto a zero risulta ancora una scheda incompleta.';
  end if;

  -- 2. Controprova: togliendo un campo che invece manca davvero, torna.
  update ingredients set shelf_life_days = null where id = v_ing;
  select count(*) into v_n from prodotti_da_compilare() p where p.id = v_ing;
  if v_n <> 1 then
    raise exception 'L''elenco delle schede incomplete non riconosce piu'' una durata mancante: il filtro taglia troppo.';
  end if;
  if exists (select 1 from prodotti_da_compilare() p
              where p.id = v_ing and 'scarto' = any (p.mancano)) then
    raise exception 'Lo scarto compare ancora fra i campi che mancano.';
  end if;

  perform set_config('request.jwt.claims', null, true);

  -- 3. La colonna delle fonti esiste, e nasce vuota (non «null»: una mappa
  --    vuota si legge «nessuno ha ancora detto da dove viene», e non
  --    obbliga chi la legge a distinguere due modi di essere assente).
  if (select fonti_campi from ingredients where id = v_ing) <> '{}'::jsonb then
    raise exception 'La colonna delle fonti non nasce vuota.';
  end if;

  -- 4. Lo scarto proposto dal modello viene RESPINTO e dichiarato, e la
  --    fonte si conserva. ⚠️ Provato col valore piu' insidioso: 35, che e'
  --    plausibile — se passasse, nessuno lo metterebbe in dubbio.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  update ingredients set waste_percentage_default = 0, campi_compilati_il = null where id = v_ing;
  perform applica_scheda_prodotto(v_ing, jsonb_build_object(
    'scarto_percento', 35,
    'fonte_stagionalita', 'calendario regionale siciliano',
    'fonte_durata', 'linee guida di conservazione'));
  if coalesce((select waste_percentage_default from ingredients where id = v_ing), 0) <> 0 then
    raise exception 'Lo scarto proposto dal modello e'' finito nel costo dei piatti.';
  end if;
  if (select fonti_campi->>'stagionalita' from ingredients where id = v_ing)
       is distinct from 'calendario regionale siciliano' then
    raise exception 'La fonte della stagionalita'' non e'' stata conservata.';
  end if;
  if (select fonti_campi->>'durata' from ingredients where id = v_ing)
       is distinct from 'linee guida di conservazione' then
    raise exception 'La fonte della durata non e'' stata conservata.';
  end if;
  perform set_config('request.jwt.claims', null, true);

  delete from ingredients where id = v_ing;
  select count(*) into v_lapidi_2 from deleted_records;
  if v_lapidi_2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi.', v_lapidi_2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: lo scarto non e'' piu'' un campo che manca, e c''e'' il posto dove dire da dove viene un campo.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260823000007', 'lo_scarto_le_fonti_e_i_non_alimenti') on conflict (version) do nothing;
