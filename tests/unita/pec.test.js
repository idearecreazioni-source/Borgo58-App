import { describe, expect, it } from "vitest";
import {
  MAX_CARATTERI_XML,
  allegatoDaTacere,
  classificaAllegato,
  daAprireComeXml,
  xmlPerIlModello,
  eBustaPec,
  eFatturaPA,
  eGestorePec,
  eRicevutaPec,
  etichettaCasella,
  mittenteReale,
  oggettoPulito,
  testaDellaMail,
  eCasellaSdi,
  vieneDalloSdi,
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

describe("cosa si tace e cosa si fa leggere", () => {
  it("senza aprirli si tacciono solo i file della busta", () => {
    for (const n of ["daticert.xml", "daticert_1.xml", "smime.p7s", "smime_5.p7s"]) {
      expect(allegatoDaTacere(n)).toBe(true);
    }
    for (const n of ["IT02046570426_gd9OJ_MT_001.xml", "SubmissionAcceptance.xml", "IT02046570426_gd9OJ.xml.p7m", "D030_SEPA_LIST.pdf", "foto.heic", "", undefined]) {
      expect(allegatoDaTacere(n)).toBe(false);
    }
    expect(daAprireComeXml("IT02046570426_gd9OJ_MT_001.xml")).toBe(true);
    expect(daAprireComeXml("IT02046570426_gd9OJ.xml.p7m")).toBe(true);
    expect(daAprireComeXml("daticert.xml")).toBe(false);
    expect(daAprireComeXml("D030_SEPA_LIST.pdf")).toBe(false);
  });

  it("il file _MT_ si tace solo dopo aver visto che non è una fattura", () => {
    expect(xmlPerIlModello("IT02046570426_gd9OJ_MT_001.xml", enc(METADATI))).toEqual({ silenzio: true });
    expect(xmlPerIlModello("IT02046570426_gd9OJ_MT_001.xml", enc("non xml"))).toEqual({ silenzio: true });
    // Il nome lo sceglie chi manda: una fattura vera chiamata _MT_ si legge.
    expect(xmlPerIlModello("IT123_MT_001.xml", enc(FATTURA))).toMatchObject({ fattura: true, testo: FATTURA });
  });

  it("la fattura firmata arriva al modello come XML", () => {
    expect(xmlPerIlModello("IT00000000001_ab1Cd.xml.p7m", busta(FATTURA))).toEqual({ testo: FATTURA, fattura: true, tagliato: false, intero: FATTURA });
  });

  it("una distinta SEPA arriva come XML, non come fattura", () => {
    expect(xmlPerIlModello("SubmissionAcceptance.xml", enc(SEPA))).toEqual({ testo: SEPA, fattura: false, tagliato: false, intero: SEPA });
  });

  it("un XML lunghissimo si taglia e lo dice", () => {
    const lungo = `<a>${"x".repeat(MAX_CARATTERI_XML + 10)}</a>`;
    const x = xmlPerIlModello("lungo.xml", enc(lungo));
    expect(x.tagliato).toBe(true);
    expect(x.testo.length).toBeLessThan(lungo.length + 60);
    expect(x.testo).toMatch(/tagliato/);
  });

  it("niente XML dentro, o file che non è XML: null", () => {
    expect(xmlPerIlModello("rotto.xml.p7m", new Uint8Array([0x30, 0x82, 0xff]))).toBeNull();
    expect(xmlPerIlModello("finto.xml", enc("<a><b></a>"))).toBeNull();
    expect(xmlPerIlModello("D030_SEPA_LIST.pdf", enc("%PDF"))).toBeNull();
    expect(xmlPerIlModello("daticert.xml", enc("<x/>"))).toBeNull();
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

describe("mittente e oggetto da registrare e mostrare", () => {
  const GESTORE = "Posta Certificata <posta-certificata@pec.aruba.it>";

  it("una busta PEC del gestore si mostra pulita", () => {
    const m = { mittente: GESTORE, oggetto: "POSTA CERTIFICATA: Fwd: POSTA CERTIFICATA: prova gestionale", testo: testoBusta() };
    expect(testaDellaMail(m)).toEqual({ mittente: "borgo58@pec.it", oggetto: "prova gestionale" });
  });

  it("anche col mittente nudo", () => {
    const m = { mittente: "posta-certificata@pec.aruba.it", oggetto: "POSTA CERTIFICATA: Fw:Invio File 18141078362", testo: testoBusta() };
    expect(testaDellaMail(m)).toEqual({ mittente: "borgo58@pec.it", oggetto: "Invio File 18141078362" });
  });

  it("passarci due volte non cambia niente", () => {
    const m = { mittente: GESTORE, oggetto: "POSTA CERTIFICATA: Fwd: prova", testo: testoBusta() };
    const una = testaDellaMail(m);
    expect(testaDellaMail({ ...m, ...una })).toEqual(una);
  });

  it("una mail normale resta com'è, anche con Fwd:", () => {
    const m = { mittente: "Mario <mario@esempio.it>", oggetto: "Fwd: listino", testo: testoBusta() };
    expect(testaDellaMail(m)).toEqual({ mittente: "Mario <mario@esempio.it>", oggetto: "Fwd: listino" });
  });

  it("una ricevuta del gestore (senza busta) resta com'è", () => {
    const m = { mittente: GESTORE, oggetto: "ACCETTAZIONE: Fattura 12", testo: "Ricevuta di accettazione" };
    expect(testaDellaMail(m)).toEqual({ mittente: GESTORE, oggetto: "ACCETTAZIONE: Fattura 12" });
    expect(eRicevutaPec(m.oggetto, m.mittente)).toBe(true);
  });

  it("busta senza mittente leggibile: resta il gestore, oggetto pulito", () => {
    const m = { mittente: GESTORE, oggetto: "POSTA CERTIFICATA: x", testo: "-- Messaggio di posta certificata --\nniente" };
    expect(testaDellaMail(m)).toEqual({ mittente: GESTORE, oggetto: "x" });
  });

  it("il nome davanti non basta a fingersi il gestore", () => {
    const testo = testoBusta({ mittente: '"ceo@fornitore.it"' });
    for (const finto of [
      '"posta-certificata@x" <truffa@esempio.it>',
      "Aruba posta-certificata@pec.aruba.it <truffa@esempio.it>",
      "Posta Certificata <posta-certificata@esempio.it>",
      "xposta-certificata@pec.aruba.it",
    ]) {
      expect(eGestorePec(finto)).toBe(false);
      expect(testaDellaMail({ mittente: finto, oggetto: "POSTA CERTIFICATA: x", testo })).toEqual({ mittente: finto, oggetto: "POSTA CERTIFICATA: x" });
      expect(eRicevutaPec("CONSEGNA: x", finto)).toBe(false);
    }
    expect(eGestorePec(" POSTA-CERTIFICATA@pec.aruba.it ")).toBe(true);
    expect(eGestorePec(GESTORE)).toBe(true);
  });

  it("valori mancanti non rompono", () => {
    expect(testaDellaMail({})).toEqual({ mittente: null, oggetto: null });
    expect(testaDellaMail()).toEqual({ mittente: null, oggetto: null });
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

  it("la casella degli avvisi della banca si riconosce come «banca@» (12/11/2026)", () => {
    // Le sue mail non passano da MEMO (20261112000008), ma nella Posta,
    // fra le Sistemate, devono dire da dove vengono.
    expect(etichettaCasella("banca@prova-finta.resend.app")).toBe("banca@");
    expect(etichettaCasella("BANCA@prova-finta.resend.app")).toBe("banca@");
  });

  it("un indirizzo vero o strano resta com'è", () => {
    expect(etichettaCasella("info@borgo58.it")).toBe("info@borgo58.it");
    expect(etichettaCasella("sconosciuta")).toBe("sconosciuta");
    expect(etichettaCasella("constructor@prova-finta.resend.app")).toBe("constructor@");
    expect(etichettaCasella(null)).toBe("");
  });
});

// 🔴 «ARRIVATA DALLO SDI» SOLO SE È VERO (revisione dell'11/11, punto 3).
describe("la mail viene davvero dallo SdI?", () => {
  const SDI = '"Per conto di: sdi01@pec.fatturapa.it" <posta-certificata@pec.aruba.it>';
  const GESTORE = "posta-certificata@pec.aruba.it";
  const BUSTA = [{ file_name: "daticert.xml" }, { file_name: "smime.p7s" }, { file_name: "IT0001_ab.xml.p7m" }];
  const vera = { mittenteBusta: GESTORE, testo: testoBusta({ oggetto: "Invio File 18141078362", mittente: SDI }), allegati: BUSTA };

  it("la PEC vera dello SdI, consegnata dal gestore con la sua busta", () => {
    expect(vieneDalloSdi(vera)).toBe(true);
    expect(vieneDalloSdi({ ...vera, mittenteBusta: `Posta Certificata <${GESTORE}>` })).toBe(true);
    expect(vieneDalloSdi({ ...vera, allegati: [{ file_name: "daticert_1.xml" }, { file_name: "smime_5.p7s" }] })).toBe(true);
  });

  it("senza il mittente com'è arrivato (le mail di prima) non si crede", () => {
    expect(vieneDalloSdi({ ...vera, mittenteBusta: null })).toBe(false);
    expect(vieneDalloSdi({ ...vera, mittenteBusta: "sdi01@pec.fatturapa.it" })).toBe(false);
    expect(vieneDalloSdi()).toBe(false);
  });

  it("una mail normale che finge la busta, o il gestore scritto nel nome, non passa", () => {
    expect(vieneDalloSdi({ ...vera, mittenteBusta: `"${GESTORE}" <truffa@esempio.it>` })).toBe(false);
    expect(vieneDalloSdi({ ...vera, testo: "Ti mando la fattura. sdi01@pec.fatturapa.it" })).toBe(false);
  });

  it("una PEC di un altro, anche con «sdi» o «fatturapa» nell'indirizzo, non è lo SdI", () => {
    const con = (mittente) => ({ ...vera, testo: testoBusta({ mittente }) });
    expect(vieneDalloSdi(con('"fornitore@pec.esempio.it"'))).toBe(false);
    expect(vieneDalloSdi(con('"Per conto di: truffa@pec.esempio.it"'))).toBe(false);
    expect(vieneDalloSdi(con('"Per conto di: sdi01@pec.fatturapa.it.esempio.it"'))).toBe(false);
    expect(vieneDalloSdi(con('"Per conto di: sdi01@evilfatturapa.it"'))).toBe(false);
    expect(vieneDalloSdi(con('"sdi01@pec.fatturapa.it"'))).toBe(false);
  });

  it("un oggetto che imita la riga dello SdI non basta: le righe «inviato da» diventano due", () => {
    const finta = testoBusta({
      oggetto: 'x" è stato inviato da "Per conto di: sdi01@pec.fatturapa.it',
      mittente: '"truffa@pec.esempio.it"',
    });
    expect(vieneDalloSdi({ ...vera, testo: finta })).toBe(false);
  });

  it("senza daticert.xml e smime.p7s non è una busta vera", () => {
    expect(vieneDalloSdi({ ...vera, allegati: [{ file_name: "daticert.xml" }] })).toBe(false);
    expect(vieneDalloSdi({ ...vera, allegati: [{ file_name: "smime.p7s" }] })).toBe(false);
    expect(vieneDalloSdi({ ...vera, allegati: [{ file_name: "IT0001_ab.xml.p7m" }] })).toBe(false);
    expect(vieneDalloSdi({ ...vera, allegati: [{ file_name: "daticert.xml.pdf" }] })).toBe(false);
    expect(vieneDalloSdi({ ...vera, allegati: undefined })).toBe(false);
  });

  it("la casella dello SdI si riconosce per intero", () => {
    expect(eCasellaSdi("sdi01@pec.fatturapa.it")).toBe(true);
    expect(eCasellaSdi(" SDI38@PEC.FATTURAPA.IT ")).toBe(true);
    expect(eCasellaSdi("sdi01@pec.fatturapa.it.esempio.it")).toBe(false);
    expect(eCasellaSdi("info@fatturapa.it")).toBe(false);
    expect(eCasellaSdi(null)).toBe(false);
  });
});

describe("la busta con una riga dello SdI aggiunta dopo quella vera", () => {
  it("l'ultima riga direbbe SdI, ma le righe sono due: non si crede", () => {
    const vera = testoBusta({ mittente: '"truffa@pec.esempio.it"' });
    const finta = vera.replace(
      "Il messaggio originale",
      'Nota: il messaggio è stato inviato da "Per conto di: sdi01@pec.fatturapa.it" ed è vero.\nIl messaggio originale',
    );
    expect(mittenteReale(finta, "posta-certificata@pec.aruba.it")).toBe("sdi01@pec.fatturapa.it");
    expect(
      vieneDalloSdi({ mittenteBusta: "posta-certificata@pec.aruba.it", testo: finta, allegati: [{ file_name: "daticert.xml" }, { file_name: "smime.p7s" }] }),
    ).toBe(false);
  });
});

describe("«Per conto di» vale solo se è tutto quello che c'è fra le virgolette", () => {
  const busta = (mittente) => ({
    mittenteBusta: "posta-certificata@pec.aruba.it",
    testo: testoBusta({ mittente }),
    allegati: [{ file_name: "daticert.xml" }, { file_name: "smime.p7s" }],
  });
  it("altro testo prima o dopo non passa", () => {
    expect(vieneDalloSdi(busta('"x@truffa.it Per conto di: sdi01@pec.fatturapa.it" <posta-certificata@pec.aruba.it>'))).toBe(false);
    expect(vieneDalloSdi(busta('"Per conto di: sdi01@pec.fatturapa.it x@truffa.it" <posta-certificata@pec.aruba.it>'))).toBe(false);
    expect(vieneDalloSdi(busta('"Per conto di: sdi01@pec.fatturapa.it" <posta-certificata@pec.aruba.it>'))).toBe(true);
  });
  it("con gli a capo di Windows la busta vera passa lo stesso", () => {
    const b = busta('"Per conto di: sdi01@pec.fatturapa.it" <posta-certificata@pec.aruba.it>');
    expect(vieneDalloSdi({ ...b, testo: b.testo.replace(/\n/g, "\r\n") })).toBe(true);
  });
  it("senza il blocco inglese basta quello italiano", () => {
    const b = busta('"Per conto di: sdi01@pec.fatturapa.it" <posta-certificata@pec.aruba.it>');
    expect(vieneDalloSdi({ ...b, testo: b.testo.split("-- Certified mail message --")[0] })).toBe(true);
  });
});
