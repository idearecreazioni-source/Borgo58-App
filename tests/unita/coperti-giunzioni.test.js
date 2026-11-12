import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  copertiCalcolati,
  POSTI_PERSI_PER_GIUNZIONE_DI_DEFAULT,
} from "../../src/lib/calcoli/sala.js";

// La regola dei coperti di un tavolone (12/11/2026, deciso dal proprietario):
// due tavoli piccoli 70x80 accostati fanno 4 coperti, perché le sedie stanno
// sui lati corti e l'accostamento non ne toglie nessuna. I grandi (e il
// resto) continuano a perdere 2 posti per ogni giunzione.

describe("copertiCalcolati", () => {
  it("un tavolo solo: i suoi coperti, nessuna giunzione", () => {
    expect(copertiCalcolati({ somma: 2, giunzioni: 0, postiPersi: 0 })).toBe(2);
    expect(copertiCalcolati({ somma: 4, giunzioni: 0, postiPersi: 2 })).toBe(4);
  });

  it("due piccoli accostati fanno 4, non 2", () => {
    expect(copertiCalcolati({ somma: 4, giunzioni: 1, postiPersi: 0 })).toBe(4);
  });

  it("N piccoli in fila fanno 2·N", () => {
    for (const n of [3, 4, 5, 8]) {
      expect(copertiCalcolati({ somma: 2 * n, giunzioni: n - 1, postiPersi: 0 })).toBe(2 * n);
    }
  });

  it("i grandi non cambiano: meno due per ogni giunzione", () => {
    expect(copertiCalcolati({ somma: 8, giunzioni: 1, postiPersi: 2 })).toBe(6);
    expect(copertiCalcolati({ somma: 12, giunzioni: 2, postiPersi: 2 })).toBe(8);
  });

  it("senza dire quanto si perde vale la regola di sempre (2)", () => {
    expect(POSTI_PERSI_PER_GIUNZIONE_DI_DEFAULT).toBe(2);
    expect(copertiCalcolati({ somma: 8, giunzioni: 1 })).toBe(6);
  });

  it("non scende mai sotto zero", () => {
    expect(copertiCalcolati({ somma: 2, giunzioni: 5, postiPersi: 2 })).toBe(0);
  });
});

describe("la migrazione dei coperti accostati", () => {
  const sql = readFileSync(
    new URL("../../supabase/migrations/20261112000006_i_piccoli_accostati_fanno_quattro.sql", import.meta.url),
    "utf8"
  );

  it("aggiunge la colonna col default della regola di sempre", () => {
    expect(sql).toMatch(/posti_persi_per_giunzione\s+integer\s+not null\s+default 2/i);
  });

  it("mette a zero solo il piccolo 70x80", () => {
    expect(sql).toMatch(/set posti_persi_per_giunzione = 0[\s\S]*?where nome = 'Piccolo 70x80'/i);
  });

  it("la funzione usa la colonna, non più il «2 *» fisso", () => {
    const corpo = sql.slice(sql.indexOf("create or replace function coperti_del_giorno"));
    expect(corpo).toMatch(/posti_persi_per_giunzione/);
    expect(corpo).not.toMatch(/2 \* coalesce\(gi\.n/);
  });
});
