// Il netto all'ora e il netto al giorno di una riga di personale, tenuti
// d'accordo dalle ore lavorate al giorno.
//
// 🔴 PERCHE' ESISTE (24/08/2026, richiesta di Alessio dal collaudo). Fino
// a oggi «netto all'ora» e «netto al giorno» erano due caselle
// **scollegate**: si potevano scrivere 7 €/ora e 30 €/giorno senza che
// niente lo facesse notare — cioe' una giornata da quattro ore e un quarto
// in una previsione che altrove ne conta otto. Nessun errore, nessun
// avviso: solo un costo del personale sbagliato per tutto l'anno.
//
// ⚠️ LE ORE SONO UNA SOLA PER TUTTA LA PREVISIONE, non una per riga. La
// colonna `scenari_proiezione.ore_giorno` **esisteva gia' dal 15/08**, con
// il suo valore predefinito di 8: veniva salvata, e non la mostrava
// nessuna schermata e non la leggeva nessun calcolo. E' la stessa forma
// della soglia di magazzino del 13/08 — *tutto acceso, e muto*.
//
// ⚠️ COMANDA L'ULTIMO CAMPO TOCCATO, ed e' la regola che rende i due campi
// utilizzabili in tutti e due i versi: chi ragiona a paga oraria scrive
// l'ora e vede la giornata, chi ragiona a giornata scrive la giornata e
// vede l'ora. Senza questa memoria, cambiare le ore dovrebbe scegliere da
// se' quale dei due sacrificare — e sceglierebbe sempre lo stesso, cioe'
// sbaglierebbe meta' delle volte in silenzio.

/** Due decimali, come si scrive una paga. */
function euro(v) {
  return Math.round(v * 100) / 100;
}

const vuoto = (v) => v === "" || v == null;

/**
 * Riallinea i due netti di una riga di personale.
 *
 * @param {{nettoOrario?: string|number, nettoGiorno?: string|number, ultimo?: string}} riga
 * @param {number|string} oreGiorno  le ore lavorate al giorno, una per previsione
 * @param {"nettoOrario"|"nettoGiorno"|"ore"} toccato quale campo ha appena toccato chi scrive
 * @returns {object} la riga con l'altro campo ricalcolato e la memoria di chi comanda
 */
export function allineaPaga(riga, oreGiorno, toccato) {
  const ore = Number(oreGiorno);
  // ⚠️ Senza ore valide non si inventa niente: si scriverebbe uno zero, o
  // peggio un infinito, al posto di un numero che nessuno ha deciso.
  if (!Number.isFinite(ore) || ore <= 0) return riga;

  // Chi comanda: il campo appena toccato, oppure — se a muoversi sono state
  // le ore — l'ultimo che era stato toccato prima.
  const comanda = toccato === "ore" ? (riga.ultimo ?? "nettoOrario") : toccato;

  if (comanda === "nettoOrario") {
    if (vuoto(riga.nettoOrario)) return { ...riga, ultimo: "nettoOrario" };
    const orario = Number(riga.nettoOrario);
    if (!Number.isFinite(orario)) return { ...riga, ultimo: "nettoOrario" };
    return { ...riga, nettoGiorno: String(euro(orario * ore)), ultimo: "nettoOrario" };
  }

  if (comanda === "nettoGiorno") {
    if (vuoto(riga.nettoGiorno)) return { ...riga, ultimo: "nettoGiorno" };
    const giorno = Number(riga.nettoGiorno);
    if (!Number.isFinite(giorno)) return { ...riga, ultimo: "nettoGiorno" };
    return { ...riga, nettoOrario: String(euro(giorno / ore)), ultimo: "nettoGiorno" };
  }

  return riga;
}

/**
 * Le ore sono cambiate: ogni riga rifà il conto dal campo che comanda.
 *
 * @param {object[]} righe
 * @param {number|string} oreGiorno
 */
export function allineaTutte(righe, oreGiorno) {
  return righe.map((r) => allineaPaga(r, oreGiorno, "ore"));
}

/**
 * Le righe che si contraddicono: netto all'ora per le ore non fa il netto
 * al giorno. Serve a DIRLO, non a correggere di nascosto — una riga
 * scritta prima che le ore esistessero e' un fatto, non un errore di chi
 * la sta guardando adesso.
 *
 * ⚠️ LA TOLLERANZA CRESCE COL NUMERO DI ORE, e non e' un dettaglio: il
 * netto all'ora e' scritto in centesimi, quindi porta con se' mezzo
 * centesimo di arrotondamento — che moltiplicato per le ore diventa mezzo
 * centesimo per ora. Con 100 € al giorno su 7 ore l'ora fa 14,29, e
 * 14,29 x 7 fa 100,03: una tolleranza fissa di un centesimo direbbe che
 * quella riga si contraddice, quando a contraddirla e' solo la divisione.
 * **Un guardiano che grida su un caso normale si impara a spegnere.**
 */
export function righeDiscordi(righe, oreGiorno) {
  const ore = Number(oreGiorno);
  if (!Number.isFinite(ore) || ore <= 0) return [];
  const tolleranza = ore * 0.005 + 0.005;
  return righe
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !vuoto(r.nettoOrario) && !vuoto(r.nettoGiorno))
    .filter(({ r }) => Math.abs(Number(r.nettoOrario) * ore - Number(r.nettoGiorno)) > tolleranza)
    .map(({ i }) => i);
}
