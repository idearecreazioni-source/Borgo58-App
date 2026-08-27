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

// ---------------------------------------------------------------------
// LA QUINTA FORMA: manca un dato obbligatorio (28/08/2026)
// ---------------------------------------------------------------------
//
// 🔴 NON HA UN NOME DI VINCOLO, ed è per questo che era rimasta fuori.
// Misurato sul progetto di prova provocando il rifiuto vero e leggendo
// cosa torna, non dedotto dalla documentazione:
//
//   23502  null value in column "obbl" of relation "_mis_b58"
//          violates not-null constraint
//
// Non c'è nessun nome fra virgolette da cercare, quindi tutte e quattro
// le espressioni di `nomeDelVincolo()` falliscono e **la frase arriva a
// schermo in inglese, così com'è**, nominando una colonna di database.
// Le colonne obbligatorie senza valore predefinito sono 341, su 116
// tabelle.
//
// ⚠️ E QUI NON SI FINGE UNA REGOLA. Un `not null` che arriva a chi lavora
// è quasi sempre un difetto della schermata — un campo che non è stato
// mandato — non una regola che quella persona può rispettare. Le altre
// quattro forme dicono «non puoi, ed ecco perché»; questa dice «manca un
// pezzo, ed ecco quale».

/**
 * Il dato obbligatorio mancante dentro un messaggio di Postgres, se c'è.
 *
 * @param {string} messaggio
 * @returns {?{tabella: string, colonna: string}}
 */
export function campoObbligatorio(messaggio) {
  const t = String(messaggio ?? "");
  const m = /null value in column "([^"]+)" of relation "([^"]+)" violates not-null constraint/.exec(t);
  return m ? { colonna: m[1], tabella: m[2] } : null;
}

/**
 * Lo stesso, dentro un corpo di risposta e **dovunque sia**.
 *
 * ⚠️ Stessa ragione di `vincoloNelCorpo()`: le porte del gestionale sono
 * due e rispondono in due forme diverse (PostgREST `{ code, message }`,
 * il corridoio `{ errore: { codice, messaggio } }`). Guardare un campo
 * solo lascerebbe muta metà dei casi.
 */
export function campoObbligatorioNelCorpo(corpo) {
  if (corpo == null) return null;
  if (typeof corpo === "string") return campoObbligatorio(corpo);
  if (Array.isArray(corpo)) {
    for (const x of corpo) {
      const c = campoObbligatorioNelCorpo(x);
      if (c) return c;
    }
    return null;
  }
  if (typeof corpo !== "object") return null;
  for (const x of Object.values(corpo)) {
    const c = campoObbligatorioNelCorpo(x);
    if (c) return c;
  }
  return null;
}

/**
 * La frase da mostrare al posto di quella di Postgres.
 *
 * ⚠️ SENZA COMMENTO SI USA IL NOME TECNICO, e non si tace: chi legge deve
 * poter dire QUALE dato manca, e il nome della colonna è l'unica cosa che
 * serve a trovarlo. Al 28/08 il commento ce l'hanno 32 colonne
 * obbligatorie su 341 — quindi il ramo senza è quello normale, non
 * l'eccezione, e va scritto perché regga da solo.
 *
 * @param {?string} spiegazione  il commento della colonna, in italiano
 * @param {string}  colonna      il nome tecnico
 */
export function fraseCampoObbligatorio(spiegazione, colonna) {
  const pulita = String(spiegazione ?? "").trim();
  const quale = pulita || `«${colonna}»`;
  return `Manca un dato che il gestionale considera obbligatorio: ${quale}. Non è una regola che puoi aggirare compilando diversamente — è un pezzo che non è arrivato. Se il campo a schermo ti sembrava pieno, questa è l'informazione da riportare.`;
}

/**
 * Rimette la frase italiana al posto del messaggio di Postgres, dovunque
 * fosse, per il caso del dato obbligatorio.
 *
 * ⚠️ Non si è riusato `conFraseTradotta()`: quella riconosce una stringa
 * dal NOME del vincolo, e qui un nome non c'è. Confondere le due cose
 * vorrebbe dire far finta che questo caso sia come gli altri quattro —
 * ed è proprio il fatto che non lo sia ad averlo tenuto fuori fino a
 * oggi.
 */
export function conFraseSulCampo(corpo, colonna, frase) {
  if (corpo == null) return corpo;
  if (typeof corpo === "string") {
    return campoObbligatorio(corpo)?.colonna === colonna ? frase : corpo;
  }
  if (Array.isArray(corpo)) return corpo.map((x) => conFraseSulCampo(x, colonna, frase));
  if (typeof corpo !== "object") return corpo;
  const fuori = {};
  for (const [k, x] of Object.entries(corpo)) {
    fuori[k] = conFraseSulCampo(x, colonna, frase);
  }
  return fuori;
}
