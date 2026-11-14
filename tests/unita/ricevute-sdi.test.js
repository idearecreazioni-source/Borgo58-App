// Le risposte dello SdI alle fatture ai clienti (13/11/2026, pezzo 4).
// Ricevute FINTE (il repository è pubblico), costruite come quelle vere e
// passate anche dallo schema ufficiale delle ricevute (MessaggiTypes 1.1).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateXML } from "xmllint-wasm";
import {
  eNomeRicevutaSdi,
  esitoDellaRicevuta,
  leggiRicevutaSdi,
} from "../../supabase/functions/_shared/ricevuteSdi.js";

// Una firma finta ma con la forma giusta: lo schema la pretende, lo SdI la
// mette sempre. Qui non si verifica (come per le fatture: `fatturaPA.js`).
const FIRMA = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo><ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/><ds:Reference URI=""><ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>AAAA</ds:DigestValue></ds:Reference></ds:SignedInfo><ds:SignatureValue>AAAA</ds:SignatureValue></ds:Signature>`;

const NS = 'xmlns:ns3="http://www.fatturapa.gov.it/sdi/messaggi/v1.0" versione="1.0"';

const RC = `<?xml version="1.0" encoding="UTF-8"?>
<ns3:RicevutaConsegna ${NS}>
  <IdentificativoSdI>12345678901</IdentificativoSdI>
  <NomeFile>IT01343950869_0000A.xml</NomeFile>
  <DataOraRicezione>2027-01-15T10:00:00.000+01:00</DataOraRicezione>
  <DataOraConsegna>2027-01-15T10:05:00.000+01:00</DataOraConsegna>
  <Destinatario><Codice>ABC123</Codice><Descrizione>Ditta Esempio</Descrizione></Destinatario>
  <MessageId>111222333</MessageId>
  ${FIRMA}
</ns3:RicevutaConsegna>`;

const NS_SCARTO = `<?xml version="1.0" encoding="UTF-8"?>
<ns3:NotificaScarto ${NS}>
  <IdentificativoSdI>12345678902</IdentificativoSdI>
  <NomeFile>IT01343950869_0000B.xml</NomeFile>
  <DataOraRicezione>2027-01-15T10:00:00.000+01:00</DataOraRicezione>
  <ListaErrori>
    <Errore><Codice>00305</Codice><Descrizione>1.4.1.1.2 IdCodice non valido : 12345678901</Descrizione></Errore>
    <Errore><Codice>00404</Codice><Descrizione>Fattura duplicata</Descrizione></Errore>
  </ListaErrori>
  <MessageId>111222334</MessageId>
  ${FIRMA}
</ns3:NotificaScarto>`;

const MC = `<?xml version="1.0" encoding="UTF-8"?>
<ns3:NotificaMancataConsegna ${NS}>
  <IdentificativoSdI>12345678903</IdentificativoSdI>
  <NomeFile>IT01343950869_0000C.xml</NomeFile>
  <DataOraRicezione>2027-01-15T10:00:00.000+01:00</DataOraRicezione>
  <Descrizione>Il destinatario non è raggiungibile</Descrizione>
  <MessageId>111222335</MessageId>
  ${FIRMA}
