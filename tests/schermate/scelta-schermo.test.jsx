import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// LO SCHERMO DI QUESTO APPARECCHIO (29/10/2026, decisione di Alessio del
// 28/10): si ricorda su questo apparecchio. Dal 29/10 sera sta nella pagina
// Impostazioni — «Sposta nelle Impostazioni solo la scelta dello schermo,
// chiaro/scuro resta nel piede del menu».

vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: true, logout: () => {} }) }));

import Sidebar from "../../src/components/Sidebar";
import Impostazioni from "../../src/pages/Impostazioni";
import { CHIAVE_SCHERMO } from "../../src/lib/schermo";

const mostra = (pagina) => render(<MemoryRouter>{pagina}</MemoryRouter>);

describe("«Questo apparecchio» nelle Impostazioni", () => {
  beforeEach(() => localStorage.clear());

  it("ha le quattro scelte, una sola è premuta, e dice che vale solo qui", () => {
    mostra(<Impostazioni />);
    const gruppo = screen.getByRole("group", { name: "Questo apparecchio" });
    const nomi = within(gruppo).getAllByRole("button").map((b) => b.textContent);
    expect(nomi).toEqual(["Telefono", "Mini tablet", "Tablet", "Computer"]);
    expect(within(gruppo).getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true")).toHaveLength(1);
    const spiega = document.getElementById(gruppo.getAttribute("aria-describedby"));
    expect(spiega?.textContent).toMatch(/Vale solo per questo apparecchio/);
  });

  it("scegliere «Computer» cambia la pagina e resta ricordato su questo apparecchio", async () => {
    mostra(<Impostazioni />);
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

describe("il piede del menu", () => {
  beforeEach(() => localStorage.clear());

  it("🔴 non ha più la scelta dello schermo, ma tiene chiaro/scuro", () => {
    mostra(<Sidebar />);
    expect(screen.queryByRole("group", { name: "Questo apparecchio" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Computer" })).toBeNull();
    expect(screen.getByRole("group", { name: "Aspetto" })).toBeTruthy();
  });

  it("ha la voce «Impostazioni» accanto a «Esci»", () => {
    mostra(<Sidebar />);
    const link = screen.getByRole("link", { name: "Impostazioni" });
    expect(link.getAttribute("href")).toBe("/impostazioni");
    const esci = screen.getByRole("button", { name: "Esci" });
    expect(link.parentElement).toBe(esci.parentElement);
  });
});
