import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SCELTA_HO_PAGATO_IO,
  anticipoDallaFattura,
  avvisoImportoAnticipo,
  importoDaAnticipare,
} from "../../src/lib/calcoli/fatturaAnticipo";
import { FONDI_ANTICIPO, PAYMENT_METHODS } from "../../src/lib/constants";
import { SPECCHIATI } from "../../src/lib/calcoli/vocabolari";

// =====================================================================
// «HO PAGATO IO» DA FATTURE FORNITORI — 13/11/2026
// =====================================================================
// La scelta «Come paghi → Ho pagato io» riempie i campi dell'anticipo
// partendo dalla fattura, e li consegna alla STESSA `createAnticipazione` di
// /cassa/personale. Qui si provano le funzioni pure; il salvataggio vero lo
// provano la migrazione 20261101000001 e quella del 13/11.

const FATTURA = {
  id: "f-lorito",
  entity_id: "id-srls",
  amount: "235.00",
  da_pagare: "235.00",
  supplier: { name: "Fabio Lorito" },
};

describe("quanto vale l'anticipo", () => {
  it("è quello che resta da pagare, non l'importo della fattura", () => {
    expect(importoDaAnticipare(FATTURA)).toBe(235);
    expect(importoDaAnticipare({ ...FATTURA, amount: "250.00", da_pagare: "210.00" })).toBe(210);
  });

  it("senza «da pagare» vale l'importo; senza fattura o con un numero rotto non si dice", () => {
    expect(importoDaAnticipare({ amount: "40" })).toBe(40);
    expect(importoDaAnticipare(null)).toBeNull();
    expect(importoDaAnticipare({ amount: "boh" })).toBeNull();
  });

  it("l'avviso della cifra diversa usa la stessa regola", () => {
    expect(avvisoImportoAnticipo("235", FATTURA)).toBeNull();
    expect(avvisoImportoAnticipo("230", FATTURA)).toMatch(/quanto resta da pagare/);
    expect(avvisoImportoAnticipo("210", { ...FATTURA, da_pagare: "210.00" })).toBeNull();
  });
});

describe("i campi dell'anticipo nati dalla fattura", () => {
  it("🔴 la società della fattura, la fattura stessa, quanto resta, il motivo e i soldi scelti", () => {
    expect(
      anticipoDallaFattura(FATTURA, { pagataIl: "2026-11-13", tagId: "t1", fondi: "contanti" })
    ).toEqual({
      entityId: "id-srls",
      importo: "235",
      pagataIl: "2026-11-13",
      tagId: "t1",
      fondi: "contanti",
      supplierInvoiceId: "f-lorito",
      documento: "",
      nota: "",
      eInvestimento: false,
    });
  });

  it("la spunta «investimento» nasce spenta: se la fattura è segnata la passa il database", () => {
    expect(anticipoDallaFattura({ ...FATTURA, e_investimento: true }, { tagId: "t1" }).eInvestimento).toBe(false);
  });

  it("senza scelta, i soldi sono i contanti (come il riquadro in Cassa)", () => {
    expect(anticipoDallaFattura(FATTURA, { tagId: "t1" }).fondi).toBe("contanti");
  });
});

describe("«Ho pagato io» non è un modo di pagare della società", () => {
  it("🔴 non sta in PAYMENT_METHODS (il database scrive «anticipo» da solo)", () => {
    expect(PAYMENT_METHODS.map((p) => p.value)).not.toContain(SCELTA_HO_PAGATO_IO);
    expect(PAYMENT_METHODS.map((p) => p.value)).not.toContain("anticipo");
  });

  it("i soldi di Alessio sono un elenco solo, specchio di anticipazioni_socio.fondi", () => {
    expect(FONDI_ANTICIPO.map((f) => f.value)).toEqual(["contanti", "conto_personale"]);
    expect(SPECCHIATI.some((s) => s.costante === "FONDI_ANTICIPO" && s.tabella === "anticipazioni_socio" && s.colonna === "fondi")).toBe(true);
  });
});

describe("una logica sola", () => {
  const leggi = (p) => readFileSync(p, "utf8");

  it("🔴 Fatture salva con createAnticipazione, come /cassa/personale", () => {
    const fatture = leggi("src/pages/fatture/FattureFornitoriHome.jsx");
    expect(fatture).toMatch(/createAnticipazione\(anticipoDallaFattura\(/);
    // Nessuna seconda strada verso il database: la chiamata è una sola.
    expect(fatture).not.toMatch(/eseguiOperazione|\.rpc\(|from\("anticipazioni_socio"\)/);
  });

  it("le parole e il menu dei soldi sono gli stessi componenti nelle due schermate", () => {
    for (const p of ["src/pages/fatture/FattureFornitoriHome.jsx", "src/pages/cassa/SezionePersonale.jsx"]) {
      const t = leggi(p);
      expect(t, p).toContain('from "../../components/HoPagatoIo"');
      for (const pezzo of ["<SceltaFondi", "<AvvisoContoPersonale", "<FraseAnticipoPagaFattura", "<ErroreDelGesto"]) {
        expect(t, `${p}: ${pezzo}`).toContain(pezzo);
      }
      // Nessuna copia delle frasi: vivono solo nel componente.
      expect(t, p).not.toMatch(/entrerà da sola/);
      expect(t, p).not.toMatch(/contanti miei/);
    }
  });
});
