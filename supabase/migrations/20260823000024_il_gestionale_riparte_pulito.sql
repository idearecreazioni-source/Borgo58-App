-- =====================================================================
-- IL GESTIONALE RIPARTE PULITO — tutti i residui di collaudo, insieme
-- 23/08/2026 — decisione di Alessio, DA ESEGUIRE SOLO AL SUO VIA LIBERA
-- =====================================================================
-- 🔴 NON E' UNA RIGA DA TOGLIERE: SONO ALMENO SETTE COSE. Il validatore
-- aveva misurato tre allarmi di prova; cercandoli tutti — tabella per
-- tabella, non partendo da quelli gia' noti — sono venuti fuori anche i
-- conti del collaudo di sala, le prenotazioni «prova 1/2/3», la giornata
-- segnata al completo per un evento finto, e la chiamata di turno che ne
-- e' seguita. *Un elenco che parte da quello che si sa gia' trova quello
-- che si sa gia'.*
--
-- ---------------------------------------------------------------------
-- COSA TOGLIE, misurato in produzione il 23/08 alle 23:50
-- ---------------------------------------------------------------------
--   28  conti di sala (21 e 22/08), con dentro:
--       53 righe · 32 agganci ai tavoli · 2 pagamenti
--       ⚠️ uno di questi e' ancora APERTO (Divano 3, 9 righe)
--    3  prenotazioni «prova 1», «prova 2», «prova 3» + 3 agganci ai tavoli
--    1  giornata segnata al completo (26/08), dall'evento finto annullato
--    1  chiamata di turno
--    3  allarmi di collaudo (vedi sotto: il quarto RESTA)
--   43  tracce nel registro delle cancellazioni, **piu' quelle che questa
--       pulizia stessa produce** — ed e' il motivo per cui il registro si
--       svuota per ULTIMO.
--
-- ---------------------------------------------------------------------
-- COSA NON TOCCA, e perche'
-- ---------------------------------------------------------------------
-- ⚠️ **Le 14 ricette, il menu e le 14 voci di carta**: sono il menu vero
-- di Alessio, non roba di prova. Con loro lo storico dei loro stati.
-- ⚠️ **Gli 8 impegni in Agenda**: li ha scritti lui, e dentro ci sono
-- scadenze societarie con codici F24.
-- ⚠️ **La sala** (13 sagome, 2 formati), **gli orari**, **le 17 causali**,
-- **le 6 regole di deducibilita'**, **le societa'**, **i parametri
-- fiscali**, **i 4 accessi**: configurazione.
-- ⚠️ **Le 12 righe delle pulizie privacy** e i 5 battiti dei lavori: sono
-- la storia di cio' che ha funzionato ogni notte.
-- ⚠️ **L'allarme del 12/08** («il lavoro lettura-posta non arriva in fondo
-- da 170 minuti»): quello non e' un residuo di prova, e' il racconto di un
-- guasto vero che c'e' stato davvero. Il §8 lo dice: *gli avvisi veri non
-- sono dati di prova, sono la storia di cio' che ha funzionato.* Se
-- Alessio lo vuole via, si toglie con una riga in una migrazione nuova.
-- ⚠️ **Le 14 disposizioni della sala** (18, 19 e 23/08) e **le 6 domande
-- all'archivio**: sono gesti suoi, non miei. Lasciate, e segnalate — se le
-- vuole via lo dice lui.
--
-- ---------------------------------------------------------------------
-- 🔴 LA CONDIZIONE CHE DECIDE SE PULIRE, ed e' una PROPRIETA'
-- ---------------------------------------------------------------------
-- *«Il locale apre a marzo 2027 e in produzione non esiste una sola riga
-- vera»* — Alessio. Quella frase si puo' **misurare**: se il gestionale
-- non ha nessun movimento di denaro e nessuna fattura, non c'e' niente di
-- vero da perdere.
--
-- ⚠️ E questa condizione fa due lavori insieme, ed e' il motivo per cui e'
-- scritta cosi' e non come una data:
--   · **protegge il futuro**: rieseguita il giorno dopo il primo incasso,
--     questa migrazione **non tocca niente** e lo dice;
--   · **protegge il progetto di prova**, dove i movimenti ci sono (57) e
--     i conti sono 348: la' dentro non deve cancellare lo scenario di
--     collaudo, che serve tutti i giorni.
--
-- ⚠️ E il meccanismo viene provato lo stesso, anche dove la condizione e'
-- falsa: la verifica qui sotto **costruisce roba propria** e controlla che
-- i predicati la prendano. Senza, sul progetto di prova questa migrazione
-- passerebbe verde senza aver provato niente — la trappola del caso vuoto.
--
-- ---------------------------------------------------------------------
-- ⚠️ ASPETTA IL VIA LIBERA DI ALESSIO
-- ---------------------------------------------------------------------
-- Per tenerla indietro lasciando passare le altre:
--   npm run migra -- --salta 20260823000024 --conferma
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. LA VERIFICA DEL MECCANISMO — gira SEMPRE, anche dove non si pulisce
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_ente    uuid;
  v_res     uuid;
  v_conto   uuid;
  v_tav     uuid;
  v_lapidi  integer;
  v_lapidi2 integer;
  v_n       integer;
