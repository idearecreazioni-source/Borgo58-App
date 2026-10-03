// =====================================================================
// IL CONTRATTO DI PREFLIGHT — le 17 migrazioni che mancano in produzione
// 01/10/2026 · mandato M21-C
// =====================================================================
// 🔴 PERCHE' ESISTE. Il rilascio delle 17 migrazioni non segue l'ordine
//    di numero: la 20260929000001 va applicata PRIMA, da sola, e la
//    20260921000001 non si applica mai direttamente. Scritto solo in un
//    documento, quest'ordine resterebbe una frase che nessuno controlla;
//    scritto qui, una prova pura lo confronta col documento e con la
//    cartella delle migrazioni a ogni giro.
//
// ⚠️ E' UN PIANO, NON UN'AUTORIZZAZIONE. Questo file non applica niente,
//    non si collega a niente e non sa com'e' fatta la produzione: dice
//    soltanto cosa il CODICE delle migrazioni dimostra sull'ordine. Le
//    verifiche sull'ambiente vero stanno in un mandato separato, e senza
//    quelle nessuna fase parte.
//
// ⚠️ NIENTE IMPORTAZIONI, apposta: un file che non importa niente non puo'
//    aprire collegamenti, leggere configurazioni o scrivere su disco. La
//    prova `tests/unita/contratto-preflight-rilascio.test.js` lo controlla.
//
// Le ragioni, riga per riga, stanno in
// docs/consegne/20261001_contratto_preflight_rilascio_17_migrazioni.md
// =====================================================================

/** L'ultima versione registrata in produzione all'audit M21-A (01/10/2026). */
export const ULTIMA_IN_PRODUZIONE = "20260916000002";

/** Le 17 versioni che, a rilascio finito, devono risultare registrate. */
export const VERSIONI_DA_REGISTRARE = Object.freeze([
  "20260917000001",
  "20260919000001",
  "20260920000001",
  "20260920000002",
  "20260920000003",
  "20260920000004",
  "20260920000005",
  "20260921000001",
  "20260921000002",
  "20260921000003",
  "20260922000001",
  "20260923000001",
  "20260923000002",
  "20260923000003",
  "20260923000004",
  "20260928000001",
  "20260929000001",
]);

/**
 * La 20260921000001 non si applica: la sua guardia non riconoscerebbe la
 * funzione che deve sostituire, e il corpo che scrive perderebbe tre cose
 * aggiunte dopo. La 20260921000002 ne porta l'effetto e, dopo la propria
 * verifica, la registra.
 */
export const ESCLUSA = Object.freeze({
  versione: "20260921000001",
  registrataDa: "20260921000002",
});

/** Le due fasi, in quest'ordine. Ognuna parte solo se la precedente e' riuscita. */
export const FASI = Object.freeze([
  Object.freeze({
    nome: "primo giro",
    versioni: Object.freeze(["20260929000001"]),
    perche:
      "la 20260917000001 e la verifica della 20260920000001 pretendono la voce che solo questa crea; ha il numero piu' alto, quindi va applicata in un giro a parte",
  }),
  Object.freeze({
    nome: "secondo giro",
    versioni: Object.freeze([
      "20260917000001",
      "20260919000001",
      "20260920000001",
      "20260920000002",
      "20260920000003",
      "20260920000004",
      "20260920000005",
      "20260921000002",
      "20260921000003",
      "20260922000001",
      "20260923000001",
      "20260923000002",
      "20260923000003",
      "20260923000004",
      "20260928000001",
    ]),
    perche:
      "le 15 applicabili, in ordine di numero: e' gia' l'ordine che rispetta tutte le dipendenze fra loro",
  }),
]);

/**
 * Le sei funzioni che la 20260917000001 e la 20260920000001 riscrivono
 * togliendo l'identificativo del progetto di produzione. Ricavate dai
 * sorgenti (audit M24-A, 03/10/2026): sono esattamente le funzioni la cui
 * ultima definizione fino alla 20260916000002 lo contiene.
 */
export const FUNZIONI_CHE_LO_PERDONO = Object.freeze([
  "chiedi_lettura_posta",
  "invia_email_conferma",
  "invia_preventivo_per_email",
  "notify_reservation_telegram",
  "segnala_allarme",
  "send_due_task_reminders",
]);

/**
 * I controlli IN SOLA LETTURA sulla produzione che l'audit M24-A ha trovato
 * nei sorgenti delle migrazioni e che il piano non nominava. Ciascuno
 * dichiara prima di quali migrazioni deve risultare vero, e la riga della
 * migrazione che altrimenti si fermerebbe.
 *
 * ⚠️ IL CONTRATTO LI RICHIEDE, NON LI HA ESEGUITI. Nessuno di questi
 *    controlli e' stato misurato: finche' non risultano verdi, nessuna fase
 *    parte. Qui c'e' solo COSA va accertato, mai COME: lo strumento che li
 *    misura e' un lavoro a parte.
 */
