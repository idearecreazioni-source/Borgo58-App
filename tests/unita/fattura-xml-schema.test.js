// Ogni file che esce da `xmlFattura()` passa dallo SCHEMA UFFICIALE
// dell'Agenzia delle Entrate (13/11/2026, pezzo 2b).
//
// Lo schema è in `tests/dati/fatturapa/`, scaricato così com'è:
//   - Schema_VFPR12_v1.2.3.xsd: fatturapa.gov.it, «Formato FatturaPA»,
//     versione 1.2.3 (specifiche tecniche 1.9, in vigore dall'1/4/2025);
//   - xmldsig-core-schema.xsd: w3.org, lo schema della firma che il primo
//     importa. Lo si legge da qui e non da internet: la prova non va in rete.
// Il controllo lo fa libxml2 (lo stesso di `xmllint`), compilato per Node:
// il pacchetto `xmllint-wasm`, solo per le prove, mai nell'app.
//
// ⚠️ Lo schema controlla la FORMA (campi, ordine, cifre, lunghezze). I conti
// (imponibile = righe + arrotondamento, imposta = imponibile × aliquota) li
// controlla `fattura-xml.test.js`, come li controlla lo SdI.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateXML } from "xmllint-wasm";
import { xmlFattura } from "../../src/lib/calcoli/fattureEmesse";
import { CONTO, DITTA, PERSONA, RIGHE, SOCIETA } from "./fattura-xml-dati.js";

const cartella = new URL("../dati/fatturapa/", import.meta.url);
const SCHEMA = readFileSync(new URL("Schema_VFPR12_v1.2.3.xsd", cartella), "utf8").replace(
  "http://www.w3.org/TR/2002/REC-xmldsig-core-20020212/xmldsig-core-schema.xsd",
  "xmldsig-core-schema.xsd"
);
const FIRMA = readFileSync(new URL("xmldsig-core-schema.xsd", cartella), "utf8");

async function controlla(xml) {
  const r = await validateXML({
    xml: [{ fileName: "fattura.xml", contents: xml }],
    schema: [{ fileName: "Schema_VFPR12_v1.2.3.xsd", contents: SCHEMA }],
    preload: [{ fileName: "xmldsig-core-schema.xsd", contents: FIRMA }],
  });
  return { valido: r.valid, errori: r.errors.map((e) => e.rawMessage ?? e.message ?? String(e)) };
}

const CASI = {
  "ditta col codice destinatario, pagata con la carta": { cliente: DITTA, fattura: CONTO },
  "persona col codice fiscale e la PEC": { cliente: PERSONA, fattura: CONTO },
  "bonifico con l'IBAN": { cliente: DITTA, fattura: { ...CONTO, modalita_pagamento: "MP05" } },
  "contanti, senza causale": { cliente: DITTA, fattura: { ...CONTO, modalita_pagamento: "MP01", causale: null } },
  "prezzi senza IVA inclusa": { cliente: DITTA, fattura: { ...CONTO, prezzi_ivati: false } },
  "società senza REA e senza codice fiscale": {
    societa: { ...SOCIETA, rea_ufficio: null, rea_numero: null, tax_code: null },
    cliente: DITTA,
    fattura: CONTO,
  },
  "una riga senza IVA (natura N4) sotto la soglia del bollo": {
    cliente: DITTA,
    fattura: CONTO,
    righe: [...RIGHE, { posizione: 4, descrizione: "Omaggio", quantita: 1, prezzo_unitario: 5, aliquota_iva: 0, natura: "N4" }],
  },
  "testi con & < > e virgolette, causale lunga": {
    cliente: { ...DITTA, denominazione: "Bar <Sport> & \"Amici\"" },
    fattura: { ...CONTO, causale: "Cena “di gala” – ".repeat(25) },
  },
  "file di prova di una bozza": {
    cliente: DITTA,
    fattura: { ...CONTO, numero: null },
    numero: "BOZZA",
    progressivo: "BOZZA",
  },
};

describe("lo schema ufficiale FPR12 1.2.3", () => {
  for (const [nome, caso] of Object.entries(CASI)) {
    it(nome, async () => {
      const { xml, errori } = xmlFattura({
        societa: caso.societa ?? SOCIETA,
        cliente: caso.cliente,
        fattura: caso.fattura,
        righe: caso.righe ?? RIGHE,
        progressivo: caso.progressivo ?? "00001",
        numero: caso.numero,
      });
      expect(errori).toEqual([]);
      expect(await controlla(xml)).toEqual({ valido: true, errori: [] });
    });
  }

  it("e lo schema se ne accorge davvero, se manca un campo obbligatorio", async () => {
    const { xml } = xmlFattura({ societa: SOCIETA, cliente: DITTA, fattura: CONTO, righe: RIGHE, progressivo: "1" });
    const storto = xml.replace("<RegimeFiscale>RF01</RegimeFiscale>", "");
    const r = await controlla(storto);
    expect(r.valido).toBe(false);
    expect(r.errori.join(" ")).toMatch(/RegimeFiscale/);
  });
});
