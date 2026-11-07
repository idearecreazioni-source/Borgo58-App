import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Il piano dell'investimento, guardato dalla schermata (07/11/2026).
// ⚠️ Qui non si parla col database: le funzioni di lettura e scrittura sono
//    finte, e ogni prova dichiara cosa rispondono. Le regole pure le prova
//    tests/unita/piano-investimento.test.js; i divieti la migrazione.

const finto = vi.hoisted(() => ({
  piano: null,
  rompi: false,
  salvate: [],
  archiviate: [],
  aperture: [],
  salvaRisponde: null,
  aperturaRifiuta: false,
}));

vi.mock("../../src/lib/api/pianoInvestimento", () => ({
  leggiPiano: vi.fn(async () => {
    if (finto.rompi) throw new Error("rete giù");
    return structuredClone(finto.piano);
  }),
  salvaVoce: vi.fn(async (voce, rate) => {
    finto.salvate.push({ voce, rate });
    if (finto.salvaRisponde) return finto.salvaRisponde(voce, rate);
    return voce.id ?? "nuova";
  }),
  archiviaVoce: vi.fn(async (id, archiviata) => {
    finto.archiviate.push([id, archiviata]);
  }),
  cambiaApertura: vi.fn(async (m) => {
    finto.aperture.push(m);
    if (finto.aperturaRifiuta) throw new Error("La data non si è salvata.");
  }),
}));

import PianoInvestimento from "../../src/pages/cassa/PianoInvestimento";

const voce = (id, gruppo, descrizione, importo, extra = {}) => ({
  id,
  gruppo,
  descrizione,
  importo_ivato: importo,
  aliquota_iva: 22,
  netto: Math.round((importo * 100) / 1.22) / 100,
  stato: "stimato",
  dilazione: "nessuna",
  nota: null,
  archiviata_il: null,
  ...extra,
});

function pianoDiProva() {
  return {
    meseApertura: "2027-04-01",
    voci: [
      voce("cappa", "B", "Cappa aspirazione", 16000, { stato: "preventivato" }),
      voce("pedana", "A", "Pedana rialzata cucina", 2000),
      voce("affitto", "E", "Affitto", 1500, { aliquota_iva: 0, netto: 1500 }),
      voce("vecchia", "D", "Voce tolta", 999, { archiviata_il: "2026-11-01T10:00:00Z" }),
    ],
    rate: [
      { id: "r1", voce_id: "cappa", mese_rel: 0, importo: 8000 },
      { id: "r2", voce_id: "cappa", mese_rel: 1, importo: 2000 },
      { id: "r3", voce_id: "cappa", mese_rel: 2, importo: 3000 },
      { id: "r4", voce_id: "cappa", mese_rel: 3, importo: 3000 },
      { id: "r5", voce_id: "pedana", mese_rel: 0, importo: 1000 },
      { id: "r6", voce_id: "affitto", mese_rel: 0, importo: 1500 },
      { id: "r7", voce_id: "vecchia", mese_rel: 1, importo: 999 },
    ],
  };
}

const monta = () =>
  render(
    <MemoryRouter>
      <PianoInvestimento />
    </MemoryRouter>
  );

const gruppo = (container, g) => container.querySelector(`[data-prova="gruppo-${g}"]`);

async function apriNuova(container, g) {
  await waitFor(() => expect(gruppo(container, g)).not.toBeNull());
  fireEvent.click(within(gruppo(container, g)).getByRole("button", { name: /Aggiungi una voce/ }));
}

async function apriVoce(container, g) {
  await waitFor(() => expect(gruppo(container, g)).not.toBeNull());
  fireEvent.click(within(gruppo(container, g)).getByRole("button", { name: /Modifica/ }));
}

beforeEach(() => {
  finto.piano = pianoDiProva();
  finto.rompi = false;
  finto.salvate = [];
  finto.archiviate = [];
  finto.aperture = [];
  finto.salvaRisponde = null;
  finto.aperturaRifiuta = false;
});

