import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// =====================================================================
// IL LETTORE DEL PREFLIGHT, SENZA CHIAVI — 03/10/2026 (M23-C, M23-C-1)
// =====================================================================
// La migrazione 20261003000001 crea un ruolo. È l'unico posto del
// repository che lo fa, e per questo le sue regole si sorvegliano sul TESTO:
// niente login, niente password, nessun attributo amministrativo, solo la
// lettura di `applied_migrations.version`, una sola regola di riga, e il
// controllo della «scatola vuota» PRIMA di qualunque concessione.
//
// ⚠️ Sono prove sul testo, non sul database. Che il SQL giri, e che ogni
//    ramo si comporti come dice, lo dimostrano soltanto le prove
//    controllate su Prova, che questo mandato NON fa.
//
// ⚠️ OGNI REGOLA SI PROVA ANCHE AL CONTRARIO: `problemi()` deve dare zero
//    sul file vero e almeno un problema su ciascuna rottura. Una regola che
//    non diventa rossa rompendola non sta sorvegliando niente.

const CARTELLA = "supabase/migrations";
const VERSIONE = "20261003000001";
const NOME = "il_lettore_del_preflight_senza_chiavi";
const FILE = `${CARTELLA}/${VERSIONE}_${NOME}.sql`;
const SQL = readFileSync(FILE, "utf8");
const RUOLO = "borgo58_preflight_reader";

// I commenti via; e, per le parole vietate, anche il testo fra apici: un
// messaggio che dice «login attivo» spiega un rifiuto, non concede un login.
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
const senzaStringhe = (t) => t.replace(/'(?:[^']|'')*'/g, "''");
const spazi = (t) => t.replace(/\s+/g, " ").trim();

const REGISTRAZIONE = `insert into applied_migrations (version, name) values ('${VERSIONE}', '${NOME}') on conflict (version) do nothing;`;

/** Le condizioni della scatola vuota: etichetta → forma del controllo. */
const SCATOLA_VUOTA = {
  "login attivo": /case when v_r\.rolcanlogin then 'login attivo' end/,
  "password impostata": /a\.oid = v_oid and a\.rolpassword is not null\) then 'password impostata'/,
  SUPERUSER: /case when v_r\.rolsuper then 'SUPERUSER' end/,
  CREATEDB: /case when v_r\.rolcreatedb then 'CREATEDB' end/,
  CREATEROLE: /case when v_r\.rolcreaterole then 'CREATEROLE' end/,
  REPLICATION: /case when v_r\.rolreplication then 'REPLICATION' end/,
  BYPASSRLS: /case when v_r\.rolbypassrls then 'BYPASSRLS' end/,
  "membro di un altro ruolo": /m\.member = v_oid\) then 'membro di un altro ruolo'/,
  "contiene altri ruoli": /m\.roleid = v_oid\) then 'contiene altri ruoli'/,
  "possiede oggetti": /d\.deptype = 'o'\) then 'possiede oggetti'/,
  "privilegi o regole registrati sul server": /d\.deptype <> 'o'\) then 'privilegi o regole registrati sul server'/,
  "privilegi su un database": /aclexplode\(b\.datacl\) x where x\.grantee = v_oid\) then 'privilegi su un database'/,
  "privilegi su uno schema": /aclexplode\(n\.nspacl\) x where x\.grantee = v_oid\) then 'privilegi su uno schema'/,
  "privilegi su tabelle, viste o sequenze": /aclexplode\(c\.relacl\) x where x\.grantee = v_oid\) then 'privilegi su tabelle, viste o sequenze'/,
  "privilegi su colonne": /aclexplode\(t\.attacl\) x where x\.grantee = v_oid\) then 'privilegi su colonne'/,
  "privilegi su funzioni": /aclexplode\(p\.proacl\) x where x\.grantee = v_oid\) then 'privilegi su funzioni'/,
  "privilegi predefiniti": /d\.defaclrole = v_oid\) or exists \(select 1 from pg_default_acl d, aclexplode\(d\.defaclacl\) x where x\.grantee = v_oid\) then 'privilegi predefiniti'/,
  "regole di riga": /v_oid = any \(p\.polroles\)\) then 'regole di riga'/,
};

/** Le sole tre concessioni ammesse, nella loro forma esatta. */
const CONCESSIONI = [
  `grant usage on schema public to ${RUOLO};`,
  `grant select (version) on table public.applied_migrations to ${RUOLO};`,
  `create policy applied_migrations_select_preflight on public.applied_migrations as permissive for select to ${RUOLO} using (true);`,
];
const CREAZIONE = `create role ${RUOLO} nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls noinherit;`;
const FERMO = "if cardinality(v_motivi) > 0 then raise exception";

