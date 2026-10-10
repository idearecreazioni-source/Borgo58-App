import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { argomentiMigrazione, REF_PRODUZIONE, REF_PROVA } from "../../scripts/comune.mjs";

// =====================================================================
// L'INDIRIZZO DELLE FUNZIONI NEL VAULT — 29/09/2026
// =====================================================================
// 🔴 PERCHÉ ESISTE. La migrazione 20260929000001 scrive nel Vault. È l'unico
//    posto del repository che lo fa per il gestionale vero, e per questo le
//    sue regole si sorvegliano sul testo: accetta solo i due progetti del
//    locale, si ferma invece di correggere, non sovrascrive niente, e non
//    mette nessun valore nei messaggi.
//
// ⚠️ Sono prove sul TESTO, non sul database: che il SQL giri lo dimostra la
//    migrazione stessa quando la si applica su Prova.

const CARTELLA = "supabase/migrations";
const VERSIONE = "20260929000001";
const NOME = "l_indirizzo_delle_funzioni_nel_vault";
const FILE = `${CARTELLA}/${VERSIONE}_${NOME}.sql`;
const SQL = readFileSync(FILE, "utf8");
// Il codice, coi commenti tolti: un setaccio che cerca una forma nel testo
// trova anche chi la nomina per spiegarla (27/08).
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
const codice = senzaCommenti(SQL);
const minuscolo = codice.toLowerCase();

const REGISTRAZIONE = `insert into applied_migrations (version, name)
values ('${VERSIONE}', '${NOME}') on conflict (version) do nothing;`;
const posRegistrazione = codice.lastIndexOf("insert into applied_migrations");
// La parte che tocca il Vault: tutto ciò che viene prima della registrazione.
const passo = minuscolo.slice(0, posRegistrazione);

// La stessa decodifica della migrazione, in JavaScript: tre parti, la
// seconda in base64 «da indirizzo», il campo `ref`.
function refDellaChiave(chiave) {
  const parti = String(chiave ?? "").split(".");
  if (parti.length !== 3 || !parti[1]) return null;
  try {
    const json = JSON.parse(Buffer.from(parti[1], "base64url").toString("utf8"));
    return json && typeof json === "object" && !Array.isArray(json) ? (json.ref ?? null) : null;
  } catch {
    return null;
  }
}

