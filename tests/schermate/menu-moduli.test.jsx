import { MemoryRouter } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// IL MENU DEI MODULI (11/10/2026, decisione di Alessio).
// Monitoraggio Social e Ricerca Ricorrente sono tolti; l'Agricolo resta raggiungibile ma scende in
// fondo, sotto «Messo da parte», finché l'azienda agricola non nasce.

const auth = vi.hoisted(() => ({ isTitolare: true, logout: () => {} }));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => auth }));

import Sidebar from "../../src/components/Sidebar";

const mostra = () =>
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  );

describe("il menu dei moduli", () => {
  it("Monitoraggio Social e Ricerca Ricorrente non ci sono più", () => {
    mostra();
    expect(screen.queryByText("Monitoraggio Social")).toBeNull();
    expect(screen.queryByText("Ricerca Ricorrente")).toBeNull();
  });

  it("l'Agricolo sta in fondo, dopo «Messo da parte», e porta ancora al modulo", () => {
    const { container } = mostra();
    const testi = [...container.querySelectorAll("nav a, nav div")].map((e) => e.textContent.trim());
    const daParte = testi.indexOf("Messo da parte");
    const agricolo = testi.indexOf("Agricolo / Orto");
    expect(daParte).toBeGreaterThan(-1);
    expect(agricolo).toBeGreaterThan(daParte);
    expect(testi.indexOf("Archivio Documenti")).toBeLessThan(daParte);
    expect(within(container).getByRole("link", { name: "Agricolo / Orto" }).getAttribute("href")).toBe("/agricolo");
  });

  it("lo staff non vede né l'Agricolo né la sezione «Messo da parte»", () => {
    auth.isTitolare = false;
    try {
      mostra();
      expect(screen.queryByText("Messo da parte")).toBeNull();
      expect(screen.queryByText("Agricolo / Orto")).toBeNull();
    } finally {
      auth.isTitolare = true;
    }
  });
});
