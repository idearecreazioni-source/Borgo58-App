import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// IMPORTA DAL DRIVE — 22/11/2026 (pezzo C2)
// =====================================================================
// ⚠️ QUI NON SI PARLA COL DATABASE: il collegamento è finto, e i file e la mappa sono INVENTATI (il repo è pubblico).
//    Si prova cosa la pagina MOSTRA e cosa CONSEGNA al collegamento: la mappa comanda, i file sconosciuti e «solo
//    elenco» sono rifiutati a voce alta, una riga con un problema non si importa, no_ai parte spento, i doppioni
//    sono segnalati, un file che fallisce non ferma gli altri, l'annullamento è un gesto con conferma.
//    Che il database applichi davvero le regole lo provano la verifica della migrazione e le prove su Prova.

const finto = vi.hoisted(() => ({
  sezioni: [
    { codice: "contratti", etichetta: "Contratti", attiva: true },
    { codice: "preventivi", etichetta: "Preventivi", attiva: true },
    { codice: "progetto_planimetrie", etichetta: "Progetto e planimetrie", attiva: true },
  ],
  sezioniFallite: false,
  gia: new Map(),
  impronteFallite: false,
  fallisciQuesti: new Set(),
  linkPresenti: new Set(),
  lottoFallito: false,
  annullaFallisce: null,
}));
const spie = vi.hoisted(() => ({ importati: [], lotti: 0, elenco: [], annullati: [] }));

vi.mock("../../src/lib/api/documents", () => ({
  sezioniArchivio: vi.fn(async () => {
    if (finto.sezioniFallite) throw new Error("non risponde");
    return finto.sezioni;
  }),
  annullaLottoImport: vi.fn(async (id) => {
    spie.annullati.push(id);
    if (finto.annullaFallisce) throw new Error(finto.annullaFallisce);
    return spie.importati.length;
  }),
}));
vi.mock("../../src/lib/api/importDrive", () => ({
  apriLottoImport: vi.fn(async () => {
    if (finto.lottoFallito) throw new Error("lotto rifiutato");
    spie.lotti += 1;
    return "lotto-1";
  }),
  impronteInArchivio: vi.fn(async () => {
    if (finto.impronteFallite) throw new Error("non risponde");
    return finto.gia;
  }),
  importaDocumento: vi.fn(async (d) => {
    if (finto.fallisciQuesti.has(d.file.name)) throw new Error("il deposito non risponde");
    spie.importati.push(d);
    return `doc-${spie.importati.length}`;
  }),
  linkElencoDrive: vi.fn(async () => finto.linkPresenti),
  scriviElencoDrive: vi.fn(async (righe) => {
    spie.elenco.push(...righe);
    return righe.length;
  }),
}));
// L'impronta: lo SHA-256 vero non serve qui (lo prova il test delle funzioni pure). Il contenuto dà un'impronta stabile.
vi.mock("../../src/lib/calcoli/importDrive", async (importOriginal) => {
  const vero = await importOriginal();
  return {
    ...vero,
    improntaFile: vi.fn(async (f) => (f.impronta ?? `${(f.name + "0".repeat(64)).replace(/[^a-z0-9]/gi, "0")}`.slice(0, 64)).toLowerCase()),
  };
});

const INTESTAZIONE = "caricare,nome,cartella,formato,MB,data,tipo,sezione,sensibile,no_AI,link";
const rigaCsv = (caricare, nome, sezione, extra = {}) =>
  `${caricare},"${nome}","Drive/${extra.cartella ?? "cartella"}",PDF,0.1,${extra.data ?? "02/11/2026 (nome)"},contratto,${sezione},${extra.sensibile ?? "no"},${extra.noAi ?? "no"},${extra.link ?? `https://example.invalid/${nome}`}`;
const MAPPA = [
  INTESTAZIONE,
  rigaCsv("sì", "Contratto prova.pdf", "Contratti"),
  rigaCsv("sì", "Preventivo prova.pdf", "Preventivi", { data: "10/10/2026 (modifica)" }),
  rigaCsv("sì", "Riservato prova.pdf", "Contratti", { sensibile: "sì — IBAN", noAi: "sì" }),
  rigaCsv("sì", "Senza data.pdf", "Contratti", { data: "" }),
  rigaCsv("sì", "Sezione strana.pdf", "Cose varie"),
  rigaCsv("no (solo elenco)", "Solo elenco.pdf", "", { link: "https://example.invalid/solo1" }),
  rigaCsv("no (solo elenco)", "Altro elenco.pdf", "", { link: "https://example.invalid/solo2" }),
  rigaCsv("sì", "Doppio nome.pdf", "Contratti", { cartella: "01_alfa" }),
  rigaCsv("sì", "Doppio nome.pdf", "Preventivi", { cartella: "02_beta" }),
].join("\n");

