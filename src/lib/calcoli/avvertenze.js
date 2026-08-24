// La stessa avvertenza, una volta sola.
//
// 🔴 PERCHE' ESISTE (24/08/2026, mandato di Alessio sulle didascalie):
// *«quando la STESSA nota compare più volte nella stessa pagina — la nota
// su IRAP e stima semplificata compare tre volte in "Come sta andando" —
// va detta UNA VOLTA SOLA.»*
//
// Misurato prima di correggere: su quella schermata la frase sull'IRAP
// compare **due volte** nello stato di oggi, e non per una svista delle
// schermate. Arriva dal database dentro avvertenze **diverse**, perché
// `calcola_imposte()` restituisce il numero **e** la frase che ne dichiara
// il limite — una scelta del 15/08, ed è giusta: *un avviso che vive nel
// testo di una schermata non protegge la seconda che mostra lo stesso
// numero*. Il difetto nasce quando le due schermate sono la stessa.
//
// ⚠️ QUINDI NON SI PUO' CONFRONTARE L'AVVERTENZA INTERA: due avvertenze
// diverse possono contenere la stessa frase. Si confrontano le **frasi**,
// e si toglie solo quello che è già scritto più su nella stessa pagina.
//
// ⚠️ E LA PRIMA RESTA SEMPRE INTERA. Togliere a tutte e due la parte
// comune lascerebbe il numero senza il suo limite dichiarato in nessun
// punto — che è precisamente il difetto che quella frase esiste per
// impedire.

/** Spezza in frasi, tenendo la punteggiatura. */
function frasi(testo) {
  return String(testo ?? "")
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter(Boolean);
}

/**
 * ⚠️ Il confronto è sulla frase RIDOTTA — minuscola, senza accenti
 * tipografici e senza spazi doppi — perché la stessa frase può arrivare
 * da due funzioni del database scritte in due momenti diversi, e un
 * apostrofo differente non la rende una frase nuova.
 */
function chiave(frase) {
  return frase
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Toglie da ogni avvertenza le frasi già dette in quelle precedenti.
 *
 * @param {Array<?string>} avvertenze in ordine di comparsa sulla pagina
 * @returns {Array<string>} della stessa lunghezza; una voce può restare vuota
 */
export function senzaRipetizioni(avvertenze) {
  const viste = new Set();
  return (avvertenze ?? []).map((a) => {
    const tenute = [];
    for (const f of frasi(a)) {
      const k = chiave(f);
      if (viste.has(k)) continue;
      viste.add(k);
      tenute.push(f);
    }
    return tenute.join(" ");
  });
}
