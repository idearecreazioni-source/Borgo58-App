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
  testoDeiRiepiloghi,
  titolo,
  versioniDoppie,
  versioniNonNominate,
  argomentiMigrazione,
  backupTroppoVecchio,
  copiaPiuRecente,
  ORE_MASSIME_BACKUP,
  oreTonde,
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

// --- IL SESTO FRENO: NIENTE MIGRAZIONI SU UN BACKUP VECCHIO -----------
//
// 🔴 NASCE IL 30/08/2026, e nasce da un fatto e non da un timore: quella
// sera sei migrazioni sono entrate nel gestionale vero **senza backup**,
// contro la decisione del 23/08 — e a rilevarlo e' stata la sessione che
// le aveva applicate, accusandosi da sola. L'ultimo backup era del 23.
//
// ⚠️ LA REGOLA C'ERA GIA' ED ERA UN'INTENZIONE. E' la stessa forma del
// vincolo 0 (i riepiloghi): una regola scritta in un documento si degrada
// quando la giornata e' lunga, e allora smette di proteggere proprio nel
// momento in cui serve. Qui diventa una condizione che ferma il
// programma.
//
// 🔴 IL LIMITE E' DICHIARATO, E NON E' PICCOLO: questo controllo sa
// **QUANDO e' stata fatta la copia**. Non sa
//   · che sia stata portata **fuori dal computer** — e un backup che vive
//     sullo stesso disco del database che protegge non protegge da un
//     disco rotto;
//   · che il **ripristino sia stato provato** — un file generato non e' un
//     backup: e' un file.
// Quelle due meta' restano di Alessio, e nessun controllo dentro questo
// programma puo' prendersele. La decisione del 23/08 le chiede tutte e
// tre; qui se ne automatizza **una**, e le altre due si dicono a voce
// alta invece di sparire dentro un «fatto».
//
// ⚠️ E LA CARTELLA VUOLE `05_conteggi.txt`: e' quello che dimostra che il
// backup e' arrivato in fondo. Una cartella nata da un backup interrotto
// a meta' ha un nome con l'ora giusta e dentro non ha niente su cui
// contare le righe — cioe' sarebbe **una copia recente che non e' una
// copia**. ⚠️ Lo zip invece NON si pretende: `backup.mjs` dichiara che se
// lo zip fallisce la copia non e' persa, e pretenderlo qui direbbe il
// contrario di quello che dice il comando che lo produce.
//
// ⚠️ IL QUANDO SI LEGGE DAL **NOME** DELLA CARTELLA, non dalla data del
// file: il nome e' l'ora locale in cui la copia e' stata presa
// (`timbroLocale()`), e resta vera anche se la cartella viene copiata,
// spostata o messa su una chiavetta. La data del file cambierebbe a ogni
// copia, e direbbe «recente» di un backup vecchio spostato ieri.
{
  const trovata = copiaPiuRecente(config.BACKUP_CARTELLA);
  const motivo = backupTroppoVecchio(trovata, new Date(), ORE_MASSIME_BACKUP);
  if (motivo) {
    fermati(
      "FERMO: non si tocca il gestionale vero senza una copia di sicurezza recente.",
      `  ${motivo}`,
      "",
      `Il limite e' ${ORE_MASSIME_BACKUP} ore: oltre, un guasto si porterebbe via`,
      "piu' di una giornata di lavoro, e le migrazioni sono precisamente il",
      "momento in cui il database vero cambia forma.",
      "",
      "La via d'uscita e' un comando solo, e ci mette meno di un minuto:",
      "  npm run backup",
      "",
      "⚠️ E il comando sa solo QUANDO e' stata fatta la copia. Che sia stata",
      "portata fuori dal computer e che il ripristino sia stato provato",
      "(npm run backup:ripristina) restano cose che deve fare Alessio: la",
      "decisione del 23/08 ne chiede tre, qui se ne controlla una."
    );
  }
  const ore = oreTonde((Date.now() - trovata.quando.getTime()) / 3_600_000);
  console.log(`  copia di sicurezza: ${trovata.nome} (${ore} ore fa)`);
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

// --- Vincolo 0-bis: e nemmeno quelle che stanno per entrare ----------
// 🔴 NASCE DA UNA MISURA DEL 28/08, e corregge il MOMENTO in cui il
// vincolo qui sopra guarda. Quello controlla cio' che e' GIA' applicato:
// per come e' fatto **non puo' fermare la prima applicazione non
// documentata**, solo la successiva. E' esattamente quello che e'
// successo il 27/08 — cinque migrazioni entrate in produzione senza
// riepilogo, e il blocco arrivato il giro dopo. La rete non e' stata
// aggirata e non e' rotta: ha fatto quello che sapeva fare, **in ritardo
// di un giro**.
//
// 🔴 E IL 28/08 IL BUCO SI E' VISTO IN UNA FORMA NUOVA: quattro
// migrazioni su quindici in attesa non erano nominate da nessun
// riepilogo, perche' quello che le conteneva le scriveva come INTERVALLO
// (`…026 → …032`), che nomina i due estremi e lascia mute le cinque in
// mezzo. Il vincolo qui sopra se ne sarebbe accorto **solo dopo averle
// applicate**.
//
// ⚠️ E QUI NON SI PRETENDONO I NUMERI VERI, che si conoscono solo dopo:
// si pretende che il riepilogo ESISTA e nomini le versioni per intero.
// La differenza e' tutta qui — un documento senza i numeri
// dell'applicazione non e' un documento con dei buchi da riempire: e' il
// racconto del lavoro, che a questo punto e' finito e committato. I
// numeri si aggiungono dopo, come sempre.
const nonNominate = versioniNonNominate(
  mancanti.map((m) => m.versione),
  testoDeiRiepiloghi()
);
if (nonNominate.length > 0) {
  fermati(
    "FERMO: queste migrazioni stanno per entrare in produzione e nessun riepilogo le nomina.",
    ...nonNominate.map((v) => `  · ${v}`),
    "",
    "⚠️ Attenzione alla forma abbreviata: un riepilogo che scrive «…026 → …032»",
    "nomina i due estremi e lascia mute quelle in mezzo. Il numero va scritto",
    "per intero, una versione alla volta.",
    "",
    "Scrivi il riepilogo in docs/consegne/, poi si riprende. I numeri veri",
    "dell'applicazione si aggiungono dopo: quello che serve adesso e' che il",
    "documento esista e dica quali versioni entrano."
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
  const { argomenti, atomica } = argomentiMigrazione(urlProduzione, m.percorso);
  if (!atomica) {
    console.log("   (per istruzioni, non atomica: contiene un valore aggiunto a un enum)");
  }
  const r = esegui(psql, argomenti);
  if (!r.ok) {
    fermati(
      `La migrazione ${m.file} si e' fermata con un errore.`,
      "Le successive NON sono state applicate.",
      atomica
        ? "Questa girava dentro UNA transazione: non ha lasciato niente a meta', e non si e' registrata."
        : "ATTENZIONE: questa girava PER ISTRUZIONI, quindi le istruzioni prima dell'errore SONO GIA' IN PRODUZIONE e la versione NON e' registrata. Prima di rilanciare, si constata dal catalogo cosa c'e' gia' — non si deduce dal fatto che si e' fermata."
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
