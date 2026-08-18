// IL RITARDO, E LA PRECEDENZA DEI SEGNI SULLA SALA.
//
// Due cose in un file solo, e non è pigrizia: sono la stessa domanda vista
// da due lati. «Questo tavolo è in ritardo?» non serve a niente finché non
// si sa **come si vede**, e «come si vede» non si può decidere senza sapere
// che cosa può stare addosso a un tavolo nello stesso momento.
//
// ⚠️ IL RITARDO È CALCOLATO, MAI SCRITTO (decisione di Alessio, 18/08/2026,
// e ha battuto le due strade che avevo proposto — un quinto stato della
// prenotazione, oppure un orario di arrivo da segnare). La sua terza strada:
// *«il tavolo si presume arrivato quando viene aperta la comanda e, se dopo
// 30 minuti non viene ancora aperta, il tavolo diventa rosso»*. Non chiede a
// nessuno di segnare niente: l'arrivo si deduce da un gesto che in sala si fa
// comunque. Una colonna «in ritardo» sarebbe invece un dato che invecchia da
// solo — vero quando lo si scrive, falso dieci minuti dopo, e nessuno lì a
// riscriverlo.
//
// ⚠️ LA DOMANDA GIUSTA È «ESISTE UN CONTO IN QUESTA SERATA», NON «C'È UN
// CONTO APERTO». Con la seconda, un tavolo che ha mangiato e pagato tornerebbe
// in ritardo alla chiusura del conto — cioè **ogni sera, su ogni tavolo, dopo
// che tutto è andato bene**. Un allarme che suona quando va tutto bene è
// l'allarme che si impara a ignorare, ed è il difetto contrario a quello che
// il progetto conosceva già.
//
// ⚠️ E L'ARRIVO SI LEGGE DAL LEGAME DEL GIRO D1, non da «un conto su quel
// tavolo stasera»: `orders.reservation_id` dice **quale** prenotazione ha
// aperto quel conto. La differenza morde quando un tavolo ha due turni: alle
// 22:30 il conto delle 19:30 è ancora sullo stesso tavolo, e un conteggio per
// tavolo direbbe «arrivato» a chi non è ancora entrato.

import { istanteDellaSerata } from "./serata";

// =====================================================================
// 1. QUALE CONTO PROVA CHE SONO ARRIVATI
// =====================================================================
//
// ⚠️ UN CONTO ANNULLATO NON PROVA NIENTE, e questa è una decisione, non
// un dettaglio. Un conto annullato è, per tutto il resto del gestionale, un
// conto **che non è mai esistito**: non scarica il magazzino (13/08), non
// entra in nessun incasso, e l'annullamento è ammesso solo finché la cucina
// non ha prodotto niente (decisione di Alessio del 13/08). Farlo valere come
// prova d'arrivo zittirebbe l'avviso proprio quando qualcuno ha appena
// corretto un tavolo aperto per sbaglio — cioè nel caso in cui il tavolo è
// davvero libero e davvero riassegnabile.
//
// Il caso vero, misurato in produzione il 18/08 alle 21:19: T3 aveva la
// prenotazione «prova» delle 20:00, un conto aperto alle 21:06 e **annullato
// alle 21:07**. Con questa regola T3 risulta in ritardo, ed è la risposta
// giusta: lì non c'è nessuno.
//
// ⚠️ UN OMAGGIO INVECE È UN ARRIVO: hanno mangiato, non hanno pagato.
export const ARRIVO_PER_STATO = {
  aperto: true,
  chiuso: true,
  omaggiato: true,
  annullato: false,
};

/**
 * Uno stato di conto che questo file non conosce **non accende l'allarme**.
 *
 * ⚠️ La direzione del dubbio è scelta, non casuale: fra un avviso mancato e
 * un avviso falso, il progetto ha già deciso quale costa di più — *un allarme
 * falso ripetuto è peggio di nessun allarme, perché addestra a ignorarlo*
 * (18/08). E il caso non resta scoperto: `tests/app/ritardo-sala.test.js`
 * legge i valori veri dell'elenco `order_status` dal database e diventa rosso
 * il giorno che ne compare uno che qui non è classificato.
 */