begin
  select count(*) into v_lapidi from deleted_records;
  select id into v_ente from entities order by created_at limit 1;
  select id into v_tav from dining_tables limit 1;
  if v_ente is null or v_tav is null then
    raise exception 'Manca una societa'' o un tavolo: non posso verificare.';
  end if;

  -- Una prenotazione e un conto sopra, come quelli del collaudo.
  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name)
  values ('prenotazione', 'confermata', 'interno',
          (now() at time zone 'Europe/Rome')::date, '20:00', 2, 'ZZ verifica pulizia')
  returning id into v_res;

  insert into orders (table_label, reservation_id, note)
  values ('ZZ', v_res, 'ZZ verifica pulizia') returning id into v_conto;
  insert into order_tables (order_id, dining_table_id, etichetta_al_momento)
  values (v_conto, v_tav, 'ZZ');

  -- 🔴 L'ORDINE E' LA COSA CHE SI STA PROVANDO: `orders.reservation_id` e'
  -- `restrict`, quindi la prenotazione NON si puo' togliere prima del
  -- conto. Se qualcuno un giorno invertisse i due passaggi, la pulizia
  -- fallirebbe a meta' — e meta' pulizia e' peggio di nessuna.
  begin
    delete from reservations where id = v_res;
    raise exception 'La prenotazione si e'' lasciata togliere PRIMA del conto: l''ordine non e'' quello che credo.';
  exception when foreign_key_violation then
    null; -- e' esattamente cio' che deve succedere
  end;

  -- Nell'ordine giusto invece funziona, e il conto si porta dietro i suoi.
  delete from orders where id = v_conto;
  select count(*) into v_n from order_tables where order_id = v_conto;
  if v_n <> 0 then
    raise exception 'Togliendo il conto non sono spariti i suoi agganci ai tavoli.';
  end if;
  delete from reservations where id = v_res;

  -- ⚠️ E la pulizia si ripulisce: le lapidi che ha prodotto lei se ne
  -- vanno con lei (regola del 16/08).
  delete from deleted_records
   where record->>'note' = 'ZZ verifica pulizia'
      or record->>'customer_name' = 'ZZ verifica pulizia'
      or record->>'etichetta_al_momento' = 'ZZ';
  select count(*) into v_lapidi2 from deleted_records;
  if v_lapidi2 <> v_lapidi then
    raise exception 'La verifica ha lasciato % tracce dietro di se''.', v_lapidi2 - v_lapidi;
  end if;

  raise notice 'Verifica passata: l''ordine e'' quello giusto e la pulizia non lascia niente.';
end $verifica$;


-- ---------------------------------------------------------------------
-- 2. LA PULIZIA VERA — solo dove non c'e' ancora niente di vero
-- ---------------------------------------------------------------------
do $pulizia$
declare
  v_soldi   integer;
  v_conti   integer;
  v_pren    integer;
  v_sold    integer;
  v_all     integer;
  v_tracce  integer;
