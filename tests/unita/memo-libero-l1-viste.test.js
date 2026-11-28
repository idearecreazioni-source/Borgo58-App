import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// MEMO libero, passo L1 (28/11/2026): ruolo di sola lettura + viste pulite.
// Sono prove SUL TESTO della migrazione: quelle vere (si passa al ruolo e si prova a scrivere, i totali delle viste
// contro le pagine) stanno nel blocco di verifica della migrazione stessa, che gira su Prova e nei Controlli.
const SQL = readFileSync("supabase/migrations/20261128000001_memo_legge_solo_da_viste_pulite.sql", "utf8");
const SENZA_COMMENTI = SQL.split("\n").filter((r) => !r.trim().startsWith("--")).join("\n");

const viste = [...SENZA_COMMENTI.matchAll(/create or replace view (\S+) with \(security_invoker = false\) as/g)].map((m) => m[1]);
const corpoDi = (vista) => {
  const da = SENZA_COMMENTI.indexOf(`create or replace view ${vista} with (security_invoker = false) as`);
  const a = SENZA_COMMENTI.indexOf("comment on view", da);
  return SENZA_COMMENTI.slice(da, a);
};

describe("MEMO libero L1: il ruolo di sola lettura", () => {
  it("nasce senza login e senza poteri", () => {
    expect(SENZA_COMMENTI).toMatch(
      /create role memo_lettore nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls/
    );
  });

  it("nessun permesso a anon, authenticated, service_role o a tutti sullo schema delle viste", () => {
    expect(SENZA_COMMENTI).toContain("revoke all on schema memo_lettura from public, anon, authenticated, service_role");
    expect(SENZA_COMMENTI).not.toMatch(/grant [^;]*\bto\s+(public|anon|authenticated|service_role)\b/i);
  });

  it("al ruolo si dà solo select sulle viste e usage sul suo schema, mai altro", () => {
    const grant = [...SENZA_COMMENTI.matchAll(/grant ([^;]+?) (?:on|to) /gi)].map((m) => m[1].toLowerCase());
    expect(grant.every((g) => ["usage", "select", "execute", "memo_lettore"].includes(g.trim()) || g.includes("format"))).toBe(true);
    expect(SENZA_COMMENTI).not.toMatch(/grant (insert|update|delete|truncate|all)/i);
    expect(SENZA_COMMENTI).not.toMatch(/on schema public/i);
  });

  it("i limiti di tempo e di righe non si mettono sul ruolo (non farebbero niente)", () => {
    expect(SENZA_COMMENTI).not.toMatch(/alter role memo_lettore set/i);
  });
});

describe("MEMO libero L1: le viste", () => {
  it("sono dieci e stanno tutte nello schema memo_lettura con il prefisso memo_v_", () => {
    expect(viste).toHaveLength(10);
    for (const v of viste) expect(v).toMatch(/^memo_lettura\.memo_v_[a-z_]+$/);
  });

  it("non portano colonne vietate: testo delle mail, segreti, chiavi, accessi", () => {
    for (const v of viste) {
      const corpo = corpoDi(v).toLowerCase();
      expect(corpo, v).not.toMatch(/\.testo\b|password|secret|api_key|storage_path|auth\.users|vault\./);
    }
    expect(corpoDi("memo_lettura.memo_v_posta")).not.toMatch(/m\.testo/);
  });

  it("leggono solo tabelle dello schema public scritte per esteso (nessuna dipendenza dal search_path)", () => {
    for (const v of viste) {
      const corpo = corpoDi(v).replace(/extract\(year from [a-z_.()]+\)/gi, "");
      for (const m of corpo.matchAll(/\b(?:from|join)\s+(?!lateral\b)([a-z_.]+)/gi)) {
        expect(m[1], `${v}: ${m[1]}`).toMatch(/^(public|memo_lettura)\./);
      }
    }
  });

  it("riprendono le regole delle pagine: stesse funzioni e stessi filtri", () => {
    const conti = corpoDi("memo_lettura.memo_v_conti_sala");
    expect(conti).toContain("memo_lettura.f_totale_conto(o.id)");
    expect(conti).toContain("memo_lettura.f_serata(o.closed_at)");
    expect(conti).toContain("coalesce(d.collected_amount, tc.totale)");
    const incassi = corpoDi("memo_lettura.memo_v_incassi_giornalieri");
    expect(incassi).toContain("c.stato in ('chiuso', 'omaggiato')");
    expect(incassi).toContain("c.incasso > 0");
    expect(corpoDi("memo_lettura.memo_v_prenotazioni")).toContain("r.status in ('confermata', 'richiesta_in_attesa')");
    expect(corpoDi("memo_lettura.memo_v_fatture_fornitori")).toContain("memo_lettura.f_da_pagare(i.id)");
    expect(corpoDi("memo_lettura.memo_v_prestiti")).toContain("coalesce(r.tot, 0) >= p.importo");
    expect(corpoDi("memo_lettura.memo_v_ho_pagato_io")).toContain("a.pareggiata_il is null");
  });

  it("niente di tutto questo si vede senza un blocco di verifica e senza registrarsi", () => {
    for (const n of ["VERIFICA (1)", "VERIFICA (2a)", "VERIFICA (3)", "VERIFICA (4)", "VERIFICA (5a)", "VERIFICA (5b)", "VERIFICA (6a)", "VERIFICA (6e)"]) {
      expect(SQL).toContain(n);
    }
    expect(SQL).toMatch(/insert into applied_migrations \(version, name\)\s+values \('20261128000001', 'memo_legge_solo_da_viste_pulite'\)/);
  });
});

describe("MEMO libero L1: le funzioni di passaggio", () => {
  const funzioni = [...SENZA_COMMENTI.matchAll(/create or replace function (memo_lettura\.f_[a-z_]+)\(/g)].map((m) => m[1]);

  it("sono quattro, tutte di sola lettura, col percorso fisso, che girano come proprietario", () => {
    expect(funzioni).toEqual(["memo_lettura.f_serata", "memo_lettura.f_oggi", "memo_lettura.f_da_pagare", "memo_lettura.f_totale_conto"]);
    for (const f of funzioni) {
      const da = SENZA_COMMENTI.indexOf(`create or replace function ${f}(`);
      const corpo = SENZA_COMMENTI.slice(da, SENZA_COMMENTI.indexOf("$$;", da) + 3);
      expect(corpo, f).toMatch(/stable security definer set search_path = pg_catalog, pg_temp/);
    }
  });

  it("nessuna è aperta ad altri ruoli e solo il ruolo di lettura la esegue", () => {
    expect(SENZA_COMMENTI).toMatch(/revoke all on function [^;]+ from public, anon, authenticated, service_role;/);
    expect(SENZA_COMMENTI).toMatch(/grant execute on function [^;]+ to memo_lettore;/);
  });

  it("le viste non chiamano mai funzioni di public: passano tutte dalle quattro di passaggio", () => {
    for (const v of viste) expect(corpoDi(v), v).not.toMatch(/\bpublic\.[a-z_]+\(/);
  });

  it("la verifica prova la lettura DAVVERO dal ruolo anche per le due viste dei conti", () => {
    expect(SQL).toContain("perform 1 from memo_lettura.memo_v_conti_sala limit 1;");
    expect(SQL).toContain("perform 1 from memo_lettura.memo_v_incassi_giornalieri limit 1;");
    expect(SQL).toContain("VERIFICA (2e)");
  });
});
