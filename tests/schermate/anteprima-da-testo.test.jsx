import { readFileSync } from "node:fs";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AnteprimaDaTesto from "../../src/pages/ricettario/AnteprimaDaTesto";

// Per la prova dell'ordine delle rotte si monta l'app intera: accesso,
// cornice e dettaglio della bozza sono finti, e il collegamento al database
// è un finto che non risponde niente (stessa forma di rotte-chiuse.test.jsx).
const { finto } = vi.hoisted(() => ({
  finto: () => ({
    rpc: vi.fn(async () => ({ data: null, error: null })),
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
    })),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
    },
  }),
}));
vi.mock("../../src/lib/supabase", () => ({ supabase: finto(), supabasePubblico: finto() }));
vi.mock("../../src/context/AuthContext", () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({ isAuthenticated: true, isTitolare: true, loading: false, logout() {} }),
}));
vi.mock("../../src/components/Layout", async () => {
  const { Outlet } = await import("react-router-dom");
  return { default: Outlet };
});
vi.mock("../../src/components/SegnaleDatabase", () => ({ default: () => null }));
vi.mock("../../src/pages/ricettario/BozzaDetail", () => ({ default: () => "DETTAGLIO-BOZZA" }));


// L'ANTEPRIMA DA TESTO A SCHERMO (Ricettario Fase 1C, 07/10/2026).
//
// ⚠️ I testi sono INVENTATI: niente Clove, niente pagine vere. La pagina non
//    parla con nessun servizio, e queste prove lo controllano invece di
//    crederci.

const RICETTA = `Riso alla prova

Per 2 persone
https://esempio.invalid/riso

Ingredienti
- 160 g riso
- 2 uova
- prezzemolo
- sale q.b.

Procedimento
1. Lessare il riso.
2. Condire e servire.`;

const mostra = () =>
  render(
    <MemoryRouter>
      <AnteprimaDaTesto />
    </MemoryRouter>
  );

const incolla = (testo) =>
  fireEvent.change(screen.getByRole("textbox"), { target: { value: testo } });
const esamina = () => fireEvent.click(screen.getByRole("button", { name: "Esamina il testo" }));

