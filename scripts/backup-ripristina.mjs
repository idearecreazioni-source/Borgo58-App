// LA PROVA DI RIPRISTINO CHE NON DISTRUGGE NIENTE — `npm run backup:ripristina`
//
// 🔴 PERCHE' ESISTE (23/08/2026, chiesto da Alessio). La domanda che conta
// di un backup e' una sola: *se domani il database sparisse, questo file
// basterebbe a riavere tutto?* — e l'unico modo di rispondere e' rimetterlo
// su davvero. Ma la procedura che c'era (`npm run prova:ripristina`)
// **svuota il progetto di prova**, cioe' butta lo scenario di collaudo:
// 348 conti, 4.564 righe, due mesi di vita finta. *«Un prezzo che non ha
// senso pagare per una verifica»* — parole sue.
//
// LA STRADA: un **terzo posto**. Sullo stesso motore del progetto di prova
// si crea un database nuovo di zecca (`ripristino_prova`), ci si rimette
// sopra la copia, si contano le righe, e alla fine si butta. Il database
// della prova e la produzione non vengono toccati: sono database diversi
// sulla stessa macchina, come due case sulla stessa via.
//
// ⚠️ NON serve installare niente, non serve Docker, non serve un progetto
// Supabase in piu' (e uno in piu' costerebbe: il piano gratuito ne regge
// due, e sono gia' occupati da produzione e prova).
//
// ---------------------------------------------------------------------
// COME SI RIPRISTINA, e sono tre cose che un `psql -f` a mano non fa
// ---------------------------------------------------------------------
// Misurate il 23/08 provando: senza queste tre, tornano su **467 righe
// invece di 564** e undici tabelle non tornano.
//   1. L'ORDINE: estensioni, forma, **utenti**, poi dati. `user_roles`
//      punta agli utenti: senza di loro le sue righe vengono respinte.
//   2. I TRIGGER SPENTI (`session_replication_role = replica`). Un
//      ripristino rimette i dati com'erano; **non li fa riaccadere**. Con
//      i trigger accesi, gli scenari congelati rifiutano le proprie righe,
//      lo storico degli stati se ne riscrive 42 invece di 28, e le
//      notifiche partirebbero davvero.
//   3. GLI ERRORI SI LEGGONO, non si ignorano: si tollerano solo quelli
//      sui permessi che Supabase gestisce da se'.
//
// ⚠️ E QUESTA PROVA HA GIA' TROVATO UN BUCO VERO: la copia non conteneva
// le **estensioni**, e senza `btree_gist` il vincolo «niente ferie
// sovrapposte» non si ricreava — senza nessun errore sui dati. Adesso
// `npm run backup` le salva (`06_estensioni.sql`) e il vincolo torna.
//
// ⚠️ COSA RESTA FUORI, dichiarato: `pg_cron` si puo' creare solo nel
// database che si chiama `postgres`, e `supabase_vault` vuole uno schema
// che qui non c'e'. Su un progetto Supabase nuovo — cioe' dove un
// ripristino vero andrebbe — ci sono gia' tutti e due. Qui vengono
// segnalati e basta.

import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import {
  esegui,
  fermati,
  interroga,
  leggiConfigurazione,
  obbligatorio,
  soloProva,
  strumento,
  titolo,
} from "./comune.mjs";

/** Il database usa-e-getta. Sempre lo stesso nome: si rifa' e si butta. */
export const DATABASE_DI_PROVA = "ripristino_prova";

/**
 * Cio' che un progetto Supabase nuovo avrebbe gia': i ruoli dell'app e lo
 * schema `auth`. Senza, si starebbe misurando l'assenza di Supabase invece
 * della qualita' della copia.
 *
 * ⚠️ `auth.users` qui e' un moncone: ha la chiave e poco altro. Basta a far
 * reggere le chiavi esterne di `user_roles`, **non** a rimettere su gli
 * utenti veri — e infatti il ripristino degli accessi qui non si prova.
 * Su un progetto vero quella tabella e' quella di Supabase, con tutte le
 * sue colonne.
 */
