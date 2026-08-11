-- ---------------------------------------------------------------------
-- Pulizia dei dati di prova — prima di collegare la posta vera
-- ---------------------------------------------------------------------
-- Chiesto da Alessio il 12/08/2026, e chiesto al momento giusto: da qui
-- in avanti nell'Archivio Documenti entrerà roba concreta, e mescolare
-- documenti veri con "Contratto di prova" e ricette inventate è il modo
-- sicuro per non fidarsi più di quello che il gestionale dice.
--
-- ⚠️ NON È UNA MIGRAZIONE. Non si auto-registra in `applied_migrations` e
-- non sta in `supabase/migrations/`: le migrazioni descrivono la forma
-- del database e vanno rieseguite su qualunque copia, questa cancella
-- *contenuti* di un momento preciso. Su un database ricostruito da zero
-- non avrebbe senso.
--
-- ⚠️ SI ESEGUE UNA VOLTA SOLA, DOPO UNA COPIA DI SICUREZZA.
-- La copia è stata fatta prima di scrivere questo file: 60 tabelle,
-- 209 righe, 2 documenti (`npm run backup`).
--
-- ---------------------------------------------------------------------
-- COSA RESTA (deciso da Alessio, 12/08/2026)
-- ---------------------------------------------------------------------
--   · i 14 tavoli e i 2 tablet
--   · orari, chiusure e regole di prenotazione (compreso il coperto)
--   · gli adempimenti societari in Agenda e il promemoria del dominio
--   · le causali di prima nota, le due entità fiscali, i ruoli, i
--     parametri fiscali
--   · il documento "BP" nell'Archivio
--
-- COSA SE NE VA: tutto il resto dei contenuti — conti e comande di
-- prova, prenotazioni e clienti di prova, ricette e ingredienti
-- inventati, il menu "estivo" costruito su quelle ricette, le bevande di
-- prova, magazzino, il fornitore "Mililli" col suo listino, la fattura e
-- la cessione di prova, il frigo HACCP con la sua registrazione.
--
-- ---------------------------------------------------------------------
-- IL DOCUMENTO DI PROVA NON SI CANCELLA DA QUI
-- ---------------------------------------------------------------------
-- "Contratto di prova" va tolto **dall'app**, non con questo SQL: il file
-- vero vive nello storage, non nel database, e una `delete` qui
-- lascerebbe il file orfano — invisibile nell'elenco e ancora presente
-- nello spazio (e nelle copie di sicurezza). L'app sa fare le due cose
-- insieme, e chiude anche il promemoria che ne era nato.
--
-- ---------------------------------------------------------------------
-- PERCHÉ I TRIGGER RESTANO ACCESI
-- ---------------------------------------------------------------------
-- Verrebbe voglia di spegnerli (`session_replication_role = replica`) per
-- non riempire il registro delle cancellazioni. Sarebbe un errore: in
-- quella modalità Postgres spegne anche i trigger che fanno rispettare le
-- chiavi esterne, quindi le cancellazioni a catena non avverrebbero e
-- resterebbero righe orfane, senza che nessuno protesti. Si cancella
-- nell'ordine giusto, coi trigger accesi, e alla fine si svuota il
-- registro — che a quel punto contiene solo copie di dati di prova,
-- compresi nome, telefono ed email veri di Alessio finiti lì dalle
-- prenotazioni di collaudo. Toglierle è il senso stesso della pulizia
-- (scelta di Alessio: cancellare senza lasciarne traccia).

begin;

-- 1. Conti, comande, sconti e omaggi di prova
delete from order_items;
delete from discounts_gifts;
delete from orders;

-- 2. Prenotazioni, clienti e ciò che vi si appoggia
delete from email_inviate;
delete from reservation_deposits;
delete from reservations;
delete from customers;

-- 3. Magazzino
delete from stock_consumptions;
delete from stock_lots;
delete from shopping_list_items;

-- 4. Fornitori, fatture, cessioni
delete from supplier_invoices;
delete from intercompany_cessions;
delete from price_history;
delete from suppliers;

