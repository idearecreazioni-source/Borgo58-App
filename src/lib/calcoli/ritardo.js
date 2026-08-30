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
// 🔴 RIFATTO IL 21/08 su decisione di Alessio, e DUE SIGNIFICATI CAMBIANO.
//
// ⚠️ Il MARRONE non dice più «ci sono seduti adesso»: in una sala da tredici
// tavoli quell'informazione si vede guardando la sala. Adesso dice **la
// comanda è partita per la cucina**, che invece non si vede da nessuna parte.
//
// ⚠️ Il VERDE OLIVA non dice più «occupa la serata»: dice **tavolo
// selezionato**. Prima quel posto ce l'aveva il terracotta, che era anche la
// fascia «ultimo giro» — un colore per due cose, ed è l'ambiguità che finisce
// qui.
//
// ⚠️ E DA LÌ NASCE IL COLORE NUOVO: tolto il verde alla fascia di mezzo,
// quella fascia resterebbe senza. L'ambra è il punto medio **misurato** fra i
// suoi due vicini — vedi `index.css`.
//
// 🔴 I DUE PALLINI SONO UNA COPPIA A DUE GRADI, e la forma è la stessa
// apposta: **vuoto = devo tornare al tavolo**, **pieno = devo mandare in
// cucina**. Il pieno è più forte perché è il caso che costa di più: dei
// piatti segnati e mai partiti sono un tavolo che aspetta e una cucina che
// non sa.
//
// ⚠️ E il pallino VUOTO chiude un buco che non aveva nessun segno: un conto
// aperto dove non è ancora stato ordinato niente. Non è marrone (niente è
// partito), non ha il pallino pieno (niente è segnato), e non può vedersi
// come un tavolo libero. Nasce da una scena vera: il cameriere si avvicina e
// i clienti chiedono qualche minuto.
/**
 * Che cosa sta succedendo dentro un conto aperto — i due fatti da cui
 * nascono i pallini.
 *
 * ⚠️ Le righe ANNULLATE non contano, ed è la stessa regola del 16/08 («una
 * riga mai mandata in cucina non entra nel conto»): un piatto stornato non è
 * né qualcosa da mandare né qualcosa che è partito.
 *
 * ⚠️ E i due fatti NON si escludono: metà comanda può essere partita e metà
 * no. Chi decide cosa mostrare è `segnoDelTavolo`, qui si dice solo com'è
 * fatto il conto.
 */
export function statoDelConto(conto) {
  const righe = (conto?.items ?? []).filter((r) => !r.voided_at);
  return {
    comandaInviata: righe.some((r) => r.sent_at),
    daInviare: righe.some((r) => !r.sent_at),
  };
}