const PREREQUISITI = `
do $$
declare r text;
begin
  foreach r in array array['anon','authenticated','service_role','supabase_admin','supabase_auth_admin'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;
create schema if not exists auth;
create schema if not exists extensions;
create table if not exists auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz default now()
);
create or replace function auth.uid() returns uuid language sql stable as $f$ select null::uuid $f$;
create or replace function auth.role() returns text language sql stable as $f$ select null::text $f$;
create or replace function auth.jwt() returns jsonb language sql stable as $f$ select '{}'::jsonb $f$;
`;

const CONTA = `
select relname || ' = ' || (xpath('/row/c/text()', xml_count))[1]::text
from (
  select c.relname,
         query_to_xml(format('select count(*) as c from public.%I', c.relname), false, true, '') as xml_count
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
) s order by relname;
`;

/** Gli errori che su Supabase non sono errori: permessi della piattaforma. */
const TOLLERATI =
  /permission denied to change default privileges|must be owner of|permission denied for schema (auth|extensions)|schema "public" already exists/;

/** I conteggi scritti in un file `nome = numero`. */
export function leggiConteggi(testo) {
  const per = new Map();
  for (const riga of testo.split(/\r?\n/)) {
    const m = riga.match(/^(\S+) = (\d+)$/);
    if (m) per.set(m[1], Number(m[2]));
  }
  return per;
}

