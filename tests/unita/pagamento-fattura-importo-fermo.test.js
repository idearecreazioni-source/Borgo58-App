import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REVISIONE DELL'11/11/2026, punto 19: l'importo di un movimento che paga una fattura non si cambia. Il database vero lo
// prova la verifica della migrazione (che si annulla da sola e non lascia righe: un movimento legato a una fattura non si cancella, quindi una prova su Prova con righe vere le lascerebbe); qui le cose che non devono
// cambiare per sbaglio.

const migrazione = readFileSync(new URL("../../supabase/migrations/20261124000002_l_importo_di_un_pagamento_di_fattura_non_si_cambia.sql", import.meta.url), "utf8");

describe("migrazione 20261124000002: il pagamento di una fattura non cambia importo", () => {
  it("scatta solo se cambia l'IMPORTO di un movimento GIÀ legato a una fattura", () => {
    expect(migrazione).toMatch(/before update of amount on cash_movements/);
    expect(migrazione).toContain("when (old.supplier_invoice_id is not null and new.amount is distinct from old.amount)");
  });

  it("il messaggio dice cosa fare: annullare il pagamento della fattura e rifarlo", () => {
    expect(migrazione).toContain("annulla il pagamento della fattura e registralo di nuovo con l''importo giusto");
    expect(migrazione).toContain("using errcode = 'check_violation'");
  });

  it("non tocca i dati che ci sono: nessun update o delete fuori dal blocco di verifica annullato", () => {
    const fuori = migrazione.slice(0, migrazione.indexOf("do $verifica$"));
    expect(fuori).not.toMatch(/\bupdate cash_movements\b|\bdelete from\b/i);
  });

  it("la funzione del blocco non è chiamabile a mano", () => {
    expect(migrazione).toMatch(/revoke all on function movimento_di_fattura_importo_fermo\(\) from public, anon, authenticated;/);
  });

  it("la verifica prova il blocco, il resto del movimento che si corregge e il movimento senza fattura, e si annulla da sola", () => {
    expect(migrazione).toContain("VERIFICA (1)");
    expect(migrazione).toContain("VERIFICA (2)");
    expect(migrazione).toContain("VERIFICA (3)");
    expect(migrazione).toContain("raise exception 'ZZ_ANNULLA'");
  });

  it("si registra col proprio numero", () => {
    expect(migrazione).toMatch(/values \('20261124000002', 'l_importo_di_un_pagamento_di_fattura_non_si_cambia'\)/);
  });
});
