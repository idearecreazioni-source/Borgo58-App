-- ---------------------------------------------------------------------
-- Dalla posta al documento: una decisione sola, tre scritture
-- ---------------------------------------------------------------------
-- Secondo pezzo del modulo della posta in arrivo. Qui succede la cosa che
-- Alessio ha chiesto per prima: **il sistema propone, lui conferma**.
--
-- Confermare significa tre scritture: nasce il documento nell'Archivio,
-- nasce il promemoria in Agenda se c'è una scadenza, e la mail esce dalla
-- sala d'attesa. O tutte e tre o nessuna — regola B4 del contratto: una
-- chiamata, una transazione, e si passa dal corridoio
-- `operazioni-atomiche`, mai in sequenza dal browser.
--
-- Il caso che rende necessaria l'atomicità non è teorico: se il documento
-- nascesse e la mail restasse in attesa, alla seconda conferma ci
-- sarebbero due documenti identici nell'archivio. Se la mail si chiudesse
-- e il documento non nascesse, la fattura sarebbe persa e nessuno se ne
-- accorgerebbe — è già stata «archiviata».
--
-- Il file non si copia: l'allegato sta già nel bucket dell'Archivio,
-- sotto `posta/`, messo lì da chi ha ricevuto la mail. Il documento punta
-- a quello. Due copie dello stesso file diventano, prima o poi, due
-- verità diverse.
--
-- Idempotente (§7 punto 3), con verifica finale che solleva eccezione.

create or replace function archivia_posta(
  p_posta_id       uuid,
  p_title          text,
  p_doc_type       text default null,
  p_document_date  date default null,
  p_counterparties text default null,
  p_amount         numeric default null,
  p_expiry_date    date default null,
  p_note           text default null,
  p_entity_id      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_posta     posta_ricevuta%rowtype;
  v_allegato  posta_allegati%rowtype;
  v_doc       uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' archiviare la posta';
  end if;

  select * into v_posta from posta_ricevuta where id = p_posta_id for update;
  if not found then
    raise exception 'Questa mail non esiste piu''';
  end if;
  if v_posta.stato = 'archiviata' then
    -- Non è un errore da nascondere: due tocchi sullo stesso pulsante
    -- capitano, e la risposta giusta è «è già fatto», non un secondo
    -- documento identico.
    return v_posta.documento_id;
  end if;

  -- Se la mail ha allegati si prende il primo: è il documento vero nella
  -- quasi totalità dei casi (la fattura in PDF). Gli altri restano
  -- attaccati alla mail e visibili da lì.
  select * into v_allegato
    from posta_allegati
   where posta_id = p_posta_id and storage_path is not null
   order by created_at
   limit 1;

  v_doc := create_document(
    p_title          => p_title,
    p_entity_id      => p_entity_id,
    p_doc_type       => p_doc_type,
    p_document_date  => p_document_date,
    p_counterparties => p_counterparties,
    p_amount         => p_amount,
    p_expiry_date    => p_expiry_date,
    p_note           => p_note,
    p_storage_path   => v_allegato.storage_path,
    p_file_name      => v_allegato.file_name
  );

  update posta_ricevuta
     set stato = 'archiviata', documento_id = v_doc
   where id = p_posta_id;

  return v_doc;
end
$funzione$;

comment on function archivia_posta is
  'Conferma di Alessio su una mail: crea il documento (e il promemoria della scadenza) e chiude la mail, tutto nella stessa transazione. Rieseguita sulla stessa mail restituisce il documento gia'' creato invece di crearne un secondo. Solo titolare, e solo attraverso il corridoio.';

revoke all on function archivia_posta(uuid, text, text, date, text, numeric, date, text, uuid) from public, anon;
grant execute on function archivia_posta(uuid, text, text, date, text, numeric, date, text, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- La lettura dell'AI, ogni quarto d'ora
-- ---------------------------------------------------------------------
-- Non parte alla consegna della mail: chi consegna si aspetta una
-- risposta in pochi secondi e riprova se non la riceve, e legare la
-- consegna a una chiamata lenta e a pagamento significherebbe pagare tre
-- volte la stessa lettura nelle giornate storte.
create or replace function chiedi_lettura_posta()
returns boolean
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_firma text;
  v_anon  text;
  v_base  text;
  n       integer;
begin
  select count(*) into n from posta_ricevuta where stato = 'da_leggere';
  if n = 0 then
    return false;   -- niente da leggere: nessuna chiamata, nessun costo
  end if;

  select decrypted_secret into v_firma from vault.decrypted_secrets where name = 'notifiche_firma';
  select decrypted_secret into v_anon  from vault.decrypted_secrets where name = 'chiave_anon';
  select coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'url_funzioni'),
    'https://oudjuqbqszisdtwzbxdo.supabase.co/functions/v1'
  ) into v_base;

  if v_firma is null or v_anon is null then
    raise warning 'Posta non letta: parola d''ordine assente dal Vault.';
    return false;
  end if;

  perform net.http_post(
    url := v_base || '/posta-leggi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon,
      'x-borgo58-firma', v_firma
    ),
    body := '{}'::jsonb
  );

  insert into stato_lavori (nome, ultimo_successo)
  values ('lettura_posta', now())
  on conflict (nome) do update set ultimo_successo = excluded.ultimo_successo;

  return true;
