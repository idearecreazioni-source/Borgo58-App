import { describe, expect, it } from "vitest";
import { proposteDaFattura } from "../../supabase/functions/_shared/pec.js";
import { CAMPI_AZIONE, etichettaConferma, etichettaRifiuto } from "../../src/lib/calcoli/posta";

// LA FATTURA DALLA PEC DIVENTA UNA PROPOSTA (08/11/2026).
//
// ⚠️ Fatture COSTRUITE: il repository è pubblico. La forma è quella FPR12
// che il lettore conosce già (vedi fattura-pa.test.js).

function fattura({ tipo = "TD01", numero = "330/F", totale = "460.00", corpi = 1, scadenza = "2026-09-30" } = {}) {
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
    <DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><DataScadenzaPagamento>${scadenza}</DataScadenzaPagamento><ImportoPagamento>${totale}</ImportoPagamento></DettaglioPagamento></DatiPagamento>
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

describe("la fattura dalla PEC diventa una proposta", () => {
  it("una fattura registrabile: «Registra la fattura» con i dati pronti", () => {
    const [p, ...altre] = proposteDaFattura(NOME, fattura());
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
