// PROVA DI RIPRISTINO — `npm run prova:ripristina`
//
// Prende l'ultima copia di sicurezza fatta con `npm run backup` e la
// rimette in piedi sul progetto di PROVA, poi conta le righe tabella per
// tabella e le confronta con quelle del giorno della copia.
//
// Serve a rispondere all'unica domanda che conta di un backup: "se domani
// il database sparisse, questa cartella basterebbe a riavere tutto?".
// Un backup mai ripristinato e' una speranza, non una copia.
//
// Non tocca MAI il database vero: scrive solo dove punta DB_URL_PROVA, e
// `soloProva()` interrompe il programma se quella stringa e' quella vera.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  leggiConfigurazione,
  obbligatorio,
  soloProva,
  strumento,
  esegui,
  interroga,
  fermati,
  titolo,
} from "./comune.mjs";

const SQL_CONTEGGI = `
select relname || ' = ' || (xpath('/row/c/text()', xml_count))[1]::text as riga
from (
  select c.relname,
         query_to_xml(format('select count(*) as c from public.%I', c.relname), false, true, '') as xml_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
) s
order by relname;
`;

const config = leggiConfigurazione();
const url = soloProva(obbligatorio(config, "DB_URL_PROVA", "E' la stringa 'Session pooler' del progetto Borgo58-Prova."));
const psql = strumento("psql");

// La cartella da ripristinare: quella indicata a mano, o l'ultima fatta.
const indicata = process.argv.slice(2).find((a) => !a.startsWith("--"));
const radice = config.BACKUP_CARTELLA || path.join(os.homedir(), "Desktop", "Backup Borgo 58");
let cartella = indicata;
if (!cartella) {
  if (!existsSync(radice)) fermati(`Non trovo nessuna copia di sicurezza in ${radice}.`, "Fai prima: npm run backup");
  const copie = readdirSync(radice).sort();
  if (copie.length === 0) fermati(`Nessuna copia dentro ${radice}.`, "Fai prima: npm run backup");
  cartella = path.join(radice, copie[copie.length - 1]);
}
for (const necessario of ["01_schema.sql", "02_dati.sql", "05_conteggi.txt"]) {
  if (!existsSync(path.join(cartella, necessario))) {
    fermati(`Nella copia manca ${necessario}.`, `Cartella controllata: ${cartella}`);
  }
}

console.log(`Ripristino della copia: ${cartella}`);
console.log("Destinazione: progetto di PROVA (il database vero non viene toccato).");

function sql(comando, descrizione) {
  const r = esegui(psql, ["-v", "ON_ERROR_STOP=1", "-d", url, "-c", comando], { silenzioso: true });
  if (!r.ok) fermati(`${descrizione} non e' riuscito:`, r.uscita.trim());
}

titolo("Svuoto il progetto di prova");
sql(
  `do $pulizia$
   begin
     if exists (select 1 from pg_namespace where nspname = 'cron') then
       perform cron.unschedule(jobid) from cron.job;
     end if;
   end $pulizia$;`,
  "La rimozione dei lavori pianificati"
);
// Lo schema si cancella e basta: a ricrearlo ci pensa la copia, che se lo
// porta dietro (`create schema public`). Ricrearlo qui farebbe fallire il
// ripristino al primo comando — ed e' esattamente cosi' che si scopre che
// una procedura di emergenza scritta a tavolino non era mai stata provata.
sql("drop schema if exists public cascade;", "Lo svuotamento");
// Gli accessi del progetto di prova vanno via anche loro: i dati veri sono
// agganciati agli utenti veri (chi ha registrato un incasso, chi ha chiuso
// un conto), e senza quegli utenti il ripristino si fermerebbe a meta'.
//
// L'archivio documenti resta invece fuori da questa prova: Supabase
// protegge le proprie tabelle dello storage e rifiuta cancellazioni e
// inserimenti diretti in SQL. I file veri sono nella cartella `file/`
// della copia e si ricaricano dall'app (docs/BACKUP.md, paragrafo 6).
sql("delete from auth.users;", "La pulizia degli accessi");
console.log("   fatto");

