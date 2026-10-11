import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

// LA CARTA DEI VINI HA IL SUO FOGLIO (N19, 11/10/2026): la stessa forma del
// menu stampato, e una bottiglia al calice e in bottiglia è un vino solo.

vi.mock("../../src/lib/api/barItems", () => ({
  listBarItems: vi.fn(async () => [
    { id: "1", section: "vini", category: "Bianchi", name: "Grillo", producer: "Baglio", serving: "Calice", selling_price: 6, active: true },
    { id: "2", section: "vini", category: "Bianchi", name: "Grillo", producer: "Baglio", serving: "Bottiglia", selling_price: 28, active: true },
    { id: "3", section: "vini", category: "Rossi", name: "Frappato", producer: null, serving: "Bottiglia", selling_price: 24, active: false },
    { id: "4", section: "bevande", category: "Birre", name: "Bionda", producer: null, serving: "33 cl", selling_price: 5, active: true },
  ]),
  createBarItem: vi.fn(async () => ({})),
  updateBarItem: vi.fn(async () => ({})),
  setBarItemActive: vi.fn(async () => ({})),
  listMargineCarta: vi.fn(async () => []),
  proposteAbbinamento: vi.fn(async () => []),
  prodottiPerLaCarta: vi.fn(async () => []),
  cartaDaRistampare: vi.fn(async () => []),
  segnaCartaStampata: vi.fn(),
}));
vi.mock("../../src/lib/supabase", () => ({
  supabase: { from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }), rpc: async () => ({ data: null, error: null }) },
  supabasePubblico: {},
}));

const { default: BevandeVini } = await import("../../src/pages/menu-editor/BevandeVini");

describe("il foglio della carta dei vini", () => {
  it("🔴 un vino al calice e in bottiglia è UNA riga con due prezzi; le voci tolte e le bevande non si stampano", async () => {
    render(
      <MemoryRouter>
        <BevandeVini />
      </MemoryRouter>
    );
    await waitFor(() => expect(document.querySelector("[data-carta-foglio]")).toBeTruthy());
    const foglio = within(document.querySelector("[data-carta-foglio]"));
    expect(foglio.getAllByText("Grillo")).toHaveLength(1);
    expect(foglio.getByText(/Calice 6,00\s€ · Bottiglia 28,00\s€/)).toBeTruthy();
    expect(foglio.queryByText("Frappato")).toBeNull();
    expect(foglio.queryByText("Bionda")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Anche le bevande" })).toBeTruthy();
  });
});