/** I problemi di un testo di migrazione: vuoto vuol dire ammesso. */
function problemi(testo) {
  const p = [];
  const codice = spazi(senzaCommenti(testo).toLowerCase());
  const nudo = spazi(senzaStringhe(senzaCommenti(testo)).toLowerCase());
  const codiceOriginale = spazi(senzaCommenti(testo));

  // --- le parole che non devono esserci ---------------------------------
  if (/\bpassword\b/.test(nudo)) p.push("contiene una password");
  if (/\bencrypted\b/.test(nudo)) p.push("contiene una password cifrata");
  if (/(^|[^o])\blogin\b/.test(nudo.replace(/\bnologin\b/g, ""))) p.push("contiene LOGIN");
  if (!/\bnologin\b/.test(nudo)) p.push("manca NOLOGIN");
  for (const a of ["superuser", "createdb", "createrole", "replication", "bypassrls"]) {
    if (new RegExp(`(^|[^o_.a-z])${a}\\b`).test(nudo.replace(new RegExp(`\\bno${a}\\b`, "g"), ""))) {
      p.push(`concede ${a.toUpperCase()}`);
    }
  }
  if (/\bgrant\s+all\b/.test(nudo)) p.push("contiene GRANT ALL");
  if (/\b(to|from)\s+public\b/.test(nudo)) p.push("tocca i privilegi di PUBLIC");
  if (/\brevoke\b/.test(nudo)) p.push("revoca qualcosa");
  if (/\balter\s+(role|user|default\s+privileges)\b/.test(nudo)) p.push("altera un ruolo o i privilegi predefiniti");
  if (/\bcreate\s+user\b/.test(nudo)) p.push("crea un utente");
  if (/\bvault\b/.test(nudo)) p.push("nomina il Vault");

  // --- le concessioni: solo le tre, una volta ciascuna -----------------
  const grant = [...nudo.matchAll(/\bgrant\b[^;]*;/g)].map((m) => m[0]);
  const ammessi = CONCESSIONI.filter((c) => c.startsWith("grant"));
  for (const g of grant) if (!ammessi.includes(g)) p.push("concessione non ammessa: " + g);
  for (const c of CONCESSIONI) {
    const volte = codice.split(c).length - 1;
    if (volte !== 1) p.push(`la concessione prevista compare ${volte} volte`);
  }
  if ((nudo.match(/\bcreate\s+policy\b/g) ?? []).length !== 1) p.push("le regole di riga create non sono esattamente una");
  if ((nudo.match(/\bcreate\s+role\b/g) ?? []).length !== 1) p.push("i ruoli creati non sono esattamente uno");
  if (!codice.includes(CREAZIONE)) p.push("la creazione del ruolo non ha la forma prevista");

  // --- la scatola vuota: tutti i controlli, PRIMA di concedere ---------
  for (const [nome, forma] of Object.entries(SCATOLA_VUOTA)) {
    if (!forma.test(codiceOriginale)) p.push("manca il controllo: " + nome);
  }
  const posFermo = codice.indexOf(FERMO);
  const posPrimaConcessione = Math.min(...CONCESSIONI.map((c) => codice.indexOf(c)).filter((i) => i >= 0));
  if (posFermo < 0) p.push("manca il fermo sulla scatola non vuota");
  else if (!(posFermo < posPrimaConcessione)) p.push("il fermo arriva dopo una concessione");
  if (!codice.includes("has_table_privilege('pg_catalog.pg_authid', 'select')")) {
    p.push("non si ferma quando non può controllare la password");
  }
  // La password si guarda solo per sapere se c'è: mai il suo valore.
  const usiPassword = codice.match(/rolpassword[^,)]*/g) ?? [];
  if (usiPassword.length !== 1 || usiPassword[0].trim() !== "rolpassword is not null") {
    p.push("la password viene letta invece di essere solo controllata");
  }

  // --- registrazione ultima, e la verifica prima -----------------------
  const posReg = codice.lastIndexOf("insert into applied_migrations");
  if (posReg < 0 || codice.slice(posReg).trim() !== REGISTRAZIONE) p.push("la registrazione non è l'ultima istruzione");
  if ((codice.match(/insert into applied_migrations/g) ?? []).length !== 1) p.push("la registrazione non compare una volta sola");
  if (!(codice.indexOf("do $verifica$") > posPrimaConcessione)) p.push("manca la verifica dopo le concessioni");
  return p;
}

