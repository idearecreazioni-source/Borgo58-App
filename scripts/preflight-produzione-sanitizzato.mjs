// =====================================================================
// IL PREFLIGHT SANITIZZATO — decide PRONTO / NON PRONTO, senza guardare
// 01/10/2026 · mandato M21-D
// =====================================================================
// 🔴 PERCHE' ESISTE. Prima di applicare le 17 migrazioni in produzione
//    servono una dozzina di controlli sull'ambiente vero. Questo modulo
//    NON li fa: dice quali risultati servono, in che forma, e cosa ne
//    consegue. Il futuro esecutore che li fara' davvero gli passera' solo
//    risposte gia' ridotte a si'/no, numeri e versioni di migrazione.
//
// ⚠️ NIENTE IMPORTAZIONI, apposta: un modulo che non importa niente non
//    puo' collegarsi, leggere configurazioni o scrivere. Riceve un oggetto
//    e restituisce un oggetto. La prova
//    `tests/unita/preflight-produzione-sanitizzato.test.js` lo controlla.
//
// ⚠️ IL RISULTATO NON RIPETE MAI CIO' CHE RICEVE. Se per errore arrivasse
//    un testo o un valore riservato al posto di un si'/no, il modulo lo
//    rifiuta dicendo QUALE CAMPO e' sbagliato, mai cosa conteneva — e
//    nemmeno il nome di una proprieta' inattesa, che potrebbe essere lei
//    stessa il dato da non mostrare: di quelle si conta solo quante sono.
//
// ⚠️ IN DUBBIO, NON PRONTO. Un campo mancante e' «NON VERIFICATO», e un
//    solo controllo non OK basta a fermare tutto.
//
// Il piano a cui si riferisce e' quello di
// scripts/contratto-preflight-rilascio.mjs; la prova confronta i due.
// =====================================================================

export const STATI = Object.freeze({ OK: "OK", NON_OK: "NON OK", NON_VERIFICATO: "NON VERIFICATO" });
export const ESITI = Object.freeze({ PRONTO: "PRONTO", NON_PRONTO: "NON PRONTO" });

/** L'ultima versione registrata in produzione all'audit M21-A (01/10/2026). */
export const ULTIMA_IN_PRODUZIONE = "20260916000002";

/** Le 17 versioni del rilascio. */
export const VERSIONI = Object.freeze([
  "20260917000001", "20260919000001", "20260920000001", "20260920000002",
  "20260920000003", "20260920000004", "20260920000005", "20260921000001",
  "20260921000002", "20260921000003", "20260922000001", "20260923000001",
  "20260923000002", "20260923000003", "20260923000004", "20260928000001",
  "20260929000001",
]);

export const PRIMO_GIRO = Object.freeze(["20260929000001"]);

export const SECONDO_GIRO = Object.freeze([
  "20260917000001", "20260919000001", "20260920000001", "20260920000002",
  "20260920000003", "20260920000004", "20260920000005", "20260921000002",
  "20260921000003", "20260922000001", "20260923000001", "20260923000002",
  "20260923000003", "20260923000004", "20260928000001",
]);

export const ESCLUSA = Object.freeze({ versione: "20260921000001", registrataDa: "20260921000002" });

/** I tre tipi ammessi. Nient'altro entra. */
const TIPI = Object.freeze({
  booleano: (v) => typeof v === "boolean",
  conteggio: (v) => Number.isInteger(v) && v >= 0 && v <= 1000000,
  versioni: (v) => Array.isArray(v) && v.length <= 1000 && v.every((x) => typeof x === "string" && /^[0-9]{14}$/.test(x)),
  versione: (v) => typeof v === "string" && /^[0-9]{14}$/.test(v),
});

const stessiElementi = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const stessaSequenza = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * I campi che il futuro esecutore puo' passare. Ogni campo ha un tipo, e
 * nient'altro e' ammesso. `null` o assente vuol dire «non verificato».
 */
export const CAMPI = Object.freeze({
  master_versioni_presenti: "versioni",
  prova_versioni_registrate: "versioni",
  produzione_ultima_registrata: "versione",
  produzione_versioni_mancanti: "versioni",
  produzione_versioni_estranee: "conteggio",
  copia_di_sicurezza_recente: "booleano",
  chiave_anon_presenti: "conteggio",
  chiave_anon_del_progetto_atteso: "booleano",
  url_funzioni_presenti: "conteggio",
  url_funzioni_corrisponde: "booleano",
  funzione_notifiche_installata: "booleano",
  guardie_migrazioni_soddisfatte: "booleano",
  corpi_vivi_confermati: "booleano",
  dati_compatibili: "booleano",
  transazioni_lunghe: "conteggio",
  blocchi_incompatibili: "conteggio",
  primo_giro_versioni: "versioni",
  secondo_giro_versioni: "versioni",
  versioni_escluse: "versioni",
  esclusa_registrata_da: "versione",
});

/**
 * I controlli obbligatori: quali campi guardano, e quando sono OK.
 * `decidi` riceve solo campi gia' validati e presenti.
 */
