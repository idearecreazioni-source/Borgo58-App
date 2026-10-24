// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { centesimiDecimale, leggiFatturaPA, payloadFattura, xmlDaFile } from "../../src/lib/calcoli/fatturaPA";

// IL LETTORE DELLE FATTURE ELETTRONICHE (24/10/2026).
//
// ⚠️ Le fatture qui sotto sono COSTRUITE: il repository è pubblico. La
// forma ricalca quella di una fattura vera ricevuta dal locale (FPR12,
// spazio dei nomi sulla radice e `xmlns=""` su testa e corpo), che il
// lettore ha letto per intero prima che queste prove esistessero.

function fattura({
  tipo = "TD01",
  numero = "12/26",
  data = "2026-10-09",
  totale = "122.00",
  riepiloghi = [["100.00", "22.00"]],
  pagamenti = [["2026-11-08", "122.00"]],
  extraGenerali = "",
  corpi = 1,
} = {}) {
  const corpo = `
  <FatturaElettronicaBody xmlns="">
    <DatiGenerali><DatiGeneraliDocumento>
      <TipoDocumento>${tipo}</TipoDocumento><Divisa>EUR</Divisa>
      ${data ? `<Data>${data}</Data>` : ""}
      ${numero ? `<Numero>${numero}</Numero>` : ""}
      ${totale ? `<ImportoTotaleDocumento>${totale}</ImportoTotaleDocumento>` : ""}
      ${extraGenerali}
    </DatiGeneraliDocumento></DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee><NumeroLinea>1</NumeroLinea><Descrizione>Pomodori  di prova</Descrizione>
        <Quantita>10.00</Quantita><UnitaMisura>KG</UnitaMisura><PrezzoUnitario>10.00</PrezzoUnitario>
        <PrezzoTotale>100.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
      ${riepiloghi.map(([i, t]) => `<DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>${i}</ImponibileImporto><Imposta>${t}</Imposta></DatiRiepilogo>`).join("")}
    </DatiBeniServizi>
    ${pagamenti.length ? `<DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento>${pagamenti.map(([d, imp]) => `<DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><DataScadenzaPagamento>${d}</DataScadenzaPagamento><ImportoPagamento>${imp}</ImportoPagamento><IBAN>IT00X0000000000000000000001</IBAN></DettaglioPagamento>`).join("")}</DatiPagamento>` : ""}
  </FatturaElettronicaBody>`;
  return `<?xml version="1.0" encoding="utf-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader xmlns="">
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000001</IdCodice></IdFiscaleIVA>
        <Anagrafica><Denominazione>Fornitore di prova srl</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Contatti><Email>prova@example.invalid</Email></Contatti>
    </CedentePrestatore>
    <CessionarioCommittente><DatiAnagrafici>
      <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000002</IdCodice></IdFiscaleIVA>
      <Anagrafica><Denominazione>Cliente di prova</Denominazione></Anagrafica>
    </DatiAnagrafici></CessionarioCommittente>
  </FatturaElettronicaHeader>${corpo.repeat(corpi)}
</p:FatturaElettronica>`;
}

describe("la fattura si legge dai suoi campi", () => {
  it("una fattura normale", () => {
    const { fatture, errori } = leggiFatturaPA(fattura());
    expect(errori).toEqual([]);
    expect(fatture).toHaveLength(1);
    const f = fatture[0];
    expect(f.errori).toEqual([]);
    expect(f.avvisi).toEqual([]);
    expect(f).toMatchObject({
      tipo: "TD01", numero: "12/26", data: "2026-10-09",
      totaleCentesimi: 12200, imponibileCentesimi: 10000, impostaCentesimi: 2200,
      daPagareCentesimi: 12200, scadenza: "2026-11-08",
    });
    expect(f.fornitore).toEqual({
      denominazione: "Fornitore di prova srl", partitaIva: "IT00000000001",
      codiceFiscale: null, email: "prova@example.invalid",
    });
    expect(f.cliente.partitaIva).toBe("IT00000000002");
    expect(f.righe[0]).toEqual({ descrizione: "Pomodori di prova", quantita: 10, unita: "KG", prezzoTotale: 100, aliquota: 22 });
  });

  it("più aliquote si sommano", () => {
    const f = leggiFatturaPA(fattura({ totale: "136.00", riepiloghi: [["100.00", "22.00"], ["10.00", "1.00"], ["3.00", "0.00"]], pagamenti: [["2026-11-08", "136.00"]] })).fatture[0];
    expect(f.imponibileCentesimi).toBe(11300);
    expect(f.impostaCentesimi).toBe(2300);
    expect(f.avvisi).toEqual([]);
  });

  it("un lotto: più fatture nello stesso file", () => {
    expect(leggiFatturaPA(fattura({ corpi: 3 })).fatture).toHaveLength(3);
  });

  it("con più rate, la scadenza proposta è la prima", () => {
    const f = leggiFatturaPA(fattura({ pagamenti: [["2026-12-08", "61.00"], ["2026-11-08", "61.00"]] })).fatture[0];
    expect(f.scadenza).toBe("2026-11-08");
    expect(f.daPagareCentesimi).toBe(12200);
  });
});

