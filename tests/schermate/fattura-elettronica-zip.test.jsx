import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// REVISIONE DELL'11/11/2026, punto 13: una fattura rovinata dentro uno zip non è «un file che non è una fattura».
// Lo zip dello scarico porta fatture e file dei metadati del portale (_MT_): SOLO i metadati si tacciono (e si contano);
// una fattura che non si legge compare come riga d'errore con il suo motivo, perché è una fattura che non entra e
// bisogna saperlo. Fatture e nomi INVENTATI (il repository è pubblico).

const api = vi.hoisted(() => ({ registra: vi.fn(), allega: vi.fn(), voci: [] }));

// ⚠️ jsdom non ha i flussi di decompressione: il lettore dello zip si finge, con le voci che il test decide (il lettore vero
//    lo prova tests/unita/zip.test.js).
vi.mock("../../src/lib/calcoli/zip", () => ({
  eZip: () => true,
  leggiZip: async () => api.voci.map((v) => ({ nome: v.nome, contenuto: new TextEncoder().encode(v.testo) })),
}));

vi.mock("../../src/lib/api/banca", () => ({
  registraFatturaElettronica: (...a) => api.registra(...a),
}));
vi.mock("../../src/lib/api/fatturaXml", () => ({
  allegaXmlPerFile: (...a) => api.allega(...a),
}));
vi.mock("../../src/lib/api/entities", () => ({
  getEntities: () => Promise.resolve({ srls: { id: "e1", name: "Società di prova" }, agricola: null }),
}));

import Pagina from "../../src/pages/fatture/ImportaFatturaElettronica";

const XML = `<?xml version="1.0" encoding="utf-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader xmlns="">
    <CedentePrestatore><DatiAnagrafici>
      <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000001</IdCodice></IdFiscaleIVA>
      <Anagrafica><Denominazione>Fornitore di prova srl</Denominazione></Anagrafica>
    </DatiAnagrafici></CedentePrestatore>
    <CessionarioCommittente><DatiAnagrafici>
      <IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000002</IdCodice></IdFiscaleIVA>
      <Anagrafica><Denominazione>Cliente di prova</Denominazione></Anagrafica>
    </DatiAnagrafici></CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody xmlns="">
    <DatiGenerali><DatiGeneraliDocumento>
      <TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>2026-10-09</Data><Numero>12/26</Numero>
      <ImportoTotaleDocumento>122.00</ImportoTotaleDocumento>
    </DatiGeneraliDocumento></DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee><NumeroLinea>1</NumeroLinea><Descrizione>Pomodori di prova</Descrizione>
        <PrezzoTotale>100.00</PrezzoTotale><AliquotaIVA>22.00</AliquotaIVA></DettaglioLinee>
      <DatiRiepilogo><AliquotaIVA>22.00</AliquotaIVA><ImponibileImporto>100.00</ImponibileImporto><Imposta>22.00</Imposta></DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

const METADATI = `<?xml version="1.0"?><ns2:FileMetadati xmlns:ns2="http://www.fatturapa.gov.it/sdi/messaggi/v1.0"><IdentificativoSdI>1</IdentificativoSdI><NomeFile>IT00000000001_ab1Cd.xml</NomeFile></ns2:FileMetadati>`;



function apri() {
  return render(
    <MemoryRouter>
      <Pagina />
    </MemoryRouter>,
  );
}

function scegliLoZip(voci) {
  const casella = document.querySelector('input[type="file"]');
  api.voci = voci;
  const bytes = new TextEncoder().encode("PK-finto");
  const file = new File([bytes], "scarico-di-prova.zip", { type: "application/zip" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer.slice(0) });
  Object.defineProperty(casella, "files", { value: [file], configurable: true });
  fireEvent.change(casella);
}

beforeEach(() => {
  api.registra.mockReset().mockResolvedValue({ fattura_id: "f1", fornitore_nuovo: false });
  api.allega.mockReset().mockResolvedValue("salvato");
});

describe("uno zip con fatture e metadati", () => {
  it("🔴 la fattura rovinata si MOSTRA con il suo motivo; i metadati si tacciono e si contano; la fattura buona entra", async () => {
    apri();
    scegliLoZip([
      { nome: "IT00000000001_00001.xml", testo: XML },
      { nome: "IT00000000001_00002.xml", testo: XML.slice(0, 400) },
      { nome: "IT00000000001_00001_MT_001.xml", testo: METADATI },
    ]);
    // La fattura buona si può registrare.
    expect(await screen.findByRole("button", { name: "Registra la fattura" })).toBeTruthy();
    // La rovinata compare con il suo nome e un motivo, non sparisce.
    expect(await screen.findByText(/IT00000000001_00002.xml/)).toBeTruthy();
    expect(screen.getAllByText(/non è una fattura elettronica|incompleta/i).length).toBeGreaterThan(0);
    // I metadati sono contati, una sola volta, e detti per quello che sono.
    expect(screen.getByText(/Un file dell'archivio non è una fattura/)).toBeTruthy();
    expect(screen.getByText(/metadati del portale/)).toBeTruthy();
  });

  it("uno zip con SOLI metadati: nessun errore, solo il conto dei file lasciati stare", async () => {
    apri();
    scegliLoZip([{ nome: "IT00000000001_00001_MT_001.xml", testo: METADATI }]);
    expect(await screen.findByText(/Un file dell'archivio non è una fattura/)).toBeTruthy();
    expect(screen.queryByText(/incompleta|non è una fattura elettronica/i)).toBeNull();
  });
});
