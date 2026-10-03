import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import {
  CONDIZIONI_DI_ARRESTO,
  CONDIZIONI_OPERATIVE,
  CONDIZIONI_PER_PARTIRE,
  CONTROLLI_OBBLIGATORI,
  ESCLUSA,
  FASI,
  FUNZIONI_CHE_LO_PERDONO,
  ULTIMA_IN_PRODUZIONE,
  VERSIONI_DA_REGISTRARE,
  problemiDeiControlli,
  problemiDelPiano,
} from "../../scripts/contratto-preflight-rilascio.mjs";

// IL CONTRATTO DI PREFLIGHT — 01/10/2026, mandato M21-C.
//
// 🔴 Il piano vive in due posti (il documento e lo script) e il rilascio
//    guarda un terzo (la cartella delle migrazioni). Queste prove li tengono
//    d'accordo: se uno dei tre cambia da solo, diventano rosse.

const SCRIPT = "scripts/contratto-preflight-rilascio.mjs";
const DOCUMENTO = "docs/consegne/20261001_contratto_preflight_rilascio_17_migrazioni.md";
const CARTELLA = "supabase/migrations";

const ATTESE = [
  "20260917000001", "20260919000001", "20260920000001", "20260920000002",
  "20260920000003", "20260920000004", "20260920000005", "20260921000001",
  "20260921000002", "20260921000003", "20260922000001", "20260923000001",
  "20260923000002", "20260923000003", "20260923000004", "20260928000001",
  "20260929000001",
];

const versioniSulDisco = () =>
  readdirSync(CARTELLA)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.slice(0, f.indexOf("_")));

describe("le 17 versioni", () => {
  it("sono esattamente queste, senza doppioni", () => {
    expect([...VERSIONI_DA_REGISTRARE]).toEqual(ATTESE);
    expect(new Set(VERSIONI_DA_REGISTRARE).size).toBe(17);
  });

  it("esistono ciascuna come un solo file nella cartella delle migrazioni", () => {
    const disco = versioniSulDisco();
    for (const v of ATTESE) expect(disco.filter((d) => d === v), v).toHaveLength(1);
  });

  it("e sono TUTTE quelle fra l'ultima in produzione e la 20260929000001", () => {
    // ⚠️ La finestra, non «tutto quello che viene dopo»: una migrazione
    //    scritta domani non deve far diventare rosso questo contratto, ma una
    //    dimenticata in mezzo si'.
    const finestra = versioniSulDisco()
      .filter((v) => v > ULTIMA_IN_PRODUZIONE && v <= "20260929000001")
      .sort();
    expect(finestra).toEqual(ATTESE);
    expect(versioniSulDisco()).toContain(ULTIMA_IN_PRODUZIONE);
  });
});

