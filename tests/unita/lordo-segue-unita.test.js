import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// =====================================================================
// CAMBIANDO UNITA', IL LORDO SEGUE IL NETTO — 23/09/2026
// =====================================================================
// 🔴 IL BUCO, trovato da una rete che esisteva gia'. R12 ha aggiunto
//    `recipe_ingredients.quantita_lorda`, e il censimento delle unita' e'
//    diventato rosso da solo: una colonna numerica legata a un ingrediente
//    era rimasta fuori.
//
// ⚠️ E NON ERA UN DIFETTO DI SOLO ELENCO. Quel censimento e' il promemoria
//    di cosa va convertito: `converti_numeri_dell_unita` moltiplica
//    `quantity` per il fattore, e `quantita_lorda` no. Da chili a grammi il
//    netto sarebbe diventato mille volte piu' grande e il lordo no.
//
// 🔴 E IL DANNO NON SAREBBE STATO UN NUMERO STORTO: sarebbe stato il
//    cambio d'unita' che FALLISCE — `quantita_lorda >= quantity` e' un
//    vincolo — oppure, convertendo verso il basso, uno scarto che cambia DA
//    SOLO, perche' e' il rapporto fra i due numeri.

const FILE = "supabase/migrations/20260923000002_cambiando_unita_il_lordo_segue_il_netto.sql";
const SQL = readFileSync(FILE, "utf8");
// Il codice, coi commenti tolti: un setaccio che cerca una forma nel testo
// trova anche chi la nomina per spiegarla (27/08).
const codice = SQL.replace(/--[^\n]*/g, "");

describe("la conversione porta con sé il lordo", () => {
  const conversione = codice.split("update recipe_ingredients set")[1]?.split(";")[0];

  it("🔴 netto e lordo si convertono con lo STESSO fattore", () => {
    expect(conversione, "non trovo l'update di recipe_ingredients").toBeTruthy();
    expect(conversione).toMatch(/quantity = quantity \* v_f/);
    expect(conversione).toMatch(/quantita_lorda = quantita_lorda \* v_f/);
  });

  it("🔴 e nella STESSA istruzione, non in due", () => {
    // ⚠️ Il riflesso scatta a ogni scrittura: fra un'istruzione e l'altra
    //    la riga passerebbe per uno stato in cui netto e lordo non si
    //    corrispondono, e lo scarto verrebbe ricalcolato su quello stato
    //    intermedio.
    const quante = (codice.match(/update recipe_ingredients set/g) || []).length;
    expect(quante, "recipe_ingredients viene aggiornata più di una volta").toBe(1);
    // E l'unità della riga segue nella stessa istruzione.
    expect(conversione).toMatch(/unit = new\.unit/);
  });

  it("⚠️ e il corpo viene dal corpo vivo: le altre tabelle non sono toccate", () => {
    // Se qualcuno riscrivesse la funzione a memoria, queste sparirebbero
    // senza che nessun errore lo dica.
    for (const tabella of [
      "stock_lots",
      "stock_consumptions",
      "shopping_list_items",
      "ordini_fornitore_righe",
      "rettifiche_giacenza",
      "intercompany_cessions",
      "produzioni",
      "price_history",
      "articoli_fornitore",
      "bar_items",
    ]) {
      expect(codice, `manca la conversione di ${tabella}`).toContain(tabella);
    }
    // E le opzioni della funzione sono conservate.
    expect(codice).toMatch(/SECURITY DEFINER/i);
    expect(codice).toMatch(/SET search_path TO 'public'/i);
  });
});

