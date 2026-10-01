import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  APRI,
  CHIUDI,
  CONSENSI,
  LEGGI_SOLA_LETTURA,
  MISURE,
  MOTIVI,
  NOME_CANALE,
  NON_MISURABILI_DA_QUI,
  eseguiPreflight,
} from "../../scripts/esegui-preflight-produzione.mjs";
import { CAMPI, CONTROLLI, VERSIONI } from "../../scripts/preflight-produzione-sanitizzato.mjs";

// L'ESECUTORE PROTETTO — 01/10/2026, mandati M21-E / M21-E-R.
//
// 🔴 Nessuna di queste prove tocca un database: il client e' sempre finto,
//    e registra cosa gli viene chiesto. Il cavo reale verso psql non viene
//    mai creato.

const SCRIPT = "scripts/esegui-preflight-produzione.mjs";
const SEGRETO = "VALORE-RISERVATO-CHE-NON-DEVE-USCIRE-9876";
const RIF_PROD = "oudjuqbqszisdtwzbxdo";
const RIF_PROVA = "bnwqgpuyzmzujxfbtyvs";
// Un canale finto che indica la produzione e porta dentro un «segreto»:
// serve a dimostrare che non esce mai.
const CANALE = "finto://" + SEGRETO + "@" + RIF_PROD + "/postgres";

const RISPOSTE_BUONE = {
  produzione_ultima_registrata: "20260916000002",
  produzione_versioni_mancanti: VERSIONI.join(","),
  produzione_versioni_estranee: "0",
  chiave_anon_presenti: "1",
  chiave_anon_del_progetto_atteso: "si",
  url_funzioni_presenti: "0",
  url_funzioni_corrisponde: "no",
  guardie_migrazioni_soddisfatte: "si",
  transazioni_lunghe: "0",
  blocchi_incompatibili: "0",
};

/** Un client finto: risponde per interrogazione e registra tutto. */
function clientFinto({ sola = "on", risposte = RISPOSTE_BUONE, guasto = null } = {}) {
  const chiamate = [];
  const stato = { chiuso: false, creatoCon: null };
  const perSql = new Map(MISURE.map((m) => [m.sql, m.campo]));
  const client = {
    async esegui(sql) {
      chiamate.push(sql);
      if (sql === APRI || sql === CHIUDI) return [];
      if (sql === LEGGI_SOLA_LETTURA) return [sola];
      const campo = perSql.get(sql);
      if (guasto && guasto.campo === campo) throw new Error(guasto.messaggio);
      return [risposte[campo]];
    },
    async chiudi() {
      stato.chiuso = true;
    },
  };
  const creaClient = async (canale) => {
    stato.creatoCon = canale;
    return client;
  };
  return { chiamate, stato, creaClient };
}

const ingresso = (f, extra = {}) => ({
  argomenti: [...CONSENSI],
  ambiente: { [NOME_CANALE]: CANALE },
  creaClient: f.creaClient,
  ...extra,
});

describe("i consensi e il canale", () => {
  for (const argomenti of [[], ["--produzione"], ["--confermo-sola-lettura"], [...CONSENSI, "--altro"], ["--produzione", "--produzione"]]) {
    it("rifiuta con argomenti " + JSON.stringify(argomenti) + ", senza creare il client", async () => {
      const f = clientFinto();
      const r = await eseguiPreflight(ingresso(f, { argomenti }));
      expect(r).toEqual({ esito: "NON PRONTO", controlliNonValidi: [], motivo: MOTIVI.CONSENSI });
      expect(f.stato.creatoCon).toBeNull();
      expect(f.chiamate).toEqual([]);
    });
  }

  it("rifiuta se il canale non e' iniettato, senza creare il client", async () => {
    for (const ambiente of [{}, { [NOME_CANALE]: "" }, { [NOME_CANALE]: "   " }, undefined, { ALTRO: CANALE }]) {
      const f = clientFinto();
      const r = await eseguiPreflight(ingresso(f, { ambiente }));
      expect(r.motivo).toBe(MOTIVI.CANALE);
      expect(f.stato.creatoCon).toBeNull();
    }
  });

  it("rifiuta un canale che non indica la produzione, o che indica la prova", async () => {
    for (const canale of ["finto://qualcosa/postgres", "finto://" + RIF_PROD + "+" + RIF_PROVA]) {
      const f = clientFinto();
      const r = await eseguiPreflight(ingresso(f, { ambiente: { [NOME_CANALE]: canale } }));
      expect(r.motivo).toBe(MOTIVI.DESTINAZIONE);
      expect(f.stato.creatoCon).toBeNull();
    }
  });

  it("passa il canale al client cosi' com'e', e a nessun altro", async () => {
    const f = clientFinto();
    await eseguiPreflight(ingresso(f));
    expect(f.stato.creatoCon).toBe(CANALE);
  });
});

