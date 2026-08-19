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

// =====================================================================
// IL DISEGNO — quanto grande finisce sullo schermo (18/08/2026, giro E)
// =====================================================================

/**
 * Il verso vero di una sagoma.
 *
 * ⚠️ DIFETTO TROVATO MISURANDO PER L'AGGANCIO, non leggendo: `ruotato`
 * era onorato dal **conteggio** (`coperti_del_giorno()` scambia larghezza
 * e profondità) e **ignorato dal disegno**, che disegnava T1 e T2 sdraiati
 * 180×90 mentre il database li contava in piedi 90×180. Due tavoli veri
 * della sala di Alessio, disegnati con un ingombro che il numero non
 * riconosceva — cioè esattamente il guasto che l'aggancio deve evitare:
 * *lo schermo dice «attaccati» e il numero dice «separati»*.
 *
 * Chi comanda è il database, e non per gerarchia: la decisione del 14/08
 * dice **«il disegno gira mentre la misura del mobile resta 180×90»**, ed
 * è quello che fa il conteggio. Quindi si corregge il disegno.
 *
 * Da qui in avanti nessuno legge `larghezza_cm` di una sagoma senza
 * passare da qui.
 */
export function misureSagoma(sagoma) {
  return sagoma?.ruotato
    ? { larghezza: sagoma.profondita_cm, profondita: sagoma.larghezza_cm }
    : { larghezza: sagoma.larghezza_cm, profondita: sagoma.profondita_cm };
}

/**
 * Quanto si rimpicciolisce il disegno della sala rispetto alla regola dei
 * tocchi (1,05 cm reali per il tavolo più piccolo).
 *
 * ⚠️ È UN ROVESCIAMENTO DICHIARATO, e il numero non è un quarto tondo
 * scelto a occhio: è **il minimo necessario più un margine misurato**.
 *
 *   La pianta in piedi pretende (1030 / 90) × 1,05 = 12,02 cm reali, che
 *   col righello di fabbrica (37,8 px/cm) fanno **454 punti**. Sul telefono
 *   di Alessio — iPhone da 390 punti, meno i 16+16 di margine della pagina
 *   — ne restano **358**. Il minimo esatto sarebbe quindi **0,788**, e non
 *   va preso: lascia zero margine, e basta un punto di differenza per
 *   tornare a scorrere di lato. A 0,75 il pavimento è 341 punti.
 *
 * ⚠️ E il margine non costa NIENTE sul suo telefono, che è il motivo per
 * cui si può essere generosi: 341 sta sotto 358, quindi lì comanda la
 * larghezza del contenitore e la pianta si disegna a 358 punti **con
 * qualunque fattore sotto 0,788**. Il pavimento morde solo su uno schermo
 * più stretto — un telefono da 375 punti — e lì il margine è tutto ciò che
 * separa «entra» da «scorre».
 */
export const RIDUZIONE_DISEGNO = 0.75;

/**
 * Quanto vicino deve arrivare il DITO perché due tavoli si aggancino.
 *
 * ⚠️ IN DITO REALE, MAI IN UNITÀ DEL DISEGNO — ed è la trappola che questo
 * numero esiste per non ripetere: una distanza scritta in centimetri di
 * sala si accorcerebbe da sola ogni volta che la pianta si rimpicciolisce,
 * cioè l'aggancio peggiorerebbe proprio nel giro che lo costruisce.
 *
 * Un quinto del bersaglio di tocco del progetto (1,05 cm). Sul telefono
 * di Alessio fa circa 8 punti di schermo di raggio, cioè una ventina di
 * centimetri di sala.
 *
 * ⚠️ IL PREZZO, DICHIARATO: due tavoli **dello stesso formato** che si
 * guardano da meno di una ventina di centimetri non si possono più
 * lasciare staccati — il magnete li unisce. In una sala vera è un
 * passaggio in cui non ci si passa comunque, e la via d'uscita c'è: si
 * scostano di lato finché la sovrapposizione scende sotto CONTATTO_MINIMO_CM.
 */
export const AGGANCIO_DITO_CM = 0.2;

