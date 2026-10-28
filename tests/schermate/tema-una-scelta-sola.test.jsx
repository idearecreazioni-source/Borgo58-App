import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTema } from "../../src/lib/tema";

// UNA SCELTA SOLA PER TUTTO IL GESTIONALE (notte del 28/10/2026): il menu è
// montato due volte, telefono e computer, e le due copie devono dire la
// stessa cosa.

function Menu({ nome }) {
  const [scelta, scegli] = useTema();
  return (
    <div>
      <span data-testid={nome}>{scelta}</span>
      <button type="button" onClick={() => scegli("scuro")}>
        scuro {nome}
      </button>
    </div>
  );
}

describe("il tema", () => {
  it("🔴 scelto in un menu, cambia anche nell'altro e sulla pagina", async () => {
    render(
      <>
        <Menu nome="telefono" />
        <Menu nome="computer" />
      </>,
    );
    await act(async () => screen.getByRole("button", { name: "scuro telefono" }).click());
    expect(screen.getByTestId("telefono").textContent).toBe("scuro");
    expect(screen.getByTestId("computer").textContent).toBe("scuro");
    expect(document.documentElement.getAttribute("data-tema")).toBe("scuro");
  });
});
