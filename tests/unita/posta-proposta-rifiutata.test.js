import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REVISIONE DELL'11/11/2026, punto 21: una proposta della posta già rifiutata non si esegue più da un altro apparecchio.
// Il database vero lo prova la verifica della migrazione (annullata); qui le cose che non devono cambiare per sbaglio.

const migrazione = readFileSync(new URL("../../supabase/migrations/20261125000002_una_proposta_rifiutata_non_si_esegue.sql", import.meta.url), "utf8");

describe("migrazione 20261125000002: esegui_azione_posta accetta solo «proposta»", () => {
  it("rifiuta ogni stato diverso da «proposta», col messaggio che dice quale", () => {
    expect(migrazione).toContain("if v_azione.stato <> ''proposta'' then");
    expect(migrazione).toContain("Questa proposta è già stata decisa (%): non si può eseguire.");
  });

  it("il controllo sta PRIMA di leggere i parametri, e una proposta già fatta continua a rispondere «già fatta»", () => {
    expect(migrazione).toContain("v_par := coalesce(p_parametri, v_azione.parametri);");
    // La risposta «già fatta» sta nel corpo vivo, subito sopra l'ancora: la migrazione non la tocca.
    expect(migrazione).not.toContain("gia_fatta', true");
  });

  it("cambia il corpo vivo in una riga sola, si ferma se l'ancora non c'è o c'è due volte, ed è ripetibile", () => {
    expect(migrazione).toContain("if v_n <> 1 then");
    expect(migrazione).toContain("esegui_azione_posta non ha una sola riga");
    expect(migrazione).toContain("if v_def like '%Questa proposta è già stata decisa (%): non si può eseguire.%' then return; end if;");
  });

  it("la verifica prova rifiutata, aperta e già fatta, e si annulla da sola", () => {
    expect(migrazione).toContain("VERIFICA (1)");
    expect(migrazione).toContain("VERIFICA (2)");
    expect(migrazione).toContain("VERIFICA (3)");
    expect(migrazione).toContain("raise exception 'ZZ_ANNULLA'");
  });

  it("non apre permessi e si registra col proprio numero", () => {
    expect(migrazione).not.toMatch(/\bgrant\b|\bcreate (or replace )?function\b/i);
    expect(migrazione).toMatch(/values \('20261125000002', 'una_proposta_rifiutata_non_si_esegue'\)/);
  });
});