end
$funzione$;

revoke all on function chiedi_lettura_posta() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('lettura-posta')
      where exists (select 1 from cron.job where jobname = 'lettura-posta');
    perform cron.schedule('lettura-posta', '*/15 * * * *',
      $cron$select chiedi_lettura_posta();$cron$);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_posta    uuid;
  v_doc      uuid;
  v_doc2     uuid;
  n          integer;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: la verifica non puo'' impersonare nessuno.';
  end if;

  insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, stato,
                              proposta_conservare, proposta_titolo, proposta_scadenza)
  values ('PROVA-ARCHIVIA-1', 'info@borgo58.it', 'fornitore@example.invalid',
          'Fattura di prova', 'proposta', true, 'Fattura di prova', current_date + 30)
  returning id into v_posta;

  -- Dal ruolo vero del titolare, non da postgres: è il solo modo di
  -- provare che il controllo dei permessi dentro la funzione funziona.
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  v_doc := archivia_posta(
    p_posta_id => v_posta,
    p_title => 'Fattura di prova',
    p_doc_type => 'fattura',
    p_expiry_date => current_date + 30
  );

  -- Premuto due volte: deve tornare lo stesso documento, non un secondo.
  v_doc2 := archivia_posta(p_posta_id => v_posta, p_title => 'Fattura di prova');
  if v_doc2 is distinct from v_doc then
    raise exception 'Una seconda conferma ha creato un secondo documento.';
  end if;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  -- Le tre scritture ci sono tutte.
  select count(*) into n from documents where id = v_doc;
  if n <> 1 then raise exception 'Il documento non e'' stato creato.'; end if;

  select count(*) into n from posta_ricevuta
   where id = v_posta and stato = 'archiviata' and documento_id = v_doc;
  if n <> 1 then raise exception 'La mail non risulta archiviata.'; end if;

  select count(*) into n from tasks
   where title like 'Scadenza documento: Fattura di prova%';
  if n < 1 then raise exception 'Il promemoria della scadenza non e'' nato.'; end if;

  -- Pulizia: la prova non lascia niente (regola del 12/08).
  delete from tasks where title like 'Scadenza documento: Fattura di prova%';
  delete from documents where id = v_doc;
  delete from posta_ricevuta where id = v_posta;

  select count(*) into n from posta_ricevuta where messaggio_id like 'PROVA-ARCHIVIA%';
  if n <> 0 then raise exception 'La prova ha lasciato % righe.', n; end if;

  -- Nessuno chiama la lettura dall'esterno.
  if has_function_privilege('anon', 'chiedi_lettura_posta()', 'execute')
     or has_function_privilege('authenticated', 'chiedi_lettura_posta()', 'execute') then
    raise exception 'La lettura della posta e'' avviabile da un ruolo applicativo.';
  end if;

  -- E il ruolo anonimo non archivia niente.
  if has_function_privilege('anon',
       'archivia_posta(uuid, text, text, date, text, numeric, date, text, uuid)', 'execute') then
    raise exception 'Il ruolo anonimo puo'' archiviare la posta.';
  end if;

  raise notice 'Posta: conferma atomica provata dal ruolo del titolare, doppio tocco innocuo, prova ripulita.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000002', 'archivia_posta')
on conflict (version) do nothing;

select
  (select count(*) from posta_ricevuta where stato = 'da_leggere') as da_leggere,
  (select count(*) from posta_ricevuta where stato = 'proposta')   as in_attesa_di_te,
  (select count(*) from cron.job where jobname = 'lettura-posta')  as lavoro_di_lettura;