export function contoProvaArrivo(stato) {
  const noto = ARRIVO_PER_STATO[stato];
  return noto === undefined ? true : noto;
}

// =====================================================================
// 2. IL RITARDO DI UNA PRENOTAZIONE
// =====================================================================

/**
 * @param istante          Date — il momento prenotato (da `istanteDellaSerata`)
 * @param adesso           Date
 * @param minutiTolleranza da service_settings.minuti_tolleranza_ritardo
 * @param arrivata         c'è un conto che nomina questa prenotazione?
 * @returns { inRitardo, minuti, arrivata } — `minuti` è quanto è passato
 *          dall'ora prenotata (negativo se deve ancora arrivare), sempre
 *          calcolato: serve a scrivere «in ritardo di 40 minuti», non solo a
 *          colorare. `arrivata` esce di qui e non si ricalcola altrove — è la
 *          stessa domanda, e chiedersela due volte è il modo in cui due
 *          schermate cominciano a rispondere diverso.
 */
export function ritardoPrenotazione({ istante, adesso, minutiTolleranza, arrivata }) {
  const eArrivata = Boolean(arrivata);
  if (!istante || !adesso) return { inRitardo: false, minuti: 0, arrivata: eArrivata };
  const minuti = Math.floor((adesso.getTime() - istante.getTime()) / 60000);
  // ⚠️ Strettamente maggiore: «dopo 30 minuti» esclude il trentesimo. Al
  // minuto esatto della tolleranza il tavolo è ancora suo.
  return {
    inRitardo: !eArrivata && minuti > Number(minutiTolleranza || 0),
    minuti,
    arrivata: eArrivata,
  };
}

/**
 * Il ritardo di tutta una serata, in un colpo solo.
 *
 * @param prenotazioni     le righe di `turni_del_giorno()` così come arrivano
 *                         — `{ reservation_id, ora, tavoli }` — e sono le
 *                         sole CONFERMATE: una richiesta in attesa non tiene
 *                         nessun tavolo (decisione del 14/08), quindi non può
 *                         essere in ritardo.
 *
 * 🔴 IL NOME DEL CAMPO È `reservation_id`, NON `id`, e c'è voluta una prova
 *    sui dati veri per accorgersene. Scrivendo questa funzione avevo dato per
 *    scontata la forma `{ id, ... }`, e la prova pura — che i dati se li
 *    inventa — passava. Sul database vero l'effetto era muto e totale: la
 *    ricerca di «chi è arrivato» non trovava mai nessuno, quindi **ogni
 *    tavolo prenotato restava sbarrato anche col conto aperto davanti**.
 *    Nessun errore, nessuna riga rossa: solo un allarme che non si spegne
 *    mai, cioè quello che si impara a ignorare. Da qui la forma è UNA, ed è
 *    quella che il database restituisce.
 * @param conti            [{ reservation_id, status }] — i conti che nominano
 *                         quelle prenotazioni, di qualunque stato.
 * @returns { perPrenotazione: Map(id → {inRitardo, minuti}), tavoli: Set(uuid) }
 */
export function ritardiDellaSerata({
  prenotazioni = [],
  conti = [],
  adesso,
  minutiTolleranza,
  serata,
  oraFineSerata,
}) {
  const arrivate = new Set(
    conti.filter((c) => c?.reservation_id && contoProvaArrivo(c.status)).map((c) => c.reservation_id)
  );
  const perPrenotazione = new Map();
  const tavoli = new Set();
  for (const p of prenotazioni) {
    const esito = ritardoPrenotazione({
      istante: istanteDellaSerata(serata, p.ora, oraFineSerata),
      adesso,
      minutiTolleranza,
      arrivata: arrivate.has(p.reservation_id),
    });
    perPrenotazione.set(p.reservation_id, esito);
    if (esito.inRitardo) for (const t of p.tavoli ?? []) tavoli.add(t);
  }
  return { perPrenotazione, tavoli };
}