-- 5. Menu e bevande (prima dei piatti: vi puntano)
delete from daily_menu_items;
delete from daily_menus;
delete from menu_items;
delete from menus;
delete from bar_items;

-- 6. Ricettario
delete from recipe_status_history;
delete from recipe_videos;
delete from recipe_ingredients;
delete from recipe_steps;
delete from recipes;
delete from ingredients;

-- 7. HACCP
delete from haccp_temperature_logs;
delete from haccp_cleaning_logs;
delete from haccp_non_conformities;
delete from haccp_pest_control_logs;
delete from haccp_goods_receiving;
delete from haccp_cleaning_tasks;
delete from haccp_equipment;

-- 8. Agricolo
delete from crops;
delete from foraged_items;

-- 9. Prima nota, personale, mance (già vuoti oggi: qui per completezza,
--    così questo file resta valido se domani si riprova qualcosa)
delete from cash_movements;
delete from deductible_expenses;
delete from tip_distribution_lines;
delete from tip_distributions;
delete from tips_collected;
delete from employee_leaves;
delete from payslips;
delete from employee_documents;
delete from employees;
delete from fiscal_tools;

-- 10. I registri delle prove: contengono copie dei dati appena cancellati
delete from deleted_records;
delete from privacy_pulizie;

-- ---------------------------------------------------------------------
-- Verifica: ciò che deve restare è restato, ciò che doveva sparire è
-- sparito. Se una sola riga non torna, niente viene salvato.
-- ---------------------------------------------------------------------
do $verifica$
declare
  n integer;
begin
  select count(*) into n from dining_tables;
  if n <> 14 then raise exception 'I tavoli sono %, dovevano restare 14.', n; end if;

  select count(*) into n from pos_devices;
  if n <> 2 then raise exception 'I tablet sono %, dovevano restare 2.', n; end if;

  select count(*) into n from service_hours;
  if n <> 14 then raise exception 'Gli orari sono %, dovevano restare 14.', n; end if;

  select count(*) into n from service_settings;
  if n <> 1 then raise exception 'Le regole di prenotazione sono sparite.'; end if;

  select count(*) into n from user_roles;
  if n <> 4 then raise exception 'Gli accessi sono %, dovevano restare 4.', n; end if;

  select count(*) into n from entities;
  if n <> 2 then raise exception 'Le entità fiscali sono %, dovevano restare 2.', n; end if;

  select count(*) into n from cash_causali;
  if n < 12 then raise exception 'Le causali di prima nota sono %, ne servivano almeno 12.', n; end if;

  -- Gli adempimenti societari hanno importi e codici F24 veri: sono la
  -- cosa più costosa da rimettere a mano.
  select count(*) into n from tasks;
  if n < 8 then raise exception 'In Agenda restano % promemoria: gli adempimenti societari devono esserci.', n; end if;

  -- Il documento "BP" resta (l'altro lo toglie Alessio dall'app).
  select count(*) into n from documents;
  if n < 1 then raise exception 'L''Archivio Documenti è vuoto: il BP doveva restare.'; end if;

  -- E i contenuti di prova non ci sono più.
  select count(*) into n from (
    select 1 from orders union all select 1 from reservations
    union all select 1 from customers union all select 1 from recipes
    union all select 1 from ingredients union all select 1 from menus
    union all select 1 from suppliers union all select 1 from stock_lots
    union all select 1 from haccp_equipment union all select 1 from deleted_records
  ) t;
  if n <> 0 then raise exception 'Sono rimaste % righe di prova.', n; end if;

  raise notice 'Pulizia completata: la sala, gli orari, gli adempimenti e il BP sono al loro posto.';
end
$verifica$;

commit;

-- Cosa c'è dentro adesso, tabella per tabella (solo le non vuote).
select table_name,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text::int as righe
  from information_schema.tables
 where table_schema = 'public' and table_type = 'BASE TABLE'
 order by righe desc, table_name;
