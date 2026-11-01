import { beforeEach, describe, expect, it, vi } from "vitest";

// IL FILE XML RESTA ATTACCATO ALLA FATTURA (01/11/2026).
//
// Chi importa una fattura elettronica deve ritrovare il documento originale
// dalle Fatture fornitori, senza ricaricarlo a mano in Archivio. Il file è
// una riga di `documents` collegata con `supplier_invoice_id`: nessuna
// migrazione. Dati inventati.

const uploadDocumentFile = vi.fn();
const createDocument = vi.fn();
const deleteDocument = vi.fn();
const collegaDocumentoAFattura = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));

vi.mock("../../src/lib/supabase", () => ({
  supabase: { from: () => ({ select }) },
  supabasePubblico: {},
}));
vi.mock("../../src/lib/api/documents", () => ({
  uploadDocumentFile: (...a) => uploadDocumentFile(...a),
  createDocument: (...a) => createDocument(...a),
  deleteDocument: (...a) => deleteDocument(...a),
}));
vi.mock("../../src/lib/api/supplierInvoices", () => ({
  collegaDocumentoAFattura: (...a) => collegaDocumentoAFattura(...a),
}));

const { nomeFileXml, documentoDellaFattura, allegaXmlPerFile } = await import("../../src/lib/api/fatturaXml");

const fattura = {
  numero: "7/A",
  data: "2026-10-20",
  totaleCentesimi: 12200,
  fornitore: { denominazione: "Fornitore Inventato Srl" },
};

describe("nome del file xml da conservare", () => {
  it("un p7m si conserva come xml estratto", () => {
    expect(nomeFileXml("IT01234567890_00001.xml.p7m")).toBe("IT01234567890_00001.xml");
  });
  it("un xml resta com'è, un nome senza estensione prende .xml", () => {
    expect(nomeFileXml("a.xml")).toBe("a.xml");
    expect(nomeFileXml("a.XML")).toBe("a.XML");
    expect(nomeFileXml("a")).toBe("a.xml");
  });
});

describe("la riga di Archivio della fattura", () => {
  it("sta in Fatture ricevute, con importo e data, e SENZA scadenza", () => {
    const d = documentoDellaFattura(fattura, "ent-1", "a.xml", "file-1.xml");
    expect(d.doc_type).toBe("fatture_ricevute");
    expect(d.entity_id).toBe("ent-1");
    expect(d.document_date).toBe("2026-10-20");
    expect(d.amount).toBe(122);
    expect(d.title).toContain("7/A");
    expect(d.title).toContain("Fornitore Inventato Srl");
    expect(d.expiry_date ?? null).toBeNull();
  });
  it("regge una fattura con pochi dati", () => {
    const d = documentoDellaFattura({ fornitore: {} }, "e", "a.xml", "p");
    expect(d.title).toMatch(/fattura/i);
    expect(d.amount).toBeNull();
    expect(d.document_date).toBeNull();
  });
});

describe("allegare l'xml a una fattura già registrata", () => {
  beforeEach(() => {
    [uploadDocumentFile, createDocument, deleteDocument, collegaDocumentoAFattura, maybeSingle].forEach((m) => m.mockReset());
    uploadDocumentFile.mockResolvedValue({ storage_path: "uuid-a.xml", file_name: "a.xml" });
    createDocument.mockResolvedValue("doc-1");
    collegaDocumentoAFattura.mockResolvedValue(undefined);
    deleteDocument.mockResolvedValue(undefined);
  });
  const dati = { entityId: "ent-1", nomeFile: "a.xml.p7m", xml: "<a/>", fattura };

  it("carica il file, crea la riga e la collega", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "inv-1", documenti: [] }, error: null });
    const r = await allegaXmlPerFile(dati);
    expect(r).toBe("salvato");
    const file = uploadDocumentFile.mock.calls[0][0];
    expect(file.name).toBe("a.xml");
    expect(await file.text()).toBe("<a/>");
    expect(createDocument.mock.calls[0][0]).toMatchObject({ storage_path: "uuid-a.xml", file_name: "a.xml", entity_id: "ent-1" });
    expect(collegaDocumentoAFattura).toHaveBeenCalledWith("doc-1", "inv-1");
    expect(eq).toHaveBeenCalledWith("file_sdi", "a.xml.p7m");
  });

  it("se il file c'è già non ne crea un secondo", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "inv-1", documenti: [{ id: "d", file_name: "a.xml" }] }, error: null });
    expect(await allegaXmlPerFile(dati)).toBe("gia_presente");
    expect(uploadDocumentFile).not.toHaveBeenCalled();
    expect(createDocument).not.toHaveBeenCalled();
  });

  it("un altro documento collegato (un DDT) non conta come xml", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "inv-1", documenti: [{ id: "d", file_name: "ddt.pdf" }] }, error: null });
    expect(await allegaXmlPerFile(dati)).toBe("salvato");
  });

  it("fattura non trovata: lo dice e non carica niente", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(allegaXmlPerFile(dati)).rejects.toThrow(/non trovo la fattura/i);
    expect(uploadDocumentFile).not.toHaveBeenCalled();
  });

  it("caricamento fallito: errore chiaro, nessuna riga creata", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "inv-1", documenti: [] }, error: null });
    uploadDocumentFile.mockRejectedValue(new Error("deposito giù"));
    await expect(allegaXmlPerFile(dati)).rejects.toThrow(/deposito giù/);
    expect(createDocument).not.toHaveBeenCalled();
  });

  it("collegamento fallito: la riga appena creata viene tolta, niente doppioni al secondo tentativo", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "inv-1", documenti: [] }, error: null });
    collegaDocumentoAFattura.mockRejectedValue(new Error("rete"));
    await expect(allegaXmlPerFile(dati)).rejects.toThrow(/rete/);
    expect(deleteDocument).toHaveBeenCalledWith({ id: "doc-1", storage_path: "uuid-a.xml" });
  });

  it("errore di lettura della fattura: si propaga", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(allegaXmlPerFile(dati)).rejects.toThrow(/boom/);
  });
});
