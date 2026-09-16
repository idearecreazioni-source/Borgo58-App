import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LO STATO DELLA CARTA STAMPATA — 16/09/2026, richiesta di Alessio
// =====================================================================
// 🔴 COSA SI PROVA, e perché queste tre cose e non altre:
//
//   1. **Lo stato si legge**: per ogni carta, «mai stampata» oppure quando e
//      da quanti giorni, quante voci sono entrate e uscite da allora, e
//      quante ce ne sono adesso. Sono i numeri che il database già dà
//      (`carta_da_ristampare`, migrazione del 31/08): qui si prova che
//      arrivino a schermo senza essere reinventati.
//
//   2. 🔴 **IL PULSANTE NON SCRIVE FINCHÉ NON SI CONFERMA.** È il cuore:
//      «Segna che l'ho stampata» registra un fatto che nessuno può disfare
//      dall'app — la data di stampa fotografa quante voci c'erano — e un
//      tocco per sbaglio la scriverebbe. La prova guarda proprio il momento
//      di mezzo: dopo il primo tocco, `segnaCartaStampata` **non** è stata
//      chiamata.
//
//   3. **Il pulsante non stampa niente**: registra una stampa già avvenuta.
//      Lo dice la schermata, e la prova pretende che lo dica: un pulsante
//      chiamato «Stampa» prometterebbe una cosa che il gestionale non fa.
//
// ⚠️ E i tre casi che non sono dati: mentre carica, quando la lettura
//    fallisce, e quando in carta non c'è niente. Nessuno dei tre deve
//    somigliare a uno stato vero — «mai stampata» su una carta che non si è
//    riusciti a leggere sarebbe una risposta inventata (regola del 19/08).

const finte = vi.hoisted(() => ({ carta: vi.fn(), segna: vi.fn() }));

vi.mock("../../src/lib/api/barItems", () => ({
  listBarItems: vi.fn(async () => []),
  createBarItem: vi.fn(async () => ({})),
  updateBarItem: vi.fn(async () => ({})),
  setBarItemActive: vi.fn(async () => ({})),
  listMargineCarta: vi.fn(async () => []),
  proposteAbbinamento: vi.fn(async () => []),
  prodottiPerLaCarta: vi.fn(async () => []),
  cartaDaRistampare: (...a) => finte.carta(...a),
  segnaCartaStampata: (...a) => finte.segna(...a),
}));

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    rpc: async () => ({ data: null, error: null }),
  },
  supabasePubblico: {},
}));

const { default: BevandeVini } = await import("../../src/pages/menu-editor/BevandeVini");

const STATO = [
  // Mai stampata: `ultima_stampa` e `giorni_ferma` vuoti — e vuoto non è zero.
  { sezione: "vini", ultima_stampa: null, giorni_ferma: null, entrate_da_allora: 4, uscite_da_allora: 0, voci_adesso: 4 },
  {
    sezione: "bevande",
    ultima_stampa: "2026-09-02T10:00:00Z",
    giorni_ferma: 14,
    entrate_da_allora: 2,
    uscite_da_allora: 1,
    voci_adesso: 9,
  },
];

const apri = async () => {
  const vista = render(
    <MemoryRouter>
      <BevandeVini />
    </MemoryRouter>
  );
  await waitFor(() => expect(document.querySelector("[data-carta-stampata]")).toBeTruthy());
  return vista;
};

const riquadro = (sezione) => document.querySelector(`[data-carta="${sezione}"]`);

async function tocca(el) {
  const { act } = await import("@testing-library/react");
  await act(async () => {
    el.click();
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-16T09:00:00"));
  finte.carta.mockReset().mockResolvedValue(STATO);
  finte.segna.mockReset().mockResolvedValue("id-stampa");
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("🔴 lo stato della carta stampata", () => {
  it("dice mai stampata, oppure da quando — con entrate, uscite e voci di adesso", async () => {
    await apri();

    const vini = within(riquadro("vini"));
    expect(vini.getByText(/mai stampata/i)).toBeTruthy();
    // ⚠️ Su una carta mai stampata «entrate» sono tutte le voci di adesso, e
    //    non si spacciano per «entrate dall'ultima stampa»: non c'è un'ultima
    //    stampa da cui contare.
    expect(riquadro("vini").textContent).toMatch(/4 voci in carta/);

    const bevande = within(riquadro("bevande"));
    expect(bevande.getByText(/14 giorni fa/)).toBeTruthy();
    expect(riquadro("bevande").textContent).toMatch(/2 entrate/);
    expect(riquadro("bevande").textContent).toMatch(/1 tolta/);
    expect(riquadro("bevande").textContent).toMatch(/9 voci in carta/);

    // Nessun allarme e nessun consiglio: i numeri, e decide lui.
    expect(document.querySelector("[data-carta-stampata]").textContent).not.toMatch(
      /ristampa|dovresti|urgente|attenzione/i
    );
  });

  it("🔴 il pulsante non scrive niente finché non si conferma", async () => {
    await apri();
    const bottone = riquadro("bevande").querySelector("[data-segna-stampata]");
    expect(bottone).toBeTruthy();
    // Dice che registra, non che stampa.
    expect(bottone.textContent).toMatch(/segna|registra/i);
    expect(bottone.textContent).not.toMatch(/^stampa/i);

    await tocca(bottone);
    // Il momento di mezzo: la domanda c'è, la scrittura no.
    expect(screen.getByText(/l'hai già stampata/i)).toBeTruthy();
    expect(finte.segna).not.toHaveBeenCalled();

    await tocca(screen.getByRole("button", { name: /sì, l'ho stampata/i }));
    await waitFor(() => expect(finte.segna).toHaveBeenCalledTimes(1));
    expect(finte.segna).toHaveBeenCalledWith("bevande");
    // Dopo la registrazione lo stato si rilegge dal database, non si indovina.
    await waitFor(() => expect(finte.carta).toHaveBeenCalledTimes(2));
  });

  it("annullare la conferma non scrive niente", async () => {
    await apri();
    await tocca(riquadro("vini").querySelector("[data-segna-stampata]"));
    await tocca(screen.getByRole("button", { name: "Annulla" }));
    expect(finte.segna).not.toHaveBeenCalled();
    expect(riquadro("vini").querySelector("[data-segna-stampata]")).toBeTruthy();
  });

  it("🔴 se la lettura fallisce lo dice e non inventa «mai stampata»", async () => {
    finte.carta.mockRejectedValueOnce(new Error("rete assente"));
    render(
      <MemoryRouter>
        <BevandeVini />
      </MemoryRouter>
    );
    await waitFor(() => expect(document.querySelector("[data-carta-non-letta]")).toBeTruthy());
    expect(document.querySelector("[data-carta='vini']")).toBeNull();
    expect(screen.queryByText(/mai stampata/i)).toBeNull();
    // C'è la via d'uscita per riprovare, e riprovando si legge.
    await tocca(screen.getByRole("button", { name: /riprova/i }));
    await waitFor(() => expect(riquadro("vini")).toBeTruthy());
  });

  it("senza niente in carta non c'è una stampa da registrare, e si dice", async () => {
    finte.carta.mockResolvedValue([]);
    await apri();
    expect(screen.getByText(/niente in carta/i)).toBeTruthy();
    expect(document.querySelector("[data-segna-stampata]")).toBeNull();
  });
});
