import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// MEMO e la Scheda di Borgo 58 (pezzo S2, 21/11/2026).
//
// ⚠️ La funzione gira su Deno e non si puo' eseguire da qui: la prova legge il
//    codice e controlla le cose che non devono cambiare per sbaglio — chi
//    legge la Scheda (l'utente, non il servizio), cosa succede se manca,
//    l'ORDINE dei pezzi delle istruzioni (la data deve stare dopo l'ultimo
//    punto di cache) e che una citazione inventata non arrivi ad Alessio.

const codice = readFileSync(new URL("../../supabase/functions/memo-chat/index.ts", import.meta.url), "utf8");

describe("memo-chat legge la Scheda", () => {
  it("col token dell'utente, non con una chiave di servizio", () => {
    expect(codice).toContain('supabase.rpc("scheda_per_memo")');
    expect(codice).not.toMatch(/service_role/i);
  });

  it("se la Scheda è vuota, illeggibile o dà errore, MEMO risponde come prima", () => {
    const inizio = codice.indexOf("async function leggiScheda");
    const corpo = codice.slice(inizio, codice.indexOf("Deno.serve(", inizio));
    expect(corpo).toContain("if (error) return null");
    expect(corpo).toMatch(/catch \{\s*return null/);
    expect(corpo).toContain("!(Number(riga?.voci) > 0)");
    // Il pezzo della Scheda esiste solo se la Scheda c'è.
    expect(codice).toContain("...(scheda ? [");
  });
});

describe("le istruzioni di MEMO in tre pezzi", () => {
  const fisso = codice.indexOf('{ type: "text", text: ISTRUZIONI, cache_control');
  const pezzoScheda = codice.indexOf("<scheda>\\n${scheda.testo}");
  const data = codice.indexOf("{ type: \"text\", text: `OGGI:");

  it("fisse, poi Scheda, poi data e schermata", () => {
    expect(fisso).toBeGreaterThan(-1);
    expect(pezzoScheda).toBeGreaterThan(fisso);
    expect(data).toBeGreaterThan(pezzoScheda);
    expect(codice).toContain("system: sistema as never");
  });

  it("i primi due pezzi hanno il punto di cache, la data no (cambia ogni giorno e romperebbe il prefisso)", () => {
    expect(codice.slice(fisso, fisso + 120)).toContain("cache_control");
    expect(codice.slice(pezzoScheda, pezzoScheda + 400)).toContain("cache_control");
    expect(codice.slice(data, data + 700)).not.toContain("cache_control");
  });

  it("il preventivo del giro conta anche la lunghezza della Scheda", () => {
    expect(codice).toContain("ISTRUZIONI.length + (scheda?.testo.length ?? 0)");
  });

  it("le istruzioni fisse spiegano come usare la Scheda", () => {
    expect(codice).toContain("LA SCHEDA DI BORGO 58");
    expect(codice).toContain("vincono gli strumenti");
    expect(codice).toContain("non inventare mai un numero [S#]");
  });
});

describe("le citazioni [S#]", () => {
  it("una citazione che non esiste nella Scheda letta si toglie e lo dice", () => {
    expect(codice).toContain("scheda?.numeri.has(Number(n))");
    expect(codice).toContain("avevo citato una voce della Scheda che non esiste");
  });

  it("le voci citate entrano in «Dove l'ho letto», accanto alle righe del gestionale", () => {
    expect(codice).toContain("[elencoRighe, elencoScheda]");
    expect(codice).toContain("citateScheda");
  });
});
