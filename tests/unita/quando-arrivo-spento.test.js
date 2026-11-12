import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TASK_LUOGHI } from "../../src/lib/constants";

// «QUANDO ARRIVO» SI SPEGNE — 12/11/2026, deciso da Alessio: il raggio dei
// Comandi dell'iPhone era troppo largo, il GPS oscillava e le notifiche si
// ripetevano. Prende il posto di `luogo-promemoria.test.js`.
// ⚠️ Due cose si provano insieme, perché vanno insieme: che la porta sia
//    chiusa ovunque (funzione online, schermata, voce), e che il dato degli
//    impegni NON sia stato toccato.

const leggi = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const senzaCommentiSql = (t) => t.replace(/--[^\n]*/g, "");
const MIGRAZIONE = "supabase/migrations/20261112000007_quando_arrivo_si_spegne.sql";
// ⚠️ Il vincolo vivo è ancora quello della 20261028000006 (ristorante →
//    cantina): la migrazione del 12/11 non lo riscrive, apposta.
const VINCOLO = "supabase/migrations/20261028000006_il_ristorante_diventa_cantina.sql";

describe("la migrazione che spegne «Quando arrivo»", () => {
  const sql = senzaCommentiSql(leggi(MIGRAZIONE));

  it("🔴 revoca le chiavi ancora attive", () => {
    expect(sql).toMatch(/update chiavi_luogo set revocata_il = now\(\) where revocata_il is null;/);
  });

  it("toglie le quattro funzioni, solo se ci sono", () => {
    for (const firma of [
      "luogo_promemoria(text, text)",
      "crea_chiave_luogo(text)",
      "revoca_chiave_luogo(uuid)",
      "chiavi_luogo_elenco()",
    ]) {
      expect(sql).toContain(`drop function if exists public.${firma};`);
    }
  });

  it("🔴 non tocca il dato: niente drop o alter sulla colonna, sul vincolo o sulla tabella", () => {
    expect(sql).not.toMatch(/alter\s+table\s+(public\.)?tasks/i);
    expect(sql).not.toMatch(/drop\s+constraint/i);
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/update\s+(public\.)?tasks/i);
  });
});

describe("la porta è chiusa ovunque", () => {
  it("la funzione online non c'è più, e non è più fra quelle senza token", () => {
    expect(existsSync("supabase/functions/promemoria-luogo")).toBe(false);
    expect(leggi("scripts/funzione.mjs")).not.toMatch(/"promemoria-luogo":/);
  });

  it("la pagina delle chiavi e le sue chiamate non ci sono più", () => {
    expect(existsSync("src/pages/agenda/PromemoriaLuogo.jsx")).toBe(false);
    expect(existsSync("src/lib/api/luoghi.js")).toBe(false);
    expect(leggi("src/App.jsx")).not.toMatch(/PromemoriaLuogo/);
    // ⚠️ Si cerca il collegamento, non la scritta: il commento che dice
    //    dov'era la nomina, ed è giusto che la nomini.
    expect(leggi("src/pages/agenda/AgendaList.jsx")).not.toMatch(/to="\/agenda\/luoghi"/);
  });

  it("🔴 le due istruzioni della voce non chiedono più il luogo", () => {
    for (const f of ["supabase/functions/ascolta-voce/index.ts", "supabase/functions/ascolta-voce/agenda.ts"]) {
      expect(leggi(f)).not.toMatch(/"luogo":/);
    }
  });
});

describe("i luoghi restano lo specchio del vincolo", () => {
  it("il vincolo del database ammette gli stessi luoghi di TASK_LUOGHI", () => {
    const valori = TASK_LUOGHI.map((l) => l.value).sort();
    const vincolo = leggi(VINCOLO).match(/luogo in \(([^)]*)\)/)[1];
    expect(vincolo.match(/'([a-z]+)'/g).map((v) => v.slice(1, -1)).sort()).toEqual(valori);
  });
});
