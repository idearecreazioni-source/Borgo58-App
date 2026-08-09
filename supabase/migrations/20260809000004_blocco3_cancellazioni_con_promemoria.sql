-- ---------------------------------------------------------------------
-- Blocco 3 del Piano correzioni: cancellazioni e promemoria insieme
-- ---------------------------------------------------------------------
-- Il verso simmetrico del Blocco 2: quando si elimina un record con un
-- promemoria collegato, oggi il browser prima completa il promemoria e
-- POI cancella il record. Se la cancellazione viene respinta (es. il
-- dipendente ha ricevuto mance: vincolo RESTRICT), il promemoria e' gia'
-- stato chiuso — per un record che resta nel sistema.
--
-- In piu' il difetto opposto trovato dalla verifica: la cancellazione di
-- una fattura NON toccava affatto il promemoria "Pagare fattura", che
-- restava pendente in Agenda per sempre.
--
-- E l'ordine sbagliato sui file: deleteDocument rimuoveva il file dallo
-- storage PRIMA di cancellare la riga — se la cancellazione falliva
-- restava un documento che l'app mostra e non si apre. La regola giusta
-- (ARCHITETTURA §4.3): prima la riga, poi il file. La riga e' la verita';
-- un file orfano e' invisibile e innocuo.
--
-- Cinque funzioni: la chiusura del promemoria e la cancellazione vivono
-- nella stessa transazione — se la cancellazione e' respinta, anche la
-- chiusura del promemoria si annulla. Il task_id lo legge il database
-- dalla riga, non si riceve piu' dal client.
--
-- Idempotente (§7 punto 3).

