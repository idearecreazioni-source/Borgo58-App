-- ---------------------------------------------------------------------
-- Indici sulle chiavi esterne che verranno percorse ogni giorno
-- ---------------------------------------------------------------------
-- Dall'audit dell'08/08/2026: 35 chiavi esterne senza indice. NON vanno
-- indicizzate tutte — ogni indice e' lavoro in piu' a ogni scrittura, e su
-- una tabella che restera' di dieci righe non fa risparmiare nulla.
--
-- Due criteri, entrambi necessari:
--  1. la tabella cresce a ogni servizio (comande, cassa, HACCP,
--     prenotazioni), non e' un'anagrafica che si compila una volta;
--  2. la colonna viene davvero percorsa: e' usata in una join o in un
--     filtro dall'applicazione, e punta a molti valori diversi.
--
-- Escluse deliberatamente TUTTE le colonne entity_id, che pure comparivano
-- nell'elenco: contengono due soli valori (S.r.l.s. e azienda agricola).
-- Un indice su due valori distinti non evita al database di leggere mezza
-- tabella comunque — e' costo senza beneficio.
--
-- Oggi queste tabelle hanno poche righe e nessuna differenza si vedrebbe.
-- Il momento giusto per metterli e' proprio questo: fra due anni di
-- servizio la stessa migrazione bloccherebbe le tabelle per il tempo di
-- costruire gli indici, e si farebbe di corsa perche' l'app e' gia' lenta.
--
-- Idempotente (§7 punto 3).

-- Comande: ogni lettura di un conto fa join su ricetta e dispositivo.
create index if not exists idx_order_items_recipe on order_items(recipe_id);
create index if not exists idx_orders_device on orders(device_id);
create index if not exists idx_orders_discount_gift on orders(discount_gift_id);

-- Prima nota e sconti/omaggi: la causale compare in ogni elenco, e gli
-- omaggi qui sono previsti sistematici (§3.4), non occasionali.
create index if not exists idx_cash_movements_causale on cash_movements(causale_id);
create index if not exists idx_discounts_gifts_causale on discounts_gifts(causale_id);
create index if not exists idx_discounts_gifts_device on discounts_gifts(device_id);

-- HACCP: una riga per ogni consegna ricevuta, con il fornitore accanto.
create index if not exists idx_haccp_goods_receiving_supplier on haccp_goods_receiving(supplier_id);

-- Calendario eventi: il menu concordato per l'evento.
create index if not exists idx_reservations_event_menu on reservations(event_menu_id);

-- Documenti e fatture collegati a un task di Agenda: percorso ogni volta
-- che un task viene chiuso o cancellato.
create index if not exists idx_documents_task on documents(task_id);
create index if not exists idx_supplier_invoices_task on supplier_invoices(task_id);

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  attesi text[] := array[
    'idx_order_items_recipe','idx_orders_device','idx_orders_discount_gift',
    'idx_cash_movements_causale','idx_discounts_gifts_causale',
    'idx_discounts_gifts_device','idx_haccp_goods_receiving_supplier',
    'idx_reservations_event_menu','idx_documents_task',
    'idx_supplier_invoices_task'
  ];
  i text;
begin
  foreach i in array attesi loop
    if to_regclass('public.' || i) is null then
      raise exception 'Indice % non creato: la migrazione non ha fatto quello che dichiara.', i;
    end if;
  end loop;
  raise notice 'Tutti e % gli indici sulle chiavi esterne sono presenti.', array_length(attesi, 1);
end $verifica$;

insert into applied_migrations (version, name)
values ('20260808000003', 'indici_chiavi_esterne')
on conflict (version) do nothing;

-- Riepilogo: devono comparire 10 righe.
select indexname as indice, tablename as tabella
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_order_items_recipe','idx_orders_device','idx_orders_discount_gift',
    'idx_cash_movements_causale','idx_discounts_gifts_causale',
    'idx_discounts_gifts_device','idx_haccp_goods_receiving_supplier',
    'idx_reservations_event_menu','idx_documents_task',
    'idx_supplier_invoices_task'
  )
order by tablename, indexname;
