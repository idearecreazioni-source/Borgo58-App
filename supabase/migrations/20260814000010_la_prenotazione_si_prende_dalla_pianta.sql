-- ---------------------------------------------------------------------
-- La prenotazione si prende guardando la sala
-- ---------------------------------------------------------------------
-- Chiesto da Alessio il 14/08, provando la pianta: *«al momento la
-- prenotazione non si prende guardando la piantina e non va bene. come
-- faccio a sapere se c'è posto così?»*.
--
-- Aveva ragione, e il pezzo mancante era uno solo. Assegnare una
-- prenotazione toccando i tavoli c'era già (§5 del mandato); quello che
-- non c'era è **prendere una prenotazione nuova da lì**. Al telefono si
-- guarda la sala, si vede dove c'è spazio, se serve si accostano due
-- tavoli, e si scrive il nome. Uscire dalla pianta, aprire un modulo e
-- tornare indietro a cercare dove metterli è il modo per non farlo.
--
-- ⚠️ NASCE GIÀ CONFERMATA, E SENZA EMAIL. Decisione di Alessio: al
-- telefono la conferma gliel'ha appena data a voce, e un'email che
-- ripete la stessa cosa è rumore. Non serve nessun interruttore per
-- ottenerlo — basta *non* passare da un cambio di stato: il trigger
-- dell'email dell'11/08 parte su un `update` che porta a `confermata`,
-- mai su un `insert`. La verifica qui sotto lo controlla invece di darlo
-- per scontato.
--
-- ⚠️ E SENZA AVVISO SU TELEGRAM, per lo stesso motivo di sempre: il
-- trigger delle notifiche guarda `source = 'form_pubblico'`, e questa
-- nasce `interno`. Avvisare Alessio di una prenotazione che ha appena
-- preso lui è il tipo di rumore che insegna a ignorare gli avvisi veri.
--
-- Scrive su `reservations` **e** su N righe di `prenotazione_tavoli`:
-- due tabelle, quindi **B4 senza eccezioni** — corridoio, e dentro una
-- sola funzione Postgres. Se la prenotazione nascesse e i tavoli no,
-- resterebbe una prenotazione confermata che non dice dove far sedere
-- nessuno, e nessuno se ne accorgerebbe fino alla sera.
--
-- Idempotente (§7 punto 3).

