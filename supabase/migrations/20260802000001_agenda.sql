-- =====================================================================
-- Borgo 58 · Migrazione 0007 — Agenda & Promemoria (modulo 2, §3.9)
-- =====================================================================
-- Todo list + calendario condiviso con lo staff. Nessuna dipendenza da
-- altri moduli.
--
-- NOTA: le notifiche Telegram per l'Agenda (riuso del canale già costruito
-- per le prenotazioni, §3.9) NON sono in questa migrazione — il trigger
-- giusto (a creazione task? promemoria il giorno prima via cron?) è una
-- scelta di comportamento, non solo tecnica: da confermare con Alessio
-- prima di costruirlo, non assunta qui.
-- =====================================================================

create type task_priority as enum ('alta', 'media', 'bassa');
create type task_status as enum ('da_fare', 'in_corso', 'completato');

create table tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  due_date       date,
  due_time       time,
  priority       task_priority not null default 'media',
  status         task_status not null default 'da_fare',
  category       text,
  -- Modulo che ha generato il task automaticamente (scadenze HACCP/Personale,
  -- promemoria fiscali, richieste di prenotazione, catalogo strumenti, agente
  -- di sintesi). NULL = task manuale. Campo libero: i moduli che lo useranno
  -- non esistono ancora tutti.
  origine_modulo text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table tasks is
  'Agenda condivisa titolare/staff (§3.9). origine_modulo distingue i task creati manualmente da quelli generati automaticamente da altri moduli.';

create index idx_tasks_due_date on tasks(due_date);
create index idx_tasks_status on tasks(status);

create trigger trg_tasks_updated_at before update on tasks
  for each row execute function set_updated_at();

-- RLS: condivisa, non riservata (§3.5) — stesso pattern di reservations:
-- titolare e staff leggono/scrivono, solo il titolare elimina.
alter table tasks enable row level security;
create policy tasks_select_all on tasks for select to authenticated using (true);
create policy tasks_insert_all on tasks for insert to authenticated with check (true);
create policy tasks_update_all on tasks for update to authenticated using (true) with check (true);
create policy tasks_delete_titolare on tasks for delete to authenticated using ((select is_titolare()));
grant select, insert, update, delete on tasks to authenticated;

-- ---------------------------------------------------------------------
-- Adempimenti societari SRLS ricorrenti (§3.9, dettagli/fonti in §6)
-- ---------------------------------------------------------------------
-- Apertura prevista marzo 2027: seed sul primo anno solare intero di
-- attività (2027). Sono scadenze ricorrenti ogni anno — nessun motore di
-- ricorrenza per ora (fuori scope), vanno ricreate manualmente l'anno
-- successivo o gestite quando costruiremo l'agente di sintesi (modulo 14).
insert into tasks (title, description, due_date, priority, category) values
  (
    'Tassa di concessione governativa libri sociali',
    '309,87€/anno — F24 codice tributo 7085.',
    '2027-03-16', 'alta', 'Adempimenti societari'
  ),
  (
    'Diritto camerale',
    '~100-120€ — F24 codice tributo 3850.',
    '2027-06-30', 'alta', 'Adempimenti societari'
  ),
  (
    'Approvazione bilancio',
    'Entro 120 giorni dalla chiusura esercizio (180 se lo statuto lo prevede). Verificare la data esatta di chiusura esercizio con Laura.',
    '2027-04-30', 'alta', 'Adempimenti societari'
  ),
  (
    'Deposito bilancio al Registro Imprese',
    'Entro 30 giorni dall''approvazione del bilancio.',
    '2027-05-30', 'alta', 'Adempimenti societari'
  ),
  (
    'Comunicazione domicilio digitale personale amministratore',
    'Obbligo 2025, distinto dalla PEC aziendale — spesso dimenticato. Nessuna scadenza fissa nota: da completare appena la S.r.l.s. è costituita.',
    null, 'alta', 'Adempimenti societari'
  ),
  (
    'Rinnovo firma digitale',
    'Validità 3 anni dall''emissione. Impostare la data esatta quando si conosce la data di emissione.',
    null, 'media', 'Adempimenti societari'
  ),
  (
    'Titolare effettivo — verificare con Laura/CCIAA',
    'Obbligo sospeso dal 2023, situazione in evoluzione dopo sentenza CGUE 21/05/2026. NON è un adempimento con scadenza certa — non trattarlo come tale finché Laura non conferma lo stato aggiornato.',
    null, 'media', 'Adempimenti societari'
  );
