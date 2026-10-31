import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LA PAGINA CUCINA CON LA STAMPANTE — 29/10/2026 (migrazione 20261029000001)
// =====================================================================
// 🔴 SENZA STAMPANTE LA PAGINA È QUELLA DI PRIMA: un foglio e «🖨 Stampa».
//    Con la stampante diventa il controllo: lo stato del foglio nella coda,
//    l'avviso rosso se il ponte è spento, e i tasti giusti per ogni caso —
//    in particolare «Non si sa se è uscito», che non si ristampa da solo.

vi.mock("../../src/lib/supabase", () => ({ supabase: { from: vi.fn() }, supabasePubblico: {} }));

const finto = vi.hoisted(() => ({ coda: null, mandati: [], segnati: [] }));

const RIGA = {
  id: "r1",
  order_id: "o1",
  turno: 1,
  quantity: 2,
  free_text_name: "Tagliata",
  sent_at: "2026-10-29T19:00:00Z",
  prepared_at: null,
  sostituzioni: [],
  order: { table_label: "T7", status: "aperto", note: null },
};

vi.mock("../../src/lib/api/orders", () => ({
  listRepartoTickets: vi.fn(async () => [RIGA]),
  listChiamateTurno: vi.fn(async () => []),
  segnaChiamataStampata: vi.fn(async () => {}),
  setItemsPrepared: vi.fn(async (ids, s) => {
    finto.segnati.push([ids, s]);
  }),
}));

vi.mock("../../src/lib/api/stampanti", () => ({
  statoStampa: vi.fn(async () => finto.coda),
  mandaAllaStampante: vi.fn(async (x) => {
    finto.mandati.push(x);
    return "nuovo";
  }),
}));

const Cucina = (await import("../../src/pages/comande/Cucina")).default;

const mostra = () =>
  render(
    <MemoryRouter>
      <Cucina />
    </MemoryRouter>
  );

const coda = (lavori, { acceso = true } = {}) => ({
  stampante: { nome: "Stampante cucina", stato: "pronto", testo: null },
  ponte_acceso: acceso,
  lavori,
});
const lavoro = (stato, errore = null) => ({
  id: "l1",
  tipo: "comanda",
  stato,
  righe: ["r1"],
  chiamata_id: null,
  errore,
  creato_il: "2026-10-29T19:00:01Z",
});

beforeEach(() => {
  finto.coda = null;
  finto.mandati = [];
  finto.segnati = [];
});

describe("la pagina Cucina e la stampante", () => {
  it("senza stampante: il foglio e «Stampa», come prima", async () => {
    finto.coda = { stampante: null, ponte_acceso: false, lavori: [] };
    mostra();
    expect(await screen.findByRole("button", { name: /🖨 Stampa/ })).toBeTruthy();
    expect(screen.queryByText(/ponte è spento/)).toBeNull();
    expect(screen.queryByText(/Stampa da qui/)).toBeNull();
  });

  it("in coda col ponte acceso: lo dice, senza allarmi", async () => {
    finto.coda = coda([lavoro("in_coda")]);
    mostra();
    expect(await screen.findByText(/In coda: esce fra poco/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("🔴 ponte spento: l'avviso rosso, e si stampa da qui", async () => {
    finto.coda = coda([lavoro("in_coda")], { acceso: false });
    mostra();
    expect(await screen.findByText(/Il ponte è spento o senza rete/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Stampa da qui/ })).toBeTruthy();
  });

  it("🔴 incerto: «È uscito» segna stampato, e nessuna ristampa parte da sola", async () => {
    finto.coda = coda([lavoro("incerto")]);
    mostra();
    fireEvent.click(await screen.findByRole("button", { name: "È uscito" }));
    await waitFor(() => expect(finto.segnati).toEqual([[["r1"], true]]));
    expect(finto.mandati).toEqual([]);
  });

  it("🔴 incerto: dice di guardare la carta, e mai «non l'ha stampato» (31/10)", async () => {
    // Anche se dal database arrivasse ancora la frase del codice, sotto un
    // incerto non si mostra: e' quella che faceva ristampare (A2).
    finto.coda = coda([lavoro("incerto", "la stampante non l'ha stampato.")]);
    mostra();
    expect(await screen.findByText(/Forse è uscito, forse no/)).toBeTruthy();
    expect(screen.getByText(/guarda la carta della stampante/)).toBeTruthy();
    expect(screen.queryByText(/non l'ha stampato/)).toBeNull();
    expect(screen.getByRole("button", { name: "Ristampa" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Stampa da qui/ })).toBeTruthy();
    expect(finto.mandati).toEqual([]);
  });

  it("fallito: la frase del motivo, e «Riprova» rimanda le righe del foglio", async () => {
    finto.coda = coda([lavoro("fallito", "la carta è finita: cambia il rotolo.")]);
    mostra();
    expect(await screen.findByText(/Non è uscito: la carta è finita/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Riprova sulla stampante" }));
    await waitFor(() => expect(finto.mandati).toEqual([{ righe: ["r1"], aggiunta: false }]));
  });

  it("mentre la stampante lo sta stampando, «Stampa da qui» aspetta", async () => {
    finto.coda = coda([lavoro("in_corso")]);
    mostra();
    expect((await screen.findByRole("button", { name: /Stampa da qui/ })).disabled).toBe(true);
  });
});
