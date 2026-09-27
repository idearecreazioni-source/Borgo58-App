// La regola sugli accenti del testo a schermo — 27/09/2026, primo batch
// visivo. La prova visiva la applica al testo delle pagine disegnate; qui
// si prova la regola da sola, nei due versi: prende le forme sbagliate e
// lascia stare gli apostrofi giusti.
import { describe, expect, it } from "vitest";
import { accentoConApostrofo } from "../../scripts/testi-a-schermo.mjs";
import { ragioneNonIdoneo } from "../../src/lib/calcoli/investimento.js";

describe("un accento scritto con l'apostrofo", () => {
  it.each([
    ["Un'entrata non e' un investimento", "e'"],
    ["la scrive il gestionale da se' — un versamento", "se'"],
    ["La connessione c'e' — l'ho controllata", "c'e'"],
    ["Rifalla piu' da vicino", "piu'"],
    ["E' denaro che cambia posto", "E'"],
    ["non cambia la deducibilita', l'IVA ne' altro", "deducibilita'"],
    ["(non si usa piu')", "piu'"],
  ])("«%s» → %s", (testo, forma) => {
    expect(accentoConApostrofo(testo)).toBe(forma);
  });

  it.each([
    "Un'entrata non è un investimento",
    "un po' di sale",
    "dell'abbattitore, l'IVA, un'altra, all'una",
    "C'è posto per sei",
    "Quest'anno e l'anno scorso",
    "",
  ])("lascia stare «%s»", (testo) => {
    expect(accentoConApostrofo(testo)).toBeNull();
  });
});

describe("le frasi della Prima nota sugli investimenti", () => {
  // Compaiono sotto ogni movimento che non si può marcare: sono testo a
  // schermo, e prima dicevano «non e' un investimento».
  it.each([
    ["un'entrata", { direction: "entrata", causale: { di_sistema: false } }],
    ["una riga del gestionale", { direction: "uscita", causale: { di_sistema: true } }],
  ])("%s", (_, riga) => {
    const frase = ragioneNonIdoneo(riga);
    expect(frase).toBeTruthy();
    expect(accentoConApostrofo(frase)).toBeNull();
  });
});
