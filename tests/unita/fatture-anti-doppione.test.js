import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REVISIONE DELL'11/11/2026, punto 32: la stessa fattura (fornitore + numero + data) non entra due volte.
// Il database vero lo prova la verifica della migrazione (annullata); qui le cose che non devono cambiare per sbaglio.
const m = readFileSync(new URL("../../supabase/migrations/20261125000003_la_stessa_fattura_non_entra_due_volte.sql", import.meta.url), "utf8");

describe("migrazione 20261125000003: la stessa fattura non entra due volte", () => {
  it("mette un indice unico su fornitore, data e numero normalizzato (solo se il numero c'è)", () => {
    expect(m).toContain("create unique index if not exists uq_supplier_invoices_fornitore_numero_data");
    expect(m).toContain("(supplier_id, invoice_date, (regexp_replace(upper(coalesce(invoice_number, '')), '[^A-Z0-9]', '', 'g')))");
    expect(m).toMatch(/where regexp_replace\(upper\(coalesce\(invoice_number, ''\)\), '\[\^A-Z0-9\]', '', 'g'\) <> ''/);
  });

  it("si ferma, elencando il problema, se ci sono già doppioni", () => {
    expect(m).toContain("Ci sono già % gruppi di fatture doppie");
    expect(m.indexOf("Ci sono già % gruppi")).toBeLessThan(m.indexOf("create unique index"));
  });

  it("il controllo prima della scrittura dice una frase chiara e non apre permessi", () => {
    expect(m).toContain("è già registrata. Se è la stessa, non serve scriverla di nuovo");
    expect(m).toContain("revoke all on function supplier_invoices_no_doppione() from public, anon, authenticated;");
    expect(m).not.toMatch(/\bgrant\b/i);
  });

  it("la verifica prova doppione, altra data, senza numero, e si annulla da sola", () => {
    expect(m).toContain("VERIFICA (1)");
    expect(m).toContain("raise exception 'ZZ_ANNULLA'");
    expect(m).toMatch(/values \('20261125000003', 'la_stessa_fattura_non_entra_due_volte'\)/);
  });
});
