import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 🔴 `npm run deposito:orfani -- --conferma` CANCELLA i file del deposito
// che nessuna riga del database nomina (31/10/2026).
//
// Il controllo finale del 30/10 ha trovato che la sua richiesta non
// conosceva `posta_allegati`: gli allegati delle e-mail, salvati nello
// stesso deposito, sarebbero stati tolti. Il difetto non si vede con una
// prova sul database (servirebbe il deposito vero), ma ha una forma
// precisa: **una colonna che nomina un file e che lo script non legge**.
// Queste prove guardano proprio quello, partendo dalle migrazioni: chi
// aggiunge domani una colonna `*_path` per un file nuovo vede questa prova
// fallire finche' non la aggiunge anche allo script.

const RADICE = path.resolve(__dirname, "../..");
const SCRIPT = readFileSync(path.join(RADICE, "scripts/deposito-orfani.mjs"), "utf8");
const CARTELLA_MIGRAZIONI = path.join(RADICE, "supabase/migrations");

/** Le coppie «tabella.colonna» che le migrazioni dichiarano come percorso di un file. */
function colonneDiPercorso() {
  const trovate = new Set();
  for (const nome of readdirSync(CARTELLA_MIGRAZIONI).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(path.join(CARTELLA_MIGRAZIONI, nome), "utf8");
    // create table … ( … colonna_path text … );
    for (const [, tabella, corpo] of sql.matchAll(
      /create table(?: if not exists)?\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi
    )) {
      for (const [, colonna] of corpo.matchAll(/^\s+(\w+_path)\s+text\b/gim)) {
        trovate.add(`${tabella}.${colonna}`);
      }
    }
    // alter table … add column colonna_path text
    for (const [, tabella, colonna] of sql.matchAll(
      /alter table\s+(?:public\.)?(\w+)\s+add column(?: if not exists)?\s+(\w+_path)\s+text\b/gi
    )) {
      trovate.add(`${tabella}.${colonna}`);
    }
  }
  return [...trovate].sort();
}

/** Le coppie «tabella.colonna» che la richiesta dello script legge. */
function colonneLetteDalloScript() {
  return [...SCRIPT.matchAll(/select (\w+) from (\w+) where \1 is not null/g)]
    .map(([, colonna, tabella]) => `${tabella}.${colonna}`)
    .sort();
}

describe("deposito-orfani conosce ogni file nominato dal database", () => {
  it("le migrazioni dichiarano le quattro colonne note (la prova non e' vuota)", () => {
    // ⚠️ Se la lettura delle migrazioni si rompesse e trovasse zero colonne,
    // la prova dopo passerebbe senza controllare niente.
    expect(colonneDiPercorso()).toEqual([
      "documents.storage_path",
      "posta_allegati.storage_path",
      "segnalazioni.immagine_path",
      "spese_da_collocare.foto_path",
    ]);
  });

  it("ogni colonna di percorso delle migrazioni e' nella richiesta dello script", () => {
    const lette = new Set(colonneLetteDalloScript());
    const mancanti = colonneDiPercorso().filter((c) => !lette.has(c));
    expect(mancanti).toEqual([]);
  });

  it("gli allegati della posta sono fra i nominati", () => {
    expect(colonneLetteDalloScript()).toContain("posta_allegati.storage_path");
  });
});

describe("deposito-orfani si ferma su un elenco non credibile", () => {
  it("con file nel deposito e nessun nominato si ferma prima di elencare orfani", () => {
    const freno = SCRIPT.search(/if \(files\.length > 0 && nominati\.size === 0\)\s*\{\s*fermati\(/);
    expect(freno).toBeGreaterThan(-1);
    // Il freno viene prima di qualunque stampa o cancellazione degli orfani.
    expect(freno).toBeLessThan(SCRIPT.indexOf("for (const f of orfani)"));
    expect(freno).toBeLessThan(SCRIPT.indexOf(".remove(orfani)"));
  });
});
