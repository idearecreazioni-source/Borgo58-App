import { MemoryRouter } from "react-router-dom";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// UN DATO NON LETTO NON SI MOSTRA VUOTO — 11/09/2026, mandato notturno 2
// =====================================================================
// 🔴 COSA SI PROVA:
//    · la scheda degli allergeni di un piatto, quando la lettura fallisce,
//      NON scrive «Nessun allergene risulta dagli ingredienti di questo
//      piatto» (lo faceva: `setRighe([])`), ma dice che non ha letto, con
//      Riprova — e riprovando si torna all'elenco vero;
//    · la riga «non riesco a leggere» usa la frase della schermata in tutte
//      e due le forme, e un pezzo di frase non esce più da solo.

const finte = { allergeni: vi.fn(), catena: vi.fn() };
vi.mock("../../src/lib/api/recipes", () => ({
  allergeniDelPiatto: (...a) => finte.allergeni(...a),
  catenaAllergeni: (...a) => finte.catena(...a),
  dimenticaScelta: vi.fn(),
  salvaScelta: vi.fn(),
  salvaSostituzione: vi.fn(),
  togliSostituzione: vi.fn(),
}));

const { default: AllergeniDelPiatto } = await import("../../src/components/AllergeniDelPiatto");
const { default: DatoNonLetto } = await import("../../src/components/DatoNonLetto");

const NESSUNO = /Nessun allergene risulta dagli ingredienti di questo piatto/;

const mostra = () =>
  render(
    <MemoryRouter>
      <AllergeniDelPiatto recipeId="r1" />
    </MemoryRouter>,
  );

beforeEach(() => {
  finte.allergeni.mockReset();
  finte.catena.mockReset().mockResolvedValue([]);
});

describe("🔴 gli allergeni di un piatto", () => {
  it("se la lettura fallisce NON dice «nessun allergene»: dice che non lo sa, e si riprova", async () => {
    finte.allergeni.mockRejectedValueOnce(new Error("rete assente"));
    mostra();
    await waitFor(() => expect(screen.getByText(/Non riesco a leggere gli allergeni di questo piatto/)).toBeTruthy());
    expect(screen.queryByText(NESSUNO)).toBeNull();
    expect(screen.getByText(/Non vuol dire che non ne ha/)).toBeTruthy();

    finte.allergeni.mockResolvedValueOnce([]);
    await act(async () => {
      screen.getByRole("button", { name: "Riprova" }).click();
    });
    await waitFor(() => expect(screen.getByText(NESSUNO)).toBeTruthy());
    expect(screen.queryByText(/Non riesco a leggere/)).toBeNull();
  });

  it("letta e vuota, lo dice come prima", async () => {
    finte.allergeni.mockResolvedValueOnce([]);
    mostra();
    await waitFor(() => expect(screen.getByText(NESSUNO)).toBeTruthy());
  });
});

describe("🔴 la riga «non riesco a leggere»", () => {
  it("forma breve: usa la frase della schermata, e completa un pezzo di frase", () => {
    const { container } = render(<DatoNonLetto cosa="le sezioni dell'archivio" nonVuolDire="che non ce ne siano" />);
    expect(container.textContent).toBe(
      "Non riesco a leggere le sezioni dell'archivio. Non vuol dire che non ce ne siano: vuol dire che non lo so.",
    );
  });

  it("forma breve senza frase: resta quella di sempre", () => {
    const { container } = render(<DatoNonLetto cosa="le temperature" />);
    expect(container.textContent).toBe(
      "Non riesco a leggere le temperature: non vuol dire che non ce n'è, vuol dire che non lo so.",
    );
  });

  it("forma lunga: il pezzo della scheda documento diventa una frase intera", () => {
    render(
      <DatoNonLetto
        cosa="le sezioni dell'archivio"
        nonVuolDire="che questo documento non abbia una sezione"
        onRiprova={() => {}}
      />,
    );
    expect(
      screen.getByText("Non vuol dire che questo documento non abbia una sezione: vuol dire che non lo so."),
    ).toBeTruthy();
  });

  it("forma lunga: una frase intera resta com'è", () => {
    const f = "Non vuol dire che è vuota: vuol dire che non lo so. Di solito è la connessione.";
    render(<DatoNonLetto cosa="la sala" nonVuolDire={f} onRiprova={() => {}} />);
    expect(screen.getByText(f)).toBeTruthy();
  });
});
