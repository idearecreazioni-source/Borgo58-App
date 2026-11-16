import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compattaRiferimenti, partiDellaRisposta } from "../../src/lib/calcoli/chatMemo";

const MIGRAZIONE = readFileSync("supabase/migrations/20261115000013_le_letture_di_memo_come_le_pagine.sql", "utf8");
const MOTORE = readFileSync("supabase/functions/memo-chat/index.ts", "utf8");

describe("le fonti di MEMO", () => {
  it("fino a otto riferimenti si elencano, oltre si scrivono per intervallo", () => {
    expect(compattaRiferimenti(["P1", "P2"])).toBe("[P1], [P2]");
    const cinquanta = Array.from({ length: 50 }, (_, i) => `P${i + 1}`);
    expect(compattaRiferimenti(cinquanta)).toBe("[P1]–[P50] (50 righe)");
    expect(compattaRiferimenti([...cinquanta, "C1", "C2", "C3"])).toBe("[P1]–[P50] (50 righe), [C1]–[C3] (3 righe)");
  });

  it("il pannello riceve le fonti già accorciate", () => {
    const cinquanta = Array.from({ length: 50 }, (_, i) => ({ rif: `P${i + 1}` }));
    const parti = partiDellaRisposta("Ci sono 63 voci.\n\nDove l'ho letto: [P1], [P2].", cinquanta);
    expect(parti.dove).toBe("[P1]–[P50] (50 righe)");
  });
});

describe("le letture di MEMO dicono quello che dicono le pagine (15/11/2026)", () => {
  it("il piano elenca le voci foglia: una madre non si conta due volte", () => {
    expect(MIGRAZIONE).toContain("not exists (select 1 from piano_voci f where f.madre_id = v.id and f.archiviata_il is null)");
    expect(MIGRAZIONE).toContain("VERIFICA (1)");
    expect(MIGRAZIONE).toContain("VERIFICA (1b)");
  });

  it("le fatture fornitori sommano solo le non pagate", () => {
    expect(MIGRAZIONE).toContain("case when i.status = 'da_pagare' then da_pagare(i) else 0 end");
    expect(MIGRAZIONE).toContain("VERIFICA (2)");
  });

  it("la cassa è per soggetto e la banca non dà un saldo che non è il saldo", () => {
    expect(MIGRAZIONE).toContain("over (partition by m.entity_id)");
    expect(MIGRAZIONE).not.toMatch(/'saldo_conto_dai_movimenti_caricati'/);
  });

  it("MEMO sa che cosa vuol dire ogni totale", () => {
    expect(MOTORE).toContain("NON è il saldo");
    expect(MOTORE).toContain("conta solo le fatture non pagate");
    expect(MOTORE).toContain("Non ha un totale");
  });
});

describe("un errore di uno strumento non butta via la risposta (15/11/2026)", () => {
  it("il calcolo accetta più di 12 numeri e l'errore torna al modello", () => {
    expect(MOTORE).toContain("maxItems: 500");
    expect(MOTORE).toContain("numeri.length > 500");
    expect(MOTORE).toContain("is_error: true");
    expect(MOTORE).toContain("console.error(\"memo-chat: errore dello strumento\"");
  });
});

describe("le prove di Alessio del 16/11 sul telefono", () => {
  it("il modello ha respiro per ragionare e rispondere, e dice quando la risposta viene tagliata", () => {
    expect(MOTORE).toContain("const TOKEN_RISPOSTA = 8000;");
    expect(MOTORE).toContain("La risposta è stata tagliata");
    expect(MOTORE).toContain("giri_del_modello");
  });
  it("più passaggi e letture fino a 150 righe", () => {
    expect(MOTORE).toContain("const STRUMENTI_MASSIMI = 20;");
    expect(MOTORE).toContain("const GIRI_MASSIMI = 10;");
    expect(MOTORE).toContain("Legge fino a 150 voci del piano");
  });
  it("gli strumenti elencano i loro campi e le regole non permettono di annunciare e fermarsi", () => {
    expect(MOTORE).toContain("stato (stimato, preventivato o confermato)");
    expect(MOTORE).toContain("NON annunciare un controllo");
    expect(MOTORE).toContain("«previsto» (il budget del piano) NON è «speso»");
  });
});
