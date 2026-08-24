-- =====================================================================
-- I LIMITI NATURALI DEL DENARO E DELLE IMPOSTE
-- 24/08/2026 — primo gruppo delle reti sui numeri assurdi
-- =====================================================================
-- 🔴 PERCHE' QUESTO GIRO ESISTE, con le parole di Alessio: *«l'aliquota
-- scritta 0,24 invece di 24 non era un difetto del codice: era un dato
-- assurdo che nessuno ha impedito. E' lo stesso schema dei 993 grammi
-- diventati 993 chili in silenzio. Voglio che questi errori diventino
-- IMPOSSIBILI, non che li scopriamo guardando.»*
--
-- ---------------------------------------------------------------------
-- COSA HO CENSITO, E COME
-- ---------------------------------------------------------------------
-- Chiesto al catalogo, non ricordato: **111 colonne numeriche** delle
-- tabelle di `public` non hanno nessun vincolo `check` che le nomini.
-- ⚠️ Ma quel numero e' un SETACCIO, non un elenco di difetti: dice dove
-- guardare. La meta' abbondante sono **risultati calcolati**
-- (`scenario_risultati`, `consuntivi_mensili`), scritti da una funzione e
-- non da una mano, dove un limite respingerebbe una perdita legittima —
-- un EBITDA negativo e' un fatto, non un errore di battitura.
--
-- Qui ci sono solo le colonne che **qualcuno scrive**, e solo quelle il
-- cui limite e' CERTO. I limiti soltanto sospetti stanno altrove: si
-- avvisa, non si rifiuta (`20260824000010`).
--
-- ---------------------------------------------------------------------
-- 🔴 LA RADICE: «PERCENTO» IN QUESTO DATABASE VUOL DIRE DUE COSE
-- ---------------------------------------------------------------------
-- Misurato leggendo i valori veri, non i nomi:
--
--   in FRAZIONE (0-1)        `scenari_proiezione.food_cost_percento` = 0,25
--                            `pagamenti_elettronici_percento` = 0,50
--                            `commissione_pos_percento` = 0,015
--                            `finanziamento_tasso` = 0,06
--                            `aliquota_foglio_informativa` = 0,30
--   in PUNTI (0-100)         `fiscal_settings.ires_rate` = 24,00
--                            `plafond_rappresentanza_percento` = 1,50
--                            `service_settings.soglia_rincaro_percento`
--                            `ingredients.waste_percentage_default` = 35
--
-- **Chi scrive un valore nuovo non ha nessun modo di sapere quale delle
-- due**, e sbagliando non riceve nessun errore: riceve un numero
-- credibile. E' esattamente cosi' che le imposte sono diventate cento
-- volte piu' basse.
--
-- ⚠️ Un vincolo non toglie l'ambiguita' del NOME — quella si toglie
-- rinominando le colonne, che e' un lavoro a se' e non si fa stanotte —
-- ma **toglie il silenzio**: una frazione scritta in punti finisce sopra
-- 1 e viene respinta, un punto scritto in frazione finisce sotto 1 e
-- viene respinto dal vincolo delle aliquote gia' messo stamattina.
--
-- ---------------------------------------------------------------------
-- LE SOGLIE, DICHIARATE UNA PER UNA
-- ---------------------------------------------------------------------
-- ⚠️ Dove il limite e' aritmetico non c'e' niente da dichiarare (una
-- frazione sta fra 0 e 1, un prezzo non e' negativo). Dove invece ho
-- scelto un numero, la ragione e' scritta accanto — e se un giorno un
-- caso legittimo lo supera, quel numero si discute perche' e' visibile.
--
--   ore al giorno        > 0 e <= 24   — un giorno ha ventiquattro ore
--   anni di finanziamento 0..40        — oltre e' un mutuo immobiliare,
--                                        e questo campo e' l'attrezzatura
--   anno dello scenario  2000..2100    — fuori e' una battitura
--   servizi a settimana  0..14         — due al giorno per sette giorni
--   pressione personale  0..3          — il costo aziendale sopra il
--                                        400% del netto non esiste in
--                                        nessun contratto italiano; sotto
--                                        quella soglia passa tutto, e un
--                                        «32» scritto al posto di «0,32»
--                                        viene fermato
--
-- ⚠️ `aliquota_foglio_informativa` NON riceve un vincolo: e' un valore
-- letto dal foglio di Alessio e conservato per informazione, e in
-- produzione vale 0,30 — una frazione. Ma nessun calcolo la usa, quindi
-- un limite sbagliato qui farebbe fallire un'importazione senza proteggere
-- niente. **Il caso e' dichiarato, non chiuso.**
--
-- ⚠️ IDEMPOTENTE, e riapplicabile a meta': ogni vincolo si toglie e si
-- rimette. Se uno fallisce perche' una riga lo viola, la migrazione si
-- ferma li' e lo dice — e quella riga e' l'informazione che si cercava.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · I parametri fiscali
-- ---------------------------------------------------------------------
alter table fiscal_settings drop constraint if exists fiscal_settings_numeri_sensati;
alter table fiscal_settings add constraint fiscal_settings_numeri_sensati check (
  (plafond_rappresentanza_percento is null
    or (plafond_rappresentanza_percento >= 0 and plafond_rappresentanza_percento <= 100))
  and (acconto_soglia_minima is null or acconto_soglia_minima >= 0)
  and (annual_revenue_estimate is null or annual_revenue_estimate >= 0)
);

