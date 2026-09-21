// L'ETICHETTA «INVESTIMENTO» E IL COSTO DEL PROGETTO — C11, 21/09/2026.
//
// 🔴 A CHE DOMANDA RISPONDE: *quanto e' costato mettere in piedi il locale.*
//    Prima non c'era nessun numero che lo dicesse — `cash_movements` ha 26
//    colonne e nessuna etichetta, quindi un forno da 6.000 euro e una
//    bolletta della luce erano indistinguibili — e il totale piu' vicino
//    (`rettifiche_fiscali → costi_totali`) e' per **anno civile**, per **una
//    societa' sola**, ed esclude la **tasca**.
//
// 🔴 E' UN'ETICHETTA, NON UN SECONDO ARCHIVIO (decisione di Alessio,
//    31/08). Una sezione separata creerebbe due verita' sulla stessa spesa e
//    andrebbe smontata dopo l'apertura; un'etichetta si smette solo di
//    usare. Per la stessa ragione non c'e' nessun campo per «in cosa» e «con
//    quali soldi»: la causale e la nota dicono gia' in cosa, il mezzo e il
//    soggetto dicono gia' con quali soldi.
//
// ---------------------------------------------------------------------
// PERCHE' LE REGOLE STANNO QUI
// ---------------------------------------------------------------------
// ⚠️ QUESTO FILE NON E' IL POSTO DOVE VIVE IL DIVIETO. I due divieti stanno
//    nel database (migrazione `20260921000003`), perche' una regola nella
//    schermata la aggira chiunque scriva da un'altra porta:
//      · un vincolo `check` rende **impossibile** marcare un'entrata;
//      · un trigger rifiuta un'uscita con una **causale di sistema**.
//    Qui si decide soltanto *che cosa offrire* e *che cosa sommare*, per non
//    proporre un gesto che verrebbe rifiutato — la stessa forma con cui la
//    Prima nota tratta gia' la tasca.
//
// ⚠️ E CI STANNO PERCHE' SI PROVANO AL CONTRARIO: «l'orto non entra nel
//    totale» e «il dettaglio combacia con i numeri» sono affermazioni che
//    dentro una schermata si proverebbero solo montandola, e nel database si
//    proverebbero solo applicando la migrazione.

// ---------------------------------------------------------------------
// 1. CHI ENTRA NEL COSTO DEL PROGETTO
// ---------------------------------------------------------------------
// 🔴 IL TIPO STABILE DEL SOGGETTO, MAI IL NOME VISUALIZZATO. `entity_type`
//    e' un enum del database e non cambia; «Borgo 58» e «Orto Borgo 58» sono
//    testo che Alessio puo' riscrivere da una schermata — e il giorno che lo
//    facesse, un confronto sul nome smetterebbe di funzionare **senza nessun
//    errore**, che e' il modo di fallire peggiore.
export const SOGGETTI_DEL_COSTO = ["srls", "tasca"];

// Come si chiamano i due, in italiano, quando il database non ha righe da
// cui leggere il nome: una colonna a zero deve comunque dire di chi e'.
export const NOMI_PREDEFINITI = {
  srls: "Borgo 58",
  tasca: "La tasca di Alessio",
};

/**
 * Questo soggetto entra nel «Totale progetto»?
 *
 * 🔴 L'ORTO NON ENTRA, ed e' una decisione di merito e non una dimenticanza:
 *    l'azienda agricola e' un'altra impresa, e una spesa per l'orto non e'
 *    una spesa per aprire l'osteria. ⚠️ Ma **non sparisce**: chi guarda la
 *    vede dichiarata fuori dal totale, col suo importo. *Un'uscita marcata
 *    che svanisce in silenzio e' un'etichetta che non fa niente* — e in
 *    questo progetto il silenzio e' il difetto.
 */
export function nelCostoDelProgetto(tipo) {
  return SOGGETTI_DEL_COSTO.includes(tipo);
}

// ---------------------------------------------------------------------
// 2. QUALE MOVIMENTO PUO' PORTARE L'ETICHETTA
// ---------------------------------------------------------------------
/**
 * Vero se a questo movimento si puo' offrire «Investimento per il progetto».
 *
 * Due condizioni, tutt'e due strutturali — mai una parola letta dentro una
 * descrizione, che e' esattamente il modo in cui un riconoscimento sbaglia
 * in silenzio:
 *
 *   1. **e' un'uscita.** Un'entrata marcata come investimento sarebbe denaro
 *      che entra contato come costo. Nel database la rende impossibile un
 *      vincolo `check`, non questa riga.
 *
 *   2. **la sua causale non e' di sistema.** E' la stessa condizione che
 *      `rettifiche_fiscali()` e `costi_da_classificare()` usano dal 15/08
 *      per non contare fra i costi cio' che non e' un costo: versamenti in
 *      banca, differenze di cassa, **rimborsi al titolare**, caparre
 *      restituite, restituzioni di prestito. Sono spostamenti di denaro o
 *      pareggi di un debito, non spese — e marcarli farebbe crescere il
 *      costo del progetto una seconda volta.
 *
 * ⚠️ IL PAGAMENTO DI UNA FATTURA RESTA MARCABILE, e non e' una svista:
 *    `pay_supplier_invoice` scrive il movimento **senza causale**, quindi
 *    non e' di sistema. Li' l'uscita di cassa e' l'unico posto in cui quella
 *    spesa compare in prima nota, e contarla una volta e' giusto.
 */