/**
 * Il raggio del magnete in centimetri di SALA, dedotto da quanto è grande
 * il disegno adesso.
 *
 * @param cmPerPixel  quanti centimetri di sala vale un punto di schermo
 * @param pxcm        quanti punti di schermo vale un centimetro vero
 */
export function raggioAggancioCm(cmPerPixel, pxcm, ditoCm = AGGANCIO_DITO_CM) {
  if (!(cmPerPixel > 0) || !(pxcm > 0)) return 0;
  return ditoCm * pxcm * cmPerPixel;
}

/**
 * IL MAGNETE. Data una sagoma trascinata in (x, y), la porta a combaciare
 * col vicino più vicino — se un vicino c'è, se è dello stesso formato, e se
 * il contatto che ne uscirebbe è un tavolone e non uno spigolo.
 *
 * ⚠️ STA QUI, ACCANTO A `TOLLERANZA_CONTATTO_CM` E `CONTATTO_MINIMO_CM`,
 * e non è una comodità: l'aggancio deve portare i tavoli **davvero dentro
 * la tolleranza con cui il database li conta accostati**. Se agganciasse a
 * una distanza che il conteggio non riconosce, lo schermo direbbe
 * «attaccati» e il numero direbbe «separati» — e il numero è quello con
 * cui si accettano le prenotazioni. Qui il magnete porta la distanza a
 * **zero esatto**, che sta dentro qualunque tolleranza non negativa; le
 * prove lo verificano contro le stesse costanti, non contro una copia.
 *
 * Restituisce sempre una posizione: se nessun vicino chiama, è quella di
 * partenza, con `agganci` vuoto.
 *
 * @param sagoma   { id, formato_id, larghezza, profondita }  già nel verso vero
 * @param vicini   [{ id, formato_id, x, y, larghezza, profondita }]
 * @param raggioCm il raggio del magnete in centimetri di sala
 * @param limiti   { larghezza, profondita } della sala: fuori non si va
 */
export function agganciaAiVicini({ sagoma, vicini = [], x, y, raggioCm, limiti }) {
  const nulla = { x, y, agganci: [] };
  if (!(raggioCm > 0) || !sagoma) return nulla;

  const w = sagoma.larghezza;
  const h = sagoma.profondita;
  const sovrapposizione = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1);
  const dentro = (px, py) =>
    !limiti ||
    (px >= 0 && py >= 0 && px + w <= limiti.larghezza && py + h <= limiti.profondita);

  let scelta = null;
  for (const v of vicini) {
    if (v.id === sagoma.id) continue;
    // La regola di Alessio è lo STILE, non la misura: il gestionale non
    // deve nemmeno OFFRIRE l'accostamento fra formati diversi.
    if (!v.formato_id || v.formato_id !== sagoma.formato_id) continue;

    const vx2 = v.x + v.larghezza;
    const vy2 = v.y + v.profondita;
    // I quattro modi di appoggiarsi a un vicino. Per ciascuno, sull'altro
    // asse si può PAREGGIARE uno dei due bordi oppure restare dove si è.
    const lati = [
      { asse: "x", dove: vx2 },
      { asse: "x", dove: v.x - w },
      { asse: "y", dove: vy2 },
      { asse: "y", dove: v.y - h },
    ];
    for (const lato of lati) {
      const suX = lato.asse === "x";
      const passo = Math.abs(lato.dove - (suX ? x : y));
      if (passo > raggioCm) continue;
      // ⚠️ IL PAREGGIO VIENE PRIMA DEL «RESTA DOVE SEI», e non è una
      // preferenza estetica: un magnete che unisce lasciando uno scalino
      // di 10 cm disegna un tavolone che non sembra un tavolone — cioè
      // disfa con una mano quello che la linea di giunzione fa con
      // l'altra. E il pareggio aumenta la sovrapposizione, quindi non può
      // far contare un tavolone che il database non conterebbe.
      const perpendicolari = suX ? [v.y, vy2 - h, y] : [v.x, vx2 - w, x];
      for (const perp of perpendicolari) {
        const px = suX ? lato.dove : perp;
        const py = suX ? perp : lato.dove;
        if (Math.abs(perp - (suX ? y : x)) > raggioCm) continue;
        if (!dentro(px, py)) continue;
        const tocco = suX
          ? sovrapposizione(py, py + h, v.y, vy2)
          : sovrapposizione(px, px + w, v.x, vx2);
        if (tocco < CONTATTO_MINIMO_CM) continue;
        if (!scelta || passo < scelta.passo) scelta = { x: px, y: py, passo };
        // L'elenco delle perpendicolari è già in ordine di preferenza:
        // il primo che passa è il migliore per questo lato.
        break;
      }
    }
  }

  if (!scelta) return nulla;
  // Chi altro finisce attaccato con questa posizione: un tavolo infilato
  // fra due ne tocca due, e l'avviso a schermo deve dirlo.
  const agganci = vicini
    .filter((v) => v.id !== sagoma.id && v.formato_id === sagoma.formato_id)
    .filter((v) => {
      const vx2 = v.x + v.larghezza;
      const vy2 = v.y + v.profondita;
      const perX =
        (Math.abs(scelta.x + w - v.x) <= TOLLERANZA_CONTATTO_CM ||
          Math.abs(vx2 - scelta.x) <= TOLLERANZA_CONTATTO_CM) &&
        sovrapposizione(scelta.y, scelta.y + h, v.y, vy2) >= CONTATTO_MINIMO_CM;
      const perY =
        (Math.abs(scelta.y + h - v.y) <= TOLLERANZA_CONTATTO_CM ||
          Math.abs(vy2 - scelta.y) <= TOLLERANZA_CONTATTO_CM) &&
        sovrapposizione(scelta.x, scelta.x + w, v.x, vx2) >= CONTATTO_MINIMO_CM;
      return perX || perY;
    })
    .map((v) => v.id);

  return { x: scelta.x, y: scelta.y, agganci };
}

