import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FILE, generaIndice, rovesciamenti } from "../../scripts/indice-rovesciamenti.mjs";

// 🔴 L'INDICE DEI ROVESCIAMENTI NON PUÒ PIÙ RESTARE INDIETRO IN SILENZIO.
// Fino al 27/08/2026 era scritto a mano e si era fermato al 21/08: 57 sezioni
// raccontate, 19 nell'indice. E quell'indice risponde a una domanda sola —
// «questa decisione l'abbiamo già rovesciata prima?» — che si risponde
// contando: monco, dice «no, è la prima volta» su una cosa già rovesciata.
//
// ⚠️ QUESTA PROVA È IL GUARDIANO, non il comando: chi aggiunge una sezione e
// dimentica `npm run indice` la trova rossa. Senza, si tornerebbe a una
// disciplina — e le discipline si degradano.
describe("l'indice dei rovesciamenti è allineato alle sezioni", () => {
  const testo = readFileSync(FILE, "utf8");

  it("ogni sezione raccontata compare nell'indice", () => {
    expect(generaIndice(testo)).toBe(testo);
  });

  it("le sezioni si leggono in tutt'e due le forme di intestazione", () => {
    // ⚠️ Le intestazioni hanno due forme — la data in mezzo o in fondo — e
    // riconoscerne una sola perderebbe le altre IN SILENZIO, che è il difetto
    // che questo file chiude.
    const voci = rovesciamenti(testo);
    expect(voci.length).toBeGreaterThan(50);
    expect(voci.every((v) => v.titolo.length > 0)).toBe(true);
    // Nessuna sezione senza data: la data è ciò che distingue i numeri doppi.
    expect(voci.filter((v) => !v.data)).toEqual([]);
  });

  it("i numeri doppi restano doppi: non si rinumera", () => {
    // Decisione di Alessio del 27/08: rinumerare romperebbe ogni citazione
    // già scritta nei riepiloghi, che sono committati.
    const voci = rovesciamenti(testo);
    const numeri = voci.map((v) => v.numero);
    const doppi = [...new Set(numeri)].filter((n) => numeri.filter((x) => x === n).length > 1);
    expect(doppi.length).toBeGreaterThan(0);
    // E l'indice li dichiara invece di nasconderli.
    expect(testo).toMatch(/Numeri usati più di una volta/);
  });

  it("si ferma se non trova il suo punto di riferimento, invece di proseguire", () => {
    // ⚠️ È la lezione del 19/08: un comando che non trova il punto che cerca e
    // va avanti lo stesso ha tagliato tre sezioni di CODA_E_DECISIONI.md.
    expect(() => generaIndice("# un file qualunque\n\nsenza segni.\n")).toThrow(/non so dove/i);
  });
});
