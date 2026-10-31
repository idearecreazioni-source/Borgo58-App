import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// LE CHIAVI DEI PROMEMORIA PER LUOGO (1/11/2026, revisione M10).
// Un doppio tocco su «Crea una chiave» ne creava due, e la prima (visibile
// una volta sola) si perdeva. «Togli» revocava senza chiedere.

const api = vi.hoisted(() => ({
  chiavi: vi.fn(),
  crea: vi.fn(),
  revoca: vi.fn(),
}));

vi.mock("../../src/lib/api/luoghi", () => ({
  chiaviLuogo: (...a) => api.chiavi(...a),
  creaChiaveLuogo: (...a) => api.crea(...a),
  revocaChiaveLuogo: (...a) => api.revoca(...a),
  indirizzoPromemoriaLuogo: () => "https://esempio.test/luogo",
}));

import Pagina from "../../src/pages/agenda/PromemoriaLuogo";

function apri() {
  return render(
    <MemoryRouter>
      <Pagina />
    </MemoryRouter>,
  );
}

describe("PromemoriaLuogo", () => {
  beforeEach(() => {
    api.chiavi.mockReset().mockResolvedValue([]);
    api.crea.mockReset();
    api.revoca.mockReset().mockResolvedValue(undefined);
  });

  it("un doppio tocco su «Crea una chiave» ne crea una sola", async () => {
    let finisci;
    api.crea.mockReturnValue(new Promise((si) => (finisci = si)));
    apri();
    const tasto = await screen.findByRole("button", { name: "Crea una chiave" });

    fireEvent.click(tasto);
    fireEvent.click(tasto);
    expect(api.crea).toHaveBeenCalledTimes(1);
    expect(tasto.disabled).toBe(true);

    finisci({ nome: "iPhone", chiave: "segreta-1" });
    await screen.findByText("segreta-1");
    expect(api.crea).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(tasto.disabled).toBe(false));
  });

  it("dopo un errore il tasto si può premere di nuovo", async () => {
    api.crea.mockRejectedValueOnce(new Error("rete giù")).mockResolvedValue({ nome: "iPhone", chiave: "k2" });
    apri();
    const tasto = await screen.findByRole("button", { name: "Crea una chiave" });
    fireEvent.click(tasto);
    await screen.findByText(/rete giù/);
    await waitFor(() => expect(tasto.disabled).toBe(false));
    fireEvent.click(tasto);
    await screen.findByText("k2");
    expect(api.crea).toHaveBeenCalledTimes(2);
  });

  it("«Togli» chiede conferma prima di revocare", async () => {
    api.chiavi.mockResolvedValue([{ id: "k1", nome: "iPhone", usi: 0, revocata_il: null }]);
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "Togli" }));
    expect(api.revoca).not.toHaveBeenCalled();
    expect(screen.getByText(/iPhone/, { selector: "span.text-b58-terracotta-dark-testo" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(api.revoca).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "Togli" }));
    fireEvent.click(screen.getByRole("button", { name: "Sì, togli" }));
    await waitFor(() => expect(api.revoca).toHaveBeenCalledWith("k1"));
    expect(api.revoca).toHaveBeenCalledTimes(1);
  });

  it("«Togli» ricarica la lista senza azzerare la chiave appena creata", async () => {
    api.chiavi.mockResolvedValue([{ id: "k1", nome: "vecchia", usi: 0, revocata_il: null }]);
    api.crea.mockResolvedValue({ nome: "iPhone", chiave: "segreta-nuova" });
    apri();
    fireEvent.click(await screen.findByRole("button", { name: "Crea una chiave" }));
    await screen.findByText("segreta-nuova");
    const letture = api.chiavi.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Togli" }));
    fireEvent.click(screen.getByRole("button", { name: "Sì, togli" }));
    await waitFor(() => expect(api.revoca).toHaveBeenCalledWith("k1"));
    await waitFor(() => expect(api.chiavi.mock.calls.length).toBeGreaterThan(letture));
    expect(screen.getByText("segreta-nuova")).toBeTruthy();
  });
});
