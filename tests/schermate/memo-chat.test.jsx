import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const finte = vi.hoisted(() => ({ manda: vi.fn(), auth: { isTitolare: true } }));
vi.mock("../../src/lib/api/chatMemo", () => ({ mandaMessaggioAMemo: (...argomenti) => finte.manda(...argomenti) }));
vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => finte.auth }));
const { default: PannelloChatMemo } = await import("../../src/components/PannelloChatMemo");
const { default: ApriChatMemo } = await import("../../src/components/ApriChatMemo");

const contesto = { aperta_da_percorso: "/cassa", aperta_da_modulo: "Cassa, Banca e Prima Nota" };

beforeEach(() => {
  finte.manda.mockReset();
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
});
