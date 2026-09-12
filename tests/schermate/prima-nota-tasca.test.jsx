import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// SPEC-0005 GUARDATA DALLA SCHERMATA — 06/09/2026.
//
// 🔴 PERCHE' NON BASTANO LE PROVE PURE. `tests/unita/tasca-prima-nota.test.js`
//    prova che la REGOLA risponde giusto; questa prova che la schermata la
//    CHIAMA. Sono due cose diverse, e il progetto ha gia' pagato la
//    differenza: il 16/08 il menu del mezzo di pagamento delle mance si
//    vedeva, si sceglieva, e il campo non arrivava al database — nessuna
//    prova sul database poteva accorgersene, perche' il difetto stava nel
//    tratto fra la schermata e la chiamata.
//
// ⚠️ QUI NON SI PARLA COL DATABASE (condizione di questo strato): il
//    collegamento e' finto e ogni prova dichiara cosa gli fa rispondere.

const TASCA = { id: "id-tasca", entity_type: "tasca", name: "La tasca di Alessio" };
const SRLS = { id: "id-srls", entity_type: "srls", name: "Borgo 58" };
const AGRICOLA = { id: "id-orto", entity_type: "azienda_agricola", name: "Orto Borgo 58" };

const CAUSALI_USCITA = [
  { id: "c1", label: "Altra uscita" },
  { id: "c2", label: "Spesa alimentare" },
];

const finto = vi.hoisted(() => ({ conto: [] }));

vi.mock("../../src/lib/api/entities", () => ({
  getEntities: vi.fn(async () => ({ srls: SRLS, agricola: AGRICOLA, tasca: TASCA })),
}));

vi.mock("../../src/lib/api/cash", () => ({
  listCausali: vi.fn(async (verso) => (verso === "uscita" ? CAUSALI_USCITA : [])),
  listCashMovements: vi.fn(async () => []),
  getCashBalance: vi.fn(async () => null),
  spesoDallaTasca: vi.fn(async () => finto.conto),
  createCashMovement: vi.fn(async () => ({})),
  deleteCashMovement: vi.fn(async () => ({})),
}));

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    rpc: async () => ({ data: null, error: null }),
  },
  supabasePubblico: {},
}));

async function apri(indirizzo) {
  const { default: PrimaNota } = await import("../../src/pages/cassa/PrimaNota.jsx");
  const vista = render(
    <MemoryRouter initialEntries={[indirizzo]}>
      <PrimaNota />
    </MemoryRouter>
  );
  // La schermata si riempie dopo le letture: si aspetta che il modulo ci sia.
  await waitFor(() => expect(screen.getByText("Causale")).toBeTruthy());
  return vista;
}

function campoDescrizione(contenitore) {
  return contenitore.querySelector('input[placeholder*="Abbonamento AI"], input[placeholder*="Finalità aziendale"]');
}

beforeEach(() => {
  finto.conto = [];
  vi.clearAllMocks();
});

describe("La tasca di Alessio", () => {
  it("il campo si chiama «Descrizione della spesa» e mostra l'esempio", async () => {
    const { container } = await apri("/cassa/prima-nota?soggetto=tasca");
    expect(screen.getByText("Descrizione della spesa")).toBeTruthy();
    const campo = campoDescrizione(container);
    expect(campo.getAttribute("placeholder")).toBe("Abbonamento AI — nome del servizio, mese");
  });

  it("la causale e' «Indeducibile», scritta e non modificabile", async () => {
    const { container } = await apri("/cassa/prima-nota?soggetto=tasca");
    const fissa = container.querySelector('[data-prova="causale-fissa"]');
    expect(fissa).toBeTruthy();
    expect(fissa.textContent.trim()).toBe("Indeducibile");
    // ⚠️ Non basta che «Indeducibile» compaia: il menu non deve esserci
    //    piu'. Un elenco lasciato accanto a una scritta fissa e' la scelta
    //    che questa specifica toglie.
    expect(fissa.tagName).not.toBe("SELECT");
    expect(fissa.querySelector("select")).toBeNull();
    expect(screen.queryByText("Altra uscita")).toBeNull();
    expect(screen.queryByText("Spesa alimentare")).toBeNull();
  });

  it("il campo della descrizione resta libero: niente lo rifiuta", async () => {
    // Il mese e' consigliato dall'esempio, non preteso (decisione del 06/09).
    const { container } = await apri("/cassa/prima-nota?soggetto=tasca");
    const campo = campoDescrizione(container);
    expect(campo.hasAttribute("required")).toBe(false);
    expect(campo.hasAttribute("pattern")).toBe(false);
  });

  it("«senza causale» non compare, e il totale resta intero", async () => {
    finto.conto = [{ causale: "senza causale", totale: "120.00" }];
    await apri("/cassa/prima-nota?soggetto=tasca");
    // ⚠️ Si aspetta IL NUMERO, non la riga: la riga «Speso dalla tasca»
    //    compare subito con lo zero, e chi ci si ferma misura un momento in
    //    cui la lettura non e' ancora arrivata.
    await waitFor(() => expect(screen.getByText(/120,00/)).toBeTruthy());
    expect(screen.queryByText(/senza causale/)).toBeNull();
  });

  it("una causale scelta prima del 06/09 continua a comparire", async () => {
    finto.conto = [
      { causale: "senza causale", totale: "120.00" },
      { causale: "Cancelleria", totale: "9.00" },
    ];
    await apri("/cassa/prima-nota?soggetto=tasca");
    await waitFor(() => expect(screen.getByText(/Cancelleria/)).toBeTruthy());
    expect(screen.queryByText(/senza causale/)).toBeNull();
    // Il totale somma tutt'e due: 129,00.
    expect(screen.getByText(/129,00/)).toBeTruthy();
  });
});

describe("Borgo 58 — non deve cambiare niente", () => {
  it("il campo si chiama ancora «Finalità aziendale» e non prende un titolo", async () => {
    const { container } = await apri("/cassa/prima-nota");
    const campo = campoDescrizione(container);
    expect(campo.getAttribute("placeholder")).toBe("Finalità aziendale (facoltativa, utile in verifica)");
    // Nessuna etichetta sopra il campo: altrove il nome vive nel grigio.
    expect(screen.queryByText("Descrizione della spesa")).toBeNull();
  });

  it("la causale resta un menu, con le causali di uscita", async () => {
    const { container } = await apri("/cassa/prima-nota");
    expect(container.querySelector('[data-prova="causale-fissa"]')).toBeNull();
    expect(screen.getByText("Altra uscita")).toBeTruthy();
    expect(screen.getByText("Spesa alimentare")).toBeTruthy();
    expect(screen.queryByText("Indeducibile")).toBeNull();
  });
});
