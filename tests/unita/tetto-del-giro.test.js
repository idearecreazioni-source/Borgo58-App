import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { SECONDI_PRIMA_DI_INSISTERE, avviaConTetto } from "../../scripts/prove-app.mjs";
import { MINUTI_DI_GRAZIA, MINUTI_MASSIMI_DI_UN_GIRO } from "../../scripts/tempi-prove.mjs";

// IL TETTO CHE RENDE SICURA LA BONIFICA — 01/09/2026
//
// 🔴 L'INVARIANTE, scritto per intero perche' e' l'unica cosa che rende la
//    bonifica una regola invece che una speranza:
//
//      Una riga e' bonificabile dopo 45 minuti SOLTANTO perche' ogni
//      esecuzione supportata passa da un limite forzato inferiore:
//      30 minuti su GitHub (`timeout-minutes`) e 40 minuti nel comando
//      locale canonico (`npm run test:app`).
//
//    45 > 40 > 30. Se uno dei tre numeri si muove nel verso sbagliato, la
//    bonifica puo' cancellare le righe di un giro ancora vivo.
//
// ⚠️ QUESTE PROVE NON FANNO GIRARE NIENTE: al programma si passa un finto
//    `spawn` e un orologio finto. La prima versione del tetto non era
//    separabile, e per collaudarla e' stata ESEGUITA — avviando due volte
//    la suite vera contro il progetto di prova. *Si collauda la parte che
//    non ha effetti, non quella che li ha.*

function finto() {
  const chiamate = [];
  let alExit;
  const bimbo = {
    kill: (segnale) => chiamate.push(segnale),
    on: (evento, f) => {
      if (evento === "exit") alExit = f;
    },
  };
  return { bimbo, chiamate, esci: (codice) => alExit?.(codice, null) };
}

describe("il tetto di tempo di un giro di prove", () => {
  it("lascia lavorare un giro che sta dentro il tetto, e non lo tocca", () => {
    vi.useFakeTimers();
    const { bimbo, chiamate, esci } = finto();
    let uscita = null;
    avviaConTetto({
      spawnFn: () => bimbo,
      minuti: MINUTI_MASSIMI_DI_UN_GIRO,
      finito: (c) => (uscita = c),
    });
    // Il giro piu' lungo misurato: 8 minuti.
    vi.advanceTimersByTime(8 * 60_000);
    expect(chiamate).toEqual([]);
    esci(0);
    expect(uscita).toBe(0);
    // E dopo che e' finito, il tetto non deve piu' scattare su nessuno.
    vi.advanceTimersByTime(60 * 60_000);
    expect(chiamate).toEqual([]);
    vi.useRealTimers();
  });

  it("ferma un giro che sfora, prima con garbo e poi insistendo", () => {
    vi.useFakeTimers();
    const { bimbo, chiamate } = finto();
    const detto = [];
    avviaConTetto({
      spawnFn: () => bimbo,
      minuti: MINUTI_MASSIMI_DI_UN_GIRO,
      scrivi: (r) => detto.push(r),
      finito: () => {},
    });
    vi.advanceTimersByTime(MINUTI_MASSIMI_DI_UN_GIRO * 60_000 - 1);
    expect(chiamate).toEqual([]); // un istante prima: ancora vivo
    vi.advanceTimersByTime(1);
    expect(chiamate).toEqual(["SIGTERM"]);
    vi.advanceTimersByTime(SECONDI_PRIMA_DI_INSISTERE * 1000);
    expect(chiamate).toEqual(["SIGTERM", "SIGKILL"]);
    expect(detto.join("\n")).toContain(String(MINUTI_MASSIMI_DI_UN_GIRO));
    vi.useRealTimers();
  });

  // 🔴 IL CASO 3 AL CONFINE, che una riga «appena creata» non dimostra.
  //    Un giro che ha superato la VECCHIA soglia (30 minuti) e' ancora
  //    vivo e le sue righe devono restare intoccabili: lo sono perche' la
  //    grazia e' 45, e lui non puo' arrivarci — a 40 lo ammazza il tetto.
  it("un giro vivo oltre la vecchia soglia resta protetto, e non puo' arrivare alla grazia", () => {
    vi.useFakeTimers();
    const { bimbo, chiamate } = finto();
    avviaConTetto({ spawnFn: () => bimbo, minuti: MINUTI_MASSIMI_DI_UN_GIRO, finito: () => {} });

    // 35 minuti: oltre la vecchia soglia di 30, ancora vivo.
    vi.advanceTimersByTime(35 * 60_000);
    expect(chiamate).toEqual([]);
    // Le sue righe piu' vecchie hanno 35 minuti: sotto la grazia, quindi
    // nessuna bonifica le puo' toccare.
    expect(35).toBeLessThan(MINUTI_DI_GRAZIA);

    // E non potra' mai arrivare a 45: a 40 viene fermato.
    vi.advanceTimersByTime(5 * 60_000);
    expect(chiamate).toEqual(["SIGTERM"]);
    expect(MINUTI_MASSIMI_DI_UN_GIRO).toBeLessThan(MINUTI_DI_GRAZIA);
    vi.useRealTimers();
  });

  it("e passa al giro il segno che il tetto c'e' (senza cui la configurazione rifiuta)", () => {
    let visto;
    avviaConTetto({
      spawnFn: (_c, _a, opzioni) => {
        visto = opzioni;
        return finto().bimbo;
      },
      finito: () => {},
    });
    expect(visto.env.BORGO58_CON_TETTO).toBe("1");
  });
});

describe("l'invariante fra i tre limiti", () => {
  it("45 > 40 > 30, e i due estremi si leggono dai file che li impongono", () => {
    // Il tetto di GitHub sta nel file dei controlli, quello locale nel
    // comando: nessuno dei due e' ricopiato qui.
    expect(MINUTI_DI_GRAZIA).toBeGreaterThan(MINUTI_MASSIMI_DI_UN_GIRO);
  });

  // ⚠️ IL LIMITE, DICHIARATO: un invio diretto di vitest che aggiri il
  //    comando canonico non sarebbe protetto dal tetto locale. Per questo
  //    la configurazione delle prove sul database si RIFIUTA di partire
  //    senza il segno che il comando canonico mette.
  it("la configurazione delle prove sul database rifiuta un avvio diretto", () => {
    const config = new URL("../../vitest.app.config.js", import.meta.url);
    const testo = readFileSync(config, "utf8");
    expect(testo).toContain("BORGO58_CON_TETTO");
    expect(testo).toMatch(/throw new Error/);
  });
});
