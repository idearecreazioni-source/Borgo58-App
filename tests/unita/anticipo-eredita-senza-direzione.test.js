import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { funzioniRidefinite, spogliaCommenti } from "../../scripts/guardie.mjs";

// =====================================================================
// L'ANTICIPO EREDITA SENZA CHIEDERE LA DIREZIONE — 13/11/2026
// =====================================================================
// Il difetto: «record "new" has no field "direction"» su ogni anticipo
// collegato a una fattura (Fabio Lorito 1992/2026, 235 €, notte del 13/11).
// `piano_pagamento_eredita_spunta()` sta su cash_movements E su
// anticipazioni_socio, e chiedeva `new.direction` dentro un `and`: PL/pgSQL
// prepara l'espressione intera, e su anticipazioni_socio quella colonna non
// c'è.
// ⚠️ QUI NON C'È IL DATABASE: si legge il testo. Il comportamento vero
//    (anticipo accettato con e senza spunta, la spunta che passa dalla
//    fattura, la cassa come prima) lo prova la verifica dentro la migrazione.

const CARTELLA = "supabase/migrations";
const MIGRAZIONE = "20261113000001_l_anticipo_eredita_senza_direzione.sql";
const leggi = (f) => readFileSync(`${CARTELLA}/${f}`, "utf8").replace(/\r\n/g, "\n");

// La forma che ha rotto: un ramo per tabella e un campo di NEW nella
// stessa espressione.
const FORMA_ROTTA = /tg_table_name\s*=\s*'[a-z_]+'\s+and\s+new\./i;

function ultimaDefinizione(nome) {
  const file = readdirSync(CARTELLA).filter((f) => f.endsWith(".sql")).sort();
  let ultima = null;
  for (const f of file) {
    for (const fn of funzioniRidefinite(leggi(f))) {
      if (fn.nome === nome) ultima = { file: f, testo: spogliaCommenti(fn.testo) };
    }
  }
  return ultima;
}

describe("piano_pagamento_eredita_spunta, la definizione viva", () => {
  const viva = ultimaDefinizione("piano_pagamento_eredita_spunta");

  it("è quella della migrazione del 13/11", () => {
    expect(viva.file).toBe(MIGRAZIONE);
  });

  it("🔴 non chiede più la direzione dentro un «and»", () => {
    expect(viva.testo).not.toMatch(FORMA_ROTTA);
  });

  it("la direzione si chiede solo dentro il ramo della cassa", () => {
    expect(viva.testo).toMatch(
      /if tg_table_name = 'cash_movements' then\s+if new\.direction is distinct from 'uscita' then\s+return new;/
    );
  });

  it("non perde niente del corpo di prima: la tasca, la fattura segnata e collegata", () => {
    expect(viva.testo).toContain("e_una_tasca(new.entity_id)");
    expect(viva.testo).toMatch(/i\.e_investimento\s+and exists \(select 1 from piano_collegamenti c where c\.supplier_invoice_id = i\.id\)/);
    expect(viva.testo).toContain("new.e_investimento := true;");
    expect(viva.testo).toContain("security definer");
    expect(viva.testo).toContain("set search_path = public");
  });
});

describe("la migrazione del 13/11", () => {
  const sql = leggi(MIGRAZIONE);

  it("riproduce i casi di Alessio nella verifica, e la annulla", () => {
    expect(sql).toContain("do $verifica$");
    expect(sql).toContain("foto_righe()");
    expect(sql).toContain("pretendi_nessun_residuo(v_foto");
    expect(sql).toContain("raise exception 'ZZ_ANNULLA'");
    // (1) senza spunta, (2) fattura segnata, (3) segnata dopo, (4) la cassa.
    expect(sql.match(/registra_anticipazione\(/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).toContain("segna_investimento('fattura', v_fat2, v_affitto)");
    expect(sql).toContain("segna_investimento('anticipazione', v_ant, v_affitto)");
    expect(sql).toMatch(/insert into cash_movements[\s\S]*'uscita'[\s\S]*v_fat4/);
  });

  it("si auto-registra", () => {
    expect(sql).toMatch(/insert into applied_migrations \(version, name\)\s+values \('20261113000001', 'l_anticipo_eredita_senza_direzione'\)\s+on conflict \(version\) do nothing;/);
  });
});

describe("la rete per le migrazioni nuove", () => {
  it("🔴 nessuna migrazione dal 13/11 in poi rimette la forma rotta", () => {
    const nuove = readdirSync(CARTELLA).filter((f) => f.endsWith(".sql") && f >= "20261113000001");
    for (const f of nuove) {
      expect(spogliaCommenti(leggi(f)), f).not.toMatch(FORMA_ROTTA);
    }
  });
});
