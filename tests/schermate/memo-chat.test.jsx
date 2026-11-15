import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const finte = vi.hoisted(() => ({ manda: vi.fn(), leggiConversazioni: vi.fn(), leggiMessaggi: vi.fn(), auth: { isTitolare: true } }));
vi.mock("../../src/lib/api/chatMemo", () => ({ mandaMessaggioAMemo: (...argomenti) => finte.manda(...argomenti) }));
vi.mock("../../src/lib/api/conversazioniMemo", () => ({
  leggiConversazioniMemo: (...argomenti) => finte.leggiConversazioni(...argomenti),
  leggiMessaggiDellaConversazione: (...argomenti) => finte.leggiMessaggi(...argomenti),
}));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => finte.auth }));
const { default: PannelloChatMemo } = await import("../../src/components/PannelloChatMemo");
const { default: ApriChatMemo } = await import("../../src/components/ApriChatMemo");

const contesto = { aperta_da_percorso: "/cassa", aperta_da_modulo: "Cassa, Banca e Prima Nota" };

beforeEach(() => {
  finte.manda.mockReset();
  finte.leggiConversazioni.mockReset();
  finte.leggiMessaggi.mockReset();
  finte.leggiConversazioni.mockResolvedValue([]);
  finte.auth = { isTitolare: true };
});
afterEach(() => vi.clearAllMocks());