export function idoneoAInvestimento(movimento) {
  if (!movimento || movimento.direction !== "uscita") return false;
  return !movimento.causale?.di_sistema;
}

/**
 * Perche' questo movimento non puo' portare l'etichetta, in italiano.
 *
 * ⚠️ Serve a chi legge la Prima nota e non trova il gesto su una riga: senza
 *    una frase, l'assenza si legge come un guasto. Torna `null` quando il
 *    movimento e' idoneo — cioe' quando non c'e' niente da spiegare.
 *
 * ⚠️ LE DUE FRASI HANNO LUNGHEZZE DIVERSE APPOSTA. Su un'entrata la ragione
 *    e' ovvia appena la si nomina, e una riga lunga sarebbe ingombro su ogni
 *    riga di entrata dell'elenco. Sulla riga scritta dal gestionale no: li'
 *    la domanda vera e' *«perche' proprio su questa non posso?»*, e una
 *    risposta corta la lascerebbe aperta.
 */
export function ragioneNonIdoneo(movimento) {
  if (!movimento || idoneoAInvestimento(movimento)) return null;
  if (movimento.direction !== "uscita") {
    return "Un'entrata non e' un investimento: sono soldi che arrivano.";
  }
  return (
    "Questa riga la scrive il gestionale da se' — un versamento, una differenza di cassa, " +
    "un rimborso o la restituzione di un prestito. Non e' una spesa: e' denaro che cambia posto, " +
    "o un debito che si chiude. Contarla farebbe crescere due volte il costo del progetto."
  );
}

// ---------------------------------------------------------------------
// 3. I TRE NUMERI
// ---------------------------------------------------------------------
const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Da quello che il database ha aggregato per soggetto, i tre numeri.
 *
 * 🔴 IL TOTALE E' LA SOMMA VISIBILE DELLE DUE PARTI, non un terzo conteggio:
 *    `totale` si calcola **da `dentro`**, quindi non puo' raccontare una
 *    cosa diversa da quello che c'e' scritto sopra. Un totale calcolato per
 *    conto suo e' un numero che un giorno non combacia e nessuno sa perche'.
 *
 * ⚠️ E LE DUE VOCI CI SONO SEMPRE, anche a zero: una colonna che sparisce
 *    quando e' vuota fa credere che quel soggetto non esista. *Il vuoto non
 *    e' zero, ma qui lo zero e' una risposta vera — «da li' non e' uscito
 *    niente» — ed e' diverso dal non saperlo.*
 *
 * @param righe  [{ tipo, soggetto, quante, totale }] — come le restituisce
 *               `costo_del_progetto()`: una riga per soggetto che ha almeno
 *               un'uscita marcata.
 */
export function totaliDelProgetto(righe) {
  const arrivate = Array.isArray(righe) ? righe : [];

  const dentro = SOGGETTI_DEL_COSTO.map((tipo) => {
    const r = arrivate.find((x) => x?.tipo === tipo);
    return {
      tipo,
      soggetto: r?.soggetto || NOMI_PREDEFINITI[tipo],
      quante: Number(r?.quante ?? 0),
      totale: numero(r?.totale),
    };
  });

  // ⚠️ Fuori dal totale si dichiara solo chi ha davvero qualcosa marcato:
  //    una riga «Orto Borgo 58 — 0,00 €» sarebbe ingombro permanente per un
  //    caso che quasi sempre non c'e'.
  const fuori = arrivate
    .filter((r) => r?.tipo && !nelCostoDelProgetto(r.tipo))
    .map((r) => ({
      tipo: r.tipo,
      soggetto: r.soggetto || r.tipo,
      quante: Number(r.quante ?? 0),
      totale: numero(r.totale),
    }));

  return {
    dentro,
    fuori,
    totale: dentro.reduce((s, r) => s + r.totale, 0),
    // Quante righe compongono i tre numeri: serve a sapere se il dettaglio
    // che si e' riusciti a leggere e' intero (vedi `dettaglioCompleto`).
    quante: dentro.reduce((s, r) => s + r.quante, 0),
  };
}