</ns3:NotificaMancataConsegna>`;

describe("le ricevute dello SdI", () => {
  it("si riconoscono dal nome: le nostre ricevute sì, le fatture e i metadati no", () => {
    expect(eNomeRicevutaSdi("IT01343950869_0000A_RC_001.xml")).toBe(true);
    expect(eNomeRicevutaSdi("IT01343950869_0000A_NS_001.xml")).toBe(true);
    expect(eNomeRicevutaSdi("IT01343950869_0000A_MC_002.xml")).toBe(true);
    expect(eNomeRicevutaSdi("IT01343950869_0000A.xml")).toBe(false);
    expect(eNomeRicevutaSdi("IT01234567890_abcde_MT_001.xml")).toBe(false);
    expect(eNomeRicevutaSdi("fattura_RC_001.pdf")).toBe(false);
  });

  it("la consegna: nome del file, identificativo dello SdI, l'ora", () => {
    const r = leggiRicevutaSdi(RC);
    expect(r).toMatchObject({
      tipo: "RC",
      nomeFile: "IT01343950869_0000A.xml",
      identificativoSdi: "12345678901",
      consegna: "2027-01-15T10:05:00.000+01:00",
      errori: [],
    });
    expect(esitoDellaRicevuta(r).stato).toBe("consegnata");
  });

  it("lo scarto: tutti gli errori, detti nella nota con il gesto da fare", () => {
    const r = leggiRicevutaSdi(new TextEncoder().encode(NS_SCARTO));
    expect(r.errori).toEqual([
      { codice: "00305", descrizione: "1.4.1.1.2 IdCodice non valido : 12345678901" },
      { codice: "00404", descrizione: "Fattura duplicata" },
    ]);
    const e = esitoDellaRicevuta(r);
    expect(e.stato).toBe("scartata");
    expect(e.nota).toMatch(/00305 1\.4\.1\.1\.2 IdCodice non valido.*00404 Fattura duplicata.*Rimanda allo SdI/);
  });

  it("la mancata consegna: messa a disposizione, emessa per il fisco, con il motivo", () => {
    const e = esitoDellaRicevuta(leggiRicevutaSdi(MC));
    expect(e.stato).toBe("messa_a_disposizione");
    expect(e.nota).toMatch(/cassetto fiscale.*Il destinatario non è raggiungibile/);
  });

  it("una fattura, un XML qualunque o un file rotto non sono ricevute", () => {
    expect(leggiRicevutaSdi('<p:FatturaElettronica xmlns:p="x" versione="FPR12"/>')).toBeNull();
    expect(leggiRicevutaSdi("<RicevutaConsegna><IdentificativoSdI>1</IdentificativoSdI></RicevutaConsegna>")).toBeNull();
    expect(leggiRicevutaSdi("non è xml <")).toBeNull();
    expect(leggiRicevutaSdi(new Uint8Array([0x30, 0x82, 0x00]))).toBeNull();
  });

  it("le ricevute finte di queste prove hanno la forma dello schema ufficiale", async () => {
    const cartella = new URL("../dati/fatturapa/", import.meta.url);
    const schema = readFileSync(new URL("MessaggiTypes_v1.1.xsd", cartella), "utf8").replace(
      "http://www.w3.org/TR/2002/REC-xmldsig-core-20020212/xmldsig-core-schema.xsd",
      "xmldsig-core-schema.xsd"
    );
    const firma = readFileSync(new URL("xmldsig-core-schema.xsd", cartella), "utf8");
    for (const xml of [RC, NS_SCARTO, MC]) {
      const r = await validateXML({
        xml: [{ fileName: "r.xml", contents: xml }],
        schema: [{ fileName: "MessaggiTypes_v1.1.xsd", contents: schema }],
        preload: [{ fileName: "xmldsig-core-schema.xsd", contents: firma }],
      });
      expect(r.errors.map((e) => e.rawMessage ?? e.message)).toEqual([]);
    }
  });
});

describe("la lettura della posta", () => {
  it("legge le ricevute PRIMA del modello, e solo se la mail viene davvero dallo SdI", () => {
    const t = readFileSync("supabase/functions/posta-leggi/index.ts", "utf8");
    const chiamata = t.indexOf("registraRicevuteSdi(m, ricevuteSdi)");
    expect(chiamata).toBeGreaterThan(0);
    expect(chiamata).toBeLessThan(t.indexOf("anthropic.messages.create"));
    const condizione = t.slice(t.indexOf("const ricevuteSdi ="), chiamata);
    expect(condizione).toMatch(/vieneDalloSdi\(\{ mittenteBusta: m\.mittente_busta/);
    expect(condizione).toMatch(/every\(\(a: \{ file_name\?: string \}\) => eNomeRicevutaSdi/);
  });
});