describe("la sessione: sola lettura, ricontrollata, chiusa sempre", () => {
  it("apre la sola lettura prima di tutto, e la ricontrolla prima di ogni misura", async () => {
    const f = clientFinto();
    await eseguiPreflight(ingresso(f));
    expect(f.chiamate[0]).toBe(APRI);
    const corpo = f.chiamate.slice(1, -1);
    expect(corpo).toHaveLength(MISURE.length * 2);
    MISURE.forEach((m, i) => {
      expect(corpo[2 * i]).toBe(LEGGI_SOLA_LETTURA);
      expect(corpo[2 * i + 1]).toBe(m.sql);
    });
    expect(f.chiamate.at(-1)).toBe(CHIUDI);
    expect(f.stato.chiuso).toBe(true);
  });

  it("se la transazione non e' in sola lettura si ferma subito, e chiude con rollback", async () => {
    const f = clientFinto({ sola: "off" });
    const r = await eseguiPreflight(ingresso(f));
    expect(r.motivo).toBe(MOTIVI.SOLA_LETTURA);
    expect(r.esito).toBe("NON PRONTO");
    expect(f.chiamate).toEqual([APRI, LEGGI_SOLA_LETTURA, CHIUDI]);
    expect(f.stato.chiuso).toBe(true);
  });

  it("se una misura fallisce: rollback, chiusura, NON PRONTO, e il messaggio non esce", async () => {
    const f = clientFinto({ guasto: { campo: "chiave_anon_presenti", messaggio: SEGRETO } });
    const r = await eseguiPreflight(ingresso(f));
    expect(r.motivo).toBe(MOTIVI.INTERROGAZIONE);
    expect(f.chiamate.at(-1)).toBe(CHIUDI);
    expect(f.stato.chiuso).toBe(true);
    expect(JSON.stringify(r)).not.toContain(SEGRETO);
  });

  it("se il client non si crea: NON PRONTO, e il messaggio non esce", async () => {
    const r = await eseguiPreflight({
      argomenti: [...CONSENSI],
      ambiente: { [NOME_CANALE]: CANALE },
      creaClient: async () => {
        throw new Error(SEGRETO);
      },
    });
    expect(r.motivo).toBe(MOTIVI.INTERROGAZIONE);
    expect(JSON.stringify(r)).not.toContain(SEGRETO);
  });

  it("una risposta di forma inattesa (un valore al posto di un si'/no) ferma tutto e non esce", async () => {
    const f = clientFinto({ risposte: { ...RISPOSTE_BUONE, chiave_anon_del_progetto_atteso: SEGRETO } });
    const r = await eseguiPreflight(ingresso(f));
    expect(r.motivo).toBe(MOTIVI.RISPOSTA);
    expect(f.chiamate.at(-1)).toBe(CHIUDI);
    expect(JSON.stringify(r)).not.toContain(SEGRETO);
  });

  it("anche un conteggio non numerico o una versione storta fermano tutto", async () => {
    for (const storta of [{ transazioni_lunghe: "uno" }, { produzione_ultima_registrata: "2026" }, { produzione_versioni_mancanti: "20260917000001,x" }]) {
      const f = clientFinto({ risposte: { ...RISPOSTE_BUONE, ...storta } });
      expect((await eseguiPreflight(ingresso(f))).motivo).toBe(MOTIVI.RISPOSTA);
    }
  });
});

describe("il risultato e l'integrazione col modulo sanitizzato", () => {
  it("le misure e i campi non misurabili coprono esattamente i 20 campi, coi tipi giusti", () => {
    const tipo = { versione: "versione", versioni: "versioni", conteggio: "conteggio", si_no: "booleano" };
    for (const m of MISURE) expect(CAMPI[m.campo], m.campo).toBe(tipo[m.forma]);
    const tutti = [...MISURE.map((m) => m.campo), ...NON_MISURABILI_DA_QUI].sort();
    expect(tutti).toEqual(Object.keys(CAMPI).sort());
    expect(new Set(tutti).size).toBe(tutti.length);
  });

  it("con le misure buone: NON PRONTO, e non validi esattamente i controlli che da qui non si misurano", async () => {
    const f = clientFinto();
    const r = await eseguiPreflight(ingresso(f));
    expect(r.esito).toBe("NON PRONTO");
    expect(Object.keys(r).sort()).toEqual(["controlliNonValidi", "esito"]);
    const attesi = CONTROLLI.filter((c) => c.campi.some((k) => NON_MISURABILI_DA_QUI.includes(k))).map((c) => c.id);
    expect(r.controlliNonValidi).toEqual(attesi);
    // e i quattro che da qui si misurano tutti sono OK
    for (const id of ["produzione_come_attesa", "chiave_anon", "url_funzioni", "nessun_blocco"]) {
      expect(r.controlliNonValidi).not.toContain(id);
    }
  });

  it("una misura cattiva rende non valido il suo controllo", async () => {
    const f = clientFinto({ risposte: { ...RISPOSTE_BUONE, chiave_anon_presenti: "2" } });
    const r = await eseguiPreflight(ingresso(f));
    expect(r.controlliNonValidi).toContain("chiave_anon");
  });

  it("backup e funzione online non si misurano da qui: restano NON VERIFICATO", () => {
    expect(NON_MISURABILI_DA_QUI).toContain("copia_di_sicurezza_recente");
    expect(NON_MISURABILI_DA_QUI).toContain("funzione_notifiche_installata");
  });

  it("il canale non compare mai nel risultato", async () => {
    const f = clientFinto();
    const r = await eseguiPreflight(ingresso(f));
    expect(JSON.stringify(r)).not.toContain(SEGRETO);
    expect(JSON.stringify(r)).not.toContain(RIF_PROD);
  });
});