// ---------------------------------------------------------------------
// 4. IL DETTAGLIO E' INTERO, OPPURE LO DICE
// ---------------------------------------------------------------------
/**
 * Il dettaglio mostrato compone davvero i totali?
 *
 * 🔴 PERCHE' SERVE, e non e' teorico. Chiedendo un elenco al database senza
 *    dire quante righe si vogliono ne tornano **al massimo mille, senza
 *    nessun errore** (19/08). I totali qui sopra non possono esserne
 *    toccati — arrivano da un'**aggregazione**, che consegna una riga per
 *    soggetto — ma il dettaglio si'.
 *
 * ⚠️ E IL SEGNALE DELLE LETTURE TAGLIATE NON COPRE QUESTO CASO: vive nelle
 *    letture di elenco (`GET` verso PostgREST) e legge `Content-Range`.
 *    Queste due letture sono **chiamate a funzione** — `POST` — quindi di li'
 *    non passano. Il confronto va fatto a mano, ed e' questo.
 *
 * ⚠️ Si confronta col numero che l'**aggregazione** dichiara, non con la
 *    lunghezza attesa a occhio: e' l'unico numero che non puo' essere stato
 *    tagliato.
 */
export function dettaglioCompleto(totali, righe) {
  const attese = Number(totali?.quante ?? 0) + (totali?.fuori ?? []).reduce((s, r) => s + Number(r.quante ?? 0), 0);
  const mostrate = Array.isArray(righe) ? righe.length : 0;
  return { attese, mostrate, completo: mostrate >= attese };
}

/**
 * Il dettaglio, tenendo separato chi entra nel totale da chi no.
 *
 * ⚠️ La stessa regola di `totaliDelProgetto`, applicata riga per riga: se le
 *    due usassero criteri diversi, il dettaglio non comporrebbe i totali che
 *    dichiara di comporre.
 */
export function dettaglioDelProgetto(righe) {
  const arrivate = Array.isArray(righe) ? righe : [];
  return {
    dentro: arrivate.filter((r) => nelCostoDelProgetto(r?.tipo)),
    fuori: arrivate.filter((r) => r?.tipo && !nelCostoDelProgetto(r.tipo)),
  };
}

/**
 * La somma degli importi di un elenco di righe di dettaglio.
 *
 * ⚠️ NON e' il totale che la schermata mostra — quello viene
 *    dall'aggregazione, che non si puo' tagliare. Serve al controllo
 *    incrociato: se il dettaglio e' intero, le due somme devono combaciare.
 */
export function sommaRighe(righe) {
  return (Array.isArray(righe) ? righe : []).reduce((s, r) => s + numero(r?.importo), 0);
}

// ---------------------------------------------------------------------
// 5. LEGGERE UN ELENCO PIU' LUNGO DEL TETTO
// ---------------------------------------------------------------------
// Quante righe per pagina, e quante pagine al massimo.
//
// ⚠️ IL TETTO SI DICHIARA invece di essere infinito: un ciclo che non si
//    ferma mai su una risposta che non cala girerebbe per sempre. Ventimila
//    righe di dettaglio sono fuori portata di un locale da 34 coperti, e se
//    un giorno non lo fossero la schermata **lo dice** (`dettaglioCompleto`)
//    invece di mostrare un elenco corto con l'aria di essere intero.
export const PER_PAGINA = 1000;
export const PAGINE_MAX = 20;

/**
 * Legge un elenco a pagine, finche' non finisce.
 *
 * 🔴 PERCHE' NON BASTA UNA LETTURA SOLA. Chiedendo un elenco al database
 *    senza dire quante righe si vogliono ne tornano **al massimo mille,
 *    senza nessun errore** (19/08): la risposta e' piu' corta e sembra
 *    intera. Il segnale che le denuncia vive nel punto unico da cui passano
 *    le letture di **elenco** (`GET` verso PostgREST) e legge
 *    `Content-Range`; una **chiamata a funzione** e' una `POST`, e di li'
 *    non passa.
 *
 * ⚠️ LA REGOLA STA QUI E NON DENTRO L'API, cosi' si prova senza database:
 *    che chieda la seconda pagina quando la prima e' piena, che si fermi
 *    quando ne arriva una corta, e che non giri all'infinito se non cala
 *    mai. Sono le tre cose che si possono sbagliare, e nessuna delle tre
 *    darebbe un errore.
 *
 * @param leggiPagina  (da, a) => Promise<righe[]>, estremi inclusivi.
 */
