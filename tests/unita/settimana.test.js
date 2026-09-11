import { describe, expect, it } from "vitest";
import {
  etichettaSettimana,
  giorniDellaSettimana,
  impegniDellaSettimana,
  lunediDi,
  nomeDelGiorno,
  oraBreve,
  spostaGiorni,
  spostaSettimana,
} from "../../src/lib/calcoli/settimana";

// =====================================================================
// LA SETTIMANA DELL'AGENDA — 11/09/2026
// =====================================================================
// 🔴 COSA TENGONO FERMO: una settimana va da lunedì a domenica, sono sempre
//    sette giorni anche col cambio dell'ora, e dentro un giorno gli impegni
//    si leggono in ordine di ora — quelli senza ora in cima.

describe("quale settimana", () => {
  it("ogni giorno dal 7 al 13 settembre 2026 sta nella settimana di lunedì 7", () => {
    for (let g = 7; g <= 13; g++) {
      const iso = `2026-09-${String(g).padStart(2, "0")}`;
      expect(lunediDi(iso), iso).toBe("2026-09-07");
    }
  });

  it("⚠️ la domenica è l'ULTIMO giorno, non il primo", () => {
    expect(lunediDi("2026-09-13")).toBe("2026-09-07");
    expect(lunediDi("2026-09-14")).toBe("2026-09-14");
  });

  it("i sette giorni, in fila, da lunedì a domenica", () => {
    expect(giorniDellaSettimana("2026-09-07")).toEqual([
      "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13",
    ]);
  });

  it("🔴 col cambio dell'ora (25 ottobre 2026) sono ancora sette giorni diversi", () => {
    const g = giorniDellaSettimana(lunediDi("2026-10-25"));
    expect(g[0]).toBe("2026-10-19");
    expect(g[6]).toBe("2026-10-25");
    expect(new Set(g).size).toBe(7);
    // …e anche la settimana del cambio di marzo (29 marzo 2026).
    expect(giorniDellaSettimana(lunediDi("2026-03-29"))).toContain("2026-03-29");
  });

  it("una settimana prima e una dopo, anche a cavallo di mese e d'anno", () => {
    expect(spostaSettimana("2026-09-07", 1)).toBe("2026-09-14");
    expect(spostaSettimana("2026-09-07", -1)).toBe("2026-08-31");
    expect(spostaSettimana("2026-12-28", 1)).toBe("2027-01-04");
    expect(spostaGiorni("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("come si chiama", () => {
  it("il titolo dice mese e anno una volta, se non cambiano", () => {
    expect(etichettaSettimana("2026-09-07")).toBe("7 – 13 settembre 2026");
  });

  it("⚠️ a cavallo di due mesi li dice tutti e due", () => {
    expect(etichettaSettimana("2026-09-28")).toBe("28 settembre – 4 ottobre 2026");
  });

  it("⚠️ a cavallo di due anni dice anche tutti e due gli anni", () => {
    expect(etichettaSettimana("2026-12-28")).toBe("28 dicembre 2026 – 3 gennaio 2027");
  });

  it("il nome di un giorno", () => {
    expect(nomeDelGiorno("2026-09-07")).toEqual({ nome: "Lunedì", corto: "Lun", numero: 7, mese: "settembre" });
    expect(nomeDelGiorno("2026-09-13").nome).toBe("Domenica");
  });
});

describe("l'ora", () => {
  it("si legge senza i secondi", () => {
    expect(oraBreve({ due_time: "18:30:00" })).toBe("18:30");
    expect(oraBreve({ due_time: "09:05" })).toBe("09:05");
  });

  it("senza ora, o con qualcosa che non è un'ora, nessuna ora", () => {
    for (const v of [null, undefined, "", "sera", 930]) expect(oraBreve({ due_time: v }), String(v)).toBeNull();
    expect(oraBreve(null)).toBeNull();
  });
});

describe("gli impegni nei sette giorni", () => {
  const giorni = giorniDellaSettimana("2026-09-07");
  const t = (id, due_date, due_time = null, title = id) => ({ id, due_date, due_time, title });

  it("🔴 dentro un giorno: senza ora in cima, poi per ora", () => {
    const [lun] = impegniDellaSettimana(
      [t("sera", "2026-09-07", "18:30:00"), t("mattina", "2026-09-07", "09:00:00"), t("giornata", "2026-09-07")],
      giorni,
    );
    expect(lun.impegni.map((x) => x.id)).toEqual(["giornata", "mattina", "sera"]);
  });

  it("a pari ora, per titolo", () => {
    const [lun] = impegniDellaSettimana(
      [t("b", "2026-09-07", "10:00:00", "Zucchine"), t("a", "2026-09-07", "10:00:00", "Aglio")],
      giorni,
    );
    expect(lun.impegni.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("i giorni vuoti ci sono lo stesso, e fuori settimana non entra niente", () => {
    const s = impegniDellaSettimana([t("x", "2026-09-09"), t("fuori", "2026-09-14"), t("senza", null)], giorni);
    expect(s).toHaveLength(7);
    expect(s.map((g) => g.impegni.length)).toEqual([0, 0, 1, 0, 0, 0, 0]);
  });

  it("non tocca l'elenco che riceve", () => {
    const righe = [t("b", "2026-09-07", "18:00:00"), t("a", "2026-09-07", "09:00:00")];
    impegniDellaSettimana(righe, giorni);
    expect(righe.map((x) => x.id)).toEqual(["b", "a"]);
  });
});
