import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CONSENSI,
  MISURE_CONSENTITE,
  MOTIVI,
  eseguiPreflight,
} from "../../scripts/esegui-preflight-produzione.mjs";
import {
  CAMPI,
  CONTROLLI,
  ESCLUSA,
  PRIMO_GIRO,
  SECONDO_GIRO,
  ULTIMA_IN_PRODUZIONE,
  VERSIONI,
} from "../../scripts/preflight-produzione-sanitizzato.mjs";
import * as contratto from "../../scripts/contratto-preflight-rilascio.mjs";

// L'ORCHESTRATORE DEL PREFLIGHT — 01/10/2026, mandato M21-F.
//
// 🔴 Nessuna di queste prove tocca un database: l'adattatore e' sempre
//    finto, registra cosa gli viene chiesto e risponde come gli si dice.

const SCRIPT = "scripts/esegui-preflight-produzione.mjs";
const RISERVATO = "VALORE-RISERVATO-CHE-NON-DEVE-USCIRE-9876";

/** Tutte e 20 le risposte giuste, come le darebbe un adattatore protetto. */
const RISPOSTE_BUONE = Object.freeze({
  master_versioni_presenti: [...VERSIONI],
  prova_versioni_registrate: [...VERSIONI],
  produzione_ultima_registrata: ULTIMA_IN_PRODUZIONE,
  produzione_versioni_mancanti: [...VERSIONI],
  produzione_versioni_estranee: 0,
  copia_di_sicurezza_recente: true,
  chiave_anon_presenti: 1,
  chiave_anon_del_progetto_atteso: true,
  url_funzioni_presenti: 0,
  url_funzioni_corrisponde: false,
  funzione_notifiche_installata: true,
  guardie_migrazioni_soddisfatte: true,
  corpi_vivi_confermati: true,
  dati_compatibili: true,
  transazioni_lunghe: 0,
  blocchi_incompatibili: 0,
  primo_giro_versioni: [...PRIMO_GIRO],
  secondo_giro_versioni: [...SECONDO_GIRO],
  versioni_escluse: [ESCLUSA.versione],
  esclusa_registrata_da: ESCLUSA.registrataDa,
});

/** Un adattatore finto: registra le richieste, risponde da una tabella. */
function adattatoreFinto(risposte = RISPOSTE_BUONE, { guasto = null } = {}) {
  const richieste = [];
  const stato = { chiuso: false };
  const adattatore = {
    async misura(...argomenti) {
      richieste.push(argomenti);
      const [nome] = argomenti;
      if (guasto === nome) throw new Error(RISERVATO);
      return Object.hasOwn(risposte, nome) ? risposte[nome] : null;
    },
    async chiudi() {
      stato.chiuso = true;
    },
  };
  return { adattatore, richieste, stato };
}

const lancia = (a, extra = {}) => eseguiPreflight({ consensi: [...CONSENSI], adattatore: a.adattatore, ...extra });

describe("i consensi e l'adattatore", () => {
  for (const consensi of [undefined, [], ["--produzione"], ["--confermo-sola-lettura"], [...CONSENSI, "--altro"], ["--produzione", "--produzione"]]) {
    it("rifiuta con consensi " + JSON.stringify(consensi) + ", senza chiedere niente", async () => {
      const a = adattatoreFinto();
      const r = await lancia(a, { consensi });
      expect(r).toEqual({ esito: "NON PRONTO", controlliNonValidi: [], motivo: MOTIVI.CONSENSI });
      expect(a.richieste).toEqual([]);
    });
  }

  it("rifiuta un adattatore mancante o senza la funzione di misura", async () => {
    for (const adattatore of [undefined, null, "un collegamento", 42, {}, { misura: "no" }]) {
      const r = await eseguiPreflight({ consensi: [...CONSENSI], adattatore });
      expect(r.motivo).toBe(MOTIVI.ADATTATORE);
    }
  });
});

