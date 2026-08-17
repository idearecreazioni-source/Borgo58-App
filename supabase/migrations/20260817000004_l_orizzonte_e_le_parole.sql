-- L'orizzonte che nascondeva un'uscita già registrata, e le parole storte.
--
-- Difetto n. 1 del collaudo del 17/08, e la misura viene prima della cura
-- perché le due ipotesi erano molto diverse.
--
-- 🔴 IL SINTOMO: in Cassa il messaggio dice «un'uscita già registrata per
-- 33,60 € non è ancora nel saldo… la trovi in "Ce la faccio?"». In «Ce la
-- faccio?» non c'era.
--
-- ⚠️ LE DUE IPOTESI, e Alessio ha chiesto di misurare prima di scegliere:
--   (a) le uscite future non vengono lette affatto — cioè la condizione che
--       lui aveva posto il 17/08 non è rispettata;
--   (b) è l'orizzonte: la previsione guarda 30 giorni per impostazione
--       predefinita, e l'assegno cade il 31°.
--
-- MISURATO sul progetto di prova, impersonando il titolare: a 30 giorni
-- l'uscita non compare, a 60 compare come `uscita_futura` con la sua data.
-- **È la (b).** Il meccanismo funziona; il difetto è che un messaggio
-- promette una schermata dove, con l'orizzonte di partenza, quella riga non
-- si vede.
--
-- ⚠️ E LA CURA NON È ALLUNGARE L'ORIZZONTE. Delle due strade che Alessio ha
-- indicato si prende la seconda, e la ragione è che la prima cambia il
-- significato di un numero che ha scelto lui: se «fra 30 giorni» comprende
-- anche il 31° quando lì c'è qualcosa, allora «30» non vuol dire più 30.
-- Invece **il taglio si dichiara** — è la stessa regola dell'elenco delle
-- fatture pagate e di «3 di 12 da pagare»: un elenco tagliato in silenzio
-- sembra completo.

-- =====================================================================
-- 1. `uscite_future` sa anche cosa cade OLTRE un orizzonte
-- =====================================================================
--
-- ⚠️ Il conto lo fa il database, non la schermata. Sarebbe stato più corto
-- sottrarre in JavaScript «tutte le future meno quelle in elenco» — ed è
-- esattamente il genere di somma che il 17/08 ha prodotto un numero
-- sbagliato nell'anteprima dei crediti. Un numero, un posto.
drop function if exists uscite_future(uuid);

create or replace function uscite_future(p_entity_id uuid, p_fino_al date default null)
returns table (
  quante          integer,
  totale          numeric,
  prima_scadenza  date,
  entrate_oggi    integer,
  totale_oggi     numeric,
  quante_oltre    integer,
  totale_oltre    numeric,
  prima_oltre     date
)
language sql
stable
security definer
set search_path = public
as $$
  with oggi as (select (now() at time zone 'Europe/Rome')::date as d)
  select
    count(*) filter (where m.movement_date > o.d)::integer,
    coalesce(sum(m.amount) filter (where m.movement_date > o.d), 0),
    min(m.movement_date) filter (where m.movement_date > o.d),
    count(*) filter (where m.movement_date = o.d and m.supplier_invoice_id is not null)::integer,
    coalesce(sum(m.amount) filter (where m.movement_date = o.d and m.supplier_invoice_id is not null), 0),
    -- ⚠️ Senza orizzonte questi tre restano a zero, e non e' un caso
    -- particolare da ricordare: chi non passa `p_fino_al` non ha un
    -- orizzonte, quindi per lui non esiste un «oltre».
    count(*) filter (where p_fino_al is not null and m.movement_date > p_fino_al)::integer,
    coalesce(sum(m.amount) filter (where p_fino_al is not null and m.movement_date > p_fino_al), 0),
    min(m.movement_date) filter (where p_fino_al is not null and m.movement_date > p_fino_al)
  from cash_movements m
  cross join oggi o
  where m.entity_id = p_entity_id
    and m.direction = 'uscita';
$$;

