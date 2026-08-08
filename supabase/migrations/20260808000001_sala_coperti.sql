-- ---------------------------------------------------------------------
-- Coperti al tavolo e prezzo del coperto (§3.2.1)
-- ---------------------------------------------------------------------
-- Dal simulatore provato con Alessio: il contatore coperti mancava del
-- tutto nel disegno originale delle comande. Serve sia per il preconto
-- (che deve mostrare quante persone sono al tavolo) sia per il conto,
-- perché da Borgo 58 il coperto si paga — 5,00 € a persona, deciso
-- l'08/08/2026.
--
-- Il prezzo NON sta nel codice: sta in service_settings, così cambiarlo
-- non richiede una modifica al software. Sull'ordine si salva invece il
-- prezzo applicato al momento della chiusura (coperto_unit_price), con
-- lo stesso principio di order_items.unit_price: un conto chiuso ieri
-- non deve cambiare importo perché oggi il coperto è aumentato.
--
-- Idempotente (§7 punto 3): rieseguibile senza danni.

-- ---------------------------------------------------------------------
-- 1. Coperti sull'ordine
-- ---------------------------------------------------------------------
alter table orders add column if not exists coperti integer not null default 0;
alter table orders add column if not exists coperto_unit_price numeric(12,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_coperti_non_negativi') then
    alter table orders add constraint orders_coperti_non_negativi check (coperti >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_coperto_prezzo_non_negativo') then
    alter table orders add constraint orders_coperto_prezzo_non_negativo check (coperto_unit_price >= 0);
  end if;
end $$;

comment on column orders.coperti is
  'Numero di persone al tavolo (§3.2.1). Modificabile in qualunque momento, non solo all''apertura: i coperti che si aggiungono a tavolo gia'' aperto sono uno dei casi limite di sala gia'' risolti.';
comment on column orders.coperto_unit_price is
  'Prezzo del coperto applicato a QUESTO conto, fotografato alla chiusura. Nullo finche'' il conto e'' aperto: si legge service_settings. Stesso principio di order_items.unit_price — cambiare il listino non riscrive i conti gia'' chiusi.';

-- ---------------------------------------------------------------------
-- 2. Impostazioni di sala (una riga sola)
-- ---------------------------------------------------------------------
-- Tabella a riga unica: id vincolato a 1, cosi' non e' possibile
-- ritrovarsi con due configurazioni in disaccordo.
create table if not exists service_settings (
  id            smallint primary key default 1 check (id = 1),
  coperto_price numeric(12,2) not null default 5.00 check (coperto_price >= 0),
  updated_at    timestamptz not null default now()
);
comment on table service_settings is
  'Impostazioni del servizio di sala (§3.2.1). Una riga sola. Oggi contiene il prezzo del coperto; e'' il posto dove finiranno le altre regole di sala quando saranno decise.';

insert into service_settings (id, coperto_price) values (1, 5.00)
on conflict (id) do nothing;

drop trigger if exists trg_service_settings_updated_at on service_settings;
create trigger trg_service_settings_updated_at before update on service_settings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- 3. RLS — lo staff DEVE poter leggere il prezzo, solo il titolare lo cambia
-- ---------------------------------------------------------------------
-- Senza select aperto in lettura la sala non potrebbe calcolare il conto.
-- La restrizione va replicata su ogni operazione, non solo su select
-- (§3.18): in Postgres sono policy indipendenti.
alter table service_settings enable row level security;

drop policy if exists service_settings_select_all on service_settings;
create policy service_settings_select_all on service_settings
  for select to authenticated using (true);

drop policy if exists service_settings_update_titolare on service_settings;
create policy service_settings_update_titolare on service_settings
  for update to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

drop policy if exists service_settings_insert_titolare on service_settings;
create policy service_settings_insert_titolare on service_settings
  for insert to authenticated with check ((select is_titolare()));

drop policy if exists service_settings_delete_titolare on service_settings;
create policy service_settings_delete_titolare on service_settings
  for delete to authenticated using ((select is_titolare()));

grant select, insert, update, delete on service_settings to authenticated;

-- ---------------------------------------------------------------------
-- 4. Verifica — solleva eccezione se la migrazione non ha fatto quello
--    che dichiara (§7 punto 3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  prezzo numeric;
  policy_count integer;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'coperti'
  ) then
    raise exception 'orders.coperti non esiste: la migrazione non ha fatto quello che dichiara.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'coperto_unit_price'
  ) then
    raise exception 'orders.coperto_unit_price non esiste: la migrazione non ha fatto quello che dichiara.';
  end if;

  select coperto_price into prezzo from service_settings where id = 1;
  if prezzo is null then
    raise exception 'La riga unica di service_settings non e'' stata creata: la sala non saprebbe quanto costa il coperto.';
  end if;

  select count(*) into policy_count from pg_policies
  where schemaname = 'public' and tablename = 'service_settings';
  if policy_count < 4 then
    raise exception 'service_settings ha solo % policy: servono select/insert/update/delete, altrimenti la restrizione al titolare e'' incompleta (§3.18).', policy_count;
  end if;

  raise notice 'Coperti attivi sui conti. Prezzo del coperto: % euro. Policy su service_settings: %.', prezzo, policy_count;
end $verifica$;

insert into applied_migrations (version, name)
values ('20260808000001', 'sala_coperti')
on conflict (version) do nothing;

-- Riepilogo visibile nel pannello dei risultati: deve mostrare una riga
-- con il prezzo del coperto e le due nuove colonne di orders.
select
  (select coperto_price from service_settings where id = 1)                    as prezzo_coperto,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name in ('coperti', 'coperto_unit_price'))                    as colonne_aggiunte,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'service_settings')            as policy_service_settings;