// =====================================================================
// IL FONDALE — la sala disegnata sotto le sagome
// =====================================================================
//
// ⚠️ STA QUI E NON IN api/sala.js dal 19/08: non è un accesso al database,
// è un dato del DISEGNO. E qui si può provare senza collegarsi a niente —
// che è precisamente ciò che serve, perché `riquadroDelPannello()` filtra
// queste zone PER NOME.
//
// 🔴 LA TRAPPOLA, dichiarata: i nomi delle zone non si disegnano più a
// schermo (Alessio li ha tolti il 19/08), ma **devono restare nei dati**. Se
// sparissero, il pannello dentro la pianta smetterebbe di comparire e
// nessuno se ne accorgerebbe: è una cosa che non dà nessun errore, si limita
// a non succedere. La prova che lo dichiara sta in
// tests/unita/sala-misure.test.js.
// La sala disegnata come sfondo: perimetro e zone, non dati. Il fondale
// non è interattivo — pareti e zone non si spostano, non si
// ridimensionano, non hanno stato. Le proporzioni vengono dalla
// planimetria Sweet Home 3D di Alessio: non servono le misure reali della
// sala, serve che le zone siano riconoscibili a colpo d'occhio.
export const SALA_LARGHEZZA_CM = 2070;
export const SALA_PROFONDITA_CM = 1030;

export const ZONE_FONDALE = [
  { nome: "Servizi", x: 0, y: 0, larghezza: 530, profondita: 515, servizio: true },
  { nome: "Cucina", x: 530, y: 0, larghezza: 870, profondita: 515, servizio: true },
  { nome: "Sala alta", x: 1400, y: 0, larghezza: 670, profondita: 515 },
  { nome: "Sala bassa", x: 0, y: 515, larghezza: 1830, profondita: 515 },
  { nome: "Bancone", x: 1830, y: 515, larghezza: 240, profondita: 515, servizio: true },
];

