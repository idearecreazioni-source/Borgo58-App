-- ---------------------------------------------------------------------
-- Il ruolo anonimo non deve poter eseguire niente che non sia il form
-- ---------------------------------------------------------------------
-- Nato da un difetto trovato dal validatore l'11/08/2026 su due funzioni
-- dell'email di conferma. Controllando la classe invece del singolo caso
-- (§8 del CLAUDE.md: i guasti che emergono dopo anni sono lo stesso
-- errore ripetuto in venti punti) ne sono venute fuori molte altre.
--
-- IL DIFETTO. In Postgres una funzione appena creata è eseguibile da
-- `public`, cioè da tutti i ruoli. Supabase espone via PostgREST ogni
-- funzione eseguibile da `anon`, e la chiave `anon` è **pubblica**: sta
-- nel bundle del sito, la legge chiunque apra gli strumenti da
-- sviluppatore. Risultato, in produzione, prima di questa migrazione:
-- un estraneo poteva chiamare `merge_customers` (fondere due schede
-- cliente), `register_stock_delivery` e `record_stock_consumption`
-- (movimentare il magazzino), le funzioni della lista della spesa,
-- `send_due_task_reminders` (far partire i promemoria). Nessun dato
-- usciva — le funzioni non restituiscono contenuti — ma **si poteva
-- scrivere nel database del locale dall'esterno**.
--
-- Le funzioni scritte dopo il 10/08 non hanno il difetto: la migrazione
-- `capienza_e_orari` aveva introdotto la revoca esplicita. Quelle prima
-- sono rimaste col permesso di partenza.
--
-- COSA FA QUESTA MIGRAZIONE, E COSA NON FA.
--   - toglie `anon` (e `public`, che lo contiene) da **tutte** le
--     funzioni SECURITY DEFINER dello schema `public`, tranne le due che
--     servono davvero al form pubblico;
--   - **conserva `authenticated` dov'era**. Non è una svista: il
--     corridoio `operazioni-atomiche` chiama le funzioni con il token
--     dell'utente vero, quindi girano come `authenticated`. Toglierlo
--     spegnerebbe il gestionale.
--
-- Che uno staff possa chiamare via RPC un'operazione che dalla schermata
-- non gli sarebbe offerta resta un tema aperto, di un'altra natura
-- (dentro quelle funzioni il controllo dev'essere `is_titolare()`): va
-- affrontato guardandole una per una, non con una revoca in blocco.
--
-- Idempotente: si può rieseguire. Verifica finale che solleva eccezione.

-- ---------------------------------------------------------------------
-- 1. La revoca, conservando i permessi dello staff
-- ---------------------------------------------------------------------
do $$
declare
  r            record;
  v_aveva_auth boolean;
  n_toccate    integer := 0;
begin
  for r in
    select p.oid,
           p.oid::regprocedure::text as firma,
           p.proname
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.prosecdef
       -- Le due porte del form pubblico restano aperte: sono l'unico
       -- varco previsto per il ruolo anonimo (§6 del CLAUDE.md).
       and p.proname not in ('submit_public_reservation', 'public_reservation_options')
  loop
    -- Fotografo il permesso dello staff PRIMA di revocare: se lo aveva
    -- solo per via di `public`, la revoca glielo toglierebbe in silenzio
    -- e il gestionale smetterebbe di funzionare in un punto a caso.
    v_aveva_auth := has_function_privilege('authenticated', r.oid, 'execute');

    execute format('revoke all on function %s from public, anon', r.firma);

    if v_aveva_auth then
      execute format('grant execute on function %s to authenticated', r.firma);
    end if;

    n_toccate := n_toccate + 1;
  end loop;

  raise notice 'Funzioni chiuse al ruolo anonimo: %.', n_toccate;
end $$;

-- ---------------------------------------------------------------------
-- 2. Verifica
-- ---------------------------------------------------------------------
do $verifica$
declare
  r       record;
  n       integer;
  elenco  text := '';
begin
  -- a) nessuna funzione SECURITY DEFINER resta aperta all'anonimo, a
  --    parte le due del form pubblico.
  for r in
    select p.oid::regprocedure::text as firma
      from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public'
       and p.prosecdef
       and p.proname not in ('submit_public_reservation', 'public_reservation_options')
       and has_function_privilege('anon', p.oid, 'execute')
  loop
    elenco := elenco || r.firma || ', ';
  end loop;
  if elenco <> '' then
    raise exception 'Il ruolo anonimo può ancora eseguire: %', elenco;
  end if;

  -- b) le due del form pubblico devono essere rimaste aperte, altrimenti
  --    ho appena spento le prenotazioni dal sito.
  if not has_function_privilege('anon', 'public_reservation_options(date, integer)', 'execute') then
    raise exception 'Il form pubblico non può più leggere gli orari liberi.';
  end if;
  if not has_function_privilege(
       'anon',
       'submit_public_reservation(date, time, integer, text, text, text, text)',
       'execute') then
    raise exception 'Il form pubblico non può più inviare richieste.';
  end if;

  -- c) le funzioni che il gestionale chiama direttamente devono restare
  --    eseguibili dallo staff: sono la prova che non ho rotto niente.
  for r in
    select unnest(array[
      'merge_customers(uuid,uuid)',
      'add_shopping_list_item(uuid,text,uuid,numeric,unit_type,text)',
      'register_stock_delivery(uuid,numeric,uuid,date,text,numeric)',
      'record_stock_consumption(uuid,numeric,text,text)'
    ]) as firma
  loop
    -- Se una firma non esiste più (rinominata in futuro) non fallisco:
    -- il controllo serve a proteggere l'oggi, non a bloccare il domani.
    begin
      if not has_function_privilege('authenticated', r.firma, 'execute') then
        raise exception 'Il gestionale non può più eseguire %.', r.firma;
      end if;
    exception when undefined_function then
      raise notice 'Firma non trovata, salto il controllo: %', r.firma;
    end;
  end loop;

  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prosecdef
     and has_function_privilege('anon', p.oid, 'execute');

  raise notice 'Funzioni SECURITY DEFINER aperte al pubblico: % (devono essere 2).', n;
end
$verifica$;

insert into applied_migrations (version, name)
values ('20260811000002', 'niente_aperto_al_pubblico')
on conflict (version) do nothing;

-- Riepilogo: chi resta aperto al ruolo anonimo.
select p.oid::regprocedure::text as funzione_aperta_al_pubblico
  from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
 where ns.nspname = 'public' and p.prosecdef
   and has_function_privilege('anon', p.oid, 'execute')
 order by 1;
