-- Un importo si scrive in un modo solo, anche dentro un messaggio.
--
-- Piccolezza trovata da Alessio il 17/08 leggendo un rifiuto: dentro il
-- messaggio gli importi erano «25.69 euro» e «10.00» — col punto decimale e
-- la parola «euro» — mentre due righe più sotto la stessa schermata scrive
-- «195,69 €».
--
-- ⚠️ NON È SOLO ESTETICA, ed è la ragione per cui si corregge adesso invece
-- di metterla in fondo: l'incoerenza si nota **proprio dove si sta leggendo
-- con attenzione**. Un rifiuto è il momento in cui qualcuno si ferma a
-- capire cosa è andato storto; è il posto peggiore in cui far sospettare che
-- il numero venga da un'altra parte.
--
-- LA CURA È UN POSTO SOLO. Ogni messaggio scriveva l'importo per conto suo,
-- con `to_char(..., 'FM999999990.00')` e la parola «euro» a mano. Adesso c'è
-- `euro()`, e nessun messaggio formatta più niente.

-- =====================================================================
-- 1. Come si scrive un importo
-- =====================================================================
create or replace function euro(p_importo numeric)
returns text
language sql
immutable
set search_path = public
as $$
  -- Il punto delle migliaia e la virgola dei decimali, come si scrive in
  -- italiano. ⚠️ `to_char` con la maschera `G`/`D` userebbe le impostazioni
  -- locali del server, che su Supabase sono inglesi: si scambiano a mano,
  -- passando da un carattere di servizio che non compare in nessun numero.
  --
  -- ⚠️ L'ULTIMA CIFRA È UNO `0` E NON UN `9`, e ci è voluta la verifica per
  -- accorgersene: con `FM` le cifre `9` non significative spariscono, quindi
  -- zero euro si scriveva «,00 €». Lo `0` impone la cifra anche quando è
  -- zero. È il caso limite che nessuno guarda e che in un gestionale capita
  -- il primo giorno — un saldo a zero, una nota interamente usata.
  select case when p_importo is null then '—'
              else translate(to_char(p_importo, 'FM999G999G990D00'), ',.', '.,') || ' €'
         end;
$$;

comment on function euro(numeric) is
  'Un importo come si scrive in italiano: 1.234,56 €. L''unico posto dove un messaggio del database formatta del denaro (17/08/2026) — prima ogni messaggio lo faceva per conto suo, e i rifiuti dicevano «25.69 euro» mentre la schermata accanto diceva «195,69 €».';

revoke all on function euro(numeric) from public, anon, authenticated;
grant execute on function euro(numeric) to authenticated;

-- =====================================================================
-- 2. Tutti i messaggi che lo scrivevano da soli
-- =====================================================================
--
-- ⚠️ SI CORREGGE SUL CORPO ESISTENTE, come per gli accenti: sono una decina
-- di funzioni lunghe che non hanno niente di sbagliato tranne il modo di
-- scrivere un numero. Ricopiarle qui vorrebbe dire trascrivere qualche
-- centinaio di righe, e una trascrizione a mano è il posto dove nasce una
-- differenza che nessuno vede.
--
-- ⚠️ E DICE QUANTE NE HA TOCCATE. Ieri la stessa tecnica, applicata agli
-- accenti, non trovava niente e sarebbe passata verde: se n'è accorto solo
-- lo zero stampato. La regola del 16/08 — ogni sanatoria dichiara quante
-- righe ha toccato — vale anche per le sanatorie che toccano il codice.
do $importi$
declare
  r      record;
  v_new  text;
  n      integer := 0;