describe("il censimento conosce la colonna nuova", () => {
  it("🔴 `quantita_lorda` sta fra le quantità CHE SI CONVERTONO", () => {
    // Accanto al netto, non fra i prezzi (che si dividono) né fra le
    // percentuali (che non si toccano).
    const elenco = codice.split("with conosciute(t, c) as (values")[1]?.split("$function$")[0];
    expect(elenco, "non trovo l'elenco delle conosciute").toBeTruthy();
    expect(elenco).toContain("('recipe_ingredients','quantita_lorda')");

    // E sta PRIMA della riga che separa ciò che si converte da ciò che no.
    const doveLordo = elenco.indexOf("('recipe_ingredients','quantita_lorda')");
    const doveNonSiConverte = elenco.indexOf("('ingredients','waste_percentage_default')");
    expect(doveNonSiConverte).toBeGreaterThan(0);
    expect(doveLordo).toBeLessThan(doveNonSiConverte);
  });

  it("🔴 e nessuna voce preesistente è sparita", () => {
    // ⚠️ La scorciatoia era riscrivere l'elenco a memoria: una voce persa
    //    non darebbe nessun errore — semplicemente quella colonna
    //    smetterebbe di essere convertita, in silenzio.
    const elenco = codice.split("with conosciute(t, c) as (values")[1]?.split("$function$")[0];
    for (const voce of [
      "('ingredients','stock_minimum_threshold')",
      "('recipe_ingredients','quantity')",
      "('stock_lots','quantity_received')",
      "('stock_consumptions','quantita_senza_costo')",
      "('bar_items','porzioni_per_unita')",
      "('articoli_fornitore','fattore')",
      "('ingredients','waste_percentage_default')",
      "('recipe_ingredients','waste_percentage')",
    ]) {
      expect(elenco, `voce sparita: ${voce}`).toContain(voce);
    }
  });
});

describe("la verifica dimostra l'invarianza, e non la afferma", () => {
  it("🔴 cambia davvero unità e guarda i tre numeri", () => {
    expect(codice).toMatch(/update ingredients set unit = 'g' where id = v_ing/);
    expect(codice).toMatch(/Il netto doveva diventare 400 g/);
    expect(codice).toMatch(/Il lordo doveva diventare 1500 g/);
  });

  it("🔴 e pretende che lo SCARTO non si muova", () => {
    // È il punto: lo scarto è il rapporto fra i due, e due numeri
    // moltiplicati per lo stesso fattore lo lasciano dov'era.
    expect(codice).toMatch(/Lo scarto si e'' mosso cambiando unita''/);
    expect(codice).toMatch(/v_scarto is distinct from 275\.00/);
  });

  it("⚠️ e gira in una sotto-transazione annullata, senza residui", () => {
    expect(codice).toContain("ZZ_ANNULLA");
    expect(codice).toMatch(/\bfoto_righe\(\)/);
    expect(codice).toMatch(/perform pretendi_nessun_residuo\(/);
  });
});

describe("🔴 e non si toccano né i dati né le migrazioni già applicate", () => {
  it("nessuna conversione dei dati esistenti", () => {
    // ⚠️ Condizione esplicita: si cambia la regola dei cambi FUTURI, non i
    //    numeri di oggi. Una sanatoria qui moltiplicherebbe quantità vere.
    const fuoriDallaFunzione = codice
      .split("$function$")
      .filter((_, i) => i % 2 === 0)
      .join("\n");
    expect(fuoriDallaFunzione).not.toMatch(/update recipe_ingredients\s+set/i);
    expect(codice).not.toMatch(/drop\s+(view|table|function)/i);
    expect(codice).not.toMatch(/\bcascade\b/i);
    expect(codice).not.toMatch(/\bgrant\b|\brevoke\b|create policy/i);
  });

  it("R12 e la riparazione RLS restano intatte", () => {
    const r12 = readFileSync(
      "supabase/migrations/20260922000001_la_resa_sulla_riga_di_ricetta.sql",
      "utf8",
    );
    const rls = readFileSync(
      "supabase/migrations/20260923000001_la_vista_dei_costi_torna_a_rispettare_la_rls.sql",
      "utf8",
    );
    // Nessuna delle due nomina la conversione: la riparazione vive qui.
    expect(r12).not.toContain("converti_numeri_dell_unita");
    expect(rls).not.toContain("converti_numeri_dell_unita");
    expect(r12).not.toContain("colonne_unita_non_classificate");
  });

  it("⚠️ ed è l'unica migrazione nuova dopo la riparazione RLS", () => {
    const tutte = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql"));
    const rls = tutte.find((f) => f.startsWith("20260923000001"));
    const dopo = tutte.filter((f) => f > rls);
    expect(dopo).toEqual(["20260923000002_cambiando_unita_il_lordo_segue_il_netto.sql"]);
  });
});
