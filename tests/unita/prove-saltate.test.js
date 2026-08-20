import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { proveCondizionate } from "../app/aiuto";

// 🔴 SI CERCA LA CHIAMATA, NON IL NOME — e questo l'ha trovato la rottura,
// non la rilettura: togliendo la chiamata da un file l'import restava, la
// stringa «denunciaSaltiCorridoio» c'era lo stesso, e la prova passava
// verde. *Una prova che cerca un nome invece di un gesto non sta provando
// il gesto* — la stessa lezione del 19/08 sui due modi di scrivere
// «se non sei il titolare».
const CHIAMATA = /await[ \t]+denunciaSaltiCorridoio[(]/;

// LE PROVE CHE SI SPENGONO DA SOLE — 20/08/2026.
//
// 🔴 «Tutte le prove passano» non distingue una prova verde da una che non
// è mai partita. Le prove condizionate al corridoio sono **26** su **nove**
// file, e fino al 20/08 la sentinella che denunciava il salto viveva in un
// file solo, con il numero scritto dentro un testo: diceva «le tre prove
// del corridoio», ed erano tre quando è stata scritta.
//
// ⚠️ Qui non c'è nessun numero scritto a mano, e non è un vezzo: è la forma
// che questo progetto ha già adottato con `collaudo:stato` e con l'elenco
// delle funzioni aperte ad anon. *Un conteggio scritto in un documento è
// un'affermazione che nessuna verifica controlla.*

const CARTELLA = "tests/app";

function fileDiProva() {
  return readdirSync(CARTELLA)
    .filter((n) => n.endsWith(".test.js"))
    .map((n) => join(CARTELLA, n).replace(/\\/g, "/"));
}

describe("una prova saltata si denuncia da sola", () => {
  it("il conteggio delle prove condizionate si conta, e distingue", () => {
    // Il caso vero, letto dal sorgente.
    expect(proveCondizionate('it.skipIf(!CORRIDOIO)("a", () => {});')).toBe(1);
    expect(
      proveCondizionate('it.skipIf(!CORRIDOIO)("a", 0);\nit.skipIf( ! CORRIDOIO )("b", 0);')
    ).toBe(2);
    // ⚠️ E non conta quello che non è un salto: una prova normale, o la
    // parola CORRIDOIO in un commento.
    expect(proveCondizionate('it("normale", () => {});\n// CORRIDOIO installato')).toBe(0);
    expect(proveCondizionate("")).toBe(0);
    // 🔴 E la seconda forma, trovata dalla prova scritta al contrario: un
    // `describe` intero condizionato salta TUTTE le prove del suo blocco, e
    // cercando solo `it.skipIf` risultava zero su un file che ne salta tre.
    expect(
      proveCondizionate('describe.skipIf(!CORRIDOIO)("x", () => {\n it("a",0);\n it("b",0);\n});'),
      "un describe saltato per intero non viene contato"
    ).toBe(2);
  });

  it("🔴 OGNI file che salta prove ha la sua sentinella — non uno solo", () => {
    // Prima il 20/08 la sentinella stava in `permessi.test.js` e basta:
    // chi lanciasse `vitest run tests/app/tesoreria.test.js` col corridoio
    // spento vedeva tre prove «passate» che non erano mai partite.
    const senzaSentinella = [];
    for (const file of fileDiProva()) {
      const sorgente = readFileSync(file, "utf8");
      if (proveCondizionate(sorgente) === 0) continue;
      if (!CHIAMATA.test(sorgente)) senzaSentinella.push(file);
    }
    expect(
      senzaSentinella,
      "Questi file saltano prove senza denunciarlo. In cima va:\n" +
        "  await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);\n  " +
        senzaSentinella.join("\n  ")
    ).toEqual([]);
  });

  it("...e nessuno tiene una sentinella senza avere prove da saltare", () => {
    // ⚠️ Il verso opposto, e serve: una sentinella su un file che non salta
    // più niente è un guardiano che non guarda nulla — e il giorno che
    // qualcuno lo vede passare verde ci crede.
    const inutili = fileDiProva().filter((f) => {
      const s = readFileSync(f, "utf8");
      return CHIAMATA.test(s) && proveCondizionate(s) === 0;
    });
    expect(inutili, "questi file hanno una sentinella e niente da sorvegliare").toEqual([]);
  });

  it("il censimento dei salti si legge dai file, e non da un numero scritto qui", () => {
    const perFile = fileDiProva()
      .map((f) => [f, proveCondizionate(readFileSync(f, "utf8"))])
      .filter(([, n]) => n > 0);
    const totale = perFile.reduce((s, [, n]) => s + n, 0);

    // ⚠️ Nessuna asserzione su «26» o su «nove»: quei numeri cambiano, e
    // scriverli qui li farebbe invecchiare esattamente come il messaggio
    // che questa prova sostituisce. Quello che si afferma è una PROPRIETÀ:
    // se esistono prove condizionate, esiste chi le denuncia.
    if (totale > 0) {
      expect(perFile.length).toBeGreaterThan(0);
      for (const [f] of perFile) {
        expect(
          CHIAMATA.test(readFileSync(f, "utf8")),
          `${f} salta prove e non lo dice`
        ).toBe(true);
      }
    }
  });
});
