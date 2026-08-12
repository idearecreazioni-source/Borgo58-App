// Applica in PRODUZIONE le migrazioni che mancano.
//
// Nasce il 12/08/2026, quando Alessio ha deciso che le migrazioni le
// applica la sessione Code invece di incollarle a mano nell'SQL Editor —
// dopo che un file di 270 righe era arrivato troncato e un comando
// PowerShell era finito dentro l'editor SQL.
//
// LA REGOLA VECCHIA AVEVA UNO SCOPO, E VA SOSTITUITO. Serviva a mettere
// un essere umano fra un errore della sessione IA e i dati veri. Quel
// passaggio non c'è più, quindi i vincoli che lo rimpiazzano non possono
// essere raccomandazioni scritte in un documento: sono controlli qui
// dentro, che fermano il programma.
//
//   1. NIENTE CHE NON SIA GIÀ PASSATO DALLA PROVA. Ogni migrazione deve
//      risultare registrata in `applied_migrations` del progetto di
//      prova. È il controllo più importante del file: rende impossibile
//      «la provo direttamente in produzione, tanto è piccola».
//   2. SOLO FILE COMMITTATI. Una migrazione modificata e non committata
//      non entra: ciò che gira in produzione deve essere ciò che il
//      validatore può leggere su GitHub.
//   3. IN ORDINE, E SI FERMA AL PRIMO ERRORE.
//   4. NON DECIDE NIENTE DA SÉ: senza `--conferma` mostra soltanto cosa
//      farebbe. È la modalità in cui si guarda prima di agire.
//
// Il programma non registra niente da sé in `applied_migrations`: lo fa
// ogni migrazione come ultima istruzione (protocollo §7.4). Se una
// migrazione non si registra, la volta dopo risulta ancora mancante — ed
// è giusto così, perché sono tutte idempotenti.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  esegui,
  fermati,
  interroga,
  leggiConfigurazione,
  obbligatorio,
  REF_PRODUZIONE,
  strumento,
  titolo,
} from "./comune.mjs";

const CARTELLA = "supabase/migrations";

/** Le migrazioni presenti nel repository, in ordine cronologico. */
function migrazioniSulDisco() {
  if (!existsSync(CARTELLA)) fermati(`Non trovo la cartella ${CARTELLA}.`);
  return readdirSync(CARTELLA)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => ({
      file,
      versione: file.slice(0, file.indexOf("_")),
      percorso: path.join(CARTELLA, file),
    }));
}

/** Le versioni gia' registrate in un database. */
function versioniApplicate(url) {
  const grezzo = interroga(url, "select version from applied_migrations;");
  return new Set(grezzo.split(/\r?\n/).map((r) => r.trim()).filter(Boolean));
}

/** I file con modifiche non committate (git). */
function fileNonCommittati() {
  const r = esegui("git", ["status", "--porcelain", "--", CARTELLA], { silenzioso: true });
  if (!r.ok) return null; // niente git: il controllo lo dira' chi chiama
  return new Set(
    r.uscita
      .split(/\r?\n/)
      .map((riga) => riga.slice(3).trim().replace(/^"|"$/g, ""))
      .filter(Boolean)
      .map((p) => path.basename(p))
  );
}

const conferma = process.argv.includes("--conferma");

const config = leggiConfigurazione();
const urlProduzione = obbligatorio(
  config,
  "DB_URL_PRODUZIONE",
  "Serve la stringa di collegamento del database vero (docs/BACKUP.md, paragrafo 2)."
);
const urlProva = obbligatorio(
  config,
  "DB_URL_PROVA",
  "Serve il progetto di prova: nessuna migrazione entra in produzione senza esserci passata."
);

// Barriera al contrario rispetto a `soloProva()`: qui si PRETENDE il
// database vero, perche' un .env.db compilato male applicherebbe le
// migrazioni al progetto sbagliato lasciando la produzione indietro.
if (!urlProduzione.includes(REF_PRODUZIONE)) {
  fermati(
    "FERMO: DB_URL_PRODUZIONE non punta al progetto vero.",
    `Ci si aspetta il riferimento ${REF_PRODUZIONE}. Controlla .env.db.`
  );
}
if (urlProva.includes(REF_PRODUZIONE)) {
  fermati("FERMO: DB_URL_PROVA punta al database VERO. Controlla .env.db.");
}

