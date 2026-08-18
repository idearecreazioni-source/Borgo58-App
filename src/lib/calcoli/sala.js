// Le tre misure con cui la sala decide che due tavoli sono accostati.
//
// ⚠️ PERCHÉ STANNO QUI E NON SPARSE. Sono numeri che **devono accordarsi
// fra loro**, e fino al 18/08/2026 stavano in due posti che non si
// nominavano: il passo della griglia in `PiantaSala.jsx`, la tolleranza di
// contatto dentro la funzione `coperti_del_giorno()` del database. Due
// numeri legati da un rapporto, scritti come se fossero indipendenti — che
// è la forma in cui un giorno qualcuno ne cambia uno solo.
//
// Rilievo della validazione del 18/08, e la misura che l'ha ridimensionato
// senza chiuderlo: nella sala vera i tavoli accostati stanno a distanza
// **zero**, non a 10. Quindi oggi il problema non morde. Ma «oggi non
// morde» non è una regola, e il numero su cui non morde è quello con cui si
// accettano le prenotazioni.
//
// IL RAPPORTO, scritto una volta:
//
//   Le posizioni si agganciano a una griglia di GRIGLIA_CM, e **tutte** le
//   misure delle sagome sono multipli di GRIGLIA_CM. Quindi ogni bordo cade
//   su un multiplo di GRIGLIA_CM, e la distanza fra due sagome può valere
//   solo 0, GRIGLIA_CM, 2·GRIGLIA_CM… — mai qualcosa in mezzo.
//   Finché TOLLERANZA_CONTATTO_CM sta **strettamente fra 0 e GRIGLIA_CM**,
//   «distanza ≤ tolleranza» e «distanza = 0» sono la **stessa cosa**, e la
//   tolleranza non fa danno né serve a niente: c'è per assorbire un
//   arrotondamento, non per accostare tavoli lontani.
//
// ⚠️ L'ipotesi che regge tutto è la seconda — *tutte le misure sono
// multipli del passo* — ed è vera oggi **per come sono fatti i mobili di
// Alessio, non per un vincolo**. Il giorno che entrasse in sala un tavolo
// da 95 cm, la tolleranza smetterebbe di essere equivalente al contatto
// esatto e diventerebbe una decisione che nessuno ha preso.
// Per questo NON è un vincolo del database — vietare a Alessio un mobile di
// una misura qualsiasi sarebbe una regola scritta da me sulle sue cose — ma
// è una **prova che diventa rossa da sola** (`tests/app/coperti-sala.test.js`):
// quando smetterà di essere vero, lo si saprà leggendo un errore, non
// contando male i coperti di una serata.

/** Il passo a cui si agganciano le sagome trascinate sulla pianta. */
export const GRIGLIA_CM = 10;

/**
 * Quanto due bordi possono distare e contare ancora come «si toccano».
 * Deve stare strettamente fra 0 e GRIGLIA_CM — vedi il rapporto qui sopra.
 * Lo stesso numero vive dentro `coperti_del_giorno()` nel database.
 */
export const TOLLERANZA_CONTATTO_CM = 5;

/**
 * Quanto devono sovrapporsi due lati perché il contatto sia un tavolone e
 * non uno spigolo che sfiora.
 *
 * ⚠️ È **aritmetica scritta, non geometria**, esattamente come il «meno due
 * per ogni giunzione»: nessuno ha misurato che a 29 cm non ci si sieda. È la
 * soglia sotto la quale due tavoli, pur toccandosi, non formano un piano su
 * cui apparecchiare. Visto lavorare nella sala vera: T5-T8 e T6-T7 stanno a
 * distanza zero e non si sovrappongono per niente, e correttamente non
 * risultano accostati.
 */
export const CONTATTO_MINIMO_CM = 30;

/** La tolleranza è utile solo se non può accostare due tavoli distinti. */
export function tolleranzaCoerenteCollaGriglia(
  tolleranza = TOLLERANZA_CONTATTO_CM,
  griglia = GRIGLIA_CM
) {
  return tolleranza >= 0 && tolleranza < griglia;
}

/**
 * Le misure che romperebbero l'equivalenza «tolleranza = contatto esatto».
 * Vuoto = l'ipotesi regge.
 */
export function sagomeFuoriGriglia(sagome, griglia = GRIGLIA_CM) {
  return sagome
    .filter((s) => s.larghezza_cm % griglia !== 0 || s.profondita_cm % griglia !== 0)
    .map((s) => `${s.label} (${s.larghezza_cm}×${s.profondita_cm})`);
}
