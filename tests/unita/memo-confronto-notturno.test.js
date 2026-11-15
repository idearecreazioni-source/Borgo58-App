import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRAZIONE = readFileSync("supabase/migrations/20261115000017_il_confronto_notturno_di_memo.sql", "utf8");

describe("il confronto notturno di MEMO contro le pagine (15/11/2026)", () => {
  it("gira da solo ogni notte, sorvegliato dalla sentinella, e avvisa con il sistema che c'è già", () => {
    expect(MIGRAZIONE).toContain("cron.schedule('memo-confronto-notturno', '30 1,2 * * *'");
    expect(MIGRAZIONE).toContain("insert into lavori_sorvegliati");
    expect(MIGRAZIONE).toContain("'memo_confronto'");
    expect(MIGRAZIONE).toContain("segnala_allarme(");
    expect(MIGRAZIONE).toContain("v_ora <> 3 and not p_forza");
  });

  it("un controllo rotto lo dice, e non lascia il battito", () => {
    expect(MIGRAZIONE).toMatch(/exception when others then[\s\S]*?memo_confronto_errore[\s\S]*?return jsonb_build_object\('errore'/);
  });

  it("non usa l'intelligenza artificiale e non scrive sui dati veri (solo memo_confronti)", () => {
    expect(MIGRAZIONE).not.toMatch(/anthropic|memo-chat|net\.http_post/i);
    expect(MIGRAZIONE).not.toMatch(/\bupdate (?!stato_lavori)\w+\s+set\b/i);
  });

  it("confronta tutte le letture di MEMO", () => {
    for (const nome of ["piano", "fatture_fornitori", "cassa", "banca", "prenotazioni", "magazzino", "haccp", "agenda", "costo_piatti", "documenti", "fatture_clienti"]) {
      expect(MIGRAZIONE).toContain(`memo_leggi_${nome}(null)`);
    }
  });
});