describe("la migrazione del lettore del preflight", () => {
  it("ha la versione e il nome giusti, ed è l'unica con quel numero", () => {
    const conQuelNumero = readdirSync(CARTELLA).filter((f) => f.startsWith(`${VERSIONE}_`));
    expect(conQuelNumero).toEqual([`${VERSIONE}_${NOME}.sql`]);
  });

  it("il file vero non ha nessun problema", () => {
    expect(problemi(SQL)).toEqual([]);
  });

  it("le tre misure del preflight restano le sole coperte: un solo oggetto, una sola colonna", () => {
    const nudo = spazi(senzaStringhe(senzaCommenti(SQL)).toLowerCase());
    const grant = [...nudo.matchAll(/\bgrant\b[^;]*;/g)].map((m) => m[0]);
    expect(grant).toEqual(CONCESSIONI.filter((c) => c.startsWith("grant")));
    // Nessun'altra tabella dell'app nominata in una concessione o in una regola.
    for (const g of grant.concat(nudo.match(/create policy[^;]*;/g) ?? [])) {
      expect(g).toMatch(/schema public|public\.applied_migrations/);
    }
    // La concessione di colonna è la sola `version`, non la tabella intera.
    expect(nudo).not.toMatch(/grant select on (table )?public\.applied_migrations/);
  });

  it("non è dentro il contratto delle 17 migrazioni del rilascio", async () => {
    const { VERSIONI_DA_REGISTRARE } = await import("../../scripts/contratto-preflight-rilascio.mjs");
    expect(VERSIONI_DA_REGISTRARE).not.toContain(VERSIONE);
  });
});

// ---------------------------------------------------------------------
// Le rotture: ognuna deve far diventare rossa almeno una regola.
// ---------------------------------------------------------------------
const sostituisci = (da, a) => {
  if (!SQL.includes(da)) throw new Error("rottura non applicabile: " + da.slice(0, 60));
  const rotto = SQL.replace(da, a);
  if (rotto === SQL) throw new Error("rottura non applicata");
  return rotto;
};
const GRANT_COLONNA = `grant select (version) on table public.applied_migrations to ${RUOLO};`;
const CREA = "nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls noinherit;";

const ROTTURE = {
  "login al posto di nologin": () => sostituisci(CREA, CREA.replace("nologin", "login")),
  "login aggiunto in fondo": () => sostituisci(CREA, CREA.replace(";", " login;")),
  "una password": () => sostituisci(CREA, CREA.replace(";", " password 'x';")),
  "una password cifrata": () => sostituisci(CREA, CREA.replace(";", " encrypted password 'x';")),
  BYPASSRLS: () => sostituisci(CREA, CREA.replace("nobypassrls", "bypassrls")),
  SUPERUSER: () => sostituisci(CREA, CREA.replace("nosuperuser", "superuser")),
  CREATEROLE: () => sostituisci(CREA, CREA.replace("nocreaterole", "createrole")),
  "GRANT ALL": () => sostituisci(GRANT_COLONNA, `grant all on table public.applied_migrations to ${RUOLO};`),
  "tutta la tabella invece della colonna": () =>
    sostituisci(GRANT_COLONNA, `grant select on table public.applied_migrations to ${RUOLO};`),
  "una colonna in più": () =>
    sostituisci(GRANT_COLONNA, `grant select (version, name) on table public.applied_migrations to ${RUOLO};`),
  "una scrittura": () => sostituisci(GRANT_COLONNA, GRANT_COLONNA + `\n  grant insert on table public.applied_migrations to ${RUOLO};`),
  "una funzione": () => sostituisci(GRANT_COLONNA, GRANT_COLONNA + `\n  grant execute on function public.is_titolare() to ${RUOLO};`),
  "un'appartenenza": () => sostituisci(GRANT_COLONNA, GRANT_COLONNA + `\n  grant authenticated to ${RUOLO};`),
  "una modifica a PUBLIC": () => sostituisci(GRANT_COLONNA, GRANT_COLONNA + "\n  revoke usage on schema public from public;"),
  "una concessione a PUBLIC": () => sostituisci(GRANT_COLONNA, GRANT_COLONNA + "\n  grant usage on schema public to public;"),
  "una seconda regola di riga": () =>
    sostituisci(GRANT_COLONNA, GRANT_COLONNA + `\n  create policy altra on public.tasks for select to ${RUOLO} using (true);`),
  "la regola per authenticated": () =>
    sostituisci(`for select to ${RUOLO} using (true);`, "for select to authenticated using (true);"),
  "il fermo tolto": () => sostituisci("if cardinality(v_motivi) > 0 then", "if false then"),
  "la password letta invece che controllata": () =>
    sostituisci("a.rolpassword is not null", "a.rolpassword = 'x'"),
  "nessun fermo quando la password non si può controllare": () =>
    sostituisci("if not has_table_privilege('pg_catalog.pg_authid', 'select') then", "if false then"),
  "le concessioni prima del controllo": () => {
    const blocco = [
      "  grant usage on schema public to borgo58_preflight_reader;",
      GRANT_COLONNA,
    ];
    let t = SQL;
    for (const b of blocco) t = t.replace(b.trim(), "");
    return t.replace("  if v_oid is not null then\n", "  " + blocco.map((b) => b.trim()).join("\n  ") + "\n  if v_oid is not null then\n");
  },
  "la registrazione prima della verifica": () =>
    sostituisci("do $verifica$", REGISTRAZIONE + "\ndo $verifica$"),
};
// Ogni controllo della scatola vuota, tolto uno per volta.
for (const nome of Object.keys(SCATOLA_VUOTA)) {
  ROTTURE[`controllo tolto: ${nome}`] = () => {
    const forma = SCATOLA_VUOTA[nome];
    const m = SQL.replace(/\s+/g, " ").match(forma);
    if (!m) throw new Error("forma non trovata: " + nome);
    // Si toglie l'etichetta dal testo vero: il controllo resta muto.
    return sostituisci(`'${nome}'`, "'x'");
  };
}

