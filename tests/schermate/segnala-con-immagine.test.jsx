import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// «SEGNALA» PORTA L'IMMAGINE DELLA PAGINA — 28/10/2026
// =====================================================================
// Chiesto da Alessio dopo la prima segnalazione: i pulsanti storti non si
// capivano dal testo. Qui si tiene fermo il riquadro, con l'immagine finta
// (il ridisegno vero lo fa il browser, e in jsdom non esiste):
//   · la frase dice cosa si salva, non «questa schermata»;
//   · mentre l'immagine si prepara non si invia;
//   · l'immagine pronta parte con la segnalazione, quella tolta no;
//   · un'immagine fallita lo dice, e la segnalazione parte lo stesso.

const crea = vi.fn();
vi.mock("../../src/lib/api/segnalazioni", () => ({
  creaSegnalazione: (...a) => crea(...a),
}));

const { RiquadroSegnala } = await import("../../src/components/Segnala.jsx");

const MOMENTO = { indirizzo: "/agenda", titolo: "Agenda", testo: "Agenda", larghezza: 390 };
const BLOB = new Blob(["x"], { type: "image/jpeg" });

function apri(scatto, onTogli = () => {}) {
  return render(
    <MemoryRouter>
      <RiquadroSegnala momento={MOMENTO} scatto={scatto} onTogliImmagine={onTogli} onChiudi={() => {}} />
    </MemoryRouter>,
  );
}

const scrivi = () =>
  fireEvent.change(screen.getByLabelText("Cosa non va?"), { target: { value: "i pulsanti escono" } });

describe("«Segnala» con l'immagine della pagina", () => {
  beforeEach(() => {
    crea.mockReset();
    crea.mockResolvedValue({ id: "s1", immagineMancata: null });
  });

  it("🔴 la frase dice cosa si salva davvero", () => {
    apri({ stato: "pronto", blob: BLOB, url: "blob:finto", tagliata: false });
    expect(screen.getByText(/Salvo anche dove sei e il testo di questa schermata: Agenda/)).toBeTruthy();
    expect(screen.queryByText(/Salvo anche questa schermata/)).toBeNull();
    expect(screen.getByAltText("Immagine della pagina che si allega")).toBeTruthy();
  });

  it("mentre l'immagine si prepara non si invia", () => {
    apri({ stato: "in_corso" });
    scrivi();
    const bottone = screen.getByRole("button", { name: "Preparo l'immagine…" });
    expect(bottone.disabled).toBe(true);
  });

  it("🔴 l'immagine pronta parte con la segnalazione", async () => {
    apri({ stato: "pronto", blob: BLOB, url: "blob:finto", tagliata: false });
    scrivi();
    fireEvent.click(screen.getByRole("button", { name: "Segnala" }));
    await waitFor(() => expect(crea).toHaveBeenCalledTimes(1));
    const [riga, immagine, chiave] = crea.mock.calls[0];
    expect(riga.testo).toBe("i pulsanti escono");
    expect(immagine).toBe(BLOB);
    expect(chiave).toMatch(/^[0-9a-f-]{36}$/);
    await screen.findByText(/Segnalata/);
  });

  it("l'immagine tolta non parte", async () => {
    apri({ stato: "tolta" });
    expect(screen.getByText("Senza immagine della pagina.")).toBeTruthy();
    scrivi();
    fireEvent.click(screen.getByRole("button", { name: "Segnala" }));
    await waitFor(() => expect(crea).toHaveBeenCalledTimes(1));
    expect(crea.mock.calls[0][1]).toBeNull();
  });

  it("«Togli immagine» chiede di toglierla", () => {
    const togli = vi.fn();
    apri({ stato: "pronto", blob: BLOB, url: "blob:finto", tagliata: true }, togli);
    expect(screen.getByText(/solo la parte in alto/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Togli immagine" }));
    expect(togli).toHaveBeenCalledTimes(1);
  });

  it("🔴 un'immagine fallita lo dice, e la segnalazione parte lo stesso", async () => {
    apri({ stato: "fallito", errore: "ci metteva troppo" });
    expect(screen.getByText(/Non sono riuscito a fare l'immagine della pagina \(ci metteva troppo\)/)).toBeTruthy();
    scrivi();
    fireEvent.click(screen.getByRole("button", { name: "Segnala" }));
    await waitFor(() => expect(crea).toHaveBeenCalledTimes(1));
    expect(crea.mock.calls[0][1]).toBeNull();
  });

  it("🔴 se il deposito respinge l'immagine, «Segnalata» lo dice", async () => {
    crea.mockResolvedValue({ id: "s1", immagineMancata: "La segnalazione è salvata, ma senza l'immagine della pagina (rete)." });
    apri({ stato: "pronto", blob: BLOB, url: "blob:finto", tagliata: false });
    scrivi();
    fireEvent.click(screen.getByRole("button", { name: "Segnala" }));
    await screen.findByText(/Segnalata/);
    expect(screen.getByText(/salvata, ma senza l'immagine della pagina/)).toBeTruthy();
  });
});
