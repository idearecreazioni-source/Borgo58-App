import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LA PAGINA BAR CON LA STAMPANTE — 31/10/2026 (migrazione 20261031000001)
// =====================================================================
// 🔴 Il controllo finale del 30/10 (A3): se il ticket del bar non usciva,
//    al bar nessuno lo vedeva. Adesso c'è lo stesso riquadro della Cucina.
//    Senza stampante la pagina resta quella di prima.

vi.mock("../../src/lib/supabase", () => ({ supabase: { from: vi.fn() }, supabasePubblico: {} }));

const finto = vi.hoisted(() => ({ coda: null, mandati: [], letture: [] }));

const RIGA = {
  id: "b1",
  order_id: "o1",
  quantity: 1,
  free_text_name: "Spritz",
  sent_at: "2026-10-31T19:00:00Z",
  prepared_at: null,
  sostituzioni: [],
  order: { table_label: "T3", status: "aperto" },
};

vi.mock("../../src/lib/api/orders", () => ({
  getOrder: vi.fn(async () => null),
  getServiceSettings: vi.fn(async () => ({ coperto_price: 2 })),
  listOpenOrders: vi.fn(async () => []),
  listRepartoTickets: vi.fn(async () => [RIGA]),
  setItemsPrepared: vi.fn(async () => {}),
}));

vi.mock("../../src/lib/api/stampanti", () => ({
  statoStampa: vi.fn(async (reparto) => {
    finto.letture.push(reparto);
    return finto.coda;
  }),
  mandaAllaStampante: vi.fn(async (x) => {
    finto.mandati.push(x);
    return "nuovo";
  }),
}));

const Bar = (await import("../../src/pages/comande/Bar")).default;

const mostra = () =>
  render(
    <MemoryRouter>
      <Bar />
    </MemoryRouter>
  );

const coda = (lavori, { acceso = true, stato = "pronto", testo = null } = {}) => ({
  stampante: { nome: "Stampante bar", stato, testo },
  ponte_acceso: acceso,
  lavori,
});
const lavoro = (stato, errore = null) => ({
  id: "l1",
  tipo: "comanda",
  stato,
  righe: ["b1"],
  chiamata_id: null,
  errore,
  creato_il: "2026-10-31T19:00:01Z",
});

beforeEach(() => {
  finto.coda = null;
  finto.mandati = [];
  finto.letture = [];
});

describe("la pagina Bar e la stampante", () => {
  it("legge la coda del BAR, non quella della cucina", async () => {
    finto.coda = coda([lavoro("in_coda")]);
    mostra();
    await screen.findByText(/In coda: esce fra poco/);
    expect(finto.letture).toContain("bar");
    expect(finto.letture).not.toContain("cucina");
  });

  it("senza stampante: il ticket e «Evaso», come prima", async () => {
    finto.coda = { stampante: null, ponte_acceso: false, lavori: [] };
    mostra();
    expect(await screen.findByRole("button", { name: /Evaso/ })).toBeTruthy();
    expect(screen.queryByText(/ponte è spento/)).toBeNull();
    expect(screen.queryByText(/coda della stampante/)).toBeNull();
  });

  it("🔴 ponte spento: l'avviso rosso, come in Cucina", async () => {
    finto.coda = coda([lavoro("in_coda")], { acceso: false });
    mostra();
    expect(await screen.findByText(/Il ponte è spento o senza rete/)).toBeTruthy();
  });

  it("🔴 carta finita: lo dice in testa alla pagina", async () => {
    finto.coda = coda([lavoro("in_coda")], { stato: "carta_finita", testo: "la carta è finita: cambia il rotolo." });
    mostra();
    expect(await screen.findByText(/«Stampante bar»: la carta è finita/)).toBeTruthy();
  });

  it("🔴 fallito: lo dice sotto il ticket, e «Riprova» rimanda le sue righe", async () => {
    finto.coda = coda([lavoro("fallito", "la stampante non risponde: è accesa? Ha la rete?")]);
    mostra();
    expect(await screen.findByText(/Non è uscito: la stampante non risponde/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Riprova sulla stampante" }));
    await waitFor(() => expect(finto.mandati).toEqual([{ righe: ["b1"] }]));
  });

  it("🔴 incerto: guarda la carta prima, e nessuna ristampa parte da sola", async () => {
    finto.coda = coda([lavoro("incerto")]);
    mostra();
    expect(await screen.findByText(/Forse è uscito, forse no/)).toBeTruthy();
    expect(screen.getByText(/guarda la carta della stampante/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "È uscito" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Stampa da qui/ })).toBeNull();
    expect(finto.mandati).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Ristampa" }));
    await waitFor(() => expect(finto.mandati).toEqual([{ righe: ["b1"] }]));
  });
});
