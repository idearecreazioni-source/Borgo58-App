import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 🔴 NATO DA UN GUASTO VERO, il 06/09/2026. Alessio preme «Approva» su un
//    appunto, il pulsante dice «Lo sto scrivendo…», e non succede niente. La
//    causa: il gestionale nel browser era la versione nuova, la funzione
//    online `operazioni-atomiche` era ancora quella di prima e **non
//    conosceva `approva_appunto`**. Il corridoio ha risposto «operazione non
//    ammessa» e la scrittura non e' partita.
//
// ⚠️ LE CAUSE POSSIBILI SONO DUE, E QUESTA PROVA NE CHIUDE UNA SOLA:
//      (a) il corridoio nel REPOSITORY non conosce l'operazione — un nome
//          scritto male, un'operazione nuova aggiunta al client e dimenticata
//          nell'elenco. **Questa prova la prende, e diventa rossa da sola.**
//      (b) il corridoio nel repository la conosce, ma quello INSTALLATO e'
//          indietro. E' quello che e' successo, e non si vede leggendo il
//          codice: si vede solo chiedendo al progetto quale versione ha su.
//          Lo guarda `scripts/rilascio.mjs` prima di pubblicare.
//
// ⚠️ Si legge il TESTO dei file e non si importa niente: il corridoio e' una
//    funzione Deno, e importarla qui vorrebbe dire farla girare.

const CORRIDOIO = "supabase/functions/operazioni-atomiche/index.ts";

/** I nomi dentro l'elenco chiuso `OPERAZIONI` del corridoio. */
export function operazioniAmmesse(sorgente) {
  const dentro = sorgente.slice(
    sorgente.indexOf("const OPERAZIONI = new Set(["),
    sorgente.indexOf("]);", sorgente.indexOf("const OPERAZIONI = new Set([")),
  );
  // ⚠️ Solo le stringhe vere: i nomi citati nei commenti non contano, e
  //    contarli farebbe passare un'operazione che qualcuno ha solo
  //    *raccontato* di aver aggiunto.
  return new Set(
    [...dentro.matchAll(/^\s*"([a-z0-9_]+)",/gm)].map((m) => m[1]),
  );
}

/** I nomi che il gestionale passa a `eseguiOperazione`. */
export function operazioniChiamate(cartella = "src") {
  const trovate = new Map();
  const gira = (dir) => {
    for (const voce of readdirSync(dir)) {
      const percorso = join(dir, voce);
      if (statSync(percorso).isDirectory()) { gira(percorso); continue; }
      if (!/\.(js|jsx)$/.test(voce)) continue;
      const testo = readFileSync(percorso, "utf8");
      for (const m of testo.matchAll(/eseguiOperazione\(\s*"([a-z0-9_]+)"/g)) {
        if (!trovate.has(m[1])) trovate.set(m[1], percorso);
      }
    }
  };
  gira(cartella);
  return trovate;
}

describe("il corridoio conosce ogni gesto che il gestionale gli chiede", () => {
  const ammesse = operazioniAmmesse(readFileSync(CORRIDOIO, "utf8"));
  const chiamate = operazioniChiamate();

  it("l'elenco del corridoio si legge davvero", () => {
    // ⚠️ Senza questa riga, un cambio di forma del file darebbe un elenco
    //    vuoto e **tutti i controlli qui sotto passerebbero**: e' la trappola
    //    del caso vuoto, che in questo progetto e' gia' costata quattro volte.
    expect(ammesse.size).toBeGreaterThan(30);
    expect(ammesse.has("approva_appunto")).toBe(true);
  });

  it("il gestionale chiama davvero delle operazioni", () => {
    expect(chiamate.size).toBeGreaterThan(10);
  });

  it("🔴 nessuna operazione chiamata dal gestionale manca nel corridoio", () => {
    const mancanti = [...chiamate.entries()]
      .filter(([nome]) => !ammesse.has(nome))
      .map(([nome, dove]) => `${nome} — chiamata in ${dove}`);

    expect(
      mancanti,
      "queste operazioni il gestionale le chiede e il corridoio non le conosce:\n" +
        mancanti.join("\n"),
    ).toEqual([]);
  });
});
