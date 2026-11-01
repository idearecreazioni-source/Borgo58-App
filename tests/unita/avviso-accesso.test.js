import { describe, expect, it } from "vitest";
import { avvisoAccesso } from "../../src/lib/calcoli/avvisoAccesso";

// Il riquadro sull'accesso: senza rete non e' un guasto (01/11/2026).
describe("il riquadro sull'accesso", () => {
  it("ruolo letto: nessun riquadro, con o senza rete", () => {
    expect(avvisoAccesso({ ruoloNonLetto: false, inRete: true })).toBe(null);
    expect(avvisoAccesso({ ruoloNonLetto: false, inRete: false })).toBe(null);
  });

  it("senza rete: lo dice com'e', senza Riprova", () => {
    const a = avvisoAccesso({ ruoloNonLetto: "Failed to fetch", inRete: false });
    expect(a.tipo).toBe("senza_rete");
    expect(a.riprova).toBe(false);
    expect(a.testo).toMatch(/senza rete/);
  });

  it("🔴 con la rete la lettura fallita resta un avviso, con Riprova", () => {
    const a = avvisoAccesso({ ruoloNonLetto: true, inRete: true });
    expect(a.tipo).toBe("non_letto");
    expect(a.riprova).toBe(true);
  });

  it("rete sconosciuta (fuori dal browser): si comporta come con la rete", () => {
    expect(avvisoAccesso({ ruoloNonLetto: true, inRete: undefined }).tipo).toBe("non_letto");
  });
});
