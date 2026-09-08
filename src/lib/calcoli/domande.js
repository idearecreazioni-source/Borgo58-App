// =====================================================================
// LE RISPOSTE DI MEMO — sola lettura (fase 1: 07/09 · fase 2: 08/09/2026)
// =====================================================================
// 🔴 IL MODELLO CAPISCE LA DOMANDA, IL DATABASE DÀ LA RISPOSTA, E QUESTA
//    REGOLA COMPONE LA FRASE. Nessun numero passa mai dal modello: quello
//    che arriva da lui è soltanto *che cosa* è stato chiesto e *di che
//    cosa*. Tutto quello che si legge a schermo esce da qui, dai dati che
//    il gestionale ha appena letto **col permesso di chi sta guardando**.
//    ⚠️ E IL PERMESSO NON È UNA CORTESIA: le letture passano dal
//    collegamento dell'app, quindi dalla RLS e dai portieri del database.
//    Chi non è titolare, sui saldi della Cassa, non riceve un numero più
//    piccolo — riceve un rifiuto, e MEMO dice «non lo so».
//    ⚠️ È la differenza fra una risposta controllabile e una plausibile:
//    quello che MEMO dice è la stessa cosa che si legge aprendo la
//    schermata, e sotto c'è il collegamento per andarla a guardare.
//
// 🔴 LE RISPOSTE SONO CINQUE, non due, e la distinzione è tutto il valore
//    di questo modulo:
//      · "risposta"     → l'ho letto, ed ecco cosa dice;
//      · "non_lo_so"    → **non sono riuscito a leggere**. Mai un numero,
//                         mai uno zero, mai un elenco vuoto;
//      · "chiarimento"  → ho capito la domanda ma manca il soggetto;
//      · "scegli"       → ho trovato più candidati e NON ne scelgo uno;
//      · "non_so_farlo" → era una domanda, ma non è fra quelle che so.
//    ⚠️ «Non lo so» e «non ce n'è» erano lo stesso `[]` fino al 20/08, ed è
//    la famiglia di difetti che questo progetto insegue da allora. Qui la
//    lettura fallita arriva marcata (`NON_LETTO`) e non può travestirsi da
//    risposta.
//
// ⚠️ E QUESTO MODULO NON PARLA COL DATABASE. Riceve i dati già letti, così
//    tutte le domande — e i casi storti, che sono quelli che contano —
//    si provano senza rete e senza aprire una schermata.

import {
  ALLERGENS,
  formatDate,
  formatEUR,
  labelFor,
  qtaConUnita,
  recipeStatusLabel,
} from "../constants";
import { eDiOggi } from "./agenda";
import { sottoScorta } from "./ingredienti";
import { nonLetto } from "./letture";

// ---------------------------------------------------------------------
// DOVE SI VA A GUARDARE
// ---------------------------------------------------------------------
// ⚠️ Ogni risposta porta un collegamento, comprese quelle che dicono «non
// lo so»: un rifiuto senza gesto d'uscita è un vicolo cieco, e qui il
// gesto d'uscita è andarselo a leggere da sé.
// ⚠️ «dentro» NON È «apri» RIGIRATO, ed è nato da un difetto latente: la
// riga del taglio — «… e altre 14: le trovi tutte …» — ricavava il posto
// tagliando l'articolo dall'etichetta del pulsante con una sostituzione di
// testo. Reggeva finché gli articoli erano «il», «lo» e «l'», cioè finché
// le destinazioni erano cinque. Alla prima femminile — «Apri la Cassa» —
// avrebbe scritto **«le trovi tutte in la Cassa»**: nessun errore, una
// frase storta a schermo. *Un'etichetta è fatta per essere letta intera,
// non per essere smontata.*
export const DOVE = {
  ricettario: { a: "/ricettario/ricette", apri: "Apri il Ricettario", dentro: "nel Ricettario" },
  carta: { a: "/ricettario/ricette", apri: "Apri il Ricettario", dentro: "nel Ricettario" },
  magazzino: { a: "/magazzino", apri: "Apri il Magazzino", dentro: "in Magazzino" },
  scadenze: { a: "/magazzino/scadenze", apri: "Apri lo scadenziario", dentro: "nello scadenziario" },
  agenda: { a: "/agenda", apri: "Apri l'Agenda", dentro: "in Agenda" },

  // --- fase 2 (08/09/2026) --------------------------------------------
  // ⚠️ CASSA E PRIMA NOTA SONO DUE DESTINAZIONI, non una: «quanti soldi ci
  //    sono» si ricontrolla in Cassa, «cosa è uscito» in Prima nota, e
  //    mandare all'una per l'altra fa cercare un numero in una schermata
  //    che non lo mostra.
  cassa: { a: "/cassa", apri: "Apri la Cassa", dentro: "in Cassa" },
  prima_nota: { a: "/cassa/prima-nota", apri: "Apri la Prima nota", dentro: "in Prima nota" },
  // ⚠️ E le due liste della spesa restano due anche qui (SPEC-0012): due
  //    domande, due destinazioni, nessun travaso silenzioso.
  lista: {
    a: "/magazzino/lista-spesa",
    apri: "Apri la lista della spesa",
    dentro: "nella lista della spesa",
  },
  spicciola: {
    a: "/magazzino/spesa-spicciola",
    apri: "Apri la spesa spicciola",
    dentro: "nella spesa spicciola",
  },
  preparazioni: {
    a: "/magazzino/produzioni",
    apri: "Apri le Produzioni",
    dentro: "in Magazzino → Produzioni",
  },
  pulizie: {
    a: "/haccp/pulizia",
    apri: "Apri le pulizie",
    dentro: "in HACCP → Pulizia e sanificazione",
  },
  temperature: {
    a: "/haccp/temperature",
    apri: "Apri le temperature",
    dentro: "in HACCP → Temperature",
  },
  // --- fase 3: quello che deve uscire (08/09/2026) --------------------
  // ⚠️ TRE DESTINAZIONI E NON UNA, e la distinzione è quella che il
  //    gestionale fa già: le **fatture** sono un debito verso qualcuno,
  //    le **scadenze previste** sono soldi che escono senza una fattura
  //    (F24, affitto), gli **ordini** sono roba chiesta e non ancora
  //    arrivata. Mandare all'una per l'altra fa cercare un numero in una
  //    schermata che non ce l'ha.
  fatture: {
    a: "/fatture-fornitori",
    apri: "Apri le fatture",
    dentro: "nelle fatture dei fornitori",
  },
  previsione: {
    a: "/cassa/previsione",
    apri: "Apri «Ce la faccio?»",
    dentro: "in Cassa → Ce la faccio?",
  },
  ordini: { a: "/magazzino/ordini", apri: "Apri gli ordini", dentro: "negli ordini" },

  // --- fase 4: la sala di stasera (08/09/2026) ------------------------
  // ⚠️ TRE DESTINAZIONI, e sono quelle che il gestionale distingue già:
  //    l'ELENCO delle prenotazioni sta in Calendario Eventi, la PIANTA è
  //    un'altra schermata (è lì che si vede dove c'è posto), e gli ORARI
  //    del locale sono dati suoi, in un terzo posto. Mandare all'una per
  //    l'altra fa cercare una cosa dove non c'è.
  calendario: {
    a: "/calendario-eventi",
    apri: "Apri il Calendario",
    dentro: "in Calendario Eventi",
  },
  pianta: {
    a: "/calendario-eventi/pianta",
    apri: "Apri la pianta della sala",
    dentro: "nella pianta della sala",
  },
  orari: {
    a: "/calendario-eventi/sala-e-orari",
    apri: "Apri «Sala e orari»",
    dentro: "in Sala e orari",
  },
};

/**
 * LE DOMANDE CHE MEMO SA FARE, con come si leggono a schermo.
 *
 * ⚠️ QUANTE SONO NON SI SCRIVE DA NESSUNA PARTE, ed è una lezione già
 * pagata: fino al 07/09 il numero «nove» era scritto a mano qui, nelle
 * istruzioni per il modello e in tre commenti. Un conteggio scritto a mano
 * è una frase destinata a diventare falsa — e il giorno dopo lo è
 * diventata. Adesso il numero lo conta chi lo deve dire.
 *
 * ⚠️ I nomi (`chiede`) sono gli stessi che la funzione online dichiara al
 * modello: là vive l'elenco per chi capisce, qui quello per chi mostra.
 * Una prova li confronta, perché due elenchi separati divergono al primo
 * ritocco.
 */
export const DOMANDE_CHE_SO = {
  ricetta_esiste: {
    area: "ricettario",
    dove: "ricettario",
    esempio: "Ho la ricetta della carbonara?",
    titolo: "Ho la ricetta di «{x}»?",
    senzaSoggetto: "Ho questa ricetta?",
    chiarimento: "Di quale piatto?",
  },
  allergeni: {
    area: "ricettario",
    dove: "ricettario",
    esempio: "Quali allergeni ha la carbonara?",
    titolo: "Gli allergeni di «{x}»",
    senzaSoggetto: "Gli allergeni di questo piatto",
    chiarimento: "Di quale piatto?",
  },
  piatti_in_carta: {
    area: "ricettario",
    dove: "carta",
    esempio: "Quali piatti ho in carta?",
    titolo: "Quali piatti ho in carta?",
  },
  quanto_ho: {
    area: "magazzino",
    dove: "magazzino",
    esempio: "Quanto olio ho?",
    titolo: "Quanto «{x}» ho?",
    senzaSoggetto: "Quanto ne ho?",
    chiarimento: "Di che cosa?",
  },
  cosa_manca: {
    area: "magazzino",
    dove: "magazzino",
    esempio: "Cosa mi manca?",
    titolo: "Cosa mi manca?",
  },
  cosa_scade: {
    area: "magazzino",
    dove: "scadenze",
    esempio: "Cosa scade?",
    titolo: "Cosa scade?",
  },
  agenda_oggi: {
    area: "agenda",
    dove: "agenda",
    esempio: "Cosa devo fare oggi?",
    titolo: "Cosa devo fare oggi?",
  },
  agenda_in_ritardo: {
    area: "agenda",
    dove: "agenda",
    esempio: "Cosa sono in ritardo?",
    titolo: "Cosa sono in ritardo?",
  },
  // 🔴 «QUANDO SCADE X» NON E' UNA DOMANDA DELLA SOLA AGENDA — 07/09/2026,
  //    dal collaudo a mano: «quando scade l'astice?» cercava un *impegno*
  //    chiamato astice e non lo trovava. Le cose che scadono in un'osteria
  //    stanno in due posti diversi, e la parola e' la stessa.
  quando_scade: {
    area: "magazzino",
    dove: "scadenze",
    esempio: "Quando scade l'astice?",
    titolo: "Quando scade «{x}»?",
    senzaSoggetto: "Quando scade?",
    chiarimento: "Quale prodotto o quale impegno?",
  },

  // ===================================================================
  // FASE 2 — 08/09/2026
  // ===================================================================
  // 🔴 NESSUNA DI QUESTE CAMBIA NATURA RISPETTO ALLE PRIME NOVE, ed è la
  //    condizione che le fa entrare: si leggono gli stessi dati che si
  //    leggono aprendo la schermata, non si scrive niente, e se
  //    l'assistente non risponde la frase non diventa un appunto.
  saldo_cassa: {
    area: "cassa",
    dove: "cassa",
    esempio: "Quanti soldi ci sono in cassa?",
    titolo: "Quanti soldi ci sono?",
  },
  ultimi_movimenti: {
    area: "cassa",
    dove: "prima_nota",
    esempio: "Quali sono gli ultimi movimenti di cassa?",
    titolo: "Gli ultimi movimenti di cassa",
  },
  cosa_comprare: {
    area: "magazzino",
    dove: "lista",
    esempio: "Cosa devo comprare?",
    titolo: "Cosa devo comprare?",
  },
  cosa_spicciola: {
    area: "magazzino",
    dove: "spicciola",
    esempio: "Cosa c'è nella spesa spicciola?",
    titolo: "Cosa c'è nella spesa spicciola?",
  },
  agenda_prossime: {
    area: "agenda",
    dove: "agenda",
    esempio: "Cosa devo fare questa settimana?",
    titolo: "Cosa c'è questa settimana?",
  },
  ingredienti_ricetta: {
    area: "ricettario",
    dove: "ricettario",
    esempio: "Cosa serve per la carbonara?",
    titolo: "Cosa serve per «{x}»?",
    senzaSoggetto: "Cosa serve per questo piatto?",
    chiarimento: "Di quale piatto?",
  },
  preparazioni_da_fare: {
    area: "magazzino",
    dove: "preparazioni",
    esempio: "Cosa devo preparare?",
    titolo: "Cosa devo preparare?",
  },
  pulizie_oggi: {
    area: "haccp",
    dove: "pulizie",
    esempio: "Cosa devo pulire oggi?",
    titolo: "Cosa devo pulire oggi?",
  },
  temperature_oggi: {
    area: "haccp",
    dove: "temperature",
    esempio: "Quali temperature mancano?",
    titolo: "Le temperature di oggi",
  },

  // ===================================================================
  // FASE 3 — QUELLO CHE DEVE USCIRE (08/09/2026)
  // ===================================================================
  // 🔴 UN GRUPPO, NON QUATTRO DOMANDE SPARSE: sono le quattro facce dello
  //    stesso fatto — quanto deve uscire, quando, a chi, e quanto si può
  //    recuperare. È il posto dove questo progetto ha scritto che si
  //    sbaglia: *«è la cassa di giugno che tradisce, non il totale»*.
  // ⚠️ E NESSUNA DECIDE NIENTE DI NUOVO: quanto si deve a una fattura lo
  //    calcola il database da agosto («da_pagare» = importo meno le note
  //    di credito scalate), e qui si legge quel numero invece di rifarlo.
  fatture_da_pagare: {
    area: "fornitori",
    dove: "fatture",
    esempio: "Quali fatture devo pagare?",
    titolo: "Quali fatture devo pagare?",
  },
  scadenze_previste: {
    area: "cassa",
    dove: "previsione",
    esempio: "Quali scadenze ho segnato?",
    titolo: "Le scadenze da pagare",
  },
  ordini_in_corso: {
    area: "fornitori",
    dove: "ordini",
    esempio: "Cosa ho ordinato?",
    titolo: "Cosa ho ordinato?",
  },
  crediti_fornitore: {
    area: "fornitori",
    dove: "fatture",
    esempio: "Ci sono note di credito da usare?",
    titolo: "Le note di credito da usare",
  },

  // ===================================================================
  // FASE 4 — LA SALA DI STASERA (08/09/2026)
  // ===================================================================
  // 🔴 È L'AREA CHE SI GUARDA CON LE MANI OCCUPATE, ed è la ragione per
  //    cui entra adesso: chi ha prenotato, quanto posto resta, chi
  //    aspetta una risposta e se stasera si lavora sono le quattro cose
  //    che in un'osteria si chiedono a voce mentre si fa altro.
  // ⚠️ E NESSUNA DECIDE NIENTE DI NUOVO: i posti li conta
  //    «posto_per_la_serata()» dal 18/08 — con la sua avvertenza — e i
  //    turni li calcola «turni_del_giorno()». Qui si leggono.
  // ⚠️ LA GIORNATA È QUELLA DEL CALENDARIO, non la serata di servizio: è
  //    la distinzione dichiarata il 19/08 accanto a `oggiLocale()` —
  //    prenotazioni, turni e orari stanno sul calendario, e uniformarli
  //    alla serata sarebbe un difetto, non una pulizia.
  chi_ha_prenotato: {
    area: "sala",
    dove: "calendario",
    esempio: "Chi ha prenotato stasera?",
    titolo: "Chi ha prenotato",
  },
  quanto_posto_ce: {
    area: "sala",
    dove: "pianta",
    esempio: "Quanto posto c'è stasera?",
    titolo: "Quanto posto c'è",
  },
  richieste_da_confermare: {
    area: "sala",
    dove: "calendario",
    esempio: "Ci sono richieste da confermare?",
    titolo: "Le richieste da confermare",
  },
  siamo_aperti: {
    area: "sala",
    dove: "orari",
    esempio: "Quando siamo aperti oggi?",
    titolo: "Gli orari di oggi",
  },
};

