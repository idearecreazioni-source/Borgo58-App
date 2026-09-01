import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PRIMA_CON_AUTO_REGISTRAZIONE, versioniDoppie } from "../../scripts/comune.mjs";

// L'IGIENE DELLE MIGRAZIONI, GUARDATA DA CHI NON HA IL DATABASE — 01/09/2026
//
// 🔴 PERCHE' ESISTE, e il buco e' misurato. `versioniDoppie()` c'e' dal
//    22/08 ed e' una rete vera, ma vive **solo dentro `npm run migra` e
//    `npm run prova:migra`**: due comandi che girano sul computer di
//    Alessio, con le chiavi del database in mano. Su GitHub, dove ogni
//    modifica passa prima di arrivare a `master`, quella cartella non la
//    guardava nessuno.
//
// ⚠️ E IL DIFETTO CHE CHIUDE E' GIA' SUCCESSO, il 22/08: due migrazioni
//    con lo stesso numero di versione, una applicata e l'altra data per
//    applicata — `applied_migrations` ha per chiave la versione, non il
//    nome del file. Quel giorno il codice era gia' online e in sala
//    aggiungere un piatto a una comanda falliva, perche' chiedeva una
//    colonna che nel database vero non c'era.
//
// ⚠️ SONO PROPRIETA' DELLA CARTELLA, non conteggi: nessuna di queste prove
//    contiene un numero letto dalla produzione. Un elenco di nomi
//    invecchierebbe alla prima migrazione nuova — e questo progetto ha gia'
//    pagato tre volte per una fotografia scambiata per una regola.

const CARTELLA = path.join(process.cwd(), "supabase", "migrations");

const migrazioni = readdirSync(CARTELLA)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((file) => ({
    file,
    versione: file.split("_")[0],
    testo: readFileSync(path.join(CARTELLA, file), "utf8"),
  }));

/** Solo quelle a cui la regola si applica: vedi PRIMA_CON_AUTO_REGISTRAZIONE. */
const dopoLaSoglia = migrazioni.filter((m) => m.versione >= PRIMA_CON_AUTO_REGISTRAZIONE);

describe("la cartella delle migrazioni", () => {
  it("contiene delle migrazioni (se questa fallisce, e' il setaccio a essere rotto)", () => {
    // ⚠️ La rete che protegge la rete: un percorso sbagliato darebbe zero
    //    file, e tutte le prove qui sotto passerebbero senza guardare niente.
    expect(migrazioni.length).toBeGreaterThan(300);
    expect(dopoLaSoglia.length).toBeGreaterThan(300);
  });

  // 🔴 Il difetto del 22/08.
  it("non ha due file con lo stesso numero di versione", () => {
    expect(versioniDoppie(migrazioni)).toEqual([]);
  });

  it("ogni file comincia con un numero di versione di quattordici cifre", () => {
    const storti = migrazioni.filter((m) => !/^\d{14}$/.test(m.versione)).map((m) => m.file);
    expect(storti).toEqual([]);
  });

  // §5 punto 4 del CLAUDE.md: ogni migrazione si auto-registra come ultima
  // istruzione. Senza, `npm run migra` la riproporrebbe per sempre.
  it("ogni migrazione si registra da sola in applied_migrations", () => {
    const mute = dopoLaSoglia
      .filter((m) => !/insert\s+into\s+applied_migrations/i.test(m.testo))
      .map((m) => m.file);
    expect(mute).toEqual([]);
  });

  // ⚠️ E si registra col PROPRIO numero: registrarne un altro e' il modo di
  //    far risultare applicata una migrazione che non e' mai girata — che e'
  //    esattamente cio' che il 22/08 e' successo per un'altra strada.
  it("e si registra col proprio numero, non con quello di un'altra", () => {
    const sbagliate = [];
    for (const m of dopoLaSoglia) {
      const scritte = [
        ...m.testo.matchAll(
          /insert\s+into\s+applied_migrations\s*\([^)]*\)\s*values\s*\(\s*'(\d+)'/gi
        ),
      ].map((x) => x[1]);
      if (scritte.length > 0 && !scritte.includes(m.versione)) {
        sbagliate.push(`${m.file} registra ${scritte.join(", ")}`);
      }
    }
    expect(sbagliate).toEqual([]);
  });

  // §5 punto 3: ogni migrazione termina con un blocco di verifica che solleva
  // eccezione se non ha prodotto l'effetto dichiarato.
  it("ogni migrazione porta un blocco di verifica", () => {
    const senza = dopoLaSoglia
      .filter((m) => !/\bdo\s+\$/i.test(m.testo))
      .map((m) => m.file);
    expect(senza).toEqual([]);
  });
});
