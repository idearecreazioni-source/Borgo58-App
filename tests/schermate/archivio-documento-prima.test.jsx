import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// =====================================================================
// IL DOCUMENTO PRIMA, I DATI DOPO — 10/09/2026, Blocco 4 del mandato
// =====================================================================
// 🔴 IL VERSO DEL GESTO SI È ROVESCIATO. Prima si scriveva la scheda a mano
//    e il file era un allegato in fondo; adesso si sceglie il file, il
//    gestionale lo legge, e la scheda arriva **già compilata**. Copiare a
//    mano nome, tipo e data da un foglio che si ha davanti è il posto dove
//    nascono gli errori che nessuno rilegge.
//
// 🔴 E LA COSA CHE QUESTE PROVE SORVEGLIANO PIÙ DI TUTTE: **niente entra
//    nell'Archivio prima del «Salva»**. Scegliere il file non deve
//    caricare niente, non deve creare nessuna riga, e cambiare idea non
//    deve lasciare in giro un documento a metà.
//
// ⚠️ NESSUNA CHIAMATA VERA AL MODELLO E NESSUN FILE CARICATO: la funzione
//    che legge è finta, e risponde con una proposta scritta qui dentro.
//    Quello che si prova è cosa fa la schermata di quella risposta.

const finte = {
  leggiFile: vi.fn(),
  createDocument: vi.fn(() => Promise.resolve("doc-1")),
  updateDocument: vi.fn(() => Promise.resolve({})),
  uploadFile: vi.fn(() => Promise.resolve({ storage_path: "x", file_name: "y" })),
};

