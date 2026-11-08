import { describe, expect, it } from "vitest";
import {
  classificaAllegato,
  eBustaPec,
  eFatturaPA,
  eRicevutaPec,
  etichettaCasella,
  mittenteReale,
  oggettoPulito,
} from "../../supabase/functions/_shared/pec.js";
import * as dallApp from "../../src/lib/calcoli/fatturaPA";
import * as condiviso from "../../supabase/functions/_shared/fatturaPA.js";

// COME SI LEGGE UNA PEC (08/11/2026).
//
// ⚠️ Tutto qui è FINTO, ma con la forma delle due PEC vere arrivate su work
// il 07/11 (lette in sola lettura dalla chat madre): stessa busta di Aruba,
// stessa «È» rovinata in «ï¿½», stessi nomi di allegati con il numero.
// Le PEC vere non entrano: il repository è pubblico.

const enc = (s) => new TextEncoder().encode(s);

function testoBusta({ oggetto = "Fwd: POSTA CERTIFICATA: prova gestionale", mittente = '"borgo58@pec.it"' } = {}) {
  return [
    "-- Messaggio di posta certificata --",
    "",
    "Il giorno 07/11/2026 alle ore 13:40:31 (+0100) il messaggio con oggetto",
    `"${oggetto}" ï¿½ stato inviato da ${mittente} ed indirizzato a:`,
    "- pec@prova-finta.resend.app",
    "Il messaggio originale ï¿½ incluso in allegato.",
    "Identificativo messaggio: finto.0001@pec.aruba.it",
    "",
    "-- Certified mail message --",
    "",
    `On 07/11/2026 at 13:40:31 (+0100) the message "${oggetto}" was sent by ${mittente}`,
  ].join("\n");
}

const FATTURA = `<?xml version="1.0" encoding="utf-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader xmlns=""><CedentePrestatore><DatiAnagrafici>
    <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000001</IdCodice></IdFiscaleIVA>
    <Anagrafica><Denominazione>Fornitore di prova srl</Denominazione></Anagrafica>
  </DatiAnagrafici></CedentePrestatore></FatturaElettronicaHeader>
  <FatturaElettronicaBody xmlns=""><DatiGenerali><DatiGeneraliDocumento>
    <TipoDocumento>TD01</TipoDocumento><Data>2026-10-09</Data><Numero>12/26</Numero>
  </DatiGeneraliDocumento></DatiGenerali></FatturaElettronicaBody>
</p:FatturaElettronica>`;

const METADATI = `<?xml version="1.0"?><ns2:FileMetadati xmlns:ns2="http://www.fatturapa.gov.it/sdi/messaggi/v1.0"><IdentificativoSdI>1</IdentificativoSdI></ns2:FileMetadati>`;

const SEPA = `<?xml version="1.0"?><SubmissionAcceptance><Esito>OK</Esito></SubmissionAcceptance>`;

// La busta firmata, costruita a mano come in fattura-pa.test.js.
function der(tag, ...contenuti) {
  const corpo = contenuti.flatMap((c) => Array.from(c));
  const n = corpo.length;
  const lung = n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : [0x82, n >> 8, n & 0xff];
  return new Uint8Array([tag, ...lung, ...corpo]);
}
const OID_SIGNED = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02];
const OID_DATA = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01];
function busta(contenuto) {
  const encap = der(0x30, OID_DATA, der(0xa0, der(0x04, enc(contenuto))));
  const signedData = der(0x30, [0x02, 0x01, 0x01], der(0x31), encap, der(0x31));
  return der(0x30, OID_SIGNED, der(0xa0, signedData));
}

describe("il lettore delle fatture è uno solo", () => {
  it("l'app usa la stessa copia delle funzioni online", () => {
    expect(dallApp.leggiFatturaPA).toBe(condiviso.leggiFatturaPA);
    expect(dallApp.xmlDaFile).toBe(condiviso.xmlDaFile);
    expect(Object.keys(dallApp).sort()).toEqual(Object.keys(condiviso).sort());
  });
});

