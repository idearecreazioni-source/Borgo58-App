import { beforeEach, describe, expect, it, vi } from "vitest";

// IL FILE CHE RESTAVA NEL DEPOSITO — 20/08/2026.
//
// 🔴 Misurato in produzione: **13 file nel deposito, 3 che nessun documento
// nomina più**. Erano documenti cancellati dall'app, dove la rimozione del
// file falliva e il fallimento veniva ingoiato: l'app diceva «fatto» con
// metà lavoro svolto, e quei file dall'app non si potevano più nominare.
//
// ⚠️ NON ESISTE UNA TRANSAZIONE FRA DATABASE E DEPOSITO. Se il secondo
// passo fallisce, qualcosa resta a metà **in tutti e due gli ordini**: non
// si sceglie fra «tutto o niente» e «metà», si sceglie **quale metà**. Il
// 20/08 l'ordine è stato invertito — prima il file, poi la riga — perché
// quella metà **si vede** (il documento è in elenco e non si apre) e **si
// ripara da sé** al tentativo dopo, mentre l'altra taceva per sempre.
//
// 🔴 QUESTA PROVA GUARDA LE DUE DIREZIONI, ed è il punto: una che prova solo
// il caso che riesce non distingue l'ordine nuovo da quello vecchio.

const remove = vi.fn();
const eseguiOperazione = vi.fn();

vi.mock("../../src/lib/supabase", () => ({
  supabase: { storage: { from: () => ({ remove }) } },
  supabasePubblico: {},
}));
vi.mock("../../src/lib/operazioni", () => ({
  eseguiOperazione: (...a) => eseguiOperazione(...a),
}));

const { deleteDocument } = await import("../../src/lib/api/documents");

describe("cancellare un documento non lascia file nel deposito", () => {
  beforeEach(() => {
    remove.mockReset();
    eseguiOperazione.mockReset();
  });

  it("quando il file si toglie, la riga si cancella — e in QUEST'ORDINE", async () => {
    const ordine = [];
    remove.mockImplementation(async (p) => {
      ordine.push(`file:${p[0]}`);
      return { data: [{}], error: null };
    });
    eseguiOperazione.mockImplementation(async () => {
      ordine.push("riga");
      return null;
    });

    await deleteDocument({ id: "doc-1", storage_path: "posta/x/atto.pdf" });

    // ⚠️ L'ordine È la regola: invertendolo si torna al file orfano
    // invisibile, e una prova che guardasse solo «sono successe entrambe»
    // non se ne accorgerebbe.
    expect(ordine).toEqual(["file:posta/x/atto.pdf", "riga"]);
    expect(eseguiOperazione).toHaveBeenCalledWith("delete_document", { p_document_id: "doc-1" });
  });

  it("🔴 quando il file NON si toglie, la riga RESTA e l'errore lo dice", async () => {
    remove.mockResolvedValue({ data: null, error: { message: "deposito non raggiungibile" } });

    await expect(
      deleteDocument({ id: "doc-2", storage_path: "posta/x/atto.pdf" })
    ).rejects.toThrow(/non ho tolto neanche il documento/i);

    // È la parte che chiude il difetto: prima la riga se ne andava lo stesso.
    expect(
      eseguiOperazione,
      "la riga è stata cancellata pur non essendo riuscito a togliere il file"
    ).not.toHaveBeenCalled();
  });

  it("e il messaggio dice cosa è successo e cosa fare, non solo che è andata male", async () => {
    remove.mockResolvedValue({ data: null, error: { message: "deposito non raggiungibile" } });
    const errore = await deleteDocument({ id: "doc-3", storage_path: "p/f.pdf" }).catch((e) => e);
    // ⚠️ Un rifiuto senza via di ritorno è un vicolo cieco (regola del 16/08).
    expect(errore.message).toContain("resta tutto com'era");
    expect(errore.message).toContain("Riprova");
    // E porta dentro il motivo vero, che è quello che serve per capire.
    expect(errore.message).toContain("deposito non raggiungibile");
  });

  it("un documento senza file non chiama il deposito", async () => {
    eseguiOperazione.mockResolvedValue(null);
    await deleteDocument({ id: "doc-4", storage_path: null });
    expect(remove).not.toHaveBeenCalled();
    expect(eseguiOperazione).toHaveBeenCalledTimes(1);
  });
});
