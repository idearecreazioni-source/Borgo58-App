import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REVISIONE DEL 23/11/2026, punto 4: i buchi del «non far leggere all'AI».
//
// ⚠️ memo-chat gira su Deno e non si esegue da qui: si legge il codice e si controllano le cose che non devono cambiare
//    per sbaglio. Le funzioni del database le prova la verifica della migrazione e le prove su Prova.

const codice = readFileSync(new URL("../../supabase/functions/memo-chat/index.ts", import.meta.url), "utf8");
const migrazione = readFileSync(new URL("../../supabase/migrations/20261123000002_no_ai_chiude_scheda_e_agenda.sql", import.meta.url), "utf8");

describe("memo-chat: la cronologia non porta documenti riservati", () => {
  const inizio = codice.indexOf("const idDocumentiNominati");
  const corpo = codice.slice(inizio, codice.indexOf("const riferimentiDelGiro", inizio));

  it("guarda i documenti nominati nella conversazione e se ora sono no_ai", () => {
    expect(inizio).toBeGreaterThan(0);
    expect(corpo).toContain('r.tabella === "documents"');
    // Anche il promemoria di un documento già citato (riferimento «tasks» → documents.task_id).
    expect(corpo).toContain('r.tabella === "tasks"');
    expect(corpo).toContain('task_id.in.(');
    expect(corpo).toContain('.from("documents")');
    expect(corpo).toContain('.eq("no_ai", true)');
  });

  it("se un documento nominato è riservato, il modello riparte dalla sola domanda", () => {
    expect(corpo).toMatch(/cronologia\.splice\(0, cronologia\.length, \{ role: "user", content: domanda \}\)/);
  });

  it("se non riesce a controllare si ferma, e segna il messaggio come errore", () => {
    expect(corpo).toContain("if (erroreRiservati)");
    expect(corpo).toContain('update({ stato: "errore" })');
    expect(corpo).toContain("return errore(503");
  });

  it("se non riesce a leggere i riferimenti della conversazione si ferma (non salta il controllo in silenzio)", () => {
    expect(codice).toContain("erroreRiferimenti");
    expect(codice).toMatch(/if \(erroreRiferimenti\) \{[\s\S]*?return errore\(503, "riferimenti"/);
  });

  it("il controllo sta PRIMA della prima chiamata al modello", () => {
    expect(codice.indexOf("const idDocumentiNominati")).toBeLessThan(codice.indexOf("anthropic.messages.create"));
  });
});

describe("migrazione 20261123000002: Scheda e Agenda", () => {
  it("la Scheda per MEMO toglie le voci dei documenti riservati, ma il limite conta tutte le voci", () => {
    expect(migrazione).toMatch(/p_solo_leggibili boolean default false/);
    expect(migrazione).toMatch(/d\.id = scheda_voci\.documento_id and d\.no_ai/);
    // Il portiere dei limiti chiama scheda_compone_testo con DUE argomenti: deve continuare a contare tutto.
    expect(migrazione).toMatch(/v_pieno := scheda_compone_testo\(\);/);
    expect(migrazione).toMatch(/v_testo := scheda_compone_testo\(null, null, true\);/);
    expect(migrazione).toMatch(/'caratteri', char_length\(v_pieno\)/);
  });

  it("la versione cambia quando si accende o si spegne il segno (altrimenti MEMO tiene il testo vecchio)", () => {
    expect(migrazione).toMatch(/\|\| ':' \|\| v_voci \|\| ':' \|\| v_escluse/);
  });

  it("l'Agenda di MEMO salta i promemoria dei documenti riservati e il confronto notturno li salta uguale", () => {
    expect(migrazione).toMatch(/d\.task_id = a\.id and d\.no_ai/);
    expect(migrazione).toContain("from agenda_corsie() a where not exists (select 1 from documents d where d.task_id = a.id and d.no_ai);");
  });

  it("non apre permessi nuovi e si registra col proprio numero", () => {
    expect(migrazione).toMatch(/revoke all on function scheda_compone_testo\(uuid, scheda_voci, boolean\) from public, anon, authenticated;/);
    expect(migrazione).toMatch(/values \('20261123000002', 'no_ai_chiude_scheda_e_agenda'\)/);
  });
});
