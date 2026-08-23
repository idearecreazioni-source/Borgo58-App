// Applica una migrazione sul PROGETTO DI PROVA.
//
// Perche' esiste (15/08/2026). Il protocollo §7 punto 7 impone che ogni
// migrazione passi prima dal progetto di prova, e `scripts/migra.mjs` si
// rifiuta di toccare la produzione se non ce l'ha vista passare. Ma il
// modo di applicarla LI' non era automatizzato: `docs/AMBIENTE_PROVA.md`
// diceva ancora «si incolla nell'SQL Editor del progetto di prova» — cioe'
// esattamente il gesto che il 12/08 e' arrivato troncato a meta' e ha
// fatto cambiare la regola su chi applica le migrazioni.
//
// Il primo anello della catena era rimasto manuale, ed era il piu' lungo:
// le migrazioni di prova si applicano molte volte (una per ogni correzione,
// piu' le riesecuzioni che dimostrano l'idempotenza). Preferire
// l'automazione alla disciplina (§5) vale soprattutto sul gesto ripetuto.
//
// DUE PROTEZIONI, e sono nel programma e non nella memoria di chi lancia:
//   1. Si rifiuta di partire se `DB_URL_PROVA` contiene il riferimento del
//      progetto VERO. Un .env.db compilato male applicherebbe in silenzio
//      sui dati di Alessio cio' che si credeva di provare.
//   2. Non registra niente da se' in `applied_migrations`: lo fa ogni
//      migrazione come ultima istruzione (§7.4). Se una non si registra,
//      la volta dopo risulta ancora mancante — ed e' giusto cosi'.
//
// Uso:
//   npm run prova:migra                       tutte quelle che mancano
//   npm run prova:migra -- 20260815000002     una sola, anche se gia' applicata
//                                             (e' cosi' che si prova l'idempotenza)

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  esegui,
  fermati,
  leggiConfigurazione,
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

function migrazioniSulDisco() {
  if (!existsSync(CARTELLA)) fermati(`Non trovo la cartella ${CARTELLA}.`);
  return readdirSync(CARTELLA)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => ({ file, versione: file.slice(0, 14) }));
}

const cfg = leggiConfigurazione();
const url = obbligatorio(
  cfg,
  "DB_URL_PROVA",
  "Serve il progetto di prova. Vedi docs/AMBIENTE_PROVA.md."
);

// Protezione 1: mai sulla produzione, per nessun motivo.
if (url.includes(REF_PRODUZIONE)) {
  fermati(
    "FERMO: DB_URL_PROVA punta al database VERO.",
    `Ci si aspetta qualcosa di diverso da ${REF_PRODUZIONE}. Controlla .env.db.`
  );
}

const psql = strumento("psql");

function interrogaProva(sql) {
  const r = esegui(psql, ["-v", "ON_ERROR_STOP=1", "-A", "-t", "-d", url, "-c", sql], {
    silenzioso: true,
  });
  if (!r.ok) fermati("Il progetto di prova non ha risposto:", r.uscita.trim());
  return r.uscita.trim();
}

const chieste = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const tutte = migrazioniSulDisco();

// Prima di qualunque altra cosa: due file con lo stesso numero di versione
// si nascondono a vicenda nel registro. Vedi versioniDoppie() in comune.mjs.
const doppie = versioniDoppie(tutte);
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

let daApplicare;
if (chieste.length > 0) {
  // Una o piu' per nome: si riapplicano anche se gia' registrate. E' il
  // modo in cui si dimostra che sono idempotenti.
  daApplicare = chieste.map((c) => {
    const trovata = tutte.find((m) => m.file === c || m.versione === c || m.file.startsWith(c));
    if (!trovata) fermati(`Non trovo nessuna migrazione che corrisponda a «${c}».`);
    return trovata;
  });
} else {
  const gia = new Set(
    interrogaProva("select version from applied_migrations")
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean)
  );
  daApplicare = tutte.filter((m) => !gia.has(m.versione));
  if (daApplicare.length === 0) {
    titolo("Il progetto di prova è già allineato: nessuna migrazione da applicare.");
    process.exit(0);
  }
}

