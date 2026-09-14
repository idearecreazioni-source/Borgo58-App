// LE PORTATE CHE HANNO UN POSTO NEL MENU — 12/09/2026, mandato esteso.
//
// 🔴 IL DIFETTO: «SI SALVA MA SPARISCE». Un piatto di finger food si poteva
//    mettere in un menu dalla sua scheda (pannello «Nei menu»), e da lì in
//    poi non compariva più né nella scheda del menu (`MenuDetail`, sezioni
//    antipasti, primi, secondi, dolci) né nel foglio stampato
//    (`EditorMenuHome`, stesse quattro sezioni). Nessun errore: la riga
//    c'era, e nessuna delle due schermate la mostrava.
//
// ⚠️ LA CURA È UN DIVIETO, NON UNA SEZIONE NUOVA, per decisione di Alessio
//    (12/09): *«finché non esiste una sezione dedicata scelta da me,
//    impedisci che un finger food possa essere inserito in un menu»*. Dove
//    vada la sezione è una scelta del menu, e resta sua.
//
// ⚠️ IL PREZZO, dichiarato perché non si veda solo dopo: la sala ordina
//    dal menu attivo (`menu_items_display` non filtra per portata, e la
//    Sala raggruppa per tutte le categorie, finger food compreso). Quindi,
//    finché vale il divieto, un piatto di finger food NUOVO non si ordina
//    dal menu, e il bis — che parte da una selezione ordinata — non ha da
//    dove partire. Quelli che sono già in un menu restano dove sono: il
//    divieto non tocca nessun piatto esistente.
//
// ⚠️ IL DIVIETO STA NEL PUNTO UNICO DA CUI IL GESTIONALE SCRIVE UNA VOCE DI
//    MENU (`addMenuItem` in `src/lib/api/menus.js`), e le schermate lo
//    chiedono qui per non offrire un gesto che verrebbe rifiutato. Non è un
//    vincolo del database: quello vorrebbe una migrazione, fuori dal mandato
//    del 12/09. Chi scrivesse dritto nella tabella passerebbe ancora.
//
// ⚠️ E L'ELENCO È UNO SOLO PER LE DUE DOMANDE: «può entrare?» e «ha una
//    sezione?» devono dare la stessa risposta, o si ricomincia. Le sezioni
//    delle due schermate sono scritte ciascuna nel suo file; la prova
//    `tests/schermate/finger-food-nel-menu.test.jsx` le monta e diventa
//    rossa se una portata entra senza comparire in una delle due.
export const SEZIONI_DEL_MENU = Object.freeze(["antipasto", "primo", "secondo", "dolce"]);

export const FINGER_NON_PREVISTI =
  "I finger food non sono ancora previsti nel menu: non comparirebbero né nella scheda del menu né nel foglio stampato.";

// La ragione per cui una portata non entra, o `null` se entra.
export function percheNonEntraNelMenu(category) {
  if (SEZIONI_DEL_MENU.includes(category)) return null;
  if (category === "finger_food") return FINGER_NON_PREVISTI;
  return "Questa portata non ha ancora un posto nel menu: non comparirebbe né nella scheda del menu né nel foglio stampato.";
}

export const entraNelMenu = (category) => percheNonEntraNelMenu(category) === null;

// Le voci già in un menu che nessuna sezione mostra: si dichiarano, non si
// toccano.
export const fuoriDalleSezioni = (voci) => (voci ?? []).filter((v) => !entraNelMenu(v.category));
