-- 25/11/2026 — Revisione dell'11/11, punto 15: il modulo pubblico delle prenotazioni non ha limiti di lunghezza né di data.
--
-- Cosa succedeva: nome, telefono, email e note si accettavano di qualunque lunghezza (un testo lunghissimo faceva perdere
-- l'avviso su Telegram, che ha un tetto di caratteri), e la data poteva essere fra dieci anni (una richiesta così resta
-- in attesa per sempre). Il freno «40 richieste all'ora» e quello per contatto restano com'erano.
-- Cura, dentro `submit_public_reservation` (si cambia il corpo VIVO in un punto solo, controllato):
--   - nome al massimo 100 caratteri, telefono 30, email 200, note 1.000;
--   - data al massimo 12 mesi da oggi (data locale di Roma).
-- Non si cambia nessun'altra regola. Il freno per indirizzo di rete NON sta nel database (la funzione non vede l'indirizzo):
-- si mette davanti, in Cloudflare (regola di limitazione sulla pagina /prenota): resta un gesto da fare a mano.

do $limiti$
declare
  v_def    text;
  v_n      integer;
  v_vecchio constant text := 'if p_customer_name is null or length(trim(p_customer_name)) = 0 then';
  v_nuovo   constant text :=
'if length(coalesce(p_customer_name, '''')) > 100 then
    raise exception ''Il nome è troppo lungo (al massimo 100 caratteri).'';
  end if;
  if length(coalesce(p_customer_phone, '''')) > 30 then
    raise exception ''Il telefono è troppo lungo (al massimo 30 caratteri).'';
  end if;
  if length(coalesce(p_customer_email, '''')) > 200 then
    raise exception ''L''''email è troppo lunga (al massimo 200 caratteri).'';
  end if;
  if length(coalesce(p_notes, '''')) > 1000 then
    raise exception ''Le note sono troppo lunghe (al massimo 1.000 caratteri).'';
  end if;
  if p_reservation_date is not null
     and p_reservation_date > ((now() at time zone ''Europe/Rome'')::date + interval ''12 months'')::date then
    raise exception ''Data non valida'';
  end if;
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then';
begin
  perform set_config('request.jwt.claims', null, true);
  v_def := replace(pg_get_functiondef('public.submit_public_reservation(date, time without time zone, integer, text, text, text, text)'::regprocedure), E'\r', '');
  if v_def like '%Il nome è troppo lungo%' then return; end if;
  v_n := (length(v_def) - length(replace(v_def, v_vecchio, ''))) / length(v_vecchio);
  if v_n <> 1 then
    raise exception 'submit_public_reservation non ha una sola riga del nome (ne ha %): confronta il corpo vivo prima di applicare.', v_n;
  end if;
  execute replace(v_def, v_vecchio, v_nuovo);
end $limiti$;

-- ---------------------------------------------------------------------
-- VERIFICA (nessuna scrittura: si provano solo i rifiuti)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
  v_msg  text;
begin
  perform set_config('request.jwt.claims', null, true);

  -- (1) nome troppo lungo
  begin
    perform submit_public_reservation(v_oggi + 3, time '20:00', 2, repeat('x', 101), '3331112222', null, null);
    raise exception 'VERIFICA (1): un nome di 101 caratteri è passato.';
  exception when raise_exception then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%nome è troppo lungo%' then raise; end if;
  end;

  -- (2) note troppo lunghe
  begin
    perform submit_public_reservation(v_oggi + 3, time '20:00', 2, 'ZZ Verifica', '3331112222', null, repeat('n', 1001));
    raise exception 'VERIFICA (2): note di 1001 caratteri sono passate.';
  exception when raise_exception then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%note sono troppo lunghe%' then raise; end if;
  end;

  -- (3) email troppo lunga e telefono troppo lungo
  begin
    perform submit_public_reservation(v_oggi + 3, time '20:00', 2, 'ZZ Verifica', null, repeat('e', 201), null);
    raise exception 'VERIFICA (3a): una email di 201 caratteri è passata.';
  exception when raise_exception then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%email è troppo lunga%' then raise; end if;
  end;
  begin
    perform submit_public_reservation(v_oggi + 3, time '20:00', 2, 'ZZ Verifica', repeat('3', 31), null, null);
    raise exception 'VERIFICA (3b): un telefono di 31 caratteri è passato.';
  exception when raise_exception then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%telefono è troppo lungo%' then raise; end if;
  end;

  -- (4) data oltre i 12 mesi
  begin
    perform submit_public_reservation(v_oggi + 400, time '20:00', 2, 'ZZ Verifica', '3331112222', null, null);
    raise exception 'VERIFICA (4): una data fra 400 giorni è passata.';
  exception when raise_exception then
    get stacked diagnostics v_msg = message_text;
    if v_msg not like '%Data non valida%' then raise; end if;
  end;

  if exists (select 1 from reservations where customer_name = 'ZZ Verifica') then
    raise exception 'VERIFICA (5): è stata scritta una prenotazione di verifica.';
  end if;
  raise notice 'Fatto: il modulo pubblico rifiuta nome/telefono/email/note troppo lunghi e date oltre i 12 mesi. Provato: nessuna scrittura.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20261125000005', 'il_modulo_pubblico_ha_dei_limiti')
on conflict (version) do nothing;
