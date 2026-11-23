import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio } from "./aiuto";

// REVISIONE DEL 23/11/2026, punto 4: con «non far leggere all'AI» acceso, il promemoria del documento non arriva a MEMO,
// e la Scheda per MEMO ha ancora i contatori di tutte le voci. Su un database vero (Prova), righe inventate.
// ⚠️ Le voci della Scheda non si cancellano (lo vieta il database): qui non se ne scrive nessuna. Il caso della voce
//    collegata a un documento lo prova la verifica interna della migrazione, che si annulla da sola.

const SIGLA = marchio("PROVA NO AI AGENDA");

describe("no_ai: l'Agenda di MEMO e la Scheda per MEMO", () => {
  let titolare;
  const documenti = [];
  const task = [];

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
  });

  afterAll(async () => {
    if (task.length > 0) await titolare.from("tasks").delete().in("id", task);
    if (documenti.length > 0) {
      await titolare.from("documents").delete().in("id", documenti);
      await titolare.from("deleted_records").delete().in("record_id", documenti);
    }
  });

  it("un promemoria collegato a un documento riservato non arriva a MEMO; spento il segno, torna", async () => {
    const t = await titolare
      .from("tasks")
      .insert({ title: `${SIGLA} scadenza`, due_date: "2030-01-15", category: "Documenti", origine_modulo: "archivio_documenti" })
      .select("id")
      .single();
    expect(t.error).toBeNull();
    task.push(t.data.id);
    const d = await titolare
      .from("documents")
      .insert({ title: `${SIGLA} doc`, doc_type: "contratti", document_date: "2026-10-01", task_id: t.data.id })
      .select("id")
      .single();
    expect(d.error).toBeNull();
    documenti.push(d.data.id);

    const letto = async () => {
      const r = await titolare.rpc("memo_leggi_agenda", { p_cerca: SIGLA });
      expect(r.error).toBeNull();
      return (r.data ?? []).length;
    };
    expect(await letto()).toBe(1);

    const acceso = await titolare.from("documents").update({ no_ai: true }).eq("id", d.data.id);
    expect(acceso.error).toBeNull();
    expect(await letto()).toBe(0);

    const spento = await titolare.from("documents").update({ no_ai: false }).eq("id", d.data.id);
    expect(spento.error).toBeNull();
    expect(await letto()).toBe(1);
  });

  it("la Scheda per MEMO ha ancora testo, contatori e una versione a tre pezzi", async () => {
    const r = await titolare.rpc("scheda_per_memo");
    expect(r.error).toBeNull();
    const riga = Array.isArray(r.data) ? r.data[0] : r.data;
    expect(typeof riga.testo).toBe("string");
    expect(Number.isInteger(riga.voci)).toBe(true);
    expect(Number.isInteger(riga.caratteri)).toBe(true);
    expect(String(riga.versione).split(":").length).toBeGreaterThanOrEqual(3);
  });
});
