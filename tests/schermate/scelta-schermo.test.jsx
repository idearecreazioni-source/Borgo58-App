import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// LO SCHERMO DI QUESTO APPARECCHIO (29/10/2026, decisione di Alessio del
// 28/10): la scelta sta nel piede del menu, accanto a «Aspetto», e si ricorda
// su questo apparecchio.

vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: true, logout: () => {} }) }));

import Sidebar from "../../src/components/Sidebar";
import { CHIAVE_SCHERMO } from "../../src/lib/schermo";

const mostra = () =>
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );

describe("«Questo apparecchio» nel menu", () => {
  beforeEach(() => localStorage.clear());

  it("ha le quattro scelte, e una sola è premuta", () => {
    mostra();
    const gruppo = screen.getByRole("group", { name: "Questo apparecchio" });
    const nomi = within(gruppo).getAllByRole("button").map((b) => b.textContent);
    expect(nomi).toEqual(["Telefono", "Mini tablet", "Tablet", "Computer"]);
    expect(within(gruppo).getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true")).toHaveLength(1);
  });

  it("scegliere «Computer» cambia la pagina e resta ricordato su questo apparecchio", async () => {
    mostra();
    const gruppo = screen.getByRole("group", { name: "Questo apparecchio" });
    await act(async () => fireEvent.click(within(gruppo).getByRole("button", { name: "Computer" })));
    expect(document.documentElement.getAttribute("data-schermo")).toBe("computer");
    expect(localStorage.getItem(CHIAVE_SCHERMO)).toBe("computer");
    expect(within(gruppo).getByRole("button", { name: "Computer" }).getAttribute("aria-pressed")).toBe("true");

    await act(async () => fireEvent.click(within(gruppo).getByRole("button", { name: "Telefono" })));
    expect(document.documentElement.getAttribute("data-schermo")).toBe("telefono");
    expect(localStorage.getItem(CHIAVE_SCHERMO)).toBe("telefono");
  });
});