describe("le interrogazioni: fisse, di sola lettura, una per volta", () => {
  const tutte = [APRI, LEGGI_SOLA_LETTURA, CHIUDI, ...MISURE.map((m) => m.sql)];

  it("nessuna scrive", () => {
    const vietate = /\b(insert|update|delete|create|alter|drop|grant|revoke|truncate|copy|vacuum|merge|call|comment|reindex|cluster|lock|notify|listen|execute|prepare|do)\b|create_secret|update_secret|nextval|setval|pg_terminate|pg_cancel/i;
    for (const sql of tutte) expect(sql, sql.slice(0, 40)).not.toMatch(vietate);
  });

  it("ognuna e' una sola istruzione", () => {
    for (const sql of tutte) {
      expect(sql.trim().endsWith(";"), sql.slice(0, 40)).toBe(true);
      expect(sql.split(";").length - 1, sql.slice(0, 40)).toBe(1);
    }
  });

  it("la sessione si apre in sola lettura e si chiude con rollback", () => {
    expect(APRI).toBe("begin transaction read only;");
    expect(CHIUDI).toBe("rollback;");
  });

  it("dal Vault escono solo conteggi o si'/no", () => {
    for (const m of MISURE.filter((x) => /vault\./.test(x.sql))) {
      expect(["conteggio", "si_no"], m.campo).toContain(m.forma);
      if (/decrypted_secret/.test(m.sql)) {
        expect(m.forma).toBe("si_no");
        expect(m.sql.startsWith("select case when"), m.campo).toBe(true);
      }
    }
  });

  it("le interrogazioni sono costanti: nel file non c'e' nessun segnaposto", () => {
    expect(readFileSync(SCRIPT, "utf8")).not.toContain("${");
    expect(Object.isFrozen(MISURE)).toBe(true);
  });
});

describe("il file non carica configurazioni e non ha altre strade", () => {
  const sorgente = readFileSync(SCRIPT, "utf8");
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/[^\n]*$/gm, " ");

  it("importa solo il lancio di psql, l'indirizzo del proprio file e il modulo sanitizzato", () => {
    const importazioni = [...codice.matchAll(/^import\s.*from\s+"([^"]+)";/gm)].map((m) => m[1]);
    expect(importazioni).toEqual(["node:child_process", "node:url", "./preflight-produzione-sanitizzato.mjs"]);
    expect(codice).not.toMatch(/\brequire\s*\(/);
    expect(codice).not.toMatch(/\bimport\s*\(/);
  });

  it("niente .env, dotenv, letture o scritture di file", () => {
    // ⚠️ Il FILE .env, nominato in una stringa: `process.env` e' la lettura
    //    ammessa del solo canale, ed e' controllata nella prova sotto.
    for (const vietato of [/dotenv/i, /["'`/\\]\.env/, /\.env["'`]/, /readFile/, /writeFile/, /node:fs/, /\bfs\./, /appendFile/, /createWriteStream/]) {
      expect(codice, String(vietato)).not.toMatch(vietato);
    }
  });

  it("legge una sola variabile d'ambiente, quella del canale", () => {
    const usi = [...codice.matchAll(/process\.env\[?([A-Z_]*)/g)];
    expect(usi.length).toBeGreaterThan(0);
    for (const u of codice.split("\n").filter((r) => r.includes("process.env"))) {
      expect(u).toContain("NOME_CANALE");
    }
    expect(NOME_CANALE).toBe("PREFLIGHT_PRODUZIONE_COLLEGAMENTO");
  });

  it("nessun canale predefinito o di ripiego", () => {
    expect(codice).not.toMatch(/postgres(ql)?:\/\//);
    expect(codice).not.toMatch(/DB_URL/);
    expect(codice).not.toMatch(/\?\?\s*["'](finto|postgres|http)/);
  });

  it("all'esterno scrive solo l'esito sintetico", () => {
    const stampe = codice.split("\n").filter((r) => /console\.|process\.std(out|err)/.test(r));
    expect(stampe).toEqual(["  console.log(JSON.stringify(r));"]);
  });

  it("degli errori del database non lascia passare niente", () => {
    expect(codice).toMatch(/stdio: \["pipe", "pipe", "ignore"\]/);
  });
});
