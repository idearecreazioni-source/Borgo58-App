import { describe, it, expect } from "vitest";
import {
  HA_RISPOSTO,
  NESSUNA_RISPOSTA,
  NON_PARTITA,
  fraseDelGuasto,
  genereDelGuasto,
} from "../../src/lib/calcoli/erroriDiRete.js";

// 🔴 Difetto trovato da Alessio col telefono in modalità aereo, 21/08: al
// posto di una riga in italiano compariva «Failed to send a request to the
// Edge Function». Riprodotto sulla schermata viva prima di correggere.

describe("quando la richiesta non parte proprio", () => {
  const staccata = new TypeError("Failed to send a request to the Edge Function");
  const conRisposta = Object.assign(new Error("Edge Function returned a non-2xx status"), {
    context: { status: 409 },
  });

  it("🔴 riconosce il caso della rete staccata", () => {
    expect(genereDelGuasto(staccata)).toBe(NON_PARTITA);
  });

  it("...e lo distingue da un server che ha risposto", () => {
    expect(genereDelGuasto(conRisposta)).toBe(HA_RISPOSTO);
  });

  it("un guasto che non è nessuno dei due resta il terzo caso", () => {
    expect(genereDelGuasto(new Error("qualcosa d'altro"))).toBe(NESSUNA_RISPOSTA);
  });

  it("🔴 col telefono staccato la frase è IN ITALIANO e dice cosa non è riuscito", () => {
    const f = fraseDelGuasto(staccata, "aprire il conto");
    expect(f).toContain("aprire il conto");
    expect(f).toContain("connessione");
    // Il difetto era esattamente questo: la lingua della libreria a schermo.
    expect(f).not.toContain("Failed");
    expect(f).not.toContain("Edge Function");
  });

  it("🔴 e DICE QUALE GESTO: due gesti diversi non danno la stessa frase", () => {
    // «Failed to send a request» non distingueva un conto che non si apre da
    // un documento che non si legge.
    expect(fraseDelGuasto(staccata, "aprire il conto")).not.toBe(
      fraseDelGuasto(staccata, "leggere il documento")
    );
  });

  it("la frase scritta da noi vince su tutto: è pensata per chi sta in sala", () => {
    const nostra = "Questo conto è già stato chiuso";
    expect(fraseDelGuasto(conRisposta, "chiudere il conto", nostra)).toBe(nostra);
    // ⚠️ Anche quando la rete è staccata: se per qualche via una frase nostra
    // è arrivata, quella sa più di noi.
    expect(fraseDelGuasto(staccata, "aprire il conto", nostra)).toBe(nostra);
  });

  it("se ha risposto senza una frase nostra, l'originale non si butta via", () => {
    const f = fraseDelGuasto(conRisposta, "pagare la fattura");
    expect(f).toContain("pagare la fattura");
    expect(f).toContain("non-2xx");
  });
});

// 🔴 IL DISCRIMINANTE SBAGLIATO, e la prova che lo tiene chiuso.
// La prima stesura guardava `context`, dando per scontato che ci fosse solo
// quando il server risponde. La libreria lo allega ANCHE al fallimento della
// rete: col telefono staccato la frase diceva «Non sono riuscito ad aprire il
// conto» e ci appiccicava l'inglese fra parentesi. Trovato guardando la
// schermata viva, non rileggendo il codice.
describe("l'errore della libreria quando la rete è staccata", () => {
  const comeArrivaDavvero = Object.assign(
    new Error("Failed to send a request to the Edge Function"),
    { name: "FunctionsFetchError", context: new TypeError("Failed to fetch") }
  );

  it("🔴 ha un context E NON È il caso «ha risposto»", () => {
    expect(comeArrivaDavvero.context).toBeTruthy();
    expect(genereDelGuasto(comeArrivaDavvero)).toBe(NON_PARTITA);
  });

  it("🔴 e la frase NON contiene più l'inglese", () => {
    const f = fraseDelGuasto(comeArrivaDavvero, "aprire il conto");
    expect(f).not.toContain("Failed");
    expect(f).not.toContain("Edge Function");
    expect(f).toContain("connessione");
  });

  it("«ad aprire», non «a aprire»: davanti a vocale ci vuole la d", () => {
    expect(fraseDelGuasto(comeArrivaDavvero, "aprire il conto")).toContain("ad aprire");
    expect(fraseDelGuasto(comeArrivaDavvero, "chiudere il conto")).toContain("a chiudere");
  });
});
