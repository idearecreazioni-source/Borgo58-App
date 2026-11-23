import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// REVISIONE DEL 23/11/2026, punto 8: la privacy della Scheda nel database. Il database vero lo prova la verifica interna
// della migrazione e la prova su Prova; qui si controllano le cose che non devono cambiare per sbaglio.

const migrazione = readFileSync(new URL("../../supabase/migrations/20261123000003_scheda_privacy_nel_database.sql", import.meta.url), "utf8");

describe("migrazione 20261123000003: privacy della Scheda", () => {
  it("il portiere rifiuta le parole delicate e dice quali", () => {
    expect(migrazione).toMatch(/v_parole := scheda_parole_delicate\(new\.testo\) \|\| scheda_parole_delicate\(new\.fonte_dettaglio\);/);
    expect(migrazione).toContain("La Scheda non accetta argomenti delicati (trovato: %)");
  });

  it("il portiere conserva le sue uscite: l'aggiornamento che non tocca il testo non si ricontrolla, e solo il titolare scrive", () => {
    expect(migrazione).toMatch(/old\.testo is not distinct from new\.testo/);
    expect(migrazione).toMatch(/if not is_titolare\(\) then/);
    expect(migrazione).toContain("insufficient_privilege");
  });

  it("l'IBAN con lo spazio dopo la sigla è coperto, ma solo per i paesi che si usano (non «da 12 anni 2026»)", () => {
    expect(migrazione).toMatch(/v_iban_spaziato text := '\\m\(IT\|SM\|VA\|FR\|DE\|ES\|GB\|CH\|NL\|BE\|AT\|PT\|LU\|IE\|MT\|CY\|GR\|SK\)\[ \.-\]\[0-9\]\{2\}/);
    // «SI» è una parola italiana: non può essere fra le sigle.
    expect(migrazione).not.toMatch(/\(IT\|SM[^)]*\|SI\|/);
    expect(migrazione).toMatch(/~\* v_iban_spaziato/);
  });

  it("«Correggi» controlla telefoni ed e-mail sul testo corretto (cambio del corpo vivo, una riga sola)", () => {
    expect(migrazione).toContain("if scheda_contatti_nel_testo(v_testo) then");
    expect(migrazione).toContain("if v_n <> 1 then");
    expect(migrazione).toContain("scheda_proposta_decidi non ha una sola riga");
  });

  it("la verifica non spreca i numeri [S#] e non lascia voci", () => {
    expect(migrazione).toMatch(/select last_value, is_called into v_seq_ultimo, v_seq_usato from scheda_voci_numero_seq;/);
    expect(migrazione).toMatch(/perform setval\('scheda_voci_numero_seq', v_seq_ultimo, v_seq_usato\);/);
    expect(migrazione).toContain("raise exception 'ZZ_ANNULLA'");
  });

  it("non apre permessi e si registra col proprio numero", () => {
    expect(migrazione).toMatch(/revoke all on function scheda_testo_personale\(text\) from public, anon, authenticated;/);
    expect(migrazione).toMatch(/revoke all on function scheda_controlla_privacy\(\) from public, anon, authenticated;/);
    expect(migrazione).toMatch(/values \('20261123000003', 'scheda_privacy_nel_database'\)/);
  });
});