describe("il pannello della chat di MEMO", () => {
  it("mostra la porta della chat solo al titolare", () => {
    const apri = vi.fn();
    const { rerender } = render(<ApriChatMemo allAprire={apri} />);
    fireEvent.click(screen.getByRole("button", { name: "Apri la chat di MEMO" }));
    expect(apri).toHaveBeenCalledTimes(1);
    finte.auth = { isTitolare: false };
    rerender(<ApriChatMemo allAprire={apri} />);
    expect(screen.queryByRole("button", { name: "Apri la chat di MEMO" })).toBeNull();
  });

  it("mette il fuoco sul testo, manda il solo messaggio nuovo e mostra fonti e avviso", async () => {
    finte.manda.mockResolvedValue({
      esito: "fatto",
      conversazione_id: "c-1",
      risposta: "Hai speso 42 euro.\n\nControllalo: alcuni numeri non arrivano dai dati letti.\n\nDove l'ho letto: [C1].",
      riferimenti: [{ rif: "C1", tabella: "cash_movements" }],
    });
    render(<PannelloChatMemo contesto={contesto} alChiudere={vi.fn()} />);
    const campo = screen.getByLabelText("Scrivi a MEMO");
    expect(document.activeElement).toBe(campo);
    fireEvent.change(campo, { target: { value: "Quanto ho speso?" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Invia" })));

    expect(finte.manda).toHaveBeenCalledWith({ testo: "Quanto ho speso?", conversazioneId: null, contesto });
    expect(screen.getByText("Hai speso 42 euro.")).toBeTruthy();
    expect(screen.getByText("Dove l'ho letto:")).toBeTruthy();
    expect(screen.getByText("[C1]")).toBeTruthy();
    expect(screen.getByText(/Controllalo:/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /registra|approva|non farlo/i })).toBeNull();
  });

  it("riceve nel campo la domanda passata da MEMO voce", () => {
    render(<PannelloChatMemo contesto={contesto} testoIniziale="Quanto costa la carbonara?" alChiudere={vi.fn()} />);
    expect(screen.getByLabelText("Scrivi a MEMO").value).toBe("Quanto costa la carbonara?");
  });

  it("dice chiaramente quando il tetto ferma la chat", async () => {
    finte.manda.mockResolvedValue({ esito: "tetto", messaggio: "Hai raggiunto il tetto mensile.", conversazione_id: "c-1" });
    render(<PannelloChatMemo contesto={contesto} alChiudere={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Scrivi a MEMO"), { target: { value: "Un'altra domanda" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Invia" })));
    expect(screen.getByRole("alert").textContent).toContain("MEMO si ferma qui. Hai raggiunto il tetto mensile.");
  });

  it("si chiude con Esc e col pulsante", () => {
    const chiudi = vi.fn();
    render(<PannelloChatMemo contesto={contesto} alChiudere={chiudi} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(chiudi).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Chiudi" }));
    expect(chiudi).toHaveBeenCalledTimes(2);
  });

  it("trascrive la voce nel campo prima di inviarla", () => {
    let riconoscitore;
    class RiconoscitoreFinto {
      constructor() {
        riconoscitore = this;
      }
      start = vi.fn();
      stop = vi.fn();
    }
    window.SpeechRecognition = RiconoscitoreFinto;
    render(<PannelloChatMemo contesto={contesto} alChiudere={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Parla" }));
    riconoscitore.onresult({
      resultIndex: 0,
      results: [{ 0: { transcript: "Quanto ho speso oggi" }, isFinal: true }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Ferma" }));
    expect(screen.getByLabelText("Scrivi a MEMO").value).toBe("Quanto ho speso oggi");
    expect(riconoscitore.stop).toHaveBeenCalledTimes(1);
    delete window.SpeechRecognition;
  });

  it("riapre una conversazione con il titolo della prima domanda e la continua", async () => {
    finte.leggiConversazioni.mockResolvedValue([{
      id: "c-vecchia",
      titolo: null,
      creata_il: "2026-11-14T10:00:00.000Z",
      aperta_da_modulo: "Cassa, Banca e Prima Nota",
      memo_messaggi: [{ ruolo: "alessio", testo: "Quanto ho speso per i lavori?", creato_il: "2026-11-14T10:00:00.000Z" }],
    }]);
    finte.leggiMessaggi.mockResolvedValue([
      { ruolo: "alessio", testo: "Quanto ho speso per i lavori?", creato_il: "2026-11-14T10:00:00.000Z" },
      { ruolo: "memo", testo: "Hai speso 42 euro.\n\nDove l'ho letto: [P1].", risultati: [{ rif: "P1" }], stato: "fatto", creato_il: "2026-11-14T10:01:00.000Z" },
    ]);
    finte.manda.mockResolvedValue({ esito: "fatto", conversazione_id: "c-vecchia", risposta: "Sono 42 euro.", riferimenti: [] });
    render(<PannelloChatMemo contesto={contesto} alChiudere={vi.fn()} />);
    const vecchia = await screen.findByRole("button", { name: /Quanto ho speso per i lavori/ });
    await act(async () => fireEvent.click(vecchia));
    expect(finte.leggiMessaggi).toHaveBeenCalledWith("c-vecchia");
    expect(screen.getByText("Hai speso 42 euro.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Scrivi a MEMO"), { target: { value: "E quest'anno?" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Invia" })));
    expect(finte.manda).toHaveBeenCalledWith({ testo: "E quest'anno?", conversazioneId: "c-vecchia", contesto });
  });

  it("dopo un errore la domanda torna nel campo e si puo' riprovare", async () => {
    finte.manda.mockRejectedValue(Object.assign(new Error("Rete caduta."), { conversazioneId: "c-9" }));
    render(<PannelloChatMemo contesto={contesto} alChiudere={vi.fn()} />);
    const campo = screen.getByLabelText("Scrivi a MEMO");
    fireEvent.change(campo, { target: { value: "Quanto ho in cassa?" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Invia" })));
    expect(screen.getByRole("alert").textContent).toContain("Rete caduta.");
    expect(campo.value).toBe("Quanto ho in cassa?");
    finte.manda.mockResolvedValue({ esito: "fatto", conversazione_id: "c-9", risposta: "Fatto.", riferimenti: [] });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Invia" })));
    expect(finte.manda).toHaveBeenLastCalledWith({ testo: "Quanto ho in cassa?", conversazioneId: "c-9", contesto });
  });

  it("chiuso e riaperto non perde la conversazione", async () => {
    finte.manda.mockResolvedValue({ esito: "fatto", conversazione_id: "c-2", risposta: "Hai 10 euro.", riferimenti: [] });
    const { rerender } = render(<PannelloChatMemo contesto={contesto} alChiudere={vi.fn()} aperto />);
    fireEvent.change(screen.getByLabelText("Scrivi a MEMO"), { target: { value: "Quanto?" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Invia" })));
    rerender(<PannelloChatMemo contesto={contesto} alChiudere={vi.fn()} aperto={false} />);
    rerender(<PannelloChatMemo contesto={contesto} alChiudere={vi.fn()} aperto />);
    expect(screen.getByText("Hai 10 euro.")).toBeTruthy();
  });

  it("chiudendo il pannello il microfono si spegne e la frase detta resta nel campo", () => {
    let riconoscitore;
    class RiconoscitoreFinto {
      constructor() { riconoscitore = this; }
      start = vi.fn();
      stop = vi.fn();
    }
    window.SpeechRecognition = RiconoscitoreFinto;
    const { rerender } = render(<PannelloChatMemo contesto={contesto} alChiudere={vi.fn()} aperto />);
    fireEvent.click(screen.getByRole("button", { name: "Parla" }));
    act(() => riconoscitore.onresult({ resultIndex: 0, results: [{ 0: { transcript: "Quanto ho in cassa" }, isFinal: true }] }));
    rerender(<PannelloChatMemo contesto={contesto} alChiudere={vi.fn()} aperto={false} />);
    expect(riconoscitore.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Scrivi a MEMO", { hidden: true }).value).toBe("Quanto ho in cassa");
    delete window.SpeechRecognition;
  });

  it("il grassetto scritto con gli asterischi si vede in grassetto vero", async () => {
    finte.manda.mockResolvedValue({ esito: "fatto", conversazione_id: "c-3", risposta: "Ci sono **63 voci** in tutto.", riferimenti: [] });
    render(<PannelloChatMemo contesto={contesto} alChiudere={vi.fn()} aperto />);
    fireEvent.change(screen.getByLabelText("Scrivi a MEMO"), { target: { value: "Quante voci?" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Invia" })));
    expect(screen.getByText("63 voci").tagName).toBe("STRONG");
    expect(document.body.textContent).not.toContain("**");
  });
});
