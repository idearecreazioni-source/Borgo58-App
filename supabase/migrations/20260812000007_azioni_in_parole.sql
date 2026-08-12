-- ---------------------------------------------------------------------
-- Le azioni si leggono in italiano, non si compilano
-- ---------------------------------------------------------------------
-- Seconda critica di Alessio sullo stesso punto, il 12/08/2026, e più
-- affilata della prima: «il formato predeterminato non mi convince, ogni
-- mail ha caratteristiche diverse, e lo trovo confusionario. Vorrei un
-- elenco sintetico di ciò che l'assistente intende fare».
--
-- Aveva già ragione a togliere i sei campi fissi; aveva ragione anche
-- adesso, perché li avevo rimessi in piccolo dentro ogni azione. Un
-- elenco di caselle da riempire chiede a chi legge di ricostruire da solo
-- cosa succederà. Una frase gliela dice.
--
-- COSA CAMBIA
--
-- 1. Ogni azione porta la sua DESCRIZIONE: una riga in italiano che dice
--    cosa succede se la confermi, con dentro i dati («archivio il
--    contratto — locazione commerciale, 24.000 l'anno, fino al
--    31/08/2032»). I campi restano, ma dietro un «modifica»: servono a
--    correggere, non a leggere.
--
-- 2. Le scadenze di un documento diventano UNA azione sola
--    (`promemoria_multipli`): «metto in Agenda 5 scadenze» invece di
--    cinque conferme. È l'esempio che ha fatto lui.
--
-- 3. Nasce `da_fare_a_mano`: le cose che il gestionale **non sa ancora**
--    eseguire — caricare il magazzino da una fattura, registrare lotti e
--    scadenze in HACCP — non spariscono e non diventano bottoni finti.
--    Diventano un promemoria con l'elenco delle cose da fare. Il giorno
--    in cui il carico da fattura esisterà davvero, quella riga diventerà
--    un'azione automatica e questa resterà per tutto il resto.
--
-- 4. `documents.testo`: il contenuto del documento resta scritto accanto
--    al documento. Non serve oggi a niente — serve all'assistente che
--    risponderà alle domande sull'archivio, e serve ad Alessio per
--    cercare *dentro* i documenti e non solo nei titoli. Costa una
--    colonna adesso; senza, ogni domanda futura costerebbe come
--    rileggere l'archivio intero.
--
-- Via l'enum dei tipi, dentro un testo con vincolo: i tipi di azione
-- cresceranno (magazzino, HACCP, prima nota) e `alter type ... add value`
-- non è usabile nella stessa migrazione che lo aggiunge (§8). Un vincolo
-- di controllo si allarga con una riga e si legge cercando il suo nome.
--
-- Idempotente (§7 punto 3), con verifica finale che solleva eccezione.

-- ---------------------------------------------------------------------
-- 1. I tipi di azione diventano testo, e crescono con una riga
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_name = 'posta_azioni' and column_name = 'tipo' and udt_name = 'tipo_azione_posta'
  ) then
    alter table posta_azioni alter column tipo type text using tipo::text;
    drop type if exists tipo_azione_posta;
  end if;
end $$;

alter table posta_azioni drop constraint if exists posta_azioni_tipo_check;
alter table posta_azioni add constraint posta_azioni_tipo_check check (tipo in (
  'archivia_documento',    -- un allegato diventa un documento
  'archivia_testo',        -- il contenuto che conta è nella mail
  'promemoria',            -- una data in Agenda
  'promemoria_multipli',   -- più date dello stesso documento, in un colpo
  'da_fare_a_mano',        -- cose che il gestionale non sa ancora fare
  'nessuna'
));

alter table posta_azioni
  add column if not exists descrizione text;

comment on column posta_azioni.descrizione is
  'Cosa succede se la confermi, in una riga di italiano coi dati dentro. E'' quello che Alessio legge: i campi servono a correggere, non a capire.';

-- ---------------------------------------------------------------------
-- 2. Il contenuto resta accanto al documento
-- ---------------------------------------------------------------------
alter table documents
  add column if not exists testo text;

comment on column documents.testo is
  'Contenuto del documento in parole: serve all''assistente che rispondera'' alle domande sull''archivio, e a cercare dentro i documenti invece che nei soli titoli. Riempito da chi archivia (oggi la posta in arrivo), vuoto per i documenti caricati a mano.';

