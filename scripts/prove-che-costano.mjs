// =====================================================================
// LE PROVE CHE COSTANO SOLDI — 09/09/2026
// =====================================================================
// 🔴 PERCHE' ESISTE, misurato. `npm run test:app` lancia tutto quello che
//    sta in `tests/app`, e li' dentro c'e' un file che chiama davvero il
//    modello: `domande-memo.test.js` fa **otto** richieste vere per giro.
//    I controlli su GitHub girano a ogni proposta e a ogni push su
//    `master`, quindi quelle otto richieste si pagano a ogni giro — e il
//    conto cresce da solo, senza che nessuno lo decida.
//
// ⚠️ E' LA STESSA FAMIGLIA DEL 12/08: *ogni ritentativo automatico che
//    costa soldi vuole un contatore e un tetto, altrimenti e' una perdita
//    che cresce da sola*. Li' erano le mail riprovate all'infinito, qui e'
//    una suite di prove — la forma e' identica, e la cura anche: la spesa
//    automatica si spegne, e resta un gesto che qualcuno fa apposta.
//
// 🔴 L'ELENCO NON SI SCRIVE A MANO, e non e' pignoleria: un elenco scritto
//    a mano e' gia' scaduto il giorno dopo (in questo progetto e' successo
//    coi vincoli senza frase, con le lapidi, con l'elenco dei dati di
//    collaudo). Qui si ricava:
//      1. quali funzioni online chiamano il modello  -> si guarda il loro
//         sorgente, che il modello lo nomina;
//      2. quali prove invocano una di quelle          -> si guarda il loro
//         testo.
//    Una prova nuova che chiami il modello finisce fuori **da sola**, senza
//    che nessuno si ricordi di aggiungerla da nessuna parte.
//
// ⚠️ SI ESCLUDE, NON SI CANCELLA, e la differenza e' tutta: quelle prove
//    provano una cosa che nessun'altra prova puo' provare — che il modello
//    capisce davvero. Restano, si lanciano quando si vuole
//    (`npm run test:app -- --col-modello`), e il comando **dice sempre**
//    quali ha lasciato fuori. Un'esclusione silenziosa sarebbe una perdita
//    di copertura travestita da suite verde.

import fs from "node:fs";
import path from "node:path";

/** Come si riconosce, in un sorgente, che li' dentro si paga. */
const SEGNI_DI_SPESA = [/@anthropic-ai/i, /\bAnthropic\b/, /anthropic\.com/i];

/**
 * Le funzioni online che chiamano il modello.
 *
 * ⚠️ Si guarda TUTTA la cartella della funzione, non il solo `index.ts`: il
 * giorno che la chiamata si sposta in un file accanto, guardare solo
 * l'ingresso direbbe che quella funzione non costa niente.
 */
export function funzioniCheCostano(radice = ".") {
  const base = path.join(radice, "supabase", "functions");
  if (!fs.existsSync(base)) return new Set();
  const care = new Set();
  for (const voce of fs.readdirSync(base, { withFileTypes: true })) {
    if (!voce.isDirectory()) continue;
    const cartella = path.join(base, voce.name);
    let testo = "";
    for (const f of fs.readdirSync(cartella)) {
      if (!/\.(ts|js|mjs)$/.test(f)) continue;
      testo += fs.readFileSync(path.join(cartella, f), "utf8");
    }
    if (SEGNI_DI_SPESA.some((r) => r.test(testo))) care.add(voce.name);
  }
  return care;
}

/**
 * I file di prova che invocano una funzione online a pagamento.
 *
 * Torna i percorsi con le barre in avanti, perche' e' la forma che vitest
 * si aspetta anche su Windows.
 */
export function proveCheCostano(radice = ".") {
  const care = funzioniCheCostano(radice);
  const cartella = path.join(radice, "tests", "app");
  if (care.size === 0 || !fs.existsSync(cartella)) return [];
  const fuori = [];
  for (const f of fs.readdirSync(cartella)) {
    if (!f.endsWith(".test.js")) continue;
    const testo = fs.readFileSync(path.join(cartella, f), "utf8");
    // ⚠️ Si cerca l'INVOCAZIONE, non il nome: `tests/app/permessi.test.js`
    //    nomina le funzioni online per contarle, e non ne chiama nessuna.
    //    Confondere «la nomina» con «la chiama» spegnerebbe prove che non
    //    costano niente.
    const chiamate = [...testo.matchAll(/functions\s*\.\s*invoke\(\s*["'`]([\w-]+)["'`]/g)]
      .map((m) => m[1])
      .filter((nome) => care.has(nome));
    if (chiamate.length > 0) {
      fuori.push({
        file: `tests/app/${f}`,
        funzioni: [...new Set(chiamate)].sort(),
      });
    }
  }
  return fuori.sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * Gli `--exclude` da passare a vitest, coi suoi esclusi di sempre accanto.
 *
 * 🔴 I DEFAULT SI RIMETTONO A MANO perche' `--exclude` sulla riga di
 *    comando **sostituisce** quelli della configurazione invece di
 *    aggiungersi: senza, si tornerebbe a frugare dentro `node_modules`.
 */
export const ESCLUSI_DI_SEMPRE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.{idea,git,cache,output,temp}/**",
];

export function argomentiDiEsclusione(radice = ".") {
  const fuori = proveCheCostano(radice);
  if (fuori.length === 0) return { argomenti: [], fuori };
  const argomenti = [...ESCLUSI_DI_SEMPRE, ...fuori.map((f) => `**/${path.basename(f.file)}`)]
    .flatMap((g) => ["--exclude", g]);
  return { argomenti, fuori };
}
