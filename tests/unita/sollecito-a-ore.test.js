import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TASK_RICORRENZA_UNITA, TASK_SOLLECITO_UNITA } from "../../src/lib/constants";

// Le proprietà della 20260920000005, guardate nel file: che FUNZIONI lo
// dimostra la verifica dentro la migrazione, che interroga il calcolo su
// istanti inventati e prova il rifiuto sotto i cinque minuti.

const sql = readFileSync(
  new URL("../../supabase/migrations/20260920000005_il_sollecito_anche_a_ore.sql", import.meta.url),
  "utf8",
);

describe("🔴 minuti e ore valgono solo per il sollecito", () => {
  it("il vincolo del sollecito ammette sei unità", () => {
    expect(sql).toMatch(
      /sollecito_unita in \('minuti', 'ore', 'giorni', 'settimane', 'mesi', 'anni'\)/,
    );
  });

  it("⚠️ e la ricorrenza resta a quattro: «ogni 10 minuti» non è un impegno", () => {
    // 🔴 La verifica della migrazione lo prova sul database; qui si tiene
    //    ferma la stessa distinzione dalla parte della schermata, dove due
    //    elenchi diversi potrebbero divergere in silenzio.
    expect(TASK_RICORRENZA_UNITA.map((u) => u.value)).toEqual([
      "giorni", "settimane", "mesi", "anni",
    ]);
    expect(TASK_SOLLECITO_UNITA.map((u) => u.value)).toEqual([
      "minuti", "ore", "giorni", "settimane", "mesi", "anni",
    ]);
    // Le quattro di sempre sono le STESSE parole, in fondo all'elenco nuovo.
    expect(TASK_SOLLECITO_UNITA.slice(2).map((u) => u.value)).toEqual(
      TASK_RICORRENZA_UNITA.map((u) => u.value),
    );
  });

  it("la verifica prova anche che una ricorrenza a minuti venga RIFIUTATA", () => {
    expect(sql).toMatch(/VERIFICA: una ricorrenza «ogni 10 minuti» e'' stata accettata/);
  });
});

describe("🔴 sotto i cinque minuti non si sollecita", () => {
  it("è un vincolo del database, non un consiglio della schermata", () => {
    expect(sql).toMatch(
      /check \(sollecito_unita is distinct from 'minuti' or sollecito_ogni >= 5\)/,
    );
  });

  it("⚠️ e usa «is distinct from», o con l'unità vuota tacerebbe", () => {
    // 🔴 In SQL il terzo stato sparisce dai confronti: con `<>` il vincolo
    //    varrebbe NULL e non scatterebbe — cioè tacerebbe proprio nel caso
    //    che deve prendere (trappola del 27/08).
    expect(sql).not.toMatch(/sollecito_unita <> 'minuti'/);
  });

  it("anche il calcolo non scende sotto i cinque", () => {
    expect(sql).toMatch(/when 'minuti'\s+then greatest\(p_ogni, 5\) \* interval '1 minute'/);
  });

  it("⚠️ e il verso opposto è provato: cinque minuti deve passare", () => {
    // Un limite che rifiuta anche i casi buoni è peggio di nessun limite.
    expect(sql).toMatch(/VERIFICA-20SET cinque minuti/);
  });
});

describe("🔴 non si riscrive niente, e niente si accende", () => {
  it("nessun update sui task esistenti", () => {
    expect(sql).not.toMatch(/update\s+tasks\s+set/i);
  });

  it("la verifica pretende che nessun task risulti sollecitato", () => {
    expect(sql).toMatch(/select count\(\*\) into v_n from tasks where sollecito_ogni is not null/);
  });

  it("⚠️ e l'eredità nella ricorrenza vale anche per le unità nuove", () => {
    expect(sql).toMatch(/non ha ereditato il sollecito a minuti/);
  });
});

describe("⚠️ dipende dalla migrazione di prima, e lo dice", () => {
  it("si ferma se mancano le colonne del sollecito, o se è già applicata", () => {
    expect(sql).toMatch(/GUARDIA: manca la 20260920000004/);
    expect(sql).toMatch(/GUARDIA: istante_sollecito conosce già i minuti/);
  });

  it("e il tetto ai giri resta, che coi minuti conta di più", () => {
    expect(sql).toMatch(/if i > 2000 then/);
  });
});
