import { describe, it, expect } from "vitest";
import { selezioneDopoIlTocco } from "../../src/lib/calcoli/selezione.js";

// ⚠️ La sala di prova è quella vera: T5·T6 accostati, T7·T8·T9 accostati,
// T1 e T2 soli. Serve che i casi si DISTINGUANO fra loro — con due soli
// tavoli, «somma» e «cambia» darebbero risposte confondibili.
const T1 = ["T1"];
const T2 = ["T2"];
const TAVOLONE = ["T7", "T8", "T9"];

describe("si seleziona un tavolo o un tavolone, mai due tavoli lontani", () => {
  it("da niente, un tavolo singolo seleziona se stesso", () => {
    expect(selezioneDopoIlTocco([], T1)).toEqual(["T1"]);
  });

  it("🔴 toccare un ALTRO tavolo cambia la selezione, NON la somma", () => {
    // Era questo il difetto: prima veniva ["T1","T2"], e su due tavoli
    // lontani si apriva una comanda sola.
    expect(selezioneDopoIlTocco(["T1"], T2)).toEqual(["T2"]);
    expect(selezioneDopoIlTocco(["T1"], T2)).not.toContain("T1");
  });

  it("un tavolo accostato porta con sé tutto il tavolone", () => {
    expect(selezioneDopoIlTocco([], TAVOLONE)).toEqual(["T7", "T8", "T9"]);
  });

  it("ritoccare lo stesso tavolo annulla", () => {
    expect(selezioneDopoIlTocco(["T1"], T1)).toEqual([]);
  });

  it("...e toccare un ALTRO tavolo dello stesso tavolone annulla anche lui", () => {
    // ⚠️ Perché è lo stesso insieme: T7 e T9 non sono due scelte diverse.
    expect(selezioneDopoIlTocco(["T7", "T8", "T9"], TAVOLONE)).toEqual([]);
  });

  it("dal tavolone si passa a un singolo senza portarsi dietro niente", () => {
    expect(selezioneDopoIlTocco(["T7", "T8", "T9"], T1)).toEqual(["T1"]);
  });

  it("da un singolo si passa al tavolone intero", () => {
    expect(selezioneDopoIlTocco(["T1"], TAVOLONE)).toEqual(["T7", "T8", "T9"]);
  });

  it("un insieme vuoto non tocca la selezione: non si sa cosa è stato toccato", () => {
    expect(selezioneDopoIlTocco(["T1"], [])).toEqual(["T1"]);
  });
});
