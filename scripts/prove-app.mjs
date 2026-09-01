// LE PROVE CONTRO IL DATABASE, CON UN TETTO DI TEMPO — 01/09/2026
//
// 🔴 PERCHE' ESISTE, e non e' una comodita'. La bonifica delle righe
//    abbandonate si appoggia a una scadenza: oltre `MINUTI_DI_GRAZIA` (45)
//    una riga di prova viene considerata di nessuno e tolta. Quella
//    scadenza e' sicura **solo se nessun giro puo' vivere fin li'**:
//
//      su GitHub  -> lo uccide il runner a `timeout-minutes: 30`
//      in locale  -> lo uccide questo programma a 40 minuti
//
//    45 > 40 > 30. E' l'invariante che rende la bonifica una regola invece
//    che una speranza.
//
// ⚠️ NON USA `timeout` DELLA SHELL: su Windows quel comando e' un'altra
//    cosa (aspetta e basta), e Alessio lavora da li'. Il tetto vive nel
//    programma, non nel modo di lanciarlo.
//
// ⚠️ E IL COMANDO CANONICO E' L'UNICA VIA SUPPORTATA: `vitest.app.config.js`
//    si RIFIUTA di partire se non arriva da qui (guarda `BORGO58_CON_TETTO`).
//    Senza quel rifiuto, un `npx vitest run tests/app --config
//    vitest.app.config.js` lanciato a mano girerebbe **senza nessun tetto**,
//    e potrebbe restare vivo oltre la grazia — cioe' esattamente il caso
//    che questo programma esiste per rendere impossibile.
//    Per lanciare un file solo: `npm run test:app -- tests/app/quello.test.js`.

import { spawn } from "node:child_process";
import path from "node:path";

import { MINUTI_MASSIMI_DI_UN_GIRO } from "./tempi-prove.mjs";

/** Quanto si aspetta, dopo il garbato SIGTERM, prima di insistere. */
export const SECONDI_PRIMA_DI_INSISTERE = 15;

/**
 * Lancia il giro e lo ferma se sfora. Separata dal comando per poterla
 * provare **senza far girare niente**: le prove le passano un finto
 * `spawn` e un orologio finto (`tests/unita/tetto-del-giro.test.js`).
 *
 * ⚠️ La prima versione non era separata, e per collaudarla l'ho eseguita:
 *    ha avviato la suite vera contro il progetto di prova, due volte.
 *    *Si collauda la parte che non ha effetti, non quella che li ha.*
 */
export function avviaConTetto({
  spawnFn = spawn,
  minuti = MINUTI_MASSIMI_DI_UN_GIRO,
  filtri = [],
  scrivi = (r) => console.error(r),
  finito = (codice) => process.exit(codice),
} = {}) {
  const giro = spawnFn(process.execPath, [
    path.join("node_modules", "vitest", "vitest.mjs"),
    "run",
    "tests/app",
    "--no-file-parallelism",
    "--config",
    "vitest.app.config.js",
    ...filtri,
  ], { stdio: "inherit", env: { ...process.env, BORGO58_CON_TETTO: "1" } });

  let insisti;
  const tetto = setTimeout(() => {
    scrivi(
      `\n::error::Il giro di prove ha superato il tetto di ${minuti} minuti ed e' stato fermato.`
    );
    scrivi(
      "Non e' una prova fallita: e' un giro che non finiva. Il tetto esiste perche'\n" +
        "la bonifica delle righe abbandonate si fida di una scadenza, e un giro vivo\n" +
        "oltre quella scadenza si vedrebbe cancellare le proprie righe da un altro giro."
    );
    // SIGTERM prima: vitest chiude i file aperti e lascia meno righe indietro.
    giro.kill("SIGTERM");
    insisti = setTimeout(() => giro.kill("SIGKILL"), SECONDI_PRIMA_DI_INSISTERE * 1000);
    insisti.unref?.();
  }, minuti * 60_000);

  giro.on("exit", (codice, segnale) => {
    clearTimeout(tetto);
    clearTimeout(insisti);
    finito(codice ?? (segnale ? 1 : 0));
  });

  return giro;
}

// Lanciato come comando: `npm run test:app`.
if (process.argv[1] && process.argv[1].endsWith("prove-app.mjs")) {
  avviaConTetto({ filtri: process.argv.slice(2) });
}
