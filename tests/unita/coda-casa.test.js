import { describe, expect, it } from "vitest";
import {
  STATI,
  arrivateDaTogliere,
  attesaDopo,
  daInviare,
  dopoCasaIrraggiungibile,
  dopoLArrivo,
  dopoUnErrore,
  eDellaRete,
  percorsoFoto,
  riassunto,
  voceNuova,
} from "../../src/lib/calcoli/codaCasa";

// La coda di Casa: una foto scattata senza rete non si perde, e non arriva
// mai due volte.

const foto = { fittizia: true };

describe("una voce nasce intera", () => {
  it("con la sua chiave e la sua foto, in coda", () => {
    const v = voceNuova({ chiave: "k1", foto, adesso: 1000 });
    expect(v).toMatchObject({ chiave: "k1", stato: STATI.IN_CODA, tentativi: 0, creata: 1000 });
  });

  it("senza chiave o senza foto non nasce", () => {
    expect(() => voceNuova({ foto })).toThrow();
    expect(() => voceNuova({ chiave: "k" })).toThrow();
  });

  it("il nome del file dipende solo dalla chiave", () => {
    expect(percorsoFoto("abc")).toBe("da-collocare/abc.jpg");
  });
});

describe("cosa si manda adesso", () => {
  const a = voceNuova({ chiave: "a", foto, adesso: 2000 });
  const b = voceNuova({ chiave: "b", foto, adesso: 1000 });

  it("le voci in coda, dalla piu' vecchia", () => {
    expect(daInviare([a, b], { adesso: 5000 }).map((v) => v.chiave)).toEqual(["b", "a"]);
  });

  it("dopo un errore si aspetta, sempre di piu', ma si riprova sempre", () => {
    const sbagliata = dopoUnErrore(a, "rete", 10_000);
    expect(sbagliata.stato).toBe(STATI.IN_CODA);
    expect(sbagliata.errore).toBe("rete");
    expect(daInviare([sbagliata], { adesso: 10_000 + 29_000 })).toEqual([]);
    expect(daInviare([sbagliata], { adesso: 10_000 + 30_000 })).toHaveLength(1);
    expect(attesaDopo(1)).toBeLessThan(attesaDopo(3));
    expect(attesaDopo(50)).toBe(15 * 60_000);
  });

  it("«Invia adesso» non aspetta", () => {
    const sbagliata = dopoUnErrore(a, "rete", 10_000);
    expect(daInviare([sbagliata], { adesso: 10_001, forza: true })).toHaveLength(1);
  });

  it("le arrivate non si rimandano mai", () => {
    expect(daInviare([dopoLArrivo(a, "id-spesa")], { adesso: 9e12, forza: true })).toEqual([]);
  });
});

describe("arrivata vuol dire arrivata", () => {
  it("la foto lascia il telefono, la spesa resta nominata", () => {
    const v = dopoLArrivo(voceNuova({ chiave: "a", foto }), "id-spesa", 5000);
    expect(v).toMatchObject({ stato: STATI.ARRIVATA, foto: null, spesaId: "id-spesa", arrivata: 5000, errore: null });
  });

  it("le arrivate si tolgono dopo due giorni, le altre mai", () => {
    const arrivata = dopoLArrivo(voceNuova({ chiave: "a", foto }), "s", 0);
    const inCoda = voceNuova({ chiave: "b", foto, adesso: 0 });
    expect(arrivateDaTogliere([arrivata, inCoda], 1000)).toEqual([]);
    expect(arrivateDaTogliere([arrivata, inCoda], 3 * 24 * 3600_000)).toEqual(["a"]);
  });
});

describe("la spia", () => {
  it("conta quelle in coda e quelle con un errore", () => {
    const v = [
      voceNuova({ chiave: "a", foto }),
      dopoUnErrore(voceNuova({ chiave: "b", foto }), "rete"),
      dopoLArrivo(voceNuova({ chiave: "c", foto }), "s"),
    ];
    expect(riassunto(v)).toEqual({ inCoda: 2, conErrore: 1, arrivate: 1 });
  });
});

describe("Casa che non si raggiunge non e' un errore della foto", () => {
  it("non allunga l'attesa: rientrati a casa la foto parte subito", () => {
    const v = dopoCasaIrraggiungibile(voceNuova({ chiave: "a", foto, adesso: 0 }));
    expect(v.tentativi).toBe(0);
    expect(v.errore).toMatch(/non si raggiunge/);
    expect(daInviare([v], { adesso: 1 })).toHaveLength(1);
  });

  it("riconosce la rete che manca su Safari e su Chrome, non le parole a caso", () => {
    expect(eDellaRete(new TypeError("Load failed"))).toBe(true);
    expect(eDellaRete({ message: "Failed to fetch" })).toBe(true);
    expect(eDellaRete({ message: "The Internet connection appears to be offline." })).toBe(true);
    expect(eDellaRete({ rete: true, message: "tempo scaduto" })).toBe(true);
    expect(eDellaRete({ message: "new row violates row-level security policy" })).toBe(false);
    expect(eDellaRete({ message: "importo discreto" })).toBe(false);
  });
});
