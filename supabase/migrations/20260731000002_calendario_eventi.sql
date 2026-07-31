-- =====================================================================
-- Borgo 58 · Migrazione 0003 — Calendario Eventi & Prenotazioni (modulo 5)
-- =====================================================================
-- Fonte: APP_Borgo58_Brief_Tecnico_v2_1.md §3.3, §4 (modulo 5)
--
-- Solo la parte "gestione interna" in questa migrazione (prenotazioni ed
-- eventi creati/gestiti da Alessio). Il form pubblico (§3.3) e le relative
-- policy per l'utente anonimo arriveranno in una migrazione successiva,
-- insieme alla scelta del canale di notifica.
--
-- "Giovedì della Terra" e "Green Card" non sono ancora definiti (da
-- specificare più avanti) — nessuna tabella/campo dedicato per ora.
-- =====================================================================

create type reservation_type as enum ('prenotazione', 'evento');
create type reservation_status as enum (
  'richiesta_in_attesa', 'confermata', 'rifiutata', 'annullata'
);
create type reservation_source as enum ('interno', 'form_pubblico');

create table reservations (
  id                   uuid primary key default gen_random_uuid(),
  type                 reservation_type not null default 'prenotazione',
  status               reservation_status not null default 'confermata',
  source               reservation_source not null default 'interno',

  reservation_date     date not null,
  reservation_time     time not null,
  party_size           integer not null check (party_size > 0),

  customer_name        text not null,
  customer_phone       text,
  customer_email       text,
  notes                text,  -- allergie, occasione speciale, richieste

  -- Solo per type = 'evento'
  event_type           text,             -- es. "compleanno", "aziendale", "cerimonia"
  event_menu_id        uuid references menus(id) on delete set null,
  deposit_amount       numeric(12,2),    -- caparra, opzionale

  privacy_consent_at   timestamptz,      -- valorizzato dal form pubblico (§3.3)

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table reservations is
  'Prenotazioni tavolo ed eventi. Le richieste dal form pubblico (fase successiva) arrivano con status=richiesta_in_attesa e source=form_pubblico; le prenotazioni inserite da Alessio via telefono/di persona sono confermate subito.';
comment on column reservations.event_menu_id is
  'Menu dedicato scelto per un evento — usato dal simulatore fabbisogno ingredienti per scalare le quantità sul numero di ospiti.';

create index idx_reservations_date on reservations(reservation_date);
create index idx_reservations_status on reservations(status);

create trigger trg_reservations_updated_at before update on reservations
  for each row execute function set_updated_at();

alter table reservations enable row level security;
create policy reservations_authenticated_all on reservations
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on reservations to authenticated;
