import { describe, expect, it } from "vitest";
import {
  FASCE,
  MINUTI_OFFERTI,
  convertiFascia,
  fasciaDi,
  minutiDaOfferire,
  oraComposta,
  oreDellaFascia,
  scorriCircolare,
} from "../../src/lib/calcoli/oraScelta";

// Le regole delle due ruote, provate senza disegnare niente.

describe("🔴 mattina e pomeriggio", () => {
  it("le due fasce coprono le ventiquattro ore, senza sovrapporsi", () => {
    expect(oreDellaFascia("mattina")).toHaveLength(12);
    expect(oreDellaFascia("pomeriggio")).toHaveLength(12);
    expect(oreDellaFascia("mattina")[0]).toBe("00");
    expect(oreDellaFascia("mattina").at(-1)).toBe("11");
    expect(oreDellaFascia("pomeriggio")[0]).toBe("12");
    expect(oreDellaFascia("pomeriggio").at(-1)).toBe("23");
    expect(FASCE.map((f) => f.id)).toEqual(["mattina", "pomeriggio"]);
  });

  it("la fascia si legge dall'orario, e un orario vuoto parte da mattina", () => {
    expect(fasciaDi("09:30")).toBe("mattina");
    expect(fasciaDi("00:00")).toBe("mattina");
    expect(fasciaDi("12:00")).toBe("pomeriggio");
    expect(fasciaDi("23:55")).toBe("pomeriggio");
    expect(fasciaDi("")).toBe("mattina");
  });

  it("🔴 cambiare fascia sposta di dodici ore e LASCIA STARE i minuti", () => {
    // Azzerare i minuti sarebbe riscrivere una scelta che qualcuno ha già
    // fatto, per un gesto che riguarda l'ora.
    expect(convertiFascia("09:30", "pomeriggio")).toBe("21:30");
    expect(convertiFascia("21:30", "mattina")).toBe("09:30");
    expect(convertiFascia("00:07", "pomeriggio")).toBe("12:07");
    expect(convertiFascia("23:55", "mattina")).toBe("11:55");
  });

  it("⚠️ e scegliere la fascia che c'è già non cambia niente", () => {
    expect(convertiFascia("09:30", "mattina")).toBe("09:30");
    // Un orario vuoto resta vuoto: la fascia da sola non è un'ora.
    expect(convertiFascia("", "pomeriggio")).toBe("");
  });
});

describe("🔴 i minuti offerti sono dodici, a scaglioni di cinque", () => {
  it("l'elenco è quello e non un altro", () => {
    expect(MINUTI_OFFERTI).toEqual([
      "00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55",
    ]);
    expect(minutiDaOfferire("30").map((m) => m.valore)).toEqual(MINUTI_OFFERTI);
  });

  it("🔴 un minuto storico fuori griglia resta, in coda e marcato", () => {
    const voci = minutiDaOfferire("07");
    expect(voci).toHaveLength(13);
    expect(voci.at(-1).valore).toBe("07");
    expect(voci.at(-1).etichetta).toMatch(/scritto prima/);
  });

  it("⚠️ e sparisce appena se ne sceglie un altro", () => {
    expect(minutiDaOfferire("35")).toHaveLength(12);
  });
});

describe("🔴 la ruota gira davvero", () => {
  const ore = oreDellaFascia("pomeriggio");

  it("dall'ultima si torna alla prima, e viceversa", () => {
    // Una ruota che si ferma ai bordi è un elenco: chi scorre oltre le 23 si
    // aspetta 12, non di restare fermo.
    expect(scorriCircolare(ore, "23", 1)).toBe("12");
    expect(scorriCircolare(ore, "12", -1)).toBe("23");
    expect(scorriCircolare(MINUTI_OFFERTI, "55", 1)).toBe("00");
    expect(scorriCircolare(MINUTI_OFFERTI, "00", -1)).toBe("55");
  });

  it("nel mezzo si muove di uno", () => {
    expect(scorriCircolare(ore, "15", 1)).toBe("16");
    expect(scorriCircolare(ore, "15", -1)).toBe("14");
  });

  it("⚠️ e da un valore che non è sulla ruota si riparte dalla prima voce", () => {
    // È il caso dell'orario storico: «non so dove sei» è una risposta, e
    // muoversi a caso non lo sarebbe.
    expect(scorriCircolare(MINUTI_OFFERTI, "07", 1)).toBe("00");
  });
});

describe("l'orario si ricompone sempre a ventiquattro ore", () => {
  it("due pezzi diventano «HH:MM»", () => {
    expect(oraComposta("21", "30")).toBe("21:30");
    expect(oraComposta("9", "5")).toBe("09:05");
    // Senza minuti si parte da :00, e senza ora non c'è niente.
    expect(oraComposta("21", "")).toBe("21:00");
    expect(oraComposta("", "30")).toBe("");
  });
});