export const CONTROLLI_OBBLIGATORI = Object.freeze([
  Object.freeze({
    id: "funzioni_che_nominano_la_produzione",
    obbligatorio: true,
    prima: Object.freeze(["20260920000001"]),
    richiede:
      "le funzioni vive dello schema public che contengono l'identificativo del progetto di produzione sono al piu' le sei di FUNZIONI_CHE_LO_PERDONO",
    altrimenti: "20260920000001: la verifica si ferma se una qualunque funzione lo contiene ancora (righe 377-383)",
  }),
  Object.freeze({
    id: "vincoli_senza_frase",
    obbligatorio: true,
    prima: Object.freeze(["20260923000004"]),
    richiede:
      "nessun vincolo che rifiuta, fuori dall'elenco congelato dei vincoli muti noti, e' privo della frase italiana: l'equivalente di vincoli_senza_frase() restituisce zero righe",
    altrimenti: "20260923000004: la verifica si ferma se ne trova anche uno (righe 172-176)",
  }),
  Object.freeze({
    id: "soggetti_e_utenti_presenti",
    obbligatorio: true,
    prima: Object.freeze(["20260919000001", "20260921000003", "20260923000003"]),
    richiede:
      "esistono un utente titolare e un utente staff, e i soggetti srls, tasca e azienda_agricola",
    altrimenti:
      "20260919000001 (righe 185-189), 20260921000003 (righe 601-607), 20260923000003 (righe 490-502): la verifica si ferma se ne manca uno",
  }),
  Object.freeze({
    id: "modulo_di_rete_con_tempo_massimo",
    obbligatorio: true,
    prima: Object.freeze(["20260920000002"]),
    richiede:
      "la funzione di invio del modulo di rete installato accetta il parametro timeout_milliseconds",
    altrimenti:
      "20260920000002: la funzione si crea comunque, e l'errore comparirebbe solo inviando i promemoria (riga 135, e la verifica guarda soltanto il testo, riga 274)",
  }),
  // Gli ultimi due li ha trovati il piano a gruppi M24-C (03/10/2026).
  Object.freeze({
    id: "causali_di_uscita_presenti",
    obbligatorio: true,
    prima: Object.freeze(["20260921000003"]),
    richiede:
      "fra le causali di cassa esiste almeno una di tipo uscita, attiva e non di sistema, e almeno una di tipo uscita e di sistema, attiva o no",
    altrimenti: "20260921000003: la verifica si ferma se ne manca una delle due (righe 610-616)",
  }),
  Object.freeze({
    id: "conti_del_1996_senza_documento",
    obbligatorio: true,
    prima: Object.freeze(["20260923000003"]),
    richiede:
      "per il soggetto srls la regola conti_senza_documento, sulle serate dal 01/01/1996 al 31/12/1996, non trova nessun conto",
    altrimenti:
      "20260923000003: la verifica si ferma se il 1996 ha gia' conti senza documento (righe 509-512)",
  }),
]);

/**
 * Condizioni operative del rilascio, dimostrate dai sorgenti. Non sono
 * controlli da misurare: sono vincoli su COME si fa il rilascio, e il
 * contratto non dichiara che siano soddisfatti.
 */
export const CONDIZIONI_OPERATIVE = Object.freeze([
  Object.freeze({
    id: "esclusa_resta_esclusa",
    richiede: "la 20260921000001 non si applica mai direttamente: la registra la 20260921000002",
  }),
  Object.freeze({
    id: "finestra_della_vista_dei_costi",
    richiede:
      "fra la 20260922000001 e la 20260923000001 la vista dei costi per riga di ricetta e' meno protetta: serve una protezione operativa esplicita per quella finestra",
  }),
  Object.freeze({
    id: "nessun_tempo_massimo_sui_blocchi",
    richiede:
      "lo strumento di rilascio non imposta oggi nessun tempo massimo di attesa sui blocchi: un'attesa va interrotta a mano",
  }),
  Object.freeze({
    id: "storico_dei_costi_riga_per_riga",
    richiede:
      "la sanatoria della 20260922000001 aggiorna le righe di ricetta una per una e fa scattare lo storico dei costi: serve una strategia di ripristino gia' verificata",
  }),
  Object.freeze({
    id: "righe_temporanee_nell_agenda",
    richiede:
      "le verifiche della 20260920000003, 20260920000004 e 20260920000005 creano e cancellano impegni veri dell'agenda della produzione",
  }),
]);

/** Prima di qualunque fase devono essere vere tutte queste. */
export const CONDIZIONI_PER_PARTIRE = Object.freeze([
  "master contiene tutte e 17 le migrazioni",
  "copia di sicurezza della produzione recente, fatta prima del rilascio",
  "le 17 versioni risultano registrate sul progetto di prova",
  "verifiche d'ambiente del mandato separato tutte verdi",
  "i sei controlli obbligatori in sola lettura risultano verdi",
  "le condizioni operative hanno ciascuna la sua risposta scritta nel mandato di rilascio",
  "nessuna corsa GitHub, prova o migrazione in esecuzione",
  "un mandato esplicito che autorizza il rilascio",
]);

