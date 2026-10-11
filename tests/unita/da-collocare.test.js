import { describe, expect, it } from "vitest";
import { appuntoDaLettura, campiPer, cosaMancaPer } from "../../src/lib/calcoli/daCollocare";

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