describe("ogni rottura viene presa", () => {
  for (const [nome, rompi] of Object.entries(ROTTURE)) {
    it(`rottura: ${nome}`, () => {
      const rotto = rompi();
      expect(rotto).not.toBe(SQL);
      expect(problemi(rotto).length, nome).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------
// I rami della scatola vuota, letti come decisione: assente o vuoto →
// ammesso; ogni motivo → rifiutato prima di concedere.
// ---------------------------------------------------------------------
describe("i rami del ruolo già esistente", () => {
  const codice = spazi(senzaCommenti(SQL));
  const lettore = codice.slice(codice.indexOf("do $lettore$"), codice.indexOf("end $lettore$"));

  it("ruolo assente: lo crea, e solo nel ramo in cui non esiste", () => {
    const posElse = lettore.lastIndexOf("else create role");
    expect(posElse).toBeGreaterThan(0);
    expect(lettore.slice(posElse)).toContain(CREAZIONE.replace(/;$/, ""));
  });

  it("ruolo esistente e vuoto: nessun motivo → si prosegue con le sole tre concessioni", () => {
    expect(lettore).toContain("v_motivi := array_remove(array[");
    expect(lettore).toMatch(/if cardinality\(v_motivi\) > 0 then raise exception/);
    // Dopo il fermo, nel blocco, ci sono soltanto le tre concessioni.
    const dopo = lettore.slice(lettore.indexOf("end if; grant"));
    const istruzioni = [...dopo.matchAll(/\b(grant|create policy|revoke|alter|drop)\b/gi)].map((m) => m[1].toLowerCase());
    expect(istruzioni).toEqual(["grant", "grant", "create policy"]);
  });

  it("ogni motivo di rifiuto è controllato prima di qualunque concessione", () => {
    const posPrimoGrant = lettore.indexOf("grant usage");
    for (const nome of Object.keys(SCATOLA_VUOTA)) {
      const pos = lettore.indexOf(`'${nome}'`);
      expect(pos, nome).toBeGreaterThan(0);
      expect(pos, nome).toBeLessThan(posPrimoGrant);
    }
  });

  it("il rifiuto non concede niente: fra il controllo e il fermo non c'è nessuna concessione", () => {
    const inizio = lettore.indexOf("if v_oid is not null then if not has_table_privilege");
    const fermo = lettore.indexOf("if cardinality(v_motivi) > 0 then");
    expect(inizio).toBeGreaterThan(0);
    expect(lettore.slice(inizio, fermo)).not.toMatch(/\b(grant|revoke|create policy|alter|drop)\b/i);
  });

  it("il rilancio dello stesso file non concede, non revoca e non modifica: esce prima", () => {
    const rilancio = lettore.match(/if v_oid is not null and v_registrata then (.*?) end if;/);
    expect(rilancio).not.toBeNull();
    expect(rilancio[1]).toMatch(/\breturn;/);
    expect(rilancio[1]).not.toMatch(/\b(grant|revoke|create|alter|drop)\b/i);
  });
});
