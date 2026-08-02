-- =====================================================================
-- Borgo 58 · Migrazione 0016 — Esportabilità PDF trasversale (§3.15)
-- =====================================================================
-- Nessuna nuova tabella: l'export PDF è realizzato lato frontend (vista di
-- stampa + dialogo "Salva come PDF" del browser, niente libreria PDF).
-- L'unica cosa da sistemare qui è una vista rimasta indietro.
--
-- stock_lots_display (migrazione 0012, Magazzino) è stata creata PRIMA che
-- la migrazione HACCP (0013) aggiungesse supplier_batch_number a stock_lots:
-- una vista con elenco colonne esplicito non eredita le colonne aggiunte
-- dopo alla tabella sottostante. Senza questa correzione, la tracciabilità
-- lotti (§3.15/§3.16) sarebbe incompleta per lo staff (che passa sempre
-- dalla vista display, mai dalla tabella base). Aggiunto anche il nome
-- dell'ingrediente (mai esposto finora dalla vista): una lista di lotti
-- senza sapere di quale ingrediente si tratta non è una tracciabilità
-- utilizzabile.
--
-- Le colonne originali restano nello stesso ordine/nome: CREATE OR REPLACE
-- VIEW in Postgres permette solo di aggiungere colonne in coda, mai di
-- spostarle o inserirle in mezzo (l'errore "cannot change name of view
-- column" arriva proprio da questo — imparato provandolo).
create or replace view stock_lots_display as
select
  sl.id, sl.ingredient_id, sl.supplier_id, s.name as supplier_name,
  sl.quantity_received, sl.quantity_remaining, sl.expiry_date, sl.received_at, sl.note,
  i.name as ingredient_name, i.unit, sl.supplier_batch_number
from stock_lots sl
left join ingredients i on i.id = sl.ingredient_id
left join suppliers s on s.id = sl.supplier_id;
