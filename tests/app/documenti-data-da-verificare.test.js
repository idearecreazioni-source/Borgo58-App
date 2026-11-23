import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio } from "./aiuto";

// REVISIONE DEL 23/11/2026, punto 3: il segno «data da verificare» sul documento, provato su un database vero (Prova).
// Solo righe inventate (il repo è pubblico); si tolgono solo quelle di cui si conosce l'id.

const SIGLA = marchio("PROVA DATA INCERTA");

describe("documenti: data da verificare", () => {
  let titolare;
  const documenti = [];

  const nuovo = async (extra = {}) => {
    const { data, error } = await titolare
      .from("documents")
      .insert({ title: `${SIGLA} ${documenti.length}`, doc_type: "contratti", document_date: "2026-10-10", ...extra })
      .select("id, document_date, data_incerta")
      .single();
    expect(error).toBeNull();
    documenti.push(data.id);
    return data;
  };

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
  });

  afterAll(async () => {
    if (documenti.length > 0) {
      await titolare.from("documents").delete().in("id", documenti);
      await titolare.from("deleted_records").delete().in("record_id", documenti);
    }
  });

  it("per partenza il segno è spento", async () => {
    const d = await nuovo();
    expect(d.data_incerta).toBe(false);
  });

  it("un documento può nascere col segno acceso", async () => {
    const d = await nuovo({ data_incerta: true });
    expect(d.data_incerta).toBe(true);
  });

  it("cambiare la data spegne il segno da solo", async () => {
    const d = await nuovo({ data_incerta: true });
    const { data, error } = await titolare
      .from("documents")
      .update({ document_date: "2026-09-01" })
      .eq("id", d.id)
      .select("document_date, data_incerta")
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ document_date: "2026-09-01", data_incerta: false });
  });

  it("cambiare altro (non la data) lascia il segno com'è", async () => {
    const d = await nuovo({ data_incerta: true });
    const { data, error } = await titolare
      .from("documents")
      .update({ note: "una nota" })
      .eq("id", d.id)
      .select("data_incerta")
      .single();
    expect(error).toBeNull();
    expect(data.data_incerta).toBe(true);
  });

  it("riscrivere la STESSA data non spegne il segno", async () => {
    const d = await nuovo({ data_incerta: true });
    const { data, error } = await titolare
      .from("documents")
      .update({ document_date: "2026-10-10" })
      .eq("id", d.id)
      .select("data_incerta")
      .single();
    expect(error).toBeNull();
    expect(data.data_incerta).toBe(true);
  });

  it("«La data è giusta» spegne il segno e la data resta", async () => {
    const d = await nuovo({ data_incerta: true });
    const { data, error } = await titolare
      .from("documents")
      .update({ data_incerta: false })
      .eq("id", d.id)
      .select("document_date, data_incerta")
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ document_date: "2026-10-10", data_incerta: false });
  });

  it("MEMO legge il segno insieme alla data", async () => {
    const d = await nuovo({ data_incerta: true });
    const { data, error } = await titolare.rpc("memo_leggi_documenti", { p_cerca: SIGLA });
    expect(error).toBeNull();
    const riga = (data ?? []).find((r) => r.riga_id === d.id);
    expect(riga).toBeTruthy();
    expect(riga.dati.data_incerta).toBe(true);
    expect(riga.dati.data_documento).toBe("2026-10-10");
  });
});
