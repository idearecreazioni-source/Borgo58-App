import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REVISIONE DELL'11/11/2026, punto 17 (scelta B): la chiave dell'iPhone ha un tetto sui token. Il database vero lo prova la
// verifica della migrazione (annullata); qui le cose che non devono cambiare per sbaglio.
const m = readFileSync(new URL("../../supabase/migrations/20261125000001_la_chiave_dell_iphone_ha_un_tetto_di_token.sql", import.meta.url), "utf8");

describe("migrazione 20261125000001: tetto di token per la chiave dell'iPhone", () => {
  it("limita i token di ogni dettatura (domanda 40.000, risposta 4.000, cache 200.000)", () => {
    expect(m).toContain("40000), least(greatest(coalesce(p_token_risposta, 0), 0), 4000)");
    expect(m).toContain("200000)");
  });

  it("aggiunge il tetto orario di 500.000 token nell'unico posto dei limiti", () => {
    expect(m).toContain("v_tetto_token constant bigint  := 500000;");
    expect(m).toContain("create or replace function voce_limite_dettature");
  });

  it("non apre permessi nuovi e non tocca la barriera di Casa", () => {
    expect(m).not.toMatch(/\bgrant\b/i);
    expect(m).toContain("revoke all on function voce_limite_dettature(uuid) from public, anon, authenticated;");
    expect(m).not.toContain("service_role");
  });

  it("cambia il corpo vivo solo se le due righe compaiono una volta, ed è ripetibile", () => {
    expect(m).toContain("(deve essere 1)");
    expect(m).toContain("if v_def like '%least(greatest(coalesce(p_token_domanda, 0), 0), 40000)%' then return; end if;");
  });

  it("si annulla da sola e si registra", () => {
    expect(m).toContain("raise exception 'ZZ_ANNULLA'");
    expect(m).toMatch(/values \('20261125000001', 'la_chiave_dell_iphone_ha_un_tetto_di_token'\)/);
  });
});
