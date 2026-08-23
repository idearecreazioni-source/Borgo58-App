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
//   3. E GIÀ SU GITHUB, NON SOLO COMMITTATI — irrigidimento chiesto dal
//      validatore il 13/08/2026. «Committato» voleva dire soltanto
//      «scritto sul PC di Alessio»: fra il commit e il push c'è un
//      passaggio che tocca a lui, e finché non l'ha fatto la produzione
//      girerebbe codice che nessuno può leggere. Se quel commit venisse
//      poi riscritto o buttato, il database vero resterebbe l'unico
//      posto dove quella migrazione è mai esistita — e sarebbe la
//      produzione a essere avanti a tutto il resto, senza che nessuno
//      possa più dire cosa contiene. Da qui il nuovo ordine: commit →
//      **push di Alessio** → applicazione.
//   4. IN ORDINE, E SI FERMA AL PRIMO ERRORE.
//   5. NON DECIDE NIENTE DA SÉ: senza `--conferma` mostra soltanto cosa
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
  migrazioniSenzaRiepilogo,
  obbligatorio,
  REF_PRODUZIONE,
  strumento,
  titolo,
  versioniDoppie,
} from "./comune.mjs";
import {
  controllaMigrazione,
  corpiVivi,
  funzioniRidefinite,
  PRIMA_CON_RETE,
  raccontaSmarrite,
} from "./guardie.mjs";

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

/**
 * I file che NON risultano identici a quelli pubblicati su origin/master:
 * o non sono mai stati spinti, o sono cambiati dopo.
 * Restituisce null se non si riesce a sapere cosa c'e' su GitHub — che
 * non e' un "va bene": chi chiama deve fermarsi.
 */
function nonAncoraSuGitHub(migrazioni) {
  const fetch = esegui("git", ["fetch", "--quiet", "origin"], { silenzioso: true });
  if (!fetch.ok) return null;

  const fuori = [];
  for (const m of migrazioni) {
    const r = esegui("git", ["diff", "--quiet", "origin/master", "--", m.percorso], {
      silenzioso: true,
    });
    if (!r.ok) fuori.push(m);
  }
  return fuori;
}

const conferma = process.argv.includes("--conferma");

// --- `--salta <versione>`: tutte tranne quella -------------------------
//
// 🔴 NASCE IL 21/08 DA UN LIMITE DI `--fino-a`, trovato lanciandolo e non
// leggendolo: la pulizia dei dati di collaudo e' la 012, e le tre da
// applicare erano le 001, 002 e 003 del giorno dopo. `--fino-a` taglia
// DALL'ALTO, quindi la 012 — che viene prima — ci rientrava lo stesso.
//
// ⚠️ Sono due bisogni diversi e servono tutti e due: `--fino-a` ferma la
// coda, `--salta` toglie una migrazione IN MEZZO che aspetta una decisione.
// Si possono usare insieme.
const daSaltare = (() => {
  const fuori = [];
  process.argv.forEach((a, i) => {
    if (a !== "--salta") return;
    const v = process.argv[i + 1];
    if (!v || !/^[0-9]{14}$/.test(v)) {
      fermati(
        "L'argomento --salta vuole un numero di versione di 14 cifre.",
        "Esempio: npm run migra -- --salta 20260820000012 --conferma"
      );
    }
    fuori.push(v);
  });
  return fuori;
})();