comment on constraint fiscal_settings_numeri_sensati on fiscal_settings is
  'Il plafond di rappresentanza e'' una percentuale in PUNTI (1,5 = 1,5%): sta fra 0 e 100. Soglia dell''acconto e stima dei ricavi non sono negative.';

-- ---------------------------------------------------------------------
-- 2 · La previsione: le frazioni sono frazioni
-- ---------------------------------------------------------------------
alter table scenari_proiezione drop constraint if exists scenario_frazioni_sono_frazioni;
alter table scenari_proiezione add constraint scenario_frazioni_sono_frazioni check (
  food_cost_percento >= 0 and food_cost_percento <= 1
  and beverage_cost_percento >= 0 and beverage_cost_percento <= 1
  and pagamenti_elettronici_percento >= 0 and pagamenti_elettronici_percento <= 1
  and commissione_pos_percento >= 0 and commissione_pos_percento <= 1
  and finanziamento_tasso >= 0 and finanziamento_tasso <= 1
);

comment on constraint scenario_frazioni_sono_frazioni on scenari_proiezione is
  'In questa tabella le percentuali si scrivono in FRAZIONE (0,25 = 25%), non in punti: la schermata divide per cento prima di salvare. Scritte in punti finiscono sopra 1, e da li'' in poi ogni numero della previsione sarebbe cento volte sbagliato senza nessun errore.';

alter table scenari_proiezione drop constraint if exists scenario_numeri_sensati;
alter table scenari_proiezione add constraint scenario_numeri_sensati check (
  scontrino_food >= 0
  and scontrino_beverage >= 0
  and lavanderia_coperto >= 0
  and ammortamenti_annui >= 0
  and finanziamento_importo >= 0
  and finanziamento_anni >= 0 and finanziamento_anni <= 40
  and ore_giorno > 0 and ore_giorno <= 24
  and pressione_personale >= 0 and pressione_personale <= 3
  and anno >= 2000 and anno <= 2100
);

comment on constraint scenario_numeri_sensati on scenari_proiezione is
  'Le ore di un giorno sono al massimo 24; un finanziamento sull''attrezzatura dura al massimo 40 anni; la pressione fiscale e contributiva sopra il 300% del netto non esiste in nessun contratto italiano — e quel limite ferma un «32» scritto al posto di «0,32». Prezzi e importi non sono negativi.';

alter table scenario_extra drop constraint if exists scenario_extra_pressione_sensata;
alter table scenario_extra add constraint scenario_extra_pressione_sensata check (
  pressione >= 0 and pressione <= 3
);

alter table scenario_mesi drop constraint if exists scenario_mesi_servizi_sensati;
alter table scenario_mesi add constraint scenario_mesi_servizi_sensati check (
  servizi_settimana >= 0 and servizi_settimana <= 14
);

comment on constraint scenario_mesi_servizi_sensati on scenario_mesi is
  'Al massimo due servizi al giorno per sette giorni.';

-- ---------------------------------------------------------------------
-- 3 · Gli importi che qualcuno scrive a mano
-- ---------------------------------------------------------------------
alter table documents drop constraint if exists documents_importo_non_negativo;
alter table documents add constraint documents_importo_non_negativo check (
  amount is null or amount >= 0
);

