import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { ibanDellaFattura, proposteDaFattura } from "../../supabase/functions/_shared/pec.js";
import { CAMPI_AZIONE, etichettaConferma, etichettaRifiuto } from "../../src/lib/calcoli/posta";

// LA FATTURA DALLA PEC DIVENTA UNA PROPOSTA (08/11/2026).
//
// ⚠️ Fatture COSTRUITE: il repository è pubblico. La forma è quella FPR12
// che il lettore conosce già (vedi fattura-pa.test.js).

function fattura({ tipo = "TD01", numero = "330/F", totale = "460.00", corpi = 1, scadenza = "2026-09-30", iban = null } = {}) {
  const corpo = `
  <FatturaElettronicaBody xmlns="">
    <DatiGenerali><DatiGeneraliDocumento>
      <TipoDocumento>${tipo}</TipoDocumento><Divisa>EUR</Divisa>
      <Data>2026-08-31</Data>
      ${numero ? `<Numero>${numero}</Numero>` : ""}
      <ImportoTotaleDocumento>${totale}</ImportoTotaleDocumento>
    </DatiGeneraliDocumento></DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee><NumeroLinea>1</NumeroLinea><Descrizione>Prestazione di prova</Descrizione>
        <PrezzoTotale>${totale}</PrezzoTotale><AliquotaIVA>0.00</AliquotaIVA><Natura>N1</Natura></DettaglioLinee>
      <DatiRiepilogo><AliquotaIVA>0.00</AliquotaIVA><Natura>N1</Natura><ImponibileImporto>${totale}</ImponibileImporto><Imposta>0.00</Imposta></DatiRiepilogo>
    </DatiBeniServizi>
    <DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><DataScadenzaPagamento>${scadenza}</DataScadenzaPagamento><ImportoPagamento>${totale}</ImportoPagamento>${iban ? `<IBAN>${iban}</IBAN>` : ""}</DettaglioPagamento></DatiPagamento>
  </FatturaElettronicaBody>`;
  return `<?xml version="1.0" encoding="utf-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader xmlns="">
    <CedentePrestatore><DatiAnagrafici>
      <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000001</IdCodice></IdFiscaleIVA>
      <Anagrafica><Denominazione>Studio di prova</Denominazione></Anagrafica>
    </DatiAnagrafici></CedentePrestatore>
    <CessionarioCommittente><DatiAnagrafici>
      <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000002</IdCodice></IdFiscaleIVA>
      <Anagrafica><Denominazione>Cliente di prova</Denominazione></Anagrafica>
    </DatiAnagrafici></CessionarioCommittente>
  </FatturaElettronicaHeader>${corpo.repeat(corpi)}
</p:FatturaElettronica>`;
}

const NOME = "IT00000000001_ab1Cd.xml.p7m";
// La mail viene davvero dallo SdI (lo decide `vieneDalloSdi`, provata in pec.test.js).
const SDI = { dalloSdi: true, mittente: "sdi01@pec.fatturapa.it" };

describe("la fattura dalla PEC diventa una proposta", () => {
  it("una fattura registrabile: «Registra la fattura» con i dati pronti", () => {
    const [p, ...altre] = proposteDaFattura(NOME, fattura(), null, SDI);
    expect(altre).toEqual([]);
    expect(p.tipo).toBe("registra_fattura");
    expect(p.titolo).toBe("Registra la fattura n. 330/F di Studio di prova (460,00 €)");
    expect(p.descrizione).toMatch(/del 31\/08\/2026, totale 460,00 €, da pagare entro il 30\/09\/2026\. Va su Borgo 58\./);
    expect(p.parametri.file_sdi).toBe(NOME);
    expect(p.parametri.fattura).toMatchObject({
      tipo: "TD01", numero: "330/F", data: "2026-08-31", totale: 460, file_sdi: NOME,
      fornitore: { denominazione: "Studio di prova", partita_iva: "IT00000000001" },
      cliente: { partita_iva: "IT00000000002" },
    });
  });

  it("già registrata: nessun bottone, dice quando", () => {
    const [p] = proposteDaFattura(NOME, fattura(), { invoice_number: "330/F", invoice_date: "2026-08-31", created_at: "2026-09-02T10:00:00Z" });
    expect(p.tipo).toBe("nessuna");
    expect(p.titolo).toBe("La fattura n. 330/F di Studio di prova è già registrata");
    expect(p.descrizione).toBe("Registrata il 02/09/2026 (n. 330/F del 31/08/2026): non c'è niente da rifare.");
  });

  it("una nota di credito non si registra da sola: va fatta a mano, col motivo", () => {
    const [p] = proposteDaFattura(NOME, fattura({ tipo: "TD04" }));
    expect(p.tipo).toBe("da_fare_a_mano");
    expect(p.descrizione).toMatch(/nota di credito/);
    expect(p.parametri.passi.length).toBeGreaterThan(0);
  });

  it("un lotto di più fatture si registra dall'import, una per una", () => {
    const [p] = proposteDaFattura(NOME, fattura({ corpi: 2 }));
    expect(p.tipo).toBe("da_fare_a_mano");
    expect(p.titolo).toBe(`Registra le 2 fatture del file ${NOME}`);
  });

  it("un XML che non è una fattura non propone niente", () => {
    expect(proposteDaFattura("SubmissionAcceptance.xml", "<SubmissionAcceptance/>")).toEqual([]);
    expect(proposteDaFattura("rotto.xml", "non xml")).toEqual([]);
  });
});

