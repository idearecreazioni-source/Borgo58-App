import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// =====================================================================
// LA RISPOSTA PARLATA DELLE GIACENZE (V2, 11/10/2026)
// =====================================================================
// La voce è finta: si conta COSA verrebbe detto e QUANDO. Se suona davvero
// bene su un telefono si guarda su un telefono.
//
// (Impalcatura presa da memo-suoni.test.jsx.)
//
// 🔴 QUELLO CHE QUESTE PROVE SORVEGLIANO È IL CASO CATTIVO. Un suono al
//    tocco direbbe «sto registrando» anche quando il permesso è negato, il
//    microfono è occupato da un'altra app, o la pagina non è su un
//    indirizzo cifrato — e in tutti quei casi si parlerebbe a vuoto
//    convinti del contrario. Il segnale giusto è `onaudiostart`, cioè il
//    momento in cui l'audio entra davvero.
//
// ⚠️ NIENTE DI VERO VIENE TOCCATO: nessun microfono, nessun database,
//    nessun suono che esca da un altoparlante. Il riconoscitore è finto e
//    i suoni sono contati.

const suoni = { aperto: vi.fn(), chiuso: vi.fn(), prepara: vi.fn() };

vi.mock("../../src/lib/suoni", () => ({
  suonoMicrofonoAperto: (...a) => suoni.aperto(...a),
  suonoMicrofonoChiuso: (...a) => suoni.chiuso(...a),
  preparaSuoni: (...a) => suoni.prepara(...a),
  suoniAccesi: () => true,
  accendiSuoni: vi.fn(),
}));

vi.mock("../../src/lib/api/voce", () => ({
  appuntiDaApprovare: vi.fn(() => Promise.resolve([])),
  approvaAppunto: vi.fn(),
  azioniDellaDettatura: vi.fn(() =>
    Promise.resolve([
      { id: "a1", tipo: "giacenza", stato: "eseguita", frase: "Olio: ce ne sono 2 l" },
    ])
  ),
  chiaviVoce: vi.fn(() => Promise.resolve([])),
  creaChiaveVoce: vi.fn(),
  mandaDettato: vi.fn(() => Promise.resolve({ dettatura_id: "d-1" })),
  revocaChiaveVoce: vi.fn(),
  scartaAppunto: vi.fn(),
  scegliPerAzione: vi.fn(),
}));
vi.mock("../../src/lib/api/assistenteFoto", () => ({
  spesaAiDelMese: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("../../src/lib/api/domandeMemo", () => ({ rispondiA: vi.fn() }));
vi.mock("../../src/lib/calcoli/domande", () => ({ titoloDellaDomanda: () => "Una domanda" }));
vi.mock("../../src/components/RispostaMemo", () => ({ default: () => <div /> }));

let finto = null;
vi.mock("../../src/lib/calcoli/voce", async (vero) => {
  const dentro = await vero();
  return {
    ...dentro,
    riconoscitoreDisponibile: () => true,
    statoDettatura: () => ({ frase: "", cosaFare: "" }),
    creaRiconoscitore: () => {
      finto = { start: vi.fn(), stop: vi.fn() };
      return finto;
    },
  };
});

const voce = vi.hoisted(() => ({ parla: vi.fn(), sblocca: vi.fn(), accesa: true, imposta: vi.fn() }));
vi.mock("../../src/lib/voceParlata", () => ({
  parla: (...a) => voce.parla(...a),
  sbloccaVoce: (...a) => voce.sblocca(...a),
  rispostaParlataAccesa: () => voce.accesa,
  impostaRispostaParlata: (...a) => voce.imposta(...a),
  vocePresente: () => true,
}));

const { default: Detta } = await import("../../src/pages/assistente/Detta");

const detta = async (testo) => {
  render(
    <MemoryRouter>
      <Detta />
    </MemoryRouter>
  );
  const premi = screen.getAllByRole("button").find((b) => /premi e parla/i.test(b.textContent));
  fireEvent.click(premi);
  await act(async () => finto.onaudiostart?.());
  await act(async () =>
    finto.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: testo }], { isFinal: true })] })
  );
  const ferma = screen.getAllByRole("button").find((b) => /ferma e manda/i.test(b.textContent));
  await act(async () => fireEvent.click(ferma));
};

describe("la risposta parlata", () => {
  it("dopo una giacenza segnata, MEMO la ripete a voce", async () => {
    voce.parla.mockClear();
    voce.accesa = true;
    await detta("ci sono due litri di olio");
    expect(await screen.findByText("Olio: ce ne sono 2 l")).toBeTruthy();
    expect(voce.parla).toHaveBeenCalledWith("Segnato. Olio: ce ne sono 2 l.");
    // La voce si prepara dentro il tocco: su iPhone è l'unico momento.
    expect(voce.sblocca).toHaveBeenCalled();
  });

  it("spenta, non dice niente — e lo schermo resta uguale", async () => {
    voce.parla.mockClear();
    voce.accesa = false;
    await detta("ci sono due litri di olio");
    expect(await screen.findByText("Olio: ce ne sono 2 l")).toBeTruthy();
    expect(voce.parla).not.toHaveBeenCalled();
    voce.accesa = true;
  });
});
