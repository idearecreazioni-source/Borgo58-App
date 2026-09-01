// QUANTO DEL GESTIONALE E' TOCCATO DALLE PROVE — `npm run copertura`
// (01/09/2026)
//
// 🔴 PERCHE' ESISTE. Il 31/08 una revisione esterna ha scritto che la
//    copertura di questo progetto e' «ridicola, appena il 9%». Il numero
//    e' vero — misurato: **9,89%** di istruzioni di `src/` toccate dalle
//    prove pure — e da solo dice quasi niente, perche' nasconde due fatti
//    opposti che stanno nello stesso totale:
//
//      src/lib/calcoli    91,9%   le regole pure, dov'e' il ragionamento
//      src/lib/api         0,3%   toccata dalle 459 prove sul database,
//                                 che questo conteggio non vede
//      src/pages           0,0%   89 file, 8.731 istruzioni: i due terzi
//      src/components      0,0%   del gestionale
//
// ⚠️ QUINDI IL NUMERO SI GUARDA DIVISO PER CARTELLA, mai in totale. Un
//    totale unico mescola cose che si provano in tre modi diversi, e chi
//    lo legge conclude la cosa sbagliata in tutte e due le direzioni:
//    che il ragionamento non sia provato (lo e', al 92%) o che basti
//    alzare quel 9% (non basta: sotto ci sono schermate che vogliono un
//    occhio, non una percentuale).
//
// ⚠️ E QUESTO COMANDO NON SORVEGLIA NIENTE, ed e' voluto: non c'e' nessuna
//    soglia che fa fallire un giro. Una soglia di copertura si supera
//    scrivendo prove che passano, non prove che discriminano — e in questo
//    progetto la domanda e' sempre stata l'altra: *come faccio a rendere
//    rossa questa prova?* Il numero serve a decidere dove guardare.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

// 🔴 OGNI GIRO SCRIVE NELLA PROPRIA CARTELLA, e la prima versione di questo
//    comando NON lo faceva: v8 riscrive `coverage-summary.json` a ogni giro,
//    quindi l'unione leggeva due volte lo stesso file — quello dell'ultimo
//    giro — e dichiarava `src/lib/calcoli` al **5,1%**.
//    ⚠️ L'errore l'ha preso la regola del 26/08: *un misuratore nuovo si
//    prova su un caso di cui si conosce gia' la risposta*. Quella cartella
//    era stata misurata al **91,9%** dieci minuti prima. Senza quel numero
//    noto davanti, il 5,1% sarebbe finito in un riepilogo.
const giri = [
  { nome: "prove pure", argomenti: ["run", "tests/unita"] },
  {
    nome: "prove sulle schermate",
    argomenti: ["run", "tests/schermate", "--config", "vitest.schermate.config.js"],
  },
];

const perFile = new Map();

for (const giro of giri) {
  console.log(`\n— ${giro.nome} —`);
  const cartella = path.join(tmpdir(), `borgo58-copertura-${giri.indexOf(giro)}`);
  const esito = spawnSync(
    process.execPath,
    [
      path.join("node_modules", "vitest", "vitest.mjs"),
      ...giro.argomenti,
      "--coverage.enabled",
      "--coverage.provider=v8",
      "--coverage.include=src/**",
      "--coverage.reporter=json-summary",
      `--coverage.reportsDirectory=${cartella}`,
    ],
    { stdio: ["ignore", "inherit", "inherit"] }
  );
  if (esito.status !== 0) {
    console.error(`\nIl giro «${giro.nome}» non e' arrivato in fondo: la copertura non si misura su prove rosse.`);
    process.exit(1);
  }
  const riassunto = path.join(cartella, "coverage-summary.json");
  if (!existsSync(riassunto)) continue;
  for (const [file, v] of Object.entries(JSON.parse(readFileSync(riassunto, "utf8")))) {
    if (file === "total") continue;
    const prima = perFile.get(file);
    // ⚠️ Si tiene il MASSIMO fra i giri, mai la somma: lo stesso file puo'
    //    essere toccato da tutti e due, e sommare direbbe piu' del vero.
    if (!prima || v.statements.covered > prima.statements.covered) perFile.set(file, v);
  }
}

console.log("\n\nDOVE ARRIVANO LE PROVE, cartella per cartella\n");
const gruppi = new Map();
for (const [file, v] of perFile.entries()) {
  const rel = path.relative(process.cwd(), file);
  const pezzi = rel.split("/");
  const gruppo =
    rel.startsWith("src/lib/") && pezzi.length > 3 ? `src/lib/${pezzi[2]}` : pezzi.slice(0, 2).join("/");
  const riga = gruppi.get(gruppo) ?? { coperte: 0, tutte: 0, file: 0 };
  riga.coperte += v.statements.covered;
  riga.tutte += v.statements.total;
  riga.file += 1;
  gruppi.set(gruppo, riga);
}
let coperte = 0;
let tutte = 0;
for (const [gruppo, r] of [...gruppi.entries()].sort((a, b) => b[1].tutte - a[1].tutte)) {
  const pct = r.tutte ? (100 * r.coperte) / r.tutte : 0;
  console.log(
    `  ${gruppo.padEnd(24)} ${String(r.file).padStart(4)} file   ${String(r.coperte).padStart(6)}/${String(r.tutte).padEnd(6)} istruzioni   ${pct.toFixed(1).padStart(5)}%`
  );
  coperte += r.coperte;
  tutte += r.tutte;
}
console.log(`\n  in tutto: ${coperte}/${tutte} = ${((100 * coperte) / tutte).toFixed(2)}%`);
console.log(
  "\n⚠️ Fuori da questo conto ci sono le 459 prove contro il database\n" +
    "   (`npm run test:app`): girano su un progetto Supabase vero e non\n" +
    "   passano da questo strumento. Quello che qui risulta quasi a zero su\n" +
    "   `src/lib/api` e' in buona parte esercitato da loro."
);
