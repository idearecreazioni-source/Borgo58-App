-- =====================================================================
-- Borgo 58 · Migrazione 0006 — Notifica Telegram via trigger (piano B)
-- =====================================================================
-- Il "Database Webhook" della dashboard Supabase non si crea (schema
-- supabase_functions mancante, incidente 31/07). Piano B più robusto: un
-- trigger nativo che chiama direttamente la Edge Function via pg_net.
--
-- Notifica solo le richieste dal FORM PUBBLICO (source='form_pubblico'):
-- le prenotazioni inserite da Alessio/staff non generano un avviso.
-- =====================================================================

create extension if not exists pg_net;

create or replace function notify_reservation_telegram()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source = 'form_pubblico' then
    perform net.http_post(
      url := 'https://oudjuqbqszisdtwzbxdo.supabase.co/functions/v1/bright-function',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        -- Chiave anon PUBBLICA (già presente nel frontend, non è un segreto):
        -- serve solo a superare la verifica JWT della Edge Function.
        'Authorization',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91ZGp1cWJxc3ppc2R0d3pieGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NDA0MDIsImV4cCI6MjEwMTAxNjQwMn0.Aejkq4VmZdbxw5TbhKmmdg64fvd48BjxapGxKyAjWB4'
      ),
      -- La Edge Function legge payload.record — stesso formato del webhook.
      body := jsonb_build_object('record', to_jsonb(new))
    );
  end if;
  return new;
end;
$$;

comment on function notify_reservation_telegram is
  'Chiama la Edge Function di notifica Telegram a ogni nuova richiesta dal form pubblico. Sostituisce il Database Webhook (non creabile per lo schema supabase_functions mancante).';

drop trigger if exists trg_notify_reservation_telegram on reservations;
create trigger trg_notify_reservation_telegram
  after insert on reservations
  for each row execute function notify_reservation_telegram();
