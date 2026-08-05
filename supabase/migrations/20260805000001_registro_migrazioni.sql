-- =====================================================================
-- Borgo 58 · Migrazione 0034 — Registro delle migrazioni applicate
-- =====================================================================
-- Colma il punto 1 del debito tecnico di §3.19 e attua il protocollo 4 di
-- §7 del brief.
--
-- PROBLEMA: le migrazioni vengono incollate a mano nell'SQL Editor e non
-- esiste da nessuna parte l'elenco di quelle andate a buon fine. È già
-- successo (04/08) che una fallisse a metà. Su anni, il database reale e
-- i file del repository possono divergere in silenzio — e nessun audit
-- fatto sui file può accorgersene.
--
-- SOLUZIONE IN DUE PARTI:
--   1. Una tabella-registro; da qui in avanti OGNI migrazione si registra
--      da sola come ultima istruzione (vedi blocco finale di questo file,
--      da copiare in coda a tutte le prossime).
--   2. Una retro-rilevazione: invece di fidarsi della memoria, questa
--      migrazione INTERROGA la struttura del database per capire quali
--      delle 33 migrazioni precedenti risultano effettivamente applicate
--      (ogni migrazione ha lasciato una traccia riconoscibile: una
--      tabella, una colonna, una funzione, un indice).
--
-- Nota: NON usa `supabase_migrations.schema_migrations` (la tabella della
-- CLI Supabase) per non interferire con uno strumento che su questa
-- macchina non è utilizzabile (MCP/CLI non funzionanti). Se un domani la
-- CLI venisse adottata, i dati qui sono trasferibili con una query.
-- =====================================================================

create table applied_migrations (
  version    text primary key,                    -- prefisso numerico del file, es. '20260805000001'
  name       text not null,                       -- resto del nome file, senza estensione
  applied_at timestamptz not null default now(),
  note       text
);

comment on table applied_migrations is
  'Registro delle migrazioni applicate al database (§7 protocollo 4, §3.19 punto 1). Ogni migrazione si registra da sola come ultima istruzione. Le righe con note "retro-rilevata" sono state dedotte dalla struttura del database, non registrate al momento dell''applicazione: la loro applied_at NON è la data reale di applicazione.';

-- Sola lettura, e solo per il titolare: è informazione di servizio, non
-- deve comparire da nessuna parte per lo staff. Nessuna policy di
-- scrittura: le migrazioni girano come ruolo postgres dall'SQL Editor e
-- bypassano la RLS, quindi non ne hanno bisogno — e così l'applicazione
-- non può alterare il proprio registro.
alter table applied_migrations enable row level security;
create policy applied_migrations_select_titolare on applied_migrations
  for select to authenticated using ((select is_titolare()));
grant select on applied_migrations to authenticated;

