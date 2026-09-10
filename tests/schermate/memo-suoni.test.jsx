import { MemoryRouter } from "react-router-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// =====================================================================
// I DUE SUONI ARRIVANO QUANDO IL MICROFONO È DAVVERO APERTO
// =====================================================================
// 10/09/2026, Blocco 5 del mandato notturno.
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
  azioniDellaDettatura: vi.fn(() => Promise.resolve([])),
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

const { default: Detta } = await import("../../src/pages/assistente/Detta");

const apri = () => {
  suoni.aperto.mockClear();
  suoni.chiuso.mockClear();
  suoni.prepara.mockClear();
  finto = null;
  render(
    <MemoryRouter>
      <Detta />
    </MemoryRouter>
  );
};

const premiIlMicrofono = () => {
  const pulsanti = screen.getAllByRole("button");
  const acceso = pulsanti.find((b) => /parla|detta|microfono/i.test(b.textContent));
  fireEvent.click(acceso ?? pulsanti[0]);
};

describe("il suono di apertura", () => {
  it("🔴 NON arriva al tocco: solo quando l'audio entra davvero", async () => {
    apri();
    premiIlMicrofono();
    // Il riconoscitore è partito, ma il microfono non ha ancora aperto
    // niente: qui un suono sarebbe una bugia.
    expect(finto, "il riconoscitore non è stato creato").toBeTruthy();
    expect(suoni.aperto, "ha suonato al tocco, prima che il microfono si aprisse").not.toHaveBeenCalled();

    await act(async () => finto.onaudiostart?.());
    expect(suoni.aperto).toHaveBeenCalledTimes(1);
  });

  it("🔴 e se il microfono non parte MAI, non suona niente", async () => {
    // È il caso che dà il senso a tutto: permesso negato, microfono
    // occupato, pagina non cifrata. Chi sente un suono parla a vuoto.
    apri();
    premiIlMicrofono();
    await act(async () => finto.onerror?.({ error: "not-allowed" }));
    expect(suoni.aperto).not.toHaveBeenCalled();
    expect(suoni.chiuso, "ha suonato la fine di una registrazione mai cominciata").not.toHaveBeenCalled();
  });

  it("⚠️ e suona UNA volta sola, anche se il riconoscimento si riapre", async () => {
    // Il riconoscimento si chiude da sé dopo una pausa lunga e viene
    // riaperto: senza la guardia il bip tornerebbe in mezzo alla
    // dettatura, dove non dice niente di nuovo e interrompe.
    apri();
    premiIlMicrofono();
    await act(async () => finto.onaudiostart?.());
    await act(async () => finto.onaudiostart?.());
    await act(async () => finto.onaudiostart?.());
    expect(suoni.aperto).toHaveBeenCalledTimes(1);
  });

  it("l'audio si prepara dentro il tocco, che è l'unico momento in cui si può", () => {
    // I browser aprono l'audio solo dentro un gesto di chi guarda:
    // creandolo al primo suono — che arriva da un evento del sistema — il
    // suono resterebbe muto sul telefono, e a schermo non si vedrebbe
    // niente.
    apri();
    premiIlMicrofono();
    expect(suoni.prepara).toHaveBeenCalled();
  });
});

describe("il suono di fine", () => {
  // 🔴 QUESTA PROVA È NATA DA UNA ROTTURA CHE NESSUNO PRENDEVA. Togliendo
  //    la guardia sul suono di fine, tutte e cinque le prove restavano
  //    verdi: nessuna arrivava a premere «Ferma e manda» senza che il
  //    microfono si fosse aperto. *Una prova che passa non dimostra di
  //    sorvegliare quello che il suo titolo dice.*
  it("🔴 NON arriva se il microfono non si era mai aperto", async () => {
    // Un suono di fine su una registrazione mai cominciata dice che
    // qualcosa è stato registrato — ed è la stessa bugia del suono al
    // tocco, letta dall'altro capo.
    apri();
    premiIlMicrofono();
    const ferma = screen.getAllByRole("button").find((b) => /ferma e manda/i.test(b.textContent));
    expect(ferma, "il pulsante per fermare non c'è").toBeTruthy();
    await act(async () => fireEvent.click(ferma));
    expect(suoni.chiuso).not.toHaveBeenCalled();
  });

  it("🔴 arriva quando si chiude, ed è DIVERSO da quello di apertura", async () => {
    apri();
    premiIlMicrofono();
    await act(async () => finto.onaudiostart?.());
    suoni.aperto.mockClear();

    const ferma = screen.getAllByRole("button").find((b) => /ferma e manda/i.test(b.textContent));
    expect(ferma, "il pulsante per fermare non c'è").toBeTruthy();
    await act(async () => fireEvent.click(ferma));

    expect(suoni.chiuso).toHaveBeenCalledTimes(1);
    expect(suoni.aperto, "il suono di fine è lo stesso di quello di apertura").not.toHaveBeenCalled();
  });
});