vi.mock("../../src/lib/api/assistente", () => ({
  leggiFileDaArchiviare: (...a) => finte.leggiFile(...a),
}));
vi.mock("../../src/lib/api/documents", () => ({
  createDocument: (...a) => finte.createDocument(...a),
  updateDocument: (...a) => finte.updateDocument(...a),
  uploadDocumentFile: (...a) => finte.uploadFile(...a),
  listDocuments: vi.fn(() => Promise.resolve([])),
  getDocumentUrl: vi.fn(),
  sezioniArchivio: vi.fn(() =>
    Promise.resolve([
      { codice: "contratti", etichetta: "Contratti" },
      { codice: "fatture", etichetta: "Fatture ricevute" },
    ])
  ),
}));
vi.mock("../../src/lib/api/entities", () => ({
  getEntities: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("../../src/lib/api/posta", () => ({
  contaPostaInAttesa: vi.fn(() => Promise.resolve(0)),
}));

const { default: ArchivioDocumentiHome } = await import(
  "../../src/pages/documenti/ArchivioDocumentiHome"
);

const PROPOSTA = {
  nome: "Contratto di locazione — via Roma 12",
  tipo: "contratti",
  data: "2026-08-03",
  controparti: "Rossi Immobiliare",
  importo: 24000,
  scadenza: "2032-08-02",
  date_trovate: [
    { data: "2026-08-03", cosa: "data della firma" },
    { data: "2026-09-01", cosa: "decorrenza" },
    { data: "2032-08-02", cosa: "scadenza" },
  ],
  non_ho_capito: [],
};

const apri = async () => {
  render(
    <MemoryRouter>
      <ArchivioDocumentiHome />
    </MemoryRouter>
  );
  // Il modulo è chiuso finché non lo si apre: è il gesto di sempre.
  const pulsante = await screen.findByRole("button", { name: /nuovo documento|aggiungi|\+/i });
  fireEvent.click(pulsante);
  return pulsante;
};

const scegli = async (nome = "locazione.pdf") => {
  const casella = document.querySelector('input[type="file"]');
  expect(casella, "la casella del file non c'è").toBeTruthy();
  const file = new File(["ciao"], nome, { type: "application/pdf" });
  Object.defineProperty(casella, "files", { value: [file], configurable: true });
  fireEvent.change(casella);
  return file;
};

describe("si sceglie il file, e la scheda arriva compilata", () => {
  it("🔴 il gestionale legge il documento e riempie i campi", async () => {
    finte.leggiFile.mockResolvedValueOnce({ proposta: PROPOSTA, testo: "il testo letto" });
    await apri();
    await scegli();

    await waitFor(() => expect(finte.leggiFile).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/titolo del documento/i).value).toBe(
        "Contratto di locazione — via Roma 12"
      )
    );
    const date = [...document.querySelectorAll('input[type="date"]')].map((i) => i.value);
    expect(date).toContain("2026-08-03");
    expect(date).toContain("2032-08-02");
  });

  it("🔴 e NIENTE è entrato nell'Archivio: né il file, né una riga", async () => {
    // È la promessa del mandato, ed è una **proprietà**: il file viaggia
    // dentro la richiesta e finisce lì. Se cambia idea, non c'è nessun
    // posto da cui togliere qualcosa.
    finte.leggiFile.mockResolvedValueOnce({ proposta: PROPOSTA, testo: "il testo letto" });
    await apri();
    await scegli();
    await waitFor(() => expect(finte.leggiFile).toHaveBeenCalled());

    expect(finte.uploadFile, "il file è stato caricato prima del Salva").not.toHaveBeenCalled();
    expect(finte.createDocument, "il documento è nato prima del Salva").not.toHaveBeenCalled();
  });

  it("🔴 più di una data si mostrano TUTTE, con cosa sono", async () => {
    // Un documento ha quasi sempre la data della firma, quella di
    // decorrenza e quella di scadenza: sceglierne una in silenzio vuol dire
    // archiviarlo sotto l'anno sbagliato senza che nessun errore lo dica.
    finte.leggiFile.mockResolvedValueOnce({ proposta: PROPOSTA, testo: "x" });
    await apri();
    await scegli();
    const riga = await screen.findByText(/nel documento ci sono più date/i);
    expect(riga.textContent).toMatch(/data della firma/);
    expect(riga.textContent).toMatch(/decorrenza/);
    expect(riga.textContent).toMatch(/scadenza/);
  });

  it("🔴 quello che non ha capito lo dice, invece di lasciare caselle vuote e mute", async () => {
    finte.leggiFile.mockResolvedValueOnce({
      proposta: { nome: "", tipo: null, data: null, non_ho_capito: ["di chi è la firma"] },
      testo: "x",
    });
    await apri();
    await scegli();
    const riga = await screen.findByText(/non ho capito/i);
    expect(riga.textContent).toMatch(/come si chiama/);
    expect(riga.textContent).toMatch(/in quale sezione va/);
    expect(riga.textContent).toMatch(/di che data è/);
    expect(riga.textContent).toMatch(/di chi è la firma/);
  });

  it("⚠️ una lettura fallita non impedisce di archiviare, e lo dice", async () => {
    // Il gesto di prima — compilare a mano — deve restare possibile: una
    // schermata che si blocca perché il modello non ha risposto sarebbe
    // peggio di quella che c'era.
    finte.leggiFile.mockRejectedValueOnce(new Error("l'account AI non risponde"));
    await apri();
    await scegli();
    const riga = await screen.findByText(/non sono riuscito a leggere il file/i);
    expect(riga.textContent).toMatch(/si compila a mano/);
    expect(screen.getByPlaceholderText(/titolo del documento/i)).toBeTruthy();
  });

  it("⚠️ e quello che una persona ha già scritto NON viene sovrascritto", async () => {
    // Una lettura che cancella quello che qualcuno ha appena battuto è il
    // difetto del 12/08, pagato una volta: si propone SOPRA IL VUOTO.
    finte.leggiFile.mockResolvedValueOnce({ proposta: PROPOSTA, testo: "x" });
    await apri();
    const titolo = screen.getByPlaceholderText(/titolo del documento/i);
    fireEvent.change(titolo, { target: { value: "Lo chiamo io così" } });
    await scegli();
    await waitFor(() => expect(finte.leggiFile).toHaveBeenCalled());
    expect(titolo.value).toBe("Lo chiamo io così");
  });
});

describe("solo il «Salva» fa entrare il documento", () => {
  it("🔴 premendo Salva: prima il file, poi la scheda, poi il testo già letto", async () => {
    finte.createDocument.mockClear();
    finte.uploadFile.mockClear();
    finte.updateDocument.mockClear();
    finte.leggiFile.mockResolvedValueOnce({ proposta: PROPOSTA, testo: "il testo letto" });
    await apri();
    await scegli();
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/titolo del documento/i).value).not.toBe("")
    );

    fireEvent.click(screen.getByRole("button", { name: /salva nell'archivio/i }));

    await waitFor(() => expect(finte.createDocument).toHaveBeenCalledTimes(1));
    expect(finte.uploadFile).toHaveBeenCalledTimes(1);
    const scritto = finte.createDocument.mock.calls[0][0];
    expect(scritto.title).toBe("Contratto di locazione — via Roma 12");
    expect(scritto.doc_type).toBe("contratti");
    expect(scritto.document_date).toBe("2026-08-03");

    // 🔴 IL TESTO GIÀ LETTO SI CONSERVA: senza, il documento nascerebbe
    //    cieco e «Chiedi all'archivio» risponderebbe «non ce l'ho» su un
    //    file appena letto — cioè si pagherebbe due volte la stessa
    //    lettura.
    await waitFor(() => expect(finte.updateDocument).toHaveBeenCalledTimes(1));
    expect(finte.updateDocument.mock.calls[0][1]).toEqual({ testo: "il testo letto" });
  });

  it("🔴 il flusso intero: lettura → correzione a mano → salvataggio", async () => {
    // 10/09/2026, dal collaudo: la lettura funzionava e il «Salva» si fermava
    // (il deposito dei file rifiutava il caricamento, vedi la migrazione
    // `20260910000003`). Qui si prova la metà che sta nella schermata: quello
    // che una persona CORREGGE dopo la lettura è quello che entra, non quello
    // che il modello aveva proposto.
    finte.createDocument.mockClear();
    finte.uploadFile.mockClear();
    finte.updateDocument.mockClear();
    finte.leggiFile.mockResolvedValueOnce({ proposta: PROPOSTA, testo: "il testo letto" });
    await apri();
    await scegli();
    const titolo = screen.getByPlaceholderText(/titolo del documento/i);
    await waitFor(() => expect(titolo.value).toBe("Contratto di locazione — via Roma 12"));

    // La correzione: il nome giusto lo sa chi ha il foglio davanti.
    fireEvent.change(titolo, { target: { value: "Locazione via Roma 12 — firmata" } });
    fireEvent.click(screen.getByRole("button", { name: /salva nell'archivio/i }));

    await waitFor(() => expect(finte.createDocument).toHaveBeenCalledTimes(1));
    // ⚠️ L'ORDINE è quello del 20/08: prima il file, poi la scheda. Una
    //    scheda che nasce prima del file, se il caricamento fallisce, resta
    //    un documento che dichiara un allegato che non c'è.
    expect(finte.uploadFile.mock.invocationCallOrder[0]).toBeLessThan(
      finte.createDocument.mock.invocationCallOrder[0]
    );
    const scritto = finte.createDocument.mock.calls[0][0];
    expect(scritto.title, "è entrato il nome proposto, non quello corretto").toBe(
      "Locazione via Roma 12 — firmata"
    );
    // Il resto della proposta, che nessuno ha toccato, arriva com'era…
    expect(scritto.doc_type).toBe("contratti");
    expect(scritto.document_date).toBe("2026-08-03");
    // …e il file caricato è quello scelto, col percorso che il deposito ha dato.
    expect(scritto.storage_path).toBe("x");
    await waitFor(() => expect(finte.updateDocument).toHaveBeenCalledTimes(1));
    expect(finte.updateDocument.mock.calls[0]).toEqual(["doc-1", { testo: "il testo letto" }]);
  });
});
