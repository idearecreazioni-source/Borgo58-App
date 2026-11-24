import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REVISIONE DELL'11/11/2026, punto 12: un allegato costruito apposta non può bloccare tutta la coda della posta.
//
// ⚠️ posta-leggi gira su Deno (e usa fflate da npm:): non si esegue da qui. Si legge il codice e si controllano le
//    cose che non devono cambiare per sbaglio.

const codice = readFileSync(new URL("../../supabase/functions/posta-leggi/index.ts", import.meta.url), "utf8");

describe("posta-leggi: si apre solo il pezzo che serve, con un tetto", () => {
  const inizio = codice.indexOf("function testoDaPacchetto");
  const corpo = codice.slice(inizio, codice.indexOf("/** Scarica un allegato", inizio));

  it("apre il pacchetto con un filtro: solo il pezzo cercato e solo se dichiara meno del tetto", () => {
    expect(inizio).toBeGreaterThan(0);
    expect(corpo).toContain("unzipSync(byte, {");
    expect(corpo).toContain("file.name === dentro && file.originalSize <= TETTO_PEZZO_DI_PACCHETTO_BYTE");
    // Mai più l'apertura di tutto il pacchetto.
    expect(corpo).not.toMatch(/unzipSync\(byte\)/);
  });

  it("il tetto è dichiarato e ragionevole (8 MB di XML)", () => {
    expect(codice).toContain("const TETTO_PEZZO_DI_PACCHETTO_BYTE = 8 * 1024 * 1024;");
  });

  it("un pacchetto illeggibile o troppo grande dà «niente testo», non un guasto", () => {
    expect(corpo).toContain("if (!contenuto) return null;");
    expect(corpo).toMatch(/\} catch \{\s*return null;/);
  });
});

describe("posta-leggi: il tentativo si conta PRIMA di aprire gli allegati", () => {
  const inizio = codice.indexOf("for (const m of messaggi) {");
  const ramo = codice.slice(inizio, codice.indexOf("const tutti = m.posta_allegati", inizio));

  it("scrive il conto all'inizio del giro di ogni mail, prima di qualunque lettura", () => {
    expect(inizio).toBeGreaterThan(0);
    expect(ramo).toContain("const tentativiContati = (m.tentativi_lettura ?? 0) + 1;");
    expect(ramo).toContain("tentativi_lettura: tentativiContati");
    // Il conto sta PRIMA del `try` che apre gli allegati.
    expect(ramo.indexOf("tentativi_lettura: tentativiContati")).toBeLessThan(ramo.indexOf("    try {"));
  });

  it("se il conto non si riesce a scrivere, la mail si salta (e si dice) senza aprire gli allegati", () => {
    expect(ramo).toContain("if (!contato.ok) {");
    expect(ramo).toContain("non riesco a contare il tentativo");
    expect(ramo).toMatch(/non l'ho aperta`\);\s*continue;/);
  });

  it("lascia una nota che dice che la lettura è «in corso»: se resta così la lettura è morta a metà", () => {
    expect(ramo).toContain("lettura in corso (tentativo ${tentativiContati} di ${MAX_TENTATIVI})");
  });

  it("il conto non raddoppia: nel ramo dell'errore è lo stesso (+1 sul valore letto), e a lettura riuscita la nota si azzera", () => {
    expect(codice).toContain("const tentativi = (m.tentativi_lettura ?? 0) + 1;");
    expect(codice).toContain("lettura_note: scartati.length ? scartati.join(\"; \") : null");
  });

  it("dopo MAX_TENTATIVI la mail esce dalla coda (la lista prende solo tentativi_lettura < MAX)", () => {
    expect(codice).toContain("tentativi_lettura=lt.${MAX_TENTATIVI}");
  });
});
