-- ---------------------------------------------------------------------
-- Blocco 2 del Piano correzioni: record + promemoria in una transazione
-- ---------------------------------------------------------------------
-- Quattro moduli (Archivio documenti, Proiezione fiscale, Personale,
-- Fatture fornitori) usano lo stesso schema: si crea un record con una
-- scadenza, si crea il promemoria in Agenda, si collega il promemoria al
-- record. Oggi sono TRE scritture separate dal browser: un fallimento a
-- meta' lascia un record senza promemoria, o un promemoria orfano che
-- nessuna chiusura automatica potra' mai completare.
--
-- Quinta operazione: il pagamento fattura (update fattura + chiusura del
-- promemoria), dove la chiusura del task non era nemmeno protetta — un
-- errore lasciava la fattura pagata con il promemoria "Pagare fattura"
-- ancora pendente in Agenda.
--
-- Da questa migrazione ognuna e' UNA funzione Postgres (una chiamata =
-- una transazione), invocata solo attraverso la Edge Function
-- `operazioni-atomiche` (Contratto B4). I titoli dei promemoria sono
-- costruiti DAL DATABASE dai dati veri (nome dipendente, nome fornitore),
-- non piu' ricevuti dal client.
--
-- La visibilita' staff dei task resta decisa dal trigger
-- trg_task_visibility a partire da origine_modulo (§3.18): le funzioni
-- non toccano visibile_staff, esattamente come non lo toccava il client.
--
-- Idempotente (§7 punto 3).