export async function leggiAPagine(leggiPagina, { perPagina = PER_PAGINA, pagineMax = PAGINE_MAX } = {}) {
  const tutte = [];
  for (let pagina = 0; pagina < pagineMax; pagina += 1) {
    const da = pagina * perPagina;
    const arrivate = (await leggiPagina(da, da + perPagina - 1)) ?? [];
    tutte.push(...arrivate);
    if (arrivate.length < perPagina) break;
  }
  return tutte;
}

// ---------------------------------------------------------------------
// 6. LE DUE FONTI: LA PRIMA NOTA E «ANTICIPO IO, POI MI RIMBORSO»
// ---------------------------------------------------------------------
// 🔴 PERCHE' SONO DUE. Un investimento pagato di tasca propria **per conto
//    della societa'** non passa da `cash_movements`: vive in
//    `anticipazioni_socio`. In prima nota compare solo il **rimborso**, con
//    una causale di sistema — giustamente non marcabile, perche' un rimborso
//    non e' una spesa. Con una fonte sola quel denaro non aveva **nessuna
//    porta** da cui entrare nel costo del progetto, e risultava zero.
//
// ⚠️ E NON SI SOVRAPPONGONO: sono due tabelle diverse, e l'unico punto in
//    cui potrebbero raccontare la stessa spesa — la **fattura** — e' chiuso
//    dal database, che rifiuta la seconda marcatura sullo stesso
//    `supplier_invoice_id`. Qui non c'e' nessuno scarto da fare, e non deve
//    essercene: uno scarto in questo punto farebbe sparire in silenzio una
//    riga che Alessio ha marcato.

export const PRIMA_NOTA = "prima_nota";
export const ANTICIPAZIONE = "anticipazione";

export function eUnAnticipo(riga) {
  return riga?.fonte === ANTICIPAZIONE;
}

/**
 * Il segno che distingue un anticipo da un'uscita di cassa.
 *
 * ⚠️ «Anticipo rimborsabile» e non «tasca»: sono due cose diverse e
 *    confonderle sarebbe il difetto peggiore di questa schermata. La tasca
 *    e' denaro suo che **non torna indietro**; un anticipo e' denaro suo che
 *    la societa' gli **deve**. Il totale li tiene gia' separati — l'anticipo
 *    sta sotto Borgo 58, la tasca sotto la tasca — e la parola lo deve dire.
 */
export function etichettaFonte(riga) {
  return eUnAnticipo(riga) ? "Anticipo rimborsabile" : null;
}

const FONDI_IN_ITALIANO = {
  contanti: "in contanti suoi",
  conto_personale: "dal suo conto personale",
};

/**
 * Chi ha materialmente anticipato, con le parole del modulo.
 *
 * ⚠️ IL GESTIONALE NON REGISTRA UNA PERSONA: `anticipazioni_socio` e', per
 *    definizione, «cio' che **il titolare** paga con fondi propri per conto
 *    della societa'» (15/08). Quello che registra in piu' e' `fondi`, cioe'
 *    **con quali dei suoi soldi**. Si dice quello che si sa, e non si
 *    inventa un nome.
 *
 * ⚠️ E `fondi` NON e' `mezzo`: `cassa`/`banca` dice da dove escono i soldi
 *    **della societa'**, `contanti`/`conto_personale` dice con quali soldi
 *    **suoi** ha anticipato. Sono due vocabolari, e infilare gli uni negli
 *    altri ne produrrebbe uno finto (lezione del 17/08).
 */
export function chiHaAnticipato(riga) {
  if (!eUnAnticipo(riga)) return null;
  const come = FONDI_IN_ITALIANO[riga?.fondi];
  return come ? `il titolare, ${come}` : "il titolare";
}

/**
 * La colonna «Da dove» del dettaglio, per tutt'e due le fonti.
 *
 * ⚠️ Le parole del modulo, mai i codici del database (regola dell'11/09):
 *    «Contante» e non `cassa`, «in contanti suoi» e non `contanti`.
 */
export function daDove(riga) {
  if (eUnAnticipo(riga)) {
    return [etichettaFonte(riga), chiHaAnticipato(riga)].filter(Boolean).join(" · ");
  }
  return riga?.mezzo === "banca" ? "Banca" : "Contante";
}

/**
 * «In cosa», per tutt'e due le fonti, coi campi che esistono gia'.
 *
 * ⚠️ Nessun campo nuovo (decisione del 31/08): sulla prima nota lo dicono la
 *    causale, la finalita' e la nota; su un anticipo il **motivo** (il tag) e
 *    la nota. Un campo «in cosa» sarebbe una seconda risposta alla stessa
 *    domanda.
 */
export function inCosa(riga) {
  return [riga?.causale, riga?.descrizione, riga?.nota].filter(Boolean).join(" · ");
}