// =====================================================================
// COSA VOGLIONO DIRE I SEGNI — l'elenco che legge la legenda
// =====================================================================
//
// 🔴 STA QUI, ACCANTO ALLA FUNZIONE CHE DECIDE LA PRECEDENZA, e non nella
// schermata che lo mostra. L'ordine di questo elenco È l'ordine scritto
// nel corpo di `segnoDelTavolo` qui sotto: chi cambia la precedenza ha la
// legenda sotto gli occhi, e non può cambiarne una senza vedere l'altra.
//
// ⚠️ È la stessa forma decisa il 18/08 per le due legende di allora — *le
// due legende DICHIARANO la precedenza, e l'ordine arriva dallo STESSO
// dato con cui il colore viene deciso*. Quelle sono state tolte; la
// regola con cui erano costruite no.
//
// ⚠️ E una prova pura pretende che i nomi qui elencati siano ESATTAMENTE
// quelli che la pianta sa disegnare: una legenda che spiega un colore che
// non esiste, o che tace su uno che esiste, è una legenda che mente.
export const SEGNI_IN_ORDINE = [
  {
    chiave: "selezionato",
    nome: "Il tavolo che stai toccando",
    dice: "è la risposta al tuo dito: vince su tutto, perché un tavolo che non cambia quando lo tocchi sembra rotto.",
  },
  {
    chiave: "inviata",
    nome: "La comanda è partita",
    dice: "l'ordine è andato in cucina. Non vuol dire «sono seduti»: chi è seduto si vede guardando la sala.",
  },
  {
    chiave: "presto",
    nome: "Primo giro",
    dice: "arrivano entro l'ora del primo turno, quindi il tavolo può servire una seconda volta.",
  },
  {
    chiave: "pieno",
    nome: "A servizio avviato",
    dice: "arrivano dopo il primo giro: il tavolo resta loro per la serata.",
  },
  {
    chiave: "tardi",
    nome: "Ultimo turno",
    dice: "arrivano dopo l'ora degli ultimi arrivi. Non chiude niente: colora il tavolo e basta.",
  },
  {
    chiave: "misto",
    nome: "Più di una fascia",
    dice: "sullo stesso tavolo ci sono orari di fasce diverse — tipicamente un primo giro e un ultimo turno.",
  },
  {
    chiave: "ignota",
    nome: "Non lo so",
    dice: "la prenotazione cade fuori dagli orari del servizio, quindi il gestionale non sa in che fascia metterla. Non è una quarta fascia: è un'informazione che manca.",
  },
  {
    chiave: "ritardo",
    campione: "pieno",
    barrato: true,
    nome: "Doveva essere già qui",
    dice: "l'ora è passata da più della tolleranza e nessuno ha ancora aperto un conto. La sbarratura passa SOPRA il colore, così non toglie l'ora a chi la stava leggendo.",
  },
  {
    chiave: "daInviare",
    campione: "libero",
    pallino: "pieno",
    nome: "C'è roba da mandare in cucina",
    dice: "dei piatti sono segnati e non sono partiti. È il caso che costa di più, per questo il pallino è pieno.",
  },
  {
    chiave: "contoVuoto",
    campione: "libero",
    pallino: "vuoto",
    nome: "Conto aperto e ancora niente",
    dice: "si sono seduti e non hanno ancora ordinato: devi tornare al tavolo.",
  },
  {
    chiave: "libero",
    nome: "Libero",
    dice: "nessuno l'ha prenotato e nessuno ci è seduto.",
  },
];

export function segnoDelTavolo({
  selezionato,
  contoAperto,
  comandaInviata = false,
  daInviare = false,
  fasce = [],
  quante = 0,
  inRitardo,
}) {
  // 🔴 LE FASCE SI DEDUPLICANO QUI DENTRO — 30/08/2026, e l'ha trovato una
  // prova nuova, non una rilettura. La riga diceva `fasce.length > 1`, cioè
  // *«più di una fascia»*, e contava i DOPPIONI: tre prenotazioni della
  // stessa fascia davano «misto», che vuol dire «fasce diverse» ed era
  // falso.
  // ⚠️ Oggi non morde, perché l'unico chiamante (`segniDellaSala`) le
  // deduplica prima. Ma la funzione è pubblica e il nome del parametro non
  // dice «già deduplicate»: il difetto era armato per il prossimo che la
  // chiama. Si toglie il caso invece di scriverlo in un commento.
  const distinte = [...new Set(fasce.filter(Boolean))];
  const colore = selezionato
    ? "selezionato"
    : comandaInviata
      ? "inviata"
      : distinte.length > 1
        ? "misto"
        : (distinte[0] ?? null);

  // ⚠️ Il pieno vince sul vuoto: se c'è roba da mandare, quello è il gesto
  // che manca — anche quando una parte è già partita.
  const pallino = daInviare ? "pieno" : contoAperto && !comandaInviata ? "vuoto" : null;

  // 🔴 QUANTE PRENOTAZIONI CI SONO SOPRA — 30/08/2026, richiesta di Alessio.
  //
  // Lui: *«ho preso tre prenotazioni sullo stesso tavolo alla stessa ora e
  // non è successo niente. E servono più di due tinte per dire che sono
  // tre: due tinte dicono "due"»*.
  //
  // 🔴 MISURATO PRIMA DI CORREGGERE, costruendo la scena sul progetto di
  // prova: tre prenotazioni sullo stesso tavolo alle 20:30 danno **una
  // tinta sola** (`--color-b58-turno`). ⚠️ E non è che il doppio colore «si
  // perda» da qualche parte: **la domanda non è mai stata fatta.** Il
  // colore risponde a *«in che fascia arrivano»*, e tre prenotazioni alla
  // stessa ora sono tutte nella stessa fascia — infatti `fasce` viene
  // ridotta a un valore solo, ed è giusto.
  //
  // ⚠️ E LA CURA NON È UNA TERZA TINTA. Alessio ha ragione che due tinte
  // dicono «due»: ma tre tinte direbbero «tre» e quattro no, e a quel punto
  // servirebbe una legenda per un numero. **Un numero si scrive.** Il
  // colore continua a dire la fascia, la cifra dice quante sono: due canali
  // per due domande, come la sbarratura e il pallino.
  return { colore, barrato: Boolean(inRitardo), pallino, quante: quante > 1 ? quante : 0 };
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
      comandaInviata: dentro.some((f) => f.comandaInviata),
      daInviare: dentro.some((f) => f.daInviare),
      fasce: [...new Set(dentro.flatMap((f) => f.fasce ?? []).filter(Boolean))],
      // ⚠️ QUI NON SI TOGLIE IL DOPPIONE, e la differenza è tutta: le fasce
      // si deduplicano (due prenotazioni della stessa fascia sono una
      // fascia sola), le prenotazioni no — due prenotazioni sono due
      // prenotazioni. È la stessa riga letta con due domande diverse.
      quante: dentro.reduce((n, f) => n + (f.fasce?.length ?? 0), 0),
      inRitardo: dentro.some((f) => f.inRitardo),
    });
    for (const id of insieme) {
      // La selezione resta del singolo tavolo, e si rimette qui sopra: è
      // l'unico segno che risponde al dito invece di descrivere il gruppo.
      // ⚠️ Il pallino NON si perde selezionando: è un canale a sé, come la
      // sbarratura. Un tavolo che aspetta di mandare in cucina continua ad
      // aspettare anche mentre lo si tocca.
      segni[id] = fatti[id]?.selezionato
        ? {
            colore: "selezionato",
            barrato: delGruppo.barrato,
            pallino: delGruppo.pallino,
            // ⚠️ Il numero NON si perde selezionando, come la sbarratura e
            // il pallino: quante persone aspettano quel tavolo resta vero
            // anche mentre lo si tocca.
            quante: delGruppo.quante,
          }
        : delGruppo;
    }
  }
  return segni;
}