// ⚠️ ciò che è strano si DICHIARA, ciò che è inutilizzabile si FERMA.
describe("avvisi e rifiuti", () => {
  it("la marca da bollo si riconosce e si dice", () => {
    const f = leggiFatturaPA(fattura({ totale: "124.00", extraGenerali: "<DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>2.00</ImportoBollo></DatiBollo>" })).fatture[0];
    expect(f.errori).toEqual([]);
    expect(f.avvisi.join(" ")).toMatch(/pari alla marca da bollo/);
  });

  it("un totale assente si calcola e lo si dice", () => {
    const f = leggiFatturaPA(fattura({ totale: null })).fatture[0];
    expect(f.totaleCentesimi).toBe(12200);
    expect(f.avvisi.join(" ")).toMatch(/non ha scritto il totale/);
  });

  it("le scadenze che non fanno il totale si dicono", () => {
    const f = leggiFatturaPA(fattura({ pagamenti: [["2026-11-08", "100.00"]] })).fatture[0];
    expect(f.avvisi.join(" ")).toMatch(/sommano 100,00 €/);
  });

  it("una nota di credito non entra come fattura", () => {
    const f = leggiFatturaPA(fattura({ tipo: "TD04" })).fatture[0];
    expect(f.errori.join(" ")).toMatch(/nota di credito/);
  });

  it("un tipo sconosciuto non entra", () => {
    expect(leggiFatturaPA(fattura({ tipo: "TD16" })).fatture[0].errori.join(" ")).toMatch(/non ancora gestito/);
  });

  it("senza numero o senza data si ferma", () => {
    expect(leggiFatturaPA(fattura({ numero: null })).fatture[0].errori).toContain("Manca il numero della fattura.");
    expect(leggiFatturaPA(fattura({ data: null })).fatture[0].errori.join(" ")).toMatch(/Manca la data/);
  });

  it("un importo illeggibile si ferma, non diventa zero", () => {
    const f = leggiFatturaPA(fattura({ totale: "122,00" })).fatture[0];
    expect(f.errori).toContain("Il totale della fattura non si legge.");
  });

  it("un file che non è una fattura", () => {
    expect(leggiFatturaPA("<html><body>ciao</body></html>").errori.join(" ")).toMatch(/non è una fattura elettronica/);
    expect(leggiFatturaPA("non è xml").errori.length).toBe(1);
  });
});

// La busta firmata: costruita a mano, byte per byte, con la stessa forma
// di una vera (ContentInfo → SignedData → EncapsulatedContentInfo).
function der(tag, ...contenuti) {
  const corpo = contenuti.flatMap((c) => Array.from(c));
  const n = corpo.length;
  const lung = n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : n < 0x10000 ? [0x82, n >> 8, n & 0xff] : [0x83, n >> 16, (n >> 8) & 0xff, n & 0xff];
  return new Uint8Array([tag, ...lung, ...corpo]);
}
const OID_SIGNED = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02];
const OID_DATA = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01];

function busta(xml, { spezzata = false } = {}) {
  const b = new TextEncoder().encode(xml);
  let ottetti;
  if (!spezzata) ottetti = der(0x04, b);
  else {
    // OCTET STRING costruito a lunghezza indefinita, a pezzi da 100 byte:
    // la forma BER che alcuni firmatari producono davvero.
    const pezzi = [];
    for (let i = 0; i < b.length; i += 100) pezzi.push(...der(0x04, b.subarray(i, i + 100)));
    ottetti = new Uint8Array([0x24, 0x80, ...pezzi, 0, 0]);
  }
  const encap = der(0x30, OID_DATA, der(0xa0, ottetti));
  const signedData = der(0x30, [0x02, 0x01, 0x01], der(0x31), encap, der(0x31));
  return der(0x30, OID_SIGNED, der(0xa0, signedData));
}

describe("la busta firmata si apre", () => {
  const xml = fattura();
  it("l'XML in chiaro passa così com'è", () => {
    expect(xmlDaFile(new TextEncoder().encode(xml))).toBe(xml);
  });
  it("il p7m binario", () => {
    expect(xmlDaFile(busta(xml))).toBe(xml);
  });
  it("il p7m spezzato a pezzi, a lunghezza indefinita", () => {
    expect(xmlDaFile(busta(xml, { spezzata: true }))).toBe(xml);
  });
  it("il p7m in base64", () => {
    const b64 = btoa(String.fromCharCode(...busta(xml)));
    expect(xmlDaFile(new TextEncoder().encode(b64.replace(/(.{64})/g, "$1\n")))).toBe(xml);
  });
  it("una busta troncata si ferma con una frase", () => {
    const b = busta(xml);
    expect(() => xmlDaFile(b.subarray(0, b.length / 2))).toThrow(/non si apre/);
  });
  it("un file qualsiasi", () => {
    expect(() => xmlDaFile(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toThrow(/non è una fattura elettronica/);
  });
});

describe("gli importi", () => {
  it("in centesimi, senza virgola mobile", () => {
    expect(centesimiDecimale("4941.00")).toBe(494100);
    expect(centesimiDecimale("0.1")).toBe(10);
    expect(centesimiDecimale("-2.5")).toBe(-250);
    expect(centesimiDecimale("1,00")).toBeNull();
    expect(centesimiDecimale("1.005")).toBeNull();
  });
});

describe("quello che va al database", () => {
  it("in euro, col file e con l'IBAN a cui pagare nella nota", () => {
    const f = leggiFatturaPA(fattura()).fatture[0];
    const p = payloadFattura(f, "IT00000000001_ab.xml.p7m");
    expect(p).toMatchObject({
      tipo: "TD01", numero: "12/26", data: "2026-10-09", scadenza: "2026-11-08",
      totale: 122, imponibile: 100, imposta: 22, file_sdi: "IT00000000001_ab.xml.p7m",
      fornitore: { partita_iva: "IT00000000001", denominazione: "Fornitore di prova srl" },
      cliente: { partita_iva: "IT00000000002" },
    });
    expect(p.note).toMatch(/IT00X0000000000000000000001/);
  });
});