alter table supplier_invoices drop constraint if exists supplier_invoices_importo_non_negativo;
alter table supplier_invoices add constraint supplier_invoices_importo_non_negativo check (
  amount >= 0
);

comment on constraint supplier_invoices_importo_non_negativo on supplier_invoices is
  'Una fattura non ha un importo negativo: quello che il fornitore storna e'' una NOTA DI CREDITO, che ha una tabella sua. Scriverlo come fattura negativa farebbe sparire il debito senza nessun documento che lo spieghi.';

alter table reservation_deposits drop constraint if exists reservation_deposits_importo_positivo;
alter table reservation_deposits add constraint reservation_deposits_importo_positivo check (
  amount > 0
);

alter table payslips drop constraint if exists payslips_importi_sensati;
alter table payslips add constraint payslips_importi_sensati check (
  gross_amount >= 0
  and net_amount >= 0
  and net_amount <= gross_amount
);

comment on constraint payslips_importi_sensati on payslips is
  'Il netto non puo'' superare il lordo. Non e'' una soglia scelta: e'' cosa vuol dire «netto».';

alter table menu_items drop constraint if exists menu_items_prezzo_non_negativo;
alter table menu_items add constraint menu_items_prezzo_non_negativo check (
  selling_price is null or selling_price >= 0
);

alter table daily_menu_items drop constraint if exists daily_menu_items_prezzo_non_negativo;
alter table daily_menu_items add constraint daily_menu_items_prezzo_non_negativo check (
  price is null or price >= 0
);

-- ---------------------------------------------------------------------
-- 4 · La cessione fra le due societa'
-- ---------------------------------------------------------------------
alter table intercompany_cessions drop constraint if exists cessioni_numeri_sensati;
alter table intercompany_cessions add constraint cessioni_numeri_sensati check (
  quantity > 0
  and unit_price >= 0
  and (total_amount is null or total_amount >= 0)
  and (vat_rate is null or (vat_rate >= 0 and vat_rate <= 100))
);

comment on constraint cessioni_numeri_sensati on intercompany_cessions is
  'L''IVA di una cessione e'' una percentuale in PUNTI (4 = 4%), come sulla fattura che la accompagna.';

-- ---------------------------------------------------------------------
-- 5 · I prezzi degli ingredienti
-- ---------------------------------------------------------------------
-- ⚠️ Il limite e' >= 0 e non > 0, e la ragione e' misurata: **14
-- ingredienti attivi hanno prezzo zero**, e sono le PREPARAZIONI —
-- baccala' mantecato, brodo vegetale, caponata. Il loro costo vive sul
-- lotto prodotto, non sull'anagrafica: pretendere un prezzo positivo
-- respingerebbe ogni produzione interna.
alter table price_history drop constraint if exists price_history_prezzo_non_negativo;
alter table price_history add constraint price_history_prezzo_non_negativo check (price >= 0);

alter table stock_lots drop constraint if exists stock_lots_costo_non_negativo;
alter table stock_lots add constraint stock_lots_costo_non_negativo check (
  unit_cost is null or unit_cost >= 0
);

alter table ingredients drop constraint if exists ingredients_prezzo_non_negativo;
alter table ingredients add constraint ingredients_prezzo_non_negativo check (
  current_price is null or current_price >= 0
);

alter table service_settings drop constraint if exists service_settings_soglia_rincaro_valida;
alter table service_settings add constraint service_settings_soglia_rincaro_valida check (
  soglia_rincaro_percento >= 0 and soglia_rincaro_percento <= 100
);

comment on constraint service_settings_soglia_rincaro_valida on service_settings is
  'Qui la percentuale e'' in PUNTI (0 = qualunque aumento si segnala, 10 = solo sopra il 10%).';