// --- `--fino-a <versione>`: applica solo fino a quella, compresa --------
//
// 🔴 NASCE IL 20/08/2026 DA UNA COSA CHE NON SI POTEVA FARE. Quella notte
// erano pendenti quattro migrazioni, e **tre andavano applicate e una no**:
// la quarta e' la pulizia dei dati di collaudo, che dentro di se' dichiara
// «non si applica da sola e non si applica di sera», e aspetta una conferma
// di Alessio sui documenti.
//
// ⚠️ Le due strade senza questo argomento erano tutte e due peggiori:
// applicarle a mano con `psql` **aggira tutti e sei i controlli** qui sotto,
// e spostare un file fuori dalla cartella lo fa sparire dal conteggio senza
// che nessuno lo dichiari. *Quando un comando non sa fare una cosa
// legittima, la cosa da correggere e' il comando — non il modo di
// aggirarlo.*
//
// ⚠️ E NON INDEBOLISCE NIENTE: il filtro sceglie **quali** migrazioni
// applicare, e tutti i controlli girano poi su quelle scelte. Una migrazione
// tenuta indietro resta mancante, quindi la volta dopo ricompare in elenco —
// non sparisce.
const fermatiA = (() => {
  const i = process.argv.indexOf("--fino-a");
  if (i === -1) return null;
  const v = process.argv[i + 1];
  if (!v || !/^[0-9]{14}$/.test(v)) {
    fermati(
      "L'argomento --fino-a vuole un numero di versione di 14 cifre.",
      "Esempio: npm run migra -- --fino-a 20260820000011 --conferma"
    );
  }
  return v;
})();

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

// Prima di qualunque altra cosa: due file con lo stesso numero di versione
// si nascondono a vicenda nel registro. Vedi versioniDoppie() in comune.mjs.
const doppie = versioniDoppie(sulDisco);
if (doppie.length > 0) {
  fermati(
    "FERMO: due migrazioni hanno lo stesso numero di versione.",
    ...doppie,
    "",
    "Il registro applied_migrations ha per chiave la versione: applicata la",
    "prima, la seconda risulterebbe gia' applicata e non girerebbe mai —",
    "in silenzio. Rinomina la piu' recente con un numero libero, e cambia",
    "anche la versione nel suo insert into applied_migrations in fondo."
  );
}
const inProduzione = versioniApplicate(urlProduzione);
const tutteMancanti = sulDisco.filter((m) => !inProduzione.has(m.versione));
// ⚠️ Il taglio si fa QUI, prima dei controlli: cosi' i sei vincoli guardano
// esattamente cio' che sta per essere applicato, non un elenco piu' lungo.
const mancanti = (fermatiA ? tutteMancanti.filter((m) => m.versione <= fermatiA) : tutteMancanti)
  .filter((m) => !daSaltare.includes(m.versione));
const tenuteIndietro = tutteMancanti.filter((m) => !mancanti.includes(m));

console.log(`  migrazioni nel repository: ${sulDisco.length}`);
console.log(`  gia' applicate in produzione: ${inProduzione.size}`);

// ⚠️ Cio' che resta fuori si DICHIARA, e con la ragione per cui e' fuori: un
// elenco piu' corto senza dire perche' e' la forma che questo progetto
// insegue da giorni — *una risposta piu' corta che ha l'aria di essere
// intera*.
if (tenuteIndietro.length > 0) {
  console.log("");
  console.log(`  TENUTE INDIETRO (${tenuteIndietro.length}):`);
  for (const m of tenuteIndietro) console.log(`    · ${m.file}`);
  console.log("    Restano mancanti: la prossima volta ricompaiono in elenco.");
}

if (mancanti.length === 0) {
  console.log("  da applicare: nessuna — la produzione e' aggiornata.");
  console.log("");
  process.exit(0);
}

