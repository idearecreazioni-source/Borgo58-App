// LA PROVA DI RICARICA — `npm run ricostruzione:verifica`
//
// 🔴 PERCHE' ESISTE (25/08/2026, mandato del validatore). In produzione ci
// sono QUATTRO casi in cui una migrazione con numero piu' BASSO e' stata
// applicata DOPO una con numero piu' alto:
//
//     20260820000012  applicata 11,2 ore DOPO  20260821000001
//     20260823000012  applicata  1,2 ore DOPO  20260823000013
//     20260824000030  applicata  3,1 ore DOPO  20260824000031
//     20260824000033  applicata  7,8 ore DOPO  20260824000034
//
// Non e' un caso isolato: e' una famiglia di quattro. E il numero e' cio'
// che comanda l'ordine **quando si ricostruisce tutto da zero**, cioe'
// quando si ricarica un salvataggio: il gestionale e' stato COSTRUITO in
// un ordine e verrebbe RICOSTRUITO in un altro. Finche' il database e'
// quasi vuoto costa poco; il giorno dopo l'apertura costa tutto.
//
// ⚠️ COSA PROVA QUESTO COMANDO: che le migrazioni del repository,
// applicate **in ordine di numero** su un database vuoto, arrivano in
// fondo — e che lo schema che ne esce e' lo stesso del progetto di prova.
//
// ⚠️ DOVE GIRA, e non e' un dettaglio: su un database USA E GETTA
// (`ricostruzione_prova`) creato sullo stesso motore del progetto di
// prova, come fa gia' `npm run backup:ripristina` dal 23/08. La
// produzione non viene toccata (`soloProva()` ferma tutto se la stringa
// di collegamento la nomina) e **nemmeno il progetto di prova**: sono
// database diversi sulla stessa macchina, come due case sulla stessa via.
// Alla fine si butta.
//
// ---------------------------------------------------------------------
// ⚠️ COSA QUESTO COMANDO NON PROVA, dichiarato perche' non si scambi per
//    altro. Un database creato con `create database` non e' un progetto
//    Supabase: non ha `auth`, non ha `pg_cron`, non ha `pg_net`, non ha
//    il Vault. Qui vengono ricostruiti come MONCONI — abbastanza perche'
//    le migrazioni girino, non abbastanza per dire che quelle parti
//    funzionano. In concreto:
//      · i lavori pianificati non vengono davvero programmati;
//      · nessuna notifica parte;
//      · il Vault non conserva niente.
//    Quello che si prova e' l'ORDINE e la FORMA, che e' cio' che il
//    mandato chiede. Chi legge questo referto non concluda altro.
// ---------------------------------------------------------------------

import { readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  esegui,
  fermati,
  interroga,
  leggiConfigurazione,
  obbligatorio,
  soloProva,
  strumento,
  titolo,
  versioniDoppie,
  formaDelDatabase,
  argomentiMigrazione,
} from "./comune.mjs";

/** Il database usa-e-getta. Sempre lo stesso nome: si rifa' e si butta. */
const DATABASE = "ricostruzione_prova";

/** I quattro utenti che le migrazioni di verifica impersonano. */
const UTENTI = [
  ["alessio@borgo58.app", "titolare"],
  ["test-titolare@borgo58.app", "titolare"],
  ["staff@borgo58.app", "staff"],
  ["test-staff@borgo58.app", "staff"],
];

