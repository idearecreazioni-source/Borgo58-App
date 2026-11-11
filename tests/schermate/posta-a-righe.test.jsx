import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LA POSTA A RIGHE — 08/11/2026
// =====================================================================
// Alessio, guardando la Posta con le prime PEC vere: blocchi lunghi tutti
// aperti, i file tecnici della PEC in vista, note rosse in gergo, riquadri
// «Niente — Senza titolo», pulsanti lunghi una riga. Modello approvato
// l'08/11: una riga per mail con un bollino, tre schede, pulsanti corti.
// Nomi e numeri inventati: il repository è pubblico.

const IN_ATTESA = [
  {
    id: "m1",
    stato: "proposta",
    mittente: "Fornitore Esempio srl <fatture@esempio.it>",
    oggetto: "Fattura 412/F",
    casella: "info@locale.it",
    ricevuta_il: "2026-11-08T09:42:00Z",
    proposta_sintesi: "Una fattura da archiviare.",
    // Una nota di prima della lettura delle PEC: parla solo di file della busta.
    lettura_note: "daticert.xml: formato che non so aprire (application/xml)",
    allegati: [
      { id: "al1", file_name: "fattura-412.pdf", storage_path: "x/1" },
      { id: "al2", file_name: "daticert.xml", storage_path: "x/2" },
      { id: "al3", file_name: "smime.p7s", storage_path: "x/3" },
    ],
    azioni: [
      {
        id: "a1",
        tipo: "archivia_documento",
        titolo: "Fattura 412/F",
        descrizione: "Archivia la fattura 412/F fra le fatture ricevute.",
        parametri: { titolo: "Fattura 412/F", tipo: "fatture", data: "2026-11-05" },
        stato: "proposta",
      },
    ],
  },
  {
    id: "m2",
    stato: "proposta",
    mittente: "Newsletter Esempio <news@esempio.it>",
    oggetto: "Le novità del mese",
    ricevuta_il: "2026-11-01T08:00:00Z",
    allegati: [],
    azioni: [{ id: "a2", tipo: "nessuna", titolo: "Senza titolo", descrizione: null, parametri: {}, stato: "proposta" }],
  },
];

const finte = {
  confermaAzione: vi.fn(() => Promise.resolve({})),
  scartaPosta: vi.fn(() => Promise.resolve()),
  rimettiPosta: vi.fn(() => Promise.resolve()),
  listPostaInAttesa: vi.fn(() => Promise.resolve(IN_ATTESA)),
  listPostaSistemata: vi.fn(() => Promise.resolve([])),
  aggiungiFiltroPosta: vi.fn(() => Promise.resolve({})),
};

