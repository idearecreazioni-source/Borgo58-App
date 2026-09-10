// =====================================================================
// COSA SI FA DI CIÒ CHE IL GESTIONALE HA LETTO IN UN DOCUMENTO
// =====================================================================
// 10/09/2026, Blocco 4 del mandato notturno.
//
// 🔴 IL VERSO DEL GESTO SI È ROVESCIATO. Prima si scriveva la scheda a mano
// e il file era un allegato in fondo; adesso si sceglie il file, il
// gestionale lo legge, e la scheda arriva **già compilata**. La differenza
// non è di comodità: prima chi archiviava doveva copiare a mano nome, tipo
// e data da un foglio che aveva davanti — e copiare a mano è il posto dove
// nascono gli errori che nessuno rilegge.
//
// ⚠️ QUI NON SI DECIDE NIENTE E NON SI SCRIVE NIENTE. Questo file traduce
// una proposta in campi di un modulo. Il documento entra nell'Archivio solo
// quando Alessio preme «Salva», e quello che viene salvato è quello che si
// vede — non quello che il modello aveva detto.
//
// 🔴 E NESSUN CAMPO SI INVENTA. Un valore plausibile messo in una casella
// vuota è indistinguibile da un valore letto: chi guarda la scheda
// compilata non ha modo di sapere quale delle due cose sta guardando. Un
// campo che il gestionale non ha saputo leggere resta **vuoto e
// dichiarato**, mai riempito per simmetria.

/** Una data buona è una data che il resto del gestionale sa leggere. */
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const testo = (v) => {
  if (typeof v !== "string") return "";
  return v.trim();
};

/**
 * I campi del modulo, come li propone il gestionale dopo aver letto.
 *
 * ⚠️ `sezioniAmmesse` arriva dal DATABASE (`sezioni_archivio_per`), non da
 * un elenco scritto qui: le sezioni dell'Archivio sono dati di Alessio, e
 * un elenco nel codice sarebbe la seconda verità che diverge alla prima
 * sezione nuova. Una sezione che il modello si è inventato viene
 * **scartata**, e la casella resta vuota: è la stessa regola con cui una
 * scheda prodotto scarta un allergene inesistente (13/08).
 */
export function campiProposti(proposta, sezioniAmmesse = []) {
  const p = proposta ?? {};
  const codici = new Set((sezioniAmmesse ?? []).map((s) => s.codice ?? s.value ?? s));
  const tipo = testo(p.tipo);
  const data = testo(p.data);
  return {
    title: testo(p.nome),
    doc_type: codici.has(tipo) ? tipo : "",
    document_date: ISO.test(data) ? data : "",
    counterparties: testo(p.controparti),
    amount: Number.isFinite(Number(p.importo)) && testo(String(p.importo ?? "")) !== ""
      ? String(p.importo)
      : "",
    expiry_date: ISO.test(testo(p.scadenza)) ? testo(p.scadenza) : "",
  };
}

/**
 * COSA IL GESTIONALE NON HA SAPUTO LEGGERE, in italiano.
 *
 * 🔴 SERVE PIÙ DEI CAMPI PIENI. Una scheda compilata a metà senza dire
 * quale metà manca si legge come una scheda completa: chi la guarda vede
 * dei campi vuoti e pensa che nel documento non ci fosse niente — che è
 * un'informazione diversa da «non l'ho capito».
 */
export function cosaNonHoCapito(proposta, campi) {
  const p = proposta ?? {};
  const buchi = [];
  if (!campi.title) buchi.push("come si chiama");
  if (!campi.doc_type) {
    // ⚠️ Due casi diversi, e si distinguono: il modello non ha proposto
    //    niente, oppure ha proposto una sezione che non esiste.
    buchi.push(
      testo(p.tipo)
        ? `in quale sezione va (aveva detto «${testo(p.tipo)}», che non è una sezione dell'Archivio)`
        : "in quale sezione va"
    );
  }
  if (!campi.document_date) buchi.push("di che data è");
  return buchi;
}

/**
 * LE DATE TROVATE NEL DOCUMENTO, quando sono più di una.
 *
 * 🔴 UN DOCUMENTO HA QUASI SEMPRE PIÙ DI UNA DATA — la data di emissione, la
 * scadenza, la decorrenza, il giorno della firma — e sceglierne una in
 * silenzio vuol dire archiviare una fattura di marzo sotto giugno **senza
 * nessun errore**. Il mandato chiede che siano distinguibili: quindi si
 * mostrano tutte, ognuna con cosa rappresenta, e quella proposta è solo la
 * prima della fila.
 *
 * ⚠️ Con UNA data sola non c'è niente da distinguere, e mostrare un elenco
 * di una riga farebbe sembrare difficile una cosa che non lo è.
 */
export function dateDaDistinguere(proposta) {
  const trovate = Array.isArray(proposta?.date_trovate) ? proposta.date_trovate : [];
  const buone = trovate
    .map((d) => ({ data: testo(d?.data), cosa: testo(d?.cosa) }))
    .filter((d) => ISO.test(d.data));
  return buone.length > 1 ? buone : [];
}
