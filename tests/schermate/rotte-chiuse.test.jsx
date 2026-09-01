import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// LE PORTE DEL GESTIONALE, GUARDATE DA FUORI — 01/09/2026.
//
// ⚠️ COSA PROVANO E COSA NO, detto subito perche' non si scambi per altro:
//    **la barriera vera e' la RLS del database**, e resta quella. Un
//    indirizzo digitato a mano da chi non e' entrato non deve dare accesso
//    ai dati — e non lo darebbe comunque, perche' senza sessione il
//    database non risponde. Quello che si prova qui e' l'altra meta': che
//    l'app non **mostri** una schermata del gestionale a chi non e'
//    dentro, e non la lasci a meta' con l'aria di funzionare.
//
// ⚠️ E LA PARTE CHE VALE DI PIU' E' LA TERZA PROVA: un indirizzo che non
//    esiste non deve lasciare la pagina BIANCA. Una pagina bianca e' la
//    forma piu' pura della regola del 19/08 — *assenza di informazione
//    scambiata per informazione di assenza*: chi la vede pensa che il
//    gestionale sia rotto, e non ha nessuna via d'uscita.

const finto = () => ({
  rpc: vi.fn(async () => ({ data: null, error: null })),
  from: vi.fn(() => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
  })),
  auth: {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })),
  },
});

const clienti = vi.hoisted(() => ({ normale: null, pubblico: null }));

vi.mock("../../src/lib/supabase", () => ({
  get supabase() {
    return clienti.normale;
  },
  get supabasePubblico() {
    return clienti.pubblico;
  },
}));

beforeEach(() => {
  clienti.normale = finto();
  clienti.pubblico = finto();
});

async function apri(percorso) {
  window.history.pushState({}, "", percorso);
  const { default: App } = await import("../../src/App.jsx");
  return render(<App />);
}

// Le schermate che tengono i soldi, il magazzino e i documenti: se una di
// queste comparisse senza sessione, comparirebbe vuota — e una schermata
// vuota si legge «non c'e' niente», non «non sei entrato».
const CHIUSE = [
  "/cassa",
  "/magazzino",
  "/fatture",
  "/documenti",
  "/personale",
  "/comande",
  "/dashboard",
];

describe("chi non e' entrato", () => {
  for (const percorso of CHIUSE) {
    it(`da ${percorso} finisce sulla richiesta del PIN`, async () => {
      await apri(percorso);
      expect(await screen.findByText(/inserisci il PIN per entrare/i)).toBeTruthy();
    });
  }

  it("e le due pagine pubbliche restano aperte", async () => {
    await apri("/privacy");
    expect(await screen.findByText(/informativa/i)).toBeTruthy();
  });

  // 🔴 Un indirizzo sbagliato non lascia la pagina bianca.
  it("un indirizzo che non esiste porta da qualche parte, non nel vuoto", async () => {
    const { container } = await apri("/questa-pagina-non-esiste-davvero");
    expect(await screen.findByText(/inserisci il PIN per entrare/i)).toBeTruthy();
    expect(container.textContent.trim().length).toBeGreaterThan(0);
  });
});
