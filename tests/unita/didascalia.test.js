import { describe, expect, it } from "vitest";
import { dopoIlGesto } from "../../src/lib/calcoli/didascalia.js";

const MOUSE = { puntatore: "mouse", daTastiera: false };
const DITO = { puntatore: "touch", daTastiera: false };
const TASTIERA = { puntatore: undefined, daTastiera: true };

// ⚠️ QUESTE PROVE ESISTONO PER DUE DIFETTI VERI, non per completezza: in
// due giorni il segno si è rotto due volte, e tutt'e due le volte a
// trovarlo è stato un gesto vero — non una rilettura, non una prova con
// eventi finti. Qui non si può provare il componente (niente DOM), ma la
// regola sì: se qualcuno la cambia per curare un caso, gli altri due
// diventano rossi.

describe("col mouse", () => {
  it("il passaggio apre e l'uscita chiude", () => {
    expect(dopoIlGesto("entra", MOUSE, false)).toBe(true);
    expect(dopoIlGesto("esce", MOUSE, true)).toBe(false);
  });

  it("🔴 IL CLIC NON RICHIUDE QUELLO CHE IL PASSAGGIO HA APERTO", () => {
    // È il difetto del 24/08: con un mouse il clic arriva SEMPRE dopo il
    // passaggio, quindi un toggle chiude sempre — e chi clicca lo fa
    // proprio perché la vuole aperta. Misurato con un clic vero.
    expect(dopoIlGesto("clic", MOUSE, true)).toBe(true);
  });

  it("e non apre nemmeno se per qualche ragione era chiusa", () => {
    // Col mouse l'apertura è compito del passaggio: se il clic aprisse,
    // tornerebbe a essere un toggle sotto mentite spoglie.
    expect(dopoIlGesto("clic", MOUSE, false)).toBe(false);
  });
});

describe("col dito", () => {
  it("il tocco fa da interruttore, perché non esiste «uscire»", () => {
    expect(dopoIlGesto("clic", DITO, false)).toBe(true);
    expect(dopoIlGesto("clic", DITO, true)).toBe(false);
  });

  it("🔴 e il passaggio NON deve fare niente", () => {
    // Sui browser dei tablet il tocco emette anche gli eventi del mouse:
    // se il passaggio aprisse, il tocco successivo richiuderebbe e la
    // didascalia lampeggerebbe. È il difetto del 23/08.
    expect(dopoIlGesto("entra", DITO, false)).toBe(false);
    expect(dopoIlGesto("esce", DITO, true)).toBe(true);
  });
});

describe("con la tastiera", () => {
  it("arrivandoci col Tab si apre da sola", () => {
    expect(dopoIlGesto("fuoco", TASTIERA, false)).toBe(true);
  });

  it("🔴 ma il fuoco che arriva da un clic NON apre", () => {
    // Premendo, il pulsante prende il fuoco PRIMA del clic: senza questa
    // distinzione l'apertura e il clic si pestano. `:focus-visible` è la
    // distinzione che il browser fa già.
    expect(dopoIlGesto("fuoco", MOUSE, false)).toBe(false);
    expect(dopoIlGesto("fuoco", DITO, false)).toBe(false);
  });

  it("andando via o con Escape si chiude", () => {
    expect(dopoIlGesto("fuocoVia", TASTIERA, true)).toBe(false);
    expect(dopoIlGesto("esc", TASTIERA, true)).toBe(false);
  });
});

describe("le tre sequenze intere, come capitano davvero", () => {
  const gira = (passi) => passi.reduce((stato, [g, c]) => dopoIlGesto(g, c, stato), false);

  it("mouse: entra, clicca, esce", () => {
    // ⚠️ È la sequenza che il 24/08 finiva chiusa: il clic annullava
    // l'apertura del passaggio.
    expect(gira([["entra", MOUSE]])).toBe(true);
    expect(gira([["entra", MOUSE], ["clic", MOUSE]])).toBe(true);
    expect(gira([["entra", MOUSE], ["clic", MOUSE], ["esce", MOUSE]])).toBe(false);
  });

  it("dito: tocca, ritocca", () => {
    expect(gira([["fuoco", DITO], ["clic", DITO]])).toBe(true);
    expect(gira([["fuoco", DITO], ["clic", DITO], ["clic", DITO]])).toBe(false);
  });

  it("tastiera: Tab, Escape, Tab via", () => {
    expect(gira([["fuoco", TASTIERA]])).toBe(true);
    expect(gira([["fuoco", TASTIERA], ["esc", TASTIERA]])).toBe(false);
    expect(gira([["fuoco", TASTIERA], ["fuocoVia", TASTIERA]])).toBe(false);
  });
});