begin
  for r in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as def
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'public' and p.prokind = 'f'
       and pg_get_functiondef(p.oid) like '%FM999999990.00%'
  loop
    -- (a) il numero: `to_char(qualcosa, 'FM999999990.00')` diventa
    --     `euro(qualcosa)`.
    --
    -- ⚠️ IL PEZZO CATTURATO NON PUÒ CONTENERE UN APOSTROFO, e non è un
    -- dettaglio: con `(.*?)` la prima versione inghiottiva un `to_char` di
    -- DATE che stava prima sulla stessa riga — `to_char(v_data,
    -- 'DD/MM/YYYY') || … || to_char(v_mance, 'FM999999990.00')` diventava
    -- `euro(v_data, 'DD/MM/YYYY') || … || to_char(v_mance)`, cioè una
    -- chiamata a due argomenti che non esiste. Due funzioni della tesoreria
    -- hanno smesso di rispondere, e se n'è accorta la suite.
    -- Un'espressione non contiene mai un apostrofo; una maschera di formato
    -- sì. Quel divieto rende la cosa impossibile invece che improbabile.
    v_new := regexp_replace(r.def,
               'to_char\(([^'']*?), ''FM999999990\.00''\)', 'euro(\1)', 'g');
    -- (b) la parola «euro» scritta a mano subito dopo il segnaposto: adesso
    --     ce la mette `euro()`, e «25,69 € euro» sarebbe peggio di prima.
    v_new := replace(v_new, '% euro', '%');
    if v_new = r.def then continue; end if;
    execute v_new;
    n := n + 1;
  end loop;

  raise notice 'Funzioni che scrivevano un importo per conto proprio, corrette: %.', n;
end $importi$;

