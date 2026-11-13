import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// IL CSV DELLA BANCA NELLA PAGINA (31/10/2026). Il CSV di Credem non dice
// conto e saldi: la pagina li chiede, li controlla, e solo allora carica.
// ⚠️ Il CSV qui è INVENTATO (il repository è pubblico).

const api = vi.hoisted(() => ({
  carica: vi.fn(),
  lista: vi.fn(),
  conti: vi.fn(),
  daSoli: vi.fn(),
}));

vi.mock("../../src/lib/api/banca", () => ({
  abbinaMovimentoBanca: vi.fn(),
  caricaMovimentiBanca: (...a) => api.carica(...a),
  ignoraMovimentoBanca: vi.fn(),
  incassaDaSoliBonifici: (...a) => api.daSoli(...a),
  incassaFatturaDaMovimentoBanca: vi.fn(),
  listAvvisiBanca: vi.fn(() => Promise.resolve({ avvisi: [], totale: 0 })),
  listMovimentiBanca: (...a) => api.lista(...a),
  pagaFatturaDaMovimentoBanca: vi.fn(),
  proposteMovimentoBanca: vi.fn(() => Promise.resolve([])),
  registraMovimentoBanca: vi.fn(),
  riapriMovimentoBanca: vi.fn(),
}));
vi.mock("../../src/lib/api/cash", () => ({
  listCausali: vi.fn(() => Promise.resolve([])),
  listContiBancari: (...a) => api.conti(...a),
}));

import Pagina from "../../src/pages/cassa/MovimentiBanca";

const CONTO = { id: "c1", nome: "Credem", iban: "IT60X0542811101000000123456", attivo: true, predefinito: true };

const CSV =
  "﻿Data contabile;Data valuta;Descrizione;Causale Abi;Causale Int;Importo;Note\r\n"
  + '20/10/2026;20/10/2026;"BONIFICO   rif. banca: 1234567; Ordinante: MARIO ROSSI";48;48;5.000,00;\r\n'
  + "22/10/2026;22/10/2026;COMMISSIONI;66;66;-1,00;\r\n";

function apri() {
  return render(
    <MemoryRouter>
      <Pagina />
    </MemoryRouter>,
  );
}

/** Un file scelto dalla casella. jsdom non ha File.arrayBuffer: glielo si dà. */
function metti(testo, nome = "movimenti.csv") {
  const casella = document.querySelector('input[type="file"]');
  const bytes = new TextEncoder().encode(testo);
  const file = new File([bytes], nome, { type: "text/csv" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer.slice(0) });
  Object.defineProperty(casella, "files", { value: [file], configurable: true });
  fireEvent.change(casella);
}

async function scegli() {
  metti(CSV);
  return screen.findByText(/2 movimenti dal 20 ott 2026 al 22 ott 2026/);
}

const scrivi = (etichetta, valore) => fireEvent.change(screen.getByLabelText(etichetta), { target: { value: valore } });

beforeEach(() => {
  api.carica.mockReset().mockResolvedValue({ conto: "Credem", nuovi: 2, gia_presenti: 0 });
  api.lista.mockReset().mockResolvedValue([]);
  api.conti.mockReset().mockResolvedValue([CONTO]);
  api.daSoli.mockReset().mockResolvedValue({ incassate: 0, elenco: [] });
});

