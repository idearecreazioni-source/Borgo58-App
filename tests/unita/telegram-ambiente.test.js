import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PREFISSO_PROVA,
  REF_PROVA,
  siamoSuProva,
  testoPerIlProgetto,
} from "../../supabase/functions/notify-telegram-reservation/ambiente";
import { REF_PROVA as REF_PROVA_SCRIPT } from "../../scripts/comune.mjs";

// Nessuna di queste prove manda un Telegram: si prova la regola pura, e sul
// file della funzione si controlla che l'unico invio passi da lì.

const URL_PROVA = `https://${REF_PROVA}.supabase.co`;
const URL_PRODUZIONE = "https://oudjuqbqszisdtwzbxdo.supabase.co";
const PROMEMORIA = "📌 Promemoria\n\nTest";

describe("il messaggio dice da quale progetto parte", () => {
  it("il riferimento di Prova è lo stesso degli script", () => {
    expect(REF_PROVA).toBe(REF_PROVA_SCRIPT);
  });

  it("da Prova il testo COMINCIA con TEST PROVA", () => {
    const t = testoPerIlProgetto(PROMEMORIA, URL_PROVA);
    expect(t.startsWith(PREFISSO_PROVA)).toBe(true);
    expect(PREFISSO_PROVA).toBe("TEST PROVA");
    expect(t.endsWith(PROMEMORIA)).toBe(true);
  });

  it("dalla produzione il testo non cambia di un carattere", () => {
    expect(testoPerIlProgetto(PROMEMORIA, URL_PRODUZIONE)).toBe(PROMEMORIA);
  });

  it("un indirizzo assente o storto non è Prova (nessun prefisso inventato)", () => {
    for (const u of [undefined, null, "", "non-un-url", `https://${REF_PROVA}.supabase.co.altro.it`]) {
      expect(siamoSuProva(u)).toBe(false);
      expect(testoPerIlProgetto(PROMEMORIA, u)).toBe(PROMEMORIA);
    }
  });

  it("riconosce Prova anche con la barra finale o un percorso", () => {
    expect(siamoSuProva(`${URL_PROVA}/`)).toBe(true);
    expect(siamoSuProva(`${URL_PROVA}/functions/v1`)).toBe(true);
  });
});

describe("la funzione usa la regola nell'UNICO punto d'invio", () => {
  const sorgente = readFileSync(
    new URL("../../supabase/functions/notify-telegram-reservation/index.ts", import.meta.url),
    "utf8",
  );

  it("c'è un solo invio a Telegram", () => {
    expect(sorgente.match(/api\.telegram\.org/g)).toHaveLength(1);
  });

  it("il testo inviato passa da testoPerIlProgetto con l'indirizzo dell'ambiente", () => {
    expect(sorgente).toMatch(/text:\s*testoPerIlProgetto\(text,\s*SUPABASE_URL\)/);
    expect(sorgente).toMatch(/const SUPABASE_URL = Deno\.env\.get\("SUPABASE_URL"\)/);
  });
});
