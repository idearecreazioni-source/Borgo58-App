import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// «QUESTO MESE ENTRATI / USCITI» IN «CASSA, BANCA E PRIMA NOTA» —
// revisione dell'11/11, punto 7. Due difetti: i soldi che si spostano
// (versamenti, prestiti) si contavano come entrati e usciti, e dopo un
// versamento la scheda si rileggeva senza «fino a oggi», quindi contava
// anche i pagamenti postdatati. Dati inventati.

const api = vi.hoisted(() => ({ movimenti: vi.fn(), versa: vi.fn() }));

vi.mock("../../src/lib/api/cash", () => ({
  getCashBalance: vi.fn(async () => ({ saldo_cassa: 0, saldo_banca: 0, entrate_banca: 0, uscite_banca: 0 })),
  getQuadraturaFiscale: vi.fn(async () => null),
  getUsciteFuture: vi.fn(async () => []),
  getSaldoTesoreria: vi.fn(async () => null),
  listCashMovements: (...a) => api.movimenti(...a),
  listDiscountsGifts: vi.fn(async () => []),
  listQuadraturaPagamenti: vi.fn(async () => []),
  registraConteggioCassa: vi.fn(),
  versaInBanca: (...a) => api.versa(...a),
  costoDelProgetto: vi.fn(async () => []),
  righeCostoDelProgetto: vi.fn(async () => []),
}));
vi.mock("../../src/lib/api/orders", () => ({ esisteUnoScontrino: vi.fn(async () => true) }));
vi.mock("../../src/lib/api/entities", () => ({
  getEntities: vi.fn(async () => ({ srls: { id: "e1", name: "Borgo 58" } })),
}));
vi.mock("../../src/lib/api/speseDaCollocare", () => ({ contaSpeseDaCollocare: vi.fn(async () => 0) }));
vi.mock("../../src/lib/giornataOperativa", () => ({
  useGiornataOperativa: () => ({ giornata: "2026-11-01", caricata: true }),
}));

import CassaHome from "../../src/pages/cassa/CassaHome";
import { oggiLocale } from "../../src/lib/constants";

const mov = (direction, amount, label, di_sistema) => ({
  id: `${label}-${amount}`,
  direction,
  amount,
  movement_date: "2026-11-01",
  causale: { id: label, label, di_sistema },
});

const DEL_MESE = [
  mov("uscita", 800, "Versamento in banca", true),
  mov("entrata", 800, "Versamento dalla cassa", true),
  mov("entrata", 8000, "Prestito ricevuto", true),
  mov("uscita", 42.5, "Spesa al mercato", false),
  mov("entrata", 120, "Altro incasso", false),
];

const mostra = () =>
  render(
    <MemoryRouter>
      <CassaHome />
    </MemoryRouter>
  );

beforeEach(() => {
  api.movimenti.mockReset().mockResolvedValue(DEL_MESE);
  api.versa.mockReset().mockResolvedValue({});
});

const riquadro = () => screen.getByText("Questo mese").parentElement;

describe("Cassa — questo mese entrati e usciti", () => {
  it("non conta versamenti e prestiti, e lo dice", async () => {
    mostra();
    await waitFor(() => expect(screen.getByText("Questo mese")).toBeTruthy());
    const testo = riquadro().textContent;
    expect(testo).toMatch(/\+120,00\s*€\s*entrati/);
    expect(testo).toMatch(/−42,50\s*€\s*usciti/);
    expect(testo).not.toMatch(/8\.920|8\.800|842,50/);
    expect(testo).toMatch(/fino a oggi, senza versamenti, prestiti e caparre/);
  });

  it("dopo un versamento si rilegge ancora «fino a oggi»", async () => {
    mostra();
    await waitFor(() => expect(api.movimenti).toHaveBeenCalledTimes(1));
    expect(api.movimenti.mock.calls[0][0]).toMatchObject({ entityId: "e1", to: oggiLocale() });

    const campo = screen.getByText(/Verso in banca/).parentElement.querySelector("input");
    fireEvent.change(campo, { target: { value: "800" } });
    fireEvent.click(screen.getByRole("button", { name: "Versa" }));

    await waitFor(() => expect(api.movimenti).toHaveBeenCalledTimes(2));
    expect(api.versa).toHaveBeenCalledTimes(1);
    expect(api.movimenti.mock.calls[1][0]).toMatchObject({ entityId: "e1", to: oggiLocale() });
  });
});
