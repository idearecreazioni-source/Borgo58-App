import { beforeEach, describe, expect, it, vi } from "vitest";

// REVISIONE DEL 23/11/2026, punti 1 e 3: un documento importato dal Drive nasce COLLEGATO a Borgo 58 S.r.l.s. e con
// il segno «data da verificare» quando la data è quella dell'ultima modifica del file.
// 🔴 Se l'import non scrive la società, le proposte della Scheda (che guardano solo i documenti della S.r.l.s.) non
//    vedono mai i contratti nuovi; se non scrive il segno, MEMO presenta come certa una data di modifica del file.
// Righe inventate (il repo è pubblico).

const insert = vi.fn();
const update = vi.fn();
const uploadDocumentFile = vi.fn();
const removeDocumentFile = vi.fn();

function catena(risultato) {
  const c = {
    select: () => c,
    eq: () => c,
    single: async () => risultato,
  };
  return c;
}

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: () => ({
      insert: (riga) => {
        insert(riga);
        return catena({ data: { id: "doc-nuovo" }, error: null });
      },
      update: (patch) => {
        update(patch);
        return catena({ data: { id: "doc-1", ...patch }, error: null });
      },
    }),
  },
  supabasePubblico: {},
}));
vi.mock("../../src/lib/api/documents", () => ({
  uploadDocumentFile: (...a) => uploadDocumentFile(...a),
  removeDocumentFile: (...a) => removeDocumentFile(...a),
}));

const { importaDocumento, confermaDataDocumento } = await import("../../src/lib/api/importDrive");

const base = {
  file: { name: "contratto-inventato.pdf" },
  titolo: "Contratto inventato",
  sezione: "contratti",
  data: "2026-10-10",
  sensibile: null,
  noAi: false,
  impronta: "a".repeat(64),
  lottoId: "lotto-1",
};

describe("l'import scrive società e segno «data da verificare»", () => {
  beforeEach(() => {
    insert.mockReset();
    update.mockReset();
    uploadDocumentFile.mockReset();
    uploadDocumentFile.mockResolvedValue({ storage_path: "archivio/x.pdf", file_name: "x.pdf" });
  });

  it("scrive la società passata dalla pagina", async () => {
    await importaDocumento({ ...base, entityId: "srls-1", dataDaVerificare: false });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({ entity_id: "srls-1", doc_type: "contratti", document_date: "2026-10-10" });
  });

  it("la data dell'ultima modifica entra col segno «da verificare»", async () => {
    await importaDocumento({ ...base, entityId: "srls-1", dataDaVerificare: true });
    expect(insert.mock.calls[0][0].data_da_verificare).toBe(true);
  });

  it("una data sicura (dal nome del file) entra senza segno", async () => {
    await importaDocumento({ ...base, entityId: "srls-1", dataDaVerificare: false });
    expect(insert.mock.calls[0][0].data_da_verificare).toBe(false);
  });

  it("un valore strano (non `true`) non accende il segno", async () => {
    await importaDocumento({ ...base, entityId: "srls-1", dataDaVerificare: "si" });
    expect(insert.mock.calls[0][0].data_da_verificare).toBe(false);
  });

  it("«La data è giusta» spegne solo il segno, senza toccare la data", async () => {
    const saved = await confermaDataDocumento("doc-1");
    expect(update).toHaveBeenCalledWith({ data_da_verificare: false });
    expect(saved.data_da_verificare).toBe(false);
  });
});