describe("il piano dell'investimento: cosa si vede", () => {
  it("una lettura fallita dice che non lo sa, non mostra un piano a zero", async () => {
    finto.rompi = true;
    const { container } = monta();
    await screen.findByText(/non vuol dire che il piano è vuoto/i);
    expect(container.querySelector('[data-prova="previsto-totale"]')).toBeNull();
  });

  it("il previsto in tutto conta solo le voci vive, IVA inclusa", async () => {
    const { container } = monta();
    await waitFor(() => expect(container.querySelector('[data-prova="previsto-totale"]')).not.toBeNull());
    expect(container.querySelector('[data-prova="previsto-totale"]').textContent).toMatch(/19\.500,00/);
  });

  it("il ✗ si vede sulla voce che non quadra, e in alto si contano", async () => {
    const { container } = monta();
    await waitFor(() => expect(container.querySelectorAll('[data-prova="voce"]').length).toBe(3));
    expect(within(gruppo(container, "A")).getByText("✗")).toBeTruthy();
    expect(within(gruppo(container, "B")).getByText("✓")).toBeTruthy();
    expect(container.querySelector('[data-prova="non-quadrano"]').textContent).toBe("✗ 1");
  });

  it("il ✗ si dice anche a parole, per chi non vede il segno", async () => {
    const { container } = monta();
    await waitFor(() => expect(gruppo(container, "A")).not.toBeNull());
    expect(within(gruppo(container, "A")).getByText(/Mancano 1\.000,00/)).toBeTruthy();
  });

  it("lo scadenziario somma le rate per mese vero, senza le voci archiviate", async () => {
    const { container } = monta();
    await waitFor(() => expect(container.querySelectorAll('[data-prova="mese"]').length).toBe(4));
    const mesi = [...container.querySelectorAll('[data-prova="mese"]')].map((m) => m.textContent);
    expect(mesi[0]).toMatch(/Acconto \(entro marzo 2027\).*10\.500,00/);
    expect(mesi[1]).toMatch(/Aprile 2027.*2\.000,00/);
    expect(mesi[3]).toMatch(/Giugno 2027.*3\.000,00/);
  });

  it("le voci archiviate stanno a parte, e si riprendono", async () => {
    monta();
    fireEvent.click(await screen.findByRole("button", { name: /Riprendi/ }));
    await waitFor(() => expect(finto.archiviate).toEqual([["vecchia", false]]));
  });
});

