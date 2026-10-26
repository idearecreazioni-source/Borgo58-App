import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// LA VOCE SI CHIUDE INSIEME AL DATO — 26/10/2026
// =====================================================================
// 🔴 IL DIFETTO. Una cosa detta a MEMO e finita a mano sulla sua schermata
//    si salvava in DUE chiamate: prima il dato, poi `chiudiAMano`. Se la
//    seconda falliva il dato era scritto e la cosa restava «da fare», e la
//    volta dopo la stessa spesa entrava due volte.
//
// Da oggi, per Prima nota e Spesa spicciola, l'id della cosa detta viaggia
// CON la scrittura e il database chiude e scrive in una transazione
// (20261026000002). Qui si prova il tratto fra la schermata e la chiamata:
// che l'id arrivi alla scrittura e che la seconda chiamata non parta più.
// Che il database chiuda davvero lo prova la verifica dentro la migrazione.

const finte = vi.hoisted(() => ({
  aMano: vi.fn(),
  chiudi: vi.fn(),
  movimento: vi.fn(async () => ({})),
  spesa: vi.fn(async () => ({})),
}));

vi.mock("../../src/lib/api/voce", () => ({
  azioneAMano: (...a) => finte.aMano(...a),
  chiudiAMano: (...a) => finte.chiudi(...a),
}));

vi.mock("../../src/lib/api/entities", () => ({
  getEntities: vi.fn(async () => ({
    srls: { id: "id-srls", entity_type: "srls", name: "Borgo 58" },
    agricola: { id: "id-orto", entity_type: "azienda_agricola", name: "Orto" },
    tasca: { id: "id-tasca", entity_type: "tasca", name: "La tasca" },
  })),
}));

vi.mock("../../src/lib/api/cash", () => ({
  listCausali: vi.fn(async () => [{ id: "c1", label: "Altra uscita" }]),
  listCashMovements: vi.fn(async () => []),
  getCashBalance: vi.fn(async () => null),
  spesoDallaTasca: vi.fn(async () => []),
  createCashMovement: (...a) => finte.movimento(...a),
  deleteCashMovement: vi.fn(async () => ({})),
}));

vi.mock("../../src/lib/api/spesaSpicciola", () => ({
  listSpesaSpicciola: vi.fn(async () => []),
  categorieSpesaSpicciola: vi.fn(async () => []),
  aggiungiSpesaSpicciola: (...a) => finte.spesa(...a),
  metti: vi.fn(),
  togliSpesaSpicciola: vi.fn(),
}));

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: () => ({ select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    rpc: async () => ({ data: null, error: null }),
  },
  supabasePubblico: {},
}));

vi.mock("../../src/context/AuthContext", () => ({ useAuth: () => ({ isTitolare: true }) }));

const azione = (tipo, campi, daFinire = true) => ({
  id: "az-1",
  tipo,
  stato: daFinire ? "in_attesa" : "eseguita",
  frase: "prova",
  testo_detto: "prova",
  percorso: "/",
  campi,
  da_finire: daFinire,
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function primaNota(indirizzo) {
  const { default: PrimaNota } = await import("../../src/pages/cassa/PrimaNota.jsx");
  const vista = render(
    <MemoryRouter initialEntries={[indirizzo]}>
      <PrimaNota />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getByText("Causale")).toBeTruthy());
  return vista;
}

async function registraUnMovimento(container) {
  const importo = container.querySelector('input[type="number"]');
  fireEvent.change(importo, { target: { value: "12.50" } });
  fireEvent.click(screen.getByText(/Registra movimento/));
  await waitFor(() => expect(finte.movimento).toHaveBeenCalled());
}

describe("Prima nota aperta da MEMO voce", () => {
  it("🔴 l'id della cosa detta arriva CON il movimento, e la seconda chiamata non parte", async () => {
    finte.aMano.mockResolvedValue(azione("movimento_cassa", {}));
    const { container } = await primaNota("/cassa/prima-nota?daVoce=az-1");
    await waitFor(() => expect(finte.aMano).toHaveBeenCalledWith("az-1"));
    await registraUnMovimento(container);
    const [, opzioni] = finte.movimento.mock.calls[0];
    expect(opzioni).toEqual({ azioneDettataId: "az-1" });
    expect(finte.chiudi).not.toHaveBeenCalled();
  });

  it("senza voce il movimento parte senza nessuna cosa da chiudere", async () => {
    const { container } = await primaNota("/cassa/prima-nota");
    await registraUnMovimento(container);
    const [, opzioni] = finte.movimento.mock.calls[0];
    expect(opzioni).toEqual({ azioneDettataId: null });
    expect(finte.chiudi).not.toHaveBeenCalled();
  });

  it("una cosa detta già finita non si chiude una seconda volta", async () => {
    finte.aMano.mockResolvedValue(azione("movimento_cassa", {}, false));
    const { container } = await primaNota("/cassa/prima-nota?daVoce=az-1");
    await waitFor(() => expect(finte.aMano).toHaveBeenCalledWith("az-1"));
    await registraUnMovimento(container);
    const [, opzioni] = finte.movimento.mock.calls[0];
    expect(opzioni).toEqual({ azioneDettataId: null });
  });
});

describe("Spesa spicciola aperta da MEMO voce", () => {
  it("🔴 l'id della cosa detta arriva CON la voce della spesa, e la seconda chiamata non parte", async () => {
    finte.aMano.mockResolvedValue(azione("spesa_spicciola", { nome: "Carta da forno" }));
    const { default: SpesaSpicciola } = await import("../../src/pages/magazzino/SpesaSpicciola.jsx");
    render(
      <MemoryRouter initialEntries={["/magazzino/spesa-spicciola?daVoce=az-1"]}>
        <Routes>
          <Route path="/magazzino/spesa-spicciola" element={<SpesaSpicciola />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByPlaceholderText("Cosa serve").value).toBe("Carta da forno"));
    fireEvent.click(screen.getByText("Aggiungi"));
    await waitFor(() => expect(finte.spesa).toHaveBeenCalled());
    const [voce, opzioni] = finte.spesa.mock.calls[0];
    expect(voce.articolo).toBe("Carta da forno");
    expect(opzioni).toEqual({ azioneDettataId: "az-1" });
    expect(finte.chiudi).not.toHaveBeenCalled();
  });
});