// ⚠️ `auth.uid()` NON e' un moncone che risponde null, ed e' la
// differenza che decide se questa prova prova qualcosa: le verifiche
// dentro le migrazioni impersonano un titolare scrivendo i claims, e con
// un `uid()` sempre vuoto girerebbero tutte come «nessuno» — passando
// per la ragione sbagliata. Questa e' la stessa forma che usa Supabase.
const PREREQUISITI = `
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated','service_role','supabase_admin','supabase_auth_admin','postgres'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;

create schema if not exists auth;
create schema if not exists extensions;
create schema if not exists graphql_public;

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid language sql stable as $f$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ), '')::uuid
$f$;

create or replace function auth.role() returns text language sql stable as $f$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    'postgres')
$f$;

create or replace function auth.jwt() returns jsonb language sql stable as $f$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$f$;

-- I lavori pianificati: un moncone che ACCETTA e non esegue. Serve a far
-- girare le migrazioni, non a dire che i lavori partono.
create schema if not exists cron;
create table if not exists cron.job (
  jobid bigserial primary key,
  schedule text,
  command text,
  nodename text default 'localhost',
  nodeport int default 5432,
  database text default current_database(),
  username text default current_user,
  active boolean default true,
  jobname text unique
);
create or replace function cron.schedule(p_nome text, p_quando text, p_comando text)
returns bigint language plpgsql as $f$
declare v bigint;
begin
  insert into cron.job (jobname, schedule, command) values (p_nome, p_quando, p_comando)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid into v;
  return v;
end $f$;
create or replace function cron.schedule(p_quando text, p_comando text)
returns bigint language sql as $f$ select cron.schedule(md5(p_comando), p_quando, p_comando) $f$;
create or replace function cron.unschedule(p_nome text) returns boolean language sql as $f$
  delete from cron.job where jobname = p_nome; select true;
$f$;
create or replace function cron.unschedule(p_id bigint) returns boolean language sql as $f$
  delete from cron.job where jobid = p_id; select true;
$f$;

-- Le chiamate verso l'esterno NON sono un moncone: pg_net si installa
-- davvero anche qui (provato, non dedotto). Le migrazioni la creano da se'
-- con "create extension if not exists pg_net", e da li' in poi lo schema
-- net e' quello vero. Le chiamate pero' partirebbero davvero: e' proprio
-- il motivo per cui questo database e' usa-e-getta e vuoto — non c'e'
-- nessuna riga da notificare, quindi nessun trigger ha di che partire.

-- Il deposito dei file (l'Archivio Documenti): un moncone con le due
-- tabelle che le migrazioni nominano. Nessun file ci passa davvero.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text,
  owner uuid,
  metadata jsonb,
  path_tokens text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now()
);
alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;

-- Il Vault: un moncone che conserva in chiaro. Non conserva NIENTE di
-- vero — qui dentro non ci vanno segreti.
create schema if not exists vault;
create table if not exists vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  secret text,
  description text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create or replace view vault.decrypted_secrets as
  select id, name, secret as decrypted_secret, description, created_at, updated_at from vault.secrets;
create or replace function vault.create_secret(p_secret text, p_name text default null, p_description text default '')
returns uuid language plpgsql as $f$
declare v uuid;
begin
  insert into vault.secrets (name, secret, description) values (p_name, p_secret, p_description)
  on conflict (name) do update set secret = excluded.secret returning id into v;
  return v;
end $f$;

-- ⚠️ I DUE VALORI CHE ALCUNE MIGRAZIONI PRETENDONO DI TROVARE. Non e' un
-- difetto scoperto qui: e' un prerequisito che "npm run prova:ricostruisci"
-- semina allo stesso modo dal 10/08 — la migrazione della blindatura delle
-- notifiche si ferma apposta se il Vault e' vuoto, ed e' giusto che lo
-- faccia. Qui sono valori a caso: nessun segreto vero entra in un database
-- usa-e-getta.
select vault.create_secret(encode(gen_random_bytes(24), 'hex'), 'notifiche_firma',
  'Valore a caso della prova di ricarica. Non apre niente.');
select vault.create_secret('chiave-finta-della-prova-di-ricarica', 'chiave_anon',
  'Valore finto della prova di ricarica. Non apre niente.');

-- ⚠️ I PERMESSI SUGLI SCHEMI DI SERVIZIO. Su un progetto Supabase vero i
-- ruoli dell'app arrivano a "auth", "storage" e alle estensioni; su un
-- database creato a mano no, e la prima migrazione che nomina auth.users
-- dentro una funzione si ferma con «permission denied for schema auth».
-- E' un limite di questo posto, non del repository.
-- ⚠️ Lo schema net non e' in elenco apposta: nasce piu' avanti, quando
--    una migrazione installa pg_net. Gli schemi che non ci sono
--    ancora si saltano invece di far fermare tutto.
do $$
declare s text;
begin
  foreach s in array array['auth','storage','extensions','cron','vault','graphql_public'] loop
    if not exists (select 1 from information_schema.schemata where schema_name = s) then
      continue;
    end if;
    execute format('grant usage on schema %I to anon, authenticated, service_role, postgres', s);
    execute format('grant select on all tables in schema %I to anon, authenticated, service_role, postgres', s);
    execute format('grant execute on all functions in schema %I to anon, authenticated, service_role, postgres', s);
  end loop;
end $$;
`;

