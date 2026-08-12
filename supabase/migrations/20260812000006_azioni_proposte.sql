-- ---------------------------------------------------------------------
-- Dalla scheda di un documento all'elenco di cose da fare
-- ---------------------------------------------------------------------
-- Critica di Alessio del 12/08/2026, ed è giusta: «i campi predefiniti mi
-- sembrano inutili, non possono adeguarsi a qualunque cosa arrivi».
--
-- COS'ERA. La lettura riempiva sempre gli stessi sei campi — titolo,
-- tipo, data, controparte, importo, scadenza — perché il gestionale
-- sapeva fare **una cosa sola** con una mail: trasformarla in un
-- documento d'archivio. Sei campi sono la forma di un documento, e su un
-- contratto funzionano. Su «ricordati l'F24 il 16» non vogliono dire
-- niente, e la schermata chiedeva di compilare una scheda per una cosa
-- che scheda non è.
--
-- COS'È ADESSO. La lettura produce **un elenco di azioni**, ognuna con il
-- suo Conferma o Rifiuta. Una mail può generarne tre (archivia il
-- contratto, metti la scadenza in Agenda, metti la disdetta sei mesi
-- prima) o nessuna. Alessio ne accetta due e ne scarta una: sono
-- indipendenti.
--
-- PERCHÉ QUESTA FORMA REGGE MEGLIO NEL TEMPO. Il giorno in cui il
-- gestionale imparerà a registrare una fattura fornitore o un movimento
-- di prima nota, diventa **un tipo di azione in più**: una riga
-- nell'elenco qui sotto, una voce nelle istruzioni del lettore, un caso
-- nell'esecutore. Nessuna schermata da rifare, nessuna colonna da
-- aggiungere alla posta.
--
-- I QUATTRO TIPI DI PARTENZA — e il criterio per sceglierli: **solo cose
-- che il gestionale sa già fare davvero.** Proporre azioni che poi non si
-- possono eseguire sarebbe peggio che non proporne: insegnerebbe a non
-- fidarsi dei bottoni.
--
--   archivia_documento — un allegato diventa un documento dell'Archivio
--   archivia_testo     — quando il contenuto che conta è nella mail
--                        stessa e non in un allegato
--   promemoria         — una data che va in Agenda
--   nessuna            — non c'è niente da fare, con scritto perché
--
-- Idempotente (§7 punto 3), con verifica finale che solleva eccezione.

-- ---------------------------------------------------------------------
-- 1. Le azioni proposte
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_azione_posta') then
    create type tipo_azione_posta as enum (
      'archivia_documento', 'archivia_testo', 'promemoria', 'nessuna'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'stato_azione_posta') then
    create type stato_azione_posta as enum ('proposta', 'fatta', 'rifiutata');
  end if;
end $$;