// =====================================================================
// LO SPAZIO VUOTO DENTRO LA PIANTA (19/08/2026, idea di Alessio)
// =====================================================================
//
// *«Potremmo sfruttare lo spazio utilizzato dentro la pianta per cucina e
// servizi inutilmente per far comparire le info sui tavoli.»* Risolve alla
// radice il problema rincorso per tutto il giro D3: il modulo che spinge la
// pianta in basso e obbliga a scorrere per prendere una prenotazione.
//
// ⚠️ QUALI ZONE SONO UNA SCELTA, LA GEOMETRIA NO. Le due zone sono nominate
// qui perché è una decisione — sono quelle in cui non c'è mai niente da
// guardare — mentre **dove stanno e quanto sono grandi lo dice il fondale**:
// se un giorno la cucina cambia misura, il pannello la segue. Se una delle
// due venisse rinominata, `riquadroDelPannello` restituisce null e il modulo
// torna sotto la pianta: si perde una comodità, non si disegna un pannello
// nel posto sbagliato.
export const ZONE_DEL_PANNELLO = ["Servizi", "Cucina"];

/** Il rettangolo che le zone scelte formano, o null se non lo formano. */
export function riquadroDelPannello(zone = []) {
  const scelte = zone.filter((z) => ZONE_DEL_PANNELLO.includes(z.nome));
  if (scelte.length !== ZONE_DEL_PANNELLO.length) return null;
  const x = Math.min(...scelte.map((z) => z.x));
  const y = Math.min(...scelte.map((z) => z.y));
  const x2 = Math.max(...scelte.map((z) => z.x + z.larghezza));
  const y2 = Math.max(...scelte.map((z) => z.y + z.profondita));
  // ⚠️ Solo se riempiono davvero il loro ingombro: due zone a L lascerebbero
  // un angolo scoperto, e il pannello ci finirebbe sopra il pavimento della
  // sala. Stessa regola con cui si decide se un tavolone si può disegnare
  // come un rettangolo unico.
  const piene = scelte.reduce((t, z) => t + z.larghezza * z.profondita, 0);
  if (piene !== (x2 - x) * (y2 - y)) return null;
  return { x, y, larghezza: x2 - x, profondita: y2 - y };
}

/**
 * Il margine con cui `pannelloNellaPianta()` guarda le sagome.
 *
 * ⚠️ È UNA SCELTA DICHIARATA, e la condizione posta dalla validazione la
 * chiedeva esplicitamente. Il pannello dentro la pianta esce quando un tavolo
 * gli finisce sopra (cura del 18/08); ma da oggi una sagoma si DISEGNA più
 * grande di quanto è, quindi guardando le misure vere il pannello potrebbe
 * restare e il tavolo finirgli sotto — cioè tornerebbe esattamente il costo
 * che si era eliminato.
 *
 * Quindi si guardano le misure **disegnate**, con il valore più grande che
 * l'ingrandimento può assumere: cresce al calare della larghezza dello
 * schermo, e sul telefono più stretto che il progetto considera (375 punti,
 * 343 di pianta) vale ~34 cm. ⚠️ Sbaglia quindi **per eccesso** su schermi
 * larghi — il pannello esce un po' prima del necessario. È la direzione
 * giusta in cui sbagliare: si perde una comodità, mai un gesto.
 */
export const MARGINE_INGRANDIMENTO_CM = 35;

/**
 * Il pannello può stare DENTRO la pianta? Solo se là dentro non c'è nessun
 * tavolo.
 *
 * ⚠️ È LA RISPOSTA AL COSTO CHE ERA STATO DICHIARATO, e non una dichiarazione
 * in più: misurando l'idea era emerso che **un tavolo finito sotto il pannello
 * non si potrebbe più afferrare** (trascinarcelo dentro invece funziona, per
 * via della cattura del puntatore). Invece di scriverlo a schermo e lasciarlo
 * succedere, il conflitto **non si fa esistere**: se qualcuno sposta un tavolo
 * sopra la cucina, il pannello esce dalla pianta e torna sotto — la comodità
 * si perde, il gesto no.
 *
 * *Quello spazio è vuoto sul disegno ma non è vietato, ed è esattamente il
 * genere di cosa che Alessio fa: i tavoli li muove lui.*
 */