// I ruoli si assegnano SUBITO DOPO la migrazione che crea `user_roles`:
// da li' in poi le verifiche impersonano un titolare e uno staff, e senza
// righe si fermerebbero.
const SEMINA_RUOLI = `
insert into user_roles (user_id, role)
select id, (case when email in ('alessio@borgo58.app', 'test-titolare@borgo58.app')
                 then 'titolare' else 'staff' end)::app_role
from auth.users
on conflict do nothing;
`;

// ---------------------------------------------------------------------
// Cosa si confronta: la FORMA, non i dati. Il database ricostruito e'
// vuoto per definizione — quello che deve coincidere e' lo scheletro.
// ---------------------------------------------------------------------
const FORMA = `
select 'tabella: ' || table_name || '.' || column_name || ' ' || data_type ||
       coalesce(' null:' || is_nullable, '') || coalesce(' def:' || column_default, '')
  from information_schema.columns where table_schema = 'public'
union all
select 'vincolo: ' || c.conname || ' ' || pg_get_constraintdef(c.oid)
  from pg_constraint c join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public'
union all
select 'indice: ' || indexname || ' ' || indexdef from pg_indexes where schemaname = 'public'
union all
select 'funzione: ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
union all
select 'trigger: ' || t.tgname || ' su ' || c.relname
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and not t.tgisinternal
union all
select 'policy: ' || tablename || '.' || policyname || ' ' || cmd from pg_policies where schemaname = 'public'
order by 1;
`;

// ---------------------------------------------------------------------

const config = leggiConfigurazione();
const madre = obbligatorio(config, "DB_URL_PROVA", "manca in .env");
soloProva(madre);

if (!/\/postgres(\?|$)/.test(madre)) {
  fermati("DB_URL_PROVA dovrebbe finire con /postgres.");
}
const url = madre.replace(/\/postgres(\?|$)/, `/${DATABASE}$1`);
const psql = strumento("psql");

const temporaneo = (nome, contenuto) => {
  const f = path.join(os.tmpdir(), `borgo58-${nome}-${process.pid}.sql`);
  writeFileSync(f, contenuto, "utf8");
  return f;
};
const applica = (contenuto, nome) => {
  const f = temporaneo(nome, contenuto);
  const r = esegui(psql, ["-v", "ON_ERROR_STOP=1", "-d", url, "-f", f], { silenzioso: true });
  unlinkSync(f);
  return r;
};

// ⚠️ PRIMA DI TUTTO: due file con lo STESSO numero di versione. E' una
// proprieta' della cartella, non uno stato del database — e il 22/08 e'
// costato una migrazione che non e' mai girata mentre lo strumento diceva
// che andava tutto bene.
const sulDisco = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .map((file) => ({ file, versione: file.slice(0, file.indexOf("_")) }));
const doppie = versioniDoppie(sulDisco);
if (doppie.length) {
  fermati(
    "Ci sono migrazioni diverse con lo stesso numero di versione:",
    ...doppie.map((d) => "  " + d)
  );
}

const migrazioni = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  // ⚠️ IN ORDINE DI NUMERO — che e' il punto di questo comando. Il nome
  // del file comincia col numero di versione, quindi l'ordine alfabetico
  // E' l'ordine di numero.
  .sort();

