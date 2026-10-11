import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// «DA COLLOCARE» A SCHERMO (C12, 11/10/2026).
// Il database finto risponde come quello vero: la regola «una volta sola» e
// le destinazioni le prova la verifica della migrazione 20261011000002; qui
// si guarda che la schermata chieda ciò che serve, mandi i campi giusti,
// tolga la foto quando la collocazione lo dice, e non collochi due volte.

const api = vi.hoisted(() => ({ colloca: vi.fn(), togli: vi.fn(), annulla: vi.fn(), elimina: vi.fn(), fatte: vi.fn() }));

const APERTE = [
  {
    id: "s1", provenienza: "voce", importo: 30, data: null, controparte: null,
    descrizione: "il pane", natura_proposta: "tasca", incertezza: null,
    testo_originale: "trenta euro di tasca mia per il pane", foto_path: null,
    stato: "da_collocare", creata_il: "2026-10-11T10:00:00Z",
  },
  {
    id: "s2", provenienza: "foto", importo: null, data: "2026-10-10", controparte: "Cartolibreria Rossi",
    descrizione: "cancelleria", natura_proposta: null, incertezza: "il totale non si legge",
    testo_originale: null, foto_path: "da-collocare/x.jpg", documento_proposto: "scontrino",
    stato: "da_collocare", creata_il: "2026-10-11T11:00:00Z",
  },
];

vi.mock("../../src/lib/api/speseDaCollocare", () => ({
  listSpeseDaCollocare: vi.fn(async () => APERTE),
  listSpeseCollocate: (...a) => api.fatte(...a),
  collocaSpesa: (...a) => api.colloca(...a),
  annullaCollocazione: (...a) => api.annulla(...a),
  eliminaSpesa: (...a) => api.elimina(...a),
  togliFotoSpesa: (...a) => api.togli(...a),
  urlFotoSpesa: vi.fn(async () => "https://foto.finta/x.jpg"),
}));
vi.mock("../../src/lib/api/cash", () => ({
  listCausali: vi.fn(async () => [{ id: "c1", label: "Cancelleria" }]),
  listContiBancari: vi.fn(async () => []),
}));
vi.mock("../../src/lib/api/anticipazioni", () => ({
  listTagAnticipazioni: vi.fn(async () => []),
}));
vi.mock("../../src/lib/api/documents", () => ({
  sezioniArchivio: vi.fn(async () => [{ codice: "fatture_ricevute", etichetta: "Fatture ricevute", attiva: true }]),
}));

import DaCollocare from "../../src/pages/cassa/DaCollocare";

const mostra = () =>
  render(
    <MemoryRouter>
      <DaCollocare />
    </MemoryRouter>
  );

beforeEach(() => {
  api.colloca.mockReset();
  api.togli.mockReset().mockResolvedValue();
  api.annulla.mockReset();
  api.elimina.mockReset();
  api.fatte.mockReset().mockResolvedValue([]);
});

const COLLOCATA = {
  id: "s9", provenienza: "voce", importo: 12, data: "2026-10-11", controparte: null,
  descrizione: "spesa al panificio", natura_proposta: "prima_nota", foto_path: null,
  stato: "collocata", collocata_in: "prima_nota", collocata_il: "2026-10-11T21:24:00Z",
};

const riga = (id) => document.querySelector(`[data-spesa="${id}"]`);

