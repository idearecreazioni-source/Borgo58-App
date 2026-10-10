import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  CAMPI,
  CONTROLLI,
  ESCLUSA,
  ESITI,
  PRIMO_GIRO,
  SECONDO_GIRO,
  STATI,
  ULTIMA_IN_PRODUZIONE,
  VERSIONI,
  valutaPreflight,
} from "../../scripts/preflight-produzione-sanitizzato.mjs";
import * as contratto from "../../scripts/contratto-preflight-rilascio.mjs";

// IL PREFLIGHT SANITIZZATO — 01/10/2026, mandato M21-D.
//
// 🔴 Il modulo non guarda niente: riceve risposte gia' ridotte a si'/no,
//    numeri e versioni, e decide PRONTO / NON PRONTO. Queste prove fissano
//    la decisione, il rifiuto di tutto cio' che non e' previsto, e che il
//    modulo non possa ne' collegarsi ne' ripetere un valore ricevuto.

const SCRIPT = "scripts/preflight-produzione-sanitizzato.mjs";
const DOCUMENTO = "docs/consegne/20261001_preflight_produzione_sanitizzato.md";

/** Un ingresso in cui tutto e' come deve essere. */
const tuttoBene = () => ({
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

const stato = (r, id) => r.controlli.find((c) => c.id === id)?.stato;

describe("i controlli obbligatori", () => {
  it("ci sono tutti e 12, e nessun altro", () => {
    expect(CONTROLLI.map((c) => c.id)).toEqual([
      "master_contiene_le_17",
      "prova_registra_le_17",
      "produzione_come_attesa",
      "copia_di_sicurezza",
      "chiave_anon",
      "url_funzioni",
      "funzione_online",
      "guardie_dati_corpi_vivi",
      "nessun_blocco",
      "primo_giro",
      "secondo_giro",
      "esclusa_e_registrata",
    ]);
  });

  it("ogni controllo guarda solo campi dichiarati, e ogni campo e' guardato da un controllo", () => {
    const usati = new Set(CONTROLLI.flatMap((c) => c.campi));
    for (const c of usati) expect(Object.hasOwn(CAMPI, c), c).toBe(true);
    expect([...usati].sort()).toEqual(Object.keys(CAMPI).sort());
  });

  it("i tipi dei campi sono solo si'/no, conteggi e versioni", () => {
    for (const t of Object.values(CAMPI)) expect(["booleano", "conteggio", "versioni", "versione"]).toContain(t);
  });
});

describe("la decisione", () => {
  it("tutti OK → PRONTO", () => {
    const r = valutaPreflight(tuttoBene());
    expect(r.controlli.every((c) => c.stato === STATI.OK)).toBe(true);
    expect(r.esito).toBe(ESITI.PRONTO);
    expect(r.inputAccettato).toBe(true);
    expect(r.rifiuti).toEqual([]);
  });

  it("url_funzioni gia' presente e corrispondente vale come assente: PRONTO", () => {
    const r = valutaPreflight({ ...tuttoBene(), url_funzioni_presenti: 1, url_funzioni_corrisponde: true });
    expect(r.esito).toBe(ESITI.PRONTO);
  });

  it("url_funzioni presente ma diversa → NON OK", () => {
    const r = valutaPreflight({ ...tuttoBene(), url_funzioni_presenti: 1, url_funzioni_corrisponde: false });
    expect(stato(r, "url_funzioni")).toBe(STATI.NON_OK);
    expect(r.esito).toBe(ESITI.NON_PRONTO);
  });

  // Un solo NON OK, per ognuno dei 12: nessun controllo deve poter essere
  // scavalcato dagli altri.
  const guasti = {
    master_contiene_le_17: { master_versioni_presenti: VERSIONI.slice(1) },
    prova_registra_le_17: { prova_versioni_registrate: VERSIONI.slice(0, 16) },
    produzione_come_attesa: { produzione_ultima_registrata: "20260917000001" },
    copia_di_sicurezza: { copia_di_sicurezza_recente: false },
    chiave_anon: { chiave_anon_presenti: 2 },
    url_funzioni: { url_funzioni_presenti: 2, url_funzioni_corrisponde: true },
    funzione_online: { funzione_notifiche_installata: false },
    guardie_dati_corpi_vivi: { dati_compatibili: false },
    nessun_blocco: { transazioni_lunghe: 1 },
    primo_giro: { primo_giro_versioni: ["20260929000001", "20260917000001"] },
    secondo_giro: { secondo_giro_versioni: [...SECONDO_GIRO].reverse() },
    esclusa_e_registrata: { esclusa_registrata_da: "20260921000003" },
  };
  for (const [id, guasto] of Object.entries(guasti)) {
    it(`un solo NON OK (${id}) → NON PRONTO`, () => {
      const r = valutaPreflight({ ...tuttoBene(), ...guasto });
      expect(stato(r, id)).toBe(STATI.NON_OK);
      expect(r.controlli.filter((c) => c.stato !== STATI.OK).map((c) => c.id)).toEqual([id]);
      expect(r.esito).toBe(ESITI.NON_PRONTO);
    });
  }

  it("la produzione con una versione estranea → NON OK", () => {
    const r = valutaPreflight({ ...tuttoBene(), produzione_versioni_estranee: 1 });
    expect(stato(r, "produzione_come_attesa")).toBe(STATI.NON_OK);
  });

  it("un solo NON VERIFICATO (campo assente) → NON PRONTO", () => {
    const ingresso = tuttoBene();
    delete ingresso.copia_di_sicurezza_recente;
    const r = valutaPreflight(ingresso);
    expect(stato(r, "copia_di_sicurezza")).toBe(STATI.NON_VERIFICATO);
    expect(r.esito).toBe(ESITI.NON_PRONTO);
  });

  it("un solo NON VERIFICATO (campo a null) → NON PRONTO", () => {
    const r = valutaPreflight({ ...tuttoBene(), corpi_vivi_confermati: null });
    expect(stato(r, "guardie_dati_corpi_vivi")).toBe(STATI.NON_VERIFICATO);
    expect(r.esito).toBe(ESITI.NON_PRONTO);
  });

  it("un ingresso vuoto e' tutto NON VERIFICATO", () => {
    const r = valutaPreflight({});
    expect(r.controlli.every((c) => c.stato === STATI.NON_VERIFICATO)).toBe(true);
    expect(r.esito).toBe(ESITI.NON_PRONTO);
  });
});

describe("cio' che non e' previsto viene rifiutato, e non viene ripetuto", () => {
  const SEGRETO = "QUESTO-VALORE-NON-DEVE-USCIRE-1234567890";

  it("testo libero al posto di un si'/no → rifiutato, NON OK, NON PRONTO", () => {
    const r = valutaPreflight({ ...tuttoBene(), copia_di_sicurezza_recente: SEGRETO });
    expect(r.inputAccettato).toBe(false);
    expect(stato(r, "copia_di_sicurezza")).toBe(STATI.NON_OK);
    expect(r.esito).toBe(ESITI.NON_PRONTO);
    expect(JSON.stringify(r)).not.toContain(SEGRETO);
  });

  it("una stringa «true» non vale come vero", () => {
    const r = valutaPreflight({ ...tuttoBene(), funzione_notifiche_installata: "true" });
    expect(r.esito).toBe(ESITI.NON_PRONTO);
  });

  it("un conteggio non intero, negativo o testuale → rifiutato", () => {
    for (const v of [1.5, -1, "0", Number.NaN]) {
      const r = valutaPreflight({ ...tuttoBene(), transazioni_lunghe: v });
      expect(r.inputAccettato, String(v)).toBe(false);
      expect(r.esito).toBe(ESITI.NON_PRONTO);
    }
  });

  it("una versione che non e' di 14 cifre → rifiutata, e non ripetuta", () => {
    const r = valutaPreflight({ ...tuttoBene(), primo_giro_versioni: [SEGRETO] });
    expect(r.inputAccettato).toBe(false);
    expect(r.esito).toBe(ESITI.NON_PRONTO);
    expect(JSON.stringify(r)).not.toContain(SEGRETO);
  });

  it("una proprieta' inattesa → rifiutata, e ne' il nome ne' il valore escono", () => {
    const r = valutaPreflight({ ...tuttoBene(), [SEGRETO]: SEGRETO });
    expect(r.inputAccettato).toBe(false);
    expect(r.esito).toBe(ESITI.NON_PRONTO);
    expect(JSON.stringify(r)).not.toContain(SEGRETO);
    expect(r.rifiuti).toEqual(["proprieta' inattese: 1"]);
  });

  it("anche con tutti i controlli OK, una proprieta' inattesa basta a dire NON PRONTO", () => {
    const r = valutaPreflight({ ...tuttoBene(), nota: "va tutto bene" });
    expect(r.controlli.every((c) => c.stato === STATI.OK)).toBe(true);
    expect(r.esito).toBe(ESITI.NON_PRONTO);
  });

  it("ingressi che non sono oggetti semplici → NON PRONTO", () => {
    for (const v of [null, undefined, "testo", 42, [], new Date(), new Map()]) {
      const r = valutaPreflight(v);
      expect(r.esito).toBe(ESITI.NON_PRONTO);
      expect(r.inputAccettato).toBe(false);
    }
  });
});

describe("il modulo non puo' collegarsi a niente", () => {
  const sorgente = readFileSync(SCRIPT, "utf8");
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/[^\n]*$/gm, " ");

  it("non importa niente", () => {
    expect(codice).not.toMatch(/\bimport\b/);
    expect(codice).not.toMatch(/\brequire\s*\(/);
  });

  it("niente ambiente, rete, database, SQL, file o comandi", () => {
    for (const vietato of [
      /process\./, /\bfetch\s*\(/, /node:/, /child_process/, /\bspawn/, /\bexec\w*\s*\(/,
      /writeFile/, /readFile/, /\bfs\./, /\.env\b/, /psql/, /postgres/i,
      /\bselect\s+[\w*]+\s+from\b/i, /\binsert\s+into\b/i, /\bupdate\s+\w+\s+set\b/i, /\bdelete\s+from\b/i,
      /XMLHttpRequest/, /WebSocket/,
    ]) {
      expect(codice, String(vietato)).not.toMatch(vietato);
    }
  });

  it("nessun indirizzo, chiave o riferimento di progetto, nemmeno nei commenti", () => {
    for (const vietato of [
      /https?:\/\//, /supabase\.co/, /eyJ[A-Za-z0-9_-]{10,}/, /\b[a-z]{20}\b/, /\btoken\b/i, /\bsecret\b/i, /\bvault\b/i,
    ]) {
      expect(sorgente, String(vietato)).not.toMatch(vietato);
    }
  });
});

describe("modulo, documento e contratto dicono la stessa cosa", () => {
  const documento = readFileSync(DOCUMENTO, "utf8");

  it("le stesse 17 versioni, lo stesso primo e secondo giro, la stessa esclusa", () => {
    expect([...VERSIONI]).toEqual([...contratto.VERSIONI_DA_REGISTRARE]);
    expect([...PRIMO_GIRO]).toEqual([...contratto.FASI[0].versioni]);
    expect([...SECONDO_GIRO]).toEqual([...contratto.FASI[1].versioni]);
    expect(ESCLUSA).toEqual(contratto.ESCLUSA);
    expect(ULTIMA_IN_PRODUZIONE).toBe(contratto.ULTIMA_IN_PRODUZIONE);
  });

  it("il documento nomina tutte e 17 le versioni e l'ultima in produzione", () => {
    for (const v of [...VERSIONI, ULTIMA_IN_PRODUZIONE]) expect(documento, v).toContain(v);
  });

  it("il documento elenca il secondo giro nello stesso ordine", () => {
    const inizio = documento.indexOf("Il secondo giro, per intero:");
    const fine = documento.indexOf("## Quando il rilascio è PRONTO");
    const elenco = [...documento.slice(inizio, fine).matchAll(/`(\d{14})`/g)].map((m) => m[1]);
    expect(elenco).toEqual([...SECONDO_GIRO]);
  });

  it("il documento ha una riga per ogni controllo, e ne dichiara 12", () => {
    const righe = [...documento.matchAll(/^\| (\d+) \|/gm)].map((m) => Number(m[1]));
    expect(righe).toEqual(CONTROLLI.map((_, i) => i + 1));
    expect(documento).toMatch(/I 12 controlli/);
  });

  it("il documento dichiara che non si collega e che PRONTO non e' un'autorizzazione", () => {
    expect(documento).toMatch(/NON è uno strumento che si collega alla produzione/);
    expect(documento).toMatch(/anche PRONTO non è un'autorizzazione/);
  });

  it("il documento non contiene indirizzi ne' chiavi", () => {
    expect(documento).not.toMatch(/https?:\/\//);
    expect(documento).not.toMatch(/supabase\.co/);
    expect(documento).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(documento).not.toMatch(/\b[a-z]{20}\b/);
  });
});
