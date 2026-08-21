// =====================================================================
// SI SELEZIONA UN TAVOLO O UN TAVOLONE, MAI DUE TAVOLI LONTANI
// =====================================================================
// 🔴 NATA DA UN DIFETTO TROVATO DA ALESSIO col tablet in mano, 21/08/2026:
// ogni tocco SOMMAVA alla selezione. Si potevano prendere T1 e T9 — i due
// capi della sala — e aprirci sopra **una comanda sola**. Non è una comanda:
// è un errore che nessuno vede finché non arriva il preconto.
//
// ⚠️ QUI NON SI DECIDE COSA SIA UN TAVOLONE. Quello lo conta il database
// (`coperti_del_giorno`) e lo ridice `insiemiPerTavolo` — **la stessa mappa
// che colora la sala**. Questa funzione riceve l'insieme già fatto.
//
// ⚠️ Ed è la ragione per cui la regola vive qui e non dentro la schermata:
// una regola dentro un componente non la guarda nessuna prova, e in questo
// progetto **nessuna prova apre una schermata**.

/**
 * Che cosa resta selezionato dopo un tocco.
 *
 * @param selezione  gli id selezionati adesso
 * @param insieme    il tavolo toccato col suo tavolone (un tavolo singolo è
 *                   un insieme di uno)
 * @returns          la selezione nuova
 *
 * I quattro casi, che sono quelli chiesti da Alessio:
 *   · niente selezionato        → si seleziona l'insieme toccato
 *   · toccato un ALTRO tavolo   → si CAMBIA selezione, non si somma
 *   · ritoccato lo stesso       → si annulla
 *   · toccato un altro tavolo
 *     dello STESSO tavolone     → si annulla (è lo stesso insieme)
 */
export function selezioneDopoIlTocco(selezione = [], insieme = []) {
  if (insieme.length === 0) return selezione;
  const stessoInsieme =
    selezione.length === insieme.length && insieme.every((id) => selezione.includes(id));
  return stessoInsieme ? [] : [...insieme];
}

// =====================================================================
// DA UN CONTO APERTO SI DEVE POTER USCIRE
// =====================================================================
// 🔴 MISURATO IL 21/08 e confermato dalle mani di Alessio: **non esisteva
// nessuna uscita**. Il conto lasciava lo schermo solo incassando o
// annullando — e annullare non si può più appena qualcosa è andato in
// cucina. Chi apriva il tavolo sbagliato in servizio aveva una via sola:
// **incassare**.
//
// ⚠️ E il difetto non era «il tavolo resta acceso»: era che **due stati si
// vedono uguali** — «l'ho scelto» sa annullarsi, «ci sto lavorando dentro»
// non aveva proprio un modo di finire. Colorarli diversi non basterebbe: il
// tavolo si vedrebbe di un altro colore e resterebbe inchiodato lì.

/**
 * Che cosa si sta guardando, adesso.
 *
 * 🔴 ESISTE PER RENDERE IMPOSSIBILE UNA COSA, non per descriverla. Prima le
 * due parti della schermata comparivano per conto proprio — una se c'era una
 * selezione, l'altra se c'era un conto — e **nessuna sapeva dell'altra**.
 * Alessio se le è viste insieme sul tablet: «Divano 3 · Apri il tavolo»
 * sopra, e sotto «COMANDA IN CORSO — T3» col totale e Chiudi conto.
 *
 * ⚠️ Due comande davanti agli occhi in servizio è il modo più diretto per
 * mandare i piatti di un tavolo a un altro — **un errore che si scopre dalla
 * cucina, non dallo schermo**. Con una risposta sola non possono più
 * convivere: non è una regola da rispettare, è un caso che non esiste.
 */
export function cosaSiVede({ conto = null, selezione = [] } = {}) {
  if (conto) return "conto";
  if (selezione.length > 0) return "selezione";
  return "sala";
}

/**
 * L'esito di un tocco su una sagoma.
 *
 * @param contoAperto     l'id del conto che si sta guardando (o null)
 * @param contoDelTavolo  l'id del conto sul tavolo toccato (o null)
 * @param selezione       gli id selezionati adesso
 * @param insieme         il tavolo toccato col suo tavolone
 * @param spostando       si sta spostando un conto su altri tavoli
 *
 * @returns { azione, contoId?, selezione?, lasciaIlConto }
 *
 * ⚠️ `lasciaIlConto` è la **modalità veloce** decisa da Alessio: toccando un
 * altro tavolo mentre un conto è aperto, il conto si lascia e si passa al
 * nuovo **con un gesto solo**. Chi la esegue deve lasciarlo PRIMA di
 * mostrare il resto, mai dopo.
 *
 * ⚠️ MENTRE SI SPOSTA UN CONTO il conto NON si lascia: lì la selezione serve
 * a dire *dove* lo si sposta, e lasciarlo a metà del gesto perderebbe
 * proprio la cosa che si sta spostando.
 *
 * ⚠️ E toccare il tavolo del conto che si sta già guardando NON FA NIENTE:
 * l'uscita è una riga in cima al conto, non il tocco sul tavolo. Un gesto in
 * più costa meno di un'uscita accidentale da un conto in corso.
 */
export function esitoDelTocco({
  contoAperto = null,
  contoDelTavolo = null,
  selezione = [],
  insieme = [],
  spostando = false,
} = {}) {
  if (contoDelTavolo) {
    if (spostando) return { azione: "rifiuta", lasciaIlConto: false };
    if (contoDelTavolo === contoAperto) return { azione: "resta", lasciaIlConto: false };
    return { azione: "apri-conto", contoId: contoDelTavolo, lasciaIlConto: Boolean(contoAperto) };
  }
  return {
    azione: "seleziona",
    selezione: selezioneDopoIlTocco(selezione, insieme),
    lasciaIlConto: Boolean(contoAperto) && !spostando,
  };
}