-- ---------------------------------------------------------------------
-- 1. Documento d'archivio — restituisce lo storage_path perche' il client
--    rimuova il file DOPO, a riga gia' cancellata
-- ---------------------------------------------------------------------
create or replace function delete_document(p_document_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc documents%rowtype;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' eliminare documenti';
  end if;

  select * into v_doc from documents where id = p_document_id for update;
  if v_doc.id is null then
    raise exception 'Documento non trovato';
  end if;

  if v_doc.task_id is not null then
    update tasks set status = 'completato' where id = v_doc.task_id;
  end if;

  delete from documents where id = p_document_id;

  return v_doc.storage_path;
end;
$$;

comment on function delete_document is
  'Completa il promemoria e cancella la riga nella stessa transazione. Restituisce lo storage_path: il file va rimosso DOPO, dal client — prima la riga, poi il file (ARCHITETTURA §4.3).';

revoke all on function delete_document(uuid) from public;
grant execute on function delete_document(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Strumento fiscale
-- ---------------------------------------------------------------------
create or replace function delete_fiscal_tool(p_tool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' eliminare uno strumento fiscale';
  end if;

  select task_id into v_task from fiscal_tools where id = p_tool_id for update;
  if not found then
    raise exception 'Strumento fiscale non trovato';
  end if;

  if v_task is not null then
    update tasks set status = 'completato' where id = v_task;
  end if;

  delete from fiscal_tools where id = p_tool_id;
end;
$$;

revoke all on function delete_fiscal_tool(uuid) from public;
grant execute on function delete_fiscal_tool(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Documento del dipendente
-- ---------------------------------------------------------------------
create or replace function delete_employee_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' eliminare i documenti del personale';
  end if;

  select task_id into v_task from employee_documents where id = p_document_id for update;
  if not found then
    raise exception 'Documento non trovato';
  end if;

  if v_task is not null then
    update tasks set status = 'completato' where id = v_task;
  end if;

  delete from employee_documents where id = p_document_id;
end;
$$;

revoke all on function delete_employee_document(uuid) from public;
grant execute on function delete_employee_document(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Dipendente — il caso che ha motivato tutto il blocco
-- ---------------------------------------------------------------------
create or replace function delete_employee(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' eliminare un dipendente';
  end if;

  if not exists (select 1 from employees where id = p_employee_id) then
    raise exception 'Dipendente non trovato';
  end if;

  -- Prima si completano i promemoria dei suoi documenti, poi si cancella:
  -- ma siccome tutto vive in UNA transazione, se la cancellazione viene
  -- respinta (mance ricevute -> RESTRICT) anche i completamenti si
  -- annullano. Era esattamente il difetto: promemoria chiusi per un
  -- dipendente che restava.
  update tasks set status = 'completato'
   where id in (
     select task_id from employee_documents
     where employee_id = p_employee_id and task_id is not null
   );

  begin
    delete from employees where id = p_employee_id;
  exception
    when foreign_key_violation then
      raise exception 'Impossibile eliminare: il dipendente ha ricevuto mance in una distribuzione. Rimuovi prima la distribuzione dalla sezione Mance.';
  end;
end;
$$;

comment on function delete_employee is
  'Completa i promemoria dei documenti del dipendente e lo elimina (documenti/ferie/buste a cascata) in una transazione: se la cancellazione e'' respinta dal vincolo sulle mance, anche i completamenti si annullano.';

revoke all on function delete_employee(uuid) from public;
grant execute on function delete_employee(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Fattura fornitore — chiude anche il promemoria (prima non lo toccava)
-- ---------------------------------------------------------------------
create or replace function delete_supplier_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task uuid;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' eliminare una fattura';
  end if;

  select task_id into v_task from supplier_invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Fattura non trovata';
  end if;

  if v_task is not null then
    update tasks set status = 'completato' where id = v_task;
  end if;

  delete from supplier_invoices where id = p_invoice_id;
end;
$$;

comment on function delete_supplier_invoice is
  'Cancella la fattura E completa il promemoria "Pagare fattura" collegato — prima il promemoria restava pendente in Agenda per sempre.';

revoke all on function delete_supplier_invoice(uuid) from public;
grant execute on function delete_supplier_invoice(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Verifica sul campo (§7 punti 2-3)
-- ---------------------------------------------------------------------
do $verifica$
declare
  v_titolare uuid;
  v_staff    uuid;
  e1 uuid;
  v_forn uuid;
  v_emp1 uuid; v_emp2 uuid;
  v_doc uuid; v_tool uuid; v_edoc uuid; v_edoc2 uuid; v_inv uuid;
  v_dist uuid;
  v_task uuid; v_task2 uuid;
  v_path text;
  v_stato task_status;
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
  insert into suppliers (entity_id, name) values (e1, '__Prova Fornitore B3__')
  returning id into v_forn;
  insert into employees (entity_id, first_name, last_name)
  values (e1, '__ProvaB3__', 'Uno') returning id into v_emp1;
  insert into employees (entity_id, first_name, last_name)
  values (e1, '__ProvaB3__', 'Due') returning id into v_emp2;

  -- 1) DOCUMENTO: cancellazione con promemoria completato + path restituito
  v_doc := create_document(p_title => '__Prova B3 doc__',
                           p_expiry_date => current_date + 10,
                           p_storage_path => 'prova/percorso.pdf');
  select task_id into v_task from documents where id = v_doc;
  v_path := delete_document(v_doc);
  if v_path is distinct from 'prova/percorso.pdf' then
    raise exception 'delete_document non ha restituito lo storage_path: %', v_path;
  end if;
  if exists (select 1 from documents where id = v_doc) then
    raise exception 'Il documento non e'' stato cancellato.';
  end if;
  select status into v_stato from tasks where id = v_task;
  if v_stato is distinct from 'completato' then
    raise exception 'Il promemoria del documento non risulta completato: %', v_stato;
  end if;

  -- 2) STRUMENTO FISCALE
  v_tool := create_fiscal_tool(p_name => '__Prova B3 tool__',
                               p_category => (enum_range(null::fiscal_tool_category))[1],
                               p_deadline => current_date + 10);
  select task_id into v_task from fiscal_tools where id = v_tool;
  perform delete_fiscal_tool(v_tool);
  select status into v_stato from tasks where id = v_task;
  if exists (select 1 from fiscal_tools where id = v_tool)
     or v_stato is distinct from 'completato' then
    raise exception 'Strumento fiscale: cancellazione o promemoria incoerenti.';
  end if;

  -- 3) DOCUMENTO DIPENDENTE
  v_edoc := create_employee_document(p_employee_id => v_emp1,
                                     p_doc_type => (enum_range(null::compliance_doc_type))[1],
                                     p_expiry_date => current_date + 10);
  select task_id into v_task from employee_documents where id = v_edoc;
  perform delete_employee_document(v_edoc);
  select status into v_stato from tasks where id = v_task;
  if exists (select 1 from employee_documents where id = v_edoc)
     or v_stato is distinct from 'completato' then
    raise exception 'Documento dipendente: cancellazione o promemoria incoerenti.';
  end if;

  -- 4) FATTURA: la cancellazione ora chiude anche il promemoria
  v_inv := create_supplier_invoice(p_entity_id => e1, p_supplier_id => v_forn,
                                   p_invoice_date => current_date, p_amount => 50,
                                   p_due_date => current_date + 5);
  select task_id into v_task from supplier_invoices where id = v_inv;
  perform delete_supplier_invoice(v_inv);
  select status into v_stato from tasks where id = v_task;
  if exists (select 1 from supplier_invoices where id = v_inv)
     or v_stato is distinct from 'completato' then
    raise exception 'Fattura: cancellazione o promemoria incoerenti.';
  end if;

  -- 5) DIPENDENTE eliminabile: promemoria completato + cascata
  v_edoc := create_employee_document(p_employee_id => v_emp1,
                                     p_doc_type => (enum_range(null::compliance_doc_type))[1],
                                     p_expiry_date => current_date + 10);
  select task_id into v_task from employee_documents where id = v_edoc;
  perform delete_employee(v_emp1);
  select status into v_stato from tasks where id = v_task;
  if exists (select 1 from employees where id = v_emp1)
     or v_stato is distinct from 'completato' then
    raise exception 'Dipendente: cancellazione o promemoria incoerenti.';
  end if;

  -- 6) FALLIMENTO A META' FORZATO — il caso vero del difetto originale.
  -- Dipendente 2: riceve mance (vincolo RESTRICT) e ha un documento con
  -- promemoria APERTO. La cancellazione completa il promemoria e POI viene
  -- respinta dal vincolo: se l'atomicita' funziona, il promemoria deve
  -- tornare 'da_fare'.
  v_dist := create_tip_distribution(p_entity_id => e1,
    p_period_month => date_trunc('month', current_date)::date,
    p_lines => jsonb_build_array(jsonb_build_object('employee_id', v_emp2, 'amount', 10)),
    p_note => '__prova_B3_mance__');
  v_edoc2 := create_employee_document(p_employee_id => v_emp2,
                                      p_doc_type => (enum_range(null::compliance_doc_type))[1],
                                      p_expiry_date => current_date + 10);
  select task_id into v_task2 from employee_documents where id = v_edoc2;

  respinto := false;
  begin
    perform delete_employee(v_emp2);
  exception when others then respinto := true;
  end;
  if not respinto then
    raise exception 'La cancellazione del dipendente con mance NON e'' stata respinta.';
  end if;
  select status into v_stato from tasks where id = v_task2;
  if v_stato is distinct from 'da_fare' then
    raise exception 'ROLLBACK FALLITO: il promemoria risulta % per un dipendente che esiste ancora.', v_stato;
  end if;

  -- 7) STAFF respinto
  if v_staff is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
    respinto := false;
    begin
      perform delete_employee_document(v_edoc2);
    exception when others then respinto := true;
    end;
    if not respinto then
      raise exception 'Un utente STAFF ha potuto eliminare un documento del personale.';
    end if;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_titolare, 'role', 'authenticated')::text, true);
  end if;

  -- PULIZIA COMPLETA
  perform delete_employee_document(v_edoc2);
  delete from tip_distribution_lines where distribution_id = v_dist;
  delete from tip_distributions where id = v_dist;
  delete from employees where id = v_emp2;
  delete from suppliers where id = v_forn;
  delete from tasks where title like '%__Prova%' or title like '%__ProvaB3%';
  delete from deleted_records
   where record_id in (v_doc::text, v_edoc::text, v_edoc2::text, v_inv::text,
                       v_emp1::text, v_emp2::text, v_dist::text)
      or (table_name in ('employee_documents','tip_distribution_lines')
          and (record->>'employee_id' in (v_emp1::text, v_emp2::text)
               or record->>'distribution_id' = v_dist::text));

  raise notice 'Blocco 3 verificato: 5 cancellazioni con promemoria in transazione, storage_path restituito per la rimozione del file DOPO la riga, dipendente con mance respinto CON promemoria tornato da_fare (rollback dimostrato), staff respinto. Prove ripulite.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260809000004', 'blocco3_cancellazioni_con_promemoria')
on conflict (version) do nothing;

-- Riepilogo: 5 funzioni, zero residui di prova.
select
  (select count(*) from pg_proc where proname in
    ('delete_document','delete_fiscal_tool','delete_employee_document',
     'delete_employee','delete_supplier_invoice'))                             as funzioni_create,
  (select count(*) from employees where first_name like '__ProvaB3%')          as residui_dipendenti,
  (select count(*) from suppliers where name = '__Prova Fornitore B3__')       as residui_fornitori,
  (select count(*) from tasks where title like '%__Prova%')                    as residui_promemoria;
