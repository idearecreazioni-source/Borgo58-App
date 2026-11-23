import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REVISIONE DEL 23/11/2026, punto 6: annullare un lotto d'import pulisce la Scheda.
// Il database vero lo prova la verifica interna della migrazione (annullata, zero residui) e la prova su Prova; qui si
// controllano le cose che non devono cambiare per sbaglio.

const migrazione = readFileSync(new URL("../../supabase/migrations/20261123000004_annullo_del_lotto_pulisce_la_scheda.sql", import.meta.url), "utf8");
const api = readFileSync(new URL("../../src/lib/api/importDrive.js", import.meta.url), "utf8");

describe("migrazione 20261123000004: l'annullamento del lotto e la Scheda", () => {
  it("chiude le proposte in attesa del lotto PRIMA di togliere i documenti, nella stessa transazione", () => {
    const chiusura = migrazione.indexOf("update scheda_proposte set stato = ''scaduta''");
    const giro = migrazione.indexOf("for v_doc in select id, task_id from documents where lotto_import_id = p_lotto");
    expect(chiusura).toBeGreaterThan(0);
    // Dentro il testo da sostituire la chiusura sta PRIMA del giro che toglie i documenti.
    expect(chiusura).toBeLessThan(migrazione.indexOf("for v_doc in select id, task_id", chiusura));
    expect(giro).toBeGreaterThan(0);
  });

  it("guarda le proposte che nominano il documento e quelle nate dal contratto (origine_id)", () => {
    expect(migrazione).toContain("documento_id in (select d.id from documents d where d.lotto_import_id = p_lotto)");
    expect(migrazione).toContain("origine in (''contratto'', ''scadenza_contratto'')");
  });

  it("cambia il corpo vivo in una riga sola e si ferma se l'ancora non c'è", () => {
    expect(migrazione).toContain("if v_n <> 1 then");
    expect(migrazione).toContain("import_lotto_annulla non ha una sola riga");
    expect(migrazione).toContain("if v_def like '%update scheda_proposte set stato%' then return; end if;");
  });

  it("le voci della Scheda NON si spengono da sole: si elencano", () => {
    expect(migrazione).toContain("create or replace function import_lotto_voci_scheda(p_lotto uuid)");
    expect(migrazione).toContain("NON si spengono da sole");
    // La funzione è di sola lettura: nessun update su scheda_voci.
    expect(migrazione).not.toMatch(/update scheda_voci/i);
  });

  it("l'elenco è solo per il titolare, non per anon", () => {
    expect(migrazione).toMatch(/if not is_titolare\(\) then raise exception/);
    expect(migrazione).toMatch(/revoke all on function import_lotto_voci_scheda\(uuid\) from public, anon;/);
    expect(migrazione).toMatch(/grant execute on function import_lotto_voci_scheda\(uuid\) to authenticated;/);
  });

  it("si registra col proprio numero", () => {
    expect(migrazione).toMatch(/values \('20261123000004', 'annullo_del_lotto_pulisce_la_scheda'\)/);
  });
});

describe("api importDrive: vociSchedaDelLotto", () => {
  it("chiama la funzione e, se la lettura fallisce, LANCIA (non restituisce un elenco vuoto)", () => {
    expect(api).toContain('supabase.rpc("import_lotto_voci_scheda", { p_lotto: lottoId })');
    const inizio = api.indexOf("export async function vociSchedaDelLotto");
    expect(api.slice(inizio, inizio + 400)).toContain("if (error) throw error;");
  });
});