const mappaFile = (testo = MAPPA) => new File([testo], "mappa finta.csv", { type: "text/csv" });
const pdf = (nome, contenuto = nome) => {
  const f = new File([contenuto], nome, { type: "application/pdf" });
  f.impronta = [...contenuto].map((c) => c.charCodeAt(0).toString(16)).join("").padEnd(64, "0").slice(0, 64);
  return f;
};

beforeEach(() => {
  finto.sezioniFallite = false;
  finto.gia = new Map();
  finto.impronteFallite = false;
  finto.fallisciQuesti = new Set();
  finto.linkPresenti = new Set();
  finto.lottoFallito = false;
  finto.annullaFallisce = null;
  spie.importati = [];
  spie.lotti = 0;
  spie.elenco = [];
  spie.annullati = [];
});

async function apri() {
  const { default: Pagina } = await import("../../src/pages/documenti/ImportaDalDrive.jsx");
  const vista = render(
    <MemoryRouter initialEntries={["/documenti/importa"]}>
      <Pagina />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByRole("heading", { name: /Importa dal Drive/ })).toBeTruthy());
  return vista;
}

async function scegliMappa(testo) {
  fireEvent.change(screen.getByLabelText("File della mappa"), { target: { files: [mappaFile(testo)] } });
  await screen.findByText(/Mappa «mappa finta.csv»/);
}
async function scegliFile(...files) {
  await waitFor(() => expect(screen.getByLabelText("File da importare").disabled).toBe(false));
  fireEvent.change(screen.getByLabelText("File da importare"), { target: { files } });
}
const riga = (nome) => screen.getByLabelText(`Titolo di ${nome}`).closest("li");

