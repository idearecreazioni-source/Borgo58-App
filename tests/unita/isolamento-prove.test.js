import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CORSA,
  MINUTI_DI_GRAZIA,
  MINUTI_MASSIMI_DI_UN_GIRO,
  NUMERO_CORSA,
  giornoDiProva,
  marchio,
  nonDiNessuno,
  numeroDiCorsa,
  soloMiei,
} from "../app/aiuto.js";

// DUE GIRI DI PROVE NON SI CANCELLANO LE RIGHE A VICENDA — 01/09/2026
//
// 🔴 IL FATTO CHE HA PRODOTTO QUESTE PROVE, misurato. Alle 15:47 le 459
//    prove contro il database sono partite da due macchine insieme sullo
//    stesso progetto di prova. Il giro su GitHub e' diventato rosso su
//    `tesoreria.test.js` con «expected +0 to be 100» e «expected [] to have
//    a length of 1»: numeri che sembrano una regressione del gestionale e
//    non lo erano.
//
//    Le cause erano due, e la seconda non si vede guardando la prima:
//      1. le pulizie cancellavano per MARCATORE CONDIVISO
//         (`like("note", "TEST-AUTO fisc%")`), quindi il `beforeAll` di un
//         giro portava via i conti dell'altro;
//      2. le asserzioni contano TOTALI DI GIORNATA E DI ANNO
//         (`quadratura_fiscale`, `ricavi_non_fiscalizzati`), quindi anche
//         con le pulizie a posto due giri sulla stessa data si sommano e
//         «100» diventa «200».
//
// ⚠️ QUESTE PROVE NON APRONO NESSUN COLLEGAMENTO: girano con
//    `npm run test`, in mezzo secondo, e provano le regole da cui dipende
//    l'isolamento. Che poi le prove sul database le usino davvero lo
//    sorveglia il setaccio in `scripts/pulizie.mjs`.

const UNO = "aaa111";
const ALTRO = "bbb222";

describe("il marchio di un giro", () => {
  it("e' diverso da quello di un altro giro", () => {
    expect(marchio("__PROVA__", UNO)).not.toBe(marchio("__PROVA__", ALTRO));
  });

  it("e il modello di uno NON prende le righe dell'altro", () => {
    const mioValore = `${marchio("__PROVA__", UNO)} 1`;
    const suoModello = soloMiei("__PROVA__", ALTRO);
    // Il modello `like` di PostgREST: `%` sta per «qualunque coda».
    const prendeAncheLeMie = new RegExp(`^${suoModello.replace(/%/g, ".*")}$`).test(mioValore);
    expect(prendeAncheLeMie).toBe(false);
  });

  it("mentre il proprio modello le prende tutte", () => {
    for (const coda of ["", " 1", " 2", "chiuso", " A"]) {
      const valore = `${marchio("__PROVA__", UNO)}${coda}`;
      const suo = soloMiei("__PROVA__", UNO).replace(/%/g, ".*");
      expect(new RegExp(`^${suo}$`).test(valore)).toBe(true);
    }
  });

  it("il marcatore condiviso resta riconoscibile: un residuo si trova ancora", () => {
    // ⚠️ Serve alla pulizia a tempo: le righe di un giro morto si cercano
    //    ancora col prefisso di sempre, e si tolgono solo se sono vecchie.
    expect(marchio("__PROVA__", UNO).startsWith("__PROVA__")).toBe(true);
  });
});

