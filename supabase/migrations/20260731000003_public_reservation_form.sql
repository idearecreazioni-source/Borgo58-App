-- =====================================================================
-- Borgo 58 · Migrazione 0004 — Form pubblico di prenotazione (§3.3)
-- =====================================================================
-- Il cliente compila un form sul sito SENZA login. Invece di aprire
-- l'inserimento diretto nella tabella reservations al ruolo anon (che
-- richiederebbe una policy RLS INSERT su tutta la tabella, con rischio di
-- payload arbitrari), esponiamo una funzione SECURITY DEFINER stretta:
-- valida i campi minimi e forza sempre status='richiesta_in_attesa' e
-- source='form_pubblico', a prescindere da cosa mandi il client.
--
-- Il ruolo anon NON ha (e non deve avere) alcun grant diretto su
-- reservations: né SELECT, né INSERT. L'unico varco è questa funzione.
-- =====================================================================

create or replace function submit_public_reservation(
  p_reservation_date date,
  p_reservation_time time,
  p_party_size integer,
  p_customer_name text,
  p_customer_phone text default null,
  p_customer_email text default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_party_size is null or p_party_size < 1 or p_party_size > 200 then
    raise exception 'Numero di coperti non valido';
  end if;
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'Nome obbligatorio';
  end if;
  if p_reservation_date is null or p_reservation_date < current_date then
    raise exception 'Data non valida';
  end if;
  if p_reservation_time is null then
    raise exception 'Orario obbligatorio';
  end if;
  if p_customer_phone is null and p_customer_email is null then
    raise exception 'Serve almeno un contatto (telefono o email)';
  end if;

  insert into reservations (
    type, status, source,
    reservation_date, reservation_time, party_size,
    customer_name, customer_phone, customer_email, notes,
    privacy_consent_at
  ) values (
    'prenotazione', 'richiesta_in_attesa', 'form_pubblico',
    p_reservation_date, p_reservation_time, p_party_size,
    trim(p_customer_name), nullif(trim(p_customer_phone), ''),
    nullif(trim(p_customer_email), ''), nullif(trim(p_notes), ''),
    now()
  );
end;
$$;

comment on function submit_public_reservation is
  'Unico punto di ingresso pubblico (ruolo anon) per le richieste di prenotazione dal form del sito. Valida i campi minimi e forza sempre status=richiesta_in_attesa, source=form_pubblico — il chiamante non può impostare altri valori.';

-- Nessun grant sulla tabella: solo esecuzione della funzione.
revoke all on function submit_public_reservation(date, time, integer, text, text, text, text) from public;
grant execute on function submit_public_reservation(date, time, integer, text, text, text, text) to anon;
