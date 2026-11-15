import { beforeEach, describe, expect, it, vi } from "vitest";
import { contestoDellaChat, dataDellaConversazione, partiDellaRisposta, riferimentiBrevi, titoloDellaConversazione } from "../../src/lib/calcoli/chatMemo";

const finte = vi.hoisted(() => ({ invoca: vi.fn() }));
vi.mock("../../src/lib/supabase", () => ({
  supabase: { functions: { invoke: (...argomenti) => finte.invoca(...argomenti) } },
}));
const { mandaMessaggioAMemo } = await import("../../src/lib/api/chatMemo");

describe("il contratto del pannello della chat", () => {
  beforeEach(() => finte.invoca.mockReset());

  it("manda solo il messaggio nuovo, la conversazione e il contesto", async () => {
    finte.invoca.mockResolvedValue({
      data: { esito: "fatto", conversazione_id: "conversazione-1", risposta: "Va bene." },
      error: null,
    });
    await mandaMessaggioAMemo({
      testo: " Quanto ho speso? ",
      conversazioneId: "conversazione-vecchia",
      contesto: { aperta_da_percorso: "/cassa", aperta_da_modulo: "Cassa, Banca e Prima Nota" },
    });
    expect(finte.invoca).toHaveBeenCalledWith("memo-chat", {
      body: {
        testo: "Quanto ho speso?",
        conversazione_id: "conversazione-vecchia",
        aperta_da_percorso: "/cassa",
        aperta_da_modulo: "Cassa, Banca e Prima Nota",
      },
    });
    expect(JSON.stringify(finte.invoca.mock.calls[0][1].body)).not.toContain("storico");
  });

  it("lascia arrivare il tetto come un arresto leggibile", async () => {
    finte.invoca.mockResolvedValue({
      data: null,
      error: { context: { json: vi.fn().mockResolvedValue({ esito: "tetto", messaggio: "Hai raggiunto il tetto." }) } },
    });
    await expect(mandaMessaggioAMemo({ testo: "Ancora?" })).resolves.toMatchObject({ esito: "tetto" });
  });

  it("traduce il freno della funzione senza mostrare dettagli tecnici", async () => {
    finte.invoca.mockResolvedValue({
      data: null,
      error: { context: { json: vi.fn().mockResolvedValue({ errore: { codice: "freno", messaggio: "Non riesco a controllare il tetto della chat." } }) } },
    });
    await expect(mandaMessaggioAMemo({ testo: "Ancora?" })).rejects.toMatchObject({
      message: "Non riesco a controllare il tetto della chat.",
      codice: "freno",
    });
  });
});

describe("le parole che il pannello mostra", () => {
  it("manda il percorso e il modulo leggibile della schermata", () => {
    expect(contestoDellaChat({ pathname: "/cassa/prima-nota" }, [{ route: "/cassa", name: "Cassa, Banca e Prima Nota" }])).toEqual({
      aperta_da_percorso: "/cassa/prima-nota",
      aperta_da_modulo: "Cassa, Banca e Prima Nota",
    });
  });

  it("separa risposta, avviso e fonti, senza esporre una tabella tecnica", () => {
    expect(partiDellaRisposta(
      "Hai speso 42 euro.\n\nControllalo: alcuni numeri non arrivano dai dati letti.\n\nDove l'ho letto: [C1], [P2].",
      [{ rif: "C1", tabella: "cash_movements" }, { rif: "P2", tabella: "piano_voci" }],
    )).toEqual({
      testo: "Hai speso 42 euro.",
      controllalo: "alcuni numeri non arrivano dai dati letti.",
      dove: "[C1], [P2]",
    });
    expect(riferimentiBrevi([{ rif: "C1" }, { rif: "D1" }, { rif: "B1" }, { rif: "R1" }, { rif: "P2" }])).toEqual(["C1", "D1", "B1", "R1", "P2"]);
  });

  it("da' un titolo leggibile alle conversazioni senza titolo", () => {
    expect(titoloDellaConversazione({
      titolo: null,
      memo_messaggi: [{ ruolo: "alessio", testo: "  Quanto   ho speso per i lavori? ", creato_il: "2026-11-14T10:00:00Z" }],
    })).toBe("Quanto ho speso per i lavori?");
    expect(dataDellaConversazione("2026-11-14T10:00:00Z")).toMatch(/nov 2026/i);
  });
});
