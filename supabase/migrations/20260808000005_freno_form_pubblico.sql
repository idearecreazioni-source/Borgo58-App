-- ---------------------------------------------------------------------
-- Un freno al form pubblico delle prenotazioni (deciso l'08/08/2026)
-- ---------------------------------------------------------------------
-- /prenota e' l'unico punto in cui qualcuno, senza login, scrive nel
-- database. La funzione era gia' fatta bene — valida i campi e impone lei
-- stessa stato e provenienza, il chiamante non puo' forzarli — ma nessun
-- limite di frequenza. Uno script poteva inserire migliaia di richieste, e
-- ognuna fa partire una notifica Telegram ad Alessio.
--
-- Finche' l'indirizzo non e' pubblicizzato e' teorico. Dal giorno che
-- finisce su Instagram, non piu'.
--
-- Tre limiti, scelti per non dare mai fastidio a un ospite vero:
--   1. stesso contatto: 3 richieste nelle ultime 24 ore
--      (una famiglia che ci ripensa due volte resta sotto);
--   2. richiesta identica (stesso contatto, stessa data, stessa ora): mai
--      due volte — e' quasi sempre un doppio invio per errore;
--   3. tetto complessivo: 40 richieste all'ora da form pubblico. Un locale
--      da 20-25 coperti a servizio non ci arriva nemmeno in un giorno di
--      festa; uno script ci arriva in due secondi.
--
-- I messaggi d'errore sono quelli che legge l'ospite: devono essere
-- comprensibili e non colpevolizzanti.
--
-- Idempotente: create or replace.

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
declare
  tel   text := nullif(trim(p_customer_phone), '');
  mail  text := nullif(trim(p_customer_email), '');
  quante integer;
begin
  -- Validazioni gia' esistenti, invariate.
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
  if tel is null and mail is null then
    raise exception 'Serve almeno un contatto (telefono o email)';
  end if;

  -- Limite 3: tetto complessivo, contro l'invio automatico.
  select count(*) into quante
  from reservations
  where source = 'form_pubblico' and created_at > now() - interval '1 hour';

  if quante >= 40 then
    raise exception 'Stiamo ricevendo molte richieste in questo momento. Riprova fra qualche minuto, oppure chiamaci: ti rispondiamo subito.';
  end if;

  -- Limite 1: stesso contatto, ultime 24 ore.
  select count(*) into quante
  from reservations
  where source = 'form_pubblico'
    and created_at > now() - interval '24 hours'
    and (
      (tel is not null and customer_phone = tel) or
      (mail is not null and customer_email = mail)
    );

  if quante >= 3 then
    raise exception 'Abbiamo gia'' ricevuto le tue richieste e le stiamo guardando: ti ricontattiamo noi. Per modificarne una, chiamaci pure.';
  end if;

  -- Limite 2: richiesta identica gia' in attesa.
  select count(*) into quante
  from reservations
  where source = 'form_pubblico'
    and status = 'richiesta_in_attesa'
    and reservation_date = p_reservation_date
    and reservation_time = p_reservation_time
    and (
      (tel is not null and customer_phone = tel) or
      (mail is not null and customer_email = mail)
    );

  if quante > 0 then
    raise exception 'Questa richiesta l''abbiamo gia'' ricevuta: e'' in attesa di conferma, non serve rimandarla.';
  end if;

  insert into reservations (
    type, status, source,
    reservation_date, reservation_time, party_size,
    customer_name, customer_phone, customer_email, notes,
    privacy_consent_at
  ) values (
    'prenotazione', 'richiesta_in_attesa', 'form_pubblico',
    p_reservation_date, p_reservation_time, p_party_size,
    trim(p_customer_name), tel, mail, nullif(trim(p_notes), ''),
    now()
  );
end;
$$;

comment on function submit_public_reservation is
  'Unico punto di ingresso pubblico (ruolo anon) per le richieste dal form del sito. Valida i campi minimi, forza status=richiesta_in_attesa e source=form_pubblico, e dall''08/08/2026 applica tre limiti anti-abuso: 3 richieste per contatto in 24h, nessun doppione identico in attesa, 40 richieste/ora complessive.';

revoke all on function submit_public_reservation(date, time, integer, text, text, text, text) from public;
grant execute on function submit_public_reservation(date, time, integer, text, text, text, text) to anon;

-- ---------------------------------------------------------------------
-- Verifica: si prova ad abusarne davvero
-- ---------------------------------------------------------------------
-- La notifica Telegram viene spenta per il tempo della prova, altrimenti
-- Alessio riceverebbe quattro messaggi di prenotazioni finte. Le righe
-- create vengono cancellate subito dopo.
do $verifica$
declare
  telefono constant text := '+39_prova_freno_form';
  bloccata boolean := false;
  i integer;
begin
  alter table reservations disable trigger trg_notify_reservation_telegram;

  begin
    for i in 1..3 loop
      perform submit_public_reservation(
        current_date + i, '20:00'::time, 2,
        'Prova freno form', telefono, null, null
      );
    end loop;

    -- La quarta deve essere respinta dal limite delle 24 ore.
    begin
      perform submit_public_reservation(
        current_date + 4, '20:00'::time, 2,
        'Prova freno form', telefono, null, null
      );
    exception
      when others then bloccata := true;
    end;

    delete from reservations where customer_phone = telefono;
  exception
    when others then
      delete from reservations where customer_phone = telefono;
      alter table reservations enable trigger trg_notify_reservation_telegram;
      raise;
  end;

  alter table reservations enable trigger trg_notify_reservation_telegram;

  if not bloccata then
    raise exception 'Il freno NON ha bloccato la quarta richiesta dallo stesso contatto: inutile cosi''.';
  end if;

  raise notice 'Verificato: tre richieste passano, la quarta viene respinta. Prenotazioni di prova rimosse e notifica Telegram riattivata.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260808000005', 'freno_form_pubblico')
on conflict (version) do nothing;

-- Riepilogo: nessuna prenotazione di prova rimasta, notifica riattivata.
select
  (select count(*) from reservations where customer_phone like '%prova_freno_form%') as prove_rimaste,
  (select tgenabled from pg_trigger where tgname = 'trg_notify_reservation_telegram') as stato_notifica_telegram;