describe("cosa riceve l'adattatore", () => {
  it("solo il nome di una misura consentita, uno per volta, e nient'altro", async () => {
    const a = adattatoreFinto();
    await lancia(a);
    expect(a.richieste).toEqual(MISURE_CONSENTITE.map((n) => [n]));
    for (const [nome] of a.richieste) expect(typeof nome).toBe("string");
  });

  it("le misure consentite sono esattamente i 20 campi del modulo che decide", () => {
    expect([...MISURE_CONSENTITE].sort()).toEqual(Object.keys(CAMPI).sort());
    expect(MISURE_CONSENTITE).toHaveLength(20);
    expect(Object.isFrozen(MISURE_CONSENTITE)).toBe(true);
  });

  it("viene chiuso sempre, anche quando una misura fallisce", async () => {
    const a = adattatoreFinto(RISPOSTE_BUONE, { guasto: "chiave_anon_presenti" });
    const r = await lancia(a);
    expect(r.motivo).toBe(MOTIVI.MISURA);
    expect(a.stato.chiuso).toBe(true);
  });
});

describe("cosa puo' restituire l'adattatore", () => {
  const casi = [
    ["testo libero al posto di un si'/no", { copia_di_sicurezza_recente: RISERVATO }],
    ["la stringa «true»", { funzione_notifiche_installata: "true" }],
    ["un collegamento al posto di un conteggio", { transazioni_lunghe: "finto://" + RISERVATO }],
    ["un conteggio negativo", { blocchi_incompatibili: -1 }],
    ["un conteggio non intero", { chiave_anon_presenti: 1.5 }],
    ["un conteggio non finito", { transazioni_lunghe: Number.POSITIVE_INFINITY }],
    ["una versione storta", { produzione_ultima_registrata: RISERVATO }],
    ["una versione numerica invece che di testo", { esclusa_registrata_da: 20260921000002 }],
    ["un elenco con un valore riservato", { primo_giro_versioni: ["20260929000001", RISERVATO] }],
    ["un oggetto al posto di un si'/no", { dati_compatibili: { valore: RISERVATO } }],
    ["un elenco con una proprieta' in piu'", { versioni_escluse: Object.assign(["20260921000001"], { nota: RISERVATO }) }],
    ["undefined", { corpi_vivi_confermati: undefined }],
  ];
  for (const [nome, sbagliata] of casi) {
    it("rifiuta " + nome + ", si ferma, chiude, e non ripete il valore", async () => {
      const a = adattatoreFinto({ ...RISPOSTE_BUONE, ...sbagliata });
      const r = await lancia(a);
      expect(r).toEqual({ esito: "NON PRONTO", controlliNonValidi: [], motivo: MOTIVI.RISPOSTA });
      expect(JSON.stringify(r)).not.toContain(RISERVATO);
      expect(a.stato.chiuso).toBe(true);
    });
  }

  it("l'errore di una misura non esce", async () => {
    const a = adattatoreFinto(RISPOSTE_BUONE, { guasto: "url_funzioni_presenti" });
    const r = await lancia(a);
    expect(JSON.stringify(r)).not.toContain(RISERVATO);
  });

  it("null vuol dire «non ottenuta»: e' accettato e diventa NON VERIFICATO", async () => {
    const a = adattatoreFinto({ ...RISPOSTE_BUONE, copia_di_sicurezza_recente: null });
    const r = await lancia(a);
    expect(r.motivo).toBeUndefined();
    expect(r.esito).toBe("NON PRONTO");
    expect(r.controlliNonValidi).toEqual(["copia_di_sicurezza"]);
  });
});

