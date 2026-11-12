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
  speso: null,
  rompiSpeso: false,
  collegate: [],
  scollegate: [],
  collegaRifiuta: null,
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
  leggiSpeso: vi.fn(async () => {
    if (finto.rompiSpeso) throw new Error("rete giù");
    return structuredClone(finto.speso);
  }),
  collegaSpesa: vi.fn(async (c) => {
    finto.collegate.push(c);
    if (finto.collegaRifiuta) throw new Error(finto.collegaRifiuta);
  }),
  scollegaSpesa: vi.fn(async (id) => {
    finto.scollegate.push(id);
  }),
  cambiaApertura: vi.fn(async (m) => {
    finto.aperture.push(m);
    if (finto.aperturaRifiuta) throw new Error("La data non si è salvata.");
  }),
}));

// La spesa assegnata dalla lista (11/11/2026): stessa porta della spunta.
const spunta = vi.hoisted(() => ({ segnate: [], rifiuta: null }));
vi.mock("../../src/lib/api/spuntaInvestimento", () => ({
  vociPerLaSpunta: vi.fn(async () => ({
    meseApertura: "2027-04-01",
    voci: [
      { id: "cappa", gruppo: "B", ordine: 1, descrizione: "Cappa aspirazione" },
      { id: "pedana", gruppo: "A", ordine: 1, descrizione: "Pedana rialzata cucina" },
    ],
    rate: [],
  })),
  segnaConVoce: vi.fn(async (fonte, id, voce) => {
    spunta.segnate.push({ fonte, id, voce });
    if (spunta.rifiuta) throw new Error(spunta.rifiuta);
  }),
  togliSpunta: vi.fn(async () => {}),
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

// Lo speso finto, che torna col costo del progetto (14.500 € fra Borgo 58
// e tasca; l'orto non conta):
//   · cappa: 10.000 pagati + 7.000 di fattura da pagare → a rischio di 1.000;
//   · pedana: 2.500 pagati su 2.000 previsti → sforata di 500;
//   · affitto: 300 pagati su 1.500 → restano 1.200;
//   · da assegnare: il trasporto (1.200) e 500 delle piastrelle (800).
function spesoDiProva() {
  const spesa = (fonte, id, data, descrizione, importo, assegnato) => ({
    fonte, id, data, tipo: "srls", soggetto: "Borgo 58", causale: "Attrezzature", descrizione, nota: null, fattura: null, importo, assegnato,
  });
  return {
    // Le rate ancora da pagare (parte 7): l'acconto della cappa pagato
    // (10.000 su 8.000 → chiuso), aprile della cappa aperto; la pedana chiusa;
    // l'affitto aperto per 1.200 su 1.500.
    rateAperte: [
      { rata_id: "r1", voce_id: "cappa", mese_rel: 0, aperto: 0 },
      { rata_id: "r2", voce_id: "cappa", mese_rel: 1, aperto: 0 },
      { rata_id: "r3", voce_id: "cappa", mese_rel: 2, aperto: 3000 },
      { rata_id: "r4", voce_id: "cappa", mese_rel: 3, aperto: 3000 },
      { rata_id: "r5", voce_id: "pedana", mese_rel: 0, aperto: 0 },
      { rata_id: "r6", voce_id: "affitto", mese_rel: 0, aperto: 1200 },
    ],
    speso: [
      { voce_id: "cappa", speso: 10000, impegnato: 7000, collegate: 2 },
      { voce_id: "pedana", speso: 2500, impegnato: 0, collegate: 1 },
      { voce_id: "affitto", speso: 300, impegnato: 0, collegate: 1 },
    ],
    spese: [
      spesa("prima_nota", "m1", "2026-10-02", "Acconto cappa", 10000, 10000),
      spesa("anticipazione", "a1", "2026-10-05", null, 2500, 2500),
      spesa("prima_nota", "m2", "2026-10-20", "Trasporto attrezzature", 1200, 0),
      spesa("prima_nota", "m3", "2026-10-21", "Piastrelle", 800, 300),
    ],
    costo: [
      { tipo: "srls", totale: 12000 },
      { tipo: "tasca", totale: 2500 },
      { tipo: "azienda_agricola", totale: 999 },
    ],
    collegamenti: [
      { id: "c1", voce_id: "cappa", rata_id: "r1", cash_movement_id: "m1", anticipazione_id: null, supplier_invoice_id: null, importo_attribuito: 10000 },
      { id: "c2", voce_id: "cappa", rata_id: null, cash_movement_id: null, anticipazione_id: null, supplier_invoice_id: "f1", importo_attribuito: 7000 },
      { id: "c3", voce_id: "pedana", rata_id: null, cash_movement_id: null, anticipazione_id: "a1", supplier_invoice_id: null, importo_attribuito: 2500 },
      { id: "c4", voce_id: "affitto", rata_id: null, cash_movement_id: "m3", anticipazione_id: null, supplier_invoice_id: null, importo_attribuito: 300 },
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
  finto.speso = spesoDiProva();
  finto.rompiSpeso = false;
  finto.collegate = [];
  finto.scollegate = [];
  finto.collegaRifiuta = null;
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

describe("il piano dell'investimento: lo speso (parte 5)", () => {
  it("ogni voce dice quanto ha speso e come sta col previsto", async () => {
    const { container } = monta();
    await waitFor(() => expect(container.querySelectorAll('[data-prova="speso-voce"]').length).toBe(3));
    const esito = (g) => gruppo(container, g).querySelector('[data-prova="speso-voce"]');
    // 12/11/2026: la riga è a riquadri (modello approvato da Alessio l'11/11).
    const riquadro = (g, chiave) => esito(g).querySelector(`[data-riquadro="${chiave}"]`)?.textContent ?? "";
    expect(esito("B").dataset.esito).toBe("a_rischio");
    expect(riquadro("B", "spesi")).toMatch(/Spesi.*10\.000,00/);
    expect(riquadro("B", "da_pagare")).toMatch(/Da pagare.*7\.000,00/);
    expect(riquadro("B", "esito")).toMatch(/Supera di.*1\.000,00/);
    expect(esito("A").dataset.esito).toBe("sforato");
    expect(riquadro("A", "esito")).toMatch(/Sforato di.*\+ 500,00/);
    expect(riquadro("E", "esito")).toMatch(/Restano.*1\.200,00/);
  });

  it("i riquadri dicono stato, dilazione, IVA e netto, e in fondo c'è sempre il totale con la parola giusta", async () => {
    const { container } = monta();
    await waitFor(() => expect(container.querySelectorAll('[data-prova="totale-voce"]').length).toBe(3));
    for (const g of ["A", "B", "E"]) {
      const voce = gruppo(container, g).querySelector('[data-prova="voce"]');
      for (const chiave of ["stato", "dilazione", "iva", "netto"]) {
        expect(voce.querySelector(`[data-riquadro="${chiave}"]`)).not.toBeNull();
      }
      expect(voce.querySelector('[data-prova="totale-voce"]').textContent).toMatch(/^Totale (stimato|confermato)/);
    }
  });

  it("il totale dice «confermato» solo sulla voce confermata; preventivato resta una stima", async () => {
    finto.piano.voci[2].stato = "confermato";
    const { container } = monta();
    await waitFor(() => expect(container.querySelectorAll('[data-prova="totale-voce"]').length).toBe(3));
    const totale = (g) => gruppo(container, g).querySelector('[data-prova="totale-voce"]').textContent;
    expect(totale("E")).toMatch(/Totale confermato.*1\.500,00/);
    expect(totale("B")).toMatch(/Totale stimato.*16\.000,00/);
  });

  it("in alto: speso, sforamenti delle sole voci sopra budget, e da assegnare", async () => {
    const { container } = monta();
    await waitFor(() => expect(container.querySelector('[data-prova="speso-totale"]')).not.toBeNull());
    expect(container.querySelector('[data-prova="speso-totale"]').textContent).toMatch(/12\.800,00/);
    expect(container.querySelector('[data-prova="sforamenti"]').textContent).toMatch(/500,00/);
    expect(container.querySelector('[data-prova="da-assegnare-totale"]').textContent).toMatch(/1\.700,00/);
    expect(container.querySelector('[data-prova="controllo-non-torna"]')).toBeNull();
  });

  it("le spese da assegnare si elencano, anche quelle assegnate solo in parte", async () => {
    const { container } = monta();
    await waitFor(() => expect(container.querySelectorAll('[data-prova="spesa-da-assegnare"]').length).toBe(2));
    const righe = [...container.querySelectorAll('[data-prova="spesa-da-assegnare"]')].map((r) => r.textContent);
    expect(righe[0]).toMatch(/20\/10\/2026 · Trasporto attrezzature.*1\.200,00/);
    expect(righe[1]).toMatch(/Piastrelle.*500,00.*di 800,00/);
  });

  it("lo speso delle voci archiviate resta nel totale, e si dice quanto è", async () => {
    finto.speso.speso.push({ voce_id: "vecchia", speso: 100, impegnato: 0, collegate: 1 });
    finto.speso.spese.push({ fonte: "prima_nota", id: "m4", data: "2026-09-01", tipo: "srls", importo: 100, assegnato: 100 });
    finto.speso.costo[0].totale = 12100;
    const { container } = monta();
    await waitFor(() => expect(container.querySelector('[data-prova="speso-totale"]')).not.toBeNull());
    expect(container.querySelector('[data-prova="speso-totale"]').textContent).toMatch(/12\.900,00/);
    expect(container.querySelector('[data-prova="speso-archiviate"]').textContent).toMatch(/100,00.*archiviate/);
    expect(container.querySelector('[data-prova="controllo-non-torna"]')).toBeNull();
  });

  it("una fattura collegata già pagata, senza il suo pagamento, si dice sulla voce", async () => {
    finto.speso.speso[2].fatture_pagate_scollegate = 1;
    const { container } = monta();
    await waitFor(() => expect(container.querySelector('[data-prova="fattura-scollegata"]')).not.toBeNull());
    expect(gruppo(container, "E").querySelector('[data-prova="fattura-scollegata"]').textContent).toMatch(/collega anche il pagamento/);
  });

  it("se lo speso non torna col costo del progetto, lo dice", async () => {
    finto.speso.costo = [{ tipo: "srls", totale: 13000 }, { tipo: "tasca", totale: 2500 }];
    const { container } = monta();
    await waitFor(() => expect(container.querySelector('[data-prova="controllo-non-torna"]')).not.toBeNull());
    expect(container.querySelector('[data-prova="controllo-non-torna"]').textContent).toMatch(/15\.500,00.*14\.500,00/);
  });

  it("se lo speso non si legge, il previsto resta e lo speso non diventa zero", async () => {
    finto.rompiSpeso = true;
    const { container } = monta();
    await screen.findByText(/non vuol dire che non hai speso niente/i);
    expect(container.querySelector('[data-prova="previsto-totale"]')).not.toBeNull();
    expect(container.querySelector('[data-prova="speso-totale"]')).toBeNull();
    expect(container.querySelector('[data-prova="speso-voce"]')).toBeNull();
    // 12/11: senza speso letto non ci sono i riquadri dello speso (non diventano
    // zero), ma stato, IVA e il totale in fondo restano.
    expect(container.querySelector('[data-riquadro="spesi"]')).toBeNull();
    expect(container.querySelector('[data-riquadro="esito"]')).toBeNull();
    expect(container.querySelector('[data-riquadro="stato"]')).not.toBeNull();
    expect(container.querySelector('[data-prova="totale-voce"]')).not.toBeNull();
  });

  it("nella voce aperta si vedono le spese collegate, con la rata", async () => {
    const { container } = monta();
    await apriVoce(container, "B");
    const pannello = await waitFor(() => {
      const p = container.querySelector('[data-prova="collegamenti"]');
      expect(p).not.toBeNull();
      return p;
    });
    const righe = [...pannello.querySelectorAll('[data-prova="collegamento"]')].map((r) => r.textContent);
    expect(righe[0]).toMatch(/02\/10\/2026 · Acconto cappa.*rata di Acconto.*10\.000,00/);
    expect(righe[1]).toMatch(/Fattura da pagare.*7\.000,00/);
  });

  async function pannelloDellaCappa(container) {
    await apriVoce(container, "B");
    return waitFor(() => {
      const p = container.querySelector('[data-prova="collegamenti"]');
      expect(p).not.toBeNull();
      return p;
    });
  }

  it("si collega una spesa da assegnare: l'importo proposto è quello che resta", async () => {
    const { container } = monta();
    const pannello = await pannelloDellaCappa(container);
    fireEvent.change(within(pannello).getByLabelText("Spesa da collegare"), { target: { value: "prima_nota:m3" } });
    expect(within(pannello).getByLabelText(/Parte su questa voce/).value).toBe("500");
    fireEvent.change(within(pannello).getByLabelText("Quale rata paga"), { target: { value: "r2" } });
    fireEvent.click(within(pannello).getByRole("button", { name: "Collega la spesa" }));
    await waitFor(() => expect(finto.collegate).toHaveLength(1));
    expect(finto.collegate[0]).toMatchObject({ voceId: "cappa", rataId: "r2", importo: 500, spesa: { fonte: "prima_nota", id: "m3" } });
  });

  it("non si assegna più di quello che resta della spesa", async () => {
    const { container } = monta();
    const pannello = await pannelloDellaCappa(container);
    fireEvent.change(within(pannello).getByLabelText("Spesa da collegare"), { target: { value: "prima_nota:m3" } });
    fireEvent.change(within(pannello).getByLabelText(/Parte su questa voce/), { target: { value: "600" } });
    fireEvent.click(within(pannello).getByRole("button", { name: "Collega la spesa" }));
    expect((await within(pannello).findByRole("alert")).textContent).toMatch(/restano da assegnare 500,00/);
    expect(finto.collegate).toHaveLength(0);
  });

  it("il rifiuto del database si legge, e la scelta resta", async () => {
    finto.collegaRifiuta = "Questa spesa è dell'orto: il piano dell'investimento conta solo Borgo 58 e la tua tasca.";
    const { container } = monta();
    const pannello = await pannelloDellaCappa(container);
    fireEvent.change(within(pannello).getByLabelText("Spesa da collegare"), { target: { value: "prima_nota:m2" } });
    fireEvent.click(within(pannello).getByRole("button", { name: "Collega la spesa" }));
    expect((await within(pannello).findByRole("alert")).textContent).toMatch(/dell'orto/);
    expect(within(pannello).getByLabelText("Spesa da collegare").value).toBe("prima_nota:m2");
  });

  it("lo scadenziario dice quanto resta da pagare di ogni mese (parte 7)", async () => {
    const { container } = monta();
    await waitFor(() => expect(container.querySelectorAll('[data-prova="mese-resta"]').length).toBeGreaterThan(0));
    const mesi = [...container.querySelectorAll('[data-prova="mese"]')].map((m) => m.textContent);
    // Acconto: 10.500 previsti, restano 1.200 dell'affitto.
    expect(mesi[0]).toMatch(/10\.500,00.*ancora da pagare 1\.200,00/);
    // Aprile: 2.000 previsti, tutto pagato o fatturato.
    expect(mesi[1]).toMatch(/2\.000,00.*tutto pagato o fatturato/);
    // Maggio: tutto ancora da pagare, quindi nessuna riga in più.
    expect(container.querySelectorAll('[data-prova="mese"]')[2].querySelector('[data-prova="mese-resta"]')).toBeNull();
  });

  it("«Togli» toglie il collegamento giusto", async () => {
    const { container } = monta();
    const pannello = await pannelloDellaCappa(container);
    fireEvent.click(within(pannello).getByRole("button", { name: /Togli.*Fattura da pagare/ }));
    await waitFor(() => expect(finto.scollegate).toEqual(["c2"]));
  });
});

// 🔴 11/11/2026, Alessio davanti alla lista: «non posso interagire». Il
//    gesto c'era solo partendo dalla voce. Ora si parte dalla spesa.
describe("il piano dell'investimento: una spesa da assegnare si assegna dalla lista", () => {
  beforeEach(() => {
    spunta.segnate = [];
    spunta.rifiuta = null;
  });

  it("«Metti su una voce», scelta la voce, «Assegna» manda la spesa a quella voce", async () => {
    const { container } = monta();
    await waitFor(() => expect(container.querySelectorAll('[data-prova="spesa-da-assegnare"]').length).toBe(2));
    const riga = container.querySelectorAll('[data-prova="spesa-da-assegnare"]')[0];
    fireEvent.click(within(riga).getByRole("button", { name: /Metti su una voce/ }));
    const assegna = within(riga).getByRole("button", { name: /Assegna/ });
    // Senza voce non si assegna niente.
    expect(assegna.disabled).toBe(true);
    const menu = await within(riga).findByLabelText("Voce del piano");
    fireEvent.change(menu, { target: { value: "cappa" } });
    expect(assegna.disabled).toBe(false);
    fireEvent.click(assegna);
    await waitFor(() => expect(spunta.segnate.length).toBe(1));
    expect(spunta.segnate[0]).toMatchObject({ fonte: "prima_nota", voce: { voceId: "cappa" } });
  });

  it("mentre una voce è aperta in «Modifica», le righe da assegnare sono spente", async () => {
    const { container } = monta();
    await waitFor(() => expect(container.querySelectorAll('[data-prova="spesa-da-assegnare"]').length).toBe(2));
    await apriVoce(container, "B");
    const riga = container.querySelectorAll('[data-prova="spesa-da-assegnare"]')[0];
    expect(within(riga).getByRole("button", { name: /Metti su una voce/ }).disabled).toBe(true);
  });

  it("se la spesa è già in parte su quella voce, lo dice in italiano", async () => {
    spunta.rifiuta = 'duplicate key value violates unique constraint "piano_collegamenti_voce_movimento"';
    const { container } = monta();
    await waitFor(() => expect(container.querySelectorAll('[data-prova="spesa-da-assegnare"]').length).toBe(2));
    const riga = container.querySelectorAll('[data-prova="spesa-da-assegnare"]')[1];
    fireEvent.click(within(riga).getByRole("button", { name: /Metti su una voce/ }));
    fireEvent.change(await within(riga).findByLabelText("Voce del piano"), { target: { value: "cappa" } });
    fireEvent.click(within(riga).getByRole("button", { name: /Assegna/ }));
    expect((await within(riga).findByRole("alert")).textContent).toMatch(/già in parte su questa voce/);
  });
});

describe("il piano dell'investimento: le sottovoci (12/11/2026)", () => {
  const conSottovoci = () => {
    finto.piano.voci.push(
      voce("cucina", "D", "Attrezzature sala", 1600, { stato: "stimato" }),
      voce("divano", "D", "Divano", 1000, { madre_id: "cucina", stato: "confermato", aliquota_iva: 0, netto: 1000 }),
      voce("lampade", "D", "Lampade", 600, { madre_id: "cucina" }),
    );
  };

  it("la voce divisa dice quante sottovoci ha, e il totale «di cui confermato»", async () => {
    conSottovoci();
    const { container } = monta();
    await waitFor(() => expect(gruppo(container, "D")).not.toBeNull());
    const d = gruppo(container, "D");
    expect(within(d).getByRole("button", { name: /Apri le 2 sottovoci/ })).toBeTruthy();
    // Le sottovoci non stanno nella lista del gruppo finché non si apre.
    expect(d.querySelectorAll('[data-prova="sottovoce"]').length).toBe(0);
    expect(d.querySelector('[data-prova="totale-voce"]').textContent).toMatch(/di cui confermato 1\.000,00.*Totale stimato.*1\.600,00/);
    expect(d.querySelector('[data-riquadro="iva"]').textContent).toMatch(/mista/);
  });

  it("aprendo, le sottovoci si vedono con i loro riquadri, e si può aggiungerne una", async () => {
    conSottovoci();
    const { container } = monta();
    await waitFor(() => expect(gruppo(container, "D")).not.toBeNull());
    const d = gruppo(container, "D");
    fireEvent.click(within(d).getByRole("button", { name: /Apri le 2 sottovoci/ }));
    expect(d.querySelectorAll('[data-prova="sottovoce"]').length).toBe(2);
    fireEvent.click(within(d).getByRole("button", { name: /Aggiungi una sottovoce/ }));
    const modulo = d.querySelector('[data-prova="modulo-voce"]');
    expect(within(modulo).getByLabelText("Sottovoce")).toBeTruthy();
    // Il gruppo è quello della madre: non si sceglie.
    expect(within(modulo).queryByLabelText("Gruppo")).toBeNull();
  });

  it("la voce divisa in «Modifica» non chiede cifra, stato né rate", async () => {
    conSottovoci();
    const { container } = monta();
    await waitFor(() => expect(gruppo(container, "D")).not.toBeNull());
    const d = gruppo(container, "D");
    fireEvent.click(within(d).getByRole("button", { name: /Modifica.*Attrezzature sala/ }));
    const modulo = d.querySelector('[data-prova="modulo-voce"]');
    expect(modulo.querySelector('[data-prova="madre-calcolata"]')).not.toBeNull();
    expect(within(modulo).queryByLabelText(/Previsto/)).toBeNull();
    expect(within(modulo).queryByLabelText("Stato")).toBeNull();
    expect(within(modulo).queryByText("Come la paghi")).toBeNull();
  });

  it("una voce senza sottovoci si può dividere", async () => {
    const { container } = monta();
    await waitFor(() => expect(gruppo(container, "A")).not.toBeNull());
    expect(within(gruppo(container, "A")).getByRole("button", { name: /Dividi in sottovoci/ })).toBeTruthy();
  });
});
