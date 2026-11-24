import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REVISIONE DELL'11/11/2026, punto 18: l'«impegnato» del piano dell'investimento toglie le note di credito già scalate.
// Il database vero lo prova la verifica della migrazione (annullata, zero residui); qui le cose che non devono cambiare.

const migrazione = readFileSync(new URL("../../supabase/migrations/20261124000003_il_piano_impegnato_toglie_le_note_di_credito.sql", import.meta.url), "utf8");

describe("migrazione 20261124000003: impegnato del piano con le note di credito", () => {
  it("la quota attribuita si riduce nella proporzione di quanto la fattura costa davvero, usando da_pagare", () => {
    expect(migrazione).toContain("'greatest(round(c.importo_attribuito * (da_pagare(i) / nullif(i.amount, 0)), 2) - coalesce(('");
    // La stessa regola vale per le rate aperte della previsione di cassa.
    expect(migrazione).toContain("array['public.piano_speso_per_voce()', 'public.piano_rate_aperte()']");
  });

  it("cambia il corpo vivo in una riga sola e si ferma se l'ancora non c'è o c'è due volte", () => {
    expect(migrazione).toContain("if v_n <> 1 then");
    expect(migrazione).toContain("non ha una sola riga");
    expect(migrazione).toContain("if v_def like '%' || v_nuovo || '%' then continue; end if;");
  });

  it("senza note di credito non cambia niente (rapporto 1); con una fattura già pagata il calcolo non c'entra", () => {
    expect(migrazione).toContain("VERIFICA (1): senza note di credito l''impegnato doveva essere 1000");
    expect(migrazione).toContain("VERIFICA (2): con 200 di nota di credito l''impegnato doveva essere 800");
    expect(migrazione).toContain("VERIFICA (3): una quota di 500 con 200 di nota doveva dare 400");
  });

  it("la verifica si annulla da sola e si registra col proprio numero", () => {
    expect(migrazione).toContain("raise exception 'ZZ_ANNULLA'");
    expect(migrazione).toMatch(/values \('20261124000003', 'il_piano_impegnato_toglie_le_note_di_credito'\)/);
  });

  it("non apre permessi nuovi: nessun grant e nessun create function", () => {
    expect(migrazione).not.toMatch(/\bgrant\b|\bcreate (or replace )?function\b/i);
  });
});
