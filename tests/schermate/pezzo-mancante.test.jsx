import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PezzoMancante from "../../src/components/PezzoMancante";

// Un pezzo del gestionale che non arriva (un tablet aperto da prima di un
// aggiornamento) non deve lasciare lo schermo bianco: si dice cosa è
// successo e si offre «Aggiorna» (27/10/2026).

function Rotto() {
  throw new Error("Failed to fetch dynamically imported module");
}

describe("PezzoMancante", () => {
  it("🔴 se la schermata non arriva, al posto dello schermo bianco c'è la spiegazione e «Aggiorna»", () => {
    const zitto = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <PezzoMancante>
        <Rotto />
      </PezzoMancante>,
    );
    expect(screen.getByRole("alert").textContent).toMatch(/non si è caricata/);
    expect(screen.getByRole("button", { name: "Aggiorna" })).toBeTruthy();
    zitto.mockRestore();
  });

  it("se tutto arriva, mostra la schermata e basta", () => {
    render(
      <PezzoMancante>
        <p>La sala</p>
      </PezzoMancante>,
    );
    expect(screen.getByText("La sala")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