export function pannelloNellaPianta(zone = [], sagome = [], margine = MARGINE_INGRANDIMENTO_CM) {
  const r = riquadroDelPannello(zone);
  if (!r) return null;
  // ⚠️ SI GUARDANO LE MISURE DISEGNATE, NON QUELLE VERE (19/08, condizione
  // posta dalla validazione). Dal 19/08 una sagoma si disegna più grande di
  // quanto è: guardando l'ingombro vero, un tavolo potrebbe apparire sopra
  // la cucina senza far uscire il pannello — e finirgli sotto, che è
  // esattamente il costo eliminato il 18/08.
  const m = Math.max(0, margine) / 2;
  // ⚠️ SI GUARDA IL VERSO VERO DELLA SAGOMA, ma su QUESTO fondale non decide
  // niente — e la cosa è emersa da una rottura fatta apposta, non rileggendo:
  // sostituendo `misureSagoma` con le misure sulla carta, **nessuna prova
  // diventava rossa**. La ragione è che l'area del pannello parte dall'angolo
  // (0,0): una sagoma la tocca se e solo se il suo spigolo in alto a sinistra
  // ci cade dentro, e quanto è grande non conta. Resta scritto giusto perché
  // il fondale può cambiare; la prova che fingeva di provarlo è stata tolta.
  const tocca = sagome.some((s) => {
    const mis = misureSagoma(s);
    return (
      s.x - m < r.x + r.larghezza &&
      s.x + mis.larghezza + m > r.x &&
      s.y - m < r.y + r.profondita &&
      s.y + mis.profondita + m > r.y
    );
  });
  return tocca ? null : r;
}

// =====================================================================
// LE SAGOME PIÙ GRANDI DEL VERO (19/08/2026) — rovesciamento di Alessio
// =====================================================================
//
// 🔴 QUI IL DISEGNO SMETTE DI DIRE IL VERO SULLO SPAZIO, ed è una scelta sua,
// presa dopo aver rifiutato le tre strade che conservavano la proporzione
// (ingrandire tutta la pianta accettando lo scorrimento laterale, togliere dal
// disegno la metà di cucina e servizi, ingrandire solo i testi). Vuole tavoli
// più facili da afferrare col dito: *«giusto 2 o 3 mm in più»*.
// Il racconto per esteso, col prezzo, sta in `docs/decisioni_rovesciate.md`.
//
// ⚠️ SI MISURA IN MILLIMETRI VERI, MAI IN CENTIMETRI DI SALA — la stessa
// ragione del raggio del magnete: un ingrandimento scritto in unità del
// disegno cambierebbe da solo a ogni ridimensionamento, cioè il tavolo
// tornerebbe piccolo proprio sullo schermo dove serve grande.
export const INGRANDIMENTO_MM = 3;

/**
 * Quanto cresce il LATO di una sagoma, in centimetri di sala.
 *
 * @param cmPerPixel quanti centimetri di sala vale un punto di schermo
 * @param pxcm       quanti punti di schermo vale un centimetro vero
 */
export function ingrandimentoCm(cmPerPixel, pxcm, mm = INGRANDIMENTO_MM) {
  if (!(cmPerPixel > 0) || !(pxcm > 0)) return 0;
  return (mm / 10) * pxcm * cmPerPixel;
}

/**
 * La sagoma come va DISEGNATA: cresciuta di metà per lato, e tagliata al
 * perimetro della sala.
 *
 * ⚠️ IL TAGLIO AL BORDO NON È PRUDENZA: **T2 tocca il muro in alto** (misurato
 * in produzione il 19/08, distanza zero), quindi senza taglio una sagoma
 * ingrandita uscirebbe dalla sala disegnata — e un tavolo mezzo fuori dalla
 * stanza è una cosa che il disegno non deve poter dire.
 */
export function sagomaDisegnata({ x, y, larghezza, profondita }, crescita, sala) {
  const m = Math.max(0, crescita) / 2;
  const x1 = Math.max(0, x - m);
  const y1 = Math.max(0, y - m);
  const x2 = Math.min(sala.larghezza, x + larghezza + m);
  const y2 = Math.min(sala.profondita, y + profondita + m);
  return { x: x1, y: y1, larghezza: x2 - x1, profondita: y2 - y1 };
}

