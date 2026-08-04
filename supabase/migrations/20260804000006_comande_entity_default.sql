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
-- spostando la scelta nel database, con un trigger — non un DEFAULT
-- diretto: Postgres non ammette una subquery in un'espressione DEFAULT
-- (`ERROR 0A000: cannot use subquery in DEFAULT expression`, trovato
-- provando ad applicare questa migrazione la prima volta).
-- =====================================================================
create or replace function set_order_entity_srls()
returns trigger
language plpgsql
as $$
begin
  if new.entity_id is null then
    select id into new.entity_id from entities where entity_type = 'srls';
  end if;
  return new;
end;
$$;

create trigger trg_order_entity_srls
  before insert on orders
  for each row execute function set_order_entity_srls();

comment on column orders.entity_id is
  'Sempre la S.r.l.s. (le comande non riguardano l''azienda agricola) — valorizzato dal trigger trg_order_entity_srls, mai passato dal client: lo staff non ha (né deve avere) accesso alla tabella entities.';
