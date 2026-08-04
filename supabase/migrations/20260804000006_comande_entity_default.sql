-- =====================================================================
-- Borgo 58 · Migrazione 0031 — Fix: creazione tavolo falliva per lo staff
-- =====================================================================
-- Trovato verificando dal vivo con login staff: OrdersList chiedeva
-- l'entity_id della S.r.l.s. chiamando getEntities(), che legge la
-- tabella `entities` — titolare-only (contiene P.IVA e codice fiscale,
-- giustamente riservata, non va aperta come suppliers/menu_items).
--
-- La causa non era un permesso mancante da concedere: le comande
-- riguardano SEMPRE la S.r.l.s. (l'azienda agricola non serve ai tavoli),
-- quindi il client non ha alcun bisogno di conoscere quell'id. Risolto
-- spostando la scelta nel database: un default che risolve da solo
-- l'entità S.r.l.s. alla riga inserita, senza che orders.entity_id debba
-- mai essere passato dal client.
-- =====================================================================
alter table orders alter column entity_id set default (
  select id from entities where entity_type = 'srls'
);

comment on column orders.entity_id is
  'Sempre la S.r.l.s. (le comande non riguardano l''azienda agricola) — valorizzato dal default DB, mai passato dal client: lo staff non ha (né deve avere) accesso alla tabella entities.';
