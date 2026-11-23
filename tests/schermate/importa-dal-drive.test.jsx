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
  societa: { srls: { id: "srls-prova" } },
  societaFallita: false,
  annullaFallisce: null,
  trattieniImpronta: null,
  trattieniImporta: null,
  improntaFallisce: false,
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
vi.mock("../../src/lib/api/entities", () => ({
  getEntities: vi.fn(async () => {
    if (finto.societaFallita) throw new Error("non risponde");
    return finto.societa;
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
    if (finto.trattieniImporta) await finto.trattieniImporta;
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
    improntaFile: vi.fn(async (f) => {
      if (finto.improntaFallisce) throw new Error("illeggibile");
      if (finto.trattieniImpronta) await finto.trattieniImpronta;
      return (f.impronta ?? `${(f.name + "0".repeat(64)).replace(/[^a-z0-9]/gi, "0")}`.slice(0, 64)).toLowerCase();
    }),
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
  finto.societa = { srls: { id: "srls-prova" } };
  finto.societaFallita = false;
  finto.annullaFallisce = null;
  finto.trattieniImpronta = null;
  finto.trattieniImporta = null;
  finto.improntaFallisce = false;
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
  fireEvent.change(screen.getByLabelText(/^Scegli (la|un'altra) mappa/), { target: { files: [mappaFile(testo)] } });
  await screen.findByText(/Mappa «mappa finta.csv»/);
}
async function scegliFile(...files) {
  await waitFor(() => expect(screen.getByLabelText("Scegli i file").disabled).toBe(false));
  fireEvent.change(screen.getByLabelText("Scegli i file"), { target: { files } });
}
const riga = (nome) => screen.getByLabelText(`Titolo di ${nome}`).closest("li");

describe("Importa dal Drive · la mappa", () => {
  it("i file restano chiusi finché non c'è la mappa, e lo dice", async () => {
    await apri();
    expect(screen.getByLabelText("Scegli i file").disabled).toBe(true);
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
    fireEvent.change(screen.getByLabelText(/^Scegli (la|un'altra) mappa/), { target: { files: [mappaFile("a,b\n1,2")] } });
    expect(await screen.findByText(/non sembra il file della mappa/)).toBeTruthy();
    expect(screen.getByLabelText("Scegli i file").disabled).toBe(true);
  });

  it("se le sezioni non si leggono lo dice e non lascia importare", async () => {
    finto.sezioniFallite = true;
    await apri();
    expect(await screen.findByText(/Non sono riuscito a leggere le sezioni dell'Archivio/)).toBeTruthy();
    await scegliMappa();
    expect(screen.getByLabelText("Scegli i file").disabled).toBe(true);
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
    expect(within(r).getByLabelText("Sezione").value).toBe("contratti");
    expect(within(r).getByLabelText("Data del documento").value).toBe("2026-11-02");
    expect(within(r).getByLabelText("Data del documento").className).toContain("campo-data");
    expect(within(r).getByLabelText("Non far leggere all'AI").checked).toBe(false);
    expect(screen.getByRole("button", { name: "Importa 1 documenti" })).toBeTruthy();
  });

  it("anche il file che la mappa segna «no_AI = sì» parte con la casella SPENTA (decisione di Alessio) e la nota riservato resta visibile", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Riservato prova.pdf"));
    await screen.findByTestId("anteprima");
    const r = riga("Riservato prova.pdf");
    expect(within(r).getByLabelText("Non far leggere all'AI").checked).toBe(false);
    expect(r.textContent).toContain("IBAN");
  });

  it("una data «(modifica)» è segnalata «da verificare» ma si può importare; si può correggere", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Preventivo prova.pdf"));
    await screen.findByTestId("anteprima");
    const r = riga("Preventivo prova.pdf");
    expect(r.textContent).toMatch(/Da verificare: è l'ultima modifica del file/);
    fireEvent.change(within(r).getByLabelText("Data del documento"), { target: { value: "2026-10-05" } });
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
    fireEvent.change(within(strana).getByLabelText("Sezione"), { target: { value: "preventivi" } });
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
    expect(within(anteprima).getByLabelText("Sezione").value).toBe("preventivi");
  });
});

describe("Importa dal Drive · importare", () => {
  it("importa le righe spuntate in UN lotto e consegna tutto al collegamento (no_ai, impronta, nota riservato)", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"), pdf("Riservato prova.pdf", "altro"));
    await screen.findByTestId("anteprima");
    fireEvent.click(within(riga("Riservato prova.pdf")).getByLabelText("Non far leggere all'AI"));
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

  it("ogni documento importato porta la società (Borgo 58 S.r.l.s.)", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"));
    await screen.findByTestId("anteprima");
    fireEvent.click(screen.getByRole("button", { name: "Importa 1 documenti" }));
    await screen.findByTestId("esito");
    expect(spie.importati).toHaveLength(1);
    expect(spie.importati[0].entityId).toBe("srls-prova");
  });

  it("se la società non si trova non apre il carico e non importa NIENTE", async () => {
    finto.societa = {};
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"));
    await screen.findByTestId("anteprima");
    fireEvent.click(screen.getByRole("button", { name: "Importa 1 documenti" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Non trovo Borgo 58 S\.r\.l\.s\..*non ho importato niente/);
    expect(spie.importati).toHaveLength(0);
    expect(spie.lotti).toBe(0);
  });

  it("se la società non si legge non apre il carico e non importa NIENTE", async () => {
    finto.societaFallita = true;
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"));
    await screen.findByTestId("anteprima");
    fireEvent.click(screen.getByRole("button", { name: "Importa 1 documenti" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Non sono riuscito a leggere la società.*non ho importato niente/);
    expect(spie.importati).toHaveLength(0);
    expect(spie.lotti).toBe(0);
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

// ---------------------------------------------------------------------
// La revisione React del 22/11: un gesto alla volta, il riepilogo non sparisce, niente in silenzio.
// ---------------------------------------------------------------------
const tieni = () => {
  let rilascia;
  const promessa = new Promise((r) => {
    rilascia = r;
  });
  return { promessa, rilascia };
};
const grande = (nome, mb) => {
  const f = pdf(nome);
  Object.defineProperty(f, "size", { value: mb * 1024 * 1024 });
  return f;
};
const etichettaMappa = () => screen.getByLabelText(/^Scegli (la|un'altra) mappa/);

describe("Importa dal Drive · un gesto alla volta", () => {
  it("un doppio clic su «Importa» non importa due volte", async () => {
    const t = tieni();
    finto.trattieniImporta = t.promessa;
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"));
    await screen.findByTestId("anteprima");
    const bottoneImporta = screen.getByRole("button", { name: "Importa 1 documenti" });
    fireEvent.click(bottoneImporta);
    fireEvent.click(bottoneImporta);
    t.rilascia();
    await screen.findByTestId("esito");
    expect(spie.lotti).toBe(1);
    expect(spie.importati).toHaveLength(1);
  });

  it("mentre importa tutti i campi sono bloccati e chiudere la scheda chiede conferma al browser", async () => {
    const t = tieni();
    finto.trattieniImporta = t.promessa;
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"));
    await screen.findByTestId("anteprima");
    fireEvent.click(screen.getByRole("button", { name: "Importa 1 documenti" }));
    await waitFor(() => expect(document.querySelector("fieldset").disabled).toBe(true));
    expect(screen.getByRole("button", { name: /Importo 1 di 1/ }).disabled).toBe(true);
    const uscita = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(uscita);
    expect(uscita.defaultPrevented).toBe(true);
    t.rilascia();
    await screen.findByTestId("esito");
    await waitFor(() => expect(document.querySelector("fieldset").disabled).toBe(false));
    const dopo = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dopo);
    expect(dopo.defaultPrevented).toBe(false);
  });

  it("finita l'importazione il focus va al titolo del riepilogo, e il riepilogo è annunciato", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"));
    await screen.findByTestId("anteprima");
    fireEvent.click(screen.getByRole("button", { name: "Importa 1 documenti" }));
    const titolo = await screen.findByRole("heading", { name: /Ultimo carico — com'è andata/ });
    await waitFor(() => expect(document.activeElement).toBe(titolo));
    expect(within(screen.getByTestId("esito")).getByRole("status").textContent).toMatch(/Entrati in Archivio: 1/);
  });
});

describe("Importa dal Drive · il riepilogo non sparisce", () => {
  it("cambiare mappa o scegliere altri file NON toglie «Annulla questo carico»; si chiude solo con un clic esplicito", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"));
    await screen.findByTestId("anteprima");
    fireEvent.click(screen.getByRole("button", { name: "Importa 1 documenti" }));
    await screen.findByTestId("esito");
    fireEvent.change(etichettaMappa(), { target: { files: [mappaFile()] } });
    await waitFor(() => expect(screen.getByText(/Mappa «mappa finta.csv»/)).toBeTruthy());
    expect(screen.getByRole("button", { name: "Annulla questo carico" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Chiudi questo riepilogo" }));
    expect(screen.queryByTestId("esito")).toBeNull();
  });

  it("un carico in cui non è entrato niente lo dice e non offre di annullare", async () => {
    finto.fallisciQuesti = new Set(["Contratto prova.pdf"]);
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"));
    await screen.findByTestId("anteprima");
    fireEvent.click(screen.getByRole("button", { name: "Importa 1 documenti" }));
    const esito = await screen.findByTestId("esito");
    expect(esito.textContent).toMatch(/Nessun documento è entrato: il carico è rimasto vuoto/);
    expect(screen.queryByRole("button", { name: "Annulla questo carico" })).toBeNull();
  });
});

describe("Importa dal Drive · niente in silenzio", () => {
  it("un file scelto due volte non sparisce in silenzio: lo dice", async () => {
    await apri();
    await scegliMappa();
    const stesso = pdf("Contratto prova.pdf");
    await scegliFile(stesso);
    await screen.findByTestId("anteprima");
    await scegliFile(stesso);
    expect(await screen.findByText(/1 file era già stato scelto e l'ho ignorato/)).toBeTruthy();
  });

  it("un file oltre il limite del deposito è rifiutato PRIMA di caricarlo, con il motivo", async () => {
    await apri();
    await scegliMappa();
    await scegliFile(grande("Contratto prova.pdf", 80));
    const rif = await screen.findByTestId("rifiutati");
    expect(rif.textContent).toMatch(/Pesa 80 MB: il deposito accetta al massimo 50 MB/);
    expect(screen.queryByTestId("anteprima")).toBeNull();
  });

  it("un file insolito (html) è segnalato e parte NON spuntato", async () => {
    const m = [INTESTAZIONE, rigaCsv("sì", "Pagina.html", "Contratti")].join("\n");
    await apri();
    await scegliMappa(m);
    await scegliFile(pdf("Pagina.html"));
    await screen.findByTestId("anteprima");
    const r = riga("Pagina.html");
    await waitFor(() => expect(r.textContent).toMatch(/insolito in un archivio di documenti/));
    expect(within(r).getByLabelText("Importa Pagina.html").checked).toBe(false);
  });

  it("una mappa nuova che non si legge NON butta via quella buona", async () => {
    await apri();
    await scegliMappa();
    fireEvent.change(etichettaMappa(), { target: { files: [mappaFile("a;b;c\n1;2;3")] } });
    expect(await screen.findByText(/deve essere la virgola/)).toBeTruthy();
    expect(screen.getByText(/Tengo la mappa di prima/)).toBeTruthy();
    expect(screen.getByText(/Mappa «mappa finta.csv»/)).toBeTruthy();
  });

  it("una virgoletta mai chiusa è un errore detto a parole", async () => {
    await apri();
    fireEvent.change(etichettaMappa(), { target: { files: [mappaFile(INTESTAZIONE + '\nsì,"nome senza fine,x')] } });
    expect(await screen.findByText(/virgoletta aperta e mai chiusa/)).toBeTruthy();
  });

  it("durante il controllo dice a che file è arrivato, e se un file non si legge lo scrive sulla sua riga", async () => {
    const t = tieni();
    finto.trattieniImpronta = t.promessa;
    await apri();
    await scegliMappa();
    await scegliFile(pdf("Contratto prova.pdf"));
    expect(await screen.findByText(/Controllo il file 1 di 1 \(Contratto prova.pdf\)/)).toBeTruthy();
    t.rilascia();
    finto.trattieniImpronta = null;
    await screen.findByTestId("anteprima");
    finto.improntaFallisce = true;
    await scegliFile(pdf("Preventivo prova.pdf"));
    await waitFor(() => expect(riga("Preventivo prova.pdf").textContent).toMatch(/controllo dei doppioni non è valido per questo file/));
  });
});

describe("Importa dal Drive · i doppioni dopo un carico", () => {
  it("quello appena entrato conta come «già in Archivio»: il file uguale rimasto in anteprima resta un doppione", async () => {
    const a = pdf("Contratto prova.pdf", "stesso");
    const b = pdf("Preventivo prova.pdf", "stesso");
    await apri();
    await scegliMappa();
    await scegliFile(a, b);
    await screen.findByTestId("anteprima");
    await waitFor(() => expect(riga("Preventivo prova.pdf").textContent).toMatch(/scelto due volte/));
    // Il primo entra; il secondo (non spuntato) resta, ed è un doppione VERO di quello appena archiviato.
    fireEvent.click(screen.getByRole("button", { name: "Importa 1 documenti" }));
    await screen.findByTestId("esito");
    await waitFor(() => expect(riga("Preventivo prova.pdf").textContent).toMatch(/Già in Archivio come «Contratto prova»/));
  });
});