create table if not exists posta_azioni (
  id            uuid primary key default gen_random_uuid(),
  posta_id      uuid not null references posta_ricevuta(id) on delete cascade,

  tipo          tipo_azione_posta not null,
  titolo        text not null,            -- come si legge nella schermata
  perche        text,                     -- una riga: perché la propone

  -- I dati dell'azione, diversi per ogni tipo. In jsonb e non in colonne
  -- perché è esattamente il punto della critica di Alessio: un elenco
  -- fisso di campi non può adeguarsi a qualunque cosa arrivi. Le colonne
  -- fisse tornano dove i dati sono davvero fissi — cioè in `documents` e
  -- in `tasks`, quando l'azione viene eseguita.
  parametri     jsonb not null default '{}'::jsonb,

  stato         stato_azione_posta not null default 'proposta',
  decisa_il     timestamptz,

  -- Cosa ne è nato, per poterci arrivare dalla mail (e per non rifarlo
  -- due volte: un'azione già fatta porta con sé la sua conseguenza).
  documento_id  uuid references documents(id) on delete set null,
  task_id       uuid references tasks(id) on delete set null,

  created_at    timestamptz not null default now()
);

comment on table posta_azioni is
  'Cosa l''assistente propone di fare con una mail. Ogni riga si conferma o si rifiuta per conto suo: una mail puo'' produrre tre azioni indipendenti. I parametri stanno in jsonb perche'' un elenco fisso di campi non puo'' adeguarsi a qualunque cosa arrivi — le colonne fisse tornano in documents e tasks, quando l''azione viene eseguita.';
comment on column posta_azioni.parametri is
  'Dati dell''azione, diversi per tipo. archivia_documento: allegato_id, titolo, tipo, data, controparte, importo, scadenza. archivia_testo: titolo, tipo, data, controparte, importo, scadenza. promemoria: titolo, data, note.';

create index if not exists idx_posta_azioni_posta on posta_azioni(posta_id, stato);

alter table posta_azioni enable row level security;
drop policy if exists posta_azioni_titolare on posta_azioni;
create policy posta_azioni_titolare on posta_azioni
  for all to authenticated
  using ((select is_titolare())) with check ((select is_titolare()));

grant select, insert, update on posta_azioni to service_role;

-- Una riga sola per dire cosa è arrivato, al posto dei sei campi.
alter table posta_ricevuta
  add column if not exists proposta_sintesi text;

comment on column posta_ricevuta.proposta_sintesi is
  'Che cosa e'' arrivato, in una riga. Sostituisce i sei campi fissi di prima: quelli descrivevano un documento, e non tutte le mail sono un documento.';

-- ---------------------------------------------------------------------
-- 2. Eseguire un'azione — una decisione, una transazione
-- ---------------------------------------------------------------------
-- Passa dal corridoio (regola B4): confermare può creare un documento,
-- creare il promemoria della sua scadenza e chiudere la mail. Se una
-- delle tre fallisse a metà, resterebbe un documento senza promemoria o
-- una mail chiusa senza documento — e nessuno se ne accorgerebbe, perché
-- la schermata direbbe «fatto».
create or replace function esegui_azione_posta(
  p_azione_id uuid,
  p_parametri jsonb default null   -- se Alessio ha corretto qualcosa
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
  n_aperte   integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' decidere sulla posta';
  end if;

  select * into v_azione from posta_azioni where id = p_azione_id for update;
  if not found then
    raise exception 'Questa proposta non esiste piu''';
  end if;

  -- Premuto due volte: si restituisce ciò che era già nato, non se ne
  -- crea un secondo.
  if v_azione.stato = 'fatta' then
    return jsonb_build_object('gia_fatta', true,
      'documento_id', v_azione.documento_id, 'task_id', v_azione.task_id);
  end if;

  v_par := coalesce(p_parametri, v_azione.parametri);
  select * into v_posta from posta_ricevuta where id = v_azione.posta_id;

  if v_azione.tipo = 'archivia_documento' then
    select * into v_allegato from posta_allegati
     where id = nullif(v_par->>'allegato_id', '')::uuid;

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

  elsif v_azione.tipo = 'archivia_testo' then
    -- Nessun file: il documento è il testo della mail. Serve per le
    -- comunicazioni che contano ma non hanno un allegato — «il tecnico
    -- passa il 12», «la banca ha cambiato l'IBAN».
    v_doc := create_document(
      p_title          => coalesce(nullif(v_par->>'titolo', ''), v_azione.titolo),
      p_doc_type       => nullif(v_par->>'tipo', ''),
      p_document_date  => nullif(v_par->>'data', '')::date,
      p_counterparties => nullif(v_par->>'controparte', ''),
      p_amount         => nullif(v_par->>'importo', '')::numeric,
      p_expiry_date    => nullif(v_par->>'scadenza', '')::date,
      p_note           => coalesce(nullif(v_par->>'note', ''),
                                   'Dalla mail: ' || coalesce(v_posta.oggetto, '') ||
                                   E'\n\n' || coalesce(v_posta.testo, ''))
    );

  elsif v_azione.tipo = 'promemoria' then
    insert into tasks (title, description, due_date, category, origine_modulo)
    values (
      coalesce(nullif(v_par->>'titolo', ''), v_azione.titolo),
      nullif(v_par->>'note', ''),
      nullif(v_par->>'data', '')::date,
      'amministrativo',
      'posta'
    )
    returning id into v_task;

  elsif v_azione.tipo = 'nessuna' then
    null;   -- niente da fare: serve solo a chiudere la mail
  end if;

  update posta_azioni
     set stato = 'fatta', decisa_il = now(),
         parametri = v_par, documento_id = v_doc, task_id = v_task
   where id = p_azione_id;

  -- Quando non resta niente di indeciso, la mail esce dalla sala
  -- d'attesa da sola: chiederlo ad Alessio sarebbe un tocco in più per
  -- dire una cosa che il sistema già sa.
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

comment on function esegui_azione_posta(uuid, jsonb) is
  'Esegue una singola azione proposta sulla posta (archivia un allegato, archivia il testo, crea un promemoria, oppure niente). Rieseguita restituisce cio'' che era gia'' nato. Chiude la mail da sola quando non restano proposte indecise. Solo titolare, solo dal corridoio.';

revoke all on function esegui_azione_posta(uuid, jsonb) from public, anon;
grant execute on function esegui_azione_posta(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Verifica — dal ruolo vero del titolare
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_tit   uuid;
  v_posta uuid;
  v_a1    uuid;
  v_a2    uuid;
  v_out   jsonb;
  v_out2  jsonb;
  n       integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then
    raise exception 'Nessun titolare in user_roles: non posso impersonare nessuno.';
  end if;

  insert into posta_ricevuta (messaggio_id, casella, mittente, oggetto, testo, stato)
  values ('PROVA-AZIONI-1', 'info@borgo58.it', 'studio@example.invalid',
          'Contratto', 'testo della mail di prova', 'proposta')
  returning id into v_posta;

  insert into posta_azioni (posta_id, tipo, titolo, perche, parametri)
  values (v_posta, 'archivia_testo', 'Comunicazione di prova', 'prova',
          jsonb_build_object('titolo', 'Comunicazione di prova', 'tipo', 'comunicazione'))
  returning id into v_a1;

  insert into posta_azioni (posta_id, tipo, titolo, perche, parametri)
  values (v_posta, 'promemoria', 'Promemoria di prova', 'prova',
          jsonb_build_object('titolo', 'PROVA AZIONI promemoria',
                             'data', (current_date + 40)::text))
  returning id into v_a2;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  v_out := esegui_azione_posta(v_a1);
  if v_out->>'documento_id' is null then
    raise exception 'L''azione di archiviazione non ha prodotto un documento.';
  end if;

  -- La mail non deve chiudersi finché resta una proposta indecisa.
  select count(*) into n from posta_ricevuta where id = v_posta and stato = 'proposta';
  if n <> 1 then
    raise exception 'La mail si e'' chiusa con una proposta ancora aperta.';
  end if;

  v_out2 := esegui_azione_posta(v_a1);   -- doppio tocco
  if (v_out2->>'documento_id') is distinct from (v_out->>'documento_id') then
    raise exception 'Un secondo tocco ha creato un secondo documento.';
  end if;

  v_out2 := esegui_azione_posta(v_a2);
  if v_out2->>'task_id' is null then
    raise exception 'Il promemoria non e'' nato.';
  end if;

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  -- Decise tutte, la mail si chiude da sola.
  select count(*) into n from posta_ricevuta where id = v_posta and stato = 'archiviata';
  if n <> 1 then
    raise exception 'Decise tutte le azioni, la mail non si e'' chiusa.';
  end if;

  -- Pulizia (regola del 12/08: le prove non lasciano niente).
  delete from tasks where id = (v_out2->>'task_id')::uuid;
  delete from documents where id = (v_out->>'documento_id')::uuid;
  delete from posta_ricevuta where id = v_posta;

  select count(*) into n from posta_ricevuta where messaggio_id like 'PROVA-AZIONI%';
  if n <> 0 then raise exception 'La prova ha lasciato % righe.', n; end if;
  select count(*) into n from tasks where title like 'PROVA AZIONI%';
  if n <> 0 then raise exception 'La prova ha lasciato % promemoria.', n; end if;

  if has_function_privilege('anon', 'esegui_azione_posta(uuid, jsonb)', 'execute') then
    raise exception 'Il ruolo anonimo puo'' eseguire le azioni sulla posta.';
  end if;

  raise notice 'Azioni sulla posta: eseguite dal ruolo del titolare, doppio tocco innocuo, mail chiusa solo a decisioni finite.';
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260812000006', 'azioni_proposte')
on conflict (version) do nothing;

select
  (select count(*) from posta_azioni where stato = 'proposta') as azioni_da_decidere,
  (select count(*) from posta_ricevuta where stato = 'proposta') as mail_in_attesa;
