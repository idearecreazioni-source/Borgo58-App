import { describe, expect, it } from "vitest";
import { daComprare, nelCarrello } from "../../src/lib/calcoli/spesaSpicciola";

// =====================================================================
// COSA RESTA DA COMPRARE — la regola unica, provata al contrario
// =====================================================================
// 10/09/2026, dal collaudo col telefono. Il riquadro della schermata
// iniziale contava anche le cose già nel carrello, la pagina della spesa
// spicciola no. La regola adesso è una, e questa prova la tiene ferma.

const r = (id, nel_carrello) => ({ id, articolo: `cosa ${id}`, nel_carrello });

describe("cosa resta da comprare", () => {
  it("🔴 una cosa nel carrello NON è più da comprare", () => {
    const righe = [r("1", false), r("2", true), r("3", false)];
    expect(daComprare(righe).map((x) => x.id)).toEqual(["1", "3"]);
    expect(nelCarrello(righe).map((x) => x.id)).toEqual(["2"]);
  });

  it("⚠️ le due metà insieme fanno sempre il totale: nessuna riga si perde", () => {
    const righe = [r("1", false), r("2", true), r("3", true), r("4", false)];
    expect(daComprare(righe).length + nelCarrello(righe).length).toBe(righe.length);
  });

  it("col carrello tutto pieno non resta niente da comprare", () => {
    expect(daComprare([r("1", true), r("2", true)])).toEqual([]);
  });

  it("una lettura che non è arrivata non rompe il conto", () => {
    // ⚠️ `null` è «non ancora letto», e qui vale zero: il riquadro che lo
    //    usa guarda prima se la lettura è fallita, e lo dice.
    expect(daComprare(null)).toEqual([]);
    expect(nelCarrello(undefined)).toEqual([]);
  });
});