describe("gli allegati di una PEC", () => {
  it("i file della busta, anche col numero, sono tecnici", () => {
    for (const n of ["daticert.xml", "daticert_1.xml", "smime.p7s", "smime_5.p7s", "DATICERT.XML"]) {
      expect(classificaAllegato(n, enc("<x/>"))).toBe("tecnico");
    }
  });

  it("un nome che somiglia ma non è quello fissato non è tecnico", () => {
    expect(classificaAllegato("daticert_vecchio.xml", enc(SEPA))).toBe("xml_generico");
    expect(classificaAllegato("smime.p7m", enc(SEPA))).toBe("xml_generico");
    expect(classificaAllegato("mio_smime.p7s")).toBe("normale");
  });

  it("i metadati dello SdI si riconoscono dal nome", () => {
    expect(classificaAllegato("IT00000000001_ab1Cd_MT_001.xml", enc(METADATI))).toBe("metadati_sdi");
  });

  it("la fattura si riconosce dal contenuto, firmata o in chiaro", () => {
    expect(classificaAllegato("IT00000000001_ab1Cd.xml.p7m", busta(FATTURA))).toBe("fattura");
    expect(classificaAllegato("IT00000000001_ab1Cd.xml", enc(FATTURA))).toBe("fattura");
    // Il nome non conta: una fattura con un nome qualunque resta una fattura.
    expect(classificaAllegato("documento.xml", enc(FATTURA))).toBe("fattura");
  });

  it("un XML che non è una fattura è generico, non tecnico", () => {
    expect(classificaAllegato("SubmissionAcceptance.xml", enc(SEPA))).toBe("xml_generico");
    expect(classificaAllegato("distinta.xml.p7m", busta(SEPA))).toBe("xml_generico");
  });

  it("senza contenuto un possibile XML resta da aprire", () => {
    expect(classificaAllegato("IT00000000001_ab1Cd.xml.p7m")).toBe("da_aprire");
  });

  it("il resto è normale, anche un .p7m rovinato", () => {
    expect(classificaAllegato("D030_SEPA_LIST.pdf", enc("%PDF-1.4"))).toBe("normale");
    expect(classificaAllegato("rotto.xml.p7m", new Uint8Array([0x30, 0x82, 0xff]))).toBe("normale");
    expect(classificaAllegato("", undefined)).toBe("normale");
  });

  it("eFatturaPA non lancia mai", () => {
    expect(eFatturaPA(enc(FATTURA))).toBe(true);
    expect(eFatturaPA(enc("non xml"))).toBe(false);
    expect(eFatturaPA(new Uint8Array())).toBe(false);
  });
});

describe("il mittente vero", () => {
  it("inviato da, con la È rovinata", () => {
    expect(mittenteReale(testoBusta())).toBe("borgo58@pec.it");
  });

  it("Per conto di vince, anche dentro le virgolette", () => {
    const t = testoBusta({ mittente: '"Per conto di: sdi01@pec.fatturapa.it" <posta-certificata@pec.aruba.it>' });
    expect(mittenteReale(t)).toBe("sdi01@pec.fatturapa.it");
  });

  it("l'oggetto non può fingere il mittente", () => {
    const finto1 = testoBusta({ oggetto: "Per conto di: evil@esempio.it" });
    expect(mittenteReale(finto1)).toBe("borgo58@pec.it");
    const finto2 = testoBusta({ oggetto: 'x" è stato inviato da "evil@esempio.it' });
    expect(mittenteReale(finto2)).toBe("borgo58@pec.it");
  });

  it("si crede solo alla busta del gestore", () => {
    expect(mittenteReale(testoBusta(), "posta-certificata@pec.aruba.it")).toBe("borgo58@pec.it");
    expect(mittenteReale(testoBusta(), "mario@esempio.it")).toBeNull();
  });

  it("parentesi e punteggiatura attorno all'indirizzo se ne vanno", () => {
    expect(mittenteReale(testoBusta({ mittente: '"(Fornitore@pec.esempio.it)."' }))).toBe("fornitore@pec.esempio.it");
  });

  it("solo inglese", () => {
    const t = '-- Certified mail message --\nthe message "x" was sent by "fornitore@pec.esempio.it" and addressed to';
    expect(mittenteReale(t)).toBe("fornitore@pec.esempio.it");
  });

  it("fuori dalla busta PEC non si tocca niente", () => {
    expect(mittenteReale('Ciao, il file è stato inviato da "mario@esempio.it" ieri')).toBeNull();
    expect(mittenteReale(null)).toBeNull();
    expect(eBustaPec(testoBusta())).toBe(true);
    expect(eBustaPec("una mail normale")).toBe(false);
  });

  it("busta senza nessun mittente leggibile", () => {
    expect(mittenteReale("-- Messaggio di posta certificata --\nniente qui")).toBeNull();
  });
});

