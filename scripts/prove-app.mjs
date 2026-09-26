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
import { argomentiDiEsclusione } from "./prove-che-costano.mjs";
import { frasePerChiAspetta, lascia, prendi } from "./un-giro-per-volta.mjs";

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
  // 🔴 LE PROVE CHE CHIAMANO IL MODELLO RESTANO FUORI, se non le si chiede
  //    apposta — 09/09/2026. Girano a ogni proposta e a ogni push, e ognuna
  //    di quelle chiamate si paga: una spesa che parte da sola a ogni giro
  //    non e' una scelta di nessuno, e' una perdita che cresce (stessa
  //    famiglia dei ritentativi senza tetto del 12/08).
  //    ⚠️ E SI DICE SEMPRE QUALI, anche quando non ne resta fuori nessuna:
  //    un'esclusione silenziosa e' copertura persa travestita da verde.
  const colModello = filtri.includes("--col-modello");
  const puliti = filtri.filter((f) => f !== "--col-modello");
  const { argomenti: esclusioni, fuori } = colModello
    ? { argomenti: [], fuori: [] }
    : argomentiDiEsclusione(".");
  if (colModello) {
    scrivi("Giro CON le prove che chiamano il modello: questo giro si paga.");
  } else if (fuori.length > 0) {
    scrivi(
      "Fuori da questo giro, perche' chiamano il modello e si pagano:" +
        fuori.map((f) => `\n  · ${f.file}  (${f.funzioni.join(", ")})`).join("") +
        "\nPer lanciarle davvero:  npm run test:app -- --col-modello"
    );
  }

  // 🔴 UN FILE SOLO VUOL DIRE UN FILE SOLO — 10/09/2026, misurato. Prima
  //    «tests/app» veniva passato SEMPRE, e per vitest i filtri si sommano:
  //    `npm run test:app -- tests/app/deposito-documenti.test.js` ha fatto
  //    girare tutte le 557 prove dei 77 file. Il commento in cima a questo
  //    file prometteva il contrario.
  //    ⚠️ Un file che non sta in tests/app si RIFIUTA: girerebbe con la
  //    configurazione delle prove sul database senza esserlo.
  //    ⚠️ Due casi trovati dalla revisione: il valore di un'opzione non è un
  //    file (`-t tests/app/x.test.js` cerca le prove con quel NOME), e un
  //    percorso scritto per intero — su Windows `C:\...\tests\app\x.test.js`
  //    — si confronta con la cartella del progetto, non come testo.
  const conValore = new Set([
    "-t", "--testNamePattern", "--exclude", "--reporter", "--outputFile",
    "--project", "--shard", "--bail", "--retry", "--root", "--dir", "--config",
  ]);
  const relativo = (f) => path.relative(process.cwd(), path.resolve(f)).replace(/\\/g, "/");
  const fileChiesti = puliti.filter(
    (f, i) =>
      !f.startsWith("-") &&
      !conValore.has(puliti[i - 1]) &&
      (/\.test\.[cm]?[jt]sx?$/.test(f) || relativo(f).startsWith("tests/"))
  );
  const fuoriPosto = fileChiesti.filter((f) => !relativo(f).startsWith("tests/app/"));
  if (fuoriPosto.length > 0) {
    scrivi(
      `Non sono prove sul database: ${fuoriPosto.join(", ")}.\n` +
        "Con questo comando si lanciano solo i file di tests/app/."
    );
    finito(2);
    return null;
  }

  const giro = spawnFn(process.execPath, [
    path.join("node_modules", "vitest", "vitest.mjs"),
    "run",
    ...(fileChiesti.length > 0 ? [] : ["tests/app"]),
    "--no-file-parallelism",
    "--config",
    "vitest.app.config.js",
    ...puliti,
    ...esclusioni,
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
    lascia();
    finito(codice ?? (segnale ? 1 : 0));
  });

  return giro;
}

// Lanciato come comando: `npm run test:app`.
//
// 🔴 UN GIRO PER VOLTA, e il lucchetto sta QUI e non dentro `avviaConTetto`:
//    quella funzione e' provata con uno spawn finto e un orologio finto, e
//    non deve toccare il disco. Il divieto riguarda il COMANDO — che e' la
//    cosa che due volte insieme fa danno.
//    Il database di prova e' uno solo: due giri si cancellano le righe a
//    vicenda, e il risultato sembra un disastro del codice invece che una
//    collisione (27/08: 41 file falliti, tutte verdi al rilancio).
if (process.argv[1] && process.argv[1].endsWith("prove-app.mjs")) {
  const posto = prendi();
  if (!posto.preso) {
    console.error(frasePerChiAspetta(posto.altrui));
    process.exit(1);
  }
  // ⚠️ Anche se il giro viene ucciso: senza questo il lucchetto resterebbe
  //    fino alla scadenza, e nel frattempo nessuno potrebbe piu' lanciare.
  for (const segnale of ["exit", "SIGINT", "SIGTERM"]) process.on(segnale, () => lascia());
  avviaConTetto({ filtri: process.argv.slice(2) });
}
