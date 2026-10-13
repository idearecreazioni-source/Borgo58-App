import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// LA RICERCA IN «TRACCIABILITÀ LOTTI» (13/10/2026, chiesta da Alessio).

vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: true }) }));
vi.mock("../../src/lib/api/stock", () => ({
  listStockLots: vi.fn(async () => [
    { id: "1", ingredient: { name: "Calamaro", unit: "kg" }, supplier: { name: "Pescheria" }, supplier_batch_number: "A7",
      received_at: "2026-06-01T08:00:00Z", quantity_received: 3, quantity_remaining: 0, expiry_date: null },
    { id: "2", ingredient: { name: "Farina", unit: "kg" }, supplier: { name: "Mulino" }, supplier_batch_number: null,
      received_at: "2026-06-01T08:00:00Z", quantity_received: 10, quantity_remaining: 4, expiry_date: null },
  ]),
  listStockLotsDisplay: vi.fn(async () => []),
}));

import Tracciabilita from "../../src/pages/haccp/Tracciabilita";

describe("cercare un lotto", () => {
  it("scrivendo, l'elenco si restringe; e se non c'è niente, lo dice", async () => {
    render(<MemoryRouter><Tracciabilita /></MemoryRouter>);
    expect((await screen.findAllByText("Farina")).length).toBeGreaterThan(0);
    const casella = screen.getByRole("searchbox", { name: "Cerca fra i lotti" });
    fireEvent.change(casella, { target: { value: "calamaro" } });
    expect(screen.queryAllByText("Farina")).toHaveLength(0);
    expect(screen.getAllByText("Calamaro").length).toBeGreaterThan(0);
    fireEvent.change(casella, { target: { value: "orata" } });
    expect(screen.getByText("Nessun lotto per «orata».")).toBeTruthy();
  });
});