titolo("Cosa manca in produzione");

const sulDisco = migrazioniSulDisco();
const inProduzione = versioniApplicate(urlProduzione);
const mancanti = sulDisco.filter((m) => !inProduzione.has(m.versione));

console.log(`  migrazioni nel repository: ${sulDisco.length}`);
console.log(`  gia' applicate in produzione: ${inProduzione.size}`);

if (mancanti.length === 0) {
  console.log("  da applicare: nessuna — la produzione e' aggiornata.");
  console.log("");
  process.exit(0);
}

// --- Vincolo 1: gia' passate dalla prova -----------------------------
const inProva = versioniApplicate(urlProva);
const maiProvate = mancanti.filter((m) => !inProva.has(m.versione));
if (maiProvate.length > 0) {
  fermati(
    "FERMO: queste migrazioni non risultano applicate sul progetto di prova.",
    ...maiProvate.map((m) => `  · ${m.file}`),
    "",
    "In produzione non entra ciò che non è già stato provato altrove.",
    "Applicale prima sul progetto di prova."
  );
}

// --- Vincolo 2: committate -------------------------------------------
const sporchi = fileNonCommittati();
if (sporchi === null) {
  fermati("FERMO: non riesco a interrogare git, quindi non posso garantire che i file siano committati.");
}
const nonCommittate = mancanti.filter((m) => sporchi.has(m.file));
if (nonCommittate.length > 0) {
  fermati(
    "FERMO: queste migrazioni hanno modifiche non committate.",
    ...nonCommittate.map((m) => `  · ${m.file}`),
    "",
    "Ciò che gira in produzione deve essere ciò che si può leggere su GitHub.",
    "Committa prima, poi applica."
  );
}

console.log("");
console.log(`  da applicare (${mancanti.length}), in quest'ordine:`);
for (const m of mancanti) {
  const righe = readFileSync(m.percorso, "utf8").split(/\r?\n/).length;
  console.log(`    · ${m.file}  (${righe} righe)`);
}

if (!conferma) {
  console.log("");
  console.log("  Nessuna modifica fatta: questa e' la modalita' di sola lettura.");
  console.log("  Per applicarle davvero: npm run migra -- --conferma");
  console.log("");
  process.exit(0);
}

// --- Applicazione ----------------------------------------------------
titolo("Applico");

const psql = strumento("psql");
for (const m of mancanti) {
  console.log("");
  console.log(`── ${m.file}`);
  const r = esegui(psql, ["-v", "ON_ERROR_STOP=1", "-d", urlProduzione, "-f", m.percorso]);
  if (!r.ok) {
    fermati(
      `La migrazione ${m.file} si e' fermata con un errore.`,
      "Le successive NON sono state applicate.",
      "Una migrazione che fallisce non lascia niente a meta': il blocco e' una sola transazione per istruzione,",
      "ma la verifica in fondo solleva eccezione prima di registrare la versione."
    );
  }
}

// --- Resoconto: i numeri veri, non un "fatto" ------------------------
titolo("Com'e' andata");

const dopo = versioniApplicate(urlProduzione);
const registrate = mancanti.filter((m) => dopo.has(m.versione));
const nonRegistrate = mancanti.filter((m) => !dopo.has(m.versione));

console.log(`  applicate e registrate: ${registrate.length} su ${mancanti.length}`);
for (const m of registrate) console.log(`    · ${m.file}`);
if (nonRegistrate.length > 0) {
  console.log("");
  console.log("  ATTENZIONE — girate senza registrarsi in applied_migrations:");
  for (const m of nonRegistrate) console.log(`    · ${m.file}`);
  console.log("  Verranno riproposte al prossimo giro: sono idempotenti, ma va capito perche'.");
}
console.log("");
console.log(`  totale migrazioni in produzione: ${dopo.size}`);
console.log("");