titolo("La prova di ricarica — le migrazioni in ordine di NUMERO");
console.log(`   database usa-e-getta:  ${DATABASE}`);
console.log(`   migrazioni da provare: ${migrazioni.length}`);
console.log("");

interroga(madre, `drop database if exists ${DATABASE} with (force); create database ${DATABASE};`);
console.log("  database rifatto, vuoto");

const pre = applica(PREREQUISITI, "prereq");
if (!pre.ok) {
  // ⚠️ La CODA, non la testa: con ON_ERROR_STOP psql si ferma al primo
  //    errore, quindi il motivo è l ultima cosa che ha scritto.
  fermati("Non sono riuscito a preparare il database vuoto.", pre.uscita.slice(-1200));
}
for (const [email] of UTENTI) {
  interroga(url, `insert into auth.users (email) values ('${email}') on conflict do nothing;`);
}
console.log(`  prerequisiti pronti: ${UTENTI.length} utenti, schemi auth/cron/net/vault`);
console.log("");

const neutralizzate = [];
const rinfrescate = [];
let seminati = false;
const fermate = [];
let numero = 0;
for (const file of migrazioni) {
  numero++;
  // 🔴 L'UNICA RIGA CHE VIENE NEUTRALIZZATA, e va dichiarata: su questo
  // motore `pg_cron` si puo' creare SOLO nel database che si chiama
  // `postgres` — lo dice il motore, misurato provandolo. Non e' un
  // difetto del repository: e' un limite del posto in cui gira questa
  // prova. Lo schema `cron` esiste come moncone (vedi PREREQUISITI), e
  // quella sola riga viene commentata nel testo applicato. Il FILE non si
  // tocca. ⚠️ Conseguenza: i lavori pianificati qui NON vengono davvero
  // programmati — solo registrati in una tabella che gli somiglia.
  const percorso = path.join("supabase/migrations", file);
  const originale = readFileSync(percorso, "utf8");

  // 🔴 LA MINA DEL 23/08 — E LA CURA SCRITTA ALLORA NON FUNZIONA, misurato
  // oggi. Una migrazione che cicla su `pg_proc` chiedendo
  // `pg_get_functiondef()` si ferma con «array_agg is an aggregate
  // function»: col piano sbagliato il motore calcola la definizione di
  // OGNI funzione del catalogo — comprese le aggregate di `pg_catalog` —
  // prima di filtrare lo schema. Non e' un dato sbagliato: e' il piano.
  //
  // ⚠️ Misurato sul database ricostruito, con 247 funzioni in `public`:
  //      · com'e'                        → si ferma
  //      · dopo `analyze`                → SI FERMA LO STESSO
  //      · dopo `vacuum analyze`         → SI FERMA LO STESSO
  //      · con `enable_seqscan = off`    → passa
  //      · con `p.prokind = 'f'` nel where → passa
  //    La nota del 23/08 («si rilancia dopo un analyze») descriveva quello
  //    che era bastato quel giorno, non una cura: con il catalogo pieno
  //    non basta piu'.
  //
  // ⚠️ QUESTO E' UN AGGIRAMENTO DEL PIANO, NON LA CURA. La cura vera e'
  //    `and p.prokind = 'f'` dentro quelle query — ma sta in migrazioni
  //    GIA' APPLICATE, e quelle non si riscrivono. Una migrazione nuova
  //    non puo' sanarle, perche' arriverebbe dopo il punto in cui la
  //    ricostruzione si ferma. Quindi la cura vive qui, nello strumento —
  //    ed e' scritta anche in `docs/CODA_E_DECISIONI.md`, perche' chi fara'
  //    un ripristino vero deve saperlo prima e non dopo.
  const chiedeIlCatalogo = /pg_get_functiondef/.test(originale);
  if (chiedeIlCatalogo) rinfrescate.push(file);
  let daApplicare = percorso;
  let temporaneoDaTogliere = null;
  if (/create\s+extension\s+if\s+not\s+exists\s+pg_cron/i.test(originale)) {
    temporaneoDaTogliere = temporaneo(
      `mig-${numero}`,
      originale.replace(
        /create\s+extension\s+if\s+not\s+exists\s+pg_cron\s*;/gi,
        "-- (pg_cron: si crea solo nel database postgres — neutralizzata dalla prova di ricarica)"
      )
    );
    daApplicare = temporaneoDaTogliere;
    neutralizzate.push(file);
  }
  const r = esegui(
    psql,
    [
      "-v", "ON_ERROR_STOP=1",
      // Stessa regola della produzione: atomica salvo enum. Se qui girasse
      // diversamente, questa prova generale proverebbe una cosa che non succede.
      ...(argomentiMigrazione(url, daApplicare).atomica ? ["--single-transaction"] : []),
      "-d", url,
      ...(chiedeIlCatalogo ? ["-c", "set enable_seqscan = off"] : []),
      "-f", daApplicare,
    ],
    { silenzioso: true }
  );
  if (temporaneoDaTogliere) unlinkSync(temporaneoDaTogliere);
  if (!r.ok) {
    // ⚠️ NON CI SI FERMA AL PRIMO, e la ragione e' che fermarsi darebbe una
    //    risposta piu' corta con l'aria di essere intera: si saprebbe di UN
    //    punto rotto e niente sugli altri duecento. Si prosegue e si
    //    raccoglie tutto.
    //
    // ⚠️ E lo schema resta confrontabile lo stesso, perche' queste si
    //    fermano nel blocco di VERIFICA, dopo le DDL: una migrazione che
    //    fallisce alla fine lascia dentro il lavoro gia' fatto (§8 del
    //    25/08), e psql committa un'istruzione per volta.
    fermate.push({
      file,
      numero,
      motivo: (r.uscita.split(/\r?\n/).filter((l) => /ERROR:/.test(l)).pop() || "?")
        .replace(/^psql:[^:]+:\d+:\s*/, "")
        .slice(0, 200),
    });
  }
  if (!seminati) {
    const ci = interroga(url, "select count(*) from information_schema.tables where table_name = 'user_roles';").trim();
    if (ci === "1") {
      applica(SEMINA_RUOLI, "ruoli");
      seminati = true;
      console.log(`  ${String(numero).padStart(3, " ")}/${migrazioni.length}  ruoli assegnati ai ${UTENTI.length} utenti`);
    }
  }
  if (numero % 25 === 0) {
    console.log(`  ${String(numero).padStart(3, " ")}/${migrazioni.length}  …`);
  }
}