// =====================================================================
// IL TAVOLO MOSTRA LA FASCIA CHE DEVE ANCORA ARRIVARE,
// NON QUELLA GIÀ PASSATA
// =====================================================================
// 🔴 LA REGOLA È DI ALESSIO, 21/08/2026, e va tenuta scritta con le sue
// parole: è il criterio che copre anche i casi che nessuno ha nominato.
//
// Nasce da un difetto che ha trovato lui col tablet: chiudendo il conto di
// un tavolo prenotato, **il tavolo tornava «prenotato» invece di
// liberarsi**. Mancava lo stato che dice *è venuto, ha mangiato, se n'è
// andato* — e mordeva dove fa più male, perché il «primo giro» esiste
// apposta perché il tavolo possa servire **due volte**.
//
// I due casi che aveva nominato:
//   · a conto chiuso il tavolo torna libero per la sera;
//   · **ma** se su quel tavolo c'è una SECONDA prenotazione non torna
//     bianco: perde il giallo del primo giro e resta il rosso dell'ultimo
//     turno.
//
// ⚠️ La regola li produce **entrambi senza elencarli**, ed è il motivo per
// cui è scritta come una frase e non come due condizioni: si tolgono le
// fasce già passate, e quello che resta è quello che deve ancora arrivare.

/**
 * Le fasce che un tavolo deve ancora mostrare.
 *
 * @param prenotazioni  gli id delle prenotazioni su quel tavolo
 * @param fasciaDi      id → fascia
 * @param servite       gli id di quelle già servite
 *
 * ⚠️ Un tavolo dove TUTTE le prenotazioni sono state servite non resta
 * grigio o mezzo colorato: **torna bianco**, cioè libero, che è la cosa che
 * il difetto impediva.
 */
export function fascePerIlTavolo(prenotazioni = [], fasciaDi, servite) {
  return prenotazioni
    .filter((id) => !servite?.has(id))
    .map((id) => fasciaDi?.get(id))
    .filter(Boolean);
}