-- ---------------------------------------------------------------------
-- Retro-rilevazione delle 33 migrazioni precedenti
-- ---------------------------------------------------------------------
-- Ogni voce: [versione, nome, interrogazione che dice se è applicata].
-- Le interrogazioni guardano la traccia più caratteristica lasciata da
-- quella migrazione. Se la traccia c'è, la migrazione è (almeno in parte)
-- passata; se manca, quella migrazione NON è stata applicata.
do $mig$
declare
  probes text[][] := array[
    array['20260730000001','multi_entity_ricettario',          $q$select to_regclass('public.entities') is not null$q$],
    array['20260731000001','grants_authenticated',             $q$select has_schema_privilege('authenticated','public','usage')$q$],
    array['20260731000002','calendario_eventi',                $q$select to_regclass('public.reservations') is not null$q$],
    array['20260731000003','public_reservation_form',          $q$select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='submit_public_reservation')$q$],
    array['20260801000001','roles_rls',                        $q$select to_regclass('public.user_roles') is not null$q$],
    array['20260801000002','telegram_trigger',                 $q$select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='notify_reservation_telegram')$q$],
    array['20260802000001','agenda',                           $q$select to_regclass('public.tasks') is not null$q$],
    array['20260802000002','task_reminders',                   $q$select exists(select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='remind_at')$q$],
    array['20260802000003','recipe_status_flags',              $q$select exists(select 1 from information_schema.columns where table_schema='public' and table_name='recipes' and column_name='pronta_per_carta')$q$],
    array['20260802000004','recipe_videos',                    $q$select to_regclass('public.recipe_videos') is not null$q$],
    array['20260802000005','recipe_preparations',              $q$select exists(select 1 from information_schema.columns where table_schema='public' and table_name='recipes' and column_name='recipe_type')$q$],
    array['20260802000006','magazzino',                        $q$select to_regclass('public.stock_lots') is not null$q$],
    array['20260802000007','haccp',                            $q$select to_regclass('public.haccp_equipment') is not null$q$],
    array['20260802000008','fatture_fornitori',                $q$select to_regclass('public.supplier_invoices') is not null$q$],
    array['20260802000009','anagrafica_clienti',               $q$select to_regclass('public.customers') is not null$q$],
    array['20260802000010','export_pdf',                       $q$select exists(select 1 from information_schema.columns where table_schema='public' and table_name='stock_lots_display' and column_name='ingredient_name')$q$],
    array['20260802000011','cassa_prima_nota',                 $q$select to_regclass('public.cash_movements') is not null$q$],
    array['20260802000012','proiezione_fiscale',               $q$select to_regclass('public.fiscal_tools') is not null$q$],
    array['20260802000013','personale',                        $q$select to_regclass('public.employees') is not null$q$],
    array['20260802000014','archivio_documenti',               $q$select to_regclass('public.documents') is not null$q$],
    array['20260802000015','editor_menu',                      $q$select to_regclass('public.daily_menus') is not null$q$],
    array['20260803000001','recipe_menu_description',          $q$select exists(select 1 from information_schema.columns where table_schema='public' and table_name='recipes' and column_name='menu_description')$q$],
    array['20260803000002','agricolo',                         $q$select to_regclass('public.crops') is not null$q$],
    array['20260803000003','cassa_omaggio_device_raccoglitore',$q$select to_regclass('public.pos_devices') is not null$q$],
    array['20260803000004','raccolta_propria',                 $q$select to_regclass('public.foraged_items') is not null$q$],
    array['20260804000001','task_visibility',                  $q$select exists(select 1 from information_schema.columns where table_schema='public' and table_name='tasks' and column_name='visibile_staff')$q$],
    array['20260804000002','task_visibility_fix',              $q$select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_task_visibility' and pg_get_functiondef(p.oid) ilike '%tg_op%')$q$],
    array['20260804000003','customer_economics',               $q$select to_regclass('public.idx_discounts_gifts_customer') is not null$q$],
    array['20260804000004','anagrafica_fornitori',             $q$select exists(select 1 from information_schema.columns where table_schema='public' and table_name='suppliers' and column_name='tax_code')$q$],
    array['20260804000005','comande',                          $q$select to_regclass('public.orders') is not null$q$],
    array['20260804000006','comande_entity_default',           $q$select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_order_entity_srls')$q$],
    array['20260804000007','comande_entity_default_fix',       $q$select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_order_entity_srls' and p.prosecdef)$q$],
    array['20260804000008','dining_tables',                    $q$select to_regclass('public.dining_tables') is not null$q$]
  ];
  i int;
  applicata boolean;
  mancanti text := '';
begin
  for i in 1 .. array_length(probes, 1) loop
    execute probes[i][3] into applicata;
    if applicata then
      insert into applied_migrations (version, name, note)
      values (probes[i][1], probes[i][2], 'retro-rilevata dalla struttura del database — applied_at NON è la data reale')
      on conflict (version) do nothing;
    else
      mancanti := mancanti || probes[i][1] || '_' || probes[i][2] || '  ';
    end if;
  end loop;

  if mancanti <> '' then
    raise warning 'MIGRAZIONI RISULTATE NON APPLICATE: %', mancanti;
  end if;
end $mig$;

-- ---------------------------------------------------------------------
-- Verifica finale (§7 protocollo 3) — fallisce rumorosamente se qualcosa
-- non ha funzionato, invece di lasciare un "Success" ingannevole
-- ---------------------------------------------------------------------
do $verifica$
declare
  n int;
begin
  select count(*) into n from applied_migrations;
  if n = 0 then
    raise exception 'Registro vuoto: la retro-rilevazione non ha riconosciuto nessuna migrazione. Non proseguire, qualcosa non torna.';
  end if;
  raise notice 'Registro creato: % migrazioni precedenti riconosciute.', n;
end $verifica$;

-- ---------------------------------------------------------------------
-- Auto-registrazione — DA COPIARE IN CODA A OGNI MIGRAZIONE FUTURA
-- ---------------------------------------------------------------------
insert into applied_migrations (version, name)
values ('20260805000001', 'registro_migrazioni')
on conflict (version) do nothing;

-- Mostra il registro completo: è il risultato che deve comparire nel
-- pannello dei risultati dell'SQL Editor. Attese 34 righe.
select version, name, applied_at, coalesce(note, 'registrata al momento dell''applicazione') as origine
from applied_migrations
order by version;