describe("il CSV della banca", () => {
  it("🔴 chiede i saldi, li controlla e carica sul conto scelto", async () => {
    apri();
    await scegli();
    // Il conto principale è già scelto.
    await waitFor(() => expect(screen.getByLabelText("Conto").value).toBe("c1"));

    scrivi("Saldo iniziale (€)", "100,00");
    scrivi("Saldo finale (€)", "5.099,00");
    fireEvent.click(screen.getByRole("button", { name: "Carica i movimenti" }));

    expect(await screen.findByText(/2 movimenti nuovi/)).toBeTruthy();
    expect(api.carica).toHaveBeenCalledTimes(1);
    const [iban, flusso, movimenti] = api.carica.mock.calls[0];
    expect(iban).toBe(CONTO.iban);
    expect(flusso).toBe("movimenti.csv");
    expect(movimenti.map((m) => m.importo)).toEqual([5000, -1]);
    expect(movimenti.every((m) => m.impronta.startsWith("csv§"))).toBe(true);
  });

  it("🔴 dopo il caricamento le fatture ai clienti si incassano da sole, e la pagina lo dice (13/11, pezzo 5a)", async () => {
    api.daSoli.mockResolvedValue({
      incassate: 1,
      elenco: [{ fattura: "Fattura 3/2027 — Pasticceria Esempio srl del 15/01/2027", importo: 5000, data: "2026-10-20" }],
    });
    apri();
    await scegli();
    await waitFor(() => expect(screen.getByLabelText("Conto").value).toBe("c1"));
    scrivi("Saldo iniziale (€)", "100,00");
    scrivi("Saldo finale (€)", "5.099,00");
    fireEvent.click(screen.getByRole("button", { name: "Carica i movimenti" }));
    const avviso = await screen.findByText("Una fattura ai clienti incassata da sola:");
    expect(avviso.closest("[role=status]").textContent).toMatch(/Fattura 3\/2027 — Pasticceria Esempio/);
    expect(api.daSoli).toHaveBeenCalledTimes(1);
    expect(api.carica.mock.invocationCallOrder[0]).toBeLessThan(api.daSoli.mock.invocationCallOrder[0]);
  });

  it("se l'abbinamento delle fatture non riesce, il caricamento resta fatto e lo dice", async () => {
    api.daSoli.mockRejectedValue(new Error("la rete è caduta"));
    apri();
    await scegli();
    await waitFor(() => expect(screen.getByLabelText("Conto").value).toBe("c1"));
    scrivi("Saldo iniziale (€)", "100,00");
    scrivi("Saldo finale (€)", "5.099,00");
    fireEvent.click(screen.getByRole("button", { name: "Carica i movimenti" }));
    expect(await screen.findByText(/2 movimenti nuovi/)).toBeTruthy();
    expect(await screen.findByText(/Abbinamento delle fatture ai clienti non riuscito: la rete è caduta/)).toBeTruthy();
  });

  it("se i saldi non tornano non carica niente, e dice di quanto", async () => {
    apri();
    await scegli();
    scrivi("Saldo iniziale (€)", "100,00");
    scrivi("Saldo finale (€)", "5.000,00");
    fireEvent.click(screen.getByRole("button", { name: "Carica i movimenti" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/Non quadra/);
    expect(api.carica).not.toHaveBeenCalled();
  });

  it("senza saldi non carica", async () => {
    apri();
    await scegli();
    fireEvent.click(screen.getByRole("button", { name: "Carica i movimenti" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/saldo iniziale e il saldo finale/);
    expect(api.carica).not.toHaveBeenCalled();
  });

  it("🔴 si ferma se gli stessi giorni dello stesso conto sono già entrati dal CBI", async () => {
    api.lista.mockResolvedValue([
      {
        id: "m1",
        conto_id: "c1",
        conto: { nome: "Credem" },
        impronta: "IT60X0542811101000000123456§2026-10-21§…",
        data_contabile: "2026-10-21",
        importo: -10,
        descrizione: "dal CBI",
      },
    ]);
    apri();
    await scegli();
    scrivi("Saldo iniziale (€)", "100,00");
    scrivi("Saldo finale (€)", "5.099,00");
    fireEvent.click(screen.getByRole("button", { name: "Carica i movimenti" }));

    expect((await screen.findByRole("alert")).textContent).toMatch(/dal file CBI/);
    expect(api.carica).not.toHaveBeenCalled();
  });

  it("un conto senza IBAN non si può usare: il database cerca il conto per IBAN", async () => {
    api.conti.mockResolvedValue([{ ...CONTO, iban: null }]);
    apri();
    await scegli();
    scrivi("Saldo iniziale (€)", "100,00");
    scrivi("Saldo finale (€)", "5.099,00");
    fireEvent.click(screen.getByRole("button", { name: "Carica i movimenti" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/non ha l'IBAN/);
    expect(api.carica).not.toHaveBeenCalled();
  });

  it("se i conti arrivano dopo il file, il conto principale è comunque quello scelto", async () => {
    let arrivano;
    api.conti.mockReturnValue(new Promise((r) => { arrivano = r; }));
    apri();
    await scegli();
    expect(screen.getByLabelText("Conto").textContent).toMatch(/Leggo i conti/);
    arrivano([{ ...CONTO, id: "c0", nome: "Altro", predefinito: false }, CONTO]);
    await waitFor(() => expect(screen.getByLabelText("Conto").value).toBe("c1"));

    scrivi("Saldo iniziale (€)", "100,00");
    scrivi("Saldo finale (€)", "5.099,00");
    fireEvent.click(screen.getByRole("button", { name: "Carica i movimenti" }));
    expect(await screen.findByText(/2 movimenti nuovi/)).toBeTruthy();
  });

  it("🔴 i doppioni si cercano nei movimenti di ADESSO, non in quelli dell'apertura", async () => {
    apri();
    await scegli();
    // Nel frattempo il CBI di quei giorni è entrato da un'altra finestra.
    api.lista.mockResolvedValue([
      { id: "m1", conto_id: "c1", conto: { nome: "Credem" }, impronta: "IT60X§2026-10-21",
        data_contabile: "2026-10-21", importo: -10, descrizione: "dal CBI" },
    ]);
    scrivi("Saldo iniziale (€)", "100,00");
    scrivi("Saldo finale (€)", "5.099,00");
    fireEvent.click(screen.getByRole("button", { name: "Carica i movimenti" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/dal file CBI/);
    expect(api.carica).not.toHaveBeenCalled();
  });

  it("un CSV risalvato in caratteri occidentali si riconosce lo stesso", async () => {
    apri();
    const casella = document.querySelector('input[type="file"]');
    const testo = CSV.replace("﻿", "").replace("MARIO ROSSI", "NICOLÒ ROSSI");
    const bytes = Uint8Array.from(testo, (c) => c.charCodeAt(0)); // latin1: un byte per lettera
    const file = new File([bytes], "movimenti.csv", { type: "text/csv" });
    Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer.slice(0) });
    Object.defineProperty(casella, "files", { value: [file], configurable: true });
    fireEvent.change(casella);
    expect(await screen.findByText(/2 movimenti dal 20 ott 2026 al 22 ott 2026/)).toBeTruthy();
  });

  it("un CSV storto non arriva neanche al passo dei saldi", async () => {
    apri();
    metti(CSV.replace("-1,00", "uno"));

    expect(await screen.findByText(/l'importo «uno» non si legge/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Carica i movimenti" })).toBeNull();
  });
});
