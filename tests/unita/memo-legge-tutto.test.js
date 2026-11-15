import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRAZIONE = readFileSync("supabase/migrations/20261115000010_memo_legge_tutto.sql", "utf8");
const MOTORE = readFileSync("supabase/functions/memo-chat/index.ts", "utf8");
const LETTORE_DOCUMENTI = readFileSync("supabase/functions/documento-leggi/index.ts", "utf8");

describe("MEMO legge tutto", () => {
  it("dichiara tutti gli strumenti di lettura e le loro funzioni limitate", () => {
    for (const nome of ["banca", "prenotazioni", "haccp", "costo_piatti", "documenti", "fatture_clienti"]) {
      expect(MIGRAZIONE).toContain(`memo_leggi_${nome}`);
      expect(MOTORE).toContain(`leggi_${nome}`);
    }
    expect(MIGRAZIONE).toContain("limit 50");
    expect(MIGRAZIONE).toContain("if not is_titolare()");
    expect(MIGRAZIONE).toContain("ZZ_ANNULLA");
  });

  it("non apre il contenuto dell'Archivio prima del sì e lo legge senza scrivere", () => {
    expect(MOTORE).toContain("Lo apro? costa circa 0,20 €.");
    expect(MOTORE).toContain("consensoPerDocumento");
    expect(MOTORE).toContain("leggi_contenuto_documento");
    expect(MOTORE).toContain("solo_lettura: true");
    expect(LETTORE_DOCUMENTI).toContain("if (corpo.solo_lettura === true)");
    expect(LETTORE_DOCUMENTI).toMatch(/if \(corpo\.solo_lettura === true\)[\s\S]*?return new Response[\s\S]*?const \{ error: salvaError \}/);
  });
});
