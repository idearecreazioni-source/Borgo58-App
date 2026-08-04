-- =====================================================================
-- Borgo 58 · Migrazione 0030 — Comande + schermate Cucina/Bar (§3.2, §4 mod. 5)
-- =====================================================================
-- "Parte facile" della strada C: presa ordini in sala + instradamento a
-- cucina/bar. Nessuna implicazione fiscale, nessuna dipendenza dall'RT.
--
-- VINCOLO TECNICO ONESTO: senza la postazione locale (§3.6, mini-PC non
-- ancora comprato), il browser non può aprire una connessione TCP grezza
-- verso una stampante ESC/POS — servirebbe un servizio backend che oggi
-- non esiste. Le schermate Cucina/Bar qui costruite sono il sostituto
-- digitale della stampante finché l'hardware non arriva: un tablet aperto
-- sulla pagina invece di un rotolo di carta. Quando la postazione locale
-- esisterà, l'invio fisico si aggiunge SOPRA questo schema (un servizio
-- che osserva sent_at e stampa), senza toccare le tabelle qui sotto.
--
-- Flusso ripreso dai due prototipi UX di Cowork (Borgo58_Prototipo_Comande
-- .html e _React.html): bozza in sala → "invia comanda" esplicito che la
-- smista per reparto → ticket in cucina/bar, mai cancellati ma annullati
-- con motivo (tracciabilità, coerente con §6 "mai nascondere"). Confermato
-- anche lì lo stesso gap trovato in autonomia: il Ricettario non ha un
-- campo "reparto" né una categoria "bevanda" — risolto qui a livello di
-- riga d'ordine (destination), non toccando lo schema del Ricettario.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tipi e tabelle
-- ---------------------------------------------------------------------
create type order_status as enum ('aperto', 'chiuso', 'annullato', 'omaggiato');
create type order_destination as enum ('cucina', 'bar');
create type order_payment_method as enum ('contante', 'carta');

create table orders (
  id               uuid primary key default gen_random_uuid(),
  entity_id        uuid not null references entities(id) on delete restrict,
  table_label      text not null,          -- testo libero (tavolo/zona) — niente gestione tavoli, §3.2
  status           order_status not null default 'aperto',
  device_id        uuid references pos_devices(id) on delete set null,
  payment_method   order_payment_method,   -- valorizzato solo alla chiusura come 'chiuso'
  cancel_reason    text,                   -- richiesto quando status = 'annullato'
  discount_gift_id uuid references discounts_gifts(id) on delete set null, -- §3.4: sconto/omaggio passa da lì, non duplicato qui
  note             text,
  opened_at        timestamptz not null default now(),
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table orders is
  'Comanda/conto per un tavolo (§3.2, §4 modulo 5). Un conto sconto/omaggio non duplica discounts_gifts: lo referenzia. "Chiuso" qui NON registra un incasso in cassa — quello arriverà con l''integrazione RT (§3.2); oggi è solo lo stato operativo del tavolo.';

create index idx_orders_status_open on orders(status) where status = 'aperto';

create trigger trg_orders_updated_at before update on orders
  for each row execute function set_updated_at();

create table order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders(id) on delete cascade,
  recipe_id      uuid references recipes(id) on delete restrict,
  free_text_name text,                     -- bevande e fuori-menu: il Ricettario non le modella (vedi nota sopra)
  destination    order_destination not null,
  quantity       integer not null default 1 check (quantity > 0),
  unit_price     numeric(12,2) not null check (unit_price >= 0), -- catturato al momento dell'ordine, non ricalcolato se il prezzo del menu cambia dopo
  note           text,                     -- es. "senza glutine"
  -- Ciclo di vita ripreso dal prototipo: bozza in sala -> inviata al
  -- reparto -> pronta. Mai un delete dopo l'invio: si annulla con motivo.
  sent_at        timestamptz,              -- null = ancora nella comanda in sala, non ancora sui monitor cucina/bar
  prepared_at    timestamptz,              -- segnata pronta da cucina/bar (equivalente digitale del ticket evaso)
  voided_at      timestamptz,
  void_reason    text,
  created_at     timestamptz not null default now(),

  constraint item_has_source check (recipe_id is not null or free_text_name is not null)
);
comment on table order_items is
  'Righe di una comanda. sent_at nullo = bozza (correggibile/cancellabile liberamente, non ha mai lasciato la sala). Una volta inviata, si corregge solo con voided_at+void_reason — mai un delete, per lo stesso principio di tracciabilità di §6.';

create index idx_order_items_order on order_items(order_id);
create index idx_order_items_reparto on order_items(destination) where sent_at is not null and voided_at is null;

-- ---------------------------------------------------------------------
-- 2. Vista menu per la sala — estende il pattern §3.18
-- ---------------------------------------------------------------------
-- `menus`/`menu_items` sono titolare-only per intero (20260801000001) —
-- corretto per l'Editor Menu (progettazione/stampa), ma la comanda deve
-- permettere ALLO STAFF di scegliere cosa ordinare: senza questa vista lo
-- staff non potrebbe leggere né il piatto né il prezzo. Stesso principio
-- già applicato oggi a suppliers_display/menu_items_display-like views:
-- SECURITY DEFINER, solo le colonne sicure (nome/categoria/prezzo di
-- vendita — mai food cost/margine, quelli restano in v_menu_item_economics
-- titolare-only).
create view menu_items_display as
select mi.id, mi.recipe_id, r.name as recipe_name, mi.category, mi.selling_price
from menu_items mi
join menus m on m.id = mi.menu_id and m.is_active
join recipes r on r.id = mi.recipe_id
order by mi.position;

comment on view menu_items_display is
  'Piatti del menu attivo per la presa ordini (§3.2): nome, categoria, prezzo di vendita. Niente food cost/margine — sicura per lo staff.';
