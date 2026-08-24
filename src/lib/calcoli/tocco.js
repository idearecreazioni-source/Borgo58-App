// IL TOCCO CHE NON ASPETTA IL DATABASE — 25/08/2026
//
// 🔴 NASCE DA UNA RICHIESTA DI ALESSIO NEL COLLAUDO: *«tocco l'articolo e
// la riga ci mette un attimo a cambiare stato. Davanti allo scaffale, con
// una mano sola, quel ritardo mi fa toccare due volte e non capire più
// cosa ho fatto.»*
//
// ⚠️ MISURATO PRIMA DI CORREGGERE, sulla spesa spicciola: fra il tocco e
// il cambio della riga passavano **389 millisecondi in media** (320-430 su
// tre giri), ed erano **due** giri di rete — l'aggiornamento e poi la
// rilettura dell'elenco intero. Quella misura è fatta dal computer: dal
// telefono, in un supermercato, è parecchio peggio.
//
// ⚠️ E IL RISCHIO DELL'OTTIMISMO È UNO SOLO, ma è grosso: mostrare un
// effetto che non è avvenuto. Per questo la regola non è «cambia subito»,
// è **«cambia subito E sa tornare indietro»** — e il ritorno indietro è
// la metà che va provata, perché è quella che non si vede mai usare.
//
// ⚠️ STA QUI E NON DENTRO UNA SCHERMATA perché il ritorno indietro si
// prova solo se il salvataggio si può far fallire apposta: dentro un
// componente, `salva` è una chiamata al database e nessuna prova può
// romperla. Ricevendola come parametro, la prova le passa una funzione
// che fallisce — ed è l'unico modo di sapere se quel ramo funziona.

/**
 * Cambia una riga SUBITO e la rimette com'era se il salvataggio fallisce.
 *
 * @param {object} p
 * @param {Array}  p.righe      l'elenco di adesso
 * @param {string} p.id         quale riga
 * @param {object} p.cambio     le colonne da cambiare, es. { nel_carrello: true }
 * @param {Function} p.mostra   riceve il nuovo elenco (il `setState` della schermata)
 * @param {Function} p.salva    manda al database; se rifiuta, si torna indietro
 * @param {Function} p.avvisa   riceve il messaggio da far vedere ("" quando va bene)
 * @returns {Promise<boolean>}  vero se il salvataggio è riuscito
 */
export async function toccaSubito({ righe, id, cambio, mostra, salva, avvisa }) {
  const elenco = righe ?? [];
  const prima = elenco.find((r) => r.id === id);
  // ⚠️ Se la riga non c'è non si finge di averla cambiata: non c'è niente
  // da mostrare e niente da rimettere a posto.
  if (!prima) return false;

  // ⚠️ Si conserva SOLO ciò che si sta cambiando, non la riga intera: se
  // nel frattempo un'altra colonna fosse cambiata da un'altra parte,
  // rimettere la riga intera se la porterebbe via.
  const comEra = {};
  for (const k of Object.keys(cambio)) comEra[k] = prima[k];

  mostra(elenco.map((r) => (r.id === id ? { ...r, ...cambio } : r)));
  avvisa("");

  try {
    await salva();
    return true;
  } catch (e) {
    // ⚠️ Si riparte dall'elenco di ADESSO, non da quello di prima: fra il
    // tocco e il fallimento possono essere state toccate altre righe, e
    // rimettere la fotografia vecchia le cancellerebbe.
    mostra((ora) => (ora ?? []).map((r) => (r.id === id ? { ...r, ...comEra } : r)));
    avvisa(messaggio(prima, e));
    return false;
  }
}

/**
 * Toglie una riga dall'elenco SUBITO e la rimette se il salvataggio
 * fallisce. È l'altra forma dello stesso gesto: «fatto», «archiviato»,
 * «tolto» — dove l'effetto non è cambiare una colonna ma sparire.
 *
 * ⚠️ LA RIGA TORNA AL SUO POSTO, non in fondo: in un elenco ordinato per
 * scadenza, un impegno che riappare in coda sembra un impegno diverso.
 *
 * ⚠️ RESTITUISCE `{ ok, esito }` E NON L'ESITO NUDO, ed è una distinzione
 * che vale la riga in più: `salva` può legittimamente restituire «niente»
 * (un impegno completato che non genera nessun successore), e un valore
 * vuoto che significa **sia** «non c'era niente da dire» **sia** «è
 * fallito» è la stessa forma del «percento» che in questo database vuol
 * dire due cose. Chi chiama guarda `ok`, non indovina dall'esito.
 *
 * @returns {Promise<{ok: boolean, esito: any}>}
 */
export async function togliSubito({ righe, id, mostra, salva, avvisa }) {
  const elenco = righe ?? [];
  const posto = elenco.findIndex((r) => r.id === id);
  if (posto === -1) return { ok: false, esito: undefined };
  const riga = elenco[posto];

  mostra(elenco.filter((r) => r.id !== id));
  avvisa("");

  try {
    return { ok: true, esito: await salva() };
  } catch (e) {
    mostra((ora) => {
      const adesso = ora ?? [];
      if (adesso.some((r) => r.id === id)) return adesso; // già tornata
      const copia = [...adesso];
      copia.splice(Math.min(posto, copia.length), 0, riga);
      return copia;
    });
    avvisa(messaggio(riga, e));
    return { ok: false, esito: undefined };
  }
}

// ⚠️ IL MESSAGGIO NOMINA LA RIGA. Un «non salvato» generico, su un elenco
// dove si tocca una cosa dopo l'altra camminando, non dice quale è tornata
// indietro — e chi legge deve ricontrollarle tutte.
function messaggio(riga, e) {
  const cosa = riga?.articolo ?? riga?.titolo ?? riga?.nome ?? "la riga";
  return `«${cosa}» non si è salvato: ${e?.message ?? "errore sconosciuto"}. È tornato com'era.`;
}
