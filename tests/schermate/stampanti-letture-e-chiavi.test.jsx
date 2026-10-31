import { MemoryRouter } from "react-router-dom";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// LE LETTURE AUTOMATICHE DI «STAMPANTI» (1/11/2026, revisione M9).
// Una lettura che fallisce una volta non deve lasciare «Errore: …» sullo
// schermo per sempre, e una risposta vecchia non deve coprirne una nuova.

const api = vi.hoisted(() => ({
  elenco: vi.fn(),
  lavori: vi.fn(),
  chiavi: vi.fn(),
}));

vi.mock("../../src/lib/api/stampanti", () => ({
  annullaLavoro: vi.fn(),
  chiaviPonte: (...a) => api.chiavi(...a),
  chiediLavoro: vi.fn(),
  creaChiavePonte: vi.fn(),
  elencoDispositivi: (...a) => api.elenco(...a),
  revocaChiavePonte: vi.fn(),
  salvaDispositivo: vi.fn(),
  togliDispositivo: vi.fn(),
  ultimiLavori: (...a) => api.lavori(...a),
}));

import Stampanti from "../../src/pages/comande/Stampanti";

const apparecchio = (nome) => ({
  id: "d1",
  nome,
  tipo: "stampante_comande",
  protocollo: "escpos_tcp",
  indirizzo: "192.168.1.50",
  porta: 9100,
  reparto: "cucina",
  attivo: true,
  ultimo_stato: "pronto",
  ultimo_contatto_il: null,
});

async function apri() {
  render(
    <MemoryRouter>
      <Stampanti />
    </MemoryRouter>,
  );
  await act(async () => {});
}

const passano = (ms) => act(async () => vi.advanceTimersByTimeAsync(ms));

describe("Stampanti: le letture automatiche", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.elenco.mockReset();
    api.lavori.mockReset().mockResolvedValue([]);
    api.chiavi.mockReset().mockResolvedValue([]);
  });
  afterEach(() => vi.useRealTimers());

  it("l'errore sparisce quando la lettura successiva riesce", async () => {
    api.elenco
      .mockResolvedValueOnce([apparecchio("Cucina")])
      .mockRejectedValueOnce(new Error("rete giù"))
      .mockResolvedValue([apparecchio("Cucina")]);
    await apri();
    expect(screen.queryByRole("alert")).toBeNull();

    await passano(15000);
    expect(screen.getByRole("alert").textContent).toContain("rete giù");

    await passano(15000);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("una lettura vecchia che fallisce in ritardo non rimette l'errore", async () => {
    let rifiuta;
    api.elenco
      .mockResolvedValueOnce([apparecchio("Cucina")])
      .mockReturnValueOnce(new Promise((_, no) => (rifiuta = no)))
      .mockResolvedValue([apparecchio("Cucina nuova")]);
    await apri();

    await passano(15000); // la lettura lenta parte e resta in attesa
    await passano(15000); // ne parte una più nuova e riesce
    expect(screen.getByText("Cucina nuova")).toBeTruthy();

    await act(async () => rifiuta(new Error("vecchio guasto")));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Cucina nuova")).toBeTruthy();
  });

  it("una lettura vecchia che riesce in ritardo non copre quella nuova", async () => {
    let risolvi;
    api.elenco
      .mockResolvedValueOnce([apparecchio("Cucina")])
      .mockReturnValueOnce(new Promise((si) => (risolvi = si)))
      .mockResolvedValue([apparecchio("Cucina nuova")]);
    await apri();

    await passano(15000);
    await passano(15000);
    await act(async () => risolvi([apparecchio("Cucina vecchia")]));

    expect(screen.getByText("Cucina nuova")).toBeTruthy();
    expect(screen.queryByText("Cucina vecchia")).toBeNull();
  });
});
