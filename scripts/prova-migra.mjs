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

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  esegui,
  fermati,
  leggiConfigurazione,
  obbligatorio,
  REF_PRODUZIONE,
  strumento,
  titolo,
} from "./comune.mjs";

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

for (const m of daApplicare) {
  console.log(`\n→ ${m.file}`);
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
}

const registrate = interrogaProva("select count(*) from applied_migrations");
titolo(`Fatto. Il progetto di prova ha ${registrate} migrazioni registrate.`);