grant select on menu_items_display to authenticated;

-- ---------------------------------------------------------------------
-- 3. RLS — orders/order_items: comande sono staff-accessibili (§3.5)
-- ---------------------------------------------------------------------
-- Stesso pattern di Agenda/Prenotazioni: select/insert/update aperti,
-- delete riservato al titolare (un conto non si cancella, si annulla).
alter table orders enable row level security;
create policy orders_select_all on orders for select to authenticated using (true);
create policy orders_insert_all on orders for insert to authenticated with check (true);
create policy orders_update_all on orders for update to authenticated using (true) with check (true);
create policy orders_delete_titolare on orders for delete to authenticated using ((select is_titolare()));
grant select, insert, update, delete on orders to authenticated;

alter table order_items enable row level security;
create policy order_items_select_all on order_items for select to authenticated using (true);
create policy order_items_insert_all on order_items for insert to authenticated with check (true);
create policy order_items_update_all on order_items for update to authenticated using (true) with check (true);
-- Delete aperto anche allo staff, a differenza del resto dell'app: qui
-- copre SOLO la correzione di una riga ancora in bozza (sent_at null,
-- mai vista da cucina/bar) — non una cancellazione di dati storici. Il
-- codice applicativo non chiama mai delete su una riga già inviata (si
-- usa voided_at); non è imposto da un vincolo qui per non appesantire lo
-- schema per un caso che l'app stessa non genera.
create policy order_items_delete_all on order_items for delete to authenticated using (true);
grant select, insert, update, delete on order_items to authenticated;

-- ---------------------------------------------------------------------
-- 4. Sconti/omaggi utilizzabili dallo staff — implementa §3.4, non è una
--    nuova decisione (vedi nota lunga sotto)
-- ---------------------------------------------------------------------
-- Il brief (§3.4, deciso 03/08/2026) è esplicito: "qualsiasi utente
-- loggato ... può applicare sconti e marcare un conto come omaggio —
-- nessun PIN di riconferma, nessuna restrizione di ruolo". Ma
-- discounts_gifts e cash_causali erano rimaste titolare-only per TUTTE
-- le operazioni (20260802000011) — un oversight della migrazione
-- originale, non contraddetto da nessuna revisione successiva: emerso
-- solo ora perché comande è la prima funzione staff-facing che ne ha
-- davvero bisogno. Restano riservati al titolare, come da §3.5: prima
-- nota, dashboard, margine per piatto, riepilogo mensile (la vista
-- aggregata v_discounts_gifts_monthly non cambia). Qui si apre SOLO la
-- creazione, non la lettura del registro.
--
-- created_by è necessario per un motivo tecnico preciso, non stilistico:
-- in Postgres, il RETURNING di un INSERT è filtrato dalle policy SELECT.
-- Con RLS attiva e zero policy SELECT per lo staff, un insert riuscito
-- dello staff tornerebbe comunque zero righe al client (PostgREST usa
-- .select() dopo l'insert per restituire l'id) — e senza l'id non si può
-- collegare l'omaggio/sconto al tavolo chiuso. La policy SELECT sotto
-- concede quindi ESATTAMENTE "le proprie righe", non l'intero registro:
-- lo staff continua a non vedere gli omaggi degli altri né il pallino di
-- segnalazione (quello resta comunque solo nella UI titolare-only di
-- ScontiOmaggi, invariata).
alter table discounts_gifts add column created_by uuid not null default auth.uid() references auth.users(id);
comment on column discounts_gifts.created_by is
  'Necessario perché lo staff possa leggere la propria riga appena creata (vincolo tecnico su RETURNING+RLS, vedi commento sopra) — non un log di sorveglianza: il titolare vede comunque tutto tramite is_titolare(), lo staff SOLO ciò che ha creato lui stesso.';

drop policy if exists discounts_gifts_titolare_all on discounts_gifts;
create policy discounts_gifts_select on discounts_gifts
  for select to authenticated
  using ((select is_titolare()) or created_by = (select auth.uid()));
create policy discounts_gifts_insert_all on discounts_gifts
  for insert to authenticated with check (true);
create policy discounts_gifts_upd_titolare on discounts_gifts
  for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));
create policy discounts_gifts_del_titolare on discounts_gifts
  for delete to authenticated using ((select is_titolare()));

-- cash_causali: solo un elenco di etichette (es. "Cortesia"), niente di
-- sensibile — lo staff deve poterle leggere per scegliere una causale
-- quando chiude un conto in sconto/omaggio. Modificarle resta al titolare.
drop policy if exists cash_causali_titolare_all on cash_causali;
create policy cash_causali_select_all on cash_causali for select to authenticated using (true);
create policy cash_causali_ins_titolare on cash_causali for insert to authenticated with check ((select is_titolare()));
create policy cash_causali_upd_titolare on cash_causali for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));
create policy cash_causali_del_titolare on cash_causali for delete to authenticated using ((select is_titolare()));

-- pos_devices: stesso ragionamento di cash_causali — lo staff deve poter
-- scegliere "quale tablet sto usando" nel form, non configurarli.
drop policy if exists pos_devices_titolare_all on pos_devices;
create policy pos_devices_select_all on pos_devices for select to authenticated using (true);
create policy pos_devices_ins_titolare on pos_devices for insert to authenticated with check ((select is_titolare()));
create policy pos_devices_upd_titolare on pos_devices for update to authenticated using ((select is_titolare())) with check ((select is_titolare()));
create policy pos_devices_del_titolare on pos_devices for delete to authenticated using ((select is_titolare()));

-- cash_movements e la vista mensile v_discounts_gifts_monthly NON toccati:
-- restano titolare-only per intero, coerente con §3.5.