describe("la Posta sa dire la proposta nuova", () => {
  it("i pulsanti nominano la fattura", () => {
    const az = { tipo: "registra_fattura", parametri: { fattura: { numero: "330/F" } } };
    expect(etichettaConferma(az, az.parametri)).toBe("Registra la fattura n. 330/F");
    expect(etichettaConferma({ tipo: "registra_fattura" }, {})).toBe("Registra la fattura");
    expect(etichettaRifiuto(az)).toBe("Non registrarla");
  });

  it("i dati della fattura non si correggono a mano", () => {
    expect(CAMPI_AZIONE.registra_fattura).toEqual([]);
  });
});

// 🔴 08/11/2026, prima PEC vera dopo il rilascio: posta-leggi leggeva
// `supplier_invoices` con la chiave di servizio e riceveva 403, perché quel
// ruolo non può leggere le tabelle dei soldi (20260812000003). Nessuna prova
// parla al database come la chiave di servizio: questa guarda il codice.
describe("posta-leggi non legge le fatture con la chiave di servizio", () => {
  const codice = readFileSync("supabase/functions/posta-leggi/index.ts", "utf8").replace(
    /\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    "",
  );
  const migrazioni = readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8").replace(/--[^\n]*/g, ""))
    .join("\n");

  it("non chiede supplier_invoices alla REST", () => {
    expect(codice).not.toMatch(/db\(\s*[`"']supplier_invoices/);
  });

  it("chiede alla funzione fatta per lei, e la funzione è aperta solo al servizio", () => {
    expect(codice).toContain('db("rpc/fattura_gia_registrata_per_la_posta"');
    expect(migrazioni).toMatch(
      /grant execute on function fattura_gia_registrata_per_la_posta\(text\[\]\) to service_role;/,
    );
    expect(migrazioni).not.toMatch(/grant [^;]*select[^;]* on (table )?supplier_invoices to service_role/i);
  });
});

// 🔴 «ARRIVATA DALLO SDI» ANCHE SE L'AVEVA MANDATA CHIUNQUE (revisione
//    dell'11/11, punto 3): un truffatore scrive in un file-fattura il nome
//    di un fornitore vero e il proprio IBAN, e compariva «Registra la
//    fattura», con scritto che veniva dallo SdI.
describe("la fattura che NON viene dallo SdI", () => {
  const FALSO = { dalloSdi: false, mittente: "truffa@esempio.it", ibanNuovi: [] };

  it("niente pulsante «Registra»: da fare a mano, con «mittente NON verificato» e chi l'ha mandata", () => {
    const [p, ...altre] = proposteDaFattura(NOME, fattura(), null, FALSO);
    expect(altre).toEqual([]);
    expect(p.tipo).toBe("da_fare_a_mano");
    expect(p.titolo).toMatch(/^Mittente NON verificato: controlla la fattura n\. 330\/F di Studio di prova/);
    expect(p.descrizione).toMatch(/Non arriva dallo SdI: l'ha mandata truffa@esempio\.it\./);
    expect(p.perche).toMatch(/Mittente NON verificato/);
    expect(p.perche).not.toMatch(/arrivata dallo SdI/);
    expect(p.parametri.fattura).toBeUndefined();
    expect(p.parametri.mittente_verificato).toBe(false);
    expect(p.parametri.passi.join(" ")).toMatch(/Importa fattura elettronica/);
  });

  it("senza dire da dove viene, non si crede: è il caso sicuro", () => {
    expect(proposteDaFattura(NOME, fattura())[0].tipo).toBe("da_fare_a_mano");
    expect(proposteDaFattura(NOME, fattura(), null, { dalloSdi: "sì" })[0].tipo).toBe("da_fare_a_mano");
  });

  it("già registrata: non si dice che viene dallo SdI se non è vero", () => {
    const gia = { invoice_number: "330/F", invoice_date: "2026-08-31", created_at: "2026-09-02T10:00:00Z" };
    expect(proposteDaFattura(NOME, fattura(), gia, FALSO)[0].perche).toMatch(/Mittente NON verificato/);
    expect(proposteDaFattura(NOME, fattura(), gia, SDI)[0].perche).toMatch(/arrivata dallo SdI/);
  });
});

describe("l'IBAN nuovo si dice", () => {
  const AVVISO = "IBAN nuovo per questo fornitore (IT02L1234512345123456789012): controllalo col fornitore prima di pagare.";

  it("dallo SdI: il pulsante resta, con l'avviso dentro", () => {
    const [p] = proposteDaFattura(NOME, fattura({ iban: "IT02L1234512345123456789012" }), null, {
      ...SDI,
      ibanNuovi: ["it02 l123 4512 3451 2345 6789 012"],
    });
    expect(p.tipo).toBe("registra_fattura");
    expect(p.descrizione).toContain(AVVISO);
    expect(p.parametri.avvisi).toContain(AVVISO);
    expect(p.parametri.iban_nuovi).toEqual(["IT02L1234512345123456789012"]);
  });

  it("da un mittente non verificato: l'IBAN nuovo è il primo passo da fare", () => {
    const [p] = proposteDaFattura(NOME, fattura(), null, {
      dalloSdi: false, mittente: "x@esempio.it", ibanNuovi: ["IT02L1234512345123456789012"],
    });
    expect(p.parametri.passi[0]).toBe(AVVISO);
    expect(p.descrizione).toContain(AVVISO);
  });

  it("un IBAN già noto non fa rumore", () => {
    const [p] = proposteDaFattura(NOME, fattura({ iban: "IT60X0542811101000000123456" }), null, { ...SDI, ibanNuovi: [] });
    expect(p.descrizione).not.toMatch(/IBAN nuovo/);
  });

  it("dal file si leggono partita IVA e IBAN, una volta sola e scritti uguali", () => {
    expect(ibanDellaFattura(fattura({ iban: "it60 x054 2811 1010 0000 0123 456" }))).toEqual({
      partitaIva: "IT00000000001",
      iban: ["IT60X0542811101000000123456"],
    });
    expect(ibanDellaFattura(fattura())).toEqual({ partitaIva: "IT00000000001", iban: [] });
    // Un lotto si registra dall'import: qui non si chiede niente.
    expect(ibanDellaFattura(fattura({ corpi: 2 }))).toBeNull();
    expect(ibanDellaFattura("non xml")).toBeNull();
  });
});

// 🔴 IL MODELLO CARO SOLO PER CHI CONOSCIAMO (revisione dell'11/11, punto 1):
//    bastava allegare un file-fattura a una mail per farla leggere al
//    modello caro. Nessuna prova chiama la funzione online: si guarda il codice.
describe("posta-leggi: chi conosciamo, e l'IBAN chiesto senza leggere le fatture", () => {
  const codice = readFileSync("supabase/functions/posta-leggi/index.ts", "utf8").replace(
    /\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    "",
  );
  const arrivo = readFileSync("supabase/functions/posta-in-arrivo/index.ts", "utf8");
  const migrazioni = readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8").replace(/--[^\n]*/g, ""))
    .join("\n");

  it("una fattura allegata non basta più per il modello caro", () => {
    expect(codice).not.toMatch(/conosciuto\s*=\s*fattureLette\.length/);
    expect(codice).toMatch(/let conosciuto = dalloSdi;/);
    expect(codice).toMatch(/vieneDalloSdi\(\{ mittenteBusta: m\.mittente_busta/);
  });

  it("il mittente com'è arrivato si scrive all'arrivo e si legge nella lettura", () => {
    expect(arrivo).toMatch(/mittente_busta:/);
    expect(codice).toMatch(/select=id,mittente,mittente_busta,/);
    expect(migrazioni).toMatch(/alter table posta_ricevuta add column if not exists mittente_busta text;/);
  });

  it("l'IBAN nuovo si chiede alla funzione fatta per questo, aperta solo al servizio", () => {
    expect(codice).toContain('db("rpc/iban_nuovi_per_la_posta"');
    expect(migrazioni).toMatch(/grant execute on function iban_nuovi_per_la_posta\(text, text\[\]\) to service_role;/);
    expect(migrazioni).not.toMatch(/grant execute on function iban_nuovi_per_la_posta\(text, text\[\]\) to (anon|authenticated)/);
  });
});
