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

/** Prima di qualunque fase devono essere vere tutte queste. */
export const CONDIZIONI_PER_PARTIRE = Object.freeze([
  "master contiene tutte e 17 le migrazioni",
  "copia di sicurezza della produzione recente, fatta prima del rilascio",
  "le 17 versioni risultano registrate sul progetto di prova",
  "verifiche d'ambiente del mandato separato tutte verdi",
  "nessuna corsa GitHub, prova o migrazione in esecuzione",
  "un mandato esplicito che autorizza il rilascio",
]);

/** Se succede una di queste, ci si ferma: niente correzioni, niente rilanci. */
export const CONDIZIONI_DI_ARRESTO = Object.freeze([
  "una condizione per partire non e' vera",
  "il primo giro, in sola lettura, elenca qualcosa di diverso dalla sola 20260929000001",
  "il primo giro si ferma: il secondo non parte",
  "il secondo giro, in sola lettura, elenca un insieme o un ordine diverso dalle 15 applicabili",
  "una guardia o una verifica di una migrazione si ferma",
  "un'applicazione resta in attesa di un blocco",
  "arriva un allarme durante o subito dopo",
]);

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
