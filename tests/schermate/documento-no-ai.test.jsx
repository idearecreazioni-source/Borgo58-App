import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// «Non far leggere all'AI» dalla scheda del documento (22/11/2026, C2). Collegamento finto, documento inventato.
const finto = vi.hoisted(() => ({ doc: null, rifiuto: null }));
const spie = vi.hoisted(() => ({ cambi: [] }));

vi.mock("../../src/lib/api/documents", () => ({
  deleteDocument: vi.fn(),
  getDocument: vi.fn(async () => finto.doc),
  getDocumentUrl: vi.fn(),
  sezioniArchivio: vi.fn(async () => [{ codice: "contratti", etichetta: "Contratti", attiva: true }]),
  updateDocument: vi.fn(),
}));
vi.mock("../../src/lib/api/assistente", () => ({ leggiContenutoDocumento: vi.fn() }));
vi.mock("../../src/lib/api/importDrive", () => ({
  impostaNoAi: vi.fn(async (id, valore) => {
    spie.cambi.push({ id, valore });
    if (finto.rifiuto) throw new Error(finto.rifiuto);
    return { ...finto.doc, no_ai: valore };
  }),
}));

const DOC = {
  id: "d1", title: "Documento finto", doc_type: "contratti", document_date: "2026-11-02", counterparties: null, amount: null,
  expiry_date: null, note: null, storage_path: "x/finto.pdf", file_name: "finto.pdf", testo: null, no_ai: false, sensibile: "IBAN", task_id: null,
};

beforeEach(() => {
  finto.doc = { ...DOC };
  finto.rifiuto = null;
  spie.cambi = [];
});

async function apri() {
  const { default: Scheda } = await import("../../src/pages/documenti/DocumentoDetail.jsx");
  render(
    <MemoryRouter initialEntries={["/documenti/d1"]}>
      <Routes>
        <Route path="/documenti/:id" element={<Scheda />} />
      </Routes>
    </MemoryRouter>
  );
  return screen.findByLabelText(/Non far leggere questo documento all'AI/);
}

describe("Scheda del documento · non far leggere all'AI", () => {
  it("spento: lo dice, e offre «Leggi il contenuto»; la nota riservato si vede", async () => {
    const casella = await apri();
    expect(casella.checked).toBe(false);
    expect(screen.getByText(/Spento: MEMO e «Chiedi all'archivio» possono leggerlo/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Leggi il contenuto" })).toBeTruthy();
    expect(screen.getByText(/Segnato come riservato: IBAN/)).toBeTruthy();
  });

  it("un clic lo accende SUBITO (senza «Salva modifiche»), lo dice, e nasconde «Leggi il contenuto»", async () => {
    const casella = await apri();
    fireEvent.click(casella);
    await waitFor(() => expect(casella.checked).toBe(true));
    expect(spie.cambi).toEqual([{ id: "d1", valore: true }]);
    expect(screen.getByText(/Acceso: MEMO e «Chiedi all'archivio» non lo leggono e non lo nominano/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Leggi il contenuto" })).toBeNull();
  });

  it("se il database rifiuta, lo dice e la casella resta com'era", async () => {
    finto.rifiuto = "non puoi";
    const casella = await apri();
    fireEvent.click(casella);
    expect(await screen.findByText(/Non sono riuscito a cambiare il segno: non puoi/)).toBeTruthy();
    expect(casella.checked).toBe(false);
  });
});