export const CONTROLLI = Object.freeze([
  {
    id: "master_contiene_le_17",
    descrizione: "master contiene tutte e 17 le versioni",
    campi: ["master_versioni_presenti"],
    decidi: (c) => VERSIONI.every((v) => c.master_versioni_presenti.includes(v)),
  },
  {
    id: "prova_registra_le_17",
    descrizione: "il progetto di prova registra tutte e 17 le versioni",
    campi: ["prova_versioni_registrate"],
    decidi: (c) => VERSIONI.every((v) => c.prova_versioni_registrate.includes(v)),
  },
  {
    id: "produzione_come_attesa",
    descrizione: "la produzione e' ferma esattamente prima del rilascio",
    campi: ["produzione_ultima_registrata", "produzione_versioni_mancanti", "produzione_versioni_estranee"],
    decidi: (c) =>
      c.produzione_ultima_registrata === ULTIMA_IN_PRODUZIONE &&
      stessiElementi(c.produzione_versioni_mancanti, VERSIONI) &&
      c.produzione_versioni_estranee === 0,
  },
  {
    id: "copia_di_sicurezza",
    descrizione: "copia di sicurezza recente confermata",
    campi: ["copia_di_sicurezza_recente"],
    decidi: (c) => c.copia_di_sicurezza_recente === true,
  },
  {
    id: "chiave_anon",
    descrizione: "chiave_anon presente una volta sola e del progetto atteso",
    campi: ["chiave_anon_presenti", "chiave_anon_del_progetto_atteso"],
    decidi: (c) => c.chiave_anon_presenti === 1 && c.chiave_anon_del_progetto_atteso === true,
  },
  {
    id: "url_funzioni",
    descrizione: "url_funzioni assente, oppure presente una volta sola e corrispondente",
    campi: ["url_funzioni_presenti", "url_funzioni_corrisponde"],
    // assente: la crea il primo giro. Presente: deve corrispondere, o il
    // primo giro si ferma. Il campo di corrispondenza va dato comunque:
    // con la voce assente si dichiara `false`.
    decidi: (c) =>
      (c.url_funzioni_presenti === 0 && c.url_funzioni_corrisponde === false) ||
      (c.url_funzioni_presenti === 1 && c.url_funzioni_corrisponde === true),
  },
  {
    id: "funzione_online",
    descrizione: "la funzione online delle notifiche e' installata prima del secondo giro",
    campi: ["funzione_notifiche_installata"],
    decidi: (c) => c.funzione_notifiche_installata === true,
  },
  {
    id: "guardie_dati_corpi_vivi",
    descrizione: "guardie delle migrazioni, dati e corpi vivi confermati",
    campi: ["guardie_migrazioni_soddisfatte", "corpi_vivi_confermati", "dati_compatibili"],
    decidi: (c) =>
      c.guardie_migrazioni_soddisfatte === true && c.corpi_vivi_confermati === true && c.dati_compatibili === true,
  },
  {
    id: "nessun_blocco",
    descrizione: "nessuna transazione lunga e nessun blocco incompatibile",
    campi: ["transazioni_lunghe", "blocchi_incompatibili"],
    decidi: (c) => c.transazioni_lunghe === 0 && c.blocchi_incompatibili === 0,
  },
  {
    id: "primo_giro",
    descrizione: "il primo giro e' la sola 20260929000001",
    campi: ["primo_giro_versioni"],
    decidi: (c) => stessaSequenza(c.primo_giro_versioni, PRIMO_GIRO),
  },
  {
    id: "secondo_giro",
    descrizione: "il secondo giro sono le 15 applicabili, in ordine di numero",
    campi: ["secondo_giro_versioni"],
    decidi: (c) => stessaSequenza(c.secondo_giro_versioni, SECONDO_GIRO),
  },
  {
    id: "esclusa_e_registrata",
    descrizione: "la 20260921000001 e' esclusa e la registra la 20260921000002",
    campi: ["versioni_escluse", "esclusa_registrata_da"],
    decidi: (c) =>
      stessaSequenza(c.versioni_escluse, [ESCLUSA.versione]) && c.esclusa_registrata_da === ESCLUSA.registrataDa,
  },
]);

/**
 * La decisione. Riceve SOLO risultati gia' sanitizzati; restituisce lo
 * stato di ogni controllo e l'esito complessivo. Non ripete mai un valore
 * ricevuto.
 */
export function valutaPreflight(input) {
  const rifiuti = [];
  const semplice =
    input !== null && typeof input === "object" && !Array.isArray(input) &&
    (Object.getPrototypeOf(input) === Object.prototype || Object.getPrototypeOf(input) === null);

  if (!semplice) {
    return {
      esito: ESITI.NON_PRONTO,
      inputAccettato: false,
      rifiuti: ["l'ingresso non e' un oggetto semplice"],
      controlli: CONTROLLI.map((c) => ({ id: c.id, stato: STATI.NON_VERIFICATO })),
    };
  }

  const inattese = Object.keys(input).filter((k) => !Object.hasOwn(CAMPI, k)).length;
  if (inattese > 0) rifiuti.push(`proprieta' inattese: ${inattese}`);

  const malformati = new Set();
  for (const [campo, tipo] of Object.entries(CAMPI)) {
    if (!Object.hasOwn(input, campo) || input[campo] === null) continue;
    if (!TIPI[tipo](input[campo])) {
      malformati.add(campo);
      rifiuti.push(`campo con valore del tipo sbagliato: ${campo}`);
    }
  }

  const controlli = CONTROLLI.map((c) => {
    if (c.campi.some((k) => malformati.has(k))) return { id: c.id, stato: STATI.NON_OK };
    if (c.campi.some((k) => !Object.hasOwn(input, k) || input[k] === null)) {
      return { id: c.id, stato: STATI.NON_VERIFICATO };
    }
    return { id: c.id, stato: c.decidi(input) ? STATI.OK : STATI.NON_OK };
  });

  const tuttiOk = controlli.every((c) => c.stato === STATI.OK);
  return {
    esito: tuttiOk && rifiuti.length === 0 ? ESITI.PRONTO : ESITI.NON_PRONTO,
    inputAccettato: rifiuti.length === 0,
    rifiuti,
    controlli,
  };
}