titolo(`Progetto di prova — ${daApplicare.length} migrazion${daApplicare.length === 1 ? "e" : "i"}`);

// ---------------------------------------------------------------------
// La rete contro la funzione riscritta a memoria (23/08/2026).
// Vedi scripts/guardie.mjs per il perche'. Qui c'e' solo il come.
// ---------------------------------------------------------------------
const vivi = await corpiVivi(url);
const cache = new Map();
const leggiVivo = (nome) => (cache.has(nome) ? cache.get(nome) : vivi.corpoVivo(nome));

/**
 * ⚠️ Il corpo vivo cambia MENTRE si applica. Applicando venti migrazioni
 * in fila, la seconda che tocca la stessa funzione va confrontata con cio'
 * che la prima ha appena scritto — non con lo stato di venti migrazioni
 * fa. Invece di richiedere il corpo al database dopo ogni file, si prende
 * per buono il testo appena applicato: le impronte sono le stesse.
 */
function aggiornaCorpiVivi(sql) {
  for (const f of funzioniRidefinite(sql)) cache.set(f.nome, f.testo);
}

for (const m of daApplicare) {
  console.log(`\n→ ${m.file}`);

  const sql = readFileSync(path.join(CARTELLA, m.file), "utf8");
  // La soglia: vedi PRIMA_CON_RETE in guardie.mjs.
  const perdite =
    m.versione >= PRIMA_CON_RETE
      ? controllaMigrazione(sql, leggiVivo, vivi.funzioniDelProgetto)
      : [];
  const nonDichiarate = perdite.filter((p) => p.rinuncia === null);
  for (const p of perdite.filter((x) => x.rinuncia !== null)) {
    console.log(`   rinuncia dichiarata su ${p.nome}: ${p.rinuncia}`);
    for (const r of raccontaSmarrite(p)) console.log(`   ${r}`);
  }
  if (nonDichiarate.length > 0) {
    const righe = [];
    for (const p of nonDichiarate) {
      righe.push(`  ${p.nome} perde:`);
      righe.push(...raccontaSmarrite(p));
    }
    fermati(
      `FERMO: ${m.file} riscrive una funzione perdendo per strada qualcosa.`,
      ...righe,
      "",
      "Nel corpo VIVO del database quelle righe ci sono; in questa migrazione no.",
      "E' successo quattro volte: si riscrive una funzione a memoria (o dal file",
      "che l'aveva creata) e si annulla in silenzio cio' che era stato aggiunto",
      "dopo — un portiere, il nome di un campo che una schermata legge.",
      "",
      "Il corpo vivo si prende cosi':   npm run funzione:viva -- <nome> --prova",
      "",
      "Se invece si toglie APPOSTA, si scrive nella migrazione la riga:",
      "  -- rete-guardie: <nome_funzione> — perche' si toglie"
    );
  }

  const r = esegui(
    psql,
    ["-v", "ON_ERROR_STOP=1", "-d", url, "-f", path.join(CARTELLA, m.file)],
    { silenzioso: true }
  );
  // Le NOTICE sono il racconto della verifica: si mostrano sempre, perche'
  // e' li' dentro che una migrazione dice cosa ha controllato.
  const righe = r.uscita.split("\n").filter((l) => l.includes("NOTICE") || l.includes("ERROR"));
  for (const l of righe) console.log(`   ${l.trim()}`);
  if (!r.ok) {
    console.log(r.uscita);
    fermati(`La migrazione ${m.file} si è fermata. Sopra c'è il motivo.`);
  }
  aggiornaCorpiVivi(sql);
}

const registrate = interrogaProva("select count(*) from applied_migrations");
titolo(`Fatto. Il progetto di prova ha ${registrate} migrazioni registrate.`);