describe("il passaggio al modulo che decide", () => {
  it("tutte le risposte giuste → PRONTO, e il risultato e' solo esito e controlli", async () => {
    const r = await lancia(adattatoreFinto());
    expect(r).toEqual({ esito: "PRONTO", controlliNonValidi: [] });
  });

  it("un risultato incompleto → NON PRONTO, coi soli controlli scoperti", async () => {
    const parziale = { ...RISPOSTE_BUONE };
    delete parziale.master_versioni_presenti;
    delete parziale.funzione_notifiche_installata;
    const r = await lancia(adattatoreFinto(parziale));
    expect(r.esito).toBe("NON PRONTO");
    expect(r.controlliNonValidi).toEqual(["master_contiene_le_17", "funzione_online"]);
  });

  it("un adattatore che non ottiene niente → tutti i controlli non validi", async () => {
    const r = await lancia(adattatoreFinto({}));
    expect(r.esito).toBe("NON PRONTO");
    expect(r.controlliNonValidi).toEqual(CONTROLLI.map((c) => c.id));
  });

  it("una risposta ammessa ma sbagliata rende non valido il suo controllo", async () => {
    const r = await lancia(adattatoreFinto({ ...RISPOSTE_BUONE, chiave_anon_presenti: 2 }));
    expect(r).toEqual({ esito: "NON PRONTO", controlliNonValidi: ["chiave_anon"] });
  });

});

describe("il contratto delle 17 migrazioni non cambia", () => {
  it("versioni, giri, esclusa e ultima in produzione sono quelli del contratto", () => {
    expect([...VERSIONI]).toEqual([...contratto.VERSIONI_DA_REGISTRARE]);
    expect([...PRIMO_GIRO]).toEqual([...contratto.FASI[0].versioni]);
    expect([...SECONDO_GIRO]).toEqual([...contratto.FASI[1].versioni]);
    expect(ESCLUSA).toEqual(contratto.ESCLUSA);
    expect(ULTIMA_IN_PRODUZIONE).toBe(contratto.ULTIMA_IN_PRODUZIONE);
    expect(contratto.problemiDelPiano()).toEqual([]);
  });
});

describe("il modulo non puo' collegarsi a niente", () => {
  const sorgente = readFileSync(SCRIPT, "utf8");
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/[^\n]*$/gm, " ");

  it("importa solo il modulo che decide", () => {
    const importazioni = [...codice.matchAll(/^import\s[\s\S]*?from\s+"([^"]+)";/gm)].map((m) => m[1]);
    expect(importazioni).toEqual(["./preflight-produzione-sanitizzato.mjs"]);
    expect(codice).not.toMatch(/\brequire\s*\(/);
    expect(codice).not.toMatch(/\bimport\s*\(/);
  });

  it("niente ambiente, file, processi, rete o database, nemmeno nei commenti", () => {
    for (const vietato of [
      /process\./, /\.env\b/, /dotenv/i, /\bpsql\b/i, /spawn/, /\bexec/, /child_process/, /node:/,
      /readFile/, /writeFile/, /\bfs\b/, /\bfetch\b/, /XMLHttpRequest/, /WebSocket/, /\bhttps?\b/i,
      /postgres/i, /supabase/i, /DB_URL/, /console\./,
    ]) {
      expect(sorgente, String(vietato)).not.toMatch(vietato);
    }
  });

  it("nessuna interrogazione al database, nemmeno nei commenti", () => {
    expect(sorgente).not.toMatch(/\b(select|insert|update|delete|create|alter|drop|grant|revoke|truncate|begin|rollback|commit)\s/i);
    expect(sorgente).not.toMatch(/\bSQL\b/);
  });

  it("nessun indirizzo, chiave o valore riservato", () => {
    for (const vietato of [/:\/\//, /\btoken\b/i, /secret/i, /segret/i, /vault/i, /eyJ[A-Za-z0-9_-]{10,}/, /\b[a-z]{20}\b/, /\burl/i]) {
      expect(sorgente, String(vietato)).not.toMatch(vietato);
    }
  });

  it("nessun segnaposto nel file", () => {
    expect(sorgente).not.toContain("${");
  });
});
