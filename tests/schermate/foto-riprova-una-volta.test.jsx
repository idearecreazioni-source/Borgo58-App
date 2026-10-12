import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// 🔴 «RIPROVA» NON SCRIVE UNA SECONDA SPESA (12/10/2026, dalla validazione
//    della #178). La rete può cadere DOPO che il database ha scritto: la
//    schermata vede un errore e offre «Riprova». Il database riconosce la
//    stessa foto dalla sua chiave (20261011000004) — ma solo se la
//    schermata ripassa la STESSA chiave. Questa prova guarda quella metà:
//    se ogni «Riprova» ne generasse una nuova, il database non potrebbe
//    accorgersi di niente e nascerebbero due appunti.

const api = vi.hoisted(() => ({ annota: vi.fn() }));

vi.mock("../../src/components/ScattaFoto", () => ({
  default: ({ onLetto }) => (
    <button
      type="button"
      onClick={() =>
        onLetto(
          { esito: "letta", acquisto: { importo: 12, esercente: "Forno", cosa: "pane" } },
          { base64: "QUJD", tipo: "image/jpeg" }
        )
      }
    >
      scatta
    </button>
  ),
}));
vi.mock("../../src/lib/api/assistenteFoto", () => ({
  chiHaMessoIlTetto: vi.fn(async () => null),
  impostaTettoAi: vi.fn(),
  listLettureFoto: vi.fn(async () => []),
  sbloccaSpesaAi: vi.fn(),
  spesaAiDelMese: vi.fn(async () => ({ tetto_euro: null })),
}));
vi.mock("../../src/lib/api/speseDaCollocare", () => ({
  annotaSpesaDaFoto: (...a) => api.annota(...a),
}));

import Fotografa from "../../src/pages/assistente/Fotografa";

describe("la foto di uno scontrino, riprovata", () => {
  it("🔴 «Riprova» ripassa la stessa chiave e la stessa foto", async () => {
    api.annota.mockRejectedValueOnce(new Error("Failed to fetch")).mockResolvedValueOnce("id-1");
    render(
      <MemoryRouter>
        <Fotografa />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "scatta" }));
    fireEvent.click(await screen.findByRole("button", { name: "Riprova" }));
    await waitFor(() => expect(api.annota).toHaveBeenCalledTimes(2));

    const [primo, secondo] = api.annota.mock.calls;
    expect(typeof primo[2]).toBe("string");
    expect(primo[2].length).toBeGreaterThan(10);
    expect(secondo[2]).toBe(primo[2]);
    expect(secondo[1]).toBe(primo[1]);
    expect(await screen.findByText(/da collocare/)).toBeTruthy();
  });

  it("una foto nuova ha una chiave nuova", async () => {
    api.annota.mockReset().mockResolvedValue("id");
    render(
      <MemoryRouter>
        <Fotografa />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole("button", { name: "scatta" }));
    await waitFor(() => expect(api.annota).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "scatta" }));
    await waitFor(() => expect(api.annota).toHaveBeenCalledTimes(2));
    expect(api.annota.mock.calls[1][2]).not.toBe(api.annota.mock.calls[0][2]);
  });
});