describe("le date di fantasia", () => {
  it("sono diverse per giri diversi", () => {
    expect(giornoDiProva(2091, numeroDiCorsa(UNO))).not.toBe(
      giornoDiProva(2091, numeroDiCorsa(ALTRO))
    );
  });

  it("stanno dentro l'anno chiesto, e sono una data vera", () => {
    for (const n of [0, 45, 89]) {
      const giorno = giornoDiProva(2091, n);
      expect(giorno).toMatch(/^2091-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(giorno))).toBe(false);
    }
  });

  // 🔴 La fascia non e' scelta a caso: gli anni vicini a quelli veri
  //    sarebbero un marcatore che smette di essere neutro appena qualcuno
  //    interroga quella colonna (CLAUDE.md §8, 17/08). Il locale apre nel
  //    2027.
  it("il numero del giro sta in una fascia che non tocca gli anni veri", () => {
    for (const corsa of [UNO, ALTRO, CORSA, "zzz999", "0"]) {
      const n = numeroDiCorsa(corsa);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(90);
      expect(1800 + n).toBeLessThan(1890);
      expect(2100 + n).toBeGreaterThan(2099);
    }
  });

  it("e il numero di questo giro rispetta la stessa fascia", () => {
    expect(NUMERO_CORSA).toBeGreaterThanOrEqual(0);
    expect(NUMERO_CORSA).toBeLessThan(90);
  });
});

describe("la pulizia di cio' che nessun giro sta usando", () => {
  it("guarda indietro, mai avanti", () => {
    expect(new Date(nonDiNessuno()).getTime()).toBeLessThan(Date.now());
  });

  // ⚠️ Il giro piu' lungo misurato dura 8 minuti (480 secondi su GitHub il
  //    01/09). La grazia deve stargli molto larga, o una pulizia
  //    considererebbe abbandonata una riga di un giro ancora vivo — che e'
  //    esattamente il difetto che si sta chiudendo.
  it("e lascia stare tutto quello che un giro vivo potrebbe aver scritto", () => {
    const otto = Date.now() - 8 * 60_000;
    expect(new Date(nonDiNessuno()).getTime()).toBeLessThan(otto);
  });

  // 🔴 IL RAPPORTO CHE RENDE LA BONIFICA UNA REGOLA E NON UN'ABITUDINE.
  //    Oltre `timeout-minutes` nessun giro su GitHub puo' essere vivo:
  //    lo uccide il runner. Se la grazia fosse uguale o piu' corta, la
  //    prima riga di un giro partito a T diventerebbe candidata mentre
  //    quel giro puo' ancora scrivere.
  // ⚠️ Il tetto si LEGGE dal file dei controlli, non si ricopia: un numero
  //    ricopiato e' una frase destinata a diventare falsa.
  it("la grazia supera il tetto di tempo del lavoro sul database", () => {
    const workflow = readFileSync(".github/workflows/controlli.yml", "utf8");
    const tetti = [...workflow.matchAll(/timeout-minutes:\s*(\d+)/g)].map((m) => Number(m[1]));
    expect(tetti.length).toBeGreaterThan(0);
    expect(MINUTI_DI_GRAZIA).toBeGreaterThan(Math.max(...tetti));
  });

  // 🔴 E VALE ANCHE PER UN GIRO LANCIATO A MANO — 01/09/2026, rilievo
  //    della revisione. Su GitHub il tetto lo impone il runner; su un
  //    computer non lo imponeva nessuno, e un giro impiantato per un'ora
  //    restava vivo oltre la grazia. «Di solito dura otto minuti» non e'
  //    un limite: e' una convenzione, e una convenzione non protegge.
  it("nessun giro puo' vivere fino alla grazia, nemmeno lanciato a mano", () => {
    expect(MINUTI_DI_GRAZIA).toBeGreaterThan(MINUTI_MASSIMI_DI_UN_GIRO);
  });

  // ⚠️ Il tetto vale solo se il comando ci passa davvero: `test:app` deve
  //    lanciare il programma che lo impone, non `vitest` dritto.
  it("e il comando delle prove passa dal programma che lo impone", () => {
    const pacchetto = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pacchetto.scripts["test:app"]).toContain("scripts/prove-app.mjs");
    expect(pacchetto.scripts["test:app"]).not.toMatch(/(^|&&\s*)vitest\s/);
  });
});