comment on function uscite_future(uuid, date) is
  'Le uscite di prima nota datate nel futuro (non ancora nei saldi), quelle entrate nel saldo oggi, e — se si passa un orizzonte — quelle che cadono OLTRE. Serve a dichiarare il taglio: la previsione guarda 30 giorni, e un''uscita al 31° non deve sparire in silenzio.';

revoke all on function uscite_future(uuid, date) from public, anon, authenticated;
grant execute on function uscite_future(uuid, date) to authenticated;

-- =====================================================================
-- 2. Le parole storte, e la concordanza
-- =====================================================================
--
-- Piccolezze viste da Alessio, ma non solo estetiche: un messaggio che
-- dice «1 note di credito» è un messaggio scritto da una macchina, e chi
-- legge messaggi scritti da una macchina smette di leggerli.
create or replace function delete_supplier_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $funzione$
declare
  v_inv    supplier_invoices%rowtype;
  v_mov    cash_movements%rowtype;
  v_note   integer;
  v_credit integer;
begin
  if not is_titolare() then
    raise exception 'Solo il titolare puo'' eliminare una fattura';
  end if;

  select * into v_inv from supplier_invoices where id = p_invoice_id for update;
  if v_inv.id is null then
    raise exception 'Fattura non trovata';
  end if;

  select * into v_mov from cash_movements where supplier_invoice_id = p_invoice_id;
  if v_mov.id is not null then
    raise exception
      'Questa fattura risulta pagata: in prima nota c''è un''uscita di % euro del %. Cancellandola resterebbero soldi usciti senza il documento che li giustifica. Annulla prima il pagamento, poi la fattura si può togliere.',
      to_char(v_mov.amount, 'FM999999990.00'),
      to_char(v_mov.movement_date, 'DD/MM/YYYY');
  end if;

  if v_inv.status = 'pagata' then
    raise exception
      'Questa fattura risulta pagata (coperta per intero da note di credito, quindi senza uscita in prima nota). Annulla prima il pagamento.';
  end if;

  select count(*) into v_note from anticipazioni_socio where supplier_invoice_id = p_invoice_id;
  if v_note > 0 then
    raise exception
      'Questa fattura è collegata a % nota «ho messo di tasca mia»: senza la fattura quella nota diventerebbe da sola un costo, e la stessa spesa risulterebbe contata due volte. Togli prima il collegamento.',
      v_note;
  end if;

  select count(*) into v_credit
    from note_credito n
   where n.fattura_id = p_invoice_id
      or exists (select 1 from note_credito_utilizzi u
                  where u.nota_id = n.id and u.fattura_id = p_invoice_id);
  if v_credit > 0 then
    -- La concordanza: «1 nota di credito», «2 note di credito». E il verbo
    -- che le segue cambia con loro.
    raise exception
      'A questa fattura % collegata % di credito. Cancellandola % che % di correggere un documento che non esiste più. Togli prima la nota di credito.',
      case when v_credit = 1 then 'è' else 'sono' end,
      case when v_credit = 1 then '1 nota' else v_credit || ' note' end,
      case when v_credit = 1 then 'resterebbe una nota' else 'resterebbero note' end,
      case when v_credit = 1 then 'dichiara' else 'dichiarano' end;
  end if;

  if v_inv.task_id is not null then
    update tasks set status = 'completato' where id = v_inv.task_id;
  end if;

  delete from supplier_invoices where id = p_invoice_id;
end;
$funzione$;

revoke all on function delete_supplier_invoice(uuid) from public, anon, authenticated;
grant execute on function delete_supplier_invoice(uuid) to authenticated;

