import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const finto = vi.hoisted(() => ({
  causali: [],
  riaccendi: null,
}));

vi.mock("../../src/lib/api/cash", () => ({
  listAllCausali: vi.fn(async () => finto.causali),
  createCausale: vi.fn(async () => ({})),
  deactivateCausale: vi.fn(async () => {}),
  reactivateCausale: vi.fn(async (id) => {
    finto.causali = finto.causali.map((c) => (c.id === id ? { ...c, active: true } : c));
  }),
  setCausaleNeiFissi: vi.fn(async () => {}),
}));
vi.mock("../../src/lib/api/deducibilita", () => ({
  listRegoleDeducibilita: vi.fn(async () => []),
  setRegolaCausale: vi.fn(async () => {}),
}));

async function apri() {
  const { default: Causali } = await import("../../src/pages/cassa/Causali.jsx");
  render(
    <MemoryRouter>
      <Causali />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.queryByText("Caricamento…")).toBeNull());
}

beforeEach(() => {
  finto.causali = [
    { id: "a", label: "Pulizie", kind: "uscita", active: false, di_sistema: false },
    { id: "b", label: "Gas", kind: "uscita", active: true, di_sistema: false },
  ];
});

describe("Causali spente", () => {
  it("le spente stanno nella loro sezione e non fra quelle accese", async () => {
    await apri();
    expect(screen.getByText("Spente (1)")).toBeTruthy();
    expect(screen.getByLabelText("Riaccendi la causale «Pulizie»")).toBeTruthy();
    expect(screen.queryByLabelText("Disattiva la causale «Pulizie»")).toBeNull();
  });

  it("un nome gia' occupato da una spenta offre «Riaccendi» e la riaccende", async () => {
    await apri();
    fireEvent.change(screen.getByPlaceholderText("Nuova causale…"), { target: { value: "Pulizie" } });
    const offerta = document.querySelector("[data-causale-spenta-omonima]");
    expect(offerta).toBeTruthy();
    expect(screen.getByText("+ Aggiungi").disabled).toBe(true);
    fireEvent.click(offerta.querySelector("button"));
    await waitFor(() => expect(screen.getByLabelText("Disattiva la causale «Pulizie»")).toBeTruthy());
    expect(screen.queryByText(/Spente \(/)).toBeNull();
  });
});