describe("dichiara cosa è, prima di tutto", () => {
  it("dice che non salva nulla e che il testo resta qui", () => {
    mostra();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Anteprima da testo — non salva nulla");
    expect(screen.getByText(/non viene inviato né salvato/)).toBeTruthy();
  });

  it("prima di esaminare non mostra nessun risultato", () => {
    mostra();
    expect(screen.queryByRole("region", { name: "Anteprima" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    incolla(RICETTA);
    expect(screen.queryByRole("region", { name: "Anteprima" })).toBeNull();
  });

  it("🔴 non offre nessun comando per salvare, creare o importare", () => {
    mostra();
    incolla(RICETTA);
    esamina();
    const nomi = screen.getAllByRole("button").map((b) => b.textContent);
    expect(nomi).toEqual(["Esamina il testo", "Svuota"]);
    for (const n of nomi) expect(n).not.toMatch(/salva|crea|conferma|importa/i);
  });
});

describe("un testo valido", () => {
  it("mostra titolo, porzioni, ingredienti, passaggi e cosa rivedere", () => {
    mostra();
    incolla(RICETTA);
    esamina();
    const a = within(screen.getByRole("region", { name: "Anteprima" }));
    expect(a.getByText("Riso alla prova")).toBeTruthy();
    expect(a.getByText("2")).toBeTruthy();
    expect(a.getByText("Ingredienti (4)")).toBeTruthy();
    expect(a.getByText("Lessare il riso.")).toBeTruthy();
    expect(a.getByText("Condire e servire.")).toBeTruthy();
    expect(a.getByText("Da rivedere a mano")).toBeTruthy();
    expect(a.getByText("«sale»: «q.b.» non è una quantità")).toBeTruthy();
  });

  it("🔴 un ingrediente senza quantità o unità resta incompleto, e lo dice", () => {
    mostra();
    incolla(RICETTA);
    esamina();
    const a = within(screen.getByRole("region", { name: "Anteprima" }));
    const uova = a.getByText("uova").closest("li");
    expect(uova.textContent).toContain("quantità: 2");
    expect(uova.textContent).toContain("unità: da completare");
    const prezzemolo = a.getByText("prezzemolo").closest("li");
    expect(prezzemolo.textContent).toContain("quantità: da completare");
    expect(prezzemolo.textContent).toContain("unità: da completare");
    expect(a.getByText("«uova»: unità da completare")).toBeTruthy();
    expect(a.getByText("«prezzemolo»: quantità da completare")).toBeTruthy();
    // E le quantità sono quelle del nucleo, non riscritte.
    expect(a.getByText("riso").closest("li").textContent).toContain("quantità: 160 · unità: g");
  });

  it("🔴 un indirizzo dentro il testo resta testo, non un collegamento", () => {
    const { container } = mostra();
    incolla(RICETTA);
    esamina();
    expect(screen.getByText("https://esempio.invalid/riso")).toBeTruthy();
    expect(screen.getByText("https://esempio.invalid/riso").closest("a")).toBeNull();
    const collegamenti = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(collegamenti).toEqual(["/ricettario"]);
  });
});

describe("cosa si rifiuta, e come si ricomincia", () => {
  it("🔴 un testo che è solo un indirizzo viene rifiutato", () => {
    mostra();
    incolla("https://esempio.invalid/ricetta");
    esamina();
    expect(screen.getByRole("alert").textContent).toMatch(/solo un indirizzo/);
    expect(screen.queryByRole("region", { name: "Anteprima" })).toBeNull();
  });

  it("un testo vuoto viene rifiutato", () => {
    mostra();
    esamina();
    expect(screen.getByRole("alert").textContent).toMatch(/vuoto/);
  });

  it("«Svuota» cancella il testo e il risultato", () => {
    mostra();
    incolla(RICETTA);
    esamina();
    fireEvent.click(screen.getByRole("button", { name: "Svuota" }));
    expect(screen.getByRole("textbox").value).toBe("");
    expect(screen.queryByRole("region", { name: "Anteprima" })).toBeNull();
  });
});

describe("🔴 nessun contatto con l'esterno", () => {
  it("esaminare non chiama la rete e non scrive nella memoria del browser", () => {
    const rete = vi.fn();
    const originale = globalThis.fetch;
    globalThis.fetch = rete;
    const scrivi = vi.spyOn(Storage.prototype, "setItem");
    try {
      mostra();
      incolla(RICETTA);
      esamina();
      expect(rete).not.toHaveBeenCalled();
      expect(scrivi).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originale;
    }
  });

  it("la pagina importa solo React, il router e il nucleo puro", () => {
    const sorgente = readFileSync("src/pages/ricettario/AnteprimaDaTesto.jsx", "utf8");
    const importi = [...sorgente.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
    expect(importi).toEqual(["react", "react-router-dom", "../../lib/calcoli/ricettaDaTesto"]);
    const codice = sorgente.replace(/^\s*\/\/.*$/gm, "");
    expect(codice).not.toMatch(
      /dangerouslySetInnerHTML|\bfetch\(|window\.open|location\.|localStorage|sessionStorage|indexedDB|console\.|supabase/
    );
  });
});

describe("🔴 la rotta precisa viene prima di quella dinamica", () => {
  const apri = async (percorso) => {
    window.history.pushState({}, "", percorso);
    const { default: App } = await import("../../src/App.jsx");
    return render(<App />);
  };

  it("/ricettario/bozze/da-testo apre l'anteprima, non il dettaglio di una bozza", async () => {
    await apri("/ricettario/bozze/da-testo");
    expect(await screen.findByText("Anteprima da testo — non salva nulla")).toBeTruthy();
    expect(screen.queryByText("DETTAGLIO-BOZZA")).toBeNull();
  });

  it("...e un identificativo vero apre ancora il dettaglio", async () => {
    await apri("/ricettario/bozze/b1");
    expect(await screen.findByText("DETTAGLIO-BOZZA")).toBeTruthy();
  });

  it("nel sorgente la rotta precisa è scritta prima di quella dinamica", () => {
    const app = readFileSync("src/App.jsx", "utf8");
    const precisa = app.indexOf('path="/ricettario/bozze/da-testo"');
    expect(precisa).toBeGreaterThan(-1);
    expect(precisa).toBeLessThan(app.indexOf('path="/ricettario/bozze/:id"'));
  });

  it("nessuna schermata la collega: non è nel menu né nelle bozze", () => {
    for (const f of [
      "src/components/Sidebar.jsx",
      "src/pages/ricettario/RicettarioHome.jsx",
      "src/pages/ricettario/BozzeList.jsx",
      "src/pages/ricettario/BozzaDetail.jsx",
    ]) {
      expect(readFileSync(f, "utf8"), f).not.toContain("da-testo");
    }
  });
});