-- Il promemoria in Agenda scriveva l'importo grezzo: «Pagare fattura … (74.9€)».
-- Due decimali, la virgola italiana e lo spazio prima del simbolo.
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
      || '— ' || v_fornitore
      || ' (' || replace(to_char(p_amount, 'FM999999990.00'), '.', ',') || ' €)';

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
-- 3. Gli accenti resi con l'apostrofo, nei messaggi che Alessio ha letto
-- =====================================================================
--
-- ⚠️ SI CORREGGE SUL CORPO ESISTENTE, non ricopiando le funzioni. Sono
-- funzioni lunghe che non hanno niente di sbagliato tranne quattro parole:
-- ricopiarle qui vorrebbe dire trascrivere novanta righe per cambiarne una,
-- e una trascrizione a mano è il posto dove nasce una differenza che nessuno
-- vede. Si legge la definizione, si sostituisce la frase, si riesegue — e la
-- verifica pretende che la parola nuova ci sia e la vecchia no.
do $accenti$
declare
  r      record;
  v_def  text;
  v_new  text;
  n      integer := 0;
begin
  for r in
    select * from (values
      ('saldo_tesoreria',                  'non e'' mai stato contato',  'non è mai stato contato'),
      ('saldo_tesoreria',                  'finche'' non lo conti',      'finché non lo conti'),
      ('saldo_tesoreria',                  'questo e'' un numero teorico','questo è un numero teorico'),
      ('riflette_in_carta_sulla_ricetta',  'e'' in carta nel menu',      'è in carta nel menu')
    ) as t(funzione, da, a)
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
     where n2.nspname = 'public' and p.proname = r.funzione;
    if v_def is null then
      raise exception 'La funzione % non esiste: la correzione non sa dove applicarsi.', r.funzione;
    end if;

    -- ⚠️ NEL CORPO L'APOSTROFO È RADDOPPIATO, e al primo colpo l'avevo
    -- girato dalla parte sbagliata: `pg_get_functiondef` restituisce il
    -- corpo *come è scritto dentro la funzione*, dove quella frase vive
    -- dentro una stringa e quindi l'apostrofo è `''`. La frase da cercare
    -- va quindi RADDOPPIATA, non ridotta. Con la versione sbagliata il
    -- blocco non trovava niente e diceva «corrette: 0» — cioè passava
    -- senza fare nulla, che è il modo peggiore di sbagliare.
    v_new := replace(v_def, replace(r.da, chr(39), chr(39) || chr(39)), r.a);
    if v_new = v_def then
      -- Già corretta da un'applicazione precedente: non è un errore.
      continue;
    end if;
    execute v_new;
    n := n + 1;
  end loop;

  raise notice 'Frasi con l''accento reso come apostrofo, corrette: %.', n;
end $accenti$;

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
  v_dom    date;
  r        record;
  n        integer;
  passata  boolean;
  v_msg    text;
  v_lapidi integer;
