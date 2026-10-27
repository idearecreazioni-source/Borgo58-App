import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// «FALLO A MANO» DI UNA SPESA DETTA — 27/10/2026.
// 🔴 IL VICOLO CIECO trovato da Alessio: «Fallo a mano» portava su «Da
//    collocare», ma la spesa non c'era e non si poteva scrivere. Qui si
//    guarda il tratto della schermata: i campi capiti arrivano nella scheda,
//    il salvataggio porta l'id della cosa detta e i campi corretti, e dopo
//    non si può salvare una seconda volta. Che il database scriva e chiuda
//    insieme lo prova la verifica della 20261027000002.

const finte = vi.hoisted(() => ({
  aMano: vi.fn(),
  chiudi: vi.fn(),
  annota: vi.fn(),
  aperte: vi.fn(),
}));

vi.mock("../../src/lib/api/voce", () => ({
  azioneAMano: (...a) => finte.aMano(...a),
  chiudiAMano: (...a) => finte.chiudi(...a),
}));
vi.mock("../../src/lib/api/speseDaCollocare", () => ({
  listSpeseDaCollocare: (...a) => finte.aperte(...a),
  listSpeseCollocate: vi.fn(async () => []),
  annotaSpesaDettataAMano: (...a) => finte.annota(...a),
  collocaSpesa: vi.fn(),
  annullaCollocazione: vi.fn(),
  eliminaSpesa: vi.fn(),
  togliFotoSpesa: vi.fn(),
  urlFotoSpesa: vi.fn(async () => ""),
}));
vi.mock("../../src/lib/api/cash", () => ({
  listCausali: vi.fn(async () => []),
  listContiBancari: vi.fn(async () => []),
}));
vi.mock("../../src/lib/api/anticipazioni", () => ({ listTagAnticipazioni: vi.fn(async () => []) }));
vi.mock("../../src/lib/api/documents", () => ({ sezioniArchivio: vi.fn(async () => []) }));

import DaCollocare from "../../src/pages/cassa/DaCollocare";

const AZIONE = {
  id: "az-1",
  tipo: "spesa_da_collocare",
  stato: "in_attesa",
  frase: "Spesa da collocare → 3,00 € · pane",
  testo_detto: "Ho speso tre euro di pane",
  percorso: "/cassa/da-collocare",
  campi: { importo: "3", descrizione: "pane" },
  da_finire: true,
};

const mostra = (url = "/cassa/da-collocare?daVoce=az-1") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <DaCollocare />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  finte.aMano.mockResolvedValue(AZIONE);
  finte.aperte.mockResolvedValue([]);
  finte.annota.mockResolvedValue("sp-1");
});

describe("Da collocare — «Fallo a mano» di una spesa detta", () => {
  it("la scheda si apre con quello che MEMO aveva capito", async () => {
    mostra();
    expect(await screen.findByText(/Ho speso tre euro di pane/)).toBeTruthy();
    expect(await screen.findByDisplayValue("3")).toBe(screen.getByLabelText("Importo (€)"));
    expect(screen.getByLabelText("Che cosa").value).toBe("pane");
  });

  it("salvando porta l'id della cosa detta e i campi corretti, in una chiamata sola", async () => {
    mostra();
    const importo = await screen.findByDisplayValue("3");
    fireEvent.change(importo, { target: { value: "3,50" } });
    fireEvent.change(screen.getByLabelText("Da chi"), { target: { value: "Panificio Russo" } });
    fireEvent.click(screen.getByRole("button", { name: "Mettila fra quelle da collocare" }));

    await waitFor(() => expect(finte.annota).toHaveBeenCalledTimes(1));
    expect(finte.annota).toHaveBeenCalledWith("az-1", {
      importo: "3,50",
      data: "",
      controparte: "Panificio Russo",
      descrizione: "pane",
    });
    // 🔴 La seconda chiamata, quella che faceva il difetto, non parte.
    expect(finte.chiudi).not.toHaveBeenCalled();
    // Fatto: la scheda sparisce, l'elenco si rilegge per mostrare la spesa.
    expect(await screen.findByText(/L'appunto non aspetta più/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mettila fra quelle da collocare" })).toBeNull();
    expect(finte.aperte).toHaveBeenCalledTimes(2);
  });

  it("un doppio tocco mentre salva manda una chiamata sola", async () => {
    let finisci;
    finte.annota.mockImplementation(() => new Promise((r) => (finisci = r)));
    mostra();
    await screen.findByDisplayValue("pane");
    const bottone = screen.getByRole("button", { name: "Mettila fra quelle da collocare" });
    fireEvent.click(bottone);
    fireEvent.click(bottone);
    await waitFor(() => expect(finte.annota).toHaveBeenCalledTimes(1));
    finisci("sp-1");
    expect(await screen.findByText(/L'appunto non aspetta più/)).toBeTruthy();
    expect(finte.annota).toHaveBeenCalledTimes(1);
  });

  it("se dopo il salvataggio l'elenco non si rilegge, resta scritto che è fatta", async () => {
    finte.aperte.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("rete"));
    mostra();
    await screen.findByDisplayValue("pane");
    fireEvent.click(screen.getByRole("button", { name: "Mettila fra quelle da collocare" }));
    expect(await screen.findByText(/L'appunto non aspetta più/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mettila fra quelle da collocare" })).toBeNull();
  });

  it("se il database rifiuta, lo dice e la scheda resta", async () => {
    finte.annota.mockRejectedValue(new Error("Questo appunto era gia' stato chiuso. Quindi la spesa non e' stata messa fra quelle da collocare."));
    mostra();
    await screen.findByDisplayValue("pane");
    fireEvent.click(screen.getByRole("button", { name: "Mettila fra quelle da collocare" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/la spesa non e' stata messa/);
    expect(screen.getByRole("button", { name: "Mettila fra quelle da collocare" })).toBeTruthy();
    // Non chiusa: niente «Fatto», e l'elenco non si è riletto.
    expect(screen.queryByText(/L'appunto non aspetta più/)).toBeNull();
    expect(finte.aperte).toHaveBeenCalledTimes(1);
  });

  it("senza importo né descrizione non si salva", async () => {
    finte.aMano.mockResolvedValue({ ...AZIONE, campi: {} });
    mostra();
    const bottone = await screen.findByRole("button", { name: "Mettila fra quelle da collocare" });
    expect(bottone.getAttribute("aria-disabled")).toBe("true");
    expect(bottone.getAttribute("aria-describedby")).toBe("voce-manca");
    fireEvent.click(bottone);
    expect(finte.annota).not.toHaveBeenCalled();
  });

  it("un appunto già chiuso non apre la scheda", async () => {
    finte.aMano.mockResolvedValue({ ...AZIONE, stato: "eseguita", da_finire: false });
    mostra();
    await waitFor(() => expect(finte.aMano).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Mettila fra quelle da collocare" })).toBeNull();
  });

  it("senza voce la schermata è quella di sempre", async () => {
    mostra("/cassa/da-collocare");
    expect(await screen.findByText("Niente da collocare.")).toBeTruthy();
    expect(finte.aMano).not.toHaveBeenCalled();
    expect(screen.queryByText("La spesa che hai detto")).toBeNull();
  });
});
