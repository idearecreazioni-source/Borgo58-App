import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 🔴 LE SPESE DELLA BANCA SI PROPONGONO DA SOLE (12/11/2026, richiesta di
//    Alessio): commissioni e canoni riconosciuti dalla causale ABI arrivano
//    coi campi compilati, e si possono scrivere tutti insieme DOPO averli
//    visti. Dati inventati.

const api = vi.hoisted(() => ({ lista: vi.fn(), registra: vi.fn(), proposte: vi.fn() }));

vi.mock("../../src/lib/api/banca", () => ({
  abbinaMovimentoBanca: vi.fn(),
  caricaMovimentiBanca: vi.fn(),
  ignoraMovimentoBanca: vi.fn(),
  listAvvisiBanca: vi.fn(() => Promise.resolve({ avvisi: [], totale: 0 })),
  listMovimentiBanca: (...a) => api.lista(...a),
  pagaFatturaDaMovimentoBanca: vi.fn(),
  proposteMovimentoBanca: (...a) => api.proposte(...a),
  registraMovimentoBanca: (...a) => api.registra(...a),
  riapriMovimentoBanca: vi.fn(),
}));
const CAUSALI = [
  { id: "sb", label: "Spese bancarie", kind: "uscita" },
  { id: "rb", label: "Rimborso spese banca", kind: "entrata" },
];
vi.mock("../../src/lib/api/cash", () => ({
  listCausali: vi.fn((kind) => Promise.resolve(kind ? CAUSALI.filter((c) => c.kind === kind) : CAUSALI)),
  listContiBancari: vi.fn(() => Promise.resolve([])),
}));

import Pagina from "../../src/pages/cassa/MovimentiBanca";

const riga = (id, importo, abi, descrizione) => ({
  id, importo, causale_abi: abi, descrizione, data_contabile: "2026-11-05", conto: { nome: "Credem" },
  cash_movement_id: null, ignorato_il: null,
});

beforeEach(() => {
  api.lista.mockReset().mockResolvedValue([
    riga("a", -1, "16", "COMM. BONIFICO"),
    riga("b", -10, "18", "CANONE GESTIONE C/C"),
    riga("c", 10, "68", "RICARICA-RIMBORSO CANONE"),
    riga("d", -1500, "26", "BONIFICO A DEBITO"),
  ]);
  api.registra.mockReset().mockResolvedValue({});
  api.proposte.mockReset().mockResolvedValue([]);
});

const apri = () => render(<MemoryRouter><Pagina /></MemoryRouter>);

describe("le spese della banca", () => {
  it("si elencano, e si scrivono tutte solo dopo la conferma nella pagina", async () => {
    apri();
    const blocco = await screen.findByText(/3 righe sono spese della banca/);
    expect(blocco.textContent).toMatch(/11,00.*di spese.*10,00.*di rimborsi/);
    fireEvent.click(screen.getByRole("button", { name: "Registra tutte (3)" }));
    expect(api.registra).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sì, scrivile" }));
    await waitFor(() => expect(api.registra).toHaveBeenCalledTimes(3));
    expect(api.registra).toHaveBeenCalledWith("a", { causaleId: "sb", tipoDocumento: "estratto_conto", descrizione: "" });
    expect(api.registra).toHaveBeenCalledWith("c", { causaleId: "rb", tipoDocumento: "estratto_conto", descrizione: "" });
    // Il bonifico no: non è una spesa della banca.
    expect(api.registra.mock.calls.map((c) => c[0])).not.toContain("d");
    expect(await screen.findByText(/Scritte in prima nota 3 spese/)).toBeTruthy();
  });

  it("«Lascia perdere» non scrive niente", async () => {
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "Registra tutte (3)" }));
    fireEvent.click(screen.getByRole("button", { name: "Lascia perdere" }));
    expect(api.registra).not.toHaveBeenCalled();
  });

  it("una riga che non passa non ferma le altre, e si dice quale", async () => {
    api.registra.mockImplementation((id) => (id === "b" ? Promise.reject(new Error("rifiutata")) : Promise.resolve({})));
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "Registra tutte (3)" }));
    fireEvent.click(screen.getByRole("button", { name: "Sì, scrivile" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/-10,00.*rifiutata/);
    expect(api.registra).toHaveBeenCalledTimes(3);
  });

  it("aprendo una commissione, causale e documento sono già scelti, e lo dice", async () => {
    apri();
    fireEvent.click(await screen.findByText("COMM. BONIFICO"));
    expect((await screen.findByText(/Ho compilato io i campi/)).textContent).toMatch(/commissioni/);
    const [causale, documento] = screen.getAllByRole("combobox");
    await waitFor(() => expect(causale.value).toBe("sb"));
    expect(documento.value).toBe("estratto_conto");
  });
});

describe("le spese della banca: niente doppioni", () => {
  it("🔴 una riga che ha già un movimento con lo stesso importo non si scrive in blocco, e si dice", async () => {
    api.proposte.mockImplementation((id) => Promise.resolve(id === "b" ? [{ genere: "movimento", rif_id: "x" }] : []));
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "Registra tutte (3)" }));
    fireEvent.click(screen.getByRole("button", { name: "Sì, scrivile" }));
    await waitFor(() => expect(api.registra).toHaveBeenCalledTimes(2));
    expect(api.registra.mock.calls.map((c) => c[0])).not.toContain("b");
    expect((await screen.findByText(/c'è già un movimento o una fattura/)).textContent).toMatch(/-10,00/);
  });
});
