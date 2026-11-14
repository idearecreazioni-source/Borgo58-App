import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 🔴 GLI AVVISI DELLA BANCA RICEVUTI (12/11/2026, PR B1): le mail che la
//    banca manda a banca@ si raccolgono e basta. In Banca un riquadro
//    piccolo dice quante ne sono arrivate, e ognuna si apre per leggerla.
//    Non diventano movimenti. Dati inventati (il repository è pubblico).

const api = vi.hoisted(() => ({ avvisi: vi.fn() }));

vi.mock("../../src/lib/api/banca", () => ({
  abbinaMovimentoBanca: vi.fn(),
  caricaMovimentiBanca: vi.fn(),
  ignoraMovimentoBanca: vi.fn(),
  incassaDaSoliBonifici: vi.fn(() => Promise.resolve({ incassate: 0, elenco: [] })),
  incassaFatturaDaMovimentoBanca: vi.fn(),
  listAvvisiBanca: (...a) => api.avvisi(...a),
  listMovimentiBanca: vi.fn(() => Promise.resolve([])),
  pagaFatturaDaMovimentoBanca: vi.fn(),
  proposteMovimentoBanca: vi.fn(() => Promise.resolve([])),
  registraMovimentoBanca: vi.fn(),
  riapriMovimentoBanca: vi.fn(),
}));
vi.mock("../../src/lib/api/cash", () => ({
  listCausali: vi.fn(() => Promise.resolve([])),
  listContiBancari: vi.fn(() => Promise.resolve([])),
}));

import Pagina from "../../src/pages/cassa/MovimentiBanca";

const AVVISI = [
  {
    id: "a1",
    ricevuta_il: "2026-11-12T08:30:00Z",
    mittente: "Banca finta <avvisi@banca-finta.example>",
    oggetto: "Addebito sul conto",
    testo: "Gentile cliente,\naddebito di 12,00 EUR inventato.",
    stato: "raccolto",
  },
  {
    id: "a2",
    ricevuta_il: "2026-11-11T17:00:00Z",
    mittente: null,
    oggetto: null,
    testo: null,
    stato: "raccolto",
  },
];

beforeEach(() => {
  api.avvisi.mockReset().mockResolvedValue({ avvisi: AVVISI, totale: 2 });
});

const apri = () => render(<MemoryRouter><Pagina /></MemoryRouter>);

describe("gli avvisi della banca ricevuti", () => {
  it("il riquadro dice quanti ne sono arrivati, e che il lettore deve ancora arrivare", async () => {
    apri();
    const titolo = await screen.findByText(/Avvisi della banca ricevuti: 2/);
    expect(titolo.textContent).toMatch(/il lettore arriva quando conosciamo il formato/);
  });

  it("ogni avviso si apre e mostra il testo così com'è arrivato", async () => {
    apri();
    fireEvent.click(await screen.findByText(/Avvisi della banca ricevuti: 2/));
    const voce = screen.getByText(/Addebito sul conto/);
    const scheda = voce.closest("details");
    expect(scheda.open).toBe(false);
    fireEvent.click(voce);
    expect(scheda.open).toBe(true);
    expect(scheda.textContent).toMatch(/addebito di 12,00 EUR inventato/);
    expect(scheda.textContent).toMatch(/Da: Banca finta/);
    // Una mail senza oggetto né testo non lascia buchi.
    expect(screen.getByText(/\(senza oggetto\)/)).toBeTruthy();
    expect(screen.getByText("(nessun testo)")).toBeTruthy();
  });

  it("se ne mostra solo una parte, lo dice", async () => {
    api.avvisi.mockResolvedValue({ avvisi: AVVISI, totale: 41 });
    apri();
    fireEvent.click(await screen.findByText(/Avvisi della banca ricevuti: 41/));
    expect(screen.getByText("Qui sotto gli ultimi 2.")).toBeTruthy();
  });

  it("nessun avviso ancora: si dice, invece di un riquadro vuoto", async () => {
    api.avvisi.mockResolvedValue({ avvisi: [], totale: 0 });
    apri();
    fireEvent.click(await screen.findByText(/Avvisi della banca ricevuti: 0/));
    expect(screen.getByText(/Nessuno ancora/)).toBeTruthy();
  });

  it("un errore di lettura si dice in una riga, e la pagina resta in piedi", async () => {
    api.avvisi.mockRejectedValue(new Error("permesso negato"));
    apri();
    expect((await screen.findByText(/Non riesco a leggere gli avvisi della banca/)).textContent).toMatch(/permesso negato/);
    expect(await screen.findByText("Nessun movimento da abbinare.")).toBeTruthy();
  });
});