/** Se succede una di queste, ci si ferma: niente correzioni, niente rilanci. */
export const CONDIZIONI_DI_ARRESTO = Object.freeze([
  "una condizione per partire non e' vera",
  "un controllo obbligatorio non e' verde, o non e' stato misurato",
  "il primo giro, in sola lettura, elenca qualcosa di diverso dalla sola 20260929000001",
  "il primo giro si ferma: il secondo non parte",
  "il secondo giro, in sola lettura, elenca un insieme o un ordine diverso dalle 15 applicabili",
  "una guardia o una verifica di una migrazione si ferma",
  "un'applicazione resta in attesa di un blocco",
  "arriva un allarme durante o subito dopo",
]);

// Per ogni controllo, le migrazioni che ne dipendono: e' la riga contro cui
// si confronta `prima`, cosi' spostare un controllo sulla versione sbagliata
// diventa un problema invece di passare in silenzio.
const PRIMA_ATTESA = Object.freeze({
  funzioni_che_nominano_la_produzione: "20260920000001",
  vincoli_senza_frase: "20260923000004",
  soggetti_e_utenti_presenti: "20260919000001,20260921000003,20260923000003",
  modulo_di_rete_con_tempo_massimo: "20260920000002",
  causali_di_uscita_presenti: "20260921000003",
  conti_del_1996_senza_documento: "20260923000003",
});

/**
 * I controlli obbligatori sono quelli attesi, tutti obbligatori, legati alle
 * migrazioni giuste e senza valori? Restituisce l'elenco dei problemi.
 */
export function problemiDeiControlli(controlli = CONTROLLI_OBBLIGATORI, versioni = VERSIONI_DA_REGISTRARE, esclusa = ESCLUSA) {
  const problemi = [];
  const id = controlli.map((c) => c.id);
  for (const atteso of Object.keys(PRIMA_ATTESA)) {
    if (!id.includes(atteso)) problemi.push(`manca il controllo ${atteso}`);
  }
  for (const c of controlli) {
    if (c.obbligatorio !== true) problemi.push(`${c.id}: non e' obbligatorio`);
    if (!Array.isArray(c.prima) || c.prima.length === 0) problemi.push(`${c.id}: non dice prima di quali migrazioni`);
    else if (Object.hasOwn(PRIMA_ATTESA, c.id) && [...c.prima].join(",") !== PRIMA_ATTESA[c.id]) {
      problemi.push(`${c.id}: legato alle migrazioni sbagliate`);
    }
    for (const v of c.prima ?? []) {
      if (!versioni.includes(v)) problemi.push(`${c.id}: ${v} non e' nel contratto`);
      if (v === esclusa.versione) problemi.push(`${c.id}: ${v} non si applica mai`);
    }
    const testo = `${c.richiede ?? ""} ${c.altrimenti ?? ""}`;
    if (!c.richiede || !c.altrimenti) problemi.push(`${c.id}: senza richiesta o senza conseguenza`);
    // Niente valori: nessun indirizzo, chiave firmata (comincia per «ey» e
    // una maiuscola), identificativo di progetto (venti minuscole) o
    // interrogazione.
    if (/:\/\/|\bey[A-Z]|\b[a-z]{20}\b|;/.test(testo) || /\b(select|from)\b/i.test(testo)) problemi.push(`${c.id}: contiene un valore o un'interrogazione`);
  }
  return problemi;
}

/**
 * Il piano e' coerente con se stesso? Restituisce l'elenco dei problemi:
 * vuoto vuol dire coerente. Funzione pura: riceve tutto, non legge niente.
 */
export function problemiDelPiano(
  fasi = FASI,
  versioni = VERSIONI_DA_REGISTRARE,
  esclusa = ESCLUSA,
) {
  const problemi = [];
  const applicate = fasi.flatMap((f) => f.versioni);

  const doppie = applicate.filter((v, i) => applicate.indexOf(v) !== i);
  if (doppie.length) problemi.push(`versioni in due fasi: ${doppie.join(", ")}`);

  if (applicate.includes(esclusa.versione)) {
    problemi.push(`la ${esclusa.versione} non deve essere applicata direttamente`);
  }
  if (!applicate.includes(esclusa.registrataDa)) {
    problemi.push(`manca la ${esclusa.registrataDa}, che registra la ${esclusa.versione}`);
  }

  const registrate = new Set([...applicate, esclusa.versione]);
  const mancanti = versioni.filter((v) => !registrate.has(v));
  const estranee = [...registrate].filter((v) => !versioni.includes(v));
  if (mancanti.length) problemi.push(`non registrate a fine rilascio: ${mancanti.join(", ")}`);
  if (estranee.length) problemi.push(`fuori dal contratto: ${estranee.join(", ")}`);

  for (const f of fasi) {
    const ordinate = [...f.versioni].sort();
    if (ordinate.join() !== f.versioni.join()) {
      problemi.push(`${f.nome}: non e' in ordine di numero`);
    }
  }
  return problemi;
}
