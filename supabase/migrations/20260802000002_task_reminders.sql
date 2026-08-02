-- =====================================================================
-- Borgo 58 · Migrazione 0008 — Promemoria Agenda su Telegram (§3.9)
-- =====================================================================
-- Niente regola fissa (né "a creazione", né "il giorno prima"): Alessio
-- sceglie liberamente data/ora del promemoria per ogni task, indipendente
-- dalla data di scadenza. Un job pg_cron ogni 5 minuti controlla i
-- promemoria scaduti e chiama la Edge Function Telegram già esistente
-- (bright-function), estesa per gestire anche questo tipo di notifica —
-- stesso motore, non un secondo sistema (coerente col principio del brief).
-- =====================================================================

alter table tasks add column remind_at timestamptz;
alter table tasks add column reminder_sent_at timestamptz;
comment on column tasks.remind_at is
  'Data/ora scelta liberamente dall''utente per il promemoria Telegram. NULL = nessun promemoria per questo task.';

create extension if not exists pg_cron;

create or replace function send_due_task_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select * from tasks
    where remind_at is not null
      and remind_at <= now()
      and reminder_sent_at is null
      and status <> 'completato'
  loop
    perform net.http_post(
      url := 'https://oudjuqbqszisdtwzbxdo.supabase.co/functions/v1/bright-function',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91ZGp1cWJxc3ppc2R0d3pieGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NDA0MDIsImV4cCI6MjEwMTAxNjQwMn0.Aejkq4VmZdbxw5TbhKmmdg64fvd48BjxapGxKyAjWB4'
      ),
      body := jsonb_build_object('type', 'task_reminder', 'task', to_jsonb(r))
    );

    update tasks set reminder_sent_at = now() where id = r.id;
  end loop;
end;
$$;

comment on function send_due_task_reminders is
  'Chiamata da pg_cron ogni 5 minuti. Invia via Telegram i promemoria dei task il cui remind_at è passato e non ancora notificati.';

select cron.schedule(
  'send-due-task-reminders',
  '*/5 * * * *',
  $$select send_due_task_reminders();$$
);