begin
  select (select count(*) from cash_movements) + (select count(*) from supplier_invoices)
    into v_soldi;

  if v_soldi > 0 then
    raise notice 'PULIZIA NON ESEGUITA: qui ci sono gia'' % fra movimenti e fatture. Non e'' un database da svuotare.', v_soldi;
    return;
  end if;

  -- I conti per primi: si portano dietro righe, tavoli, pagamenti,
  -- anomalie, chiamate di turno e segnalazioni fiscali (tutte in cascata).
  select count(*) into v_conti from orders;
  delete from orders;

  -- Poi le prenotazioni, che i conti tenevano ferme.
  select count(*) into v_pren from reservations;
  delete from reservations;

  -- Le giornate segnate al completo: quella che c'e' viene dall'evento
  -- finto che e' stato annullato.
  select count(*) into v_sold from giornate_sold_out;
  delete from giornate_sold_out;

  -- Gli allarmi di collaudo. ⚠️ Nominati uno per uno, non «tutti»: quello
  -- del lavoro fermo racconta un guasto vero e resta.
  select count(*) into v_all from allarmi
   where tipo = 'corridoio_salva_preventivo'
      or tipo like 'evento_annullato\_%'
      or messaggio like '%guasto costruito apposta%'
      or messaggio like '%prova collaudo%';
  delete from allarmi
   where tipo = 'corridoio_salva_preventivo'
      or tipo like 'evento_annullato\_%'
      or messaggio like '%guasto costruito apposta%'
      or messaggio like '%prova collaudo%';

  -- 🔴 IL REGISTRO PER ULTIMO, e non e' un dettaglio d'ordine: togliere i
  -- conti PRODUCE tracce nuove (`order_items` e `order_payments` sono
  -- tabelle tracciate). Svuotandolo prima, resterebbero dentro proprio le
  -- lapidi di questa pulizia.
  select count(*) into v_tracce from deleted_records;
  delete from deleted_records;

  raise notice 'Tolti: % conti, % prenotazioni, % giornate al completo, % allarmi di collaudo, % tracce nel registro.',
    v_conti, v_pren, v_sold, v_all, v_tracce;
end $pulizia$;


-- ---------------------------------------------------------------------
-- 3. E il gestionale regge ancora
-- ---------------------------------------------------------------------
do $controllo$
declare
  v_soldi integer;
  v_n     integer;
begin
  select (select count(*) from cash_movements) + (select count(*) from supplier_invoices)
    into v_soldi;
  if v_soldi > 0 then
    raise notice 'Controllo saltato: qui la pulizia non ha girato.';
    return;
  end if;

  -- ⚠️ Cio' che NON doveva sparire e' ancora al suo posto. Un controllo
  -- che guarda solo cio' che e' stato tolto non si accorgerebbe di una
  -- cancellazione andata troppo in la'.
  select count(*) into v_n from recipes;
  if v_n = 0 then raise exception 'Sono sparite le ricette: la pulizia e'' andata troppo in la''.'; end if;
  select count(*) into v_n from dining_tables;
  if v_n = 0 then raise exception 'E'' sparita la sala.'; end if;
  select count(*) into v_n from tasks;
  if v_n = 0 then raise exception 'Sono spariti gli impegni in Agenda.'; end if;
  select count(*) into v_n from cash_causali;
  if v_n = 0 then raise exception 'Sono sparite le causali.'; end if;
  select count(*) into v_n from user_roles;
  if v_n = 0 then raise exception 'Sono spariti gli accessi.'; end if;
  select count(*) into v_n from allarmi;
  if v_n = 0 then
    raise exception 'Sono spariti TUTTI gli allarmi: doveva restare quello del lavoro fermo.';
  end if;

  select count(*) into v_n from orders;
  if v_n <> 0 then raise exception 'Sono rimasti % conti.', v_n; end if;
  select count(*) into v_n from deleted_records;
  if v_n <> 0 then raise exception 'Sono rimaste % tracce nel registro.', v_n; end if;

  raise notice 'Il gestionale regge: ricette, sala, agenda, causali e accessi sono al loro posto.';
end $controllo$;

insert into applied_migrations (version, name)
values ('20260823000024', 'il_gestionale_riparte_pulito') on conflict (version) do nothing;
