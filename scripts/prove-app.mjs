// LE PROVE CONTRO IL DATABASE, CON UN TETTO DI TEMPO — 01/09/2026
//
// 🔴 PERCHE' ESISTE, e non e' una comodita'. La bonifica delle righe
//    abbandonate si appoggia a una scadenza: oltre `MINUTI_DI_GRAZIA` una
//    riga di prova viene considerata di nessuno e tolta. Su GitHub quella
//    scadenza la fa rispettare il runner, che uccide il lavoro a
//    `timeout-minutes`. **Un giro lanciato a mano non aveva nessun tetto**:
//    impiantato per un'ora restava vivo oltre la grazia, e le sue righe
//    diventavano candidate mentre lui poteva ancora scriverle.
//
// ⚠️ E' la differenza fra una convenzione e una protezione: «di solito
//    dura otto minuti» non e' un limite. Adesso il limite c'e' e vale
//    ovunque, perche' passa da qui.
//
// ⚠️ NON USA `timeout` DELLA SHELL: su Windows quel comando e' un'altra
//    cosa (aspetta e basta), e Alessio lavora da li'. Il tetto vive nel
//    programma, non nel modo di lanciarlo.

import { spawn } from "node:child_process";
import path from "node:path";

import { MINUTI_MASSIMI_DI_UN_GIRO } from "./tempi-prove.mjs";

const argomenti = [
  path.join("node_modules", "vitest", "vitest.mjs"),
  "run",
  "tests/app",
  "--no-file-parallelism",
  "--config",
  "vitest.app.config.js",
  ...process.argv.slice(2),
];

const giro = spawn(process.execPath, argomenti, { stdio: "inherit" });

const tetto = setTimeout(
  () => {
    console.error(
      `\n::error::Il giro di prove ha superato il tetto di ${MINUTI_MASSIMI_DI_UN_GIRO} minuti ed e' stato fermato.`
    );
    console.error(
      "Non e' una prova fallita: e' un giro che non finiva. Il tetto esiste perche'\n" +
        "la bonifica delle righe abbandonate si fida di una scadenza, e un giro vivo\n" +
        "oltre quella scadenza si vedrebbe cancellare le proprie righe da un altro giro."
    );
    // SIGTERM prima: vitest chiude i file aperti e lascia meno righe indietro.
    giro.kill("SIGTERM");
    setTimeout(() => giro.kill("SIGKILL"), 15_000).unref();
  },
  MINUTI_MASSIMI_DI_UN_GIRO * 60_000
);

giro.on("exit", (codice, segnale) => {
  clearTimeout(tetto);
  process.exit(codice ?? (segnale ? 1 : 0));
});
