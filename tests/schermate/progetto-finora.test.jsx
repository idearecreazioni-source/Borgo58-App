import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// IL QUARTO RIQUADRO DI «CASSA, BANCA E PRIMA NOTA»: «Il progetto finora»
// fino al primo scontrino, poi tornano gli omaggi. Dati inventati.

const api = vi.hoisted(() => ({ scontrino: vi.fn(), costo: vi.fn(), righe: vi.fn() }));

vi.mock("../../src/lib/api/cash", () => ({
  getCashBalance: vi.fn(async () => ({ saldo_cassa: 0, saldo_banca: 0, entrate_banca: 0, uscite_banca: 0 })),
  getQuadraturaFiscale: vi.fn(async () => null),
  getUsciteFuture: vi.fn(async () => []),
  getSaldoTesoreria: vi.fn(async () => null),
  listCashMovements: vi.fn(async () => []),
  listDiscountsGifts: vi.fn(async () => []),
  listQuadraturaPagamenti: vi.fn(async () => []),
  registraConteggioCassa: vi.fn(),
  versaInBanca: vi.fn(),
  costoDelProgetto: (...a) => api.costo(...a),
  righeCostoDelProgetto: (...a) => api.righe(...a),
}));
vi.mock("../../src/lib/api/orders", () => ({ esisteUnoScontrino: (...a) => api.scontrino(...a) }));
vi.mock("../../src/lib/api/entities", () => ({
  getEntities: vi.fn(async () => ({ srls: { id: "e1", name: "Borgo 58" } })),
}));
vi.mock("../../src/lib/api/speseDaCollocare", () => ({ contaSpeseDaCollocare: vi.fn(async () => 0) }));
vi.mock("../../src/lib/giornataOperativa", () => ({
  useGiornataOperativa: () => ({ giornata: "2026-11-01", caricata: true }),
}));

import CassaHome from "../../src/pages/cassa/CassaHome";

const AGG = [
  { tipo: "srls", soggetto: "Borgo 58", quante: 3, totale: 660 },
  { tipo: "tasca", soggetto: "La tasca", quante: 0, totale: 0 },
];
const RIGHE = [
  { fonte: "prima_nota", tipo: "srls", importo: 0 },
  { fonte: "anticipazione", tipo: "srls", importo: 460 },
  { fonte: "anticipazione", tipo: "srls", importo: 200 },
];

const mostra = () =>
  render(
    <MemoryRouter>
      <CassaHome />
    </MemoryRouter>
  );

beforeEach(() => {
  api.scontrino.mockReset().mockResolvedValue(false);
  api.costo.mockReset().mockResolvedValue(AGG);
  api.righe.mockReset().mockResolvedValue(RIGHE);
});

describe("il quarto riquadro", () => {
  it("senza scontrini mostra il progetto, il totale e quanto hai anticipato", async () => {
    mostra();
    await waitFor(() => expect(document.querySelector('[data-prova="progetto-totale"]')).not.toBeNull());
    expect(screen.getByText("Il progetto finora")).toBeTruthy();
    expect(document.querySelector('[data-prova="progetto-totale"]').textContent).toMatch(/660/);
    expect(document.querySelector('[data-prova="progetto-anticipato"]').textContent).toMatch(/di cui .*660.* anticipati da te/);
    expect(screen.queryByText(/Omaggi/)).toBeNull();
  });

  it("toccandolo si va a «Quanto e' costato il progetto»", async () => {
    mostra();
    await waitFor(() => expect(document.querySelector('[data-prova="riquadro-progetto"]')).not.toBeNull());
    expect(document.querySelector('[data-prova="riquadro-progetto"]').getAttribute("href")).toBe("/cassa/costo-progetto");
  });

  it("dopo il primo scontrino tornano gli omaggi e il progetto non si legge nemmeno", async () => {
    api.scontrino.mockResolvedValue(true);
    mostra();
    await waitFor(() => expect(screen.getByText(/Omaggi/)).toBeTruthy());
    expect(screen.queryByText("Il progetto finora")).toBeNull();
    expect(api.costo).not.toHaveBeenCalled();
  });

  it("se non si sa se c'e' uno scontrino restano gli omaggi", async () => {
    api.scontrino.mockRejectedValue(new Error("rete"));
    mostra();
    await waitFor(() => expect(screen.getByText(/Omaggi/)).toBeTruthy());
    expect(screen.queryByText("Il progetto finora")).toBeNull();
  });

  it("se il costo non si legge lo dice, non scrive zero", async () => {
    api.costo.mockRejectedValue(new Error("rete"));
    mostra();
    await waitFor(() => expect(screen.getByText("Il progetto finora")).toBeTruthy());
    await waitFor(() => expect(document.querySelector('[data-prova="progetto-totale"]')).toBeNull());
    expect(screen.getByText(/non riesco a leggere/i)).toBeTruthy();
  });
});