describe("la migrazione dell'indirizzo delle funzioni", () => {
  it("ha la versione e il nome giusti, ed è l'unica con quel numero", () => {
    const conQuelNumero = readdirSync(CARTELLA).filter((f) => f.startsWith(`${VERSIONE}_`));
    expect(conQuelNumero).toEqual([`${VERSIONE}_${NOME}.sql`]);
    expect(codice).toContain(REGISTRAZIONE);
  });

  it("🔴 si registra come ULTIMA istruzione, dopo tutte le guardie e la scrittura", () => {
    expect(posRegistrazione).toBeGreaterThan(0);
    expect(codice.slice(posRegistrazione).trim()).toBe(REGISTRAZIONE);
    expect(posRegistrazione).toBeGreaterThan(minuscolo.lastIndexOf("raise exception"));
    expect(posRegistrazione).toBeGreaterThan(minuscolo.lastIndexOf("vault.create_secret"));
  });

  it("🔴 accetta ESCLUSIVAMENTE i due progetti del locale", () => {
    const riferimenti = [...new Set(codice.match(/\b[a-z]{20}\b/g).filter((r) => /^[a-z]{20}$/.test(r)))];
    // Le sole parole di 20 lettere del codice sono i due riferimenti.
    expect(riferimenti.sort()).toEqual([REF_PRODUZIONE, REF_PROVA].sort());
    expect(spazi(passo)).toContain(
      `if v_ref is null or v_ref not in ('${REF_PRODUZIONE}', '${REF_PROVA}') then raise exception`,
    );
  });

  it("🔴 si ferma, prima di scrivere, se la chiave manca, è doppia, non è un JWT o non si legge", () => {
    const creazione = passo.indexOf("vault.create_secret");
    const prima = spazi(passo.slice(0, creazione));
    expect(prima).toContain("where name = 'chiave_anon'; if v_n <> 1 then raise exception");
    expect(prima).toContain("if coalesce(array_length(v_parti, 1), 0) <> 3 or coalesce(v_parti[2], '') = '' then raise exception");
    expect(prima).toMatch(/exception when others then raise exception/);
    expect(prima).toContain("if jsonb_typeof(v_json) is distinct from 'object' then raise exception");
    // Più di una voce, o una voce diversa: stop, prima della creazione.
    expect(prima).toContain("if v_n > 1 then raise exception");
    expect(prima).toContain("is distinct from v_atteso then raise exception");
  });

  it("🔴 non sovrascrive e non cancella niente: il Vault si tocca solo con create_secret", () => {
    for (const vietato of ["update_secret", "delete", "truncate", "on conflict", "update vault", "insert into vault", "drop "]) {
      expect(passo, `«${vietato}» nella parte che tocca il Vault`).not.toContain(vietato);
    }
    expect(passo.match(/vault\.create_secret/g)).toHaveLength(1);
    // La creazione sta nel solo ramo «nessuna voce».
    expect(spazi(passo)).toMatch(/else perform vault\.create_secret\( v_atteso, 'url_funzioni',/);
  });

  it("🔴 confronta il valore normalizzato, prima e dopo la scrittura", () => {
    const norm = /rtrim\(btrim\(coalesce\((v_valore|decrypted_secret), ''\)\), '\/'\)/g;
    const trovati = [...passo.matchAll(norm)].map((m) => m[1]);
    expect(trovati).toEqual(["v_valore", "decrypted_secret"]);
    expect(spazi(passo)).toContain("v_atteso := 'https://' || v_ref || '.supabase.co/functions/v1';");
  });

  it("non crea funzioni, non tocca permessi e non gestisce la transazione da sé", () => {
    for (const vietato of ["create function", "create or replace function", "grant ", "revoke ", "commit", "rollback", "begin transaction", "security definer"]) {
      expect(minuscolo, `«${vietato}»`).not.toContain(vietato);
    }
    // Un solo blocco, applicato in un'unica transazione dagli script.
    expect(argomentiMigrazione("postgres://x", FILE).atomica).toBe(true);
  });

  it("🔴 nessun valore del Vault nei messaggi", () => {
    const messaggi = [...codice.matchAll(/raise\s+(?:exception|notice)\s+'[^']*(?:''[^']*)*'([^;]*);/gi)];
    expect(messaggi.length).toBeGreaterThan(0);
    for (const m of messaggi) {
      // Dopo la frase non deve seguire nessun argomento: niente «%, v_…».
      expect(m[1].trim(), `messaggio con argomenti: ${m[0]}`).toBe("");
    }
  });
});

describe("la chiave finta della prova di ricarica", () => {
  const SCRIPT = readFileSync("scripts/ricostruzione-verifica.mjs", "utf8");
  const chiave = SCRIPT.match(/select vault\.create_secret\('([^']*)', 'chiave_anon',/)?.[1];

  it("è un JWT per forma, e porta il SOLO riferimento di Prova", () => {
    expect(chiave, "non trovo la chiave finta di chiave_anon").toBeTruthy();
    const parti = chiave.split(".");
    expect(parti).toHaveLength(3);
    expect(JSON.parse(Buffer.from(parti[1], "base64url").toString("utf8"))).toEqual({ ref: REF_PROVA });
    expect(refDellaChiave(chiave)).toBe(REF_PROVA);
  });

  it("🔴 non è una chiave vera: nessuna firma, nessun ruolo, niente di produzione", () => {
    const [intestazione, , firma] = chiave.split(".");
    expect(JSON.parse(Buffer.from(intestazione, "base64url").toString("utf8"))).toEqual({ alg: "none", typ: "JWT" });
    expect(firma).toBe("firma-finta-della-prova-di-ricarica");
    expect(chiave).not.toContain(REF_PRODUZIONE);
  });

  it("la stessa decodifica della migrazione riconosce i casi da fermare", () => {
    expect(refDellaChiave("chiave-finta-della-prova-di-ricarica")).toBeNull();
    expect(refDellaChiave("a.b")).toBeNull();
    expect(refDellaChiave("a..c")).toBeNull();
    expect(refDellaChiave(`x.${Buffer.from("[1,2]").toString("base64url")}.y`)).toBeNull();
    expect(refDellaChiave(`x.${Buffer.from("non json").toString("base64url")}.y`)).toBeNull();
  });
});

function spazi(s) {
  return s.replace(/\s+/g, " ").trim();
}
