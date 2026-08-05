-- =====================================================================
-- Borgo 58 · Migrazione 0035 — Indici mancanti sulle tabelle che crescono
-- =====================================================================
-- Attua il punto 4 del debito tecnico di §3.19.
--
-- Criterio di selezione (deliberatamente restrittivo — un indice inutile
-- non è gratis: rallenta ogni scrittura e occupa spazio): si aggiunge un
-- indice SOLO dove entrambe le condizioni sono vere —
--   1. la tabella cresce col volume di lavoro del locale (non è un elenco
--      di configurazione che resta di poche righe);
--   2. la colonna viene effettivamente usata come filtro dal codice.
--
-- Verificato incrociando tutti i filtri `.eq()` del layer API con gli
-- indici già esistenti. Sono stati ESCLUSI di proposito i filtri su
-- tabelle che restano piccole per natura (causali, device, tavoli,
-- attrezzature HACCP, menu, fornitori, ingredienti, ricette): lì un
-- indice costerebbe più di quanto farebbe risparmiare.
--
-- ⚠️ CORREZIONE 05/08/2026 — questa migrazione è ora IDEMPOTENTE.
-- La prima stesura usava `create index` semplice e falliva se rieseguita
-- ("relation already exists"), lasciando l'incertezza se lo stato fosse
-- completo o a metà. Una migrazione applicata a mano va sempre scritta
-- in modo che rilanciarla sia innocuo: `if not exists` ovunque, così
-- l'unico esito possibile è "adesso è tutto a posto". Vedi §7 protocollo 3.
-- =====================================================================

-- price_history: unica tabella del progetto senza NESSUN indice, ma
-- append-only e interrogata da due punti diversi. Indici composti perché
-- entrambe le query filtrano E ordinano per data decrescente.
create index if not exists idx_price_history_ingredient
  on price_history(ingredient_id, recorded_at desc);
comment on index idx_price_history_ingredient is
  'Storico prezzi di un ingrediente (scheda ingrediente, Ricettario).';

create index if not exists idx_price_history_supplier
  on price_history(supplier_id, recorded_at desc)
  where supplier_id is not null;
comment on index idx_price_history_supplier is
  'Storico prezzi di un fornitore (scheda fornitore, §3.11). Parziale: molte righe non hanno fornitore.';

-- stock_lots per fornitore: alimenta "Consegne recenti" nella scheda
-- fornitore. La tabella cresce a ogni carico di magazzino.
create index if not exists idx_stock_lots_supplier
  on stock_lots(supplier_id, received_at desc)
  where supplier_id is not null;

-- discounts_gifts per entità: esisteva solo l'indice per data. Il registro
-- e il riepilogo mensile filtrano sempre per entità (§1, multi-entità).
create index if not exists idx_discounts_gifts_entity
  on discounts_gifts(entity_id, movement_date desc);

-- reservations per cliente: alimenta lo storico nella scheda cliente
-- (§3.14). Cresce con ogni prenotazione.
create index if not exists idx_reservations_customer
  on reservations(customer_id)
  where customer_id is not null;

-- ---------------------------------------------------------------------
-- Verifica finale (§7 protocollo 3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  attesi text[] := array[
    'idx_price_history_ingredient','idx_price_history_supplier',
    'idx_stock_lots_supplier','idx_discounts_gifts_entity',
    'idx_reservations_customer'
  ];
  i text;
begin
  foreach i in array attesi loop
    if to_regclass('public.' || i) is null then
      raise exception 'Indice % non creato: la migrazione non ha fatto quello che dichiara.', i;
    end if;
  end loop;
  raise notice 'Tutti e % gli indici sono presenti.', array_length(attesi, 1);
end $verifica$;

insert into applied_migrations (version, name)
values ('20260805000002', 'indici_mancanti')
on conflict (version) do nothing;

-- Riepilogo visibile nel pannello dei risultati: i 5 indici attesi, con
-- la tabella su cui insistono. Devono comparire 5 righe.
select indexname as indice, tablename as tabella
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_price_history_ingredient','idx_price_history_supplier',
    'idx_stock_lots_supplier','idx_discounts_gifts_entity',
    'idx_reservations_customer'
  )
order by indexname;
