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
// ⚠️ DOVE VIVE LA PRECEDENZA, DOPO IL 18/08. Questa consegna l'aveva scritta
// **due volte**: qui come regola, e in una legenda a schermo che la elencava
// per chi guarda. Alessio ha deciso di **togliere le legende** — le ha
// giudicate superflue — e la conseguenza va detta invece di essere subita:
// **da oggi la precedenza è dichiarata solo nel codice e nel riepilogo del
// giro D2.** Chi entrerà in sala senza aver seguito questi giorni non ha in
// schermata niente che gli spieghi perché un tavolo prenotato per le 20 si è
// fatto scuro. È il posto da cui ripescarla il giorno che servirà.
//
// L'ordine, che è quello scritto nel corpo della funzione:
//   1. SELEZIONATO — è la risposta al dito di chi guarda, e un tavolo che non
//      cambia quando lo si tocca è un tavolo che sembra rotto;
//   2. CONTO APERTO — sono seduti, e la fascia ha già fatto il suo lavoro;
//   3. LA FASCIA ORARIA — presto / pieno / tardi, o «misto» se ce n'è più di
//      una sullo stesso insieme di tavoli;
//   4. niente — il tavolo resta com'è disegnato.
//
// ⚠️ E LA SBARRATURA NON È IN QUESTA GARA: è un secondo canale, che si
// aggiunge sopra qualunque colore. Vedi sotto il perché.

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
 * @returns { colore, barrato } — `colore` è una delle chiavi elencate qui
 *          sopra, oppure null quando la sagoma non ha niente da dire.
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

// =====================================================================
// 4. IL TAVOLONE SI COLORA INTERO — richiesta di Alessio, 18/08
// =====================================================================
//
// *«Non possiamo far sì che i tavoli uniti prenotati o con comande aperte
// cambino tutti di colore?»* — guardando la sua foto: T7·T8·T9 sono un
// tavolone, la prenotazione è agganciata a T8, e T7 e T9 restavano bianchi.
//
// ⚠️ NON È UNA RIFINITURA: È LO STESSO PRINCIPIO DEL GIRO B. Lì un tavolone
// ha **un** numero di coperti e non tre, perché l'unità che si guarda per
// decidere è il gruppo. Se l'unità è il gruppo per il conteggio, deve esserlo
// anche per il colore — altrimenti la stessa sala dice «qui c'è posto per
// otto» e «due di questi tre tavoli sono liberi», che non possono essere vere
// insieme.
//
// ⚠️ E IL CONTO APERTO GIÀ SI COMPORTAVA COSÌ, misurato: un conto sta su un
// INSIEME di tavoli (`order_tables` ha una riga per ciascuno), quindi tutte e
// tre le sagome trovavano il proprio conto e si coloravano. A restare
// indietro era solo la **prenotazione**, che è agganciata ai soli tavoli che
// Alessio ha scelto.
//
// ⚠️ IL CASO INCROCIATO, DICHIARATO INVECE CHE LASCIATO AL CASO. Dal giro C
// sullo stesso tavolone possono esserci due prenotazioni in due fasce diverse
// (un giallo alle 19:30 su T7, un arancio alle 22:30 su T9). Il gruppo NON
// sceglie fra le due e non prende quella «più importante»: le fasce si
// uniscono, e due fasce diverse fanno **«misto»** — che è esattamente la
// regola che già esisteva per due prenotazioni sullo stesso tavolo singolo.
// Nessuna precedenza nuova inventata da chi scrive il codice.
//
// ⚠️ E LA SELEZIONE NON SI PROPAGA, che è l'unica cosa esclusa. Toccare un
// tavolo per aggiungerlo a un conto o a una prenotazione riguarda **quel**
// tavolo: colorando tutto il gruppo, lo schermo prometterebbe di aprirne tre
// mentre ne apre uno. La selezione risponde al dito, e il dito ne ha toccato
// uno solo.

/**
 * Gli insiemi di tavoli con cui la sala si guarda.
 *
 * I gruppi li conta il database (`coperti_del_giorno`), e comprendono anche i
 * tavoli singoli — un tavolo da solo è un insieme di uno. Le sagome che in
 * nessun gruppo compaiono (divani, Chef Table: non sono tavoli e non entrano
 * nel conteggio della cena) diventano insiemi di uno qui, perché anche loro
 * si prenotano e si colorano.
 */
export function insiemiDiTavoli(sagome = [], gruppi = []) {
  const insiemi = gruppi.map((g) => g.tavoli ?? []).filter((t) => t.length > 0);
  const dentro = new Set(insiemi.flat());
  for (const s of sagome) if (!dentro.has(s.id)) insiemi.push([s.id]);
  return insiemi;
}

/**
 * Da un tavolo al suo insieme — la stessa domanda di sopra, girata per chi ha
 * in mano un tavolo e non un gruppo.
 *
 * 🔴 ESISTE PER UN DIFETTO VERO, trovato da Alessio provando il giro D3 e più
 * largo di come si vedeva. Toccando T8 (prenotato) compariva l'avviso «su
 * questi tavoli c'è già…»; toccando T7 — **lo stesso tavolone** — non
 * compariva. E il difetto non era solo nel messaggio: erano **tre** posti a
 * chiedere «chi c'è su QUESTO tavolo» invece che «su questo tavolone» — il
 * tocco (che quindi trattava T7 come libero e andava dritto ai campi), il
 * riquadro, e l'avviso.
 *
 * ⚠️ E il primo dei tre era il peggiore, perché **il tocco contraddiceva il
 * colore**: T7 si vedeva colorato — dal giro D2 il tavolone si colora intero —
 * e si comportava da libero. Tutto il disegno del giro D3 poggia su *«bianco è
 * libero, colorato ha qualcuno»*, e lì quella regola era falsa.
 *
 * La cura è **una strada sola**: gli insiemi li conta già `insiemiDiTavoli`,
 * che è quello che colora la sala. Nessun secondo raggruppamento.
 */
export function insiemiPerTavolo(sagome = [], gruppi = []) {
  const m = new Map();
  for (const insieme of insiemiDiTavoli(sagome, gruppi)) {
    for (const id of insieme) m.set(id, insieme);
  }
  return m;
}

/**
 * Il segno di ogni sagoma, deciso UNA VOLTA PER INSIEME e poi dato a tutti i
 * suoi tavoli.
 *
 * @param sagome  le sagome della pianta
 * @param gruppi  i tavoloni come li conta il database
 * @param fatti   { [sagomaId]: { contoAperto, fasce, inRitardo, selezionato } }
 *                — quello che ciascuna schermata sa del singolo tavolo
 * @returns { [sagomaId]: { colore, barrato } }
 */
export function segniDellaSala({ sagome = [], gruppi = [], fatti = {} }) {
  const segni = {};
  for (const insieme of insiemiDiTavoli(sagome, gruppi)) {
    const dentro = insieme.map((id) => fatti[id] ?? {});
    const delGruppo = segnoDelTavolo({
      contoAperto: dentro.some((f) => f.contoAperto),
      fasce: [...new Set(dentro.flatMap((f) => f.fasce ?? []).filter(Boolean))],
      inRitardo: dentro.some((f) => f.inRitardo),
    });
    for (const id of insieme) {
      // La selezione resta del singolo tavolo, e si rimette qui sopra: è
      // l'unico segno che risponde al dito invece di descrivere il gruppo.
      segni[id] = fatti[id]?.selezionato
        ? { colore: "selezionato", barrato: delGruppo.barrato }
        : delGruppo;
    }
  }
  return segni;
}