console.log(`  ${migrazioni.length}/${migrazioni.length}  camminate tutte`);
console.log("");

// 🔴 LA DOMANDA CHE CONTA DAVVERO NON E' «QUANTE SI SONO FERMATE», e ci
// e' voluto un giro per capirlo: e' **se il registro finale e' completo**.
// Una migrazione che si ferma nel blocco di verifica ha gia' fatto le sue
// DDL, ma non arriva a registrarsi — e un registro piu' corto dei file
// applicati e' la famiglia della risposta con l'aria di essere intera:
// il giorno dopo `npm run migra` direbbe che manca qualcosa che c'e' gia'.
const registrate = Number(
  interroga(url, "select count(*) from applied_migrations;").trim()
);
console.log(`  file applicati: ${migrazioni.length}  ·  registrati: ${registrate}`);
if (registrate === migrazioni.length) {
  console.log("  ✅ IL REGISTRO E' COMPLETO: ogni file ha la sua riga.");
} else {
  console.log(`  🔴 IL REGISTRO E' PIU' CORTO DI ${migrazioni.length - registrate} RIGHE.`);
}
console.log("");

if (fermate.length) {
  console.log(`  ⚠️ ${fermate.length} migrazioni si sono fermate nel loro blocco di VERIFICA`);
  console.log("     (le DDL erano gia' passate — e' il motivo per cui lo schema torna):");
  console.log("");
  for (const f of fermate) {
    console.log(`     ${String(f.numero).padStart(3, " ")}ª  ${f.file}`);
    console.log(`          ${f.motivo}`);
  }
  console.log("");
  console.log("");
  console.log("  ⚠️ NON E' UN FALLIMENTO DELLA RICOSTRUZIONE, ed e' la parte che");
  console.log("     va letta bene: quei file NON si riscrivono — una migrazione");
  console.log("     applicata racconta cosa e' successo quel giorno. I loro tre");
  console.log("     controlli vengono RIFATTI con roba propria dalla");
  console.log("     20260825000012, che poi registra le tre versioni: e' per");
  console.log("     questo che il registro qui sopra risulta completo.");
  console.log("     Il seguito e' in docs/CODA_E_DECISIONI.md, voce 0-zero.");
} else {
  console.log("  ✅ Tutte e 245 arrivano in fondo in ordine di numero.");
}
console.log("");