describe("il piano dell'investimento: scrivere una voce", () => {
  it("una voce nuova arriva al salvataggio con le sue rate, anche se non quadra", async () => {
    const { container } = monta();
    await apriNuova(container, "C");
    fireEvent.change(screen.getByLabelText("Voce"), { target: { value: "Opere murarie" } });
    fireEvent.change(screen.getByLabelText(/Previsto, IVA inclusa/), { target: { value: "3000" } });
    fireEvent.change(screen.getByLabelText(/Acconto/), { target: { value: "2000" } });
    expect(container.querySelector('[data-prova="quadra-modulo"]').textContent).toMatch(/Da distribuire ancora 1\.000,00/);
    fireEvent.click(screen.getByRole("button", { name: "Salva la voce" }));
    await waitFor(() => expect(finto.salvate.length).toBe(1));
    const { voce: v, rate } = finto.salvate[0];
    expect(v).toMatchObject({ gruppo: "C", descrizione: "Opere murarie", importo_ivato: 3000, aliquota_iva: 22 });
    expect(rate.find((r) => r.mese_rel === 0).importo).toBe(2000);
  });

  it("gli importi si scrivono all'italiana: «16.000» sono sedicimila", async () => {
    const { container } = monta();
    await apriNuova(container, "C");
    fireEvent.change(screen.getByLabelText("Voce"), { target: { value: "Cappa" } });
    fireEvent.change(screen.getByLabelText(/Previsto, IVA inclusa/), { target: { value: "16.000" } });
    fireEvent.change(screen.getByLabelText(/Acconto/), { target: { value: "15.999,50" } });
    fireEvent.change(screen.getByLabelText("Aprile 2027"), { target: { value: "0,50" } });
    expect(container.querySelector('[data-prova="quadra-modulo"]').textContent).toMatch(/Le rate fanno il totale/);
    fireEvent.click(screen.getByRole("button", { name: "Salva la voce" }));
    await waitFor(() => expect(finto.salvate.length).toBe(1));
    expect(finto.salvate[0].voce.importo_ivato).toBe(16000);
    expect(finto.salvate[0].rate.find((r) => r.mese_rel === 0).importo).toBe(15999.5);
  });

  it("le rate in percentuale del previsto si vedono e si salvano in euro (07/11)", async () => {
    const { container } = monta();
    await apriNuova(container, "B");
    fireEvent.change(screen.getByLabelText("Voce"), { target: { value: "Cappa e aspirazione" } });
    fireEvent.change(screen.getByLabelText(/Previsto, IVA inclusa/), { target: { value: "16.470,00 €" } });
    fireEvent.change(screen.getByLabelText(/Acconto/), { target: { value: "50%" } });
    fireEvent.change(screen.getByLabelText("Aprile 2027"), { target: { value: "15%" } });
    fireEvent.change(screen.getByLabelText("Maggio 2027"), { target: { value: "15%" } });
    fireEvent.change(screen.getByLabelText("Giugno 2027"), { target: { value: "15%" } });
    const inEuro = [...container.querySelectorAll('[data-prova="rata-in-euro"]')].map((p) => p.textContent);
    expect(inEuro[0]).toMatch(/8\.235,00/);
    expect(inEuro[1]).toMatch(/2\.470,50/);
    // 95%: manca il 5%, cioè 823,50 €.
    expect(container.querySelector('[data-prova="quadra-modulo"]').textContent).toMatch(/Da distribuire ancora 823,50/);
    fireEvent.click(screen.getByRole("button", { name: "Salva la voce" }));
    await waitFor(() => expect(finto.salvate.length).toBe(1));
    const rate = finto.salvate[0].rate;
    expect(rate.find((r) => r.mese_rel === 0).importo).toBe(8235);
    expect(rate.find((r) => r.mese_rel === 3).importo).toBe(2470.5);
  });

  it("una percentuale con il previsto a zero non si salva come 0 €", async () => {
    const { container } = monta();
    await apriNuova(container, "B");
    fireEvent.change(screen.getByLabelText("Voce"), { target: { value: "Cappa" } });
    fireEvent.change(screen.getByLabelText(/Previsto, IVA inclusa/), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText(/Acconto/), { target: { value: "50%" } });
    expect(container.querySelector('[data-prova="rata-in-euro"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Salva la voce" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/percentuale del previsto/);
    expect(finto.salvate).toEqual([]);
  });

  it("una percentuale oltre il 100% non si salva", async () => {
    const { container } = monta();
    await apriNuova(container, "B");
    fireEvent.change(screen.getByLabelText("Voce"), { target: { value: "Cappa" } });
    fireEvent.change(screen.getByLabelText(/Previsto, IVA inclusa/), { target: { value: "1000" } });
    fireEvent.change(screen.getByLabelText(/Acconto/), { target: { value: "120%" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva la voce" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/percentuale del previsto/);
    expect(finto.salvate).toEqual([]);
  });

  it("una rata che non si capisce ferma il salvataggio, non diventa zero", async () => {
    const { container } = monta();
    await apriNuova(container, "C");
    fireEvent.change(screen.getByLabelText("Voce"), { target: { value: "Opere" } });
    fireEvent.change(screen.getByLabelText(/Previsto, IVA inclusa/), { target: { value: "3000" } });
    fireEvent.change(screen.getByLabelText("Maggio 2027"), { target: { value: "mille" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva la voce" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Maggio 2027/);
    expect(finto.salvate).toEqual([]);
  });

  it("un previsto vuoto non si salva a zero", async () => {
    const { container } = monta();
    await apriNuova(container, "C");
    fireEvent.change(screen.getByLabelText("Voce"), { target: { value: "Opere" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva la voce" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/quanto prevedi/);
    expect(finto.salvate).toEqual([]);
  });

  it("un nome vuoto non si salva, e lo dice", async () => {
    const { container } = monta();
    await apriNuova(container, "D");
    fireEvent.click(screen.getByRole("button", { name: "Salva la voce" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Scrivi il nome della voce.");
    expect(finto.salvate).toEqual([]);
  });

  it("senza IVA il netto è uguale al previsto", async () => {
    const { container } = monta();
    await apriVoce(container, "E");
    expect(screen.getByLabelText("IVA").value).toBe("0");
    expect(container.querySelector('[data-prova="netto"]').textContent).toMatch(/1\.500,00/);
  });

  it("cambiare una voce: arriva con il suo id, e la rata svuotata vale zero", async () => {
    const { container } = monta();
    await apriVoce(container, "B");
    expect(screen.getByLabelText(/Previsto, IVA inclusa/).value).toBe("16000");
    expect(screen.getByLabelText(/Acconto/).value).toBe("8000");
    fireEvent.change(screen.getByLabelText("Giugno 2027"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva la voce" }));
    await waitFor(() => expect(finto.salvate.length).toBe(1));
    const { voce: v, rate } = finto.salvate[0];
    expect(v.id).toBe("cappa");
    expect(rate.find((r) => r.mese_rel === 3).importo).toBe(0);
    expect(rate.find((r) => r.mese_rel === 1).importo).toBe(2000);
  });

  it("mentre una voce è aperta, le altre non si aprono e la data non si cambia", async () => {
    const { container } = monta();
    await apriVoce(container, "B");
    expect(within(gruppo(container, "A")).getByRole("button", { name: /Modifica/ }).disabled).toBe(true);
    expect(screen.getByLabelText("Mese dell'apertura").disabled).toBe(true);
  });

  it("un salvataggio fermato a metà non crea una voce doppia al secondo tentativo", async () => {
    let volta = 0;
    finto.salvaRisponde = async (v) => {
      volta += 1;
      if (volta === 1) throw Object.assign(new Error("rete giù"), { idVoce: "creata" });
      return v.id;
    };
    const { container } = monta();
    await apriNuova(container, "C");
    fireEvent.change(screen.getByLabelText("Voce"), { target: { value: "Opere" } });
    fireEvent.change(screen.getByLabelText(/Previsto, IVA inclusa/), { target: { value: "3000" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva la voce" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Non ho salvato tutto/);
    fireEvent.click(screen.getByRole("button", { name: "Salva la voce" }));
    await waitFor(() => expect(finto.salvate.length).toBe(2));
    expect(finto.salvate[0].voce.id).toBeUndefined();
    expect(finto.salvate[1].voce.id).toBe("creata");
  });

  it("due tocchi su «Salva la voce» fanno un salvataggio solo", async () => {
    let libera;
    finto.salvaRisponde = () => new Promise((r) => (libera = () => r("x")));
    const { container } = monta();
    await apriVoce(container, "B");
    const salva = screen.getByRole("button", { name: "Salva la voce" });
    fireEvent.click(salva);
    fireEvent.click(salva);
    await waitFor(() => expect(finto.salvate.length).toBe(1));
    libera();
    await waitFor(() => expect(screen.queryByRole("button", { name: /Salva la voce|Salvo/ })).toBeNull());
    expect(finto.salvate.length).toBe(1);
  });

  it("si archivia dal modulo della voce", async () => {
    const { container } = monta();
    await apriVoce(container, "A");
    fireEvent.click(screen.getByRole("button", { name: "Archivia la voce" }));
    await waitFor(() => expect(finto.archiviate).toEqual([["pedana", true]]));
  });
});

describe("il piano dell'investimento: la data dell'apertura", () => {
  it("si salva come primo del mese, con il suo pulsante", async () => {
    monta();
    const campo = await screen.findByLabelText("Mese dell'apertura");
    fireEvent.change(campo, { target: { value: "2027-06" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva la data" }));
    await waitFor(() => expect(finto.aperture).toEqual(["2027-06-01"]));
  });

  it("se non si salva torna quella di prima, e lo dice", async () => {
    finto.aperturaRifiuta = true;
    monta();
    const campo = await screen.findByLabelText("Mese dell'apertura");
    fireEvent.change(campo, { target: { value: "2027-06" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva la data" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/non si è salvata/);
    expect(screen.getByLabelText("Mese dell'apertura").value).toBe("2027-04");
  });
});