describe("Da collocare", () => {
  it("mostra l'originale e ciò che MEMO non sa", async () => {
    mostra();
    expect(await screen.findByText("«trenta euro di tasca mia per il pane»")).toBeTruthy();
    expect(screen.getByText("il totale non si legge")).toBeTruthy();
    expect(screen.getByText("importo non letto")).toBeTruthy();
    expect(screen.getByText("La mia tasca")).toBeTruthy(); // la proposta
  });

  it("🔴 parte dalla proposta di MEMO, e colloca una volta sola", async () => {
    let rispondi;
    api.colloca.mockImplementation(() => new Promise((r) => (rispondi = r)));
    mostra();
    await screen.findByText("il pane");
    fireEvent.click(riga("s1").querySelector("button"));
    const metti = await screen.findByRole("button", { name: "Metti in «La mia tasca»" });
    fireEvent.click(metti);
    fireEvent.click(metti);
    expect(api.colloca).toHaveBeenCalledTimes(1);
    expect(api.colloca.mock.calls[0]).toEqual([
      "s1",
      "tasca",
      { importo: "30", data: null, descrizione: "il pane", controparte: null },
    ]);
    rispondi({ dove: "tasca", foto_da_togliere: null });
    await waitFor(() => expect(riga("s1")).toBeNull());
    expect(api.togli).not.toHaveBeenCalled();
  });

  it("senza importo la prima nota non si può scegliere, e lo dice", async () => {
    mostra();
    await screen.findByText("cancelleria");
    fireEvent.click(riga("s2").querySelector("button"));
    fireEvent.click(screen.getByRole("radio", { name: /Prima nota/ }));
    expect(screen.getByText("Manca l'importo.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Metti in «Prima nota»" }).disabled).toBe(true);
  });

  it("🔴 collocata in prima nota la foto se ne va; in archivio no", async () => {
    api.colloca.mockResolvedValue({ dove: "prima_nota", foto_da_togliere: "da-collocare/x.jpg" });
    mostra();
    await screen.findByText("cancelleria");
    fireEvent.click(riga("s2").querySelector("button"));
    fireEvent.click(screen.getByRole("radio", { name: /Prima nota/ }));
    fireEvent.change(riga("s2").querySelector('input[inputmode="decimal"]'), { target: { value: "18,40" } });
    fireEvent.click(screen.getByRole("button", { name: "Metti in «Prima nota»" }));
    await waitFor(() => expect(api.togli).toHaveBeenCalledWith("s2", "da-collocare/x.jpg"));
    expect(api.colloca.mock.calls[0][2]).toMatchObject({
      importo: "18.40", mezzo: "cassa", documento: "scontrino", conto_id: null,
    });
  });

  it("in archivio servono sezione e data, e la foto resta", async () => {
    api.colloca.mockResolvedValue({ dove: "archivio", foto_da_togliere: null });
    mostra();
    await screen.findByText("cancelleria");
    fireEvent.click(riga("s2").querySelector("button"));
    fireEvent.click(screen.getByRole("radio", { name: /Archivio documenti/ }));
    expect(screen.getByText("Manca la sezione dell'Archivio.")).toBeTruthy();
    fireEvent.change(riga("s2").querySelector("select"), { target: { value: "fatture_ricevute" } });
    fireEvent.click(screen.getByRole("button", { name: "Metti in «Archivio documenti»" }));
    await waitFor(() => expect(api.colloca).toHaveBeenCalled());
    expect(api.colloca.mock.calls[0][2]).toMatchObject({ sezione: "fatture_ricevute", data: "2026-10-10" });
    expect(api.togli).not.toHaveBeenCalled();
  });

  // 🔴 LA VIA DI RITORNO (20261011000003, dal collaudo dell'11/10): una
  //    spesa collocata nel posto sbagliato non si correggeva più.
  it("🔴 una collocata si annulla, dicendo PRIMA cosa toglie, una volta sola", async () => {
    let rispondi;
    api.fatte.mockResolvedValue([COLLOCATA]);
    api.annulla.mockImplementation(() => new Promise((r) => (rispondi = r)));
    mostra();
    fireEvent.click(await screen.findByRole("button", { name: "Annulla la collocazione" }));
    expect(screen.getByText("Toglie il movimento dalla prima nota e la spesa torna da collocare.")).toBeTruthy();
    const si = screen.getByRole("button", { name: "Sì, annulla" });
    fireEvent.click(si);
    fireEvent.click(si);
    expect(api.annulla).toHaveBeenCalledTimes(1);
    expect(api.annulla).toHaveBeenCalledWith("s9");
    api.fatte.mockResolvedValue([]);
    rispondi({ frase: "Tolto il movimento dalla prima nota: la spesa torna da collocare." });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Annulla la collocazione" })).toBeNull());
  });

  it("«No, lascia stare» non annulla niente", async () => {
    api.fatte.mockResolvedValue([COLLOCATA]);
    mostra();
    fireEvent.click(await screen.findByRole("button", { name: "Annulla la collocazione" }));
    fireEvent.click(screen.getByRole("button", { name: "No, lascia stare" }));
    expect(api.annulla).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Annulla la collocazione" })).toBeTruthy();
  });

  it("un appunto mai collocato si toglie, foto compresa, e lo dice prima", async () => {
    api.elimina.mockResolvedValue({});
    mostra();
    await screen.findByText("cancelleria");
    fireEvent.click(within(riga("s2")).getByRole("button", { name: "Togli l'appunto" }));
    expect(screen.getByText(/foto compresa/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sì, toglilo" }));
    await waitFor(() => expect(riga("s2")).toBeNull());
    expect(api.elimina).toHaveBeenCalledWith("s2");
  });
});