describe("l'oggetto pulito", () => {
  it("i prefissi ripetuti se ne vanno", () => {
    expect(oggettoPulito("POSTA CERTIFICATA: Fwd: POSTA CERTIFICATA: prova gestionale")).toBe("prova gestionale");
  });

  it("Fw: senza spazio", () => {
    expect(oggettoPulito("POSTA CERTIFICATA: Fw:Invio File 18141078362")).toBe("Invio File 18141078362");
  });

  it("R:, I:, RE:, TR: e maiuscole qualunque", () => {
    expect(oggettoPulito("posta certificata: RE: I: TR: R: fattura")).toBe("fattura");
  });

  it("un oggetto normale resta com'è", () => {
    expect(oggettoPulito("  Fattura n. 12 di ottobre ")).toBe("Fattura n. 12 di ottobre");
    expect(oggettoPulito("Invio: listino")).toBe("Invio: listino");
  });

  it("se non resta niente si tiene l'originale", () => {
    expect(oggettoPulito("POSTA CERTIFICATA:")).toBe("POSTA CERTIFICATA:");
    expect(oggettoPulito(null)).toBe("");
  });
});

describe("le ricevute della PEC", () => {
  const GESTORE = "posta-certificata@pec.aruba.it";

  it("accettazione e consegna dal gestore sono ricevute", () => {
    expect(eRicevutaPec("ACCETTAZIONE: Fattura 12", GESTORE)).toBe(true);
    expect(eRicevutaPec("CONSEGNA: Fattura 12", GESTORE)).toBe(true);
    expect(eRicevutaPec("AVVENUTA CONSEGNA: Fattura 12", GESTORE)).toBe(true);
    expect(eRicevutaPec("PRESA IN CARICO: Fattura 12", GESTORE)).toBe(true);
  });

  it("i problemi di consegna NON sono ricevute da nascondere", () => {
    expect(eRicevutaPec("MANCATA CONSEGNA: Fattura 12", GESTORE)).toBe(false);
    expect(eRicevutaPec("NON ACCETTAZIONE: Fattura 12", GESTORE)).toBe(false);
    expect(eRicevutaPec("AVVISO DI MANCATA CONSEGNA: Fattura 12", GESTORE)).toBe(false);
  });

  it("una mail normale con «Consegna:» non sparisce", () => {
    expect(eRicevutaPec("Consegna: ordine 5", "corriere@esempio.it")).toBe(false);
    expect(eRicevutaPec("CONSEGNA: Fattura 12", null)).toBe(false);
  });

  it("una PEC normale o inoltrata non è una ricevuta", () => {
    expect(eRicevutaPec("POSTA CERTIFICATA: Invio File 18141078362", GESTORE)).toBe(false);
    expect(eRicevutaPec("Fwd: CONSEGNA: Fattura 12", GESTORE)).toBe(false);
    expect(eRicevutaPec(undefined, GESTORE)).toBe(false);
  });
});

describe("il nome della casella", () => {
  it("la PEC si mostra per intero", () => {
    expect(etichettaCasella("pec@prova-finta.resend.app")).toBe("borgo58@pec.it");
    expect(etichettaCasella("PEC@prova-finta.resend.app")).toBe("borgo58@pec.it");
  });

  it("le altre caselle tecniche mostrano solo il nome", () => {
    expect(etichettaCasella("info@prova-finta.resend.app")).toBe("info@");
    expect(etichettaCasella("amministrazione@prova-finta.resend.app")).toBe("amministrazione@");
  });

  it("un indirizzo vero o strano resta com'è", () => {
    expect(etichettaCasella("info@borgo58.it")).toBe("info@borgo58.it");
    expect(etichettaCasella("sconosciuta")).toBe("sconosciuta");
    expect(etichettaCasella("constructor@prova-finta.resend.app")).toBe("constructor@");
    expect(etichettaCasella(null)).toBe("");
  });
});
