import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Le letture dei documenti dentro al tetto di spesa (pezzo C0, 21/11/2026).
//
// ⚠️ Le funzioni girano su Deno e non si possono eseguire da qui: la prova
//    legge il codice e controlla l'ORDINE dei gesti, che e' quello che conta
//    per un tetto — il freno deve stare PRIMA della chiamata al modello, il
//    registro DOPO. Un freno messo dopo non ferma niente.

const leggi = (percorso) => readFileSync(new URL(`../../${percorso}`, import.meta.url), "utf8");

describe("documento-leggi: freno prima, registro dopo", () => {
  const codice = leggi("supabase/functions/documento-leggi/index.ts");

  it("guarda il tetto prima di ogni chiamata al modello", () => {
    const chiamate = [...codice.matchAll(/anthropic\.messages\.create/g)].map((m) => m.index);
    expect(chiamate).toHaveLength(2); // la trascrizione e la proposta
    const freni = [...codice.matchAll(/conto\.freno\(\)/g)].map((m) => m.index);
    expect(freni).toHaveLength(2);
    for (const chiamata of chiamate) {
      expect(freni.some((freno) => freno < chiamata && chiamata - freno < 1500)).toBe(true);
    }
  });

  it("registra i token di ogni chiamata, col modello vero della risposta", () => {
    expect(codice).toMatch(/conto\.registra\("trascrizione", esito\.model/);
    expect(codice).toMatch(/conto\.registra\("proposta", esito\.model/);
    expect(codice).toContain('.from("letture_documento")');
  });

  it("si ferma se il controllo del tetto non riesce, invece di spendere alla cieca", () => {
    expect(codice).toMatch(/errore\(\s*503,\s*"spesa"/);
    expect(codice).toMatch(/stato\?\.blocca/);
  });

  it("un file letto senza modello non passa dal freno", () => {
    const spacchettato = codice.indexOf("letto dal file, senza AI");
    const primoFreno = codice.indexOf("conto.freno()");
    expect(spacchettato).toBeGreaterThan(-1);
    expect(spacchettato).toBeLessThan(primoFreno);
  });
});

describe("assistente-archivio: il tetto prima della domanda al modello", () => {
  const codice = leggi("supabase/functions/assistente-archivio/index.ts");

  it("controlla la spesa del mese prima di chiamare il modello", () => {
    const freno = codice.indexOf('rpc("spesa_ai_del_mese")');
    const chiamata = codice.indexOf("anthropic.messages.create");
    expect(freno).toBeGreaterThan(-1);
    expect(freno).toBeLessThan(chiamata);
    expect(codice).toMatch(/errore\(\s*429,\s*"tetto"/);
    expect(codice).toMatch(/errore\(\s*503,\s*"spesa"/);
  });
});

describe("memo-chat: il conto conta anche la cache", () => {
  const codice = leggi("supabase/functions/memo-chat/index.ts");

  it("prezza i token di cache: lettura a un decimo, scrittura a uno e un quarto", () => {
    expect(codice).toMatch(/CACHE_LETTURA = 0\.1/);
    expect(codice).toMatch(/CACHE_SCRITTURA = 1\.25/);
  });

  it("legge i token di cache dalla risposta, li somma e li scrive nel messaggio", () => {
    expect(codice).toContain("cache_read_input_tokens");
    expect(codice).toContain("cache_creation_input_tokens");
    expect(codice).toMatch(/token_cache_lettura: tokenCacheLettura, token_cache_scrittura: tokenCacheScrittura/);
  });

  it("anche il preventivo e il costo del giro contano la cache, non solo il costo finale", () => {
    const chiamate = [...codice.matchAll(/costoStimato\([^)]*\)/g)].map((m) => m[0]);
    const conCache = chiamate.filter((c) => c.includes("tokenCacheLettura, tokenCacheScrittura"));
    expect(conCache.length).toBe(3);
  });

  it("le letture di documento non si sommano due volte nel tetto", () => {
    // Le registra documento-leggi: se memo-chat le aggiungesse anche a costo_euro,
    // il tetto le vedrebbe due volte (fonte «documento» e fonte «chat»).
    expect(codice).toMatch(/NON si sommano qui/);
  });
});

describe("la migrazione delle letture nel tetto", () => {
  const sql = leggi("supabase/migrations/20261121000001_le_letture_dei_documenti_nel_tetto.sql");

  it("aggiunge la fonte «documento» a consumi_ai dal corpo vivo e richiude le due porte", () => {
    expect(sql).toContain("pg_get_functiondef('public.consumi_ai()'::regprocedure)");
    expect(sql).toMatch(/revoke all on function consumi_ai\(\) from public, anon, authenticated/);
  });

  it("protegge i token di cache nello storico dei costi della chat", () => {
    expect(sql).toContain("or new.token_cache_lettura is distinct from old.token_cache_lettura");
  });
});
