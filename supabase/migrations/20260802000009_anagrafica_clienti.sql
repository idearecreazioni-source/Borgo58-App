-- =====================================================================
-- Borgo 58 · Migrazione 0015 — Anagrafica Clienti (§3.14)
-- =====================================================================
-- Non un modulo a sé, come l'Anagrafica Fornitori (§3.11): un'anagrafica
-- condivisa tra Calendario Eventi (modulo 6, già costruita) e Cassa
-- (modulo 5, non ancora costruito). Sconti/omaggi ricevuti (§3.4) restano
-- vuoti finché Cassa non esiste — nessun dato inventato.
--
-- Identificazione per numero di telefono normalizzato (non le generalità,
-- §3.14): il collegamento reservations → customers è automatico, via
-- trigger, non richiede toccare il form di prenotazione né il punto di
-- ingresso pubblico (submit_public_reservation) — entrambi continuano a
-- scrivere customer_name/customer_phone come sempre, il trigger fa il resto.
--
-- Nota GDPR (§3.14): il diritto all'oblio va supportabile da subito anche
-- se non costruiamo ora un intero sistema di consenso — reservations.
-- customer_id è ON DELETE SET NULL, non CASCADE: cancellare un cliente
-- rimuove il collegamento identificativo ma non la prenotazione operativa
-- (che il locale può aver bisogno di conservare per motivi gestionali).
-- =====================================================================

create table customers (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null unique,
  name        text,
  email       text,
  notes       text,           -- preferenze, allergie dichiarate, occasioni speciali (§3.14)
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint phone_looks_valid check (phone ~ '^\+?[0-9]+$')
);
comment on table customers is
  'Anagrafica clienti condivisa (§3.14). Chiave di identificazione: numero di telefono normalizzato, non le generalità.';

create trigger trg_customers_updated_at before update on customers
  for each row execute function set_updated_at();

-- Normalizzazione minima: toglie spazi/trattini/parentesi/punti, mantiene
-- solo cifre e un eventuale + iniziale. Non un validatore E.164 completo —
-- basta a rendere confrontabili numeri scritti in modo diverso.
create or replace function normalize_phone(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(trim(p_phone), '[^0-9+]', '', 'g'), '');
$$;

-- ---------------------------------------------------------------------
-- Collegamento automatico: reservations → customers
-- ---------------------------------------------------------------------
alter table reservations add column customer_id uuid references customers(id) on delete set null;

create or replace function link_reservation_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_phone text;
begin
  v_phone := normalize_phone(new.customer_phone);
  if v_phone is null then
    return new;
  end if;

  select id into v_customer_id from customers where phone = v_phone;

  if v_customer_id is null then
    insert into customers (phone, name)
    values (v_phone, new.customer_name)
    returning id into v_customer_id;
  end if;

  new.customer_id := v_customer_id;
  return new;
end;
$$;

-- SECURITY DEFINER: deve funzionare anche quando la riga arriva dal form
-- pubblico (submit_public_reservation, ruolo anon, che non ha alcun
-- permesso diretto su customers).
create trigger trg_link_reservation_customer
  before insert or update of customer_phone on reservations
  for each row execute function link_reservation_customer();

-- ---------------------------------------------------------------------
-- Statistiche derivate — nessuna AI, solo aggregazioni (§3.8/§3.14)
-- ---------------------------------------------------------------------
-- "spesa media" e "sconti/omaggi ricevuti" restano fuori: senza Cassa (modulo
-- 5) non esiste alcun dato economico da cui calcolarli onestamente.
create view v_customer_stats
with (security_invoker = true) as
select
  c.id as customer_id,
  count(r.id) as reservation_count,
  max(r.reservation_date) as last_reservation_date,
  min(r.reservation_date) as first_reservation_date
from customers c
left join reservations r on r.customer_id = c.id and r.status <> 'annullata'
group by c.id;
grant select on v_customer_stats to authenticated;

-- ---------------------------------------------------------------------
-- RLS — condivisa con lo staff (stesso accesso "vista operativa" del
-- Calendario Eventi, §4 modulo 6): nessun dato economico qui finché Cassa
-- non esiste. Cancellazione/unione riservate al titolare (azioni
-- amministrative, rischio di errore sui dati di più clienti).
-- ---------------------------------------------------------------------
alter table customers enable row level security;
create policy customers_select_all on customers for select to authenticated using (true);
create policy customers_insert_all on customers for insert to authenticated with check (true);
create policy customers_update_all on customers for update to authenticated using (true) with check (true);
create policy customers_delete_titolare on customers for delete to authenticated using ((select is_titolare()));
grant select, insert, update, delete on customers to authenticated;

-- ---------------------------------------------------------------------
-- Strumento di unione schede (§3.14) — solo titolare
-- ---------------------------------------------------------------------
create or replace function merge_customers(p_keep_id uuid, p_merge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può unire due schede cliente';
  end if;
  if p_keep_id = p_merge_id then
    raise exception 'Le due schede da unire devono essere diverse';
  end if;

  update reservations set customer_id = p_keep_id where customer_id = p_merge_id;
  delete from customers where id = p_merge_id;
end;
$$;
grant execute on function merge_customers(uuid, uuid) to authenticated;