// ---------------------------------------------------------------------
// I NOMI, COME LI DICE LUI
// ---------------------------------------------------------------------
// ⚠️ Senza accenti e senza maiuscole: chi detta dice «ragù» e in magazzino
// può esserci scritto «Ragu». Un confronto letterale risponderebbe «non
// ce l'ho» su una cosa che c'è — cioè la bugia peggiore fra quelle che
// questa schermata può dire.
export function normalizza(testo) {
  return String(testo ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * QUANDO UNA SCELTA È GIÀ STATA FATTA, I CANDIDATI SONO UNO SOLO.
 *
 * 🔴 SI SCEGLIE PER IDENTIFICATIVO, MAI PER SOMIGLIANZA DEL NOME, e la
 * differenza non è di forma. Davanti a «Olio» e «Olio di semi», chi ha
 * detto «olio» ha nominato esattamente il primo — e prenderlo per buono
 * sarebbe **scegliere al posto suo**: se intendeva il secondo, la risposta
 * è sbagliata e ha l'aria di essere giusta. Quindi il nome non restringe
 * niente: restringe solo il tocco su un candidato, che porta con sé
 * l'identificativo di quello che è stato toccato.
 *
 * ⚠️ Un identificativo che non trova niente (una riga sparita nel
 * frattempo) NON svuota la risposta: si torna a chiedere quale, che è
 * l'unica cosa onesta.
 */
export function fraICandidati(elenco, scelto, campoId) {
  const righe = elenco ?? [];
  if (!scelto) return righe;
  const uno = righe.filter((r) => r?.[campoId] === scelto);
  return uno.length === 1 ? uno : righe;
}

/** Il nome contiene quello che è stato chiesto? */
export function combacia(nome, cercato) {
  const c = normalizza(cercato);
  if (c === "") return false;
  return normalizza(nome).includes(c);
}

/**
 * IL NOME COMINCIA CON QUELLO CHE È STATO CHIESTO?
 *
 * 🔴 IL DIFETTO CHE CHIUDE, dal collaudo a mano del 07/09/2026: alla
 * domanda «quanto olio ho?» MEMO proponeva i due oli veri **e** «Pomodoro
 * secco di Pachino sott'olio». Quel prodotto la parola «olio» ce l'ha
 * davvero nel nome — ma non è un olio: è un pomodoro.
 *
 * ⚠️ IL CRITERIO NON È UN ELENCO DI PAROLE DA IGNORARE, che invecchierebbe
 * al primo prodotto nuovo. È una proprietà dell'italiano: **il nome della
 * cosa sta in testa**. «Olio extravergine» e «Olio di semi» sono oli;
 * «Pomodoro secco di Pachino sott'olio» è un pomodoro, e lo dice la prima
 * parola. Quello che viene dopo qualifica, non definisce.
 */
export function nominaLaCosa(nome, cercato) {
  const c = normalizza(cercato);
  if (c === "") return false;
  const n = normalizza(nome);
  return n === c || n.startsWith(`${c} `);
}

/**
 * LA FRASE NOMINA L'AGENDA?
 *
 * 🔴 SERVE PERCHE' «SCADERE» VUOL DIRE DUE COSE, e in un'osteria tutte e
 * due sono vere: scade una partita in cella e scade un adempimento. Il
 * gestionale guarda **prima il magazzino** — «quando scade l'astice» parla
 * di un astice — e passa all'Agenda solo se non trova niente, oppure se la
 * frase l'ha nominata.
 *
 * ⚠️ SI GUARDA LA FRASE DETTA, NON QUELLO CHE DICE IL MODELLO: cosi' la
 * precedenza non dipende da come il modello ha classificato quel giorno.
 * E' la stessa scelta di sembraUnaDomanda() nella funzione online.
 *
 * ⚠️ E SBAGLIARE NON FA PERDERE LA RISPOSTA: la precedenza decide solo
 * DOVE si guarda per primo. Se nel posto scelto non c'e' niente, si guarda
 * comunque nell'altro — quindi un riconoscimento mancato costa un ordine
 * diverso, mai un «non lo trovo» su una cosa che c'e'.
 */
const PAROLE_DELL_AGENDA = ["impegno", "impegni", "attivita", "agenda", "adempimento", "adempimenti", "promemoria"];

export function nominaLAgenda(testo) {
  const t = normalizza(testo);
  if (t === "") return false;
  return PAROLE_DELL_AGENDA.some((p) => t === p || t.includes(` ${p} `) || t.startsWith(`${p} `) || t.endsWith(` ${p}`));
}

// ---------------------------------------------------------------------
// LE PAROLE DEL TEMPO
// ---------------------------------------------------------------------
// ⚠️ «Fra -3 giorni» non lo dice nessuno. E il verso conta: in ritardo e in
// arrivo sono due frasi diverse, non lo stesso numero col segno.
export function quandoInParole(giorni) {
  if (giorni == null) return null;
  const n = Number(giorni);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return "oggi";
  if (n === 1) return "domani";
  if (n === -1) return "ieri";
  if (n > 1) return `fra ${n} giorni`;
  return `${-n} giorni fa`;
}

const scadeInParole = (giorni) => {
  const n = Number(giorni);
  if (!Number.isFinite(n)) return "senza scadenza";
  if (n < 0) return `scaduta da ${-n} ${-n === 1 ? "giorno" : "giorni"}`;
  if (n === 0) return "scade oggi";
  if (n === 1) return "scade domani";
  return `scade fra ${n} giorni`;
};

// ---------------------------------------------------------------------
// LE CINQUE FORME DI RISPOSTA
// ---------------------------------------------------------------------
const dove = (chiave) => DOVE[chiave] ?? DOVE.ricettario;

/**
 * QUANTE RIGHE STANNO IN UNA RISPOSTA PARLATA.
 *
 * 🔴 MISURATO SUL PROGETTO DI PROVA, col modello vero: «cosa scade?» ha
 * risposto con **sessantotto righe**. Non è una risposta — è lo
 * scadenziario ricopiato in un riquadro, su un telefono tenuto in una mano
 * sola. *Un elenco che dice tutto non dice niente*, ed è la stessa lezione
 * dello scadenziario del 13/08.
 *
 * ⚠️ IL TAGLIO SI DICHIARA, SEMPRE, e il conteggio nella frase resta quello
 * VERO: «68 partite sono in scadenza» + le prime sei + «e altre 62: le
 * trovi tutte lì». Un elenco tagliato in silenzio è precisamente la
 * famiglia di difetti che questo progetto insegue dal 19/08 — *una risposta
 * più corta che ha l'aria di essere intera*.
 */
export const RIGHE_MOSTRATE = 6;

const risposta = (chiave, frase, righe = [], extra = {}) => {
  const tutte = righe ?? [];
  return {
    stato: "risposta",
    frase,
    righe: tutte.slice(0, RIGHE_MOSTRATE),
    troppe: Math.max(0, tutte.length - RIGHE_MOSTRATE),
    limite: null,
    candidati: [],
    ...dove(chiave),
    ...extra,
  };
};

/**
 * NON LO SO — e si dice PERCHÉ.
 *
 * ⚠️ «Non sono riuscito a leggere» non è «non c'è»: la seconda è una
 * risposta, la prima è l'ammissione che una risposta non c'è. Confonderle
 * è il difetto che `letture.js` esiste per chiudere, e qui sarebbe
 * peggiore che altrove — a schermo comparirebbe un numero.
 */
const nonLoSo = (chiave, cosa) => ({
  stato: "non_lo_so",
  troppe: 0,
  frase: `Non lo so: non sono riuscito a leggere ${cosa}. Non ti do un numero che non ho letto.`,
  righe: [],
  limite: null,
  candidati: [],
  ...dove(chiave),
});

const chiarimento = (chiave, frase) => ({
  stato: "chiarimento",
  troppe: 0,
  frase,
  righe: [],
  limite: null,
  candidati: [],
  ...dove(chiave),
});

/**
 * PIÙ CANDIDATI: SI CHIEDE QUALE, NON SI SCEGLIE.
 *
 * ⚠️ Vale solo dove la risposta CAMBIA a seconda del candidato — quanto ne
 * ho, quali allergeni ha. Dove invece si può rispondere per tutti («ho la
 * ricetta di…», «quando scade…»), elencarli tutti *è* la risposta, e
 * fermarsi a chiedere sarebbe un passaggio in più per niente.
 */
const scegli = (chiave, frase, candidati, extra = {}) => {
  // ⚠️ ANCHE I CANDIDATI SONO UN ELENCO, e su un magazzino vero «quanto
  //    pomodoro ho?» può trovarne quindici: quindici pulsanti su un telefono
  //    tenuto in una mano non sono una domanda, sono un muro. Si taglia come
  //    gli altri elenchi, **dichiarandolo**, e la frase continua a dire il
  //    numero vero.
  const tutti = candidati ?? [];
  return {
    stato: "scegli",
    frase,
    righe: [],
    troppe: Math.max(0, tutti.length - RIGHE_MOSTRATE),
    limite: null,
    candidati: tutti.slice(0, RIGHE_MOSTRATE),
    ...dove(chiave),
    ...extra,
  };
};

/**
 * ERA UNA DOMANDA, MA NON È FRA QUELLE CHE SO.
 *
 * ⚠️ QUESTO ELENCO NON SI TAGLIA, ed è l'unica risposta che fa eccezione:
 * le altre elencano **dati** — e lì sei righe bastano, il resto si va a
 * guardare nella sua schermata. Queste non sono dati: sono *cosa MEMO sa
 * fare*, e mostrarne sei significherebbe nascondere le altre senza nessun
 * posto dove andarle a leggere. Il taglio ha senso quando esiste un
 * «tutte» da qualche parte.
 * ⚠️ IL PREZZO SI DICHIARA, perché a ogni fase cresce: su un telefono
 * questo elenco è ormai lungo. Resta la scelta meno peggio finché non
 * esiste una schermata che le elenchi tutte; il giorno che quella
 * schermata ci fosse, questa risposta ne mostrerebbe sei e manderebbe lì.
 * ⚠️ E quante righe siano non si scrive qui: sarebbe la stessa frase
 * destinata a diventare falsa che questo file ha già tolto due volte.
 *
 * ⚠️ E LA VIA D'USCITA C'È QUANDO IL MODELLO HA CAPITO L'AREA: «quanto mi
 * costa la carbonara» è una domanda di Ricettario che MEMO non sa fare, e
 * lì mandare al Ricettario è utile. Se l'area non è stata capita non si
 * inventa una destinazione — un collegamento messo per riempire il posto
 * manderebbe a cercare in una schermata scelta a caso.
 */
const nonSoFarlo = (area) => ({
  stato: "non_so_farlo",
  frase:
    "Questa domanda non la so ancora fare. Per ora so rispondere a queste, e a nient'altro:",
  righe: Object.entries(DOMANDE_CHE_SO).map(([chiede, d]) => ({
    chiave: chiede,
    testo: d.esempio,
  })),
  troppe: 0,
  limite: null,
  candidati: [],
  ...(DOVE[area] ?? { a: null, apri: null }),
});

// =====================================================================
// RICETTARIO
// =====================================================================

const nomeRicetta = (r) => r?.name ?? "senza nome";

const statoDellaRicetta = (r) =>
  recipeStatusLabel(r?.pronta_per_carta, r?.in_carta, r?.ritirata_il)?.label ?? "in sviluppo";

const rigaRicetta = (r) => ({
  chiave: r.id,
  testo: `${nomeRicetta(r)} — ${statoDellaRicetta(r)}`,
  a: `/ricettario/ricette/${r.id}`,
});

/**
 * LE RICETTE CHE SI CHIAMANO COSÌ, e quelle che si sono lasciate fuori.
 *
 * 🔴 È LA STESSA REGOLA DEL MAGAZZINO (07/09/2026, dal collaudo a mano):
 * **chi nomina la cosa viene prima di chi la contiene**. Là «olio» pescava
 * «Pomodoro secco di Pachino sott'olio»; qui «pesto» pescherebbe
 * «Busiate al pesto alla trapanese» insieme al pesto vero, e MEMO
 * chiederebbe «di quale?» avendo davanti una risposta sola.
 *
 * ⚠️ VIVE IN UN POSTO SOLO PERCHÉ LA USANO IN DUE: la regola che compone
 * la frase **e** la lettura che decide se andare a prendere gli allergeni.
 * Se divergessero, la lettura direbbe «sono due, non li leggo» e la regola
 * ne sceglierebbe una: MEMO risponderebbe «non lo so» su un piatto che ha
 * appena riconosciuto.
 *
 * ⚠️ E LA RICERCA DENTRO IL NOME NON SI TOGLIE, si mette dopo: chi chiede
 * «trapanese» deve continuare a trovare le busiate. Si guarda in testa;
 * **solo se in testa non c'è nessuna** si torna a guardare dentro.
 *
 * ⚠️ QUELLO CHE SI LASCIA FUORI SI DICHIARA. Una scrematura silenziosa è la
 * stessa famiglia dell'elenco tagliato senza dirlo.
 */
export function candidatiRicetta(ricette, soggetto) {
  const tutte = ricette ?? [];
  if (!soggetto) return { scelte: tutte, scremate: null };

  const intestate = tutte.filter((r) => nominaLaCosa(nomeRicetta(r), soggetto));
  const scelte = intestate.length > 0 ? intestate : tutte;
  const fuori = tutte.filter((r) => !scelte.includes(r));

  return {
    scelte,
    scremate: fuori.length
      ? `Ho lasciato fuori ${
          fuori.length === 1 ? "una ricetta che ha" : `${fuori.length} ricette che hanno`
        } «${soggetto}» nel nome senza chiamarsi così (per esempio «${nomeRicetta(fuori[0])}»).`
      : null,
  };
}


function ricettaEsiste(soggetto, ricette) {
  if (nonLetto(ricette)) return nonLoSo("ricettario", "il Ricettario");
  if (!soggetto) return chiarimento("ricettario", DOMANDE_CHE_SO.ricetta_esiste.chiarimento);

  const { scelte: trovate, scremate } = candidatiRicetta(ricette, soggetto);
  // 🔴 «NON L'HO TROVATA» SI DICE SOLO DOPO AVER CERCATO DAVVERO, ed è la
  //    ragione per cui la lettura fallita non arriva mai fin qui.
  if (trovate.length === 0) {
    return risposta(
      "ricettario",
      `No: non ho nessuna ricetta che si chiami «${soggetto}».`,
    );
  }
  if (trovate.length === 1) {
    const r = trovate[0];
    return risposta("ricettario", `Sì: «${nomeRicetta(r)}» — ${statoDellaRicetta(r)}.`, [], {
      a: `/ricettario/ricette/${r.id}`,
      apri: "Apri la ricetta",
      limite: scremate,
    });
  }
  return risposta(
    "ricettario",
    `Sì: ne ho ${trovate.length} che contengono «${soggetto}».`,
    trovate.map(rigaRicetta),
    { limite: scremate },
  );
}

const nomeAllergene = (a) => labelFor(ALLERGENS, a);

function allergeniDi(soggetto, allergeneChiesto, ricette, allergeni, scelto) {
  if (nonLetto(ricette)) return nonLoSo("ricettario", "il Ricettario");
  if (!soggetto) return chiarimento("ricettario", DOMANDE_CHE_SO.allergeni.chiarimento);

  // ⚠️ Gli stessi candidati della lettura: se qui si scegliesse in un
  //    altro modo, gli allergeni letti sarebbero di un'altra ricetta.
  const { scelte, scremate } = candidatiRicetta(ricette, soggetto);
  const trovate = fraICandidati(scelte, scelto, "id");
  if (trovate.length === 0) {
    return risposta(
      "ricettario",
      `Non ho nessuna ricetta che si chiami «${soggetto}»: degli allergeni non ti so dire niente.`,
    );
  }
  if (trovate.length > 1) {
    return scegli(
      "ricettario",
      `Ne ho ${trovate.length} che contengono «${soggetto}»: di quale?`,
      trovate.map((r) => ({ chiave: r.id, testo: nomeRicetta(r), soggetto: nomeRicetta(r) })),
      { limite: scremate },
    );
  }

  const r = trovate[0];
  if (nonLetto(allergeni) || !allergeni) {
    return nonLoSo("ricettario", `gli allergeni di «${nomeRicetta(r)}»`);
  }

  const dentro = allergeni.allergens ?? [];
  const tracce = allergeni.tracce ?? [];
  const daVerificare = allergeni.daVerificare === true;
  const scoperti = allergeni.ingredienti ?? [];
  const apri = { a: `/ricettario/ricette/${r.id}`, apri: "Apri la ricetta" };

  // ⚠️ IL LIMITE VA DETTO ANCHE QUANDO LA RISPOSTA C'È: un elenco allergeni
  //    di un piatto i cui ingredienti nessuno ha guardato non è un elenco
  //    completo, ed è la lezione del 13/08 — un elenco vuoto si legge «non
  //    contiene allergeni», e su un'allergia quella lettura è un problema
  //    di salute prima che di software.
  // ⚠️ E le due avvertenze stanno insieme: quella sugli ingredienti mai
  //    guardati e quella sulle ricette lasciate fuori rispondono a due
  //    domande diverse, e tenerne una sola ne nasconderebbe una.
  const limite = [
    daVerificare
      ? `Attenzione: di ${scoperti.length === 1 ? "un ingrediente" : `${scoperti.length} ingredienti`} gli allergeni non li ha guardati nessuno${
          scoperti.length ? ` (${scoperti.join(", ")})` : ""
        }. L'elenco può essere incompleto.`
      : null,
    scremate,
  ]
    .filter(Boolean)
    .join(" ") || null;

  if (allergeneChiesto) {
    const cercato = normalizza(allergeneChiesto);
    const combaciaAllergene = (a) =>
      normalizza(a) === cercato || normalizza(nomeAllergene(a)) === cercato;
    const nome = nomeAllergene(
      dentro.find(combaciaAllergene) ?? tracce.find(combaciaAllergene) ?? allergeneChiesto,
    );

    if (dentro.some(combaciaAllergene)) {
      return risposta("ricettario", `Sì: «${nomeRicetta(r)}» contiene ${nome}.`, [], {
        ...apri,
        limite,
      });
    }
    if (tracce.some(combaciaAllergene)) {
      return risposta(
        "ricettario",
        `«${nomeRicetta(r)}» non contiene ${nome}, ma può contenerne tracce.`,
        [],
        { ...apri, limite },
      );
    }
    // 🔴 QUI IL «NO» NON SI PUÒ DARE, e questa è la riga più importante del
    //    modulo. Se di qualche ingrediente nessuno ha guardato gli
    //    allergeni, «non contiene sedano» è una promessa che nessuno può
    //    mantenere — e chi la legge la gira a un cliente.
    if (daVerificare) {
      return {
        ...nonLoSo("ricettario", `tutti gli ingredienti di «${nomeRicetta(r)}»`),
        frase: `Non te lo so dire: di ${
          scoperti.length === 1 ? "un ingrediente" : `${scoperti.length} ingredienti`
        } gli allergeni non li ha guardati nessuno${
          scoperti.length ? ` (${scoperti.join(", ")})` : ""
        }, quindi «non contiene ${nome}» non te lo posso garantire.`,
        ...apri,
      };
    }
    return risposta("ricettario", `No: «${nomeRicetta(r)}» non contiene ${nome}.`, [], apri);
  }

  if (dentro.length === 0 && !daVerificare) {
    return risposta("ricettario", `«${nomeRicetta(r)}» non contiene nessun allergene.`, [], apri);
  }
  return risposta(
    "ricettario",
    dentro.length === 0
      ? `Di «${nomeRicetta(r)}» non risulta nessun allergene, ma l'elenco non è completo.`
      : `«${nomeRicetta(r)}» contiene: ${dentro.map(nomeAllergene).join(", ")}.`,
    tracce.length
      ? [{ chiave: "tracce", testo: `Può contenere tracce di: ${tracce.map(nomeAllergene).join(", ")}` }]
      : [],
    { ...apri, limite },
  );
}

function piattiInCarta(ricette) {
  if (nonLetto(ricette)) return nonLoSo("carta", "il Ricettario");
  const inCarta = ricette ?? [];
  if (inCarta.length === 0) {
    return risposta("carta", "Non c'è nessun piatto in carta.");
  }
  return risposta(
    "carta",
    inCarta.length === 1 ? "In carta c'è un piatto solo:" : `In carta ci sono ${inCarta.length} piatti:`,
    inCarta.map((r) => ({
      chiave: r.id,
      testo: nomeRicetta(r),
      a: `/ricettario/ricette/${r.id}`,
    })),
  );
}

// =====================================================================
// MAGAZZINO
// =====================================================================

const quantoNeHo = (g) => qtaConUnita(g.current_quantity, g.unit);

function quantoHo(soggetto, giacenze, scelto, oggi = null) {
  if (nonLetto(giacenze)) return nonLoSo("magazzino", "il Magazzino");
  if (!soggetto) return chiarimento("magazzino", DOMANDE_CHE_SO.quanto_ho.chiarimento);

  const combacianti = (giacenze ?? []).filter((g) => combacia(g.ingredient_name, soggetto));

  // 🔴 CHI NOMINA LA COSA VIENE PRIMA DI CHI LA CONTIENE — 07/09/2026, dal
  //    collaudo a mano di Alessio. Fra i candidati per «olio» compariva
  //    «Pomodoro secco di Pachino sott'olio»: una parola dentro il nome
  //    trattata come se definisse il prodotto.
  // ⚠️ E LA RICERCA DENTRO IL NOME NON SI TOGLIE, si mette dopo: senza,
  //    chiedere «pachino» o «extravergine» — cioè con una parola che in
  //    testa non c'è — non troverebbe più niente, e un prodotto
  //    diventerebbe irraggiungibile. Si guarda in testa; **solo se in testa
  //    non c'è nessuno** si torna a guardare dentro.
  const intestati = combacianti.filter((g) => nominaLaCosa(g.ingredient_name, soggetto));
  const candidati = intestati.length > 0 ? intestati : combacianti;

  // ⚠️ E QUELLO CHE SI LASCIA FUORI SI DICHIARA. Una scrematura silenziosa è
  //    la stessa famiglia dell'elenco tagliato senza dirlo: chi guarda non
  //    ha modo di sapere che il gestionale ha scelto per lui.
  const fuori = combacianti.filter((g) => !candidati.includes(g));
  const scremati = fuori.length
    ? `Ho lasciato fuori ${fuori.length === 1 ? "un prodotto che ha" : `${fuori.length} prodotti che hanno`} «${soggetto}» nel nome senza esserlo (per esempio «${fuori[0].ingredient_name}»).`
    : null;

  const trovati = fraICandidati(candidati, scelto, "ingredient_id");

  // 🔴 «NON CE L'HO» NON È «ZERO». Uno zero si legge «l'ho finito», e non è
  //    la stessa cosa di «questa roba in magazzino non esiste proprio».
  if (trovati.length === 0) {
    return risposta("magazzino", `«${soggetto}» non ce l'ho in magazzino: non lo trovo fra i prodotti.`);
  }
  if (trovati.length > 1) {
    return scegli(
      "magazzino",
      `Ne ho ${trovati.length} che si chiamano così: di quale?`,
      trovati.map((g) => ({
        chiave: g.ingredient_id,
        testo: g.ingredient_name,
        soggetto: g.ingredient_name,
      })),
      { limite: scremati },
    );
  }

  const g = trovati[0];

  // 🔴 UN PRODOTTO FUORI MAGAZZINO NON HA UN NUMERO DA DIRE, e questa non è
  //    una rifinitura: il Magazzino, al posto della giacenza, scrive
  //    **«fuori magazzino»** — perché quel numero è quello dell'ultimo
  //    carico e non scenderà mai. Dirlo con una cifra sarebbe *informazione
  //    di assenza spacciata per misura*, e uno zero si legge «l'ho finito».
  //    ⚠️ L'ha trovato la revisione del diff: la prima stesura rispondeva
  //    «Ghiaccio secco: 0 kg» e ci metteva sotto un'avvertenza. Ma
  //    **un'avvertenza accanto non sana il numero**, e soprattutto la
  //    risposta di MEMO non sarebbe più stata la stessa cosa che si legge
  //    aprendo la schermata — cioè la promessa su cui poggia tutta la fase 1.
  if (g.tenuto_in_magazzino === false) {
    return risposta(
      "magazzino",
      `«${g.ingredient_name}» ce l'hai, ma non lo tieni in magazzino: la giacenza non la seguo.`,
      [],
      {
        limite:
          "Di questi prodotti il gestionale non conta quello che entra e quello che esce: si comprano quando servono.",
      },
    );
  }

  const righe = [];
  if (g.below_threshold) {
    righe.push({
      chiave: "soglia",
      testo: `È sotto la scorta minima (${qtaConUnita(g.stock_minimum_threshold, g.unit)}).`,
    });
  }
  if (g.nearest_expiry) {
    // 🔴 UNA PARTITA GIÀ SCADUTA NON SI DICE COME UNA CHE SCADRÀ —
    //    07/09/2026, visto guardando: «Astice: 15 kg · la prima partita
    //    scade il 2 ago 2026» è una data passata raccontata al futuro, e
    //    chi la legge la prende per buona.
    // ⚠️ E lo stesso MEMO la diceva già bene da un'altra porta: «quando
    //    scade l'astice?» rispondeva «è già scaduta». Due risposte dello
    //    stesso gestionale sullo stesso fatto non possono raccontarlo in
    //    due modi — è la famiglia che questo progetto insegue dal 19/08.
    const gia = oggi && String(g.nearest_expiry) < String(oggi);
    righe.push({
      chiave: "scadenza",
      testo: gia
        ? `La prima partita è scaduta il ${formatDate(g.nearest_expiry)}.`
        : `La prima partita scade il ${formatDate(g.nearest_expiry)}.`,
    });
  }

  return risposta("magazzino", `${g.ingredient_name}: ${quantoNeHo(g)}.`, righe, {
    limite: scremati,
  });
}

function cosaManca(giacenze) {
  if (nonLetto(giacenze)) return nonLoSo("magazzino", "il Magazzino");
  const tutte = giacenze ?? [];
  // 🔴 STESSO CRITERIO DELLA SCHERMATA, riga per riga: un prodotto fuori
  //    magazzino **non è mai «sotto soglia»** — la sua giacenza non scende,
  //    quindi il confronto non vuol dire niente, e in lista della spesa non
  //    ci entra comunque. Contarlo qui farebbe dire a MEMO che manca una
  //    cosa che il Magazzino non segnala: due parti dello stesso gestionale
  //    che raccontano cose diverse dello stesso fatto.
  const sotto = tutte.filter(sottoScorta);

  // ⚠️ IL LIMITE È LA META' DELLA RISPOSTA. Sotto la scorta minima ci va
  //    solo chi una scorta minima ce l'ha: senza dirlo, un «non manca
  //    niente» sembrerebbe una fotografia del magazzino intero mentre è la
  //    fotografia dei soli prodotti che qualcuno ha impostato.
  const senzaSoglia = tutte.filter(
    (g) => g.stock_minimum_threshold == null && g.tenuto_in_magazzino !== false,
  ).length;
  const limite = senzaSoglia
    ? `${senzaSoglia === 1 ? "Un prodotto non ha" : `${senzaSoglia} prodotti non hanno`} una scorta minima: ${senzaSoglia === 1 ? "quello" : "quelli"} qui non ${senzaSoglia === 1 ? "può" : "possono"} comparire.`
    : null;

  if (sotto.length === 0) {
    return risposta("magazzino", "Non manca niente: nessun prodotto è sotto la scorta minima.", [], {
      limite,
    });
  }
  return risposta(
    "magazzino",
    sotto.length === 1 ? "Manca una cosa:" : `Mancano ${sotto.length} cose:`,
    sotto.map((g) => ({
      chiave: g.ingredient_id,
      testo: `${g.ingredient_name}: ne hai ${quantoNeHo(g)}, la scorta minima è ${qtaConUnita(g.stock_minimum_threshold, g.unit)}`,
    })),
    { limite },
  );
}

function cosaScade(partite) {
  if (nonLetto(partite)) return nonLoSo("scadenze", "lo scadenziario");
  const tutte = partite ?? [];
  const segnalate = tutte.filter((p) => p.da_segnalare === true);

  // ⚠️ Lo scadenziario tace su certe partite APPOSTA (ne è entrata una più
  //    recente, non c'è scadenza, il preavviso è lontano) e dice perché.
  //    Quel silenzio si dichiara: «non scade niente» senza il numero delle
  //    mute è più corto del vero.
  const mute = tutte.length - segnalate.length;
  const limite = mute
    ? `${mute === 1 ? "Un'altra partita non è segnalata" : `Altre ${mute} partite non sono segnalate`}: il motivo è scritto nello scadenziario.`
    : null;

  if (segnalate.length === 0) {
    return risposta("scadenze", "Non scade niente: nessuna partita è da segnalare.", [], { limite });
  }
  return risposta(
    "scadenze",
    segnalate.length === 1 ? "Una partita è in scadenza:" : `${segnalate.length} partite sono in scadenza:`,
    segnalate.map((p) => ({
      chiave: p.lotto_id,
      testo: `${p.ingrediente}: ${qtaConUnita(p.quantita, p.unita)}, ${scadeInParole(p.giorni_mancanti)}${
        p.scadenza ? ` (${formatDate(p.scadenza)})` : ""
      }`,
    })),
    { limite },
  );
}

// =====================================================================
// AGENDA
// =====================================================================

const rigaImpegno = (t) => ({
  chiave: t.id,
  testo: `${t.title}${t.due_date ? ` — ${formatDate(t.due_date)}` : ""}`,
  a: `/agenda/${t.id}`,
});

function agendaOggi(impegni) {
  if (nonLetto(impegni)) return nonLoSo("agenda", "l'Agenda");
  const tutti = impegni ?? [];
  // 🔴 LA REGOLA DI «OGGI» È QUELLA DELL'AGENDA, non una seconda scritta
  //    qui: fino al 07/09 questa riga diceva `Number(...) === 0` e
  //    `Number(null)` **vale zero**, quindi ogni impegno SENZA scadenza
  //    risultava di oggi. Misurato sul progetto di prova: l'Agenda ne
  //    contava 0, MEMO ne annunciava 15.
  const oggi = tutti.filter(eDiOggi);
  const inRitardo = tutti.filter((t) => t.corsia === "in_ritardo").length;

  // ⚠️ Il ritardo si dice ANCHE quando oggi non c'è niente: «per oggi non
  //    hai niente» con quattordici scadute dietro è vero e fuorviante.
  const limite = inRitardo
    ? `${inRitardo === 1 ? "C'è però un impegno in ritardo" : `Ci sono però ${inRitardo} impegni in ritardo`}.`
    : null;

  if (oggi.length === 0) {
    return risposta("agenda", "Per oggi non hai niente segnato.", [], { limite });
  }
  return risposta(
    "agenda",
    oggi.length === 1 ? "Oggi hai una cosa:" : `Oggi hai ${oggi.length} cose:`,
    oggi.map(rigaImpegno),
    { limite },
  );
}

function agendaInRitardo(impegni) {
  if (nonLetto(impegni)) return nonLoSo("agenda", "l'Agenda");
  const tardi = (impegni ?? []).filter((t) => t.corsia === "in_ritardo");
  if (tardi.length === 0) {
    return risposta("agenda", "Non sei in ritardo su niente.");
  }
  return risposta(
    "agenda",
    tardi.length === 1 ? "Sei in ritardo su una cosa:" : `Sei in ritardo su ${tardi.length} cose:`,
    tardi.map((t) => ({
      ...rigaImpegno(t),
      testo: `${t.title} — scadeva ${quandoInParole(t.giorni_alla_scadenza) ?? "prima"}`,
    })),
  );
}

/**
 * QUANDO SCADE UNA PARTITA IN MAGAZZINO.
 *
 * ⚠️ La domanda e' «quando», quindi la risposta e' una DATA — e le partite
 * sono piu' d'una: si dicono tutte, con quanto ce n'e'. Il confronto con
 * oggi si fa su due date scritte allo stesso modo (AAAA-MM-GG), quindi e'
 * un confronto di testo e non tocca nessun orologio.
 */
function scadenzaDelProdotto(nome, partite, oggi) {
  const conScadenza = partite.filter((p) => p.scadenza);
  const senza = partite.length - conScadenza.length;
  const limite = senza
    ? `${senza === 1 ? "Una partita non ha" : `${senza} partite non hanno`} una scadenza scritta.`
    : null;

  if (conScadenza.length === 0) {
    return risposta(
      "scadenze",
      `Di «${nome}» non c'è nessuna partita con una scadenza scritta.`,
      [],
      { limite },
    );
  }

  const ordinate = [...conScadenza].sort((a, b) => String(a.scadenza).localeCompare(String(b.scadenza)));
  const prima = ordinate[0];
  const scaduta = oggi && String(prima.scadenza) < String(oggi);

  return risposta(
    "scadenze",
    ordinate.length === 1
      ? `${nome}: scade il ${formatDate(prima.scadenza)}${scaduta ? " — è già scaduta" : ""}.`
      : `${nome}: la prima delle ${ordinate.length} partite scade il ${formatDate(prima.scadenza)}${scaduta ? " — è già scaduta" : ""}.`,
    ordinate.map((p) => ({
      chiave: p.lotto_id,
      testo: `${qtaConUnita(p.giacenza, p.unita)} — ${formatDate(p.scadenza)}${
        oggi && String(p.scadenza) < String(oggi) ? " (scaduta)" : ""
      }`,
    })),
    { limite },
  );
}

/**
 * QUANDO SCADE — e la cosa che scade puo' stare in due posti.
 *
 * 🔴 IL DIFETTO CHE CHIUDE, dal collaudo a mano del 07/09/2026: «quando
 * scade l'astice?» cercava un IMPEGNO chiamato astice, e rispondeva che non
 * lo trovava. L'astice sta in cella.
 *
 * ⚠️ IL MAGAZZINO VIENE PRIMA, l'Agenda dopo — a meno che la frase non
 * nomini l'Agenda. E chi non trova niente nel posto scelto **guarda
 * comunque nell'altro**: la precedenza decide l'ordine, non l'esito.
 */
function quandoScade(soggetto, letture, scelto) {
  const impegni = letture.impegni;
  const partite = letture.partite;
  const oggi = letture.oggi ?? null;
  const primaLAgenda = letture.agendaEsplicita === true;

  // ⚠️ Se ne'e' letta nessuna delle due, non si sa e basta.
  if (nonLetto(impegni) && nonLetto(partite)) return nonLoSo("scadenze", "il Magazzino e l'Agenda");
  if (!soggetto) return chiarimento("scadenze", DOMANDE_CHE_SO.quando_scade.chiarimento);

  const inMagazzino = nonLetto(partite) ? [] : (partite ?? []);
  const combacianti = inMagazzino.filter((p) => combacia(p.prodotto, soggetto));
  const intestate = combacianti.filter((p) => nominaLaCosa(p.prodotto, soggetto));
  const dellaCosa = intestate.length > 0 ? intestate : combacianti;

  // 🔴 LE PARTITE SI RAGGRUPPANO PER PRODOTTO, e non è una rifinitura —
  //    misurato sul progetto di prova il 07/09/2026: **120 coppie** di
  //    prodotti in cui uno è la testa dell'altro, fra cui «Sale» e «Sale
  //    marino di Trapani», «Coniglio» e «Coniglio in agrodolce». Senza il
  //    raggruppamento, «quando scade il sale?» rispondeva **col nome del
  //    primo** e le date di tutt'e due: un numero di partite che non
  //    esiste, sotto un nome che ne copre un altro.
  // ⚠️ E LA CURA È QUELLA CHE IL MAGAZZINO USA GIÀ: quando i prodotti sono
  //    più d'uno **si chiede quale**, non se ne sceglie uno in silenzio.
  //    Due risposte dello stesso MEMO davanti alla stessa ambiguità non
  //    possono comportarsi in due modi.
  const perProdotto = new Map();
  for (const riga of dellaCosa) {
    const chiave = riga.ingrediente_id ?? riga.prodotto;
    if (!perProdotto.has(chiave)) perProdotto.set(chiave, []);
    perProdotto.get(chiave).push(riga);
  }
  const gruppi = [...perProdotto.entries()].map(([chiave, righe]) => ({
    chiave,
    righe,
    prodotto: righe[0].prodotto,
  }));

  // ⚠️ IL TOCCO LO CHIUDE `fraICandidati`, LA STESSA FUNZIONE DEL RESTO DI
  //    MEMO, e non una scelta riscritta qui: la sua regola è che una
  //    scelta che non combacia **non fa sparire i candidati**, si torna a
  //    chiedere. Scrivendola a mano avevo ottenuto il contrario — con un
  //    prodotto solo e una scelta vecchia addosso, MEMO avrebbe chiesto
  //    «ne ho 1: di quale?», che è una domanda senza risposta possibile.
  const scelti = fraICandidati(gruppi, scelto, "chiave");
  const gruppo = scelti.length === 1 ? scelti[0] : null;

  const inAgenda = nonLetto(impegni) ? [] : (impegni ?? []).filter((t) => combacia(t.title, soggetto));

  // ⚠️ Quando la cosa sta in tutt'e due i posti non si sceglie in silenzio:
  //    si risponde dove dice la precedenza e si DICHIARA l'altra.
  const anche = (dove, quanti) =>
    quanti > 0
      ? `C'è anche ${quanti === 1 ? "una cosa" : `${quanti} cose`} che si chiama così ${dove}.`
      : null;

  // ⚠️ «Ce n'è anche un'altra» conta i PRODOTTI, non le partite: tre lotti
  //    dello stesso astice sono una cosa sola, e dire «ce ne sono anche 3»
  //    farebbe cercare due prodotti che non esistono.
  const dallaScadenza = () => {
    if (!gruppo) {
      return scegli(
        "scadenze",
        `Ne ho ${scelti.length} che si chiamano così: di quale?`,
        scelti.map((g) => ({ chiave: g.chiave, testo: g.prodotto, soggetto: g.prodotto })),
        { limite: anche("in Agenda", inAgenda.length) },
      );
    }
    const r = scadenzaDelProdotto(gruppo.prodotto, gruppo.righe, oggi);
    return { ...r, limite: [r.limite, anche("in Agenda", inAgenda.length)].filter(Boolean).join(" ") || null };
  };

  if (primaLAgenda && inAgenda.length > 0) {
    return daAgenda(soggetto, inAgenda, anche("in magazzino", gruppi.length));
  }
  if (!primaLAgenda && gruppi.length > 0) return dallaScadenza();
  if (inAgenda.length > 0) return daAgenda(soggetto, inAgenda, null);
  if (gruppi.length > 0) return dallaScadenza();

  // 🔴 «NON LO TROVO» SI PUÒ DIRE SOLO SE SI È GUARDATO IN TUTT'E DUE I
  //    POSTI. Se una delle due letture è caduta, «non c'è» sarebbe la
  //    bugia peggiore: è la regola del 19/08 — assenza di informazione e
  //    informazione di assenza sono due cose diverse.
  if (nonLetto(partite)) return nonLoSo("scadenze", "il Magazzino");
  if (nonLetto(impegni)) return nonLoSo("agenda", "l'Agenda");

  // ⚠️ E quando le ha guardate tutte e due lo DICE: senza, «non lo trovo»
  //    non fa capire dove è stato cercato.
  return risposta(
    "scadenze",
    `Non trovo niente che si chiami «${soggetto}»: né fra le cose in magazzino, né fra gli impegni da fare.`,
    [],
    { limite: "Degli impegni guardo solo quelli ancora da fare, e del magazzino solo le partite ancora in casa." },
  );
}

function daAgenda(soggetto, trovati, anche) {
  // ⚠️ L'Agenda a corsie porta i soli impegni APERTI: uno già fatto non
  //    compare, e va detto — altrimenti «non lo trovo» si legge «non esiste».
  const limite = [
    "Guardo solo gli impegni ancora da fare: quelli già fatti non li vedo.",
    anche,
  ]
    .filter(Boolean)
    .join(" ");

  if (trovati.length === 1) {
    const t = trovati[0];
    if (!t.due_date) {
      return risposta("agenda", `«${t.title}» non ha una scadenza: è fra le cose da fare quando capita.`, [], {
        a: `/agenda/${t.id}`,
        apri: "Apri l'impegno",
        limite,
      });
    }
    return risposta(
      "agenda",
      `«${t.title}» scade il ${formatDate(t.due_date)} — ${quandoInParole(t.giorni_alla_scadenza)}.`,
      [],
      { a: `/agenda/${t.id}`, apri: "Apri l'impegno", limite },
    );
  }
  return risposta(
    "agenda",
    `Ne ho ${trovati.length} che contengono «${soggetto}»:`,
    trovati.map((t) => ({
      ...rigaImpegno(t),
      testo: t.due_date
        ? `${t.title} — ${formatDate(t.due_date)} (${quandoInParole(t.giorni_alla_scadenza)})`
        : `${t.title} — senza scadenza`,
    })),
    { limite },
  );
}

// =====================================================================
// CASSA — fase 2
// =====================================================================

/**
 * QUANTI SOLDI CI SONO.
 *
 * 🔴 L'AVVERTENZA NON SI RISCRIVE QUI, e questa è la riga che tiene in
 * piedi la risposta: `saldo_tesoreria()` restituisce **il numero e la
 * frase che ne dichiara il limite** — le mance che stanno nel cassetto e
 * non sono sue, gli incassi con carta che devono ancora arrivare, la data
 * dell'ultimo conteggio. È la regola del 15/08: *il numero e il suo limite
 * viaggiano insieme*. Ricopiarla qui vorrebbe dire avere due versioni
 * della stessa avvertenza, e il giorno che ne cambia una MEMO
 * racconterebbe un limite che la Cassa non ha più.
 *
 * ⚠️ E I DUE SALDI NON SI SOMMANO MAI (regola del 13/08): il contante è nel
 * cassetto, la banca è in banca, e un totale unico farebbe credere di
 * poter pagare in contanti quello che sta sul conto.
 */
function saldoCassa(saldo) {
  if (nonLetto(saldo) || !saldo) return nonLoSo("cassa", "i saldi della Cassa");

  return risposta(
    "cassa",
    `In cassa ci sono ${formatEUR(saldo.contante_atteso)} e in banca ${formatEUR(
      saldo.saldo_banca,
    )}.`,
    [],
    { limite: saldo.avvertenza ?? null },
  );
}

const versoInParole = (m) => (m?.direction === "entrata" ? "entrati" : "usciti");

const causaleDi = (m) => m?.causale?.label ?? m?.business_purpose ?? null;

/**
 * GLI ULTIMI MOVIMENTI DI CASSA.
 *
 * ⚠️ «RECENTI» È UNA FINESTRA, E LA FINESTRA SI DICHIARA. Senza, la
 * domanda leggerebbe la Prima nota intera per mostrarne sei righe — e su
 * una tabella che cresce ogni giorno finirebbe tagliata a mille righe
 * senza dirlo (la famiglia del 19/08). Con la finestra il conto è
 * limitato, e chi legge sa fin dove si è guardato.
 *
 * ⚠️ «NON C'È NIENTE NEGLI ULTIMI GIORNI» È UNA RISPOSTA VERA, diversa da
 * «la Prima nota è vuota»: la prima parla della finestra, la seconda del
 * gestionale. Dirle uguali sarebbe informazione di assenza spacciata per
 * assenza di informazione.
 *
 * ⚠️ E SONO I SOLDI DI BORGO 58: la tasca di Alessio è un soggetto a sé dal
 * 30/08, e mescolarli direbbe che il locale ha speso quello che ha speso
 * lui. La risposta lo dichiara invece di lasciarlo intendere.
 */
function ultimiMovimenti(movimenti, giorni) {
  // 🔴 SENZA LA FINESTRA NON SI DÀ NESSUN NUMERO, ed è la regola del 15/08
  //    applicata alla lettera: *il numero e il suo limite viaggiano
  //    insieme*. Se chi legge non ha detto fin dove ha guardato, elencare
  //    sei movimenti li farebbe leggere come «questi sono tutti» — e non
  //    esiste una risposta onesta che si possa dare al posto suo.
  if (nonLetto(movimenti) || !(Number(giorni) > 0)) {
    return nonLoSo("prima_nota", "la Prima nota");
  }
  const tutti = movimenti ?? [];
  const finestra = `Guardo gli ultimi ${giorni} giorni, e solo i soldi di Borgo 58: quelli della tua tasca sono un'altra cosa e stanno per conto loro.`;

  if (tutti.length === 0) {
    return risposta(
      "prima_nota",
      `Negli ultimi ${giorni} giorni non c'è nessun movimento di cassa.`,
      [],
      { limite: finestra },
    );
  }

  return risposta(
    "prima_nota",
    tutti.length === 1
      ? "C'è un movimento solo:"
      : `Ci sono ${tutti.length} movimenti, dal più recente:`,
    tutti.map((m) => ({
      chiave: m.id,
      testo: `${formatDate(m.movement_date)} — ${formatEUR(m.amount)} ${versoInParole(m)}${
        causaleDi(m) ? `, ${causaleDi(m)}` : ""
      }`,
    })),
    { limite: finestra },
  );
}

// =====================================================================
// LE DUE LISTE DELLA SPESA — fase 2
// =====================================================================

/**
 * CHE COSA C'È DA COMPRARE — la lista dei fornitori.
 *
 * ⚠️ SOLO LE RIGHE ANCORA DA COMPRARE: quelle ordinate o già acquistate
 * stanno nella stessa lista ma non sono cose da prendere, e contarle
 * farebbe un elenco più lungo del vero. Quante sono si dichiara — è lo
 * stesso patto di «cosa mi manca» coi prodotti senza scorta minima.
 *
 * ⚠️ E UNA RIGA RIENTRATA SI DICE, perché la lista la mostra: la merce è
 * arrivata da un'altra parte e quella riga non serve più. Tacerlo
 * manderebbe a comprare due volte la stessa cosa.
 */
function cosaComprare(righe) {
  if (nonLetto(righe)) return nonLoSo("lista", "la lista della spesa");
  const tutte = righe ?? [];
  const daPrendere = tutte.filter((r) => r?.stato === "da_comprare");
  const altre = tutte.length - daPrendere.length;
  const rientrate = daPrendere.filter((r) => r?.rientrata === true).length;

  const limite =
    [
      altre
        ? `${
            altre === 1
              ? "Un'altra riga è già ordinata o comprata: qui non compare"
              : `Altre ${altre} righe sono già ordinate o comprate: qui non compaiono`
          }.`
        : null,
      rientrate
        ? `${rientrate === 1 ? "Di una" : `Di ${rientrate}`} ce n'è di nuovo abbastanza in magazzino: la lista lo dice.`
        : null,
    ]
      .filter(Boolean)
      .join(" ") || null;

  if (daPrendere.length === 0) {
    return risposta("lista", "Non c'è niente da comprare: la lista è vuota.", [], { limite });
  }

  return risposta(
    "lista",
    daPrendere.length === 1 ? "C'è una cosa da comprare:" : `Ci sono ${daPrendere.length} cose da comprare:`,
    daPrendere.map((r) => ({
      chiave: r.id,
      testo: `${r.nome}${
        r.quantita_da_comprare ? ` — ${qtaConUnita(r.quantita_da_comprare, r.unita)}` : ""
      }${r.fornitore ? ` (${r.fornitore})` : ""}`,
    })),
    { limite },
  );
}

/**
 * CHE COSA C'È NELLA SPESA SPICCIOLA — quella del supermercato.
 *
 * 🔴 SONO DUE LISTE DIVERSE (SPEC-0012), E LE DUE RISPOSTE NON SI
 * MESCOLANO: è la stessa decisione della #36 letta dal lato delle domande.
 * Una risposta che sommasse le due direbbe un numero che non compare in
 * nessuna delle due schermate.
 */
function cosaSpicciola(righe) {
  if (nonLetto(righe)) return nonLoSo("spicciola", "la spesa spicciola");
  const tutte = righe ?? [];
  const daPrendere = tutte.filter((r) => r?.nel_carrello !== true);
  const prese = tutte.length - daPrendere.length;
  const limite = prese
    ? `${prese === 1 ? "Una cosa è" : `${prese} cose sono`} già nel carrello.`
    : null;

  if (daPrendere.length === 0) {
    return risposta("spicciola", "Nella spesa spicciola non c'è niente da prendere.", [], {
      limite,
    });
  }

  return risposta(
    "spicciola",
    daPrendere.length === 1
      ? "Nella spesa spicciola c'è una cosa:"
      : `Nella spesa spicciola ci sono ${daPrendere.length} cose:`,
    daPrendere.map((r) => ({
      chiave: r.id,
      testo: `${r.articolo}${r.categoria ? ` (${r.categoria})` : ""}`,
    })),
    { limite },
  );
}

// =====================================================================
// AGENDA — quello che viene dopo oggi
// =====================================================================

/**
 * CHE COSA C'È QUESTA SETTIMANA.
 *
 * 🔴 LA FINESTRA NON SE LA INVENTA QUESTA REGOLA: è la corsia «questa
 * settimana» che l'Agenda calcola nel database, cioè la stessa con cui la
 * schermata raggruppa. Scegliendo qui un numero di giorni, MEMO e l'Agenda
 * direbbero due cose diverse sullo stesso fatto — che è la famiglia di
 * difetti che questo progetto insegue.
 *
 * ⚠️ QUELLI DI OGGI RESTANO FUORI, e si dicono a parte: hanno la loro
 * domanda, e ripeterli qui farebbe sembrare che ci sia più roba di quanta
 * ce n'è. Il ritardo invece si dichiara sempre, come in «cosa devo fare
 * oggi»: «questa settimana non hai niente» con quattordici scadute dietro
 * è vero e fuorviante.
 */
function agendaProssime(impegni) {
  if (nonLetto(impegni)) return nonLoSo("agenda", "l'Agenda");
  const tutti = impegni ?? [];
  const prossimi = tutti.filter((t) => t?.corsia === "questa_settimana" && !eDiOggi(t));
  const oggi = tutti.filter(eDiOggi).length;
  const inRitardo = tutti.filter((t) => t?.corsia === "in_ritardo").length;

  const limite =
    [
      oggi ? `${oggi === 1 ? "C'è anche una cosa" : `Ci sono anche ${oggi} cose`} da fare oggi.` : null,
      inRitardo
        ? `${inRitardo === 1 ? "E un impegno è" : `E ${inRitardo} impegni sono`} in ritardo.`
        : null,
    ]
      .filter(Boolean)
      .join(" ") || null;

  if (prossimi.length === 0) {
    return risposta("agenda", "Da qui a fine settimana non hai altro segnato.", [], { limite });
  }
  return risposta(
    "agenda",
    prossimi.length === 1
      ? "Questa settimana hai un'altra cosa:"
      : `Questa settimana hai altre ${prossimi.length} cose:`,
    prossimi.map(rigaImpegno),
    { limite },
  );
}

// =====================================================================
// RICETTARIO — che cosa ci va dentro
// =====================================================================

/**
 * CHE COSA SERVE PER UN PIATTO.
 *
 * 🔴 SI LEGGE DALLA VISTA «display», QUELLA SENZA I COSTI, e non è una
 * precauzione formale: la domanda è «cosa ci va dentro», non «quanto
 * costa». Quella vista esiste dal primo giorno proprio per far vedere alla
 * sala le colonne sicure di una ricetta, e una risposta parlata che si
 * portasse dietro i prezzi d'acquisto direbbe più di quello che è stato
 * chiesto — a chiunque tenga in mano il telefono.
 *
 * ⚠️ GLI STESSI CANDIDATI DELLE ALTRE DOMANDE DEL RICETTARIO: la scelta fra
 * più ricette si comporta in un modo solo in tutto MEMO, altrimenti la
 * stessa ambiguità darebbe due comportamenti diversi.
 */
function ingredientiRicetta(soggetto, ricette, ingredienti, scelto) {
  if (nonLetto(ricette)) return nonLoSo("ricettario", "il Ricettario");
  if (!soggetto) return chiarimento("ricettario", DOMANDE_CHE_SO.ingredienti_ricetta.chiarimento);

  const { scelte, scremate } = candidatiRicetta(ricette, soggetto);
  const trovate = fraICandidati(scelte, scelto, "id");
  if (trovate.length === 0) {
    return risposta("ricettario", `Non ho nessuna ricetta che si chiami «${soggetto}».`);
  }
  if (trovate.length > 1) {
    return scegli(
      "ricettario",
      `Ne ho ${trovate.length} che contengono «${soggetto}»: di quale?`,
      trovate.map((r) => ({ chiave: r.id, testo: nomeRicetta(r), soggetto: nomeRicetta(r) })),
      { limite: scremate },
    );
  }

  const r = trovate[0];
  const apri = { a: `/ricettario/ricette/${r.id}`, apri: "Apri la ricetta" };
  if (nonLetto(ingredienti)) return nonLoSo("ricettario", `gli ingredienti di «${nomeRicetta(r)}»`);

  const righe = ingredienti ?? [];
  // ⚠️ «NON NE HA» È UNA RISPOSTA VERA e va detta come tale: una ricetta
  //    senza righe esiste — in produzione ce ne sono quattordici così — e
  //    dirlo è un'altra cosa dal non aver letto.
  if (righe.length === 0) {
    return risposta(
      "ricettario",
      `«${nomeRicetta(r)}» non ha ancora nessun ingrediente scritto.`,
      [],
      { ...apri, limite: scremate },
    );
  }

  return risposta(
    "ricettario",
    `Per «${nomeRicetta(r)}» ${righe.length === 1 ? "serve una cosa" : `servono ${righe.length} cose`}:`,
    righe.map((i) => ({
      chiave: i.recipe_ingredient_id ?? i.ingredient_name,
      testo: `${i.ingredient_name}${
        i.quantity ? ` — ${qtaConUnita(i.quantity, i.unit)}` : ""
      }${i.is_preparation ? " (preparazione)" : ""}`,
    })),
    { ...apri, limite: scremate },
  );
}

// =====================================================================
// PREPARAZIONI, PULIZIE, TEMPERATURE — fase 2
// =====================================================================

/**
 * CHE COSA C'È DA PREPARARE.
 *
 * ⚠️ L'ELENCO ESISTE GIÀ in Magazzino → Produzioni: qui si legge, e basta.
 * Da quanti giorni una cosa è lì lo porta il database, e si dice — una
 * lista senza età diventa un cimitero, ed è la ragione per cui quel numero
 * è stato messo lì il 29/08.
 */
function preparazioniDaFare(cose) {
  if (nonLetto(cose)) return nonLoSo("preparazioni", "le preparazioni da fare");
  const tutte = cose ?? [];
  if (tutte.length === 0) {
    return risposta("preparazioni", "Non c'è niente segnato da preparare.");
  }
  return risposta(
    "preparazioni",
    tutte.length === 1
      ? "C'è una preparazione da fare:"
      : `Ci sono ${tutte.length} preparazioni da fare:`,
    tutte.map((c) => ({
      chiave: c.recipe_id,
      // ⚠️ Il segno è girato apposta: `quandoInParole` parla di scadenze
      //    («fra 3 giorni»), qui si parla di attesa («3 giorni fa»). E un
      //    valore vuoto NON diventa «oggi»: `Number(null)` vale zero, ed è
      //    esattamente il difetto che il 07/09 faceva contare quindici
      //    impegni senza data come impegni di oggi.
      testo: `${c.nome} — ${
        c.giorni_in_attesa == null
          ? "da quando non si sa"
          : quandoInParole(-Number(c.giorni_in_attesa))
      }`,
      a: `/ricettario/ricette/${c.recipe_id}`,
    })),
  );
}

/**
 * CHE COSA C'È DA PULIRE OGGI.
 *
 * 🔴 «DOVUTA» LA DECIDE IL DATABASE, non questa regola: la cadenza di ogni
 * pulizia e l'ultima volta che è stata fatta stanno in `pulizie_di_oggi()`,
 * che è la stessa funzione che disegna la schermata HACCP. Ricalcolare qui
 * «ogni quanti giorni» produrrebbe una seconda definizione di dovuto, e il
 * giorno che divergono MEMO manderebbe a pulire una cosa che il registro
 * dà in pari.
 *
 * ⚠️ E LE PULIZIE SENZA CADENZA SI DICHIARANO: quelle con frequenza «altro»
 * non sono mai dovute — non perché siano a posto, ma perché nessuno ha
 * detto ogni quanto vanno fatte. Tacerle farebbe leggere «non c'è niente
 * da pulire» come una fotografia del registro intero.
 */
function pulizieOggi(pulizie) {
  if (nonLetto(pulizie)) return nonLoSo("pulizie", "il registro delle pulizie");
  const tutte = pulizie ?? [];
  const dovute = tutte.filter((p) => p?.dovuta === true);
  const fatteOggi = tutte.filter((p) => p?.fatta_oggi === true).length;
  const senzaCadenza = tutte.filter((p) => p?.ogni_giorni == null).length;

  const limite =
    [
      fatteOggi ? `${fatteOggi === 1 ? "Una l'hai" : `${fatteOggi} le hai`} già fatta oggi.` : null,
      senzaCadenza
        ? `${senzaCadenza === 1 ? "Una pulizia non ha" : `${senzaCadenza} pulizie non hanno`} una cadenza scritta: qui non ${senzaCadenza === 1 ? "compare" : "compaiono"} mai.`
        : null,
    ]
      .filter(Boolean)
      .join(" ") || null;

  if (dovute.length === 0) {
    return risposta("pulizie", "Oggi non c'è niente da pulire: è tutto in pari.", [], { limite });
  }
  return risposta(
    "pulizie",
    dovute.length === 1 ? "Oggi c'è una pulizia da fare:" : `Oggi ci sono ${dovute.length} pulizie da fare:`,
    dovute.map((p) => ({
      chiave: p.task_id,
      testo: `${p.nome}${p.area ? ` (${p.area})` : ""} — ${
        p.mai_fatta
          ? "non è mai stata fatta"
          : Number(p.giorni_ritardo) > 0
            ? `in ritardo di ${p.giorni_ritardo} ${Number(p.giorni_ritardo) === 1 ? "giorno" : "giorni"}`
            : "tocca oggi"
      }`,
    })),
    { limite },
  );
}

/**
 * LE TEMPERATURE DI OGGI SONO STATE SEGNATE?
 *
 * 🔴 LA DOMANDA VERA NON È «CHE TEMPERATURA FA», È «L'HO SEGNATA»: il
 * registro HACCP è un documento esibibile, e quello che manca a un
 * controllo è la lettura mancante, non il grado. Per questo la risposta
 * conta prima le attrezzature **senza lettura di oggi**.
 *
 * ⚠️ UN FUORI RANGE SI DICE SEMPRE, anche quando tutte le letture ci sono:
 * è l'unica cosa di questo riquadro che chiede di alzarsi da tavola. E si
 * dice **soltanto**, senza offrire nessun gesto: chiudere una non
 * conformità non si fa a voce (regola del mandato vocale del 14/08).
 */
function temperatureOggi(letture) {
  if (nonLetto(letture)) return nonLoSo("temperature", "il registro delle temperature");
  const tutte = letture ?? [];
  if (tutte.length === 0) {
    return risposta("temperature", "Non c'è nessuna attrezzatura da controllare.");
  }
  const mancano = tutte.filter((t) => !(Number(t?.quante_oggi) > 0));
  const fuori = tutte.filter((t) => t?.fuori_range === true);

  const limite = fuori.length
    ? `⚠️ ${fuori.length === 1 ? "Una lettura è fuori range" : `${fuori.length} letture sono fuori range`}: ${fuori
        .map((t) => t.nome)
        .join(", ")}. Guardala nel registro, non si sistema da qui.`
    : null;

  if (mancano.length === 0) {
    return risposta(
      "temperature",
      tutte.length === 1
        ? "La temperatura di oggi è segnata."
        : `Le temperature di oggi sono segnate tutte e ${tutte.length}.`,
      [],
      { limite },
    );
  }
  return risposta(
    "temperature",
    mancano.length === 1
      ? "Manca una temperatura di oggi:"
      : `Mancano ${mancano.length} temperature di oggi:`,
    mancano.map((t) => ({
      chiave: t.equipment_id,
      testo: `${t.nome}${
        t.ultima_serata ? ` — l'ultima è del ${formatDate(t.ultima_serata)}` : " — mai segnata"
      }`,
    })),
    { limite },
  );
}

// =====================================================================
// FASE 3 — QUELLO CHE DEVE USCIRE
// =====================================================================
// 🔴 QUI I NUMERI SONO SOLDI, E NON NE VIENE CALCOLATO NEMMENO UNO. Quanto
//    si deve su una fattura lo dice `da_pagare`, che è una colonna
//    **calcolata dal database** (importo meno le note di credito scalate):
//    rifare quella sottrazione qui sarebbe la seconda definizione dello
//    stesso numero, e il giorno che divergono MEMO e la schermata delle
//    fatture direbbero due debiti diversi sulla stessa fattura.
//    ⚠️ È anche il motivo per cui la lettura chiede al database la stessa
//    stringa che chiede la schermata: se `da_pagare` cadesse, si vedrebbe
//    il LORDO senza nessun errore da nessuna parte.

const inRitardoDi = (scadenza, oggi) => {
  if (!scadenza || !oggi) return null;
  const giorni = Math.round(
    (Date.parse(`${oggi}T00:00:00`) - Date.parse(`${String(scadenza)}T00:00:00`)) / 86400000,
  );
  return Number.isFinite(giorni) && giorni > 0 ? giorni : null;
};

const totale = (righe, campo) =>
  (righe ?? []).reduce((s, r) => s + (Number(r?.[campo]) || 0), 0);

/**
 * QUALI FATTURE DEVO PAGARE.
 *
 * 🔴 IL TOTALE NON SI FILTRA MAI, ed è una decisione del 17/08 che qui
 * torna identica: un «da pagare» che si rimpicciolisce perché si è scelto
 * un fornitore somiglia in tutto a un debito più piccolo. MEMO elenca sei
 * righe e **dichiara il totale di tutte**, non di quelle mostrate.
 *
 * ⚠️ E LE SCADUTE SI DICONO SCADUTE. Sono l'unica cosa di questo elenco
 * che cambia quello che si fa oggi: sepolte in mezzo alle altre, in ordine
 * di scadenza, si leggono come le prossime.
 */
function fattureDaPagare(fatture, oggi) {
  if (nonLetto(fatture)) return nonLoSo("fatture", "le fatture dei fornitori");
  const aperte = fatture ?? [];

  if (aperte.length === 0) {
    return risposta("fatture", "Non c'è nessuna fattura da pagare.");
  }

  const somma = totale(aperte, "da_pagare");
  const scadute = aperte.filter((x) => inRitardoDi(x.due_date, oggi) !== null);
  const scalate = aperte.filter((x) => Number(x.note_scalate) > 0).length;

  // ⚠️ I TRE NUMERI, ed è la regola del 17/08: «fattura 250 · nota −40 ·
  //    da pagare 210». Mostrare solo il terzo fa sembrare che manchino 40
  //    euro; mostrare solo il primo fa pagare più del dovuto. Qui la riga
  //    porta il netto, e quante fatture hanno una nota sopra si dichiara.
  const limite =
    [
      scadute.length
        ? `${scadute.length === 1 ? "Una è già scaduta" : `${scadute.length} sono già scadute`}.`
        : null,
      scalate
        ? `${scalate === 1 ? "Su una" : `Su ${scalate}`} c'è una nota di credito già scalata: l'importo qui è quello NETTO.`
        : null,
      "Sono solo le fatture registrate nel gestionale: quelle non ancora inserite non le vedo.",
    ]
      .filter(Boolean)
      .join(" ") || null;

  return risposta(
    "fatture",
    aperte.length === 1
      ? `C'è una fattura da pagare, ${formatEUR(somma)} in tutto:`
      : `Ci sono ${aperte.length} fatture da pagare, ${formatEUR(somma)} in tutto:`,
    aperte.map((x) => {
      const tardi = inRitardoDi(x.due_date, oggi);
      return {
        chiave: x.id,
        testo:
          `${x.supplier?.name ?? "senza fornitore"} — ${formatEUR(x.da_pagare)}` +
          (x.due_date
            ? `, ${tardi ? `scaduta da ${tardi} ${tardi === 1 ? "giorno" : "giorni"}` : `entro il ${formatDate(x.due_date)}`}`
            : ", senza scadenza"),
      };
    }),
    { limite },
  );
}

/**
 * LE SCADENZE PREVISTE — quello che esce senza una fattura.
 *
 * ⚠️ NON SONO LE FATTURE, e tenerle separate è quello che il gestionale fa
 * già: qui stanno l'F24, l'affitto, le cose che Alessio si segna a mano.
 * Sommarle alle fatture darebbe un numero che non compare in nessuna delle
 * due schermate.
 *
 * ⚠️ E IL LIMITE PIÙ GROSSO SI DICHIARA: gli stipendi non ci sono, perché
 * arrivano dal prospetto di Gianna e non passano da nessun modulo. È lo
 * stesso avviso che «Ce la faccio?» porta dal 15/08 — senza, un elenco
 * corto sembra una promessa.
 */
function scadenzePreviste(scadenze, oggi) {
  if (nonLetto(scadenze)) return nonLoSo("previsione", "le scadenze previste");
  const aperte = scadenze ?? [];
  const limite =
    "Non ci sono gli stipendi: arrivano dal prospetto di Gianna e non passano da qui. E non ci sono le fatture dei fornitori, che si contano a parte.";

  if (aperte.length === 0) {
    return risposta("previsione", "Non hai nessuna scadenza segnata.", [], { limite });
  }

  const somma = totale(aperte, "importo");
  const scadute = aperte.filter((s) => inRitardoDi(s.scade_il, oggi) !== null).length;

  return risposta(
    "previsione",
    aperte.length === 1
      ? `C'è una scadenza segnata, ${formatEUR(somma)}:`
      : `Ci sono ${aperte.length} scadenze segnate, ${formatEUR(somma)} in tutto:`,
    aperte.map((s) => {
      const tardi = inRitardoDi(s.scade_il, oggi);
      return {
        chiave: s.id,
        testo:
          `${s.descrizione} — ${formatEUR(s.importo)}, ` +
          (tardi
            ? `scaduta da ${tardi} ${tardi === 1 ? "giorno" : "giorni"}`
            : `il ${formatDate(s.scade_il)}`) +
          (Number(s.ogni_mesi) > 0
            ? ` (ogni ${s.ogni_mesi === 1 ? "mese" : `${s.ogni_mesi} mesi`})`
            : ""),
      };
    }),
    {
      limite: scadute
        ? `${scadute === 1 ? "Una è già scaduta" : `${scadute} sono già scadute`}. ${limite}`
        : limite,
    },
  );
}

/**
 * COSA HO ORDINATO — e che cosa vuol dire «inviato».
 *
 * 🔴 «INVIATO» QUI VUOL DIRE «HO APERTO WHATSAPP CON QUESTO TESTO», e il
 * gestionale non può sapere se il messaggio è partito davvero. È scritto
 * così dal 14/08, e MEMO non può dirlo in un modo più sicuro di quanto lo
 * sappia: la risposta lo dichiara invece di far credere che l'ordine sia
 * arrivato al fornitore.
 *
 * ⚠️ E SI ELENCA SOLO QUELLO CHE ASPETTA: un ordine ricevuto o annullato
 * non è roba che deve arrivare, e metterlo in mezzo allungherebbe l'elenco
 * di cose già chiuse.
 */
function ordiniInCorso(ordini, oggi) {
  if (nonLetto(ordini)) return nonLoSo("ordini", "gli ordini ai fornitori");
  const tutti = ordini ?? [];
  const inAttesa = tutti.filter((o) => o?.stato === "inviato");
  const altri = tutti.length - inAttesa.length;

  const limite =
    [
      altri
        ? `${altri === 1 ? "Un altro ordine è" : `Altri ${altri} ordini sono`} già arrivato o annullato.`
        : null,
      "«Inviato» vuol dire che il gestionale ha aperto WhatsApp con quel testo: se il messaggio sia partito davvero non lo sa.",
    ]
      .filter(Boolean)
      .join(" ") || null;

  if (inAttesa.length === 0) {
    return risposta("ordini", "Non c'è nessun ordine in attesa.", [], { limite });
  }

  return risposta(
    "ordini",
    inAttesa.length === 1
      ? "C'è un ordine che aspetta:"
      : `Ci sono ${inAttesa.length} ordini che aspettano:`,
    inAttesa.map((o) => {
      const giorni = inRitardoDi(String(o.inviato_il ?? "").slice(0, 10), oggi);
      return {
        chiave: o.id,
        testo:
          `${o.fornitore ?? "senza fornitore"} — ${o.righe} ${Number(o.righe) === 1 ? "riga" : "righe"}` +
          (giorni ? `, da ${giorni} ${giorni === 1 ? "giorno" : "giorni"}` : ", di oggi"),
      };
    }),
    { limite },
  );
}

/**
 * LE NOTE DI CREDITO ANCORA DA USARE.
 *
 * ⚠️ È LA DOMANDA CHE FA RECUPERARE SOLDI: una nota di credito che nessuno
 * si ricorda è uno storno del fornitore che non viene mai scalato. Il
 * residuo lo calcola il database («credito_residuo»), qui si legge.
 *
 * ⚠️ E IL CREDITO È DI QUEL FORNITORE, non della cassa: non si può usare
 * per pagare qualcun altro, e la risposta lo dice — altrimenti quel totale
 * si legge come soldi disponibili.
 */
function creditiFornitore(crediti) {
  if (nonLetto(crediti)) return nonLoSo("fatture", "le note di credito");
  const righe = crediti ?? [];
  if (righe.length === 0) {
    return risposta("fatture", "Non c'è nessuna nota di credito da usare.");
  }

  const somma = totale(righe, "residuo");
  return risposta(
    "fatture",
    righe.length === 1
      ? `C'è ${formatEUR(somma)} di credito da usare:`
      : `Ci sono ${formatEUR(somma)} di credito da usare, con ${righe.length} fornitori:`,
    righe.map((c) => ({
      chiave: c.supplier_id,
      testo: `${c.fornitore} — ${formatEUR(c.residuo)}${
        Number(c.quante) > 1 ? ` (${c.quante} note)` : ""
      }`,
    })),
    {
      limite:
        "Ogni credito vale solo con quel fornitore: si scala dalla sua prossima fattura, non si incassa.",
    },
  );
}

// =====================================================================
// FASE 4 — LA SALA DI STASERA
// =====================================================================
// 🔴 QUI NON SI CONTA NIENTE, SI LEGGE. Quanti coperti stanno in sala lo
//    decide «posto_per_la_serata()» dal 18/08, che tiene conto dei tavoli
//    accostati e delle correzioni a mano; i turni e le fasce li calcola
//    «turni_del_giorno()». Rifare quei conti qui vorrebbe dire una seconda
//    sala, che il giorno che diverge racconta una serata diversa da quella
//    che si vede sulla pianta.

/** L'ora senza i secondi: «21:15:00» si dice «21:15». */
const oraBreve = (t) => (t ? String(t).slice(0, 5) : null);

/**
 * CHI HA PRENOTATO.
 *
 * ⚠️ SI DICONO NOME, ORA E QUANTI SONO, e il tavolo quando c'è. Le
 * prenotazioni **senza tavolo** si dichiarano a parte: hanno una ragione
 * che le altre non hanno — non compaiono da nessuna parte sulla pianta, e
 * il rischio è che restino senza (richiesta di Alessio, 18/08).
 *
 * ⚠️ E SI GUARDANO SOLO LE CONFERMATE: una richiesta ancora in attesa non
 * è gente che verrà, ed è un'altra domanda. Contarle insieme farebbe
 * apparecchiare per persone che nessuno ha ancora accettato.
 */
function chiHaPrenotato(prenotazioni, turni) {
  if (nonLetto(prenotazioni)) return nonLoSo("calendario", "le prenotazioni");
  const tutte = prenotazioni ?? [];
  const confermate = tutte.filter((p) => p?.status === "confermata" || p?.status === "servita");
  const inAttesa = tutte.length - confermate.length;

  const perId = new Map();
  if (!nonLetto(turni)) for (const t of turni ?? []) perId.set(t.reservation_id, t);

  const senzaTavolo = confermate.filter(
    (p) => !(perId.get(p.id)?.etichette ?? []).length,
  ).length;

  const limite =
    [
      senzaTavolo
        ? `${senzaTavolo === 1 ? "Una non ha ancora un tavolo" : `${senzaTavolo} non hanno ancora un tavolo`}: sulla pianta non ${senzaTavolo === 1 ? "compare" : "compaiono"}.`
        : null,
      inAttesa
        ? `${inAttesa === 1 ? "C'è anche una richiesta" : `Ci sono anche ${inAttesa} richieste`} da confermare, e qui non ${inAttesa === 1 ? "conta" : "contano"}.`
        : null,
    ]
      .filter(Boolean)
      .join(" ") || null;

  if (confermate.length === 0) {
    return risposta("calendario", "Non ha prenotato nessuno.", [], { limite });
  }

  const coperti = confermate.reduce((s, p) => s + (Number(p.party_size) || 0), 0);
  return risposta(
    "calendario",
    confermate.length === 1
      ? `C'è una prenotazione, ${coperti} ${coperti === 1 ? "persona" : "persone"}:`
      : `Ci sono ${confermate.length} prenotazioni, ${coperti} persone in tutto:`,
    confermate.map((p) => {
      const t = perId.get(p.id);
      const tavoli = (t?.etichette ?? []).join("·");
      return {
        chiave: p.id,
        testo:
          `${oraBreve(p.reservation_time) ?? "senza ora"} — ${p.customer_name ?? "senza nome"}, ` +
          `${p.party_size ?? "?"} ${Number(p.party_size) === 1 ? "persona" : "persone"}` +
          (tavoli ? ` (${tavoli})` : " — senza tavolo"),
      };
    }),
    { limite },
  );
}

/**
 * QUANTO POSTO C'È.
 *
 * 🔴 L'AVVERTENZA NON SI RISCRIVE QUI: `posto_per_la_serata()` restituisce
 * il numero **e la frase che ne dichiara il limite** — il conteggio guarda
 * i soli tavoli, e divani e Chef Table restano fuori perché sono un'altra
 * formula. È la regola del 15/08: il numero e il suo limite viaggiano
 * insieme, e ricopiarla qui darebbe due versioni della stessa avvertenza.
 *
 * ⚠️ E LE RICHIESTE IN ATTESA NON OCCUPANO NIENTE dal 14/08: si dicono,
 * perché sono gente che potrebbe arrivare, ma non si tolgono dai posti
 * restanti — il tavolo lo dà Alessio dalla pianta.
 */
function quantoPostoCe(posto) {
  if (nonLetto(posto) || !posto) return nonLoSo("pianta", "i posti della sala");

  const restanti = Number(posto.restanti);
  const prenotati = Number(posto.prenotati);
  const capienza = Number(posto.capienza);
  const inAttesa = Number(posto.in_attesa) || 0;

  const limite =
    [
      inAttesa
        ? `${inAttesa === 1 ? "C'è una richiesta" : `Ci sono ${inAttesa} richieste`} ancora da confermare: non ${inAttesa === 1 ? "toglie" : "tolgono"} posto finché non ${inAttesa === 1 ? "la accetti" : "le accetti"}.`
        : null,
      posto.avvertenza ?? null,
    ]
      .filter(Boolean)
      .join(" ") || null;

  if (!Number.isFinite(restanti)) return nonLoSo("pianta", "i posti della sala");

  return risposta(
    "pianta",
    restanti <= 0
      ? `Non resta posto: ${prenotati} su ${capienza} sono già prenotati.`
      : `Restano ${restanti} posti: ne sono prenotati ${prenotati} su ${capienza}.`,
    [],
    { limite },
  );
}

/**
 * LE RICHIESTE CHE ASPETTANO UNA RISPOSTA.
 *
 * ⚠️ È LA DOMANDA CHE FA PERDERE CLIENTI SE NESSUNO LA FA: una richiesta
 * arrivata dal sito resta lì finché Alessio non la accetta, e finché è lì
 * quella gente non sa se ha un tavolo. Dal 11/08 stanno in cima al
 * Calendario proprio per questo.
 *
 * ⚠️ E SONO SOLO QUELLE DA OGGI IN AVANTI: una richiesta di ieri non si
 * conferma più, e metterla in mezzo farebbe sembrare che ci sia da fare
 * qualcosa che non si può più fare.
 */
function richiesteDaConfermare(richieste, oggi) {
  if (nonLetto(richieste)) return nonLoSo("calendario", "le richieste dei clienti");
  const tutte = richieste ?? [];
  const limite = "Guardo solo le richieste da oggi in avanti: quelle passate non si confermano più.";

  if (tutte.length === 0) {
    return risposta("calendario", "Non c'è nessuna richiesta da confermare.", [], { limite });
  }

  const perOggi = oggi ? tutte.filter((r) => String(r.reservation_date) === String(oggi)).length : 0;
  return risposta(
    "calendario",
    tutte.length === 1
      ? "C'è una richiesta da confermare:"
      : `Ci sono ${tutte.length} richieste da confermare:`,
    tutte.map((r) => ({
      chiave: r.id,
      testo:
        `${formatDate(r.reservation_date)} ${oraBreve(r.reservation_time) ?? ""} — ` +
        `${r.customer_name ?? "senza nome"}, ${r.party_size ?? "?"} ` +
        `${Number(r.party_size) === 1 ? "persona" : "persone"}`,
    })),
    {
      limite: perOggi
        ? `${perOggi === 1 ? "Una è per oggi" : `${perOggi} sono per oggi`}. ${limite}`
        : limite,
    },
  );
}

/**
 * STASERA SI LAVORA?
 *
 * 🔴 LE RISPOSTE SONO TRE, NON DUE, ed è la lezione del 10/08 pagata sul
 * form pubblico: **chiuso**, **aperto con questi orari**, **pieno**. Il
 * lunedì il sito rispondeva «non abbiamo più posto» invece di «siamo
 * chiusi», e un cliente che ci prova due volte conclude che siamo sempre
 * pieni. Qui valgono le stesse tre.
 *
 * ⚠️ E UNA CHIUSURA PORTA IL SUO MOTIVO: «siamo chiusi» senza dire perché
 * fa riaprire il calendario per controllare.
 */
function siamoAperti(letture) {
  const orari = letture.orari;
  const chiusure = letture.chiusure;
  const pieno = letture.pieno;
  const oggi = letture.oggi ?? null;
  const giorno = letture.giorno ?? null;

  if (nonLetto(orari)) return nonLoSo("orari", "gli orari del locale");

  // ⚠️ La chiusura viene prima di tutto: se il locale è chiuso, gli orari
  //    di quel giorno della settimana non vogliono dire niente.
  const chiusa = nonLetto(chiusure)
    ? null
    : (chiusure ?? []).find((c) => oggi && String(c.dal) <= String(oggi) && String(oggi) <= String(c.al));
  if (chiusa) {
    return risposta(
      "orari",
      `Oggi siamo chiusi${chiusa.motivo ? `: ${chiusa.motivo}` : "."}`,
      [],
      { limite: `La chiusura va dal ${formatDate(chiusa.dal)} al ${formatDate(chiusa.al)}.` },
    );
  }

  const diOggi = (orari ?? []).filter((o) => o.weekday === giorno && o.attivo);
  if (diOggi.length === 0) {
    return risposta("orari", "Oggi è giorno di riposo: non si apre.");
  }

  const righe = diOggi.map((o) => ({
    chiave: o.id,
    testo:
      `${o.servizio === "pranzo" ? "Pranzo" : "Cena"}: si prenota dalle ${oraBreve(o.apertura)} ` +
      `alle ${oraBreve(o.ultimo_ingresso)}` +
      (o.ora_ultimi_arrivi ? `, ultimi arrivi dalle ${oraBreve(o.ora_ultimi_arrivi)}` : ""),
  }));

  // ⚠️ «Pieno» è un fatto a sé e si dice insieme agli orari: aperti e pieni
  //    è la situazione in cui una telefonata serve ancora, e nasconderla
  //    dietro «siamo aperti» farebbe promettere un tavolo che non c'è.
  const limite =
    pieno === true
      ? "⚠️ Oggi è segnato come pieno: dalla pianta non risulta più posto da dare."
      : null;

  return risposta(
    "orari",
    diOggi.length === 1 ? "Oggi si lavora:" : "Oggi si lavora, con due servizi:",
    righe,
    { limite },
  );
}

// =====================================================================
// L'UNICA PORTA
// =====================================================================

/**
 * La risposta scritta, composta dai dati già letti.
 *
 * @param domanda  `{ chiede, soggetto, allergene }` — quello che il modello
 *                 ha capito, niente di più.
 * @param letture  i dati già letti dal gestionale, ognuno eventualmente
 *                 marcato `NON_LETTO`.
 */
export function componiRisposta(domanda, letture = {}) {
  const chiede = domanda?.chiede ?? null;
  const soggetto = domanda?.soggetto?.trim() || null;
  // ⚠️ Quale dei candidati è stato toccato: arriva dal gesto, non dal nome.
  const scelto = domanda?.scelto ?? null;
  if (!chiede || !DOMANDE_CHE_SO[chiede]) return nonSoFarlo(domanda?.area ?? null);

  switch (chiede) {
    case "ricetta_esiste":
      return ricettaEsiste(soggetto, letture.ricette);
    case "allergeni":
      return allergeniDi(
        soggetto,
        domanda?.allergene ?? null,
        letture.ricette,
        letture.allergeni,
        scelto,
      );
    case "piatti_in_carta":
      return piattiInCarta(letture.ricette);
    case "quanto_ho":
      return quantoHo(soggetto, letture.giacenze, scelto, letture.oggi ?? null);
    case "cosa_manca":
      return cosaManca(letture.giacenze);
    case "cosa_scade":
      return cosaScade(letture.partite);
    case "agenda_oggi":
      return agendaOggi(letture.impegni);
    case "agenda_in_ritardo":
      return agendaInRitardo(letture.impegni);
    case "quando_scade":
      return quandoScade(soggetto, letture, scelto);

    // --- fase 2 ---------------------------------------------------
    case "saldo_cassa":
      return saldoCassa(letture.saldo);
    case "ultimi_movimenti":
      return ultimiMovimenti(letture.movimenti, letture.giorni ?? 0);
    case "cosa_comprare":
      return cosaComprare(letture.lista);
    case "cosa_spicciola":
      return cosaSpicciola(letture.spicciola);
    case "agenda_prossime":
      return agendaProssime(letture.impegni);
    case "ingredienti_ricetta":
      return ingredientiRicetta(soggetto, letture.ricette, letture.ingredienti, scelto);
    case "preparazioni_da_fare":
      return preparazioniDaFare(letture.preparazioni);
    case "pulizie_oggi":
      return pulizieOggi(letture.pulizie);
    case "temperature_oggi":
      return temperatureOggi(letture.temperature);
    // --- fase 3: quello che deve uscire ---------------------------
    case "fatture_da_pagare":
      return fattureDaPagare(letture.fatture, letture.oggi ?? null);
    case "scadenze_previste":
      return scadenzePreviste(letture.scadenze, letture.oggi ?? null);
    case "ordini_in_corso":
      return ordiniInCorso(letture.ordini, letture.oggi ?? null);
    case "crediti_fornitore":
      return creditiFornitore(letture.crediti);

    // --- fase 4: la sala di stasera -------------------------------
    case "chi_ha_prenotato":
      return chiHaPrenotato(letture.prenotazioni, letture.turni);
    case "quanto_posto_ce":
      return quantoPostoCe(letture.posto);
    case "richieste_da_confermare":
      return richiesteDaConfermare(letture.richieste, letture.oggi ?? null);
    case "siamo_aperti":
      return siamoAperti(letture);

    default:
      return nonSoFarlo(domanda?.area ?? null);
  }
}

/**
 * Il titolo del riquadro: la domanda, com'è stata capita.
 *
 * 🔴 NON È L'ESEMPIO COL SOGGETTO APPICCICATO, e la prima stesura lo era:
 * col modello vero, «ho la ricetta della caponata?» diventava a schermo
 * *«Ho la ricetta della carbonara — «caponata»»*. Cioè il titolo nominava
 * un piatto che nessuno aveva detto. ⚠️ L'ha visto un occhio guardando il
 * collaudo, non una prova: nessuna asserzione guardava quella stringa.
 */
export function titoloDellaDomanda(domanda) {
  const nota = DOMANDE_CHE_SO[domanda?.chiede];
  if (!nota) return "Mi hai fatto una domanda";
  const soggetto = domanda?.soggetto?.trim();
  if (!soggetto) return nota.senzaSoggetto ?? nota.titolo;
  return nota.titolo.replace("{x}", soggetto);
}