create or replace function crea_prenotazione_su_tavoli(
  p_data              date,
  p_ora               time,
  p_persone           integer,
  p_nome              text,
  p_tavoli            uuid[],
  p_telefono          text default null,
  p_email             text default null,
  p_note              text default null,
  p_rischio_accettato boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id        uuid;
  v_etichette text[];
  n_mancanti  integer;
begin
  -- Prendere una prenotazione è lavoro di sala, non solo del titolare:
  -- il controllo è che ci sia un utente vero. Non allarga i permessi
  -- rispetto all'inserimento diretto che il gestionale già consente.
  if auth.uid() is null then
    raise exception 'Operazione consentita solo a un utente autenticato';
  end if;

  if p_nome is null or length(trim(p_nome)) = 0 then
    raise exception 'Serve il nome di chi prenota.';
  end if;
  if p_persone is null or p_persone < 1 or p_persone > 200 then
    raise exception 'Numero di persone non valido.';
  end if;
  if p_ora is null then
    raise exception 'Serve l''ora di arrivo.';
  end if;
  -- Data locale, non UTC: fino alle 02:00 `current_date` è ancora ieri, e
  -- una prenotazione presa all'una di notte per la sera stessa verrebbe
  -- rifiutata come «data passata» (§8).
  if p_data is null or p_data < (now() at time zone 'Europe/Rome')::date then
    raise exception 'Quella data è già passata.';
  end if;

  if p_tavoli is null or array_length(p_tavoli, 1) is null then
    raise exception 'Tocca sulla pianta i tavoli dove li fai sedere.';
  end if;

  select count(*) into n_mancanti
  from unnest(p_tavoli) as t(id)
  where not exists (select 1 from dining_tables d where d.id = t.id and d.active);
  if n_mancanti > 0 then
    raise exception 'Uno dei tavoli scelti non esiste più in sala.';
  end if;

  -- ⚠️ `status = 'confermata'` su un INSERT: nessun cambio di stato,
  -- quindi nessuna email. Vedi la nota in testa.
  -- `privacy_consent_at` resta vuoto di proposito: al telefono nessuno ha
  -- spuntato niente, e segnare un consenso che non c'è stato sarebbe
  -- peggio di non averlo.
  insert into reservations (
    type, status, source,
    reservation_date, reservation_time, party_size,
    customer_name, customer_phone, customer_email, notes
  ) values (
    'prenotazione', 'confermata', 'interno',
    p_data, p_ora, p_persone,
    trim(p_nome),
    nullif(trim(coalesce(p_telefono, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_id;

  -- L'etichetta si fotografa adesso: se fra sei mesi la sala viene
  -- rinumerata, questa prenotazione continua a dire dov'erano seduti.
  insert into prenotazione_tavoli (reservation_id, dining_table_id, etichetta_al_momento, rischio_accettato)
  select v_id, d.id, d.label, coalesce(p_rischio_accettato, false)
  from dining_tables d
  where d.id = any(p_tavoli);

  select array_agg(etichetta_al_momento order by etichetta_al_momento)
    into v_etichette
  from prenotazione_tavoli where reservation_id = v_id;

  return jsonb_build_object(
    'reservation_id', v_id,
    'tavoli',         array_length(v_etichette, 1),
    'etichette',      to_jsonb(v_etichette)
  );
end;
$$;

comment on function crea_prenotazione_su_tavoli is
  'Prende una prenotazione dalla pianta della sala: nasce confermata, sui tavoli toccati, senza email e senza avviso. B4: prenotazione + righe di collegamento, una transazione.';

revoke all on function crea_prenotazione_su_tavoli(date, time, integer, text, uuid[], text, text, text, boolean)
  from public, anon, authenticated;
grant execute on function crea_prenotazione_su_tavoli(date, time, integer, text, uuid[], text, text, text, boolean)
  to authenticated;

-- ---------------------------------------------------------------------
-- Verifica (§7 punti 1-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  v_t        uuid[];
  v_out      jsonb;
  v_id       uuid;
  v_id2      uuid;
  v_data     date := (now() at time zone 'Europe/Rome')::date + 300;
  v_msg      text;
  respinto   boolean;
  n          integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  select user_id into v_staff    from user_roles where role = 'staff'    limit 1;
  if v_titolare is null or v_staff is null then
    raise exception 'Servono un titolare e uno staff per questa verifica.';
  end if;

  select array_agg(id order by position) into v_t
  from dining_tables where active and tipo = 'tavolo' limit 1;
  select array_agg(id) into v_t from (
    select id from dining_tables where active and tipo = 'tavolo' order by position limit 2
  ) q;

  -- La prende lo STAFF: al telefono può rispondere chiunque sia in sala.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

  v_out := crea_prenotazione_su_tavoli(
    v_data, '20:30', 6, '  PROVA TELEFONO  ', v_t, ' 3990000001 ', null, null, false);
  v_id := (v_out->>'reservation_id')::uuid;

  if (v_out->>'tavoli')::integer <> 2 then
    raise exception 'La prenotazione risulta su % tavoli invece di 2.', v_out->>'tavoli';
  end if;
  if (select status from reservations where id = v_id) <> 'confermata' then
    raise exception 'Una prenotazione presa al telefono non nasce confermata.';
  end if;
  if (select source from reservations where id = v_id) <> 'interno' then
    raise exception 'La prenotazione non risulta interna: farebbe scattare l''avviso su Telegram.';
  end if;
  -- Gli spazi in testa e in coda non devono finire nel nome del cliente.
  if (select customer_name from reservations where id = v_id) <> 'PROVA TELEFONO' then
    raise exception 'Il nome è stato salvato con gli spazi: "%".', (select customer_name from reservations where id = v_id);
  end if;
  if (select customer_phone from reservations where id = v_id) <> '3990000001' then
    raise exception 'Il telefono non è stato ripulito.';
  end if;

  -- ⚠️ NESSUNA EMAIL. È la decisione di Alessio, e si controlla invece di
  -- darla per scontata: il trigger dell'11/08 parte su un cambio di
  -- stato, e qui non ce n'è nessuno.
  select count(*) into n from email_inviate where reservation_id = v_id;
  if n <> 0 then
    raise exception 'Prendendo la prenotazione al telefono è partita un''email al cliente (% invii).', n;
  end if;

  -- L'etichetta è fotografata: rinominando il tavolo, la prenotazione
  -- continua a dire dov'erano seduti.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  declare
    v_vecchia text;
  begin
    select label into v_vecchia from dining_tables where id = v_t[1];
    update dining_tables set label = 'PROVA RINOMINA' where id = v_t[1];
    if (select etichetta_al_momento from prenotazione_tavoli
         where reservation_id = v_id and dining_table_id = v_t[1]) <> v_vecchia then
      raise exception 'Rinominando il tavolo è cambiata l''etichetta della prenotazione.';
    end if;
    update dining_tables set label = v_vecchia where id = v_t[1];
  end;

  -- Il secondo giro: stesso tavolo, altra ora, ammesso col rischio scritto.
  v_out := crea_prenotazione_su_tavoli(
    v_data, '22:15', 2, 'PROVA TELEFONO 2', array[v_t[1]], null, null, null, true);
  v_id2 := (v_out->>'reservation_id')::uuid;
  if not (select rischio_accettato from prenotazione_tavoli
           where reservation_id = v_id2 and dining_table_id = v_t[1]) then
    raise exception 'Il secondo giro non ha registrato il rischio accettato.';
  end if;

  -- Cambiare i tavoli a una prenotazione già presa: è `assegna_prenotazione`,
  -- che c'era già. Qui si controlla che le due funzioni parlino la stessa
  -- lingua — sostituire l'insieme, non sommarlo.
  v_out := assegna_prenotazione(v_id, array[v_t[2]], false, true);
  select count(*) into n from prenotazione_tavoli where reservation_id = v_id;
  if n <> 1 then
    raise exception 'Dopo lo spostamento la prenotazione risulta su % tavoli invece di 1.', n;
  end if;

  -- I rifiuti, uno per uno.
  respinto := false;
  begin perform crea_prenotazione_su_tavoli(v_data, '20:00', 2, 'X', array[]::uuid[]);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Accettata una prenotazione senza tavoli.'; end if;

  respinto := false;
  begin perform crea_prenotazione_su_tavoli(v_data, '20:00', 2, '   ', v_t);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Accettata una prenotazione senza nome.'; end if;

  respinto := false;
  begin perform crea_prenotazione_su_tavoli(
    (now() at time zone 'Europe/Rome')::date - 1, '20:00', 2, 'X', v_t);
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_msg = message_text;
    respinto := true;
  end;
  if not respinto then raise exception 'Accettata una prenotazione per un giorno già passato.'; end if;

  respinto := false;
  begin perform crea_prenotazione_su_tavoli(v_data, '20:00', 0, 'X', v_t);
  exception when sqlstate 'P0001' then respinto := true; end;
  if not respinto then raise exception 'Accettata una prenotazione per zero persone.'; end if;

  -- Pulizia: le righe di collegamento se ne vanno in cascata.
  delete from reservations where id in (v_id, v_id2);
  select count(*) into n from reservations where customer_name like 'PROVA TELEFONO%';
  if n <> 0 then
    raise exception 'La prova ha lasciato % prenotazioni nel database.', n;
  end if;
  select count(*) into n from prenotazione_tavoli where reservation_id in (v_id, v_id2);
  if n <> 0 then
    raise exception 'La prova ha lasciato % righe di collegamento.', n;
  end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'La prenotazione si prende dalla pianta: nasce confermata sui tavoli toccati, senza email e senza avviso.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260814000010', 'la_prenotazione_si_prende_dalla_pianta')
on conflict (version) do nothing;

select
  (select count(*) from reservations where source = 'interno')                as prenotazioni_interne,
  (select count(*) from prenotazione_tavoli)                                  as tavoli_assegnati,
  (select count(*) from dining_tables where active and tipo = 'tavolo')       as tavoli_in_sala;
