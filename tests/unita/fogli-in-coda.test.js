import { describe, expect, it } from "vitest";
import { lavoroDelFoglio } from "../../src/lib/calcoli/fogliInCoda";

// Un foglio della pagina Cucina e i suoi lavori nella coda (29/10/2026).

const foglio = (...ids) => ({ tipo: "comanda", items: ids.map((id) => ({ id })) });
const lavoro = (stato, righe, creato_il = "2026-10-29T20:00:00Z", errore = null) => ({
  tipo: "comanda",
  stato,
  righe,
  creato_il,
  errore,
});

describe("come sta un foglio nella coda", () => {
  it("nessun lavoro: non è in coda", () => {
    expect(lavoroDelFoglio(foglio("a"), []).stato).toBe("fuori");
  });

  it("un lavoro in coda per tutte le righe: in coda", () => {
    expect(lavoroDelFoglio(foglio("a", "b"), [lavoro("in_coda", ["a", "b"])]).stato).toBe("in_coda");
  });

  it("🔴 due invii, uno fallito: il foglio non è uscito, anche se l'altro aspetta", () => {
    const c = lavoroDelFoglio(foglio("a", "b"), [lavoro("in_coda", ["a"]), lavoro("fallito", ["b"], undefined, "carta finita")]);
    expect(c).toEqual({ stato: "fallito", errore: "carta finita" });
  });

  it("una riga che nessun lavoro porta: il foglio è da mandare", () => {
    expect(lavoroDelFoglio(foglio("a", "b"), [lavoro("in_coda", ["a"])]).stato).toBe("fuori");
  });

  it("🔴 una riga scoperta non nasconde un incerto: prima si guarda la carta", () => {
    expect(lavoroDelFoglio(foglio("a", "b"), [lavoro("incerto", ["a"])]).stato).toBe("incerto");
  });

  it("fallito e poi rimandato: conta il più recente", () => {
    const c = lavoroDelFoglio(foglio("a"), [
      lavoro("fallito", ["a"], "2026-10-29T20:00:00Z"),
      lavoro("in_coda", ["a"], "2026-10-29T20:01:00Z"),
    ]);
    expect(c.stato).toBe("in_coda");
  });

  it("gli annullati non contano", () => {
    expect(lavoroDelFoglio(foglio("a"), [lavoro("annullato", ["a"])]).stato).toBe("fuori");
  });

  it("il biglietto del turno si riconosce dal suo id", () => {
    const g = { tipo: "chiamata", id: "c1", items: [] };
    const l = [{ tipo: "chiamata", chiamata_id: "c1", stato: "incerto", creato_il: "2026-10-29T20:00:00Z" }];
    expect(lavoroDelFoglio(g, l).stato).toBe("incerto");
    expect(lavoroDelFoglio({ ...g, id: "c2" }, l).stato).toBe("fuori");
  });
});
