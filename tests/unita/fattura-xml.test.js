// Il file XML delle fatture ai clienti (13/11/2026, pezzo 2b).
// Qui i conti e i dati dentro il file; lo schema ufficiale lo controlla
// `fattura-xml-schema.test.js`.
import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { testoLatino, totaliFattura, xmlFattura } from "../../src/lib/calcoli/fattureEmesse";
import { CONTO, DITTA, PERSONA, RIGHE, SOCIETA } from "./fattura-xml-dati.js";

function leggi(xml) {
  return new JSDOM(xml, { contentType: "application/xml" }).window.document;
}
const valori = (doc, tag) => [...doc.getElementsByTagName(tag)].map((n) => n.textContent);

describe("il file della fattura", () => {
  it("con i dati giusti esce, con il nome che vuole lo SdI", () => {
    const r = xmlFattura({ societa: SOCIETA, cliente: DITTA, fattura: CONTO, righe: RIGHE, progressivo: "00001" });
    expect(r.errori).toEqual([]);
    expect(r.nomeFile).toBe("IT01343950869_00001.xml");
    const doc = leggi(r.xml);
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(valori(doc, "FormatoTrasmissione")).toEqual(["FPR12"]);
    expect(valori(doc, "CodiceDestinatario")).toEqual(["KRRH6B9"]);
    expect(valori(doc, "Numero")).toEqual(["1/2027"]);
    expect(valori(doc, "RegimeFiscale")).toEqual(["RF01"]);
    expect(valori(doc, "Denominazione")).toEqual(["Borgo 58 S.r.l.s.", "Rossi & Figli S.r.l."]);
  });

  it("IVA inclusa: il prezzo in fattura è senza IVA, il totale è quello pagato", () => {
    const { xml } = xmlFattura({ societa: SOCIETA, cliente: DITTA, fattura: CONTO, righe: RIGHE, progressivo: "1" });
    const doc = leggi(xml);
    // 27,50 al 10% → 25 senza IVA; 3 → 2,72727273; 2,50 al 22% → 2,04918033
    expect(valori(doc, "PrezzoUnitario")).toEqual(["25.00", "2.72727273", "2.04918033"]);
    expect(valori(doc, "PrezzoTotale")).toEqual(["100.00", "10.90909091", "6.14754098"]);
    // lordo al 10%: 110 + 12 = 122 → 110,91 + 11,09; al 22%: 7,50 → 6,15 + 1,35
    expect(valori(doc, "ImponibileImporto")).toEqual(["6.15", "110.91"]);
    expect(valori(doc, "Imposta")).toEqual(["1.35", "11.09"]);
    expect(valori(doc, "ImportoTotaleDocumento")).toEqual(["129.50"]);
    expect(valori(doc, "ImportoPagamento")).toEqual(["129.50"]);
    // la frazione di centesimo dello scorporo va in «Arrotondamento», e torna
    expect(valori(doc, "Arrotondamento")).toEqual(["0.00245902", "0.00090909"]);
  });

  it("i conti dello SdI tornano: imponibile = somma delle righe + arrotondamento, imposta = imponibile × aliquota (±1 cent)", () => {
    const righe = [
      { posizione: 1, descrizione: "Menu", quantita: 3, prezzo_unitario: 33.33, aliquota_iva: 10 },
      { posizione: 2, descrizione: "Vino", quantita: 1.5, prezzo_unitario: 19.99, aliquota_iva: 22 },
      { posizione: 3, descrizione: "Caffè", quantita: 7, prezzo_unitario: 1.3, aliquota_iva: 10 },
    ];
    const { xml, errori } = xmlFattura({ societa: SOCIETA, cliente: DITTA, fattura: CONTO, righe, progressivo: "1" });
    expect(errori).toEqual([]);
    const doc = leggi(xml);
    const linee = [...doc.getElementsByTagName("DettaglioLinee")];
    for (const r of doc.getElementsByTagName("DatiRiepilogo")) {
      const aliquota = r.getElementsByTagName("AliquotaIVA")[0].textContent;
      const somma = linee
        .filter((l) => l.getElementsByTagName("AliquotaIVA")[0].textContent === aliquota)
        .reduce((s, l) => s + Number(l.getElementsByTagName("PrezzoTotale")[0].textContent), 0);
      const arr = Number(r.getElementsByTagName("Arrotondamento")[0]?.textContent ?? 0);
      const imponibile = Number(r.getElementsByTagName("ImponibileImporto")[0].textContent);
      const imposta = Number(r.getElementsByTagName("Imposta")[0].textContent);
      expect(Math.abs(somma + arr - imponibile)).toBeLessThan(0.000001);
      expect(Math.abs(Math.round(imponibile * Number(aliquota)) / 100 - imposta)).toBeLessThanOrEqual(0.0100001);
    }
    // e il totale è il lordo pagato: 99,99 + 29,99 (1,5 × 19,99 = 29,985 → 29,99) + 9,10
    expect(valori(doc, "ImportoTotaleDocumento")).toEqual(["139.08"]);
    expect(totaliFattura(righe, { prezziIvati: true }).totale).toBe(139.08);
  });

  it("senza IVA inclusa i prezzi restano quelli scritti", () => {
    const { xml } = xmlFattura({
      societa: SOCIETA,
      cliente: DITTA,
      fattura: { ...CONTO, prezzi_ivati: false },
      righe: [{ posizione: 1, descrizione: "Sala per evento", quantita: 1, prezzo_unitario: 200, aliquota_iva: 22 }],
      progressivo: "1",
    });
    const doc = leggi(xml);
    expect(valori(doc, "PrezzoUnitario")).toEqual(["200.00"]);
    expect(valori(doc, "Imposta")).toEqual(["44.00"]);
    expect(valori(doc, "ImportoTotaleDocumento")).toEqual(["244.00"]);
    expect(valori(doc, "Arrotondamento")).toEqual([]);
  });

  it("una persona senza codice destinatario: nome e cognome, codice fiscale, la sua PEC", () => {
    const { xml } = xmlFattura({ societa: SOCIETA, cliente: PERSONA, fattura: CONTO, righe: RIGHE, progressivo: "1" });
    const doc = leggi(xml);
    expect(valori(doc, "CodiceDestinatario")).toEqual(["0000000"]);
    expect(valori(doc, "PECDestinatario")).toEqual(["maria@pec.it"]);
    expect(valori(doc, "Cognome")).toEqual(["D'Amico"]);
    expect(valori(doc, "CodiceFiscale")).toEqual(["01343950869", "DMCMRA80A41H703V"]);
    expect(doc.getElementsByTagName("CessionarioCommittente")[0].getElementsByTagName("IdFiscaleIVA")).toHaveLength(0);
  });

  it("col bonifico c'è l'IBAN; senza IBAN il file non esce", () => {
    const bonifico = { ...CONTO, modalita_pagamento: "MP05" };
    const { xml } = xmlFattura({ societa: SOCIETA, cliente: DITTA, fattura: bonifico, righe: RIGHE, progressivo: "1" });
    expect(valori(leggi(xml), "IBAN")).toEqual(["IT60X0542811101000000123456"]);
    const r = xmlFattura({ societa: { ...SOCIETA, iban: null }, cliente: DITTA, fattura: bonifico, righe: RIGHE, progressivo: "1" });
    expect(r.xml).toBeNull();
    expect(r.errori.join(" ")).toMatch(/IBAN/);
  });

  it("le virgolette del telefono e il trattino lungo diventano quelli semplici; un'emoji ferma il file", () => {
    expect(testoLatino("L’orata — «fresca»  € 5").testo).toBe("L'orata - «fresca» EUR 5");
    const ok = xmlFattura({
      societa: SOCIETA,
      cliente: DITTA,
      fattura: { ...CONTO, causale: "Cena “aziendale” – 12 persone" },
      righe: RIGHE,
      progressivo: "1",
    });
    expect(valori(leggi(ok.xml), "Causale")).toEqual(['Cena "aziendale" - 12 persone']);
    const no = xmlFattura({
      societa: SOCIETA,
      cliente: DITTA,
      fattura: CONTO,
      righe: [{ ...RIGHE[0], descrizione: "Pizza 🍕" }],
      progressivo: "1",
    });
    expect(no.xml).toBeNull();
    expect(no.errori).toEqual(["Riga 1: il carattere «🍕» non si può mettere in fattura. Toglilo o cambialo."]);
  });

  it("una causale lunga si divide in pezzi da 200", () => {
    const lunga = "Pranzo di lavoro ".repeat(30).trim();
    const { xml } = xmlFattura({ societa: SOCIETA, cliente: DITTA, fattura: { ...CONTO, causale: lunga }, righe: RIGHE, progressivo: "1" });
    const pezzi = valori(leggi(xml), "Causale");
    expect(pezzi.length).toBe(3);
    expect(pezzi.every((p) => p.length <= 200)).toBe(true);
    expect(pezzi.join(" ")).toBe(lunga);
  });

  it("si ferma e dice in italiano cosa manca", () => {
    const r = xmlFattura({
      societa: { ...SOCIETA, vat_number: null, sede_cap: "", vat_regime: "non_definito" },
      cliente: DITTA,
      fattura: { ...CONTO, numero: null },
      righe: [],
      progressivo: "123456",
    });
    expect(r.xml).toBeNull();
    expect(r.errori).toEqual([
      "Dati di Borgo 58: la partita IVA sono 11 cifre (manca o è scritta male).",
      "Dati di Borgo 58: il regime IVA della società non è indicato (ordinario o forfettario).",
      "Dati di Borgo 58: manca il CAP della sede.",
      "La fattura non ha ancora un numero.",
      "Il progressivo d'invio sono da 1 a 5 lettere o cifre.",
      "La fattura non ha righe.",
    ]);
  });

  it("il file di prova di una bozza porta il numero «BOZZA»", () => {
    const r = xmlFattura({
      societa: SOCIETA,
      cliente: DITTA,
      fattura: { ...CONTO, numero: null, anno: null },
      righe: RIGHE,
      progressivo: "BOZZA",
      numero: "BOZZA",
    });
    expect(r.errori).toEqual([]);
    expect(r.nomeFile).toBe("IT01343950869_BOZZA.xml");
    expect(valori(leggi(r.xml), "Numero")).toEqual(["BOZZA"]);
  });

  it("un totale congelato che non torna con le righe ferma il file", () => {
    const r = xmlFattura({ societa: SOCIETA, cliente: DITTA, fattura: { ...CONTO, totale: 130 }, righe: RIGHE, progressivo: "1" });
    expect(r.xml).toBeNull();
    expect(r.errori[0]).toMatch(/non torna con le righe/);
  });

  it("righe senza IVA oltre 77,47 €: serve la marca da bollo, si chiede a Laura", () => {
    const r = xmlFattura({
      societa: SOCIETA,
      cliente: DITTA,
      fattura: CONTO,
      righe: [{ posizione: 1, descrizione: "Rimborso", quantita: 1, prezzo_unitario: 100, aliquota_iva: 0, natura: "N1" }],
      progressivo: "1",
    });
    expect(r.xml).toBeNull();
    expect(r.errori.join(" ")).toMatch(/marca da bollo/);
  });

  it("una riga con la quantità a metà: la riga del file parte dal centesimo del conto (revisione 13/11)", () => {
    // 40 × (1,5 × 0,33): ogni riga sul conto è 0,50, non 0,495
    const righe = Array.from({ length: 40 }, (_, i) => ({
      posizione: i + 1, descrizione: "Assaggio", quantita: 1.5, prezzo_unitario: 0.33, aliquota_iva: 10,
    }));
    const { xml, errori } = xmlFattura({ societa: SOCIETA, cliente: DITTA, fattura: CONTO, righe, progressivo: "1" });
    expect(errori).toEqual([]);
    const doc = leggi(xml);
    // 0,50 lordo al 10% → 0,45454545 senza IVA
    expect(new Set(valori(doc, "PrezzoTotale"))).toEqual(new Set(["0.45454545"]));
    expect(valori(doc, "ImportoTotaleDocumento")).toEqual(["20.00"]);
    // l'arrotondamento è solo la frazione dello scorporo: 18,18 − 40 × 0,45454545
    expect(valori(doc, "Arrotondamento")).toEqual(["-0.001818"]);
  });

  it("una partita IVA o un codice fiscale con la cifra di controllo sbagliata fermano il file", () => {
    const r = xmlFattura({
      societa: SOCIETA,
      cliente: { ...DITTA, partita_iva: "12345678901", codice_fiscale: "DMCMRA80A41H703X" },
      fattura: CONTO,
      righe: RIGHE,
      progressivo: "1",
    });
    expect(r.xml).toBeNull();
    expect(r.errori.join(" ")).toMatch(/partita IVA non torna/);
    expect(r.errori.join(" ")).toMatch(/codice fiscale non torna/);
  });

  it("il 31 febbraio non è una data, e una natura inventata non passa", () => {
    const d = xmlFattura({ societa: SOCIETA, cliente: DITTA, fattura: { ...CONTO, data: "2027-02-31" }, righe: RIGHE, progressivo: "1" });
    expect(d.errori).toEqual(["La data della fattura non è una data vera."]);
    const r = xmlFattura({
      societa: SOCIETA,
      cliente: DITTA,
      fattura: CONTO,
      progressivo: "1",
      righe: [{ posizione: 1, descrizione: "x", quantita: 1, prezzo_unitario: 5, aliquota_iva: 0, natura: "N9" }],
    });
    expect(r.errori).toEqual(["Riga 1: il motivo senza IVA «N9» non è fra quelli ufficiali."]);
  });

  it("un cliente estero per ora no", () => {
    const r = xmlFattura({ societa: SOCIETA, cliente: { ...DITTA, nazione: "DE" }, fattura: CONTO, righe: RIGHE, progressivo: "1" });
    expect(r.xml).toBeNull();
    expect(r.errori.join(" ")).toMatch(/clienti italiani/);
  });
});