if (neutralizzate.length) {
  console.log(`  ⚠️ In ${neutralizzate.length} file la riga di pg_cron e' stata neutralizzata:`);
  console.log("     su questo motore quell'estensione si crea solo nel database");
  console.log("     «postgres». I lavori pianificati NON sono stati programmati.");
}
if (rinfrescate.length) {
  console.log(`  ⚠️ ${rinfrescate.length} file interrogano il catalogo delle funzioni e sono stati`);
  console.log("     applicati con «enable_seqscan = off»: senza, si fermano con");
  console.log("     «array_agg is an aggregate function». Vedi la nota nel file.");
}
console.log("");
console.log("");

// --- Il confronto: la FORMA, non i dati ------------------------------
titolo("Confronto con il progetto di prova");
const fForma = temporaneo("forma", FORMA);
const qui = esegui(psql, ["-A", "-t", "-d", url, "-f", fForma], { silenzioso: true }).uscita;
const la = esegui(psql, ["-A", "-t", "-d", madre, "-f", fForma], { silenzioso: true }).uscita;
unlinkSync(fForma);

// ⚠️ Il confronto ignora SOLO le parentesi, e il perche' sta accanto a
//    `formaDelDatabase()` in comune.mjs — con la sua prova al contrario
//    in tests/unita/forma-database.test.js.
const righe = formaDelDatabase;
const a = righe(qui);
const b = righe(la);
const soloQui = [...a].filter((x) => !b.has(x)).sort();
const soloLa = [...b].filter((x) => !a.has(x)).sort();

console.log(`   ricostruito da zero:   ${a.size} elementi di forma`);
console.log(`   progetto di prova:     ${b.size} elementi di forma`);
console.log("");

if (soloQui.length === 0 && soloLa.length === 0) {
  console.log("  ✅ LA RICOSTRUZIONE IN ORDINE DI NUMERO PRODUCE LO STESSO SCHEMA.");
  console.log("     Non e' un conteggio: e' una proprieta' — nessun elemento di forma");
  console.log("     sta da una parte e non dall'altra.");
} else {
  console.log(`  🔴 DIFFERENZE: ${soloQui.length} solo nel ricostruito, ${soloLa.length} solo nella prova.`);
  for (const x of soloQui.slice(0, 25)) console.log("     + " + x.slice(0, 190));
  for (const x of soloLa.slice(0, 25)) console.log("     − " + x.slice(0, 190));
  if (soloQui.length + soloLa.length > 50) console.log(`     … e altre ${soloQui.length + soloLa.length - 50}`);
}

console.log("");
console.log("  ⚠️ Cosa questo NON prova: che i lavori pianificati partano, che le");
console.log("     notifiche escano, che il Vault conservi. Qui sono monconi — vedi");
console.log("     la nota in testa a scripts/ricostruzione-verifica.mjs.");

interroga(madre, `drop database if exists ${DATABASE} with (force);`);
console.log("");
console.log(`  Il database usa-e-getta e' stato buttato.`);
process.exit(soloQui.length + soloLa.length === 0 ? 0 : 1);
