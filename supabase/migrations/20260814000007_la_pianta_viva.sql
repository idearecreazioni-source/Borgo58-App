-- ---------------------------------------------------------------------
-- La pianta viva — la sala smette di essere un numero e diventa un disegno
-- ---------------------------------------------------------------------
-- Mandato «Blocco Sala: la pianta viva» (docs/mandati/20260814_sala_la_pianta_viva.md),
-- decisione di prodotto di Alessio del 14/08/2026. Consegna UNICA e
-- indivisibile: pianta, prenotazioni e comande insieme (§11 del mandato).
--
-- COSA CAMBIA, IN UNA FRASE: il sistema non decide più se un gruppo entra.
-- Lo decide Alessio guardando la sala, e il sistema registra cosa ha deciso.
--
-- PERCHÉ IL CALCOLO SI RIMUOVE INVECE DI CORREGGERLO. Il modello attuale
-- conta un secchio di posti (somma dei coperti dei tavoli) e sottrae le
-- persone prenotate. Con i tavoli veri quel conto è sbagliato PER
-- COSTRUZIONE: due persone a un tavolo da sei lasciano quattro posti che
-- non esistono. Un numero sbagliato in modo sistematico e sempre nella
-- stessa direzione è peggio di nessun numero, perché ha l'aria di essere
-- un dato.
--
-- ⚠️ E si RIMUOVE, non si spegne (§8 del mandato). Una colonna spenta e una
-- funzione che non fa niente sono peggio di un difetto: fra tre mesi
-- qualcuno le riaccende credendo di riparare qualcosa.
--
-- QUATTRO INVARIANTI CHE VIVONO NEL DATABASE, NON NELLA SCHERMATA:
--   1. nessun numero di coperti è associato a un tavolo (vincolo, non
--      convenzione);
--   2. un tavolo non può stare su due conti aperti nello stesso momento;
--   3. divani e Chef Table non si spostano;
--   4. una giornata sold out rifiuta le richieste pubbliche dentro la
--      funzione che le riceve, non nel form.
--
-- Idempotente (§7 punto 3). Si auto-registra (§7 punto 4).

-- =====================================================================
-- 1. LE SAGOME — dining_tables diventa una pianta
-- =====================================================================
-- Era «un elenco minimo di etichette per la griglia di selezione»
-- (migrazione 20260804000008, che escludeva esplicitamente pianta,
-- capienza e accostamenti). Da oggi è la pianta: la decisione di prodotto
-- del 14/08 riapre di proposito ciò che quella migrazione chiudeva.

alter table dining_tables
  add column if not exists tipo          text    not null default 'tavolo',
  add column if not exists forma         text    not null default 'rettangolo',
  add column if not exists zona          text    not null default 'sala_bassa',
  add column if not exists larghezza_cm  integer not null default 90,
  add column if not exists profondita_cm integer not null default 90,
  add column if not exists spostabile    boolean not null default true,
  add column if not exists posti_fissi   integer,
  add column if not exists x             integer not null default 0,
  add column if not exists y             integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dining_tables_sagoma_check') then
    alter table dining_tables add constraint dining_tables_sagoma_check check (
      tipo  in ('tavolo', 'divano', 'chef_table')
      and forma in ('rettangolo', 'tondo')
      and zona  in ('sala_alta', 'sala_bassa', 'divani', 'bancone')
      and larghezza_cm  between 30 and 800
      and profondita_cm between 30 and 800
      and x between 0 and 5000
      and y between 0 and 5000
      -- ⚠️ L'INVARIANTE 1, scritto come vincolo e non come promessa:
      -- un TAVOLO non ha coperti. Da nessuna parte. La capienza dipende
      -- da come i tavoli sono messi quel giorno, e quel dato vive nella
      -- testa di chi apparecchia. Divani e Chef Table hanno posti fissi
      -- perché sono arredi fissi — ed è un'informazione scritta sulla
      -- sagoma, che non entra in nessun calcolo.
      and (case when tipo = 'tavolo' then posti_fissi is null
                else posti_fissi is not null and posti_fissi between 1 and 30 end)
      -- L'INVARIANTE 3: divani e Chef Table non si trascinano, e non
      -- perché la schermata non li lascia prendere.
      and (case when tipo = 'tavolo' then true else spostabile = false end)
    );
  end if;
end $$;

comment on column dining_tables.tipo is
  'tavolo | divano | chef_table. Solo i tavoli si spostano; solo i non-tavoli hanno posti fissi.';
comment on column dining_tables.posti_fissi is
  'Posti di un arredo FISSO (divano, Chef Table). Non entra in nessun calcolo di capienza: è un''etichetta sulla sagoma. Sui tavoli è vietato per vincolo.';
comment on column dining_tables.x is
  'Posizione nella PIANTA BASE, in centimetri. Lo scostamento di una singola giornata sta in disposizioni_giornaliere.';

-- =====================================================================
-- 2. LA SALA VERA — al posto dei tavoli di collaudo
-- =====================================================================
-- I 14 tavoli in produzione (T1–T10, Chef Table, D1–D3, con i coperti)
-- NON sono questa sala: erano un elenco di prova. Vanno sostituiti dalle
-- 13 sagome vere — 9 tavoli in due soli formati, 3 postazioni divano,
-- lo Chef Table (misure confermate da Alessio il 14/08).
--
-- ⚠️ Contratto §8: mai una cancellazione di dati veri fuori da una
-- migrazione che si pulisce da sé. Qui i dati non sono veri, ma il *come*
-- resta identico — perimetro stretto, dichiarato, e un rifiuto esplicito
-- dove la cancellazione toccherebbe qualcosa che vale soldi.

do $sagome$
declare
  vecchie constant text[] := array[
    'T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','Chef Table','D1','D2','D3'
  ];
  n_conti_chiusi integer;
  n_conti_aperti integer;
  n_sagome       integer;
