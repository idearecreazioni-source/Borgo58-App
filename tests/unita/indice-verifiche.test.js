import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { argomentiMigrazione } from "../../scripts/comune.mjs";

// =====================================================================
// LE VERIFICHE NEL REGISTRO, TROVATE DA UN INDICE — 28/09/2026
// =====================================================================
// 🔴 PERCHÉ ESISTE. `lapidi_delle_verifiche()` leggeva tutto il registro
//    delle cancellazioni (102.394 righe su Prova il 28/09) per trovarne
//    zero, e nei controlli GitHub superava il limite di 8 secondi. La cura è
//    un indice PARZIALE col suo stesso predicato, ordinato per la colonna del
//    suo `order by` (migrazione 20260928000001).
//
// ⚠️ UN INDICE PARZIALE SERVE SOLO FINCHÉ PREDICATO E FILTRO COINCIDONO: se
//    uno dei due cambia, il pianificatore torna a leggere tutto il registro
//    SENZA NESSUN ERRORE. Queste prove guardano il testo delle migrazioni;
//    il piano vero lo controlla la verifica dentro la migrazione, quando la
//    si applica.

const CARTELLA = "supabase/migrations";
const FILE = `${CARTELLA}/20260928000001_le_verifiche_trovate_da_un_indice.sql`;
const SQL = readFileSync(FILE, "utf8");
// Il codice, coi commenti tolti — anche quelli a blocco: un setaccio che
// cerca una forma nel testo trova anche chi la nomina per spiegarla (27/08).
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
const codice = senzaCommenti(SQL);
const spazi = (s) => s.replace(/\s+/g, " ").trim();

// Il corpo più recente della funzione, fra tutte le migrazioni che la
// definiscono: è quello che il database ha, finché nessuna la ridefinisce.
// ⚠️ Si cerca nel codice SENZA commenti, senza badare alle maiuscole né a un
//    «public.» davanti, e si prende l'ULTIMA definizione del file più
//    recente, qualunque sia il delimitatore del corpo.
const DEFINIZIONE =
  /create\s+or\s+replace\s+function\s+(?:public\.)?lapidi_delle_verifiche\s*\(\s*\)[\s\S]*?\bas\s+(\$\w*\$)([\s\S]*?)\1/gi;
const ultimaFunzione = () => {
  const corpi = readdirSync(CARTELLA)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .flatMap((f) => [...senzaCommenti(readFileSync(`${CARTELLA}/${f}`, "utf8")).matchAll(DEFINIZIONE)].map((m) => m[2]));
  return spazi(corpi.at(-1) ?? "").toLowerCase();
};

const INDICE = codice.match(
  /create index if not exists idx_deleted_records_verifiche\s+on deleted_records\s*\(([^)]*)\)\s+where ([^;]*);/,
);

describe("l'indice delle verifiche", () => {
  it("c'è, idempotente, sul registro delle cancellazioni", () => {
    expect(INDICE, "manca «create index if not exists idx_deleted_records_verifiche on deleted_records (…) where …»").toBeTruthy();
  });

  it("🔴 il predicato è IDENTICO al filtro della funzione, né più largo né più stretto", () => {
    const filtro = ultimaFunzione().match(/from deleted_records d where d\.(record::text ilike '[^']*') order by/);
    expect(filtro, "non trovo il filtro di lapidi_delle_verifiche").toBeTruthy();
    expect(spazi(INDICE[2])).toBe(filtro[1]);
    expect(filtro[1]).toBe("record::text ilike '%verifica%'");
  });

  it("🔴 ed è ordinato per la stessa colonna dell'order by, e solo quella", () => {
    const ordine = ultimaFunzione().match(/order by d\.(\w+) ?;/);
    expect(ordine, "non trovo l'order by di lapidi_delle_verifiche").toBeTruthy();
    expect(spazi(INDICE[1])).toBe(ordine[1]);
    expect(ordine[1]).toBe("deleted_at");
  });

  it("la verifica della migrazione pretende l'indice nel piano, senza lettura intera né riordino", () => {
    expect(codice).toMatch(/not like '%Index Scan using idx_deleted_records_verifiche on deleted_records%'/);
    expect(codice).toMatch(/v_piano like '%Seq Scan on deleted_records%'/);
    expect(codice).toMatch(/v_piano like '%Sort%'/);
    // e rilegge dal catalogo il predicato e il corpo VIVO della funzione
    expect(codice).toMatch(/pg_get_expr\(i\.indpred, i\.indrelid\)/);
    expect(codice).toMatch(/where p\.oid = 'public\.lapidi_delle_verifiche\(\)'::regprocedure/);
  });

  it("🔴 si applica tutta o niente: npm run migra la esegue in una transazione sola", () => {
    // Un indice creato e una verifica fallita non devono poter lasciare
    // l'indice e la riga del registro senza la verifica.
    const { argomenti, atomica } = argomentiMigrazione("postgres://sconosciuto", FILE);
    expect(atomica).toBe(true);
    expect(argomenti).toContain("--single-transaction");
    expect(argomenti).toEqual(expect.arrayContaining(["-v", "ON_ERROR_STOP=1"]));
  });

  it("si registra con la sua versione", () => {
    expect(codice).toMatch(
      /insert into applied_migrations \(version, name\)\s+values \('20260928000001', 'le_verifiche_trovate_da_un_indice'\) on conflict \(version\) do nothing;/,
    );
  });
});

describe("🔴 e non fa nient'altro", () => {
  it("nessuna pulizia del registro: niente delete, truncate, update, insert, merge o copy su deleted_records", () => {
    expect(codice).not.toMatch(
      /\b(delete\s+from|truncate(\s+table)?|update|insert\s+into|merge\s+into|copy)\s+(only\s+)?(public\.)?deleted_records\b/i,
    );
  });

  it("nessun vacuum o analyze, nessun limite di tempo cambiato", () => {
    expect(codice).not.toMatch(/\bvacuum\b|\banalyze\b|statement_timeout|lock_timeout/i);
  });

  it("nessuna estensione, nessun indice di altro tipo, niente CONCURRENTLY", () => {
    expect(codice).not.toMatch(/create\s+extension|\bgin\b|\bgist\b|pg_trgm|trgm_ops|concurrently/i);
  });

  it("nessuna funzione ridefinita: né lapidi_delle_verifiche né lapidi_di_prova", () => {
    expect(codice).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
    expect(codice).not.toMatch(/alter\s+function|drop\s+function|create\s+policy|alter\s+policy|\bgrant\s|\brevoke\s/i);
  });
});
