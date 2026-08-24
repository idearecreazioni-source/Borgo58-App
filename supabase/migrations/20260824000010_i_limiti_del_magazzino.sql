-- =====================================================================
-- I LIMITI NATURALI DEL MAGAZZINO
-- 24/08/2026 — secondo gruppo delle reti sui numeri assurdi
-- =====================================================================
-- Stesso giro del denaro, sull'altra meta' del gestionale. Le parole di
-- Alessio che lo hanno aperto nominano proprio questo caso: *«e' lo
-- stesso schema dei 993 grammi diventati 993 chili in silenzio»*.
--
-- ---------------------------------------------------------------------
-- 🔴 LO SCARTO E' IL PIU' PERICOLOSO DEI QUATTRO, e non e' evidente
-- ---------------------------------------------------------------------
-- `ingredients.waste_percentage_default` e `recipe_ingredients.waste_percentage`
-- sono percentuali in PUNTI (misurato: 0..35 sui dati veri, 110 righe
-- valorizzate). Servono a dire quanto di cio' che si compra finisce nel
-- bidone: la ricetta chiede 200 g puliti, e con uno scarto del 15% se ne
-- comprano 235.
--
-- ⚠️ **A 100 il conto esplode**: il lordo si ricava dividendo per
-- (1 - scarto/100), e con scarto 100 quella divisione e' per zero. A 99
-- il fabbisogno diventa cento volte la ricetta; a 150 diventa
-- **negativo**, cioe' comprare un ingrediente farebbe risparmiare merce.
-- Nessuno di questi da' un errore: danno un numero.
--
-- Il limite certo e' quindi **0 <= scarto < 100**, ed e' aritmetico, non
-- scelto: uno scarto del 100% vuol dire che di quel prodotto non resta
-- niente, e allora non e' un ingrediente.
--
-- ---------------------------------------------------------------------
-- LE ALTRE SOGLIE, DICHIARATE
-- ---------------------------------------------------------------------
--   quantita' in ricetta      > 0        — zero non e' un ingrediente
--   quantita' in lista spesa  > 0        — «comprane zero» non e' una riga
--   durata di un prodotto     > 0        — zero giorni vuol dire scaduto
--                                          all'arrivo
--   preavviso di scadenza     > 0        — zero avvisa quando e' tardi;
--     e <= 365                             oltre l'anno avvisa sempre, che
--                                          e' lo stesso che non avvisare
--   resa attesa               > 0        — una dose che non rende niente
--   raccolto                  >= 0       — zero e' un raccolto andato male,
--                                          e va potuto scrivere
--   costo di uno scarico      >= 0
--
-- ⚠️ TEMPERATURE: il limite certo e' **-80..+150 °C**. Sotto -80 non c'e'
-- nessun congelatore da ristorazione (l'azoto liquido non si misura con
-- questa scheda); sopra 150 non c'e' nessun alimento che si conservi. E'
-- largo apposta: serve a fermare una virgola persa (**185 invece di
-- 18,5**) e un'unita' sbagliata, non a giudicare se un frigo va bene —
-- quello lo fa gia' il range della sua attrezzatura. I valori misurati
-- stanno fra -21,5 e +10,6.
--
-- ⚠️ E lo ZERO resta ammesso ovunque una temperatura possa valerlo: 0 °C
-- e' la temperatura del pesce fresco, non l'assenza di un dato (trappola
-- gia' scritta in `registra_temperatura` il 12/08).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Lo scarto
-- ---------------------------------------------------------------------
alter table ingredients drop constraint if exists ingredients_scarto_sotto_cento;
alter table ingredients add constraint ingredients_scarto_sotto_cento check (
  waste_percentage_default is null
  or (waste_percentage_default >= 0 and waste_percentage_default < 100)
);

comment on constraint ingredients_scarto_sotto_cento on ingredients is
  'Lo scarto e'' una percentuale in PUNTI (35 = 35%) e sta sotto 100: il lordo si ricava dividendo per (1 - scarto/100), quindi a 100 e'' una divisione per zero e sopra 100 il fabbisogno diventa negativo. Nessuno dei due da'' un errore: danno un numero.';

alter table recipe_ingredients drop constraint if exists recipe_ingredienti_numeri_sensati;
alter table recipe_ingredients add constraint recipe_ingredienti_numeri_sensati check (
  quantity > 0
  and (waste_percentage is null or (waste_percentage >= 0 and waste_percentage < 100))
);

comment on constraint recipe_ingredienti_numeri_sensati on recipe_ingredients is
  'Una riga di ricetta con quantita'' zero non e'' un ingrediente. Lo scarto sta sotto 100 per la stessa ragione aritmetica dell''anagrafica.';

-- ---------------------------------------------------------------------
-- 2 · Durate e preavvisi
-- ---------------------------------------------------------------------
alter table ingredients drop constraint if exists ingredients_durate_sensate;
alter table ingredients add constraint ingredients_durate_sensate check (
  (shelf_life_days is null or shelf_life_days > 0)
  and (giorni_preavviso_scadenza is null
       or (giorni_preavviso_scadenza > 0 and giorni_preavviso_scadenza <= 365))
);

comment on constraint ingredients_durate_sensate on ingredients is
  'Una durata di zero giorni vuol dire scaduto all''arrivo. Un preavviso di zero avvisa quando e'' tardi; oltre l''anno avvisa sempre, che e'' lo stesso che non avvisare.';

-- ---------------------------------------------------------------------
-- 3 · Quantita' e costi
-- ---------------------------------------------------------------------
alter table shopping_list_items drop constraint if exists shopping_quantita_positiva;
alter table shopping_list_items add constraint shopping_quantita_positiva check (
  quantity_needed is null or quantity_needed > 0
);

alter table produzioni drop constraint if exists produzioni_resa_positiva;
alter table produzioni add constraint produzioni_resa_positiva check (
  resa_attesa is null or resa_attesa > 0
);

alter table stock_consumptions drop constraint if exists stock_consumptions_costo_non_negativo;
alter table stock_consumptions add constraint stock_consumptions_costo_non_negativo check (
  costo is null or costo >= 0
);

alter table crops drop constraint if exists crops_raccolto_non_negativo;
alter table crops add constraint crops_raccolto_non_negativo check (
  harvested_quantity is null or harvested_quantity >= 0
);

comment on constraint crops_raccolto_non_negativo on crops is
  'Zero e'' ammesso: e'' un raccolto andato male, e va potuto scrivere. Negativo no.';

-- ---------------------------------------------------------------------
-- 4 · Le temperature
-- ---------------------------------------------------------------------
alter table haccp_temperature_logs drop constraint if exists temperature_dentro_il_mondo;
alter table haccp_temperature_logs add constraint temperature_dentro_il_mondo check (
  recorded_temp_c >= -80 and recorded_temp_c <= 150
);

comment on constraint temperature_dentro_il_mondo on haccp_temperature_logs is
  'Limite largo apposta: ferma una virgola persa (185 invece di 18,5) o un''unita'' sbagliata, non giudica se il frigo va bene — quello lo fa il range della sua attrezzatura. Lo zero resta ammesso: 0 gradi e'' la temperatura del pesce fresco.';

alter table haccp_goods_receiving drop constraint if exists ricevimento_temperatura_sensata;
alter table haccp_goods_receiving add constraint ricevimento_temperatura_sensata check (
  temperature_c is null or (temperature_c >= -80 and temperature_c <= 150)
);

alter table haccp_equipment drop constraint if exists equipment_range_dentro_il_mondo;
alter table haccp_equipment add constraint equipment_range_dentro_il_mondo check (
  (target_min_c is null or (target_min_c >= -80 and target_min_c <= 150))
  and (target_max_c is null or (target_max_c >= -80 and target_max_c <= 150))
);

-- ---------------------------------------------------------------------
-- 5 · Verifica — rompendo, e con valori che discriminano
-- ---------------------------------------------------------------------
-- ⚠️ La lezione della migrazione precedente vale anche qui: prima di
-- scegliere il valore di una prova si guarda **quali altri vincoli
-- esistono gia'** su quella riga. Un valore abbastanza assurdo li viola
-- tutti insieme, e allora la prova non dice quale l'ha fermato.
do $verifica$
declare
  v_titolare uuid;
  v_ente     uuid;
  v_ing      uuid;
  v_eq       uuid;
  v_respinto boolean;
  v_lapidi_p bigint;
  v_lapidi_d bigint;
begin
  select count(*) into v_lapidi_p from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_ente from entities order by created_at limit 1;

  insert into ingredients (entity_id, name, unit, category, tenuto_in_magazzino)
  values (v_ente, 'VERIFICA 830 scarto', 'kg', 'altro', true) returning id into v_ing;

  -- (a) Lo scarto al 100%: respinto. E' il caso della divisione per zero.
  v_respinto := false;
  begin
    update ingredients set waste_percentage_default = 100 where id = v_ing;
  exception when check_violation then v_respinto := true;
  end;
  if not v_respinto then
    delete from ingredients where id = v_ing;
    raise exception 'Uno scarto del 100%% e'' stato accettato: il fabbisogno diventerebbe una divisione per zero.';
  end if;

  -- (b) 🔴 E il verso opposto conta quanto il primo. **90 e' altissimo ma
  --     vero**: i carciofi, che si buttano quasi tutti. Un limite che
  --     respingesse anche questo sarebbe peggio di nessun limite —
  --     costringerebbe a scrivere un numero falso per passare oltre.
  update ingredients set waste_percentage_default = 90 where id = v_ing;
  if (select waste_percentage_default from ingredients where id = v_ing) <> 90 then
    raise exception 'Uno scarto del 90%% doveva passare: sui carciofi e'' la realta''.';
  end if;

  -- (c) Anche 99,9 passa, e 100 no: il confine e' esattamente dove il
  --     conto smette di funzionare, non un decimo prima.
  update ingredients set waste_percentage_default = 99.9 where id = v_ing;

  -- (d) Durata zero: respinta. Un giorno: ammessa (il pesce del giorno).
  v_respinto := false;
  begin
    update ingredients set shelf_life_days = 0 where id = v_ing;
  exception when check_violation then v_respinto := true;
  end;
  if not v_respinto then
    delete from ingredients where id = v_ing;
    raise exception 'Una durata di zero giorni e'' stata accettata.';
  end if;
  update ingredients set shelf_life_days = 1 where id = v_ing;

  -- (e) Le temperature. 185 al posto di 18,5 e' la virgola persa;
  --     -30 e' un abbattitore vero e deve passare.
  insert into haccp_equipment (name, storage_type, target_min_c, target_max_c)
  values ('VERIFICA 830 abbattitore', 'freezer', -30, -18) returning id into v_eq;

  v_respinto := false;
  begin
    insert into haccp_temperature_logs (equipment_id, recorded_temp_c)
    values (v_eq, 185);
  exception when check_violation then v_respinto := true;
  end;
  if not v_respinto then
    delete from haccp_temperature_logs where equipment_id = v_eq;
    delete from haccp_equipment where id = v_eq;
    delete from ingredients where id = v_ing;
    raise exception '185 gradi sono stati accettati: la virgola persa passa.';
  end if;

  -- ⚠️ -30 e' fuori dal range dell'attrezzatura ma DENTRO il mondo: deve
  -- passare, e aprire semmai una non conformita'. Confondere «impossibile»
  -- con «fuori norma» toglierebbe al registro proprio le letture che
  -- servono.
  insert into haccp_temperature_logs (equipment_id, recorded_temp_c) values (v_eq, -30);
  if not exists (select 1 from haccp_temperature_logs where equipment_id = v_eq and recorded_temp_c = -30) then
    raise exception '-30 gradi doveva passare: e'' un abbattitore, non un errore.';
  end if;

  -- --- Pulizia: solo le righe di questa verifica, figlie prima delle madri.
  delete from haccp_non_conformities where equipment_id = v_eq;
  delete from haccp_temperature_logs where equipment_id = v_eq;
  delete from haccp_equipment where id = v_eq;
  delete from price_history where ingredient_id = v_ing;
  delete from ingredients where id = v_ing;

  select count(*) into v_lapidi_d from deleted_records;
  if v_lapidi_d <> v_lapidi_p then
    raise exception 'Il registro delle cancellazioni e'' passato da % a %.', v_lapidi_p, v_lapidi_d;
  end if;

  raise notice 'Limiti del magazzino: undici vincoli, provati nei due versi.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000010', 'i_limiti_del_magazzino') on conflict (version) do nothing;