begin
  select user_id into v_tit from user_roles where role = 'titolare' limit 1;
  if v_tit is null then raise exception 'Nessun titolare: impossibile verificare.'; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_tit, 'role', 'authenticated')::text, true);

  select id into v_ente from entities order by created_at limit 1;
  v_dom := (now() at time zone 'Europe/Rome')::date + 40;
  select count(*) into v_lapidi from deleted_records
   where table_name in ('note_credito', 'supplier_invoices', 'cash_movements');

  insert into suppliers (entity_id, name) values (v_ente, '__VERIFICA__ orizzonte')
    returning id into v_forn;

  -- 1. IL CUORE: un'uscita a 40 giorni. Con un orizzonte a 30 deve contare
  --    fra quelle OLTRE; con uno a 60 no.
  --
  -- ⚠️ SI MISURA LA DIFFERENZA CHE LA PROVA PRODUCE, non un valore assoluto.
  -- Al primo colpo pretendevo che «la prima uscita oltre l'orizzonte» fosse
  -- la mia: sul progetto di prova ce n'era già un'altra prima (l'assegno
  -- dello scenario di collaudo), e la verifica si è fermata su un dato
  -- legittimo. È la lezione del 14/08 — una verifica non deve fallire per
  -- come qualcuno ha apparecchiato — e vale anche quando chi apparecchia
  -- sono i dati di collaudo.
  declare
    q_prima integer; t_prima numeric;
    q_dopo  integer; t_dopo  numeric;
  begin
    select f.quante_oltre, f.totale_oltre into q_prima, t_prima
      from uscite_future(v_ente, (now() at time zone 'Europe/Rome')::date + 30) f;

    insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount, status)
      values (v_ente, v_forn, '__VERIFICA__ OR1', (now() at time zone 'Europe/Rome')::date, 33.60, 'da_pagare')
      returning id into v_inv;
    perform pay_supplier_invoice(v_inv, 'assegno', v_dom, 'ASSEGNO ORIZZONTE');

    select f.quante_oltre, f.totale_oltre into q_dopo, t_dopo
      from uscite_future(v_ente, (now() at time zone 'Europe/Rome')::date + 30) f;

    if q_dopo <> q_prima + 1 or t_dopo <> t_prima + 33.60 then
      raise exception
        'Con un orizzonte a 30 giorni, l''uscita al 40° doveva aggiungersi a quelle oltre: da %/% a %/%, attesi %/%.',
        q_prima, t_prima, q_dopo, t_dopo, q_prima + 1, t_prima + 33.60;
    end if;

    -- E il verso opposto, che è la metà che conta. ⚠️ Non si confronta con
    -- `q_prima`: quello era misurato a un orizzonte diverso, e allungando
    -- l'orizzonte cambiano anche le uscite degli altri. Si misura la
    -- differenza che fa **un giorno di orizzonte** sulla stessa fotografia:
    -- al giorno prima la mia uscita è «oltre», al giorno stesso non lo è
    -- più, e fra le due misure deve ballare esattamente lei.
    declare
      q_giorno_prima integer; t_giorno_prima numeric;
      q_giorno_dopo  integer; t_giorno_dopo  numeric;
    begin
      select f.quante_oltre, f.totale_oltre into q_giorno_prima, t_giorno_prima
        from uscite_future(v_ente, v_dom - 1) f;
      select f.quante_oltre, f.totale_oltre into q_giorno_dopo, t_giorno_dopo
        from uscite_future(v_ente, v_dom) f;
      if q_giorno_prima - q_giorno_dopo <> 1
         or t_giorno_prima - t_giorno_dopo <> 33.60 then
        raise exception
          'Spostando l''orizzonte dal % al %, doveva uscire dal conteggio esattamente la mia uscita da 33,60 (%/% → %/%).',
          v_dom - 1, v_dom, q_giorno_prima, t_giorno_prima, q_giorno_dopo, t_giorno_dopo;
      end if;
    end;
  end;

  -- 2. E senza orizzonte i tre numeri restano a zero, mentre gli altri
  --    continuano a dire la verita': e' il chiamante di Cassa, che non ha
  --    un orizzonte.
  select f.quante, f.quante_oltre into r from uscite_future(v_ente) f;
  if coalesce(r.quante, 0) < 1 then
    raise exception 'Senza orizzonte, le uscite future dovevano essere almeno una.';
  end if;
  if coalesce(r.quante_oltre, 0) <> 0 then
    raise exception 'Senza orizzonte non esiste un «oltre», e invece ne conta %.', r.quante_oltre;
  end if;

  -- 3. La concordanza del rifiuto: con UNA nota dice «1 nota», al singolare.
  v_nota := registra_nota_credito(v_ente, v_forn, (now() at time zone 'Europe/Rome')::date,
                                  5.00, null, 'NC-OR', '__VERIFICA__');
  insert into supplier_invoices (entity_id, supplier_id, invoice_number, invoice_date, amount, status)
    values (v_ente, v_forn, '__VERIFICA__ OR2', (now() at time zone 'Europe/Rome')::date, 50.00, 'da_pagare')
    returning id into v_inv;
  insert into note_credito_utilizzi (nota_id, fattura_id, importo) values (v_nota, v_inv, 5.00);

  passata := false;
  begin
    perform delete_supplier_invoice(v_inv);
    passata := true;
  exception when sqlstate 'P0001' then
    v_msg := sqlerrm;
  end;
  if passata then raise exception 'Ha cancellato una fattura con una nota collegata.'; end if;
  if v_msg not like '%1 nota di credito%' or v_msg like '%1 note di credito%' then
    raise exception 'La concordanza del rifiuto e'' sbagliata: «%»', v_msg;
  end if;
  if v_msg not like '%non esiste più%' then
    raise exception 'Il rifiuto ha ancora l''accento reso con l''apostrofo: «%»', v_msg;
  end if;

  -- 4. Il promemoria in Agenda porta l'importo scritto per un essere umano.
  declare v_inv3 uuid; v_tit3 text;
  begin
    v_inv3 := create_supplier_invoice(v_ente, v_forn, (now() at time zone 'Europe/Rome')::date,
                                      74.90, '__VERIFICA__ OR3',
                                      (now() at time zone 'Europe/Rome')::date + 5, null, null);
    select t.title into v_tit3 from tasks t
      join supplier_invoices i on i.task_id = t.id where i.id = v_inv3;
    if v_tit3 is null or v_tit3 not like '%74,90 €)%' then
      raise exception 'Il promemoria non porta l''importo leggibile: «%»', v_tit3;
    end if;
  end;

  -- 5. Le due funzioni riscritte dal blocco degli accenti dicono la parola
  --    giusta, e non dicono più quella vecchia.
  for r in
    select * from (values
      ('saldo_tesoreria', 'non è mai stato contato', 'non e'' mai stato contato'),
      ('riflette_in_carta_sulla_ricetta', 'è in carta nel menu', 'e'' in carta nel menu')
    ) as t(funzione, deve, non_deve)
  loop
    select pg_get_functiondef(p.oid) into v_msg
      from pg_proc p join pg_namespace n2 on n2.oid = p.pronamespace
     where n2.nspname = 'public' and p.proname = r.funzione;
    if position(r.deve in v_msg) = 0 then
      raise exception 'In % manca la frase corretta «%».', r.funzione, r.deve;
    end if;
    if position(replace(r.non_deve, '''''', '''') in v_msg) > 0 then
      raise exception 'In % è rimasta la frase vecchia «%».', r.funzione, r.non_deve;
    end if;
  end loop;

  -- 6. Il trigger riscritto è ancora agganciato: riscrivere il corpo di una
  --    funzione trigger non tocca il trigger, ma darlo per scontato su una
  --    funzione che protegge la carta dei piatti sarebbe una fiducia mal
  --    messa.
  select count(*) into n from pg_trigger t
   where t.tgname = 'trg_recipes_in_carta' and t.tgenabled = 'O';
  if n <> 1 then raise exception 'Il trigger della carta non è più acceso.'; end if;

  -- 7. Le funzioni riscritte non sono diventate raggiungibili da fuori.
  if has_function_privilege('anon', 'uscite_future(uuid,date)', 'execute')
     or has_function_privilege('anon', 'delete_supplier_invoice(uuid)', 'execute')
     or has_function_privilege('anon', 'create_supplier_invoice(uuid,uuid,date,numeric,text,date,text,text)', 'execute')
     or has_function_privilege('anon', 'saldo_tesoreria(uuid)', 'execute')
     or has_function_privilege('anon', 'riflette_in_carta_sulla_ricetta()', 'execute') then
    raise exception 'Una funzione riscritta è rimasta eseguibile con la chiave pubblica.';
  end if;

  -- PULIZIA
  update supplier_invoices set status = 'da_pagare', paid_at = null, payment_method = null
   where supplier_id = v_forn;
  delete from note_credito_utilizzi
   where fattura_id in (select id from supplier_invoices where supplier_id = v_forn);
  update cash_movements set supplier_invoice_id = null
   where supplier_invoice_id in (select id from supplier_invoices where supplier_id = v_forn);
  delete from cash_movements where business_purpose like '%__VERIFICA__%';
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
  raise notice 'L''orizzonte dichiara cosa cade oltre, e i messaggi sono scritti in italiano.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260817000004', 'l_orizzonte_e_le_parole')
on conflict (version) do nothing;

select
  (select count(*) from cash_movements where movement_date > (now() at time zone 'Europe/Rome')::date)
    as uscite_future_esistenti,
  (select count(*) from tasks where origine_modulo = 'fatture_fornitori') as promemoria_fatture;
