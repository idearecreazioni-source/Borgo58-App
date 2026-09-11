import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// =====================================================================
// LE PAROLE, NON I CODICI DEL DATABASE — 11/09/2026, mandato notturno 2
// =====================================================================
// 🔴 COSA SI PROVA: dove una schermata mostrava il codice che il database
//    usa («vini», «liquori», «cassa»), adesso mostra la parola che la stessa
//    schermata usa altrove — e un valore sconosciuto resta leggibile invece
//    di sparire.

vi.mock("../../src/lib/api/cantina", () => ({
  apriBottiglia: vi.fn(),
  bottiglieAperte: vi.fn(async () => []),
  chiudiBottiglia: vi.fn(),
  inventarioCantina: vi.fn(async () => [
    { ingredient_id: "a", prodotto: "Grappa di Nero d'Avola", mondo: "liquori", differenza_unita: -1, differenza_euro: -18, quante_volte: 1 },
    { ingredient_id: "b", prodotto: "Acqua frizzante", mondo: "bevande", differenza_unita: -2, differenza_euro: -1, quante_volte: 1 },
  ]),
}));
vi.mock("../../src/lib/api/barItems", () => ({
  prodottiPerLaCarta: vi.fn(async () => [
    { ingredient_id: "a", prodotto: "Grappa di Nero d'Avola", mondo: "liquori", mondo_nome: "Liquori e distillati" },
  ]),
}));

vi.mock("../../src/lib/api/entities", () => ({ getEntities: vi.fn(async () => ({ srls: { id: "e1" } })) }));
vi.mock("../../src/lib/api/cash", () => ({
  getSpazioDiManovra: vi.fn(async () => ({ restituibile_adesso: 100, debito_residuo: 500, avvertenza: "", riserva: null })),
  listAllCausali: vi.fn(async () => []),
  listPrestiti: vi.fn(async () => [
    { id: "p1", da_chi: "Zio Pino", importo: 500, ricevuto_il: "2026-08-01", mezzo: "cassa", restituito: 0, residuo: 500, estinto: false },
    { id: "p2", da_chi: "Cugina Lia", importo: 300, ricevuto_il: "2026-08-02", mezzo: "banca", restituito: 0, residuo: 300, estinto: false },
  ]),
  registraPrestito: vi.fn(),
  registraRestituzione: vi.fn(),
  salvaRiservaPrestiti: vi.fn(),
}));

const { default: Cantina } = await import("../../src/pages/magazzino/Cantina");
const { default: Prestiti } = await import("../../src/pages/cassa/Prestiti");

describe("🔴 i prestiti", () => {
  it("dice «contanti» come il modulo, non «cassa»", async () => {
    render(
      <MemoryRouter>
        <Prestiti />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText("Zio Pino")).toBeTruthy());
    const riga = (chi) => screen.getByText(chi).parentElement.textContent;
    expect(riga("Zio Pino")).toMatch(/· contanti/);
    expect(riga("Zio Pino")).not.toMatch(/· cassa/);
    expect(riga("Cugina Lia")).toMatch(/· banca/);
  });
});

describe("🔴 la Cantina, nell'inventario", () => {
  it("dice «Liquori e distillati» e non «liquori»; senza nome, almeno la parola con la maiuscola", async () => {
    render(
      <MemoryRouter>
        <Cantina />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getAllByText("Grappa di Nero d'Avola").length).toBeGreaterThan(0));
    const testo = document.body.textContent;
    expect(testo).toContain("Liquori e distillati");
    expect(testo).toContain("Bevande");
    // Il codice nudo non compare più come valore della colonna «Mondo».
    const celle = [...document.querySelectorAll("td, [data-campo], p, span")].map((e) => e.textContent.trim());
    expect(celle).not.toContain("liquori");
    expect(celle).not.toContain("bevande");
  });
});