for (const [file, descrizione] of [
  ["01_schema.sql", "Rimetto la forma del database"],
  ["03_accessi.sql", "Rimetto gli utenti che entrano nell'app"],
  ["02_dati.sql", "Rimetto il contenuto delle tabelle"],
]) {
  if (!existsSync(path.join(cartella, file))) continue;
  titolo(descrizione);
  // Senza ON_ERROR_STOP, ma NON alla cieca: ogni errore viene letto e
  // confrontato con l'unico tollerato. Su Supabase la copia contiene una
  // dozzina di righe che riguardano permessi gestiti dalla piattaforma, e
  // che nessun cliente ha il diritto di cambiare: fermarsi lì renderebbe
  // impossibile qualunque ripristino. Qualsiasi altro errore ferma tutto.
  //
  // `session_replication_role = replica` spegne, per questa sola sessione,
  // sia i controlli di coerenza sia i trigger dell'app. Serve a due cose
  // scoperte ripristinando davvero: le righe tornano in ordine alfabetico
  // di tabella (una caparra prima della sua prenotazione = chiave esterna
  // violata) e ogni riga rimessa farebbe scattare i trigger, notifiche
  // Telegram comprese. Un ripristino rimette i dati com'erano; non li fa
  // riaccadere.
  const r = esegui(
    psql,
    ["-d", url, "-c", "set session_replication_role = 'replica'", "-f", path.join(cartella, file)],
    { silenzioso: true }
  );
  const errori = r.uscita
    .split(/\r?\n/)
    .filter((riga) => /ERROR:/.test(riga))
    .filter((riga) => !/permission denied to change default privileges/.test(riga));
  if (errori.length > 0) {
    fermati(
      `Il ripristino di ${file} ha prodotto ${errori.length} errori non previsti.`,
      "",
      ...errori.slice(0, 10),
      "",
      "Vuol dire che la copia NON basterebbe in caso di guasto: va sistemata."
    );
  }
  if (!r.ok && errori.length === 0 && !/permission denied to change default privileges/.test(r.uscita)) {
    fermati(
      `Il ripristino si e' fermato su ${file}.`,
      "",
      r.uscita.trim().split("\n").slice(-10).join("\n  "),
      "",
      "Vuol dire che la copia NON basterebbe in caso di guasto: va sistemata."
    );
  }
  console.log("   fatto");
  if (file === "01_schema.sql") {
    sql("grant usage on schema public to anon, authenticated, service_role;", "I permessi di base");
    // Le estensioni non stanno dentro la copia: sono pezzi del motore, non
    // dati. Vanno rimesse a mano, e senza di loro meta' del gestionale non
    // parte (promemoria pianificati e notifiche). Scoperto ripristinando
    // davvero: e' il genere di cosa che un documento non avrebbe previsto.
    sql(
      `create extension if not exists pgcrypto;
       create extension if not exists pg_net;
       create extension if not exists pg_cron;`,
      "Il rimontaggio delle estensioni"
    );
  }
}

// ---------------------------------------------------------------------
// Il confronto: e' questo che trasforma "ho un file" in "ho una copia".
// ---------------------------------------------------------------------
titolo("Confronto: database vero il giorno della copia  ↔  ripristino di adesso");

function inMappa(testo) {
  const m = new Map();
  for (const riga of testo.split("\n")) {
    const [nome, quante] = riga.split(" = ");
    if (nome && quante !== undefined) m.set(nome.trim(), Number(quante));
  }
  return m;
}

const origine = inMappa(readFileSync(path.join(cartella, "05_conteggi.txt"), "utf8"));
const ripristino = inMappa(interroga(url, SQL_CONTEGGI));

const differenze = [];
for (const [tabella, quante] of origine) {
  const adesso = ripristino.get(tabella);
  if (adesso === undefined) differenze.push(`${tabella}: la tabella non e' stata ricreata (aveva ${quante} righe)`);
  else if (adesso !== quante) differenze.push(`${tabella}: erano ${quante}, adesso ${adesso}`);
}
for (const tabella of ripristino.keys()) {
  if (!origine.has(tabella)) differenze.push(`${tabella}: comparsa dal nulla nel ripristino`);
}

const totaleOrigine = [...origine.values()].reduce((a, b) => a + b, 0);
console.log(`   tabelle: ${origine.size} nella copia, ${ripristino.size} nel ripristino`);
console.log(`   righe:   ${totaleOrigine} nella copia, ${[...ripristino.values()].reduce((a, b) => a + b, 0)} nel ripristino`);

if (differenze.length > 0) {
  fermati(
    `RIPRISTINO NON FEDELE: ${differenze.length} differenze.`,
    "",
    ...differenze.slice(0, 20),
    "",
    "Manda questo elenco a Claude Code: la copia va corretta prima di fidarsene."
  );
}

console.log("");
console.log("   Nessuna differenza: la copia rimette in piedi tutto, riga per riga.");
console.log("");
console.log("Prova di ripristino superata.");
console.log("");
console.log("  ATTENZIONE: il progetto di prova adesso contiene i dati VERI,");
console.log("  nomi e telefoni dei clienti compresi. Va rimesso a posto subito:");
console.log("");
console.log("    npm run prova:ricostruisci -- --azzera");
console.log("");
console.log("  Gli accessi non vanno rifatti: la copia porta gli stessi quattro");
console.log("  indirizzi, quindi le prove automatiche continuano a entrare.");
console.log("");
