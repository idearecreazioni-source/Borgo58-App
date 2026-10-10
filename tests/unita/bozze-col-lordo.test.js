import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { controllaMigrazione, funzioniRidefinite, raccontaSmarrite } from "../../scripts/guardie.mjs";

// =====================================================================
// LA `20261006000001` E' SUPERATA DALLA `20261010000001` — 10/10/2026
// =====================================================================
// 🔴 COSA E' SUCCESSO. La 20261006000001 (le bozze di ricetta) riscriveva
//    `colonne_unita_non_classificate()` partendo dalla 20260831000005, cioe'
//    da PRIMA della 20260923000002, e perdeva la voce del lordo della riga di
//    ricetta. Applicata in produzione il 10/10 con --single-transaction, la
//    sua stessa verifica si e' fermata («Restano colonne non classificate:
//    recipe_ingredients.quantita_lorda») ed e' stata annullata per intero. Su
//    Borgo58-Prova non era mai stata applicata.
//
// 🔴 COSA SI PROVA QUI, stessa forma di `vecchia-migrazione-superata.test.js`:
//    1. la nuova registra la vecchia, DOPO la propria verifica;
//    2. la vecchia, messa davanti alla rete col corpo nuovo, viene RIFIUTATA;
//    3. la nuova non perde niente, e porta il resto della vecchia invariato.

const CARTELLA = "supabase/migrations";
const VECCHIA = `${CARTELLA}/20261006000001_le_bozze_di_ricetta.sql`;
const NUOVA = `${CARTELLA}/20261010000001_le_bozze_di_ricetta_col_lordo.sql`;
const CENSIMENTO = "colonne_unita_non_classificate";

const leggi = (f) => readFileSync(f, "utf8");
const corpoDi = (sql, nome) => funzioniRidefinite(sql).find((f) => f.nome === nome)?.testo ?? null;
// Il «corpo vivo» per nome: il censimento e' quello della nuova, le altre
// funzioni della migrazione sono nuove e nel database non esistono ancora.
const vivoSoloCensimento = (corpo) => (nome) => (nome === CENSIMENTO ? corpo : null);

describe("🔴 la vecchia non resta pendente", () => {
  const nuova = leggi(NUOVA);

  it("la nuova registra la versione della vecchia, oltre alla propria", () => {
    expect(nuova).toMatch(/insert into applied_migrations[\s\S]*'20261006000001'/);
    expect(nuova).toMatch(/insert into applied_migrations[\s\S]*'20261010000001'/);
  });

  it("🔴 e le registra DOPO la verifica, non prima", () => {
    const fineVerifica = nuova.indexOf("end $verifica$;");
    const primaRegistrazione = nuova.indexOf("insert into applied_migrations");
    expect(fineVerifica).toBeGreaterThan(0);
    expect(primaRegistrazione).toBeGreaterThan(fineVerifica);
  });

  it("⚠️ la vecchia non e' stata riscritta: perde ancora il lordo", () => {
    expect(corpoDi(leggi(VECCHIA), CENSIMENTO)).not.toContain("quantita_lorda");
  });
});

describe("🔴 e non potra' piu' essere eseguita", () => {
  it("messa davanti alla rete col corpo nuovo, la vecchia viene RIFIUTATA per il lordo perso", () => {
    const corpoNuovo = corpoDi(leggi(NUOVA), CENSIMENTO);
    const perdite = controllaMigrazione(leggi(VECCHIA), vivoSoloCensimento(corpoNuovo));
    expect(perdite.length, "la vecchia passerebbe ancora: non e' superata").toBeGreaterThan(0);
    const smarrite = perdite.flatMap((p) => raccontaSmarrite(p)).join(" | ");
    expect(smarrite).toMatch(/quantita_lorda/);
  });
});

describe("🔴 la nuova non ripete l'errore che corregge", () => {
  const vecchia = leggi(VECCHIA);
  const nuova = leggi(NUOVA);
  const corpoNuovo = corpoDi(nuova, CENSIMENTO);

  it("il censimento conosce sia il lordo sia la quantita' delle bozze", () => {
    expect(corpoNuovo).toContain("('recipe_ingredients','quantita_lorda')");
    expect(corpoNuovo).toContain("('bozze_ricetta_ingredienti','quantita')");
  });

  it("messa davanti alla rete col proprio corpo, non perde niente", () => {
    expect(controllaMigrazione(nuova, vivoSoloCensimento(corpoNuovo))).toEqual([]);
  });

  it("⚠️ tolta la riga del lordo e i suoi commenti, il corpo e' quello della vecchia", () => {
    // La nuova porta la vecchia INVARIATA tranne una cosa: se un giorno le
    // due divergessero altrove, questa prova lo dice.
    const senzaCommenti = (t) =>
      t
        .split("\n")
        .filter((r) => !/^\s*--/.test(r))
        .join("\n");
    const nuovoSenzaLordo = senzaCommenti(corpoNuovo).replace("    ('recipe_ingredients','quantita_lorda'),\n", "");
    expect(nuovoSenzaLordo).toBe(senzaCommenti(corpoDi(vecchia, CENSIMENTO)));
  });

  it("⚠️ tutte le altre funzioni sono identiche a quelle della vecchia", () => {
    const altre = (sql) =>
      funzioniRidefinite(sql)
        .filter((f) => f.nome !== CENSIMENTO)
        .map((f) => `${f.nome}\n${f.testo}`);
    expect(altre(nuova)).toEqual(altre(vecchia));
  });
});