create index if not exists idx_documents_testo on documents
  using gin (to_tsvector('italian', coalesce(testo, '')));

-- ---------------------------------------------------------------------
-- 3. L'esecutore impara i tipi nuovi
-- ---------------------------------------------------------------------
create or replace function esegui_azione_posta(
  p_azione_id uuid,
  p_parametri jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_azione   posta_azioni%rowtype;
  v_par      jsonb;
  v_allegato posta_allegati%rowtype;
  v_posta    posta_ricevuta%rowtype;
  v_doc      uuid;
  v_task     uuid;
  v_riga     jsonb;
  v_elenco   text := '';
  n_aperte   integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' decidere sulla posta';
  end if;

  select * into v_azione from posta_azioni where id = p_azione_id for update;
  if not found then
    raise exception 'Questa proposta non esiste piu''';
  end if;

  if v_azione.stato = 'fatta' then
    return jsonb_build_object('gia_fatta', true,
      'documento_id', v_azione.documento_id, 'task_id', v_azione.task_id);
  end if;

  v_par := coalesce(p_parametri, v_azione.parametri);
  select * into v_posta from posta_ricevuta where id = v_azione.posta_id;

  if v_azione.tipo in ('archivia_documento', 'archivia_testo') then
    if v_azione.tipo = 'archivia_documento' then
      select * into v_allegato from posta_allegati
       where id = nullif(v_par->>'allegato_id', '')::uuid;
    end if;

    v_doc := create_document(
      p_title          => coalesce(nullif(v_par->>'titolo', ''), v_azione.titolo),
      p_doc_type       => nullif(v_par->>'tipo', ''),
      p_document_date  => nullif(v_par->>'data', '')::date,
      p_counterparties => nullif(v_par->>'controparte', ''),
      p_amount         => nullif(v_par->>'importo', '')::numeric,
      p_expiry_date    => nullif(v_par->>'scadenza', '')::date,
      p_note           => nullif(v_par->>'note', ''),
      p_storage_path   => v_allegato.storage_path,
      p_file_name      => v_allegato.file_name
    );

    -- Il contenuto, per le domande di domani. Se l'assistente non l'ha
    -- scritto si ripiega sul testo della mail: meglio poco che niente.
    update documents
       set testo = coalesce(nullif(v_par->>'contenuto', ''), v_posta.testo)
     where id = v_doc;

  elsif v_azione.tipo = 'promemoria' then
    insert into tasks (title, description, due_date, category, origine_modulo)
    values (coalesce(nullif(v_par->>'titolo', ''), v_azione.titolo),
            nullif(v_par->>'note', ''), nullif(v_par->>'data', '')::date,
            'amministrativo', 'posta')
    returning id into v_task;

  elsif v_azione.tipo = 'promemoria_multipli' then
    -- Più date dello stesso documento, confermate in un colpo solo.
    -- `task_id` tiene la prima: serve a sapere che è stata eseguita, non
    -- a rappresentarle tutte.
    for v_riga in select * from jsonb_array_elements(coalesce(v_par->'scadenze', '[]'::jsonb))
    loop
      if nullif(v_riga->>'data', '') is not null then
        insert into tasks (title, description, due_date, category, origine_modulo)
        values (coalesce(nullif(v_riga->>'titolo', ''), v_azione.titolo),
                nullif(v_riga->>'note', ''), (v_riga->>'data')::date,
                'amministrativo', 'posta')
        returning id into v_task;
      end if;
    end loop;

  elsif v_azione.tipo = 'da_fare_a_mano' then
    -- Il gestionale non sa farlo: lo scrive in Agenda come lista di cose
    -- da fare, invece di tacere o di fingere un bottone che funziona.
    for v_riga in select * from jsonb_array_elements(coalesce(v_par->'passi', '[]'::jsonb))
    loop
      v_elenco := v_elenco || '· ' || coalesce(v_riga #>> '{}', '') || E'\n';
    end loop;

    insert into tasks (title, description, due_date, category, origine_modulo)
    values (coalesce(nullif(v_par->>'titolo', ''), v_azione.titolo),
            nullif(coalesce(nullif(v_elenco, ''), nullif(v_par->>'note', '')), ''),
            nullif(v_par->>'data', '')::date,
            'amministrativo', 'posta')
    returning id into v_task;

  elsif v_azione.tipo = 'nessuna' then
    null;
  end if;

  update posta_azioni
     set stato = 'fatta', decisa_il = now(),
         parametri = v_par, documento_id = v_doc, task_id = v_task
   where id = p_azione_id;

  select count(*) into n_aperte
    from posta_azioni where posta_id = v_azione.posta_id and stato = 'proposta';
  if n_aperte = 0 then
    update posta_ricevuta
       set stato = case
             when exists (select 1 from posta_azioni
                           where posta_id = v_azione.posta_id
                             and stato = 'fatta' and tipo <> 'nessuna')
             then 'archiviata'::stato_posta else 'scartata'::stato_posta end,
           documento_id = coalesce(documento_id, v_doc)
     where id = v_azione.posta_id;
  end if;

  return jsonb_build_object('documento_id', v_doc, 'task_id', v_task);
end
$funzione$;

revoke all on function esegui_azione_posta(uuid, jsonb) from public, anon;
grant execute on function esegui_azione_posta(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Verifica — dal ruolo vero del titolare
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit   uuid;
  v_posta uuid;
  v_a1    uuid;
  v_a2    uuid;
  v_out   jsonb;
  n       integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Nessun titolare in user_roles.';
  end if;

  insert into posta_ricevuta (messaggio_id, casella, oggetto, testo, stato)
  values ('PROVA-PAROLE-1', 'info@borgo58.it', 'Contratto', 'testo di prova', 'proposta')
  returning id into v_posta;

  -- Tre scadenze in una sola azione.
  insert into posta_azioni (posta_id, tipo, titolo, descrizione, parametri)
  values (v_posta, 'promemoria_multipli', 'Scadenze del contratto',
          'Metto in Agenda 3 scadenze', jsonb_build_object('scadenze', jsonb_build_array(
            jsonb_build_object('titolo', 'PROVA PAROLE uno',  'data', (current_date + 30)::text),
            jsonb_build_object('titolo', 'PROVA PAROLE due',  'data', (current_date + 60)::text),
            jsonb_build_object('titolo', 'PROVA PAROLE tre',  'data', (current_date + 90)::text))))
  returning id into v_a1;

  -- Una cosa che il gestionale non sa fare.
  insert into posta_azioni (posta_id, tipo, titolo, descrizione, parametri)
  values (v_posta, 'da_fare_a_mano', 'PROVA PAROLE a mano',
          'Ti ricordo due cose da fare tu',
          jsonb_build_object('data', (current_date + 5)::text,
                             'passi', jsonb_build_array('carica il magazzino', 'registra i lotti')))
  returning id into v_a2;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  v_out := esegui_azione_posta(v_a1);
  select count(*) into n from tasks where title like 'PROVA PAROLE %'
    and title in ('PROVA PAROLE uno', 'PROVA PAROLE due', 'PROVA PAROLE tre');
  if n <> 3 then
    raise exception 'Le scadenze multiple hanno prodotto % promemoria invece di 3.', n;
  end if;

  v_out := esegui_azione_posta(v_a2);
  select count(*) into n from tasks
   where title = 'PROVA PAROLE a mano' and description like '%carica il magazzino%';
  if n <> 1 then
    raise exception 'La lista delle cose da fare a mano non e'' finita in Agenda.';
  end if;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  -- Il contenuto dei documenti ha dove stare.
  select count(*) into n from information_schema.columns
   where table_name = 'documents' and column_name = 'testo';
  if n <> 1 then raise exception 'La colonna del contenuto non esiste.'; end if;

  -- Pulizia (regola del 12/08).
  delete from tasks where title like 'PROVA PAROLE%';
  delete from posta_ricevuta where id = v_posta;
  select count(*) into n from tasks where title like 'PROVA PAROLE%';
  if n <> 0 then raise exception 'La prova ha lasciato % promemoria.', n; end if;

  raise notice 'Azioni in parole: scadenze multiple in un colpo, cose da fare a mano in Agenda, contenuto dei documenti conservato.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000007', 'azioni_in_parole')
on conflict (version) do nothing;

select
  (select count(*) from posta_azioni where stato = 'proposta') as azioni_da_decidere,
  (select count(*) from documents where testo is not null)     as documenti_con_contenuto;
