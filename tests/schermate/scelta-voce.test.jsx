import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// La voce del piano chiesta quando si spunta «investimento» (parte 6 del
// piano, 07/11/2026). La regola vera la tiene il database
// (20261107000003); qui si guarda che la schermata non salvi senza voce.

const finto = vi.hoisted(() => ({ piano: null, rompi: false }));

vi.mock("../../src/lib/api/spuntaInvestimento", () => ({
  vociPerLaSpunta: vi.fn(async () => {
    if (finto.rompi) throw new Error("rete giù");
    return structuredClone(finto.piano);
  }),
}));

beforeEach(() => {
  vi.resetModules();
  finto.rompi = false;
  finto.piano = {
    meseApertura: "2027-04-01",
    voci: [
      { id: "v1", gruppo: "A", ordine: 1, descrizione: "Forno" },
      { id: "v2", gruppo: "D", ordine: 1, descrizione: "Sgabelli" },
    ],
    rate: [{ id: "r1", voce_id: "v1", mese_rel: 0, importo: 500 }],
  };
});

async function monta(props) {
  const { SpuntaConVoce } = await import("../../src/components/SceltaVoce.jsx");
  return render(
    <SpuntaConVoce etichetta="Investimento per il progetto" {...props}>
      <span>Investimento per il progetto</span>
    </SpuntaConVoce>
  );
}

describe("la spunta «investimento» chiede la voce", () => {
  it("spuntando non salva: chiede la voce, e «Segna» resta spento finché non c'è", async () => {
    const onSegna = vi.fn(async () => {});
    await monta({ segnata: false, onSegna, onTogli: vi.fn() });
    fireEvent.click(screen.getByRole("checkbox", { name: "Investimento per il progetto" }));
    const voce = await screen.findByLabelText("Voce del piano");
    expect(screen.getByRole("button", { name: "Segna investimento" }).disabled).toBe(true);
    fireEvent.change(voce, { target: { value: "v1" } });
    // La voce ha una rata: si può dire quale paga.
    fireEvent.change(screen.getByLabelText("Quale rata paga"), { target: { value: "r1" } });
    fireEvent.click(screen.getByRole("button", { name: "Segna investimento" }));
    await waitFor(() => expect(onSegna).toHaveBeenCalledWith({ voceId: "v1", rataId: "r1" }));
    expect(onSegna).toHaveBeenCalledTimes(1);
  });

  it("le voci stanno sotto il loro gruppo", async () => {
    await monta({ segnata: false, onSegna: vi.fn(), onTogli: vi.fn() });
    fireEvent.click(screen.getByRole("checkbox"));
    await screen.findByLabelText("Voce del piano");
    const gruppi = [...document.querySelectorAll("optgroup")].map((g) => g.label);
    expect(gruppi).toEqual(["A. Attrezzature cucina", "D. Arredi e allestimento"]);
  });

  it("«Annulla» chiude senza salvare niente", async () => {
    const onSegna = vi.fn();
    await monta({ segnata: false, onSegna, onTogli: vi.fn() });
    fireEvent.click(screen.getByRole("checkbox"));
    await screen.findByLabelText("Voce del piano");
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.queryByLabelText("Voce del piano")).toBeNull();
    expect(screen.getByRole("checkbox").checked).toBe(false);
    expect(onSegna).not.toHaveBeenCalled();
  });

  it("togliendo la spunta a una riga segnata, toglie subito", async () => {
    const onTogli = vi.fn(async () => {});
    await monta({ segnata: true, onSegna: vi.fn(), onTogli });
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(onTogli).toHaveBeenCalledTimes(1));
  });

  it("il rifiuto si legge accanto alla spunta, e la scelta resta aperta", async () => {
    const onSegna = vi.fn(async () => {
      throw new Error("Questa spesa è dell'orto.");
    });
    await monta({ segnata: false, onSegna, onTogli: vi.fn() });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(await screen.findByLabelText("Voce del piano"), { target: { value: "v2" } });
    fireEvent.click(screen.getByRole("button", { name: "Segna investimento" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/dell'orto/);
    expect(screen.getByLabelText("Voce del piano")).toBeTruthy();
  });

  it("un piano senza voci lo dice, e non offre una lista vuota", async () => {
    finto.piano.voci = [];
    await monta({ segnata: false, onSegna: vi.fn(), onTogli: vi.fn() });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(await screen.findByText(/non ha ancora voci/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Segna investimento" }).disabled).toBe(true);
  });

  it("se le voci non si leggono, lo dice: non vuol dire che non ce ne sono", async () => {
    finto.rompi = true;
    await monta({ segnata: false, onSegna: vi.fn(), onTogli: vi.fn() });
    fireEvent.click(screen.getByRole("checkbox"));
    expect((await screen.findByRole("alert")).textContent).toMatch(/non vuol dire che non ce ne sono/);
  });
});