-- Il promemoria in Agenda lo faceva a modo suo dal 09/08 e ieri l'ho
-- corretto a mano: adesso passa dallo stesso posto degli altri.
create or replace function create_supplier_invoice(
  p_entity_id uuid,
  p_supplier_id uuid,
  p_invoice_date date,
  p_amount numeric,
  p_invoice_number text default null,
  p_due_date date default null,
  p_document_reference text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_fornitore text;
  v_inv  uuid;
  v_task uuid;
  v_titolo text;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare può registrare le fatture';
  end if;
  if p_invoice_date is null then
    raise exception 'Serve la data della fattura';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'L''importo della fattura non può essere negativo o mancante';
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
      || '— ' || v_fornitore || ' (' || euro(p_amount) || ')';

    insert into tasks (title, due_date, category, origine_modulo)
    values (v_titolo, p_due_date, 'fatture_fornitori', 'fatture_fornitori')
    returning id into v_task;

    update supplier_invoices set task_id = v_task where id = v_inv;
  end if;

  return v_inv;
end;
$funzione$;

revoke all on function create_supplier_invoice(uuid, uuid, date, numeric, text, date, text, text)
  from public, anon, authenticated;
grant execute on function create_supplier_invoice(uuid, uuid, date, numeric, text, date, text, text)
  to authenticated;

-- =====================================================================
-- VERIFICA
-- =====================================================================
do $verifica$
declare
  v_tit    uuid;
  v_ente   uuid;
  v_forn   uuid;
  v_inv    uuid;
  v_nota   uuid;
  v_msg    text;
  n        integer;
  passata  boolean;
  v_lapidi integer;
begin
  -- 1. Il formattatore, sui casi che contano.
  if euro(25.69) <> '25,69 €' then
    raise exception 'euro(25.69) doveva dare «25,69 €» e da'' «%».', euro(25.69);
  end if;
  if euro(1234.5) <> '1.234,50 €' then
    raise exception 'euro(1234.5) doveva dare «1.234,50 €» e da'' «%».', euro(1234.5);
  end if;
  if euro(0) <> '0,00 €' then
    raise exception 'euro(0) doveva dare «0,00 €» e da'' «%».', euro(0);
  end if;
  if euro(null) <> '—' then
    raise exception 'euro(null) doveva dare un trattino e da'' «%».', euro(null);
  end if;

  -- 2. LA PROPRIETÀ: nessuna funzione scrive più un importo per conto suo.
  --    Non «ne ho corrette dieci» — un numero è una fotografia, questa è una
  --    regola che resta vera domani (lezione del 16/08).
  select count(*) into n
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prokind = 'f'
     and pg_get_functiondef(p.oid) like '%FM999999990.00%';
  if n <> 0 then
    raise exception '% funzioni scrivono ancora un importo per conto proprio.', n;
  end if;

  -- 2bis. ⚠️ E LE FUNZIONI RISCRITTE RISPONDONO ANCORA. Non è un controllo
  --       di cortesia: la prima versione della sostituzione ha prodotto
  --       chiamate `euro(numero, maschera)` che non esistono, e il corpo
  --       riscritto viene accettato lo stesso — Postgres non risolve le
  --       funzioni chiamate finché non le esegue. Un corpo che si crea non
  --       è un corpo che funziona, e le due della tesoreria sono quelle
  --       dove il `to_char` delle date convive con quello degli importi.
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select user_id from user_roles where role = 'titolare' limit 1),
                      'role', 'authenticated')::text, true);
  perform * from pos_in_transito((select id from entities order by created_at limit 1));
  perform * from saldo_tesoreria((select id from entities order by created_at limit 1));
  perform * from previsione_cassa((select id from entities order by created_at limit 1), null);

  -- 3. E il messaggio vero, letto da dove lo legge Alessio.
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);
  select id into v_ente from entities order by created_at limit 1;
  select count(*) into v_lapidi from deleted_records
   where table_name in ('note_credito', 'supplier_invoices', 'cash_movements');

  insert into suppliers (entity_id, name) values (v_ente, '__VERIFICA__ importi')
    returning id into v_forn;
  insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount, status)
    values (v_ente, v_forn, '__VERIFICA__ IM1', (now() at time zone 'Europe/Rome')::date, 195.69, 'da_pagare')
    returning id into v_inv;
  v_nota := registra_nota_credito(v_ente, v_forn, (now() at time zone 'Europe/Rome')::date,
                                  25.69, v_inv, 'NC-IM', '__VERIFICA__');

  -- È il rifiuto che Alessio ha letto: «portandola a 10,00 si pagherebbe un
  -- importo negativo».
  passata := false;
  begin
    update supplier_invoices set amount = 10.00 where id = v_inv;
    passata := true;
  exception when sqlstate 'P0001' then
    v_msg := sqlerrm;
  end;
  if passata then raise exception 'Ha lasciato abbassare la fattura sotto le note scalate.'; end if;
  if v_msg not like '%25,69 €%' or v_msg not like '%10,00 €%' then
    raise exception 'Il rifiuto scrive ancora gli importi a modo suo: «%»', v_msg;
  end if;
  if v_msg like '% euro%' then
    raise exception 'Il rifiuto dice ancora «euro» accanto al simbolo: «%»', v_msg;
  end if;

  -- 4. E il promemoria in Agenda, che passa dallo stesso posto.
  declare v_inv2 uuid; v_titolo text;
  begin
    v_inv2 := create_supplier_invoice(v_ente, v_forn, (now() at time zone 'Europe/Rome')::date,
                                      1234.50, '__VERIFICA__ IM2',
                                      (now() at time zone 'Europe/Rome')::date + 5, null, null);
    select t.title into v_titolo from tasks t
      join supplier_invoices i on i.task_id = t.id where i.id = v_inv2;
    if v_titolo not like '%(1.234,50 €)%' then
      raise exception 'Il promemoria non scrive l''importo come gli altri: «%»', v_titolo;
    end if;
  end;

  -- 5. `euro` non è raggiungibile con la chiave pubblica.
  if has_function_privilege('anon', 'euro(numeric)', 'execute') then
    raise exception 'euro() è rimasta eseguibile con la chiave pubblica.';
  end if;

  -- PULIZIA
  delete from note_credito_utilizzi
   where fattura_id in (select id from supplier_invoices where supplier_id = v_forn);
  delete from note_credito where supplier_id = v_forn;
  delete from tasks where id in
    (select task_id from supplier_invoices where supplier_id = v_forn and task_id is not null);
  delete from supplier_invoices where supplier_id = v_forn;
  delete from suppliers where id = v_forn;
  delete from deleted_records where record::text like '%__VERIFICA__%';
  delete from deleted_records
   where table_name = 'note_credito' and record->>'supplier_id' = v_forn::text;

  select count(*) into n from deleted_records
   where table_name in ('note_credito', 'supplier_invoices', 'cash_movements');
  if n <> v_lapidi then
    raise exception 'La verifica ha lasciato % lapidi nel registro delle cancellazioni.', n - v_lapidi;
  end if;
  select count(*) into n from suppliers where name like '__VERIFICA__%';
  if n <> 0 then raise exception 'Restano % fornitori di prova.', n; end if;

  perform set_config('request.jwt.claims', null, true);
  raise notice 'Un importo si scrive in un modo solo: 1.234,56 €, anche dentro un messaggio.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260817000005', 'un_importo_si_scrive_in_un_modo_solo')
on conflict (version) do nothing;

select
  (select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.prokind = 'f'
      and pg_get_functiondef(p.oid) like '%FM999999990.00%') as funzioni_che_formattano_da_sole,
  (select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.prokind = 'f'
      and pg_get_functiondef(p.oid) like '%euro(%') as funzioni_che_usano_euro;
