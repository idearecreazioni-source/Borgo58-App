import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REVISIONE DELL'11/11/2026, punto 11: la posta che non riesce a leggere l'elenco delle mail NON si ferma in silenzio.
//
// ⚠️ posta-leggi gira su Deno e non si esegue da qui: si legge il codice e si controllano le cose che non devono
//    cambiare per sbaglio.

const codice = readFileSync(new URL("../../supabase/functions/posta-leggi/index.ts", import.meta.url), "utf8");
const inizio = codice.indexOf("posta_ricevuta?stato=eq.da_leggere");
const ramo = codice.slice(inizio, codice.indexOf("const messaggi = await elenco.json();", inizio));

describe("posta-leggi: l'elenco delle mail non leggibile è un errore detto, non un silenzio", () => {
  it("se la lettura dell'elenco fallisce lancia un errore col codice", () => {
    expect(inizio).toBeGreaterThan(0);
    expect(ramo).toContain("if (!elenco.ok) {");
    expect(ramo).toMatch(/throw new Error\(`l'elenco delle mail non si legge \(codice \$\{elenco\.status\}\)/);
  });

  it("non ha più il `return` silenzioso nel ramo dell'errore", () => {
    expect(ramo).not.toMatch(/\n\s*return;\n/);
  });

  it("l'errore finisce in un avviso su Telegram (il gestore di chi chiama)", () => {
    expect(codice).toMatch(/leggiLaPosta\(\)\.catch\(async \(e\) => \{[\s\S]*?await avvisa\(`Non sono riuscito a leggere la posta: \$\{\(e as Error\)\.message\}`\);/);
  });

  it("nell avviso su Telegram va solo il codice: il corpo della risposta (nomi di tabelle e colonne) resta nel registro", () => {
    expect(ramo).toContain("(await elenco.text()).slice(0, 300)");
    expect(ramo).toContain("`l'elenco delle mail non si legge (codice ${elenco.status}); il dettaglio è nel registro della funzione`");
    // Il testo della risposta del database non entra mai nell'errore (che va su Telegram).
    const riga = ramo.slice(ramo.indexOf("throw new Error("));
    expect(riga.slice(0, riga.indexOf(";"))).not.toContain("corpoErrore");
  });

  it("una posta vuota (nessuna mail da leggere) resta un esito normale, non un errore", () => {
    expect(codice).toContain("if (!messaggi.length) return;");
  });
});