describe("Importa dal Drive · la mappa", () => {
  it("i file restano chiusi finché non c'è la mappa, e lo dice", async () => {
    await apri();
    expect(screen.getByLabelText("File da importare").disabled).toBe(true);
    expect(screen.getByText(/Prima la mappa/)).toBeTruthy();
  });

  it("legge la mappa e dice quanti file entrano e quanti restano solo in elenco", async () => {
    await apri();
    await scegliMappa();
    expect(screen.getByText(/Mappa «mappa finta.csv»/).textContent).toMatch(/7 file da importare/);
    expect(screen.getByText(/Mappa «mappa finta.csv»/).textContent).toMatch(/2 solo in elenco/);
  });

  it("un file che non è la mappa è respinto con le colonne mancanti", async () => {
    await apri();
    fireEvent.change(screen.getByLabelText("File della mappa"), { target: { files: [mappaFile("a,b\n1,2")] } });
    expect(await screen.findByText(/non sembra il file della mappa/)).toBeTruthy();
    expect(screen.getByLabelText("File da importare").disabled).toBe(true);
  });

  it("se le sezioni non si leggono lo dice e non lascia importare", async () => {
    finto.sezioniFallite = true;
    await apri();
    expect(await screen.findByText(/Non sono riuscito a leggere le sezioni dell'Archivio/)).toBeTruthy();
    await scegliMappa();
    expect(screen.getByLabelText("File da importare").disabled).toBe(true);
  });
});

describe("Importa dal Drive · rifiutati e anteprima", () => {
  it("un file sconosciuto e uno «solo elenco» sono rifiutati con il motivo, e non entrano nell'anteprima", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"), pdf("Mai visto.pdf"), pdf("Solo elenco.pdf"));
    const rif = await screen.findByTestId("rifiutati");
    expect(within(rif).getByText(/Mai visto.pdf/).closest("li").textContent).toMatch(/non conosce questo file/);
    expect(within(rif).getByText(/Solo elenco.pdf/).closest("li").textContent).toMatch(/solo in elenco/);
    const anteprima = await screen.findByTestId("anteprima");
    expect(within(anteprima).queryByLabelText("Titolo di Mai visto.pdf")).toBeNull();
    expect(within(anteprima).getByLabelText("Titolo di Contratto prova.pdf")).toBeTruthy();
  });

  it("una riga buona è pronta: sezione e data della mappa, no_ai SPENTO; «Importa 1 documenti»", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"));
    await screen.findByTestId("anteprima");
    const r = riga("Contratto prova.pdf");
    expect(within(r).getByLabelText("Sezione di Contratto prova.pdf").value).toBe("contratti");
    expect(within(r).getByLabelText("Data di Contratto prova.pdf").value).toBe("2026-11-02");
    expect(within(r).getByLabelText("Data di Contratto prova.pdf").className).toContain("campo-data");
    expect(within(r).getByLabelText("Non far leggere all'AI Contratto prova.pdf").checked).toBe(false);
    expect(screen.getByRole("button", { name: "Importa 1 documenti" })).toBeTruthy();
  });

  it("anche il file che la mappa segna «no_AI = sì» parte con la casella SPENTA (decisione di Alessio) e la nota riservato resta visibile", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Riservato prova.pdf"));
    await screen.findByTestId("anteprima");
    const r = riga("Riservato prova.pdf");
    expect(within(r).getByLabelText("Non far leggere all'AI Riservato prova.pdf").checked).toBe(false);
    expect(r.textContent).toContain("IBAN");
  });

  it("una data «(modifica)» è segnalata «da verificare» ma si può importare; si può correggere", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Preventivo prova.pdf"));
    await screen.findByTestId("anteprima");
    const r = riga("Preventivo prova.pdf");
    expect(r.textContent).toMatch(/Da verificare: è l'ultima modifica del file/);
    fireEvent.change(within(r).getByLabelText("Data di Preventivo prova.pdf"), { target: { value: "2026-10-05" } });
    expect(r.textContent).not.toMatch(/Da verificare/);
  });

  it("senza data o con sezione sconosciuta la riga NON si importa finché non si sistema", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Senza data.pdf"), pdf("Sezione strana.pdf"));
    await screen.findByTestId("anteprima");
    const senzaData = riga("Senza data.pdf");
    expect(senzaData.textContent).toMatch(/manca la data del documento/);
    expect(within(senzaData).getByLabelText("Importa Senza data.pdf").disabled).toBe(true);
    const strana = riga("Sezione strana.pdf");
    expect(strana.textContent).toMatch(/«Cose varie» non esiste/);
    expect(screen.getByRole("button", { name: "Importa 0 documenti" }).disabled).toBe(true);
    // Si sistema: la riga si sblocca.
    fireEvent.change(within(strana).getByLabelText("Sezione di Sezione strana.pdf"), { target: { value: "preventivi" } });
    expect(within(strana).getByLabelText("Importa Sezione strana.pdf").disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Importa 1 documenti" })).toBeTruthy();
  });

  it("un doppione già in Archivio è segnalato e parte NON spuntato; due file uguali scelti insieme idem", async () => {
    const a = pdf("Contratto prova.pdf", "stesso contenuto");
    finto.gia = new Map([[a.impronta, "Titolo già in archivio"]]);
    await apri();
    await scegliMappa();
    await scegliFile(a, pdf("Preventivo prova.pdf", "altro"), pdf("Riservato prova.pdf", "altro"));
    await screen.findByTestId("anteprima");
    await waitFor(() => expect(riga("Contratto prova.pdf").textContent).toMatch(/Doppione: Già in Archivio come «Titolo già in archivio»/));
    expect(within(riga("Contratto prova.pdf")).getByLabelText("Importa Contratto prova.pdf").checked).toBe(false);
    await waitFor(() => expect(riga("Riservato prova.pdf").textContent).toMatch(/scelto due volte/));
  });

  it("se non riesce a controllare i doppioni in Archivio lo dice (e non finge che non ce ne siano)", async () => {
    finto.impronteFallite = true;
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"));
    expect(await screen.findByText(/Non sono riuscito a controllare i doppioni già in Archivio/)).toBeTruthy();
  });

  it("due righe con lo stesso nome: chiede quale, e finché non lo dici non importa", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Doppio nome.pdf"));
    const chiedi = await screen.findByTestId("da-scegliere");
    expect(screen.queryByTestId("anteprima")).toBeNull();
    fireEvent.change(within(chiedi).getByLabelText(/Quale riga della mappa è Doppio nome.pdf/), { target: { value: "1" } });
    const anteprima = await screen.findByTestId("anteprima");
    expect(within(anteprima).getByLabelText("Sezione di Doppio nome.pdf").value).toBe("preventivi");
  });
});