begin
  -- ⚠️ IDEMPOTENZA, e qui non è una formalità. Le etichette nuove (T1…T9,
  -- Chef Table) sono quasi le stesse di quelle vecchie: un secondo Run
  -- senza questa guardia cancellerebbe le sagome APPENA create — con
  -- dentro le posizioni che Alessio ha spostato e i collegamenti alle
  -- prenotazioni. La sostituzione avviene una volta sola, e il segno che
  -- è già avvenuta è una sagoma che prima non poteva esistere.
  if exists (select 1 from dining_tables where label = 'Divano 1') then
    raise notice 'La sala vera c''è già: nessuna sostituzione da fare.';
    return;
  end if;

  -- Un conto CHIUSO è un incasso in prima nota: una migrazione non lo
  -- cancella in silenzio nemmeno se l'etichetta sembra di collaudo. Se
  -- ce ne fossero, ci si ferma dicendo esattamente cosa guardare.
  select count(*) into n_conti_chiusi
  from orders where table_label = any(vecchie) and status <> 'aperto';

  if n_conti_chiusi > 0 then
    raise exception E'Ci sono % conti gia'' chiusi sui tavoli di collaudo.\nUn conto chiuso e'' un incasso: non lo cancella una migrazione. Vanno guardati a mano prima di rifare la sala.', n_conti_chiusi;
  end if;

  -- I conti ancora APERTI sono carrelli, non incassi: si tolgono qui.
  select count(*) into n_conti_aperti
  from orders where table_label = any(vecchie) and status = 'aperto';

  delete from order_items
   where order_id in (select id from orders where table_label = any(vecchie) and status = 'aperto');
  delete from orders
   where table_label = any(vecchie) and status = 'aperto';

  delete from dining_tables where label = any(vecchie);

  -- Le sagome vere. Coordinate in centimetri su una sala di 2070 × 1030,
  -- ricavate in proporzione dalla planimetria Sweet Home 3D di Alessio:
  -- non servono le misure reali, serve una sala riconoscibile (§4 del
  -- mandato). Questa è la disposizione di PARTENZA, non una regola: è
  -- esattamente ciò che lui deve poter cambiare ogni giorno.
  insert into dining_tables (label, position, active, tipo, forma, zona,
                             larghezza_cm, profondita_cm, spostabile, posti_fissi, x, y)
  values
    -- Sala alta: 2 rettangolari (180 × 90) + 2 quadrati (90 × 90)
    ('T1', 0, true, 'tavolo', 'rettangolo', 'sala_alta', 180, 90, true, null, 1450,  90),
    ('T2', 1, true, 'tavolo', 'rettangolo', 'sala_alta', 180, 90, true, null, 1750,  90),
    ('T3', 2, true, 'tavolo', 'rettangolo', 'sala_alta',  90, 90, true, null, 1490, 300),
    ('T4', 3, true, 'tavolo', 'rettangolo', 'sala_alta',  90, 90, true, null, 1790, 300),
    -- Sala bassa: 5 quadrati. Nella disposizione normale tre sono uniti
    -- (270 × 90) e due sono uniti (180 × 90): si vede dalle coordinate,
    -- non da un elenco di accostamenti dichiarati — quello servirebbe
    -- solo a un sistema che dovesse decidere da solo, e questo non deve.
    ('T5', 4, true, 'tavolo', 'rettangolo', 'sala_bassa', 90, 90, true, null, 1150, 600),
    ('T6', 5, true, 'tavolo', 'rettangolo', 'sala_bassa', 90, 90, true, null, 1240, 600),
    ('T7', 6, true, 'tavolo', 'rettangolo', 'sala_bassa', 90, 90, true, null, 1330, 600),
    ('T8', 7, true, 'tavolo', 'rettangolo', 'sala_bassa', 90, 90, true, null, 1550, 600),
    ('T9', 8, true, 'tavolo', 'rettangolo', 'sala_bassa', 90, 90, true, null, 1640, 600),
    -- Arredi fissi: si disegnano, non si trascinano.
    ('Divano 1',   9, true, 'divano',     'rettangolo', 'divani',  240, 200, false, 6,  100, 800),
    ('Divano 2',  10, true, 'divano',     'rettangolo', 'divani',  240, 200, false, 6,  420, 800),
    ('Divano 3',  11, true, 'divano',     'rettangolo', 'divani',  240, 200, false, 6,  740, 800),
    ('Chef Table',12, true, 'chef_table', 'rettangolo', 'bancone', 200,  70, false, 4, 1850, 650)
  on conflict (label) do nothing;

  select count(*) into n_sagome from dining_tables where active;
  raise notice 'Sala rifatta: % sagome attive. Conti di collaudo aperti rimossi: %.', n_sagome, n_conti_aperti;
end $sagome$;

-- =====================================================================
-- 3. LA DISPOSIZIONE DI UNA GIORNATA — solo lo scostamento
-- =====================================================================
-- La pianta base è quella normale. Quando Alessio muove una sagoma per
-- una data specifica si salva SOLO lo scostamento di quel giorno, non una
-- copia dell'intera pianta: così il giorno dopo si riparte dalla base
-- senza che nessuno debba rimettere niente a posto.
create table if not exists disposizioni_giornaliere (
  id              uuid primary key default gen_random_uuid(),
  data            date not null,
  dining_table_id uuid not null references dining_tables(id) on delete cascade,
  x               integer not null check (x between 0 and 5000),
  y               integer not null check (y between 0 and 5000),
  aggiornato_il   timestamptz not null default now(),
  unique (data, dining_table_id)
);

create index if not exists idx_disposizioni_data on disposizioni_giornaliere (data);

comment on table disposizioni_giornaliere is
  'Scostamento della pianta per una singola giornata. Nessuna riga = quel giorno vale la pianta base. Non è una copia della pianta: è la differenza.';

