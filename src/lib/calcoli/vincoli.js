// Un rifiuto del database si legge in italiano.
//
// 🔴 PERCHE' ESISTE (24/08/2026). Le reti sui numeri assurdi fermano il
// dato — che è il punto — ma la frase che arriva a chi sta lavorando è
// quella di Postgres:
//
//   new row for relation "scenari_proiezione" violates check constraint
//   "scenario_frazioni_sono_frazioni"
//
// Misurato dal browser chiamando l'operazione vera con un food cost di
// 1,1, non dedotto. ⚠️ **È metà cura**: il numero assurdo non entra, e chi
// lo ha scritto non capisce perché. In sala, davanti a un cliente, una
// frase così non è un rifiuto: è un guasto.
//
// ⚠️ UNA REGOLA SOLA, deciso da Alessio: *«non il doppio controllo nelle
// schermate: due regole per lo stesso limite significa che un giorno una
// cambia e l'altra no, ed è esattamente così che nascono le frasi
// diventate false.»* Quindi la traduzione sta **nel punto unico da cui
// passa ogni richiesta del gestionale** (`src/lib/supabase.js`), non in
// ogni schermata che mostra un errore.
//
// Qui dentro c'è solo la parte PURA: riconoscere il nome del vincolo in
// un messaggio, e comporre la frase. Il giro al database per la
// spiegazione lo fa chi chiama.

/**
 * Il nome del vincolo dentro un messaggio di Postgres, se c'è.
 *
 * ⚠️ Le forme sono due, e servono entrambe: `check constraint` per i
 * limiti, `constraint` secco per unicità e chiavi esterne. Riconoscerne
 * una sola lascerebbe metà dei rifiuti in inglese — e sarebbe la metà che
 * capita più spesso in servizio (un tavolo già occupato, un doppione).
 *
 * @param {string} messaggio
 * @returns {?string}
 */
export function nomeDelVincolo(messaggio) {
  const t = String(messaggio ?? "");
  const m =
    /violates check constraint "([^"]+)"/.exec(t) ||
    /violates unique constraint "([^"]+)"/.exec(t) ||
    /violates foreign key constraint "([^"]+)"/.exec(t) ||
    /violates exclusion constraint "([^"]+)"/.exec(t);
  return m ? m[1] : null;
}

/**
 * La frase da mostrare al posto di quella di Postgres.
 *
 * ⚠️ SENZA SPIEGAZIONE NON SI INVENTA NIENTE, e non si tace: si dice che
 * il gestionale ha rifiutato, e **si conserva il nome tecnico**. Chi legge
 * capisce almeno che è un rifiuto voluto e non un guasto, e chi deve
 * indagare ha ancora l'unica cosa che serve a trovarlo.
 *
 * @param {?string} spiegazione  il commento del vincolo, in italiano
 * @param {string}  nome         il nome tecnico
 */
export function fraseDelRifiuto(spiegazione, nome) {
  const pulita = String(spiegazione ?? "").trim();
  if (pulita) return pulita;
  return `Il gestionale non ha accettato questo valore: c'è una regola che lo impedisce (${nome}). Se non capisci perché, questa è l'informazione da riportare.`;
}

/**
 * Il nome del vincolo dentro un corpo di risposta, **dovunque sia**.
 *
 * 🔴 PERCHE' NON BASTA GUARDARE `message` (misurato il 24/08, non
 * dedotto): le due porte del gestionale rispondono in due forme diverse.
 *
 *   PostgREST diretto   { code, message, details, hint }
 *   il corridoio        { errore: { codice, messaggio } }
 *
 * Guardando solo la prima, **metà dei rifiuti sarebbe rimasta in
 * inglese** — e sarebbe la metà che riguarda le scritture importanti,
 * quelle che passano dal corridoio perché toccano più tabelle.
 *
 * ⚠️ Quindi si cerca in tutti i campi di testo, a qualunque profondità:
 * è la forma che regge anche il giorno che una terza porta risponde in
 * un terzo modo, invece di lasciare quel caso muto.
 */
export function vincoloNelCorpo(corpo) {
  if (corpo == null) return null;
  if (typeof corpo === "string") return nomeDelVincolo(corpo);
  if (Array.isArray(corpo)) {
    for (const x of corpo) {
      const n = vincoloNelCorpo(x);
      if (n) return n;
    }
    return null;
  }
  if (typeof corpo !== "object") return null;
  for (const x of Object.values(corpo)) {
    const n = vincoloNelCorpo(x);
    if (n) return n;
  }
  return null;
}

/**
 * Rimette la frase italiana al posto del messaggio di Postgres, dovunque
 * fosse.
 *
 * ⚠️ SI SOSTITUISCE, NON SI AGGIUNGE UN CAMPO NUOVO: chi legge l'errore
 * guarda il campo che ha sempre guardato, e se accanto comparisse una
 * seconda frase le schermate mostrerebbero ancora la prima.
 *
 * ⚠️ E l'originale non si butta — viaggia in `messaggio_originale` a
 * fianco: una traduzione che cancella la fonte è una traduzione di cui
 * non ci si può fidare, e chi indaga ha ancora l'unica cosa che serve.
 */
export function conFraseTradotta(corpo, nome, frase) {
  if (corpo == null) return corpo;
  if (typeof corpo === "string") return nomeDelVincolo(corpo) === nome ? frase : corpo;
  if (Array.isArray(corpo)) return corpo.map((x) => conFraseTradotta(x, nome, frase));
  if (typeof corpo !== "object") return corpo;
  const fuori = {};
  for (const [k, x] of Object.entries(corpo)) {
    fuori[k] = conFraseTradotta(x, nome, frase);
  }
  return fuori;
}
