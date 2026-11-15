import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MIGRAZIONE = readFileSync("supabase/migrations/20261114000012_il_motore_della_chat_di_memo.sql", "utf8");
const MEMO_LEGGE_TUTTO = readFileSync("supabase/migrations/20261115000010_memo_legge_tutto.sql", "utf8");

// Le funzioni della chat non devono rifare i conti delle schermate. Questa e'
// una prova locale di parita' della fonte: verifica che ogni strumento si
// appoggi alla stessa funzione o vista che usa il modulo corrispondente.
describe("gli strumenti di MEMO leggono dalle fonti delle schermate", () => {
  it("Piano usa speso e rate gia' calcolati dal database", () => {
    const piano = MIGRAZIONE.slice(MIGRAZIONE.indexOf("create or replace function memo_leggi_piano"), MIGRAZIONE.indexOf("create or replace function memo_leggi_cassa"));
    expect(piano).toContain("piano_speso_per_voce()");
    expect(piano).toContain("piano_rate_aperte()");
  });
  it("Fatture fornitori usa il da_pagare della schermata", () => {
    expect(MIGRAZIONE).toMatch(/memo_leggi_fatture_fornitori[\s\S]*da_pagare\(i\)/);
  });
  it("Agenda e Magazzino usano la corsia e la vista gia' esposte", () => {
    expect(MIGRAZIONE).toMatch(/memo_leggi_agenda[\s\S]*agenda_corsie\(\)/);
    expect(MIGRAZIONE).toMatch(/memo_leggi_magazzino[\s\S]*v_stock_levels/);
  });

  it("riusa le fonti delle nuove schermate senza ricopiare i calcoli", () => {
    expect(MEMO_LEGGE_TUTTO).toMatch(/memo_leggi_banca[\s\S]*movimenti_banca/);
    expect(MEMO_LEGGE_TUTTO).toMatch(/memo_leggi_prenotazioni[\s\S]*prenotazione_tavoli/);
    expect(MEMO_LEGGE_TUTTO).toMatch(/memo_leggi_haccp[\s\S]*v_haccp_temperature_logs/);
    expect(MEMO_LEGGE_TUTTO).toMatch(/memo_leggi_costo_piatti[\s\S]*v_recipe_costs/);
    expect(MEMO_LEGGE_TUTTO).toMatch(/memo_leggi_documenti[\s\S]*documents/);
    expect(MEMO_LEGGE_TUTTO).toMatch(/memo_leggi_fatture_clienti[\s\S]*fatture_emesse/);
  });
});