describe("le due fasi", () => {
  it("sono due, in quest'ordine", () => {
    expect(FASI.map((f) => f.nome)).toEqual(["primo giro", "secondo giro"]);
  });

  it("il primo giro e' la 20260929000001, da sola", () => {
    expect([...FASI[0].versioni]).toEqual(["20260929000001"]);
  });

  it("il secondo giro sono le 15 applicabili, in ordine di numero", () => {
    const attese = ATTESE.filter((v) => v !== "20260929000001" && v !== "20260921000001");
    expect(attese).toHaveLength(15);
    expect([...FASI[1].versioni]).toEqual(attese);
  });

  it("nessuna versione sta in due fasi", () => {
    const tutte = FASI.flatMap((f) => f.versioni);
    expect(new Set(tutte).size).toBe(tutte.length);
  });

  it("la 20260921000001 non e' applicata direttamente, e la registra la 20260921000002", () => {
    expect(ESCLUSA).toEqual({ versione: "20260921000001", registrataDa: "20260921000002" });
    expect(FASI.flatMap((f) => f.versioni)).not.toContain("20260921000001");
    expect(FASI[1].versioni).toContain("20260921000002");
  });

  it("la registrazione della 20260921000001 sta davvero nella 20260921000002, dopo la sua verifica", () => {
    const file = readdirSync(CARTELLA).find((f) => f.startsWith("20260921000002_"));
    const testo = readFileSync(`${CARTELLA}/${file}`, "utf8").replace(/--[^\n]*/g, "");
    const registra = testo.search(/values\s*\('20260921000001'/);
    const verifica = testo.search(/end\s+\$verifica\$/);
    expect(registra).toBeGreaterThan(-1);
    expect(verifica).toBeGreaterThan(-1);
    expect(registra).toBeGreaterThan(verifica);
  });

  it("ci sono condizioni per partire e condizioni di arresto", () => {
    expect(CONDIZIONI_PER_PARTIRE.length).toBeGreaterThan(0);
    expect(CONDIZIONI_DI_ARRESTO.length).toBeGreaterThan(0);
    expect(CONDIZIONI_PER_PARTIRE.join(" ")).toMatch(/master/);
    expect(CONDIZIONI_PER_PARTIRE.join(" ")).toMatch(/copia di sicurezza/);
    expect(CONDIZIONI_PER_PARTIRE.join(" ")).toMatch(/mandato/);
    expect(CONDIZIONI_DI_ARRESTO.join(" ")).toMatch(/il secondo non parte/);
  });
});

describe("il controllo di coerenza del piano", () => {
  it("sul piano vero non trova problemi", () => {
    expect(problemiDelPiano()).toEqual([]);
  });

  // ⚠️ Le prove al contrario: un controllo che risponde «nessun problema»
  //    al primo colpo non ha ancora detto niente.
  it("vede la 20260921000001 messa in una fase", () => {
    const fasi = [FASI[0], { ...FASI[1], versioni: [...FASI[1].versioni, "20260921000001"].sort() }];
    expect(problemiDelPiano(fasi).join(" ")).toMatch(/non deve essere applicata/);
  });

  it("vede una versione in due fasi", () => {
    const fasi = [{ ...FASI[0], versioni: ["20260917000001", "20260929000001"] }, FASI[1]];
    expect(problemiDelPiano(fasi).join(" ")).toMatch(/in due fasi/);
  });

  it("vede una versione dimenticata", () => {
    const fasi = [FASI[0], { ...FASI[1], versioni: FASI[1].versioni.filter((v) => v !== "20260928000001") }];
    expect(problemiDelPiano(fasi).join(" ")).toMatch(/non registrate a fine rilascio: 20260928000001/);
  });

  it("vede la sanatrice tolta", () => {
    const fasi = [FASI[0], { ...FASI[1], versioni: FASI[1].versioni.filter((v) => v !== "20260921000002") }];
    expect(problemiDelPiano(fasi).join(" ")).toMatch(/manca la 20260921000002/);
  });

  it("vede un giro fuori ordine", () => {
    const rovesciato = [...FASI[1].versioni].reverse();
    expect(problemiDelPiano([FASI[0], { ...FASI[1], versioni: rovesciato }]).join(" ")).toMatch(/ordine di numero/);
  });
});

// =====================================================================
// I QUATTRO CONTROLLI OBBLIGATORI — 03/10/2026, mandato M24-B
// =====================================================================
// L'audit M24-A li ha trovati nei sorgenti delle migrazioni. Queste prove
// tengono fermo che il contratto li RICHIEDA tutti: toglierne uno, renderlo
// facoltativo o legarlo a una migrazione sbagliata le fa diventare rosse.
const PIANO = "docs/consegne/20260928_piano_pre-produzione_16_migrazioni.md";
const sqlDi = (versione) => {
  const file = readdirSync(CARTELLA).find((f) => f.startsWith(`${versione}_`));
  return readFileSync(`${CARTELLA}/${file}`, "utf8");
};
const righe = (testo, da, a) => testo.split("\n").slice(da - 1, a).join("\n");
const ATTESI = {
  funzioni_che_nominano_la_produzione: ["20260920000001"],
  vincoli_senza_frase: ["20260923000004"],
  soggetti_e_utenti_presenti: ["20260919000001", "20260921000003", "20260923000003"],
  modulo_di_rete_con_tempo_massimo: ["20260920000002"],
};

describe("i quattro controlli obbligatori", () => {
  it("sono esattamente quattro, tutti obbligatori, ciascuno prima delle migrazioni giuste", () => {
    expect(CONTROLLI_OBBLIGATORI.map((c) => c.id)).toEqual(Object.keys(ATTESI));
    for (const c of CONTROLLI_OBBLIGATORI) {
      expect(c.obbligatorio, c.id).toBe(true);
      expect([...c.prima], c.id).toEqual(ATTESI[c.id]);
      expect(Object.isFrozen(c), c.id).toBe(true);
    }
    expect(problemiDeiControlli()).toEqual([]);
  });

  it("le condizioni per partire e di arresto li pretendono", () => {
    expect(CONDIZIONI_PER_PARTIRE.join(" ")).toMatch(/i quattro controlli obbligatori in sola lettura risultano verdi/);
    expect(CONDIZIONI_DI_ARRESTO.join(" ")).toMatch(/un controllo obbligatorio non e' verde, o non e' stato misurato/);
  });

  // ⚠️ Le prove al contrario: rendere facoltativo, togliere o spostare un
  //    controllo deve far trovare un problema.
  it("vede un controllo tolto", () => {
    for (const id of Object.keys(ATTESI)) {
      const senza = CONTROLLI_OBBLIGATORI.filter((c) => c.id !== id);
      expect(problemiDeiControlli(senza).join(" "), id).toMatch(new RegExp(`manca il controllo ${id}`));
    }
  });

  it("vede un controllo reso facoltativo", () => {
    for (const c of CONTROLLI_OBBLIGATORI) {
      const altri = CONTROLLI_OBBLIGATORI.map((x) => (x.id === c.id ? { ...x, obbligatorio: false } : x));
      expect(problemiDeiControlli(altri).join(" "), c.id).toMatch(/non e' obbligatorio/);
    }
  });

  it("vede un controllo legato a nessuna migrazione, a una estranea o all'esclusa", () => {
    const con = (prima) => CONTROLLI_OBBLIGATORI.map((x, i) => (i === 0 ? { ...x, prima } : x));
    expect(problemiDeiControlli(con([])).join(" ")).toMatch(/non dice prima di quali migrazioni/);
    expect(problemiDeiControlli(con(["20990101000001"])).join(" ")).toMatch(/non e' nel contratto/);
    expect(problemiDeiControlli(con(["20260921000001"])).join(" ")).toMatch(/non si applica mai/);
  });

  it("vede un valore o un'interrogazione dentro un controllo", () => {
    for (const intruso of ["select count(*) from pg_proc", "SELECT 1", "https://esempio", "ey" + "Jabc", "abcdefghijabcdefghij", "x; y"]) {
      const altri = CONTROLLI_OBBLIGATORI.map((x, i) => (i === 1 ? { ...x, richiede: intruso } : x));
      expect(problemiDeiControlli(altri).join(" "), intruso).toMatch(/contiene un valore o un'interrogazione/);
    }
  });

  it("le righe citate dicono davvero quello che il controllo afferma", () => {
    expect(righe(sqlDi("20260920000001"), 377, 383)).toMatch(/pg_get_functiondef\(p\.oid\) like/);
    expect(righe(sqlDi("20260920000001"), 377, 383)).toMatch(/raise exception/);
    expect(righe(sqlDi("20260923000004"), 172, 176)).toMatch(/from vincoli_senza_frase\(\)/);
    expect(righe(sqlDi("20260919000001"), 185, 189)).toMatch(/role = 'staff'/);
    expect(righe(sqlDi("20260921000003"), 601, 607)).toMatch(/entity_type = 'tasca'/);
    expect(righe(sqlDi("20260923000003"), 490, 502)).toMatch(/entity_type = 'azienda_agricola'/);
    expect(righe(sqlDi("20260920000002"), 135, 135)).toMatch(/timeout_milliseconds/);
    expect(righe(sqlDi("20260920000002"), 274, 274)).toMatch(/timeout_milliseconds/);
  });

  it("le sei funzioni ammesse sono proprio quelle che la 20260917000001 e la 20260920000001 riscrivono", () => {
    const definite = (v) =>
      [...sqlDi(v).matchAll(/create\s+or\s+replace\s+function\s+(?:public\.)?([a-z_0-9]+)/gi)].map((m) => m[1]);
    const riscritte = new Set([...definite("20260917000001"), ...definite("20260920000001")]);
    for (const f of FUNZIONI_CHE_LO_PERDONO) expect(riscritte.has(f), f).toBe(true);
    expect([...FUNZIONI_CHE_LO_PERDONO].sort()).toEqual([...FUNZIONI_CHE_LO_PERDONO]);
    expect(FUNZIONI_CHE_LO_PERDONO).toHaveLength(6);
  });
});

describe("le condizioni operative", () => {
  const ATTESE_OPERATIVE = [
    "esclusa_resta_esclusa",
    "finestra_della_vista_dei_costi",
    "nessun_tempo_massimo_sui_blocchi",
    "storico_dei_costi_riga_per_riga",
    "righe_temporanee_nell_agenda",
  ];

  it("sono le cinque dimostrate dall'audit", () => {
    expect(CONDIZIONI_OPERATIVE.map((c) => c.id)).toEqual(ATTESE_OPERATIVE);
  });

  it("la vista perde la protezione nella 20260922000001 e la riprende nella 20260923000001", () => {
    expect(sqlDi("20260922000001")).toMatch(/create or replace view v_recipe_row_costs as/);
    expect(sqlDi("20260923000001")).toMatch(/alter view v_recipe_row_costs set \(security_invoker = true\)/);
  });

  it("lo strumento di rilascio non imposta un tempo massimo sui blocchi", () => {
    for (const f of ["scripts/migra.mjs", "scripts/comune.mjs"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/lock_timeout/);
    }
  });

  it("il piano le dichiara tutte, coi quattro controlli e l'esclusa", () => {
    const piano = readFileSync(PIANO, "utf8");
    const sezione = piano.slice(piano.indexOf("## Controlli obbligatori e condizioni operative"));
    expect(sezione.length).toBeGreaterThan(100);
    for (const id of [...Object.keys(ATTESI), ...ATTESE_OPERATIVE]) expect(sezione, id).toContain(`\`${id}\``);
    expect(sezione).toMatch(/NON SONO STATI ESEGUITI/);
    expect(sezione).toContain("--salta 20260921000001");
    expect(piano).not.toMatch(/https?:\/\//);
    expect(piano).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });
});

describe("il documento e lo script dicono la stessa cosa", () => {
  const documento = readFileSync(DOCUMENTO, "utf8");

  it("il documento nomina tutte e 17 le versioni per intero", () => {
    for (const v of ATTESE) expect(documento, v).toContain(v);
  });

  it("e l'elenco del secondo giro nel documento e' quello dello script, nello stesso ordine", () => {
    const sezione = documento.slice(documento.indexOf("**Secondo giro"), documento.indexOf("**La `20260921000001`"));
    const elenco = [...sezione.matchAll(/^\d+\.\s+`(\d{14})`/gm)].map((m) => m[1]);
    expect(elenco).toEqual([...FASI[1].versioni]);
  });

  it("il documento dichiara di non essere un'autorizzazione", () => {
    expect(documento).toMatch(/NON è un'autorizzazione a rilasciare/);
  });

  it("il documento non contiene indirizzi ne' riferimenti di progetto", () => {
    expect(documento).not.toMatch(/https?:\/\//);
    expect(documento).not.toMatch(/supabase\.co/);
    expect(documento).not.toMatch(/\b[a-z]{20}\b/); // la forma dei riferimenti di progetto
    expect(documento).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
  });
});

describe("lo script e' solo dati e funzioni pure", () => {
  const sorgente = readFileSync(SCRIPT, "utf8");
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/[^\n]*$/gm, " ");

  it("non importa niente", () => {
    expect(codice).not.toMatch(/\bimport\b/);
    expect(codice).not.toMatch(/\brequire\s*\(/);
  });

  it("non ha accessi a rete, ambiente, database o disco", () => {
    for (const vietato of [
      /process\./, /\bfetch\s*\(/, /node:/, /child_process/, /\bspawn/, /\bexec/,
      /writeFile/, /readFile/, /\bfs\b/, /\.env\b/, /psql/, /postgres/i, /\bhttps?:/,
    ]) {
      expect(codice, String(vietato)).not.toMatch(vietato);
    }
  });

  it("non nomina token, indirizzi, Vault o segreti, nemmeno nei commenti", () => {
    for (const vietato of [/token/i, /\burl/i, /vault/i, /segret/i, /secret/i, /supabase\.co/, /eyJ/]) {
      expect(sorgente, String(vietato)).not.toMatch(vietato);
    }
  });
});