/** Cosa non torna fra quello che c'era e quello che e' tornato su. */
export function differenzeDiRipristino(attesi, dopo) {
  const fuori = [];
  for (const [tabella, quante] of attesi) {
    const tornate = dopo.get(tabella);
    if (tornate === undefined) fuori.push(`${tabella}: la tabella NON e' stata creata (attese ${quante})`);
    else if (tornate !== quante) fuori.push(`${tabella}: ${tornate} invece di ${quante}`);
  }
  return fuori;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = leggiConfigurazione();
  // La barriera di sempre: si scrive SOLO dove punta la prova.
  const madre = soloProva(
    obbligatorio(config, "DB_URL_PROVA", "Serve il progetto di prova (docs/AMBIENTE_PROVA.md).")
  );
  const url = madre.replace(/\/postgres(\?|$)/, `/${DATABASE_DI_PROVA}$1`);
  if (!url.includes(DATABASE_DI_PROVA)) {
    fermati(
      "Non riesco a ricavare l'indirizzo del database usa-e-getta.",
      "DB_URL_PROVA dovrebbe finire con /postgres."
    );
  }
  const psql = strumento("psql");

  const radice = config.BACKUP_CARTELLA || path.join(os.homedir(), "Desktop", "Backup Borgo 58");
  const indicata = process.argv.slice(2).find((a) => !a.startsWith("--"));
  let cartella = indicata;
  if (!cartella) {
    if (!existsSync(radice)) fermati(`Non trovo nessuna copia in ${radice}.`, "Fai prima: npm run backup");
    const copie = readdirSync(radice).filter((c) => /^\d{4}-\d{2}-\d{2}_\d{4}$/.test(c)).sort();
    if (copie.length === 0) fermati(`Nessuna copia dentro ${radice}.`, "Fai prima: npm run backup");
    cartella = path.join(radice, copie[copie.length - 1]);
  }

  titolo(`Prova di ripristino: ${cartella}`);
  console.log(`  destinazione: il database usa-e-getta «${DATABASE_DI_PROVA}»`);
  console.log("  ⚠️ ne' la produzione ne' il database della prova vengono toccati");

  const temporaneo = (nome, contenuto) => {
    const f = path.join(os.tmpdir(), `borgo58-${nome}-${process.pid}.sql`);
    writeFileSync(f, contenuto, "utf8");
    return f;
  };

  titolo("Rifaccio il database usa-e-getta, vuoto");
  interroga(madre, `drop database if exists ${DATABASE_DI_PROVA} with (force); create database ${DATABASE_DI_PROVA};`);

  const fPre = temporaneo("prereq", PREREQUISITI);
  const pre = esegui(psql, ["-v", "ON_ERROR_STOP=1", "-d", url, "-f", fPre], { silenzioso: true });
  unlinkSync(fPre);
  if (!pre.ok) fermati("Non sono riuscito a preparare ruoli e schema auth.", pre.uscita.slice(0, 600));
  console.log("  ruoli e schema auth: pronti");

  let problemi = 0;
  for (const [file, descrizione] of [
    ["06_estensioni.sql", "le estensioni del motore"],
    ["01_schema.sql", "la forma del database"],
    ["02_dati.sql", "il contenuto delle tabelle"],
  ]) {
    const percorso = path.join(cartella, file);
    if (!existsSync(percorso)) {
      console.log(`\n— ${descrizione}: MANCA dalla copia (${file})`);
      if (file === "02_dati.sql") fermati("Senza i dati non c'e' niente da ripristinare.");
      problemi += 1;
      continue;
    }
    const r = esegui(
      psql,
      ["-d", url, "-c", "set session_replication_role = 'replica'", "-f", percorso],
      { silenzioso: true }
    );
    const errori = r.uscita
      .split(/\r?\n/)
      .filter((l) => /ERROR:/.test(l))
      .filter((l) => !TOLLERATI.test(l))
      // ⚠️ Queste due non sono difetti della copia: su un progetto Supabase
      // nuovo ci sono gia'. Vedi la nota in testa al file.
      .filter((l) => !/can only create extension in database postgres|schema "vault" does not exist/.test(l));
    problemi += errori.length;
    console.log(`\n— ${descrizione}: ${errori.length} errori non previsti`);
    for (const e of errori.slice(0, 8)) {
      console.log("   " + e.replace(/^psql:[^:]+:\d+:\s*/, "").slice(0, 150));
    }
  }

  // --- I conteggi: e' qui che si risponde alla domanda ----------------
  const fConta = temporaneo("conta", CONTA);
  const letto = esegui(psql, ["-A", "-t", "-d", url, "-f", fConta], { silenzioso: true });
  unlinkSync(fConta);
  const dopo = leggiConteggi(letto.uscita.split(/\r?\n/).map((r) => r.trim()).join("\n"));
  const attesi = leggiConteggi(readFileSync(path.join(cartella, "05_conteggi.txt"), "utf8"));
  const diverse = differenzeDiRipristino(attesi, dopo);

  titolo("Com'e' andata");
  const somma = (m) => [...m.values()].reduce((a, b) => a + b, 0);
  console.log(`  tabelle: ${attesi.size} nella copia · ${dopo.size} rimesse su`);
  console.log(`  righe:   ${somma(attesi)} nella copia · ${somma(dopo)} rimesse su`);

  // ⚠️ Il database usa-e-getta si butta SEMPRE, anche quando la prova
  // fallisce: lasciarlo li' costerebbe spazio al progetto di prova, e la
  // prossima esecuzione lo rifa' comunque da zero.
  interroga(madre, `drop database if exists ${DATABASE_DI_PROVA} with (force);`);
  console.log("  il database usa-e-getta e' stato buttato");
  console.log("");
  console.log("  ⚠️ NON e' provato il ripristino degli ACCESSI (03_accessi.sql): qui");
  console.log("     auth.users e' un moncone. Le righe che li nominano tornano su");
  console.log("     lo stesso perche' i controlli sono spenti, come in un ripristino vero.");

  if (diverse.length > 0 || problemi > 0) {
    fermati(
      "LA COPIA NON BASTEREBBE IN CASO DI GUASTO.",
      ...(diverse.length > 0 ? ["", `Righe che non tornano (${diverse.length}):`, ...diverse.slice(0, 20).map((d) => `  ${d}`)] : []),
      ...(problemi > 0 ? ["", `Errori durante il ripristino: ${problemi} (sopra c'e' quali).`] : []),
      "",
      "Va sistemata: un backup che non si rimette su e' una speranza, non una copia."
    );
  }

  console.log("");
  console.log("  IL FILE E' TORNATO SU DAVVERO, e i conteggi tornano tutti.");
  console.log("");
}
