-- ---------------------------------------------------------------------
-- Niente sparisce senza lasciare traccia (deciso da Alessio l'08/08/2026)
-- ---------------------------------------------------------------------
-- Nelle comande vige gia' il principio giusto: una riga inviata non si
-- cancella, si annulla con motivo. Altrove no: un movimento di prima nota,
-- un omaggio, una busta paga cancellati sparivano per sempre. Non e' un
-- problema di sicurezza (cancellare e' riservato al titolare dalla RLS): e'
-- un problema di ricostruibilita' fra tre anni, davanti a una domanda
-- della commercialista o a una verifica.
--
-- Scelta di disegno: NON si aggiunge un "cancellato = si" a ogni tabella.
-- Quella strada obbliga a ricordarsi di filtrarlo in ogni singola query
-- dell'app, per sempre: basta dimenticarne una e le righe cancellate
-- ricompaiono. Qui invece la cancellazione resta quella di prima e il
-- database, da solo, ne conserva una copia integrale.
-- Principio §7: automazione, non disciplina. L'app non cambia di una riga.
--
-- Idempotente (§7 punto 3).

-- ---------------------------------------------------------------------
-- 1. Il registro
-- ---------------------------------------------------------------------
create table if not exists deleted_records (
  id           bigint generated always as identity primary key,
  table_name   text        not null,
  record_id    text,
  record       jsonb       not null,   -- la riga intera com'era
  deleted_at   timestamptz not null default now(),
  deleted_by   uuid                    -- utente applicativo, null se da SQL
);

comment on table deleted_records is
  'Copia integrale di ogni riga cancellata dalle tabelle economicamente o legalmente rilevanti (deciso 08/08/2026). Riempita da un trigger, mai dall''app. Serve a ricostruire cosa c''era, non a ripristinarlo con un click.';

create index if not exists idx_deleted_records_tabella
  on deleted_records(table_name, deleted_at desc);

-- ---------------------------------------------------------------------
-- 2. Il trigger che registra
-- ---------------------------------------------------------------------
-- SECURITY DEFINER: deve poter scrivere nel registro anche quando chi
-- cancella non avrebbe i permessi per scriverci — e infatti nessuno li ha.
create or replace function log_deleted_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into deleted_records (table_name, record_id, record, deleted_by)
  values (
    tg_table_name,
    to_jsonb(old) ->> 'id',
    to_jsonb(old),
    auth.uid()
  );
  return old;
end;
$$;

comment on function log_deleted_record is
  'Trigger BEFORE DELETE: conserva la riga in deleted_records prima che sparisca. Non modifica la riga ne'' blocca la cancellazione.';

-- ---------------------------------------------------------------------
-- 3. Su quali tabelle
-- ---------------------------------------------------------------------
-- Solo dove la traccia serve davvero: soldi, fisco, lavoro, documenti.
-- Non su ricette, tavoli, causali o anagrafiche di servizio, dove una
-- cancellazione e' una correzione e basta.
do $$
declare
  t text;
begin
  foreach t in array array[
    'cash_movements', 'discounts_gifts',
    'payslips', 'tips_collected', 'tip_distributions', 'tip_distribution_lines',
    'employees', 'employee_documents', 'employee_leaves',
    'documents', 'supplier_invoices', 'intercompany_cessions'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise exception 'La tabella % non esiste: elenco da correggere.', t;
    end if;
    execute format('drop trigger if exists trg_log_delete on %I;', t);
    execute format(
      'create trigger trg_log_delete before delete on %I for each row execute function log_deleted_record();',
      t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Chi puo' leggere il registro: solo il titolare
-- ---------------------------------------------------------------------
-- Dentro ci sono buste paga e movimenti di cassa: e' il contenuto piu'
-- riservato del gestionale, raccolto tutto in un posto solo.
-- Nessuno puo' scriverci o cancellarlo dall'app: solo il trigger, che
-- gira con i permessi del proprietario.
alter table deleted_records enable row level security;

drop policy if exists deleted_records_select_titolare on deleted_records;
create policy deleted_records_select_titolare on deleted_records
  for select to authenticated
  using ((select is_titolare()));

grant select on deleted_records to authenticated;
revoke insert, update, delete on deleted_records from authenticated;

-- ---------------------------------------------------------------------
-- 5. Verifica: si cancella davvero qualcosa e si controlla la traccia
-- ---------------------------------------------------------------------
-- §7 punto 2: un meccanismo non e' verificato finche' non lo si e' visto
-- funzionare su una riga vera. Qui si crea un movimento di cassa finto, lo
-- si cancella, si controlla che sia finito nel registro, e si ripulisce
-- tutto — registro compreso, per non lasciare rumore di prova.
do $verifica$
declare
  entita uuid;
  id_prova uuid;
  registrate integer;
  triggers_attivi integer;
begin
  select count(*) into triggers_attivi
  from pg_trigger
  where tgname = 'trg_log_delete' and not tgisinternal;

  if triggers_attivi < 12 then
    raise exception 'Trigger presente solo su % tabelle su 12 attese.', triggers_attivi;
  end if;

  select id into entita from entities order by created_at limit 1;
  if entita is null then
    raise notice 'Nessuna entita'' in tabella: salto la prova pratica, i trigger sono comunque installati.';
    return;
  end if;

  insert into cash_movements (entity_id, direction, amount, note)
  values (entita, 'uscita', 1.23, '__prova_tracciabilita__')
  returning id into id_prova;

  delete from cash_movements where id = id_prova;

  select count(*) into registrate
  from deleted_records
  where table_name = 'cash_movements' and record_id = id_prova::text;

  if registrate = 0 then
    raise exception 'La riga cancellata NON e'' finita nel registro: il meccanismo non funziona.';
  end if;

  if not exists (
    select 1 from deleted_records
    where record_id = id_prova::text and record ->> 'note' = '__prova_tracciabilita__'
  ) then
    raise exception 'La traccia esiste ma non conserva il contenuto della riga.';
  end if;

  delete from deleted_records where record_id = id_prova::text;

  raise notice 'Verificato: la riga cancellata e'' stata conservata con tutto il suo contenuto, e la prova e'' stata ripulita.';
end $verifica$;

insert into applied_migrations (version, name)
values ('20260808000004', 'tracciabilita_cancellazioni')
on conflict (version) do nothing;

-- Riepilogo: 12 tabelle sorvegliate, registro vuoto (nessuna cancellazione
-- vera ancora avvenuta).
select
  (select count(*) from pg_trigger where tgname = 'trg_log_delete' and not tgisinternal) as tabelle_sorvegliate,
  (select count(*) from deleted_records)                                                 as righe_nel_registro;
