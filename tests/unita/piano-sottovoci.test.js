import { describe, expect, it } from "vitest";
import {
  contoConSottovoci,
  sottovociPerMadre,
  totaleVoce,
  totaliDelPiano,
  voceConSottovoci,
} from "../../src/lib/calcoli/pianoInvestimento.js";
import { vociSceglibili } from "../../src/lib/api/spuntaInvestimento.js";

// 🔴 LE SOTTOVOCI DEL PIANO (12/11/2026, modello approvato da Alessio
//    l'11/11). La madre ha cifra e stato dal database (migrazione
//    20261112000002); qui si prova quello che fa la pagina.

const madre = { id: "m", gruppo: "A", descrizione: "Attrezzature cucina", importo_ivato: 1320, stato: "stimato", aliquota_iva: 22, netto: 1081.97 };
const forno = { id: "f", madre_id: "m", gruppo: "A", descrizione: "Forno", importo_ivato: 1000, stato: "confermato", aliquota_iva: 0, netto: 1000, ordine: 1 };
const abbatt = { id: "b", madre_id: "m", gruppo: "A", descrizione: "Abbattitore", importo_ivato: 320, stato: "stimato", aliquota_iva: 22, netto: 262.3, ordine: 0 };
const pedana = { id: "p", gruppo: "A", descrizione: "Pedana", importo_ivato: 2000, stato: "stimato", aliquota_iva: 22, netto: 1639.34 };

describe("le sottovoci nella pagina", () => {
  it("si raccolgono per madre, in ordine, senza le archiviate", () => {
    const m = sottovociPerMadre([madre, forno, abbatt, { ...abbatt, id: "x", archiviata_il: "2026-11-12" }, pedana]);
    expect(m.get("m").map((v) => v.id)).toEqual(["b", "f"]);
    expect(m.has("p")).toBe(false);
  });

  it("la madre somma i netti, e con aliquote diverse l'IVA è «mista»", () => {
    const v = voceConSottovoci(madre, [forno, abbatt]);
    expect(v.netto).toBe(1262.3);
    expect(v.iva_mista).toBe(true);
    expect(voceConSottovoci(madre, [abbatt]).iva_mista).toBe(false);
  });

  it("lo speso della madre è quello delle sottovoci", () => {
    const per = new Map([["f", { speso: 1000, impegnato: 0 }], ["b", { speso: 0.1, impegnato: 0.2 }]]);
    expect(contoConSottovoci([forno, abbatt], per)).toEqual({ speso: 1000.1, impegnato: 0.2, scollegate: 0 });
  });

  it("il totale della madre: «stimato · di cui confermato»", () => {
    expect(totaleVoce(madre, [forno, abbatt])).toEqual({ parola: "stimato", importo: 1320, diCuiConfermato: 1000 });
    expect(totaleVoce({ ...madre, stato: "confermato" }, [forno]).diCuiConfermato).toBeUndefined();
  });

  it("🔴 i totali non contano la madre due volte", () => {
    const t = totaliDelPiano([madre, forno, abbatt, pedana].map((v) => ({ ...v, speso: 0, impegnato: 0 })));
    expect(t.totale.previsto).toBe(3320);
  });
});

describe("la scelta della voce per una spesa", () => {
  it("la madre non si sceglie; la sottovoce si legge «Madre › Sottovoce» sotto la madre", () => {
    const voci = vociSceglibili([madre, pedana, forno, abbatt]);
    expect(voci.map((v) => v.descrizione)).toEqual(["Attrezzature cucina › Forno", "Attrezzature cucina › Abbattitore", "Pedana"]);
  });
});