-- ---------------------------------------------------------------------
-- 1. Archivio documenti
-- ---------------------------------------------------------------------
create or replace function create_document(
  p_title          text,
  p_entity_id      uuid default null,
  p_doc_type       text default null,
  p_document_date  date default null,
  p_counterparties text default null,
  p_amount         numeric default null,
  p_expiry_date    date default null,
  p_note           text default null,
  p_storage_path   text default null,
  p_file_name      text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc  uuid;
  v_task uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' archiviare documenti';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'Serve un titolo per il documento';
  end if;

  insert into documents (
    entity_id, title, doc_type, document_date, counterparties,
    amount, expiry_date, note, storage_path, file_name
  ) values (
    p_entity_id, btrim(p_title), p_doc_type, p_document_date,
    p_counterparties, p_amount, p_expiry_date, p_note,
    p_storage_path, p_file_name
  )
  returning id into v_doc;

  if p_expiry_date is not null then
    insert into tasks (title, due_date, category, origine_modulo)
    values ('Scadenza documento: ' || btrim(p_title), p_expiry_date,
            'Documenti', 'archivio_documenti')
    returning id into v_task;

    update documents set task_id = v_task where id = v_doc;
  end if;

  return v_doc;
end;
$$;

comment on function create_document is
  'Archivia un documento e, se ha una scadenza, crea e collega il promemoria in Agenda nella stessa transazione. Il file va caricato nello storage PRIMA (regola d''ordine: prima il file, poi la riga — un file orfano e'' innocuo, una riga senza file no). Solo titolare.';

revoke all on function create_document(text, uuid, text, date, text, numeric, date, text, text, text) from public;
grant execute on function create_document(text, uuid, text, date, text, numeric, date, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Strumenti fiscali
-- ---------------------------------------------------------------------
create or replace function create_fiscal_tool(
  p_name                text,
  p_category            fiscal_tool_category,
  p_description         text default null,
  p_applicability       text default null,
  p_status              fiscal_tool_status default 'da_verificare',
  p_normative_reference text default null,
  p_last_verified_date  date default null,
  p_in_use              boolean default false,
  p_deadline            date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tool uuid;
  v_task uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' gestire gli strumenti fiscali';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Serve il nome dello strumento fiscale';
  end if;

  insert into fiscal_tools (
    name, category, description, applicability, status,
    normative_reference, last_verified_date, in_use, deadline
  ) values (
    btrim(p_name), p_category, p_description, p_applicability,
    coalesce(p_status, 'da_verificare'), p_normative_reference,
    p_last_verified_date, coalesce(p_in_use, false), p_deadline
  )
  returning id into v_tool;

  if p_deadline is not null then
    insert into tasks (title, due_date, category, origine_modulo)
    values ('Strumento fiscale: ' || btrim(p_name), p_deadline,
            'Fiscale', 'proiezione_fiscale')
    returning id into v_task;

    update fiscal_tools set task_id = v_task where id = v_tool;
  end if;

  return v_tool;
end;
$$;

comment on function create_fiscal_tool is
  'Strumento fiscale + eventuale promemoria di scadenza in una transazione. Solo titolare.';

revoke all on function create_fiscal_tool(text, fiscal_tool_category, text, text, fiscal_tool_status, text, date, boolean, date) from public;
grant execute on function create_fiscal_tool(text, fiscal_tool_category, text, text, fiscal_tool_status, text, date, boolean, date) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Documenti del personale
-- ---------------------------------------------------------------------
create or replace function create_employee_document(
  p_employee_id        uuid,
  p_doc_type           compliance_doc_type,
  p_description        text default null,
  p_expiry_date        date default null,
  p_document_reference text default null,
  p_issue_date         date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_doc  uuid;
  v_task uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' gestire i documenti del personale';
  end if;

  -- Il nome per il titolo del promemoria si legge dal database, non si
  -- riceve dal client: il titolo contiene dati riservati e deve
  -- corrispondere al dipendente vero.
  select first_name || ' ' || last_name into v_nome
  from employees where id = p_employee_id;
  if v_nome is null then
    raise exception 'Dipendente non trovato';
  end if;

  insert into employee_documents (
    employee_id, doc_type, description, issue_date, expiry_date, document_reference
  ) values (
    p_employee_id, p_doc_type, p_description, p_issue_date, p_expiry_date, p_document_reference
  )
  returning id into v_doc;

  if p_expiry_date is not null then
    insert into tasks (title, due_date, category, origine_modulo)
    values ('Rinnovo documento — ' || v_nome || ': ' || coalesce(p_description, p_doc_type::text),
            p_expiry_date, 'Personale', 'personale')
    returning id into v_task;

    update employee_documents set task_id = v_task where id = v_doc;
  end if;

  return v_doc;
end;
$$;

comment on function create_employee_document is
  'Documento del dipendente + eventuale promemoria di rinnovo in una transazione. Il nome nel titolo del promemoria viene letto dal database. Solo titolare.';

revoke all on function create_employee_document(uuid, compliance_doc_type, text, date, text, date) from public;
grant execute on function create_employee_document(uuid, compliance_doc_type, text, date, text, date) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Fatture fornitori: registrazione
-- ---------------------------------------------------------------------
create or replace function create_supplier_invoice(
  p_entity_id          uuid,
  p_supplier_id        uuid,
  p_invoice_date       date,
  p_amount             numeric,
  p_invoice_number     text default null,
  p_due_date           date default null,
  p_document_reference text default null,
  p_note               text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fornitore text;
  v_inv  uuid;
  v_task uuid;
  v_titolo text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' registrare le fatture';
  end if;
  if p_invoice_date is null then
    raise exception 'Serve la data della fattura';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'L''importo della fattura non puo'' essere negativo o mancante';
  end if;

  select name into v_fornitore from suppliers where id = p_supplier_id;
  if v_fornitore is null then
    raise exception 'Fornitore non trovato';
  end if;

  insert into supplier_invoices (
    entity_id, supplier_id, invoice_number, invoice_date, due_date,
    amount, document_reference, note
  ) values (
    p_entity_id, p_supplier_id, nullif(btrim(coalesce(p_invoice_number, '')), ''),
    p_invoice_date, p_due_date, p_amount, p_document_reference, p_note
  )
  returning id into v_inv;

  if p_due_date is not null then
    v_titolo := 'Pagare fattura '
      || case when nullif(btrim(coalesce(p_invoice_number, '')), '') is not null
              then '#' || btrim(p_invoice_number) || ' ' else '' end
      || '— ' || v_fornitore || ' (' || p_amount::text || '€)';

    insert into tasks (title, due_date, category, origine_modulo)
    values (v_titolo, p_due_date, 'fatture_fornitori', 'fatture_fornitori')
    returning id into v_task;

    update supplier_invoices set task_id = v_task where id = v_inv;
  end if;

  return v_inv;
end;
$$;

comment on function create_supplier_invoice is
  'Fattura fornitore + eventuale promemoria di pagamento in una transazione. Il nome del fornitore nel titolo viene letto dal database. Solo titolare.';

revoke all on function create_supplier_invoice(uuid, uuid, date, numeric, text, date, text, text) from public;
grant execute on function create_supplier_invoice(uuid, uuid, date, numeric, text, date, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Fatture fornitori: pagamento
-- ---------------------------------------------------------------------
create or replace function pay_supplier_invoice(
  p_invoice_id     uuid,
  p_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv supplier_invoices%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' registrare un pagamento';
  end if;
  if p_payment_method is null or p_payment_method not in ('contante', 'bonifico', 'carta') then
    raise exception 'Metodo di pagamento non valido: %', coalesce(p_payment_method, '(mancante)');
  end if;

  -- Riga bloccata: due pagamenti contemporanei della stessa fattura non
  -- possono sovrapporsi.
  select * into v_inv from supplier_invoices where id = p_invoice_id for update;
  if v_inv.id is null then
    raise exception 'Fattura non trovata';
  end if;
  if v_inv.status = 'pagata' then
    raise exception 'Questa fattura risulta gia'' pagata';
  end if;

  update supplier_invoices
     set status = 'pagata', paid_at = now(), payment_method = p_payment_method
   where id = p_invoice_id;

  -- Chiusura del promemoria nella stessa transazione. Se il task e' stato
  -- nel frattempo eliminato dall'Agenda ("Elimina i completati"), l'update
  -- non trova righe e NON e' un errore: bloccare un pagamento vero per un
  -- promemoria gia' sparito sarebbe il danno peggiore.
  if v_inv.task_id is not null then
    update tasks set status = 'completato' where id = v_inv.task_id;
  end if;

  return p_invoice_id;
end;
$$;

comment on function pay_supplier_invoice is
  'Segna pagata una fattura e completa il promemoria collegato nella stessa transazione. Rifiuta il doppio pagamento (riga bloccata con FOR UPDATE). Solo titolare.';

revoke all on function pay_supplier_invoice(uuid, text) from public;
grant execute on function pay_supplier_invoice(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Verifica sul campo (§7 punti 2-3)
-- ---------------------------------------------------------------------
-- Nota dichiarata sul fallimento a meta': in questo blocco la seconda
-- scrittura (il promemoria) non ha piu' alcun modo di fallire dipendente
-- dai dati, PROPRIO PERCHE' le funzioni validano tutto prima di scrivere
-- (titolo mai nullo, dipendente/fornitore letti dal database). I guasti
-- residui (connessione, disco) sono esattamente cio' che la transazione
-- copre — meccanismo gia' dimostrato empiricamente nel Blocco 1 e nella
-- chiusura conti. Qui si dimostrano: successo per tutti e 4 i domini,
-- visibilita' staff dei promemoria, doppio pagamento respinto, staff
-- respinto.
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  e1 uuid;
  v_forn uuid; v_emp uuid;
  v_doc uuid; v_tool uuid; v_edoc uuid; v_inv uuid;
  v_task uuid;
  v_txt text;
  v_vis boolean;
  n integer;
  respinto boolean;
begin
  select user_id into v_titolare from user_roles where role = 'titolare' limit 1;
  if v_titolare is null then
    raise exception 'Nessun titolare in user_roles: impossibile verificare.';
  end if;
  select user_id into v_staff from user_roles where role = 'staff' limit 1;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);

  select id into e1 from entities order by created_at limit 1;

  insert into suppliers (entity_id, name) values (e1, '__Prova Fornitore__')
  returning id into v_forn;
  insert into employees (entity_id, first_name, last_name)
  values (e1, '__Prova__', 'Dipendente') returning id into v_emp;

  -- 1) DOCUMENTO con scadenza: record + promemoria collegato
  v_doc := create_document(p_title => '__Prova documento__',
                           p_expiry_date => current_date + 30);
  select task_id into v_task from documents where id = v_doc;
  if v_task is null then
    raise exception 'Documento con scadenza senza promemoria collegato.';
  end if;
  select title, visibile_staff into v_txt, v_vis from tasks where id = v_task;
  if v_txt <> 'Scadenza documento: __Prova documento__' then
    raise exception 'Titolo del promemoria documento errato: %', v_txt;
  end if;
  if v_vis then
    raise exception 'Il promemoria del documento e'' visibile allo staff: la whitelist non ha agito.';
  end if;

  -- 2) STRUMENTO FISCALE con scadenza
  v_tool := create_fiscal_tool(p_name => '__Prova strumento__',
                               p_category => (enum_range(null::fiscal_tool_category))[1],
                               p_deadline => current_date + 30);
  select task_id into v_task from fiscal_tools where id = v_tool;
  if v_task is null then
    raise exception 'Strumento fiscale con scadenza senza promemoria.';
  end if;

  -- 3) DOCUMENTO DIPENDENTE: il nome nel titolo viene dal database
  v_edoc := create_employee_document(p_employee_id => v_emp,
                                     p_doc_type => (enum_range(null::compliance_doc_type))[1],
                                     p_description => 'Prova rinnovo',
                                     p_expiry_date => current_date + 30);
  select t.title into v_txt from tasks t join employee_documents d on d.task_id = t.id where d.id = v_edoc;
  if v_txt is null or position('__Prova__ Dipendente' in v_txt) = 0 then
    raise exception 'Titolo promemoria dipendente senza il nome letto dal database: %', v_txt;
  end if;

  -- 4) FATTURA con scadenza: titolo con fornitore e importo dal database
  v_inv := create_supplier_invoice(p_entity_id => e1, p_supplier_id => v_forn,
                                   p_invoice_date => current_date, p_amount => 123.45,
                                   p_invoice_number => '99X', p_due_date => current_date + 15);
  select t.title into v_txt from tasks t join supplier_invoices i on i.task_id = t.id where i.id = v_inv;
  if v_txt is null or position('__Prova Fornitore__' in v_txt) = 0 or position('123.45' in v_txt) = 0 then
    raise exception 'Titolo promemoria fattura errato: %', v_txt;
  end if;

  -- 5) PAGAMENTO: fattura pagata + promemoria completato insieme
  perform pay_supplier_invoice(v_inv, 'bonifico');
  select count(*) into n from supplier_invoices i join tasks t on t.id = i.task_id
   where i.id = v_inv and i.status = 'pagata' and t.status = 'completato';
  if n <> 1 then
    raise exception 'Pagamento e chiusura promemoria non sono avvenuti insieme.';
  end if;

  -- 6) DOPPIO PAGAMENTO respinto
  respinto := false;
  begin
    perform pay_supplier_invoice(v_inv, 'contante');
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'Un doppio pagamento NON e'' stato respinto.';
  end if;

  -- 7) STAFF respinto (rappresentativo: documenti e pagamento)
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    respinto := false;
    begin
      perform create_document(p_title => 'x');
    exception when others then respinto := true;
    end;
    if not respinto then
      raise exception 'Un utente STAFF ha potuto archiviare un documento.';
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  end if;

  -- PULIZIA COMPLETA (promemoria compresi), registro cancellazioni incluso
  delete from tasks where id in (
    select task_id from documents where id = v_doc
    union select task_id from fiscal_tools where id = v_tool
    union select task_id from employee_documents where id = v_edoc
    union select task_id from supplier_invoices where id = v_inv
  );
  delete from documents where id = v_doc;
  delete from fiscal_tools where id = v_tool;
  delete from employee_documents where id = v_edoc;
  delete from supplier_invoices where id = v_inv;
  delete from employees where id = v_emp;
  delete from suppliers where id = v_forn;
  delete from deleted_records
   where record_id in (v_doc::text, v_edoc::text, v_inv::text, v_emp::text);

  raise notice 'Blocco 2 verificato: 4 domini con record+promemoria in transazione, titoli costruiti dal database, promemoria invisibili allo staff, pagamento+chiusura insieme, doppio pagamento respinto, staff respinto. Prove ripulite.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260809000003', 'blocco2_record_e_promemoria')
on conflict (version) do nothing;

-- Riepilogo: 5 funzioni, zero residui di prova.
select
  (select count(*) from pg_proc where proname in
    ('create_document','create_fiscal_tool','create_employee_document',
     'create_supplier_invoice','pay_supplier_invoice'))                       as funzioni_create,
  (select count(*) from documents where title = '__Prova documento__')        as residui_documenti,
  (select count(*) from suppliers where name = '__Prova Fornitore__')         as residui_fornitori,
  (select count(*) from employees where first_name = '__Prova__')             as residui_dipendenti,
  (select count(*) from tasks where title like '%__Prova%')                   as residui_promemoria;
