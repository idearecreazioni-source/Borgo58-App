import { describe, expect, it } from "vitest";
import {
  IMPORTO_NON_CHIARO,
  appuntoDaLettura,
  campiIniziali,
  campiPer,
  cosaMancaPer,
  giaCaricata,
  importoDaInviare,
} from "../../src/lib/calcoli/daCollocare";

describe("cosa manca per collocare", () => {
  it("le mancanze si dicono tutte insieme", () => {
    expect(cosaMancaPer("archivio", { importo: "", data: "" })).toEqual(["la sezione dell'Archivio", "la data"]);
  });
  it("ignorare non chiede niente", () => {
    expect(cosaMancaPer("ignora", {})).toEqual([]);
  });
  it("prima nota: l'importo, e il conto se è banca", () => {
    expect(cosaMancaPer("prima_nota", { importo: "" })).toEqual(["l'importo"]);
    expect(cosaMancaPer("prima_nota", { importo: "0" })).toEqual(["un importo valido"]);
    expect(cosaMancaPer("prima_nota", { importo: "5", mezzo: "banca" })).toEqual(["il conto della banca"]);
  });
  it("anticipo: il motivo", () => {
    expect(cosaMancaPer("anticipo", { importo: "5" })).toEqual(["il motivo dell'anticipo"]);
  });
});

describe("i campi che partono", () => {
  it("solo quelli della destinazione, la virgola diventa punto", () => {
    expect(campiPer("tasca", { importo: "12,5", causale_id: "c", tag_id: "t" })).toEqual({
      importo: "12.5", data: null, descrizione: null, controparte: null,
    });
    expect(campiPer("prima_nota", { importo: "1", mezzo: "cassa", conto_id: "k" }).conto_id).toBeNull();
  });
});

describe("dalla foto all'appunto", () => {
  it("un importo illeggibile resta vuoto, i dubbi si sommano", () => {
    const a = appuntoDaLettura({
      sicuro: false,
      cosa_vedo: "uno scontrino",
      acquisto: { importo: "boh", data: "10/10/2026", esercente: "Rossi", cosa: "penne", documento: "scontrino", dubbi: "totale sbiadito" },
    });
    expect(a.importo).toBeNull();
    expect(a.data).toBeNull();
    expect(a.controparte).toBe("Rossi");
    expect(a.incertezza).toBe("MEMO non era sicuro di cosa stesse guardando; totale sbiadito");
  });
  it("un documento fuori elenco non passa", () => {
    expect(appuntoDaLettura({ acquisto: { documento: "ricevuta" } }).documento).toBeNull();
  });
});

// 🔴 Dalla validazione della #178: «Riprova» dopo una rete che cade non deve
//    fermarsi sul file già caricato dal giro di prima, e non deve passare
//    sopra a un rifiuto vero del deposito.
describe("la foto già caricata dal giro di prima", () => {
  it("«esiste già» si riconosce, dal codice o dalle parole", () => {
    expect(giaCaricata({ statusCode: "409", message: "x" })).toBe(true);
    expect(giaCaricata({ status: 409 })).toBe(true);
    expect(giaCaricata({ message: "The resource already exists" })).toBe(true);
  });
  it("un rifiuto vero non passa per «già caricata»", () => {
    expect(giaCaricata({ statusCode: "403", message: "new row violates row-level security policy" })).toBe(false);
    expect(giaCaricata({ message: "Payload too large" })).toBe(false);
    expect(giaCaricata(null)).toBe(false);
  });
});

// 🔴 «1.200» DIVENTAVA 1,20 € (revisione dell'11/11, punto 2): il punto
//    delle migliaia si leggeva come quello dei decimali.
describe("l'importo scritto all'italiana", () => {
  it("«1.200» è milleduecento, non 1,20", () => {
    expect(campiPer("tasca", { importo: "1.200" }).importo).toBe("1200");
    expect(campiPer("tasca", { importo: "1.234" }).importo).toBe("1234");
    expect(cosaMancaPer("tasca", { importo: "1.200" })).toEqual([]);
  });
  it("si capiscono anche «1.200,50», «1200,5», «12.5» e «€ 30»", () => {
    expect(importoDaInviare("1.200,50")).toBe("1200.5");
    expect(importoDaInviare("1200,5")).toBe("1200.5");
    expect(importoDaInviare("12.5")).toBe("12.5");
    expect(importoDaInviare("€ 30")).toBe("30");
    expect(importoDaInviare("1.234.567,8")).toBe("1234567.8");
  });
  it("vuoto resta vuoto", () => {
    expect(importoDaInviare("")).toBeNull();
    expect(importoDaInviare("  ")).toBeNull();
    expect(importoDaInviare(null)).toBeNull();
    expect(campiPer("tasca", { importo: "" }).importo).toBeNull();
  });
  it("quello che non si capisce non si indovina: si ferma e lo dice", () => {
    for (const ambiguo of ["1.2345", "1,234,5", "12,345", "1.20.0", "boh", "-5", "1e3"]) {
      expect(importoDaInviare(ambiguo)).toBeUndefined();
      expect(cosaMancaPer("prima_nota", { importo: ambiguo })).toEqual([IMPORTO_NON_CHIARO]);
      // Se per sbaglio partisse lo stesso, parte vuoto: mai una cifra inventata.
      expect(campiPer("prima_nota", { importo: ambiguo }).importo).toBeNull();
    }
  });
  it("nell'archivio l'importo si può lasciare vuoto, ma se c'è deve capirsi", () => {
    expect(cosaMancaPer("archivio", { importo: "1.2345", sezione: "s", data: "2026-11-01" })).toEqual([
      `${IMPORTO_NON_CHIARO}, oppure lascialo vuoto`,
    ]);
    expect(cosaMancaPer("archivio", { importo: "1.200", sezione: "s", data: "2026-11-01" })).toEqual([]);
  });
  it("l'importo che MEMO aveva capito torna nel campo e si rilegge uguale", () => {
    const campi = campiIniziali({ importo: 1200.5 });
    expect(campi.importo).toBe("1200,50");
    expect(campiIniziali({ importo: 1200 }).importo).toBe("1200");
    expect(campiIniziali({ importo: null }).importo).toBe("");
    expect(importoDaInviare(campi.importo)).toBe("1200.5");
  });
});

describe("l'importo che arriva già come numero", () => {
  it("un numero si legge com'è, senza passare per il testo", () => {
    expect(importoDaInviare(1200.5)).toBe("1200.5");
    expect(importoDaInviare(30)).toBe("30");
    expect(cosaMancaPer("tasca", { importo: 30 })).toEqual([]);
  });
});