// --- Vincolo 0: il debito dei riepiloghi non si accumula --------------
// ⚠️ Nasce il 16/08/2026 da un rilievo del validatore: il 15/08 quattro
// commit sono usciti senza riepilogo, due dei quali con una migrazione
// gia' applicata in produzione. La regola c'era — «nessun push senza il
// riepilogo corrispondente» — ed era un'intenzione: si e' degradata dopo
// nove ore di lavoro, e a rilevarlo e' stato un controllo esterno.
//
// Qui diventa una condizione che ferma il programma, nello stesso punto e
// nella stessa forma della rete che gia' impedisce di applicare in
// produzione cio' che non e' passato dal progetto di prova.
const scoperte = migrazioniSenzaRiepilogo(inProduzione);
if (scoperte.length > 0) {
  fermati(
    "FERMO: queste migrazioni sono gia' in produzione e nessun riepilogo le nomina.",
    ...scoperte.map((v) => `  · ${v}`),
    "",
    "Il validatore legge i riepiloghi per confrontare il consegnato col richiesto:",
    "una migrazione applicata e non documentata e' un cambiamento del database",
    "vero che nessuno, fuori da qui, puo' ricostruire.",
    "",
    "Scrivi il riepilogo in docs/consegne/ nominando la versione per intero,",
    "poi si riprende. Non si applica altro finche' l'arretrato non e' chiuso."
  );
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

// --- Vincolo 3: gia' pubblicate su GitHub ----------------------------
const fuoriDaGitHub = nonAncoraSuGitHub(mancanti);
if (fuoriDaGitHub === null) {
  fermati(
    "FERMO: non riesco a leggere cosa c'e' su GitHub, quindi non posso garantire",
    "che la produzione non stia per correre avanti al repository.",
    "",
    "Riprova quando la rete risponde."
  );
}
if (fuoriDaGitHub.length > 0) {
  fermati(
    "FERMO: queste migrazioni non sono ancora su GitHub.",
    ...fuoriDaGitHub.map((m) => `  · ${m.file}`),
    "",
    "La produzione non deve mai correre avanti al repository: se il commit",
    "venisse riscritto, il database vero sarebbe l'unico posto dove questa",
    "migrazione e' mai esistita.",
    "",
    "Serve il push di Alessio, poi si riprova.",
    "  git push"
  );
}

// --- 5. NIENTE CHE RISCRIVA UNA FUNZIONE PERDENDO PEZZI --------------
// La rete del 23/08/2026: vedi scripts/guardie.mjs. Il controllo si fa
// anche in sola lettura, perche' e' li' che si guarda prima di agire.
{
  const vivi = await corpiVivi(urlProduzione);
  const cache = new Map();
  const leggiVivo = (n) => (cache.has(n) ? cache.get(n) : vivi.corpoVivo(n));
  const righe = [];
  const dichiarate = [];
  for (const m of mancanti.filter((x) => x.versione >= PRIMA_CON_RETE)) {
    const sql = readFileSync(m.percorso, "utf8");
    for (const p of controllaMigrazione(sql, leggiVivo, vivi.funzioniDelProgetto)) {
      if (p.rinuncia === null) {
        righe.push(`  ${m.file} → ${p.nome} perde:`);
        righe.push(...raccontaSmarrite(p));
      } else {
        dichiarate.push(`  ${m.file} → ${p.nome}: rinuncia dichiarata — ${p.rinuncia}`);
      }
    }
    // Il corpo vivo cambia mentre si applica: vedi prova-migra.mjs.
    for (const f of funzioniRidefinite(sql)) cache.set(f.nome, f.testo);
  }
  if (dichiarate.length > 0) {
    console.log("");
    console.log("  rinunce dichiarate:");
    for (const r of dichiarate) console.log(r);
  }
  if (righe.length > 0) {
    fermati(
      "FERMO: una migrazione riscrive una funzione perdendo per strada qualcosa",
      "che nel corpo VIVO della produzione c'e'.",
      "",
      ...righe,
      "",
      "E' successo quattro volte: una funzione riscritta a memoria annulla in",
      "silenzio cio' che era stato aggiunto dopo — un portiere, il nome di un",
      "campo che una schermata legge.",
      "",
      "Il corpo vivo si prende cosi':   npm run funzione:viva -- <nome>",
      "",
      "Se si toglie APPOSTA, nella migrazione va la riga:",
      "  -- rete-guardie: <nome_funzione> — perche' si toglie"
    );
  }
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
