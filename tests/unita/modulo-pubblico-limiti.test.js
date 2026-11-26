import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REVISIONE DELL'11/11/2026, punto 15: il modulo pubblico delle prenotazioni ha limiti di lunghezza e di data.
// Il database vero lo prova la verifica della migrazione; qui le cose che non devono cambiare per sbaglio.
const m = readFileSync(new URL("../../supabase/migrations/20261125000005_il_modulo_pubblico_ha_dei_limiti.sql", import.meta.url), "utf8");

describe("migrazione 20261125000005: il modulo pubblico ha dei limiti", () => {
  it("limita nome (100), telefono (30), email (200) e note (1.000)", () => {
    expect(m).toContain("length(coalesce(p_customer_name, '''')) > 100");
    expect(m).toContain("length(coalesce(p_customer_phone, '''')) > 30");
    expect(m).toContain("length(coalesce(p_customer_email, '''')) > 200");
    expect(m).toContain("length(coalesce(p_notes, '''')) > 1000");
  });

  it("limita la data a 12 mesi, con la data locale di Roma", () => {
    expect(m).toContain("interval ''12 months''");
    expect(m).toContain("now() at time zone ''Europe/Rome''");
  });

  it("cambia il corpo vivo in un punto solo, è ripetibile e non apre permessi", () => {
    expect(m).toContain("(ne ha %)");
    expect(m).toContain("if v_def like '%Il nome è troppo lungo%' then return; end if;");
    expect(m).not.toMatch(/\bgrant\b/i);
  });

  it("la verifica non scrive niente e la migrazione si registra", () => {
    expect(m).toContain("VERIFICA (5)");
    expect(m).not.toMatch(/insert into reservations/i);
    expect(m).toMatch(/values \('20261125000005', 'il_modulo_pubblico_ha_dei_limiti'\)/);
  });
});
