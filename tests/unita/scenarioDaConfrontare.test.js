import { describe, expect, it } from "vitest";
import { annoDiverso, scegliScenario } from "../../src/lib/calcoli/scenarioDaConfrontare";

// ⚠️ I dati di ogni prova sono scelti perché la risposta giusta e quelle
// sbagliate NON coincidano: c'è sempre una previsione di un altro anno
// che una regola sbagliata sceglierebbe.
const SCENARI = [
  { id: "b", anno: 2027, congelato_il: null },
  { id: "a", anno: 2026, congelato_il: null },
  { id: "c", anno: 2026, congelato_il: "2026-03-01T10:00:00Z" },
  { id: "d", anno: 2025, congelato_il: "2025-02-01T10:00:00Z" },
];

describe("con quale previsione ci si confronta", () => {
  it("si prende quella dell'anno che si sta guardando, non la più recente", () => {
    expect(scegliScenario(SCENARI, 2026)).toBe("c");
  });

  it("fra quelle dell'anno giusto vince la chiusa", () => {
    const solo2026 = SCENARI.filter((s) => s.anno === 2026);
    expect(scegliScenario(solo2026, 2026)).toBe("c");
  });

  it("se dell'anno giusto ce n'è solo una aperta, si usa quella", () => {
    expect(scegliScenario(SCENARI, 2027)).toBe("b");
  });

  // 🔴 IL CASO CHE HA PRODOTTO IL DIFETTO: nessuna previsione per l'anno
  // guardato. Ripiegare sulla più recente di un altro anno dava un
  // risultato di 25,9 milioni senza che niente lo dicesse.
  it("senza previsioni di quell'anno non si ripiega su un altro anno", () => {
    expect(scegliScenario(SCENARI, 2028)).toBeNull();
  });

  // ⚠️ PROPRIETA', non quantità: un gestionale sano ma senza previsioni
  // deve restare verde qui, non rosso.
  it("nessuna previsione, nessuna scelta", () => {
    expect(scegliScenario([], 2026)).toBeNull();
    expect(scegliScenario(null, 2026)).toBeNull();
  });

  it("l'anno arriva come testo e la risposta non cambia", () => {
    expect(scegliScenario([{ id: "x", anno: "2026", congelato_il: null }], 2026)).toBe("x");
  });
});

describe("l'avviso di anno diverso", () => {
  it("tace quando gli anni coincidono", () => {
    expect(annoDiverso(SCENARI, "c", 2026)).toBeNull();
  });

  it("dice quale anno, quando è un altro", () => {
    expect(annoDiverso(SCENARI, "b", 2026)).toBe(2027);
  });

  it("senza previsione scelta non c'è niente da dire", () => {
    expect(annoDiverso(SCENARI, "", 2026)).toBeNull();
    expect(annoDiverso(SCENARI, "sconosciuta", 2026)).toBeNull();
  });
});