// =====================================================================
// 3. LA PRECEDENZA — quale segno vince, e in che ordine
// =====================================================================
//
// ⚠️ LA PRECEDENZA È UN DATO, NON UNA CATENA DI `if`. La legenda si costruisce
// da qui, quindi non può raccontare un ordine diverso da quello che il disegno
// applica: fino a oggi le due legende elencavano dei colori senza dire che uno
// ne copre un altro, e *un colore che ne sovrascrive altri, senza che la
// legenda lo dica, si legge come un colore che non esiste da nessuna parte*
// (mandato, giro D).
//
// ⚠️ E LA SBARRATURA NON È IN QUESTA GARA: è un secondo canale, che si
// aggiunge sopra qualunque colore. Vedi sotto il perché.
export const PRECEDENZA = [
  {
    chiave: "selezionato",
    ordine: 1,
    // Sta in cima perché è la risposta al dito di chi guarda: un tavolo che
    // non cambia quando lo si tocca è un tavolo che sembra rotto.
    perche: "è la risposta al tuo tocco, e dura un istante",
  },
  {
    chiave: "occupato",
    ordine: 2,
    perche: "sono seduti: la fascia ha già fatto il suo lavoro",
  },
  { chiave: "tardi", ordine: 3, perche: "l'ora di arrivo" },
  { chiave: "pieno", ordine: 3, perche: "l'ora di arrivo" },
  { chiave: "presto", ordine: 3, perche: "l'ora di arrivo" },
  { chiave: "misto", ordine: 3, perche: "l'ora di arrivo" },
  { chiave: "libero", ordine: 4, perche: "nessuno l'ha ancora chiesto" },
];

/**
 * Che segno porta un tavolo. UNA funzione per le due schermate.
 *
 * ⚠️ IL RITARDO NON SOSTITUISCE IL COLORE: LO SBARRA. La decisione di Alessio
 * era *«il rosso prende tutto il tavolo al posto del colore della fascia»*, e
 * la ragione era che il ritardo è l'informazione su cui si agisce subito.
 * Quella ragione resta intera; cambia il segno, perché **il rosso era già
 * preso due volte** — il terracotta è la fascia «ultimo giro» ed è anche il
 * tavolo che stai toccando. Un terzo rosso avrebbe fatto dire tre cose diverse
 * allo stesso colore, che è il modo in cui un colore smette di dire qualcosa.
 * La sbarratura non è subordinata a niente: passa sopra tutto, compreso il
 * tavolo selezionato, e non toglie l'ora di arrivo a chi la stava leggendo.
 *
 * @returns { colore, barrato } — `colore` è una chiave di PRECEDENZA (o null
 *          quando la sagoma non ha niente da dire e resta com'è disegnata).
 */
export function segnoDelTavolo({ selezionato, contoAperto, fasce = [], inRitardo }) {
  const colore = selezionato
    ? "selezionato"
    : contoAperto
      ? "occupato"
      : fasce.length > 1
        ? "misto"
        : (fasce[0] ?? null);
  return { colore, barrato: Boolean(inRitardo) };
}

/**
 * Le voci della legenda, nell'ordine in cui vincono.
 *
 * Ogni schermata passa le chiavi che sa mostrare e la frase con cui chiama
 * la selezione — in Calendario è «i tavoli che stai scegliendo», in Comande
 * «il conto che stai servendo»: la stessa precedenza, due mestieri.
 */
export function vociLegenda(chiavi, testi = {}) {
  return PRECEDENZA.filter((v) => chiavi.includes(v.chiave))
    .sort((a, b) => a.ordine - b.ordine)
    .map((v) => ({ ...v, testo: testi[v.chiave] ?? v.chiave }));
}