vi.mock("../../src/lib/api/posta", () => ({
  SISTEMATE_MAX: 50,
  listPostaInAttesa: (...a) => finte.listPostaInAttesa(...a),
  listPostaSistemata: (...a) => finte.listPostaSistemata(...a),
  confermaAzione: (...a) => finte.confermaAzione(...a),
  scartaPosta: (...a) => finte.scartaPosta(...a),
  rimettiPosta: (...a) => finte.rimettiPosta(...a),
  aggiungiFiltroPosta: (...a) => finte.aggiungiFiltroPosta(...a),
  listFiltriPosta: vi.fn(() => Promise.resolve([])),
  togliFiltroPosta: vi.fn(() => Promise.resolve()),
  rifiutaAzione: vi.fn(() => Promise.resolve()),
  registraFatturaDallaPosta: vi.fn(() => Promise.resolve({})),
  riprovaLettura: vi.fn(() => Promise.resolve()),
  chiediLetturaAdesso: vi.fn(() => Promise.resolve()),
  getAllegatoUrl: vi.fn(() => Promise.resolve("https://esempio.invalid/file")),
  getMaxTentativiLettura: vi.fn(() => Promise.resolve(3)),
  lettorePostaFermo: vi.fn(() => Promise.resolve({ fermo: false, minuti: 0 })),
}));
vi.mock("../../src/lib/api/ingredients", () => ({ listIngredients: vi.fn(() => Promise.resolve([])) }));
vi.mock("../../src/lib/api/documents", () => ({
  sezioniArchivio: vi.fn(() => Promise.resolve([{ codice: "fatture", etichetta: "Fatture ricevute" }])),
}));
vi.mock("../../src/lib/api/suppliers", () => ({ listSuppliers: vi.fn(() => Promise.resolve([])) }));
vi.mock("../../src/lib/api/entities", () => ({
  getEntities: vi.fn(() => Promise.resolve({ srls: { id: "e1", name: "Borgo 58 srls" }, agricola: null })),
}));
vi.mock("../../src/lib/api/assistente", () => ({
  variantiIngrediente: vi.fn(() => Promise.resolve([])),
  variazionePrezzo: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("../../src/lib/api/shoppingList", () => ({ righeListaAperte: vi.fn(() => Promise.resolve([])) }));

const { default: PostaInArrivo } = await import("../../src/pages/documenti/PostaInArrivo");

function apri() {
  return render(
    <MemoryRouter>
      <PostaInArrivo />
    </MemoryRouter>
  );
}

beforeEach(() => {
  for (const f of Object.values(finte)) f.mockClear();
});

describe("la Posta a righe", () => {
  it("una riga per mail, chiusa, con il bollino; «Da decidere» non mostra le mail senza niente da fare", async () => {
    apri();
    const riga = await screen.findByRole("button", { name: /Fornitore Esempio srl/ });
    expect(riga.getAttribute("aria-expanded")).toBe("false");
    expect(within(riga).getByText("Da decidere")).toBeTruthy();
    // La newsletter con la sola «nessuna» non è da decidere.
    expect(screen.queryByRole("button", { name: /Newsletter Esempio/ })).toBeNull();
    // Il pulsante della proposta non si vede finché la mail è chiusa.
    expect(screen.queryByRole("button", { name: /^Archivia/ })).toBeNull();
  });

  it("aperta: allegati veri in vista, quelli della busta nascosti, nessuna nota in gergo", async () => {
    apri();
    fireEvent.click(await screen.findByRole("button", { name: /Fornitore Esempio srl/ }));
    expect(screen.getByRole("button", { name: "fattura-412.pdf" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "daticert.xml" })).toBeNull();
    expect(screen.getByText(/2 file tecnici della PEC nascosti/)).toBeTruthy();
    expect(screen.queryByText(/application\/xml/)).toBeNull();
    expect(screen.queryByText(/formato che non so aprire/)).toBeNull();
  });

  it("pulsanti corti: «Archivia» si vede, il nome intero lo legge il lettore di schermo", async () => {
    apri();
    fireEvent.click(await screen.findByRole("button", { name: /Fornitore Esempio srl/ }));
    const archivia = screen.getByRole("button", { name: "Archivia «Fattura 412/F»" });
    expect(archivia.textContent).toMatch(/^Archivia$/);
    expect(screen.getByRole("button", { name: /^No, non archiviare/ }).textContent).toMatch(/^No$/);
    expect(screen.getByRole("button", { name: /^Correggi/ }).textContent).toMatch(/^Correggi$/);
    fireEvent.click(archivia);
    await waitFor(() => expect(finte.confermaAzione).toHaveBeenCalledWith("a1", expect.objectContaining({ tipo: "fatture" })));
  });

  it("«Sistemate» mostra la mail senza niente da fare, senza il riquadro «Senza titolo»", async () => {
    apri();
    fireEvent.click(await screen.findByRole("tab", { name: /Sistemate/ }));
    const riga = await screen.findByRole("button", { name: /Newsletter Esempio/ });
    expect(within(riga).getByText("Niente da fare")).toBeTruthy();
    fireEvent.click(riga);
    expect(screen.queryByText(/Senza titolo/)).toBeNull();
    expect(finte.listPostaSistemata).toHaveBeenCalled();
  });

  it("«Togli la mail» si può annullare", async () => {
    apri();
    fireEvent.click(await screen.findByRole("button", { name: /Fornitore Esempio srl/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Togli la mail/ }));
    await waitFor(() => expect(finte.scartaPosta).toHaveBeenCalledWith("m1"));
    fireEvent.click(await screen.findByRole("button", { name: "Annulla" }));
    await waitFor(() => expect(finte.rimettiPosta).toHaveBeenCalledWith("m1", "proposta"));
  });

  it("«Ignora le mail come questa»: di base solo questo tipo di mail, tutto il mittente solo se scelto", async () => {
    apri();
    fireEvent.click(await screen.findByRole("button", { name: /Fornitore Esempio srl/ }));
    fireEvent.click(screen.getByRole("button", { name: "Ignora le mail come questa" }));
    const solo = screen.getByRole("radio", { name: /Solo le mail come questa/ });
    const tutto = screen.getByRole("radio", { name: /Tutte le mail da fatture@esempio\.it/ });
    expect(solo.checked).toBe(true);
    expect(tutto.checked).toBe(false);
    expect(solo.closest("label").textContent).toMatch(/fatture@esempio\.it con «fattura #\/f»/);
    fireEvent.click(screen.getByRole("button", { name: "Ignora" }));
    await waitFor(() => expect(finte.aggiungiFiltroPosta).toHaveBeenCalledWith("m1", false));
  });
});