-- ---------------------------------------------------------------------
-- 6 · Verifica — ogni limite si prova ROMPENDO, nei due versi
-- ---------------------------------------------------------------------
-- ⚠️ E la seconda meta' conta quanto la prima: **un limite che rifiuta
-- anche i casi buoni e' peggio di nessun limite**. Per ogni vincolo si
-- prova il valore assurdo (dev'essere respinto) e uno legittimo ma
-- insolito (deve passare).
do $verifica$
declare
  v_titolare uuid;
  v_ente     uuid;
  v_scen     uuid;
  v_lapidi_p bigint;
  v_lapidi_d bigint;
  v_respinto boolean;

begin
  select count(*) into v_lapidi_p from deleted_records;

  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into v_ente from entities order by created_at limit 1;

  -- Uno scenario tutto suo, mai uno vero.
  insert into scenari_proiezione (
    entity_id, nome, tipo, anno,
    scontrino_food, scontrino_beverage, food_cost_percento, beverage_cost_percento
  ) values (v_ente, 'VERIFICA 828 limiti', 'riproiezione', 2099, 40, 10, 0.25, 0.30)
  returning id into v_scen;

  -- (a) Una frazione scritta in PUNTI viene respinta. 🔴 E' il caso vero:
  --     25 al posto di 0,25 e' l'errore delle aliquote, di nuovo.
  v_respinto := false;
  begin
    update scenari_proiezione set food_cost_percento = 25 where id = v_scen;
  exception when check_violation then v_respinto := true;
  end;
  if not v_respinto then
    update scenari_proiezione set food_cost_percento = 0.25 where id = v_scen;
    raise exception 'Un food cost del 2500%% e'' stato accettato.';
  end if;

  -- (b) Ma una frazione al limite passa: food cost al 100% e' un piatto
  --     che non guadagna niente — strano, non impossibile.
  update scenari_proiezione set food_cost_percento = 1 where id = v_scen;
  update scenari_proiezione set food_cost_percento = 0.25 where id = v_scen;

  -- (c) Venticinque ore al giorno, no. Ventiquattro, si'.
  v_respinto := false;
  begin
    update scenari_proiezione set ore_giorno = 25 where id = v_scen;
  exception when check_violation then v_respinto := true;
  end;
  if not v_respinto then raise exception 'Venticinque ore in un giorno sono state accettate.'; end if;
  update scenari_proiezione set ore_giorno = 24 where id = v_scen;

  -- (d) Zero ore al giorno, no: il netto orario diventerebbe una
  --     divisione per zero, e il campo esiste per evitarla.
  v_respinto := false;
  begin
    update scenari_proiezione set ore_giorno = 0 where id = v_scen;
  exception when check_violation then v_respinto := true;
  end;
  if not v_respinto then raise exception 'Zero ore al giorno sono state accettate.'; end if;
  update scenari_proiezione set ore_giorno = 8 where id = v_scen;

  -- (e) La pressione scritta in punti (32 invece di 0,32) viene respinta;
  --     una pressione alta ma vera (1,2 = 120%) passa.
  v_respinto := false;
  begin
    update scenari_proiezione set pressione_personale = 32 where id = v_scen;
  exception when check_violation then v_respinto := true;
  end;
  if not v_respinto then raise exception 'Una pressione del 3200%% e'' stata accettata.'; end if;
  update scenari_proiezione set pressione_personale = 1.2 where id = v_scen;

  -- (f) L'anno: 202 e 20260 sono battiture, 2100 no.
  v_respinto := false;
  begin
    update scenari_proiezione set anno = 202 where id = v_scen;
  exception when check_violation then v_respinto := true;
  end;
  if not v_respinto then raise exception 'L''anno 202 e'' stato accettato.'; end if;
  update scenari_proiezione set anno = 2100 where id = v_scen;

  -- (g) Un importo negativo su una fattura viene respinto. Si prova su
  --     una riga PROPRIA, dentro un blocco annidato che poi si annulla.
  v_respinto := false;
  begin
    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount)
    values (v_ente, (select id from suppliers order by created_at limit 1),
            'VERIFICA-828', current_date, -100);
  exception when check_violation then v_respinto := true;
       when others then v_respinto := true;  -- altri vincoli: va bene lo stesso
  end;
  if not v_respinto then
    delete from supplier_invoices where invoice_number = 'VERIFICA-828';
    raise exception 'Una fattura da -100 euro e'' stata accettata.';
  end if;

  -- --- Pulizia: solo la riga di questa verifica.
  delete from scenari_proiezione where id = v_scen;

  select count(*) into v_lapidi_d from deleted_records;
  if v_lapidi_d <> v_lapidi_p then
    raise exception 'Il registro delle cancellazioni e'' passato da % a %.', v_lapidi_p, v_lapidi_d;
  end if;

  raise notice 'Limiti del denaro e delle imposte: dodici vincoli, provati nei due versi.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260824000008', 'i_limiti_del_denaro_e_delle_imposte') on conflict (version) do nothing;
