import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// LE CAPARRE TENUTE A SCHERMO (13/10/2026). Il dato c'era dal 27/08 e
// nessuna schermata lo mostrava: queste prove tengono ferma la pagina che
// lo mostra, e il «non lo so» quando la lettura cade.

const api = vi.hoisted(() => ({ tenute: vi.fn() }));

vi.mock("../../src/lib/api/reservations", () => ({
  caparreTrattenute: (...a) => api.tenute(...a),
}));

import Pagina from "../../src/pages/cassa/CaparreTenute";

function apri() {
  return render(
    <MemoryRouter>
      <Pagina />
    </MemoryRouter>
  );
}

describe("le caparre tenute", () => {
  it("elenca serata, importo, quando e dove, col totale", async () => {
    api.tenute.mockResolvedValueOnce([
      { movimento_id: "m1", importo: 50, serata: "2026-10-10", tenuta_il: "2026-10-11", mezzo: "cassa" },
      { movimento_id: "m2", importo: 30, serata: "2026-10-03", tenuta_il: "2026-10-04", mezzo: "banca" },
    ]);
    apri();
    expect(await screen.findByText(/2 caparre/)).toBeTruthy();
    expect(screen.getByText(/80,00/)).toBeTruthy();
    expect(screen.getByText(/in cassa/)).toBeTruthy();
    expect(screen.getByText(/in banca/)).toBeTruthy();
  });

  it("vuoto dice che non ce ne sono", async () => {
    api.tenute.mockResolvedValueOnce([]);
    apri();
    expect(await screen.findByText("Nessuna caparra tenuta.")).toBeTruthy();
  });

  it("se la lettura fallisce non dice «nessuna», e si riprova", async () => {
    api.tenute.mockRejectedValueOnce(new Error("rete giù")).mockResolvedValueOnce([]);
    apri();
    expect(await screen.findByText(/Non riesco a leggere le caparre tenute/)).toBeTruthy();
    expect(screen.queryByText("Nessuna caparra tenuta.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(await screen.findByText("Nessuna caparra tenuta.")).toBeTruthy();
  });
});