-- =====================================================================
-- 4. LA PIANTA DEL GIORNO, E LA PROMOZIONE A BASE
-- =====================================================================
-- Un solo calcolo per la schermata di Sala e orari e per le Comande —
-- stesso principio di orderTotals(): due schermate che ricostruiscono la
-- pianta per conto proprio finirebbero per disegnare due sale diverse.
--
-- SECURITY INVOKER di proposito: legge dining_tables e
-- disposizioni_giornaliere, che hanno già la loro RLS. Una seconda
-- serratura qui dentro sarebbe una regola in più da tenere allineata a
-- mano (stessa scelta di documenti_per_domanda).
create or replace function pianta_del_giorno(p_data date)
returns table (
  id uuid, label text, tipo text, forma text, zona text,
  larghezza_cm integer, profondita_cm integer,
  spostabile boolean, posti_fissi integer,
  x integer, y integer, spostato boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select t.id, t.label, t.tipo, t.forma, t.zona,
         t.larghezza_cm, t.profondita_cm,
         t.spostabile, t.posti_fissi,
         coalesce(d.x, t.x) as x,
         coalesce(d.y, t.y) as y,
         d.id is not null   as spostato
  from dining_tables t
  left join disposizioni_giornaliere d
    on d.dining_table_id = t.id and d.data = p_data
  where t.active
  order by t.position;
$$;

comment on function pianta_del_giorno is
  'La sala com''è quel giorno: pianta base + scostamenti della data. Un solo calcolo per Sala e orari e per le Comande.';

revoke all on function pianta_del_giorno(date) from public, anon, authenticated;
grant execute on function pianta_del_giorno(date) to authenticated;

-- «Questa diventa la disposizione base»: promuove la pianta di una
-- giornata a pianta normale e azzera gli scostamenti di quel giorno.
-- Senza questo comando non si capisce più quale sia la sala vera.
--
-- DUE TABELLE, quindi B4: passa dal corridoio, e dentro è una funzione
-- sola. Se la promozione riuscisse e l'azzeramento no, quel giorno
-- resterebbe con scostamenti che ripetono la base — invisibili, e pronti
-- a riemergere il giorno in cui la base cambia di nuovo.
create or replace function promuovi_disposizione(p_data date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  -- Cambiare la sala di TUTTI i giorni è una decisione del titolare.
  if not (select is_titolare()) then
    raise exception 'Solo il titolare può cambiare la disposizione base della sala.';
  end if;

  select count(*) into n from disposizioni_giornaliere where data = p_data;
  if n = 0 then
    raise exception 'Quel giorno la sala è già disposta come la base: non c''è niente da promuovere.';
  end if;

  update dining_tables t
     set x = d.x, y = d.y
    from disposizioni_giornaliere d
   where d.dining_table_id = t.id and d.data = p_data;

  delete from disposizioni_giornaliere where data = p_data;

  return jsonb_build_object('sagome_spostate', n);
end;
$$;

comment on function promuovi_disposizione is
  'Promuove la disposizione di una giornata a pianta base e azzera gli scostamenti di quel giorno. B4: due tabelle, una transazione.';

revoke all on function promuovi_disposizione(date) from public, anon, authenticated;
grant execute on function promuovi_disposizione(date) to authenticated;

-- =====================================================================
-- 5. LA PRENOTAZIONE OCCUPA DEI TAVOLI
-- =====================================================================
-- ⚠️ NESSUNA ENTITÀ «GRUPPO». Quando tre tavoli servono una prenotazione,
-- la prenotazione tiene semplicemente l'elenco dei tavoli che occupa.
-- L'accostamento è dove Alessio li ha messi sulla pianta e non ha bisogno
-- di essere rappresentato: un oggetto «gruppo» vorrebbe creazione, vita,
-- scioglimento a fine serata e una regola per quando una sagoma ne esce.
--
-- ⚠️ L'ETICHETTA SI FOTOGRAFA. Se fra sei mesi la sala viene rinumerata,
-- una prenotazione di oggi deve continuare a mostrare il tavolo che
-- aveva. Stesso principio del prezzo del coperto sul conto chiuso e della
-- dicitura del fornitore sulla riga d'ordine.
create table if not exists prenotazione_tavoli (
  id                   uuid primary key default gen_random_uuid(),
  reservation_id       uuid not null references reservations(id) on delete cascade,
  dining_table_id      uuid not null references dining_tables(id) on delete restrict,
  etichetta_al_momento text not null,
  -- Il SECONDO GIRO: due prenotazioni sullo stesso tavolo la stessa sera a
  -- orari diversi sono ammesse — è la procedura che Alessio usa al
  -- telefono. Il sistema non lo impedisce e non avvisa: registra che il
  -- secondo cliente ha accettato il rischio di trovarlo ancora occupato.
  rischio_accettato    boolean not null default false,
  created_at           timestamptz not null default now(),
  unique (reservation_id, dining_table_id)
);

create index if not exists idx_prenotazione_tavoli_tavolo on prenotazione_tavoli (dining_table_id);

comment on table prenotazione_tavoli is
  'Quali tavoli occupa una prenotazione. Nessuna entità "gruppo": l''accostamento vive sulla pianta. L''etichetta è fotografata al momento della conferma.';

-- Assegnare e confermare tocca lo stato della prenotazione E N righe di
-- collegamento → B4 SENZA ECCEZIONI (Contratto §5, rilievo del validatore
-- del 14/08). Non chiamate .from(...) separate, nemmeno lato server.
create or replace function assegna_prenotazione(
  p_reservation_id    uuid,
  p_tavoli            uuid[],
  p_rischio_accettato boolean default false,
  p_conferma          boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res       reservations%rowtype;
  v_etichette text[];
  n_mancanti  integer;
begin
  -- Assegnare un tavolo è lavoro di sala, non solo del titolare: il
  -- controllo è che ci sia un utente vero. La RLS di reservations non
  -- viene allargata rispetto all'update diretto che c'era prima.
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_res from reservations where id = p_reservation_id for update;
  if not found then
    raise exception 'Prenotazione non trovata';
  end if;
  if v_res.status in ('rifiutata', 'annullata') then
    raise exception 'Questa prenotazione è stata %: riaprila prima di assegnarle un tavolo.', v_res.status;
  end if;

  if p_tavoli is null or array_length(p_tavoli, 1) is null then
    raise exception 'Serve almeno un tavolo: una prenotazione confermata senza tavolo non dice dove far sedere nessuno.';
  end if;

  select count(*) into n_mancanti
  from unnest(p_tavoli) as t(id)
  where not exists (select 1 from dining_tables d where d.id = t.id and d.active);

  if n_mancanti > 0 then
    raise exception 'Uno dei tavoli scelti non esiste più in sala.';
  end if;

  -- Riassegnare sostituisce l'insieme: l'elenco dei tavoli di una
  -- prenotazione è quello che si vede adesso sulla pianta, non la somma
  -- di tutti i ripensamenti.
  delete from prenotazione_tavoli where reservation_id = p_reservation_id;

  insert into prenotazione_tavoli (reservation_id, dining_table_id, etichetta_al_momento, rischio_accettato)
  select p_reservation_id, d.id, d.label, coalesce(p_rischio_accettato, false)
  from dining_tables d
  where d.id = any(p_tavoli);

  select array_agg(etichetta_al_momento order by etichetta_al_momento)
    into v_etichette
  from prenotazione_tavoli where reservation_id = p_reservation_id;

  -- La conferma fa partire l'email al cliente (trigger dell'11/08): è il
  -- comportamento voluto, la conferma è il momento in cui il cliente deve
  -- sapere che il tavolo c'è.
  if coalesce(p_conferma, false) and v_res.status <> 'confermata' then
    update reservations set status = 'confermata' where id = p_reservation_id;
  end if;

  return jsonb_build_object(
    'tavoli',    array_length(v_etichette, 1),
    'etichette', to_jsonb(v_etichette),
    'confermata', coalesce(p_conferma, false) or v_res.status = 'confermata'
  );
end;
$$;

comment on function assegna_prenotazione is
  'Assegna una prenotazione a uno o più tavoli e, se richiesto, la conferma. B4: stato della prenotazione + N righe di collegamento, una transazione.';

revoke all on function assegna_prenotazione(uuid, uuid[], boolean, boolean) from public, anon, authenticated;
grant execute on function assegna_prenotazione(uuid, uuid[], boolean, boolean) to authenticated;

-- =====================================================================
-- 6. IL SOLD OUT — l'unico freno alle richieste pubbliche
-- =====================================================================
-- ⚠️ NON è una chiusura. service_closures descrive PERIODI (ferie,
-- festivi) e dice al cliente «siamo chiusi»; questa dice «siamo al
-- completo», si accende e si spegne spesso, e nello storico le due devono
-- restare distinguibili: una sera chiusa e una sera piena sono due fatti
-- diversi, e fra un anno la differenza è tutto ciò che resta per capire
-- com'è andata.
create table if not exists giornate_sold_out (
  data      date primary key,
  creato_il timestamptz not null default now(),
  creato_da uuid default auth.uid()
);

comment on table giornate_sold_out is
  'Giornate segnate al completo da Alessio. Distinta da service_closures apposta: quella descrive periodi di chiusura, questa singoli giorni pieni.';

-- ⚠️ NESSUN AVVISO DI SOGLIA, né a 20 coperti né ad altro (§6 del
-- mandato). Alessio chiude la giornata guardando la pianta. Un contatore
-- che lo avvisa risolverebbe un problema che questo disegno non produce:
-- nessuna prenotazione esiste senza che lui l'abbia confermata a mano.

-- =====================================================================
-- 7. IL CONTO SULL'INSIEME DEI TAVOLI
-- =====================================================================
-- La parte più delicata. Oggi vale «un solo conto aperto per tavolo» e il
-- conto identifica il tavolo con una STRINGA. Con i tavoli uniti quella
-- regola si rompe in modo evidente: tre tavoli accostati sono UNA comanda,
-- non tre. Lasciata com'era, o il cameriere apre tre conti per un tavolo
-- da dieci, o il vincolo gli blocca l'apertura del secondo.
create table if not exists order_tables (
  order_id             uuid not null references orders(id) on delete cascade,
  dining_table_id      uuid not null references dining_tables(id) on delete restrict,
  etichetta_al_momento text not null,
  -- ⚠️ PERCHÉ QUESTA COLONNA ESISTE, detto per intero. L'invariante da
  -- garantire è «un tavolo non può appartenere a due conti aperti nello
  -- stesso momento». In Postgres un indice unico parziale può guardare
  -- solo le colonne della PROPRIA tabella: lo stato del conto vive su
  -- orders, e da qui non è raggiungibile. Senza questa copia l'invariante
  -- non sarebbe esprimibile come vincolo e resterebbe un controllo nel
  -- codice chiamante — cioè esattamente ciò che il Contratto vieta.
  -- La scrive SOLO un trigger, mai l'applicazione: è una proiezione, non
  -- un secondo posto dove decidere.
  conto_aperto         boolean not null default true,
  created_at           timestamptz not null default now(),
  primary key (order_id, dining_table_id)
);

-- L'INVARIANTE 2, come vincolo. Parziale: lo storico dei conti chiusi
-- sullo stesso tavolo resta libero — è l'apertura contemporanea a non
-- avere senso.
create unique index if not exists uniq_tavolo_su_un_solo_conto_aperto
  on order_tables (dining_table_id) where conto_aperto;

comment on index uniq_tavolo_su_un_solo_conto_aperto is
  'Un tavolo non può stare su due conti aperti insieme. Il rifiuto (23505) arriva dal database, non dalla schermata: fra la lettura e la scrittura di un tablet passano millisecondi, e in quei millisecondi l''altro tablet può aver aperto lo stesso tavolo.';

-- Il trigger che tiene vera la proiezione, nei due versi.
create or replace function trg_order_tables_stato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.conto_aperto := (select o.status = 'aperto' from orders o where o.id = new.order_id);
  return new;
end;
$$;

revoke all on function trg_order_tables_stato() from public, anon, authenticated;

drop trigger if exists trg_order_tables_stato on order_tables;
create trigger trg_order_tables_stato
  before insert on order_tables
  for each row execute function trg_order_tables_stato();

create or replace function trg_orders_libera_tavoli()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    update order_tables
       set conto_aperto = (new.status = 'aperto')
     where order_id = new.id
       and conto_aperto <> (new.status = 'aperto');
  end if;
  return new;
end;
$$;

revoke all on function trg_orders_libera_tavoli() from public, anon, authenticated;

-- ⚠️ Chiuso il conto, quel tavolo torna disponibile SUBITO e senza che
-- nessuno se ne debba ricordare. Vale per tutte e tre le uscite: pagato,
-- omaggiato/scontato, annullato — nessuna delle tre è stata modificata,
-- perché il trigger guarda lo stato e non chi lo ha cambiato.
drop trigger if exists trg_orders_libera_tavoli on orders;
create trigger trg_orders_libera_tavoli
  after update of status on orders
  for each row execute function trg_orders_libera_tavoli();

-- Apre UN conto su uno o più tavoli. B4: orders + order_tables.
create or replace function apri_conto(
  p_tavoli    uuid[],
  p_device_id uuid default null,
  p_note      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id  uuid;
  v_etichette text[];
  v_occupato  text;
  n_mancanti  integer;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  if p_tavoli is null or array_length(p_tavoli, 1) is null then
    raise exception 'Scegli almeno un tavolo prima di aprire il conto.';
  end if;

  select count(*) into n_mancanti
  from unnest(p_tavoli) as t(id)
  where not exists (select 1 from dining_tables d where d.id = t.id and d.active);
  if n_mancanti > 0 then
    raise exception 'Uno dei tavoli scelti non esiste più in sala.';
  end if;

  -- Il controllo qui serve solo a scrivere una frase leggibile in sala.
  -- La GARANZIA è l'indice unico qui sotto: fra questa lettura e la
  -- scrittura passano millisecondi, e in quei millisecondi l'altro tablet
  -- può essere arrivato primo.
  select string_agg(ot.etichetta_al_momento, ', ' order by ot.etichetta_al_momento)
    into v_occupato
  from order_tables ot
  where ot.conto_aperto and ot.dining_table_id = any(p_tavoli);

  if v_occupato is not null then
    raise exception 'Questi tavoli hanno già un conto aperto: %. Chiudilo prima, oppure apri quello.', v_occupato;
  end if;

  select array_agg(d.label order by d.position)
    into v_etichette
  from dining_tables d where d.id = any(p_tavoli);

  -- table_label NON è più l'aggancio: è ciò che si stampa sul ticket di
  -- cucina e sul preconto, fotografato adesso. Il legame vero sono le
  -- righe di order_tables.
  insert into orders (table_label, device_id, note)
  values (array_to_string(v_etichette, ' · '), p_device_id, nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_order_id;

  begin
    insert into order_tables (order_id, dining_table_id, etichetta_al_momento)
    select v_order_id, d.id, d.label from dining_tables d where d.id = any(p_tavoli);
  exception
    when unique_violation then
      raise exception 'Uno di questi tavoli è appena stato aperto da un altro tablet. Riprova: troverai il conto che c''è già.';
  end;

  return jsonb_build_object(
    'order_id',  v_order_id,
    'etichette', to_jsonb(v_etichette)
  );
end;
$$;

comment on function apri_conto is
  'Apre un conto su UN INSIEME di tavoli. B4: conto + righe di collegamento, una transazione. Tre tavoli accostati fanno un conto solo.';

revoke all on function apri_conto(uuid[], uuid, text) from public, anon, authenticated;
grant execute on function apri_conto(uuid[], uuid, text) to authenticated;

-- Cambia l'insieme dei tavoli di un conto aperto: è lo «sposta» di prima
-- (caso limite §3.2.2), che ora sa anche unire e separare.
create or replace function sposta_conto(p_order_id uuid, p_tavoli uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order     orders%rowtype;
  v_etichette text[];
  v_occupato  text;
  n_mancanti  integer;
begin
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Conto non trovato';
  end if;
  if v_order.status <> 'aperto' then
    raise exception 'Questo conto è già stato chiuso: non si sposta più.';
  end if;

  if p_tavoli is null or array_length(p_tavoli, 1) is null then
    raise exception 'Un conto deve stare su almeno un tavolo.';
  end if;

  select count(*) into n_mancanti
  from unnest(p_tavoli) as t(id)
  where not exists (select 1 from dining_tables d where d.id = t.id and d.active);
  if n_mancanti > 0 then
    raise exception 'Uno dei tavoli scelti non esiste più in sala.';
  end if;

  select string_agg(ot.etichetta_al_momento, ', ' order by ot.etichetta_al_momento)
    into v_occupato
  from order_tables ot
  where ot.conto_aperto and ot.dining_table_id = any(p_tavoli) and ot.order_id <> p_order_id;

  if v_occupato is not null then
    raise exception 'Questi tavoli hanno già un conto aperto: %. Chiudilo prima, oppure scegline altri.', v_occupato;
  end if;

  delete from order_tables where order_id = p_order_id;

  begin
    insert into order_tables (order_id, dining_table_id, etichetta_al_momento)
    select p_order_id, d.id, d.label from dining_tables d where d.id = any(p_tavoli);
  exception
    when unique_violation then
      raise exception 'Uno di questi tavoli è appena stato occupato da un altro tablet.';
  end;

  select array_agg(d.label order by d.position)
    into v_etichette
  from dining_tables d where d.id = any(p_tavoli);

  update orders set table_label = array_to_string(v_etichette, ' · ') where id = p_order_id;

  return jsonb_build_object('etichette', to_jsonb(v_etichette));
end;
$$;

comment on function sposta_conto is
  'Cambia l''insieme dei tavoli di un conto aperto (sposta, unisce, separa). B4: righe di collegamento + etichetta stampata del conto.';

revoke all on function sposta_conto(uuid, uuid[]) from public, anon, authenticated;
grant execute on function sposta_conto(uuid, uuid[]) to authenticated;

-- Il vecchio vincolo sulla STRINGA se ne va: il tavolo non è più un
-- testo, e «T1 · T2 · T3» non è un tavolo. L'invariante vero è quello di
-- order_tables, che guarda le sagome.
drop index if exists uniq_conto_aperto_per_tavolo;

-- =====================================================================
-- 8. PERMESSI (Contratto §4: il permesso vive nel database)
-- =====================================================================
alter table disposizioni_giornaliere enable row level security;
alter table prenotazione_tavoli      enable row level security;
alter table giornate_sold_out        enable row level security;
alter table order_tables             enable row level security;

do $policy$
begin
  -- La pianta la legge tutta la sala (serve in Comande), la muove il
  -- titolare. Una restrizione va replicata su insert/update/delete, non
  -- solo su select: in Postgres sono policy indipendenti (§3.18).
  if not exists (select 1 from pg_policies where tablename = 'disposizioni_giornaliere' and policyname = 'disposizioni_select') then
    create policy disposizioni_select on disposizioni_giornaliere for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'disposizioni_giornaliere' and policyname = 'disposizioni_insert') then
    create policy disposizioni_insert on disposizioni_giornaliere for insert to authenticated with check ((select is_titolare()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'disposizioni_giornaliere' and policyname = 'disposizioni_update') then
    create policy disposizioni_update on disposizioni_giornaliere for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'disposizioni_giornaliere' and policyname = 'disposizioni_delete') then
    create policy disposizioni_delete on disposizioni_giornaliere for delete to authenticated using ((select is_titolare()));
  end if;

  -- Chi è a quale tavolo lo deve vedere anche chi serve. Si scrive solo
  -- attraverso assegna_prenotazione (corridoio): nessuna policy di
  -- scrittura diretta, così l'unico modo di toccare questa tabella resta
  -- quello atomico.
  if not exists (select 1 from pg_policies where tablename = 'prenotazione_tavoli' and policyname = 'prenotazione_tavoli_select') then
    create policy prenotazione_tavoli_select on prenotazione_tavoli for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'prenotazione_tavoli' and policyname = 'prenotazione_tavoli_delete') then
    create policy prenotazione_tavoli_delete on prenotazione_tavoli for delete to authenticated using ((select is_titolare()));
  end if;

  -- Il sold out lo legge la sala, lo decide il titolare.
  if not exists (select 1 from pg_policies where tablename = 'giornate_sold_out' and policyname = 'sold_out_select') then
    create policy sold_out_select on giornate_sold_out for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'giornate_sold_out' and policyname = 'sold_out_insert') then
    create policy sold_out_insert on giornate_sold_out for insert to authenticated with check ((select is_titolare()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'giornate_sold_out' and policyname = 'sold_out_delete') then
    create policy sold_out_delete on giornate_sold_out for delete to authenticated using ((select is_titolare()));
  end if;

  -- I tavoli di un conto si leggono in sala; si scrivono solo dal
  -- corridoio (apri_conto / sposta_conto).
  if not exists (select 1 from pg_policies where tablename = 'order_tables' and policyname = 'order_tables_select') then
    create policy order_tables_select on order_tables for select to authenticated using (true);
  end if;
end $policy$;

grant select, insert, update, delete on disposizioni_giornaliere to authenticated;
grant select, delete                 on prenotazione_tavoli      to authenticated;
grant select, insert, delete         on giornate_sold_out        to authenticated;
grant select                         on order_tables             to authenticated;

-- =====================================================================
-- 9. LO SMONTAGGIO (§8 del mandato) — si rimuove, non si spegne
-- =====================================================================
-- Prima si riscrivono i due chiamanti, poi si toglie ciò che chiamavano:
-- nell'ordine inverso il database rifiuterebbe il drop.

-- Il form pubblico: continua a esporre gli orari di servizio e lo stato
-- sold out, e NON espone nessun numero che riveli quanto è pieno il
-- locale — vincolo già presente e mantenuto.
--
-- ⚠️ TURNO UNICO: non esistono fasce né turni. Il cliente indica un'ora di
-- arrivo dentro l'orario di servizio, e basta. Nessuna finestra
-- temporale, nessun calcolo di sovrapposizione.
create or replace function public_reservation_options(p_date date, p_party_size integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_attivo    boolean;
  v_giorni    integer;
  v_preavviso integer;
  v_oggi      date      := (now() at time zone 'Europe/Rome')::date;
  v_adesso    timestamp := (now() at time zone 'Europe/Rome');
  v_motivo    text;
  v_orari     jsonb := '[]'::jsonb;
  r           record;
  v_slot      timestamp;
  v_fine      timestamp;
  v_servizi   integer := 0;
begin
  select prenotazioni_online_attive, giorni_prenotabili, preavviso_minuti
    into v_attivo, v_giorni, v_preavviso
  from service_settings where id = 1;

  -- Il SOLD OUT è l'unico freno, e vale anche a interruttore spento: è la
  -- risposta a «per quella sera siamo pieni», che non dipende da come si
  -- presentano gli orari.
  if exists (select 1 from giornate_sold_out where data = p_date) then
    return jsonb_build_object('attivo', coalesce(v_attivo, false), 'chiuso', true, 'sold_out', true,
      'motivo', 'Per quella sera siamo al completo. Prova un''altra data, oppure chiamaci: a volte si libera qualcosa.',
      'orari', v_orari);
  end if;

  if not coalesce(v_attivo, false) then
    return jsonb_build_object('attivo', false, 'sold_out', false, 'orari', v_orari);
  end if;

  if p_date is null or p_date < v_oggi or p_date > v_oggi + v_giorni then
    return jsonb_build_object('attivo', true, 'chiuso', true, 'sold_out', false,
      'motivo', 'Per questa data non prendiamo ancora prenotazioni online.', 'orari', v_orari);
  end if;

  select motivo into v_motivo from service_closures
   where p_date between dal and al
   order by dal limit 1;
  if found then
    return jsonb_build_object('attivo', true, 'chiuso', true, 'sold_out', false,
      'motivo', coalesce(nullif(trim(v_motivo), ''), 'Quel giorno siamo chiusi.'), 'orari', v_orari);
  end if;

  for r in
    select apertura, ultimo_ingresso
    from service_hours
    where attivo and weekday = extract(dow from p_date)::smallint
    order by apertura
  loop
    v_servizi := v_servizi + 1;
    v_slot := p_date + r.apertura;
    v_fine := p_date + r.ultimo_ingresso;
    while v_slot <= v_fine loop
      if v_slot >= v_adesso + make_interval(mins => v_preavviso) then
        v_orari := v_orari || to_jsonb(to_char(v_slot, 'HH24:MI'));
      end if;
      v_slot := v_slot + interval '15 minutes';
    end loop;
  end loop;

  -- Restano due dei tre messaggi del 10/08: «siamo chiusi» e «per oggi
  -- non più online». Il terzo — «non abbiamo più posto» — non lo dice più
  -- un calcolo: lo dice Alessio segnando la giornata sold out.
  return jsonb_build_object(
    'attivo', true,
    'sold_out', false,
    'chiuso', jsonb_array_length(v_orari) = 0,
    'motivo', case
      when v_servizi = 0 then 'Quel giorno siamo chiusi.'
      when jsonb_array_length(v_orari) = 0 then
        'Per oggi non prendiamo più prenotazioni online. Chiamaci pure: se c''è posto te lo diciamo subito.'
    end,
    'orari', v_orari
  );
end;
$$;

comment on function public_reservation_options is
  'Ciò che il form pubblico mostra prima dell''invio: orari di servizio, giorno chiuso, giornata al completo. Nessun numero sulla capienza, per costruzione: qui dentro non c''è più nessun conteggio di posti.';

revoke all on function public_reservation_options(date, integer) from public, anon, authenticated;
grant execute on function public_reservation_options(date, integer) to anon, authenticated;

-- Il controllo vero resta nel database, non nel form: un form disabilitato
-- lato client non è un freno (§6 del mandato).
create or replace function submit_public_reservation(
  p_reservation_date date,
  p_reservation_time time,
  p_party_size integer,
  p_customer_name text,
  p_customer_phone text default null,
  p_customer_email text default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tel    text := nullif(trim(p_customer_phone), '');
  mail   text := nullif(trim(p_customer_email), '');
  quante integer;
  v_attivo boolean;
  v_aperto boolean;
begin
  if p_party_size is null or p_party_size < 1 or p_party_size > 200 then
    raise exception 'Numero di coperti non valido';
  end if;
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'Nome obbligatorio';
  end if;
  -- Data locale, non UTC: fino alle 02:00 "current_date" è ancora ieri e
  -- accetterebbe una prenotazione per un giorno già passato (§8).
  if p_reservation_date is null
     or p_reservation_date < (now() at time zone 'Europe/Rome')::date then
    raise exception 'Data non valida';
  end if;
  if p_reservation_time is null then
    raise exception 'Orario obbligatorio';
  end if;
  if tel is null and mail is null then
    raise exception 'Serve almeno un contatto (telefono o email)';
  end if;

  -- IL FRENO DELLA GIORNATA PIENA, prima di tutti gli altri controlli e
  -- indipendente dall'interruttore: se il locale è al completo, la
  -- richiesta non deve nemmeno essere registrata.
  if exists (select 1 from giornate_sold_out where data = p_reservation_date) then
    raise exception 'Per quella sera siamo al completo. Scegli un''altra data, oppure chiamaci: a volte si libera qualcosa.';
  end if;

  -- I freni anti-abuso del Contratto §4 RESTANO: il sold out non li
  -- sostituisce. Un indirizzo pubblico riceve invii automatici come
  -- norma, non come eccezione.
  select count(*) into quante
  from reservations
  where source = 'form_pubblico' and created_at > now() - interval '1 hour';

  if quante >= 40 then
    raise exception 'Stiamo ricevendo molte richieste in questo momento. Riprova fra qualche minuto, oppure chiamaci: ti rispondiamo subito.';
  end if;

  select count(*) into quante
  from reservations
  where source = 'form_pubblico'
    and created_at > now() - interval '24 hours'
    and (
      (tel is not null and customer_phone = tel) or
      (mail is not null and customer_email = mail)
    );

  if quante >= 3 then
    raise exception 'Abbiamo già ricevuto le tue richieste e le stiamo guardando: ti ricontattiamo noi. Per modificarne una, chiamaci pure.';
  end if;

  select count(*) into quante
  from reservations
  where source = 'form_pubblico'
    and status = 'richiesta_in_attesa'
    and reservation_date = p_reservation_date
    and reservation_time = p_reservation_time
    and (
      (tel is not null and customer_phone = tel) or
      (mail is not null and customer_email = mail)
    );

  if quante > 0 then
    raise exception 'Questa richiesta l''abbiamo già ricevuta: è in attesa di conferma, non serve rimandarla.';
  end if;

  -- A interruttore acceso restano i due controlli che NON sono capienza:
  -- il giorno di chiusura e l'orario di servizio.
  --
  -- ⚠️ È sparito il terzo, «mentre compilavi quel posto è stato preso»:
  -- una richiesta non occupa più niente. La decisione del 10/08 — la
  -- richiesta in attesa tiene il posto — decade insieme al calcolo che la
  -- rendeva necessaria, ed è stata ratificata da Alessio il 14/08.
  select prenotazioni_online_attive into v_attivo from service_settings where id = 1;

  if coalesce(v_attivo, false) then
    if exists (select 1 from service_closures where p_reservation_date between dal and al) then
      raise exception 'Quel giorno siamo chiusi. Scegli un''altra data, oppure chiamaci.';
    end if;

    select exists (
      select 1 from service_hours
      where attivo
        and weekday = extract(dow from p_reservation_date)::smallint
        and p_reservation_time between apertura and ultimo_ingresso
    ) into v_aperto;

    if not v_aperto then
      raise exception 'A quell''ora non siamo in servizio. Scegli uno degli orari proposti, oppure chiamaci.';
    end if;
  end if;

  insert into reservations (
    type, status, source,
    reservation_date, reservation_time, party_size,
    customer_name, customer_phone, customer_email, notes,
    privacy_consent_at
  ) values (
    'prenotazione', 'richiesta_in_attesa', 'form_pubblico',
    p_reservation_date, p_reservation_time, p_party_size,
    trim(p_customer_name), tel, mail, nullif(trim(p_notes), ''),
    now()
  );
end;
$$;

revoke all on function submit_public_reservation(date, time, integer, text, text, text, text) from public, anon, authenticated;
grant execute on function submit_public_reservation(date, time, integer, text, text, text, text) to anon;

-- Ora che nessuno la chiama più: via il calcolo dei posti liberi.
drop function if exists posti_liberi(timestamp);

-- Via la colonna dei coperti sui tavoli. Il vincolo che la limitava se ne
-- va con lei.
alter table dining_tables drop column if exists seats;

-- Via la durata fissa del tavolo e il tetto dei coperti contemporanei.
-- Il check che li nominava va tolto PRIMA, altrimenti il drop non passa.
alter table service_settings drop constraint if exists service_settings_regole_check;
alter table service_settings
  drop column if exists durata_tavolo_minuti,
  drop column if exists max_coperti_contemporanei;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_settings_regole_check') then
    alter table service_settings add constraint service_settings_regole_check check (
      giorni_prenotabili between 1 and 365
      and preavviso_minuti between 0 and 10080
    );
  end if;
end $$;

-- =====================================================================
-- 10. VERIFICA (§7 punti 1-3) — la regola, provata sul campo
-- =====================================================================
-- ⚠️ I trigger di notifica su reservations si spengono per la durata della
-- prova: l'11/08 una verifica ha mandato una prenotazione finta sul
-- Telegram di Alessio, e la conferma qui sotto farebbe partire anche
-- un'email a un cliente che non esiste. Si spengono QUELLI, non tutti
-- (`session_replication_role = replica` fermerebbe anche i trigger che
-- questa migrazione deve provare, e la verifica passerebbe senza aver
-- verificato niente).
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  v_t        uuid[];
  v_id       uuid;
  v_res      uuid;
  v_res2     uuid;
  v_conto    uuid;
  v_conto2   uuid;
  v_out      jsonb;
  v_domani   date := (now() at time zone 'Europe/Rome')::date + 1;
  v_dopo     date := (now() at time zone 'Europe/Rome')::date + 2;
  v_x_base   integer;
  v_msg      text;
  v_online   boolean;
  respinto   boolean;
  n          integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'Servono un titolare e uno staff per questa verifica.';
  end if;

  alter table reservations disable trigger trg_notify_reservation_telegram;
  alter table reservations disable trigger trg_reservations_email_conferma;

  -- Le prove sul form pubblico vogliono l'interruttore acceso, altrimenti
  -- la funzione esce subito e non si verifica niente. Si annota com'era e
  -- si rimette esattamente così: in produzione è acceso, sul progetto di
  -- prova no, e la migrazione non deve cambiare quel fatto.
  select prenotazioni_online_attive into v_online from service_settings where id = 1;
  update service_settings set prenotazioni_online_attive = true where id = 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- ---- STRUTTURA -------------------------------------------------
  if exists (select 1 from information_schema.columns
              where table_name = 'dining_tables' and column_name = 'seats') then
    raise exception 'La colonna dei coperti sui tavoli è ancora lì: spenta non basta, andava rimossa.';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
              where ns.nspname = 'public' and p.proname = 'posti_liberi') then
    raise exception 'La funzione posti_liberi esiste ancora.';
  end if;
  if exists (select 1 from information_schema.columns
              where table_name = 'service_settings'
                and column_name in ('durata_tavolo_minuti', 'max_coperti_contemporanei')) then
    raise exception 'La durata del tavolo o il tetto dei coperti sono ancora in tabella.';
  end if;
  if exists (select 1 from pg_indexes
              where schemaname = 'public' and indexname = 'uniq_conto_aperto_per_tavolo') then
    raise exception 'Il vecchio vincolo sulla stringa del tavolo è ancora attivo.';
  end if;

  select count(*) into n from dining_tables where active;
  if n <> 13 then
    raise exception 'Attese 13 sagome attive (9 tavoli + 3 divani + Chef Table), trovate %.', n;
  end if;

  -- CRITERIO 10 — divani e Chef Table non si trascinano, e lo dice il
  -- vincolo: si prova a renderne uno spostabile e deve rifiutare.
  respinto := false;
  begin
    update dining_tables set spostabile = true where label = 'Chef Table';
  exception when check_violation then respinto := true;
  end;
  if not respinto then
    raise exception 'Lo Chef Table si è lasciato marcare come spostabile.';
  end if;

  -- INVARIANTE 1 — un tavolo non può avere coperti.
  respinto := false;
  begin
    update dining_tables set posti_fissi = 4 where label = 'T1';
  exception when check_violation then respinto := true;
  end;
  if not respinto then
    raise exception 'Un tavolo ha accettato un numero di coperti: la capienza è rientrata dalla finestra.';
  end if;

  -- ---- CRITERI 4 e 5 — la disposizione di una giornata ------------
  select x into v_x_base from dining_tables where label = 'T5';

  insert into disposizioni_giornaliere (data, dining_table_id, x, y)
  select v_domani, id, 1900, 900 from dining_tables where label = 'T5';
  insert into disposizioni_giornaliere (data, dining_table_id, x, y)
  select v_domani, id, 1990, 900 from dining_tables where label = 'T6';

  -- CRITERIO 4: il giorno dopo mostra la pianta base, immutata.
  if (select x from pianta_del_giorno(v_domani) where label = 'T5') <> 1900 then
    raise exception 'Lo scostamento del giorno non si vede nella pianta di quel giorno.';
  end if;
  if (select x from pianta_del_giorno(v_dopo) where label = 'T5') <> v_x_base then
    raise exception 'Il giorno successivo non è ripartito dalla pianta base.';
  end if;
  if (select spostato from pianta_del_giorno(v_dopo) where label = 'T5') then
    raise exception 'Un giorno senza scostamenti risulta spostato.';
  end if;

  -- CRITERIO 5: promuovo, e la base cambia per tutti i giorni.
  v_out := promuovi_disposizione(v_domani);
  if (v_out->>'sagome_spostate')::integer <> 2 then
    raise exception 'La promozione dichiara % sagome invece di 2.', v_out->>'sagome_spostate';
  end if;
  if (select x from pianta_del_giorno(v_dopo) where label = 'T5') <> 1900 then
    raise exception 'Dopo la promozione il giorno successivo non mostra la pianta nuova.';
  end if;
  if exists (select 1 from disposizioni_giornaliere where data = v_domani) then
    raise exception 'Dopo la promozione quel giorno ha ancora degli scostamenti.';
  end if;

  -- Promuovere un giorno senza scostamenti non fa finta di riuscire.
  respinto := false;
  begin
    perform promuovi_disposizione(v_dopo);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'La promozione di un giorno senza scostamenti è passata in silenzio.';
  end if;

  -- Lo staff non muove la sala di tutti i giorni.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  respinto := false;
  begin
    perform promuovi_disposizione(v_domani);
  exception when sqlstate 'P0001' then respinto := true;
  end;
  if not respinto then
    raise exception 'Lo staff ha potuto cambiare la disposizione base.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  -- Rimetto la base com'era: questa migrazione non deve lasciare la sala
  -- spostata da una prova.
  update dining_tables set x = v_x_base where label = 'T5';
  update dining_tables set x = v_x_base + 90 where label = 'T6';

  -- ---- CRITERI 1, 2, 3 — il conto sui tavoli uniti ----------------
  select array_agg(id order by position) into v_t
  from dining_tables where label in ('T5', 'T6', 'T7');

  -- CRITERIO 1 (il collaudo principale): tre sagome accostate, una
  -- prenotazione da 10, UN conto.
  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name, privacy_consent_at)
  values ('prenotazione', 'richiesta_in_attesa', 'form_pubblico', v_domani,
          '20:00', 10, 'PROVA PIANTA', now())
  returning id into v_res;

  v_out := assegna_prenotazione(v_res, v_t, false, true);
  if (v_out->>'tavoli')::integer <> 3 then
    raise exception 'La prenotazione da 10 risulta su % tavoli invece di 3.', v_out->>'tavoli';
  end if;
  if (select status from reservations where id = v_res) <> 'confermata' then
    raise exception 'La prenotazione non è stata confermata.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  v_out := apri_conto(v_t, null, null);
  v_conto := (v_out->>'order_id')::uuid;

  select count(*) into n from orders where id = v_conto;
  if n <> 1 then
    raise exception 'Il tavolo da dieci non ha prodotto un conto solo.';
  end if;
  select count(*) into n from order_tables where order_id = v_conto;
  if n <> 3 then
    raise exception 'Il conto risulta agganciato a % tavoli invece di 3.', n;
  end if;
  if (select table_label from orders where id = v_conto) <> 'T5 · T6 · T7' then
    raise exception 'L''etichetta stampata del conto è "%".', (select table_label from orders where id = v_conto);
  end if;

  -- CRITERIO 2: un tavolo già su un conto aperto non finisce su un altro,
  -- e il rifiuto arriva dal database.
  respinto := false;
  begin
    perform apri_conto(array[v_t[1]], null, null);
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_msg = message_text;
    respinto := true;
  end;
  if not respinto then
    raise exception 'Lo stesso tavolo è finito su due conti aperti.';
  end if;

  -- ...e non solo perché la funzione lo controlla prima: anche scrivendo
  -- la riga a mano, l'indice unico respinge (§7 punto 2 — una regola
  -- restrittiva si dichiara verificata solo dopo averla vista respingere).
  insert into orders (table_label) values ('__prova_pianta__') returning id into v_conto2;
  respinto := false;
  begin
    insert into order_tables (order_id, dining_table_id, etichetta_al_momento)
    values (v_conto2, v_t[1], 'T5');
  exception when unique_violation then respinto := true;
  end;
  if not respinto then
    raise exception 'L''indice unico non ha respinto il secondo conto aperto sullo stesso tavolo.';
  end if;

  -- CRITERIO 3: chiuso il conto, il tavolo torna disponibile subito.
  update orders set status = 'annullato', cancel_reason = 'prova pianta',
                    closed_at = now()
   where id = v_conto;

  if exists (select 1 from order_tables where order_id = v_conto and conto_aperto) then
    raise exception 'Il conto è chiuso ma i suoi tavoli risultano ancora occupati.';
  end if;

  insert into order_tables (order_id, dining_table_id, etichetta_al_momento)
  values (v_conto2, v_t[1], 'T5');
  if not exists (select 1 from order_tables where order_id = v_conto2 and conto_aperto) then
    raise exception 'Il tavolo liberato non si è potuto riaprire su un altro conto.';
  end if;

  -- Lo spostamento cambia l'insieme e riscrive l'etichetta stampata.
  v_out := sposta_conto(v_conto2, array[v_t[2], v_t[3]]);
  if (select table_label from orders where id = v_conto2) <> 'T6 · T7' then
    raise exception 'Dopo lo spostamento l''etichetta del conto è "%".', (select table_label from orders where id = v_conto2);
  end if;
  if exists (select 1 from order_tables where order_id = v_conto2 and dining_table_id = v_t[1]) then
    raise exception 'Il tavolo di partenza è rimasto agganciato al conto spostato.';
  end if;

  update orders set status = 'annullato', cancel_reason = 'prova pianta', closed_at = now()
   where id = v_conto2;

  -- ---- CRITERIO 6 — lo storico non si rompe con una rinumerazione --
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  update dining_tables set label = 'RINOMINATO' where id = v_t[1];
  if (select etichetta_al_momento from prenotazione_tavoli
       where reservation_id = v_res and dining_table_id = v_t[1]) <> 'T5' then
    raise exception 'Rinominando un tavolo è cambiata anche l''etichetta di una prenotazione già confermata.';
  end if;
  update dining_tables set label = 'T5' where id = v_t[1];

  -- ---- CRITERIO 9 — due prenotazioni sullo stesso tavolo ----------
  insert into reservations (type, status, source, reservation_date, reservation_time,
                            party_size, customer_name, privacy_consent_at)
  values ('prenotazione', 'richiesta_in_attesa', 'form_pubblico', v_domani,
          '22:00', 2, 'PROVA PIANTA 2', now())
  returning id into v_res2;

  v_out := assegna_prenotazione(v_res2, array[v_t[1]], true, true);
  if (v_out->>'tavoli')::integer <> 1 then
    raise exception 'La seconda prenotazione sullo stesso tavolo è stata rifiutata: doveva essere ammessa.';
  end if;
  if not (select rischio_accettato from prenotazione_tavoli
           where reservation_id = v_res2 and dining_table_id = v_t[1]) then
    raise exception 'Il rischio accettato non è stato registrato.';
  end if;

  -- ---- CRITERI 7, 8, 12 — il sold out -----------------------------
  insert into giornate_sold_out (data) values (v_dopo);

  -- CRITERIO 7: il rifiuto avviene chiamando la funzione direttamente,
  -- non solo dall'interfaccia.
  respinto := false;
  begin
    perform submit_public_reservation(v_dopo, '20:00', 2, 'PROVA PIANTA 3', '3990000000', null, null);
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%completo%' then
      raise exception 'Rifiuto avvenuto ma con un messaggio inatteso: %', v_msg;
    end if;
    respinto := true;
  end;
  if not respinto then
    raise exception 'Una richiesta pubblica è passata su una giornata segnata al completo.';
  end if;

  v_out := public_reservation_options(v_dopo, 2);
  if not (v_out->>'sold_out')::boolean then
    raise exception 'Il form pubblico non sa che quella giornata è al completo.';
  end if;

  -- CRITERIO 12: nessun numero sulla capienza esce da qui. Si controlla
  -- la forma della risposta, non il testo: una chiave in più domani
  -- sarebbe un numero in più esposto senza che nessuno se ne accorga.
  v_out := public_reservation_options(v_domani, 2);
  select count(*) into n
  from jsonb_object_keys(v_out) as k(nome)
  where k.nome not in ('attivo', 'chiuso', 'sold_out', 'motivo', 'orari');
  if n > 0 then
    raise exception 'Il form pubblico espone campi non previsti: %.', v_out;
  end if;

  -- CRITERIO 8: chiusura per ferie e sold out restano distinguibili.
  insert into service_closures (dal, al, motivo) values (v_dopo + 30, v_dopo + 30, 'PROVA PIANTA ferie');
  v_out := public_reservation_options(v_dopo + 30, 2);
  if (v_out->>'sold_out')::boolean then
    raise exception 'Una chiusura per ferie viene raccontata come un sold out.';
  end if;
  if v_out->>'motivo' not like '%ferie%' and v_out->>'motivo' not like '%chius%' then
    raise exception 'Una chiusura per ferie non dice di essere una chiusura: "%".', v_out->>'motivo';
  end if;

  -- ---- PULIZIA ----------------------------------------------------
  delete from service_closures where motivo = 'PROVA PIANTA ferie';
  delete from giornate_sold_out where data = v_dopo;
  delete from order_items where order_id in (v_conto, v_conto2);
  delete from orders where id in (v_conto, v_conto2);
  delete from reservations where id in (v_res, v_res2);
  delete from disposizioni_giornaliere where data in (v_domani, v_dopo);
  update service_settings set prenotazioni_online_attive = coalesce(v_online, false) where id = 1;

  select count(*) into n from reservations where customer_name like 'PROVA PIANTA%';
  if n <> 0 then
    raise exception 'La prova ha lasciato % prenotazioni nel database.', n;
  end if;
  select count(*) into n from orders where table_label = '__prova_pianta__';
  if n <> 0 then
    raise exception 'La prova ha lasciato % conti nel database.', n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  alter table reservations enable trigger trg_notify_reservation_telegram;
  alter table reservations enable trigger trg_reservations_email_conferma;

  -- Riaccendere i trigger va VERIFICATO: lasciarli spenti significa
  -- richieste dei clienti che non arrivano più, in silenzio.
  select count(*) into n from pg_trigger
   where tgrelid = 'reservations'::regclass and not tgisinternal and tgenabled = 'D';
  if n > 0 then
    raise exception 'Sono rimasti % trigger spenti su reservations.', n;
  end if;

  raise notice 'La pianta viva è installata: 13 sagome, tre tavoli accostati fanno UN conto, il sold out rifiuta dal database, e del calcolo dei posti non è rimasto niente.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260814000007', 'la_pianta_viva')
on conflict (version) do nothing;

-- Riepilogo: la sala com'è adesso.
select
  (select count(*) from dining_tables where active)                         as sagome_attive,
  (select count(*) from dining_tables where active and tipo = 'tavolo')     as tavoli,
  (select count(*) from dining_tables where active and not spostabile)      as arredi_fissi,
  (select count(*) from disposizioni_giornaliere)                           as giornate_con_scostamenti,
  (select count(*) from giornate_sold_out)                                  as giornate_al_completo,
  (select count(*) from order_tables where conto_aperto)                    as tavoli_occupati_ora,
  (select count(*) from information_schema.columns
    where table_name = 'dining_tables' and column_name = 'seats')           as colonna_coperti_rimasta,
  (select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'posti_liberi')             as funzione_posti_liberi_rimasta;
