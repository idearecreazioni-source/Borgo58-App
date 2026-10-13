import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// DOVE È FINITO UN LOTTO A SCHERMO (N6, 12/10/2026).

const api = vi.hoisted(() => ({ dove: vi.fn() }));

vi.mock("../../src/lib/api/stock", () => ({
  getStockLot: vi.fn(async () => ({
    id: "l1", quantity_received: 10, quantity_remaining: 4, received_at: "2026-10-01T08:00:00Z",
    supplier_batch_number: "A7", expiry_date: null,
    ingredient: { name: "Farina", unit: "kg" }, supplier: { name: "Mulino" },
  })),
  doveEFinitoIlLotto: (...a) => api.dove(...a),
}));

function apri() {
  return render(
    <MemoryRouter initialEntries={["/haccp/tracciabilita/l1"]}>
      <Routes>
        <Route path="/haccp/tracciabilita/:id" element={<Pagina />} />
      </Routes>
    </MemoryRouter>
  );
}

import Pagina from "../../src/pages/haccp/LottoDestinazioni";

describe("dove è finito un lotto", () => {
  it("dice il conto coi piatti, la produzione seguita e il vuoto di prima", async () => {
    api.dove.mockResolvedValueOnce([
      { livello: 0, lotto_id: "l1", prodotto: "Farina", unita: "kg", tipo: "conto", quantita: 2,
        quando: "2026-10-12T20:00:00Z", serata: "2026-10-12", descrizione: "Conto T3", piatti: "Torta" },
      { livello: 0, lotto_id: "l1", prodotto: "Farina", unita: "kg", tipo: "non_annotato", quantita: 3,
        quando: null, serata: null, descrizione: "Uscito prima del 12/10/2026", piatti: null },
      { livello: 1, lotto_id: "l2", prodotto: "Crema", unita: "kg", tipo: "spreco", quantita: 0.5,
        quando: "2026-10-12T22:00:00Z", serata: "2026-10-12", descrizione: "Buttato", piatti: null },
    ]);
    apri();
    expect(await screen.findByText("Nei piatti: Torta")).toBeTruthy();
    expect(screen.getByText("Conto T3")).toBeTruthy();
    expect(screen.getByText(/3 kg sono usciti prima del 12\/10\/2026/)).toBeTruthy();
    expect(screen.getByText("di Crema")).toBeTruthy();
  });

  it("se la lettura fallisce lo dice, e si riprova", async () => {
    api.dove.mockRejectedValueOnce(new Error("rete giù")).mockResolvedValueOnce([]);
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "Riprova" }));
    expect(await screen.findByText("Da questo lotto non è ancora uscito niente.")).toBeTruthy();
  });
});