describe("Importa dal Drive · importare", () => {
  it("importa le righe spuntate in UN lotto e consegna tutto al collegamento (no_ai, impronta, nota riservato)", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"), pdf("Riservato prova.pdf", "altro"));
    await screen.findByTestId("anteprima");
    fireEvent.click(within(riga("Riservato prova.pdf")).getByLabelText("Non far leggere all'AI Riservato prova.pdf"));
    fireEvent.click(screen.getByRole("button", { name: "Importa 2 documenti" }));
    const esito = await screen.findByTestId("esito");
    expect(esito.textContent).toMatch(/Entrati in Archivio: 2/);
    expect(spie.lotti).toBe(1);
    const riservato = spie.importati.find((d) => d.titolo === "Riservato prova");
    expect(riservato).toMatchObject({ sezione: "contratti", data: "2026-11-02", sensibile: "IBAN", noAi: true, lottoId: "lotto-1" });
    expect(riservato.impronta).toMatch(/^[0-9a-f]{64}$/);
    expect(spie.importati.find((d) => d.titolo === "Contratto prova").noAi).toBe(false);
    // Quelli entrati escono dall'anteprima.
    expect(screen.queryByTestId("anteprima")).toBeNull();
  });

  it("un file che fallisce non ferma gli altri: la pagina dice chiaro chi è entrato e chi no, e il fallito resta per riprovare", async () => {
    finto.fallisciQuesti = new Set(["Preventivo prova.pdf"]);
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"), pdf("Preventivo prova.pdf", "altro"));
    await screen.findByTestId("anteprima");
    fireEvent.click(screen.getByRole("button", { name: "Importa 2 documenti" }));
    const esito = await screen.findByTestId("esito");
    expect(esito.textContent).toMatch(/Entrati in Archivio: 1/);
    expect(esito.textContent).toMatch(/non entrati: 1/);
    expect(esito.textContent).toMatch(/Preventivo prova.pdf non è entrato: il deposito non risponde/);
    expect(spie.importati.map((d) => d.titolo)).toEqual(["Contratto prova"]);
    expect(within(screen.getByTestId("anteprima")).getByLabelText("Titolo di Preventivo prova.pdf")).toBeTruthy();
  });

  it("se il lotto non si apre non importa NIENTE e lo dice", async () => {
    finto.lottoFallito = true;
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"));
    await screen.findByTestId("anteprima");
    fireEvent.click(screen.getByRole("button", { name: "Importa 1 documenti" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/non ho importato niente: lotto rifiutato/);
    expect(spie.importati).toHaveLength(0);
  });

  it("annullare il carico chiede conferma e poi lo annulla; se non si può lo dice com'è", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"));
    await screen.findByTestId("anteprima");
    fireEvent.click(screen.getByRole("button", { name: "Importa 1 documenti" }));
    await screen.findByTestId("esito");
    finto.annullaFallisce = "Un documento è già usato altrove.";
    fireEvent.click(screen.getByRole("button", { name: "Annulla questo carico" }));
    expect(spie.annullati).toHaveLength(0); // prima la conferma
    fireEvent.click(screen.getByRole("button", { name: "Sì, annulla il carico" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/già usato altrove/);
    finto.annullaFallisce = null;
    fireEvent.click(screen.getByRole("button", { name: "Annulla questo carico" }));
    fireEvent.click(screen.getByRole("button", { name: "Sì, annulla il carico" }));
    expect(await screen.findByText(/Carico annullato: ho tolto dall'Archivio 1 documenti/)).toBeTruthy();
    expect(spie.annullati.at(-1)).toBe("lotto-1");
  });
});

describe("Importa dal Drive · l'elenco", () => {
  it("anteprima del conteggio PRIMA di scrivere; i link già presenti non si duplicano; i file «sì» non ci vanno", async () => {
    finto.linkPresenti = new Set(["https://example.invalid/solo1"]);
    await apri();
    await scegliMappa();
    const blocco = screen.getByTestId("elenco-drive");
    fireEvent.click(within(blocco).getByRole("button", { name: "Controlla l'elenco" }));
    await within(blocco).findByText(/Da aggiungere:/);
    expect(blocco.textContent).toMatch(/Da aggiungere: 1 · già presenti: 1/);
    expect(spie.elenco).toHaveLength(0); // niente scritto prima del gesto
    fireEvent.click(within(blocco).getByRole("button", { name: "Carica 1 file nell'elenco" }));
    expect(await within(blocco).findByText(/Fatto: 1 file aggiunti all'elenco/)).toBeTruthy();
    expect(spie.elenco).toHaveLength(1);
    expect(spie.elenco[0]).toMatchObject({ nome: "Altro elenco.pdf", no_ai: false, link: "https://example.invalid/solo2" });
  });
});
