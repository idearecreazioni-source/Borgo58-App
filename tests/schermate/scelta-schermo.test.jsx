import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// LO SCHERMO DI QUESTO APPARECCHIO (29/10/2026, decisione di Alessio del
// 28/10): si ricorda su questo apparecchio. Dal 29/10 sera sta nella pagina
// Impostazioni — «Sposta nelle Impostazioni solo la scelta dello schermo,
// chiaro/scuro resta nel piede del menu».

const auth = vi.hoisted(() => ({ isTitolare: true }));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: auth.isTitolare, logout: () => {} }) }));

import Sidebar from "../../src/components/Sidebar";
import Impostazioni from "../../src/pages/Impostazioni";
import { CHIAVE_SCHERMO } from "../../src/lib/schermo";

// Ogni prova parte come titolare, qualunque sia l'ordine in cui girano.
afterEach(() => {
  auth.isTitolare = true;
});

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

  it("«Impostazioni» non diventa verde quando è aperta: è vestita come «Esci»", () => {
    render(
      <MemoryRouter initialEntries={["/impostazioni"]}>
        <Sidebar />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "Impostazioni" });
    const esci = screen.getByRole("button", { name: "Esci" });
    expect(link.className).not.toMatch(/bg-b58-azione/);
    const vestito = (el) => el.className.split(/\s+/).filter((c) => /^(bg-|text-b58|hover:)/.test(c)).sort();
    // Due liste vuote sarebbero «uguali» e la prova non controllerebbe niente.
    expect(vestito(esci)).toEqual(["hover:bg-b58-cream-dark", "text-b58-charcoal-soft"]);
    expect(vestito(link)).toEqual(vestito(esci));
  });
});

describe("«Il locale» nelle Impostazioni", () => {
  beforeEach(() => localStorage.clear());

  it("il titolare trova le stampanti, e la pagina sa di tornare qui", async () => {
    // Al posto della pagina vera delle stampanti, una che dice con che
    // biglietto si è arrivati: è quello che legge il suo tasto «←».
    function Arrivo() {
      return <p data-testid="arrivo">{useLocation().state?.da ?? "nessuno"}</p>;
    }
    render(
      <MemoryRouter initialEntries={["/impostazioni"]}>
        <Routes>
          <Route path="/impostazioni" element={<Impostazioni />} />
          <Route path="/comande/stampanti" element={<Arrivo />} />
        </Routes>
      </MemoryRouter>,
    );
    const parte = screen.getByRole("region", { name: "Il locale" });
    const link = within(parte).getByRole("link", { name: /^Stampanti e registratore/ });
    expect(link.getAttribute("href")).toBe("/comande/stampanti");
    await act(async () => fireEvent.click(link));
    expect(screen.getByTestId("arrivo").textContent).toBe("impostazioni");
  });

  it("🔴 lo staff non vede «Il locale»: un indirizzo sbagliato lascia la cucina senza comande", () => {
    auth.isTitolare = false;
    mostra(<Impostazioni />);
    expect(screen.queryByRole("region", { name: "Il locale" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Stampanti/ })).toBeNull();
    expect(screen.getByRole("group", { name: "Questo apparecchio" })).toBeTruthy();
  });
});
