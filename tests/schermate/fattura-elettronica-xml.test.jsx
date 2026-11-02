import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// IL FILE XML RESTA ATTACCATO ALLA FATTURA (01/11/2026), visto dalla pagina
// dell'import. Fattura INVENTATA (il repository è pubblico).

const api = vi.hoisted(() => ({ registra: vi.fn(), allega: vi.fn() }));

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

function apri() {
  return render(
    <MemoryRouter>
      <Pagina />
    </MemoryRouter>,
  );
}

async function scegli() {
  const casella = document.querySelector('input[type="file"]');
  const bytes = new TextEncoder().encode(XML);
  const file = new File([bytes], "IT01_00001.xml", { type: "text/xml" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer.slice(0) });
  Object.defineProperty(casella, "files", { value: [file], configurable: true });
  fireEvent.change(casella);
  return screen.findByRole("button", { name: "Registra la fattura" });
}

beforeEach(() => {
  api.registra.mockReset().mockResolvedValue({ fattura_id: "f1", fornitore_nuovo: false });
  api.allega.mockReset().mockResolvedValue("salvato");
});

describe("l'import allega l'xml alla fattura", () => {
  it("🔴 registrata la fattura, il file XML viene collegato e la pagina lo dice", async () => {
    apri();
    fireEvent.click(await scegli());
    expect(await screen.findByText(/Il file XML è collegato alla fattura/)).toBeTruthy();
    const dati = api.allega.mock.calls[0][0];
    expect(dati).toMatchObject({ entityId: "e1", nomeFile: "IT01_00001.xml" });
    expect(dati.xml).toContain("<p:FatturaElettronica");
    expect(dati.fattura.numero).toBe("12/26");
  });

  it("🔴 se il salvataggio del file cade, la fattura RESTA registrata e la pagina dice che il file manca", async () => {
    api.allega.mockRejectedValueOnce(new Error("deposito non raggiungibile"));
    apri();
    fireEvent.click(await scegli());
    expect(await screen.findByText(/il file XML NON è stato salvato \(deposito non raggiungibile\)/i)).toBeTruthy();
    expect(api.registra).toHaveBeenCalledTimes(1);
    // niente "Registra la fattura" di nuovo: sarebbe un doppione
    expect(screen.queryByRole("button", { name: "Registra la fattura" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Salva il file XML" }));
    expect(await screen.findByText(/Il file XML è collegato alla fattura/)).toBeTruthy();
    expect(api.registra).toHaveBeenCalledTimes(1);
    expect(api.allega).toHaveBeenCalledTimes(2);
  });

  it("🔴 una fattura già registrata senza il suo xml: il pulsante lo attacca, senza registrare di nuovo", async () => {
    api.registra.mockRejectedValue(new Error("Questa fattura è già stata registrata"));
    apri();
    fireEvent.click(await scegli());
    const salva = await screen.findByRole("button", { name: "Salva il file XML" });
    expect(screen.queryByRole("button", { name: "Registra la fattura" })).toBeNull();
    fireEvent.click(salva);
    expect(await screen.findByText(/Era già registrata\. Il file XML è collegato/)).toBeTruthy();
    expect(api.registra).toHaveBeenCalledTimes(1);
  });

  it("se anche il riprovo cade, lo dice accanto alla riga", async () => {
    api.registra.mockRejectedValue(new Error("Questa fattura è già stata registrata"));
    api.allega.mockRejectedValue(new Error("Non trovo la fattura registrata da questo file"));
    apri();
    fireEvent.click(await scegli());
    fireEvent.click(await screen.findByRole("button", { name: "Salva il file XML" }));
    expect(await screen.findByText(/Il file XML non è stato salvato: Non trovo la fattura/)).toBeTruthy();
  });

  it("🔴 se la fattura trovata è un'altra del lotto, lo dice e il pulsante sparisce", async () => {
    api.registra.mockRejectedValue(new Error("Questa fattura è già stata registrata"));
    const e = new Error("La fattura registrata da questo file ha un altro numero o un'altra data");
    e.nonCorrisponde = true;
    api.allega.mockRejectedValue(e);
    apri();
    fireEvent.click(await scegli());
    fireEvent.click(await screen.findByRole("button", { name: "Salva il file XML" }));
    expect(await screen.findByText(/altro numero o un'altra data/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Salva il file XML" })).toBeNull();
  });
});
