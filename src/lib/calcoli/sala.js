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

// 🔴 IL BERSAGLIO DI TOCCO DEL TAVOLO PIÙ PICCOLO, in centimetri reali.
//
// ⚠️ È UNA CONVENZIONE PRESA DA FUORI, NON UNA MISURA su questa app: viene
// dal §3.2.1 del brief. E la realtà l'ha già smentita due volte, tutte e
// due con le mani di Alessio: trascina i tavoli a 6,6 mm senza inciampare
// (18/08), e sui quadrati rimpiccioliti ha detto che **a ~5,3 mm si
// prendono bene**. *Un numero preso da fuori si può discutere; uno
// misurato su un gesto no.*
//
// ⚠️ RESTA A 1,05 (deciso il 21/08): era stato proposto di abbassarlo a
// 0,7 per far stare menu e pianta affiancati, e quelle due colonne non
// esistono più — a tutta larghezza la pianta ci sta comunque. *Un numero
// si abbassa quando serve, non per prudenza.*
export const TOCCO_TAVOLO_CM = 1.05;

/**
 * Quanto deve essere larga la pianta, in centimetri REALI, nei due versi.
 *
 * ⚠️ STANNO QUI E NON NELLA SCHERMATA perché sono misure, e le misure si
 * devono poter provare senza un browser: dal 21/08 una prova pura
 * controlla che la pianta in piedi entri negli schermi veri.
 */
export const LARGHEZZA_MINIMA_IN_PIEDI =
  (SALA_PROFONDITA_CM / 90) * TOCCO_TAVOLO_CM * RIDUZIONE_DISEGNO;
export const LARGHEZZA_MINIMA_SDRAIATA =
  (SALA_LARGHEZZA_CM / 90) * TOCCO_TAVOLO_CM * RIDUZIONE_DISEGNO;

// ⚠️ E DA QUI IN POI SONO DUE NUMERI DIVERSI, che prima erano lo stesso.
// «Quanto piccolo può diventare il disegno» e «quando la sala sta male
// sdraiata» sono due domande: se la soglia del verso si rimpicciolisse
// insieme al disegno, un tablet in verticale smetterebbe di girare la sala.
export const SOGLIA_IN_PIEDI_CM_REALI = (SALA_LARGHEZZA_CM / 90) * TOCCO_TAVOLO_CM;

/**
 * La pianta in piedi entra in una schermata larga `puntiUtili`, con questa
 * calibrazione? Restituisce i punti di margine: negativo = sborda.
 *
 * 🔴 ESISTE PERCHÉ IL 21/08 LA PIANTA È SBORDATA DALLO SCHERMO DI ALESSIO,
 * e nessuna prova poteva accorgersene: la larghezza minima viveva dentro
 * la schermata, e il disegno delle due colonne era stato misurato con la
 * calibrazione da computer (37,8 punti per centimetro) invece che con
 * quella vera del tablet (74). ⚠️ **I due errori vanno nella stessa
 * direzione**, ed è per questo che non si vedono: sul tablet i punti sono
 * meno E tutto ciò che è in centimetri veri diventa più grande.
 */
/**
 * 🔴 IL BERSAGLIO PROVATO CON LE MANI (18/08/2026, Alessio col tablet in
 * mano): **a ~5,3 mm i quadrati si prendono bene** — *«è proprio tutto
 * perfetto»*. È l'unico numero di questa famiglia che sia stato misurato
 * su un gesto invece che preso da fuori: 1,05 cm è una convenzione del
 * brief, questo no.
 *
 * ⚠️ SERVE DA QUANDO IL DISEGNO NON HA PIÙ UN PAVIMENTO (22/08): sotto
 * questa misura non si taglia la sala — si dichiara che i bersagli sono
 * scesi sotto ciò che una mano ha approvato.
 */
export const BERSAGLIO_PROVATO_CM = 0.53;

/**
 * Quanto misura, in centimetri REALI, il lato del tavolo più piccolo
 * (90 cm) quando la pianta è larga `puntiUtili` punti.
 *
 * ⚠️ È l'inverso di LARGHEZZA_MINIMA_IN_PIEDI: quella dice «quanti punti
 * servono per avere 1,05 cm», questa dice «con i punti che ci sono, quanto
 * viene». Il verso del rapporto è tutto: **il disegno non detta più la
 * larghezza, la subisce** — e questa funzione è il prezzo, in chiaro.
 */
export function bersaglioTavoloCm(puntiUtili, pxcm, verticale = true) {
  const lato = verticale ? SALA_PROFONDITA_CM : SALA_LARGHEZZA_CM;
  return (puntiUtili * 90) / lato / pxcm;
}

/**
 * 🔴 LE SAGOME CHE IL DISEGNO TAGLIA — il controllo nato dal difetto del
 * 22/08/2026, e la domanda è **diversa** da quella che le sette prove del
 * 21/08 facevano.
 *
 * Quelle chiedevano *«il RIQUADRO entra nella pagina?»*. Questa chiede
 * *«il DISEGNO entra nel riquadro?»*, che è quella che conta per chi
 * guarda: una sagoma fuori dal `viewBox` **non viene disegnata affatto**,
 * e una sala con meno tavoli non somiglia a un errore — somiglia a una
 * sala. ⚠️ *Un tavolo che non c'è non si può toccare, e in servizio non
 * te ne accorgi finché non lo cerchi.*
 *
 * ⚠️ Guarda la sagoma **come viene disegnata**: verso compreso (`ruotato`)
 * e spostamenti del solo foglio (`SPOSTATE_NEL_DISEGNO`). Guardare i dati
 * veri direbbe che la Chef Table sta dentro mentre sul foglio è altrove.
 *
 * @returns {{label: string, destra: number, fondo: number}[]} i colpevoli
 */
/**
 * 🔴 LE SAGOME CHE NON SI VEDONO PER INTERO — la domanda giusta, e la
 * terza versione di questa storia (22/08/2026).
 *
 * `sagomeFuoriDalDisegno()` chiede *«la sagoma sta dentro il FOGLIO?»*, e
 * risponde sulla geometria della sala. Ma il foglio può a sua volta essere
 * più largo di quello che si vede: basta un antenato più stretto, un
 * ritaglio, una colonna che nessuno ha misurato. **La domanda che conta per
 * chi guarda è se la sagoma sta dentro il RIQUADRO VISIBILE**, e quella non
 * si risponde con la geometria: si risponde **misurando la pagina vera**.
 *
 * ⚠️ PER QUESTO LA DECISIONE STA QUI, PURA, E LA MISURA STA NELLA
 * SCHERMATA: qui si può rompere e provare senza un browser; là si legge
 * `getBoundingClientRect()`, che in una prova non esiste. È la stessa
 * divisione di `email_conferma_dovuta()` — chi decide non è chi guarda.
 *
 * @param rettangoli [{ nome, sinistra, destra, cima, fondo }] in punti di schermo
 * @param riquadro   { sinistra, destra, cima, fondo } la parte VISIBILE
 * @returns i nomi delle sagome che escono, con da che parte
 */
export function sagomeTagliateDallaVista(rettangoli = [], riquadro) {
  if (!riquadro) return [];
  const tagliate = [];
  for (const r of rettangoli) {
    const versi = [];
    // ⚠️ Mezzo punto di tolleranza: i bordi arrotondano, e un guardiano che
    // grida per un decimo di punto si impara a spegnere (13/08).
    if (r.destra > riquadro.destra + 0.5) versi.push("destra");
    if (r.sinistra < riquadro.sinistra - 0.5) versi.push("sinistra");
    if (r.fondo > riquadro.fondo + 0.5) versi.push("sotto");
    if (r.cima < riquadro.cima - 0.5) versi.push("sopra");
    if (versi.length > 0) tagliate.push({ nome: r.nome, versi });
  }
  return tagliate;
}

export function sagomeFuoriDalDisegno(sagome = []) {
  const fuori = [];
  for (const s of sagome) {
    const d = sagomaPerIlDisegno(s);
    const m = misureSagoma(d);
    const destra = (d.x ?? 0) + m.larghezza;
    const fondo = (d.y ?? 0) + m.profondita;
    if (destra > SALA_LARGHEZZA_CM || fondo > SALA_PROFONDITA_CM || (d.x ?? 0) < 0 || (d.y ?? 0) < 0) {
      fuori.push({ label: d.label, destra, fondo });
    }
  }
  return fuori;
}

export function marginePiantaInPiedi(puntiUtili, pxcm) {
  return puntiUtili - LARGHEZZA_MINIMA_IN_PIEDI * pxcm;
}

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
 * ⚠️ MA IL RAGGIO VERO DEL MAGNETE NON È QUESTO, dal 19/08: chi trascina
 * usa `raggioMagneteCm()`, che ci somma l'ingrandimento del disegno —
 * sul telefono di Alessio si passa da ~22 a **~54 cm di sala**. Il numero
 * qui sopra descrive solo il pezzo che dipende dal dito.
 *
 * ⚠️ IL PREZZO, DICHIARATO E MISURATO (aggiornato il 19/08): due tavoli
 * **dello stesso formato** che si guardano da meno di **una cinquantina**
 * di centimetri non si possono più lasciare staccati — il magnete li
 * unisce. Alessio ha guardato come si comporta e ha deciso di tenerlo così.
 *
 * ⚠️ MISURATO IN PRODUZIONE, e la misura ridimensiona il prezzo: nella
 * pianta base e in tutte e tre le giornate esistenti **non c'è nessuna
 * coppia di tavoli separati entro il raggio** — i tavoli o si toccano
 * (distanza zero: sono i tavoloni T5·T6, T7·T8, T8·T9) o stanno a 90 cm e
 * oltre. Il varco più stretto fra due sagome separate è **80 cm**, fra i
 * divani, che non sono tavoli e non si agganciano. Quindi oggi il magnete
 * più largo **non impedisce nessuna delle disposizioni esistenti**; il
 * prezzo esiste per quelle future. In una sala vera è un
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
 * IL RAGGIO VERO DEL MAGNETE: il dito **più** l'ingrandimento del disegno.
 *
 * 🔴 ESISTE PERCHÉ LE PROVE STAVANO SORVEGLIANDO UN NUMERO CHE L'APP NON USA
 * PIÙ (rilievo della validazione, 19/08). Il 19/08 la schermata ha aggiunto
 * `+ crescitaCm` al raggio, e la prova sui dati veri ha continuato a chiamare
 * `raggioAggancioCm()` da sola: sorvegliava un magnete più piccolo di quello
 * che si usa. *Una prova che non usa il numero deciso dal codice non lo sta
 * provando* — terza volta in due giorni, e la cura è sempre la stessa: **un
 * posto solo**, e chi prova chiama quello.
 *
 * ⚠️ Cambia la metrica del GESTO e del DISEGNO, mai quella del database:
 * cosa conta come accostato — `TOLLERANZA_CONTATTO_CM`, i coperti, i
 * tavoloni — non si tocca.
 */
export function raggioMagneteCm(cmPerPixel, pxcm) {
  return raggioAggancioCm(cmPerPixel, pxcm) + ingrandimentoCm(cmPerPixel, pxcm);
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
 * @param vietata  il riquadro dove i mobili non possono stare (la L capovolta):
 *                 il magnete non deve nemmeno PROPORRE una posizione lì dentro
 */
export function agganciaAiVicini({ sagoma, vicini = [], x, y, raggioCm, limiti, vietata = null }) {
  const nulla = { x, y, agganci: [] };
  if (!(raggioCm > 0) || !sagoma) return nulla;

  const w = sagoma.larghezza;
  const h = sagoma.profondita;
  const sovrapposizione = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1);
  const dentro = (px, py) => {
    if (dentroAreaVietata({ x: px, y: py, larghezza: w, profondita: h }, vietata)) return false;
    if (!limiti) return true;
    return px >= 0 && py >= 0 && px + w <= limiti.larghezza && py + h <= limiti.profondita;
  };

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

// 🔴 IL BANCO BAR, per le Comande (21/08/2026, disegno di Alessio). È la
// stessa idea del pannello del Calendario, su un'altra zona: lì c'è il
// modulo per prenotare, qui **il nome di chi ha prenotato il tavolo che si
// sta toccando**.
//
// ⚠️ La scena che l'ha fatto nascere, e spiega perché il nome e non altro:
// *il cliente arriva e dice «ho prenotato a nome tale per due», il cameriere
// non se lo ricorda, tocca il tavolo e legge lì.*
//
// ⚠️ ZONA DIVERSA DA QUELLA DEL CALENDARIO, e non per caso: in Comande la
// cucina e i servizi stanno in cima alla pianta girata, cioè **lontano dal
// pollice** di chi tiene il tablet. Il bancone sta in fondo a destra, che è
// dove il dito arriva senza spostare la presa.
export const ZONE_DEL_BANCO = ["Bancone"];

/** Il rettangolo che le zone scelte formano, o null se non lo formano. */
// ⚠️ `quali` e' un parametro dal 21/08: la stessa geometria serve a due
// pannelli diversi — quello del Calendario su cucina e servizi, e il banco
// bar delle Comande. **Il codice e' lo stesso, la scelta delle zone no**, e
// questo e' precisamente il discriminante del 17/08: due cose che direbbero
// esattamente la stessa cosa si fondono, e qui la geometria la dice.
export function riquadroDelPannello(zone = [], quali = ZONE_DEL_PANNELLO) {
  const scelte = zone.filter((z) => quali.includes(z.nome));
  if (scelte.length !== quali.length) return null;
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

// 🔴 `MARGINE_INGRANDIMENTO_CM` È STATO TOLTO IL 19/08, e la ragione va letta
// prima di rimetterlo. Esisteva perché una sagoma si disegna più grande del
// vero, quindi un tavolo appoggiato al confine della cucina poteva finire
// **sotto** il pannello pur non toccandolo nelle misure vere. Il margine
// guardava 17,5 cm per lato — e la **Chef Table**, che sta 15 cm sotto quel
// confine, faceva sparire il pannello **tutti i giorni**.
//
// ⚠️ IL PARADOSSO CHE CI HA PORTATI LÌ, perché è il genere di cosa che torna:
// sullo schermo la Chef Table è disegnata **sotto i divani**, quindi il
// pannello spariva per una sagoma che in quel punto non si vede. Due
// decisioni giuste dello stesso giorno — il margine di sicurezza e le sagome
// spostate sul foglio — si sono pestate i piedi.
//
// La cura è a monte ed è di Alessio: quel rettangolo è **vietato ai mobili**
// (vedi `AREA_VIETATA_AI_MOBILI`), quindi il caso che il margine difendeva
// non può più presentarsi. ⚠️ **La regola resta**: `pannelloNellaPianta()`
// continua a guardare, come rete, se un dato mettesse comunque un mobile là
// dentro — si toglie il margine, non il controllo.
//
// ⚠️ IL PREZZO, DICHIARATO: un tavolo appoggiato **esattamente** al confine
// della cucina si disegna ~15 cm dentro il bordo del pannello, perché la
// sagoma cresce. Resta visibile e afferrabile — è un filo di accavallamento,
// non un tavolo nascosto.

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
export function pannelloNellaPianta(zone = [], sagome = [], quali = ZONE_DEL_PANNELLO) {
  const r = riquadroDelPannello(zone, quali);
  if (!r) return null;
  // ⚠️ SENZA MARGINE dal 19/08: l'area è vietata ai mobili, quindi non c'è
  // più un caso da anticipare. Questo controllo è la rete per il giorno in
  // cui un dato ci finisse dentro lo stesso.
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
      s.x < r.x + r.larghezza &&
      s.x + mis.larghezza > r.x &&
      s.y < r.y + r.profondita &&
      s.y + mis.profondita > r.y
    );
  });
  return tocca ? null : r;
}

// =====================================================================
// DOVE I MOBILI POSSONO STARE — LA L CAPOVOLTA (19/08/2026)
// =====================================================================
//
// 🔴 IDEA DI ALESSIO, ed è la cura di un difetto vero: fino a oggi un tavolo
// si poteva trascinare **ovunque** dentro il rettangolo della sala, cucina e
// servizi compresi. Da adesso quell'area è vietata ai mobili, e il perimetro
// in cui i tavoli vivono non è più un rettangolo ma una **L capovolta** —
// sala alta, sala bassa e bancone.
//
// ⚠️ MISURATO PRIMA DI SCRIVERLO, in produzione e in sola lettura: nella
// pianta base (13 sagome) e in **tutti** i 14 scostamenti delle 3 giornate
// esistenti, nessuna sagoma sta dentro quel rettangolo. **Il divieto non
// invalida niente di esistente** — non è una regola che rifiuta il passato.
//
// ⚠️ L'AREA È LA STESSA DEL PANNELLO, e non per comodità: il pannello sta lì
// **perché** lì non ci sono mobili, quindi la definizione dev'essere una
// sola. Due elenchi di zone che possono divergere direbbero che il pannello
// può stare dove un tavolo può andare.
//
// ⚠️ E VALE IN DUE POSTI, non solo nel trascinamento: anche **il magnete**
// non deve poter proporre una posizione là dentro. È la stessa ragione per
// cui già oggi controlla i bordi della sala — un aggancio che porta il
// tavolo in un posto vietato è un aggancio che non si può accettare.
export function areaVietataAiMobili(zone = []) {
  return riquadroDelPannello(zone);
}

/**
 * La sagoma finirebbe dentro l'area vietata?
 *
 * @param rett   { x, y, larghezza, profondita } — misure VERE, già nel verso
 * @param vietata il riquadro vietato, o null se non ce n'è
 */
export function dentroAreaVietata(rett, vietata) {
  if (!vietata || !rett) return false;
  return (
    rett.x < vietata.x + vietata.larghezza &&
    rett.x + rett.larghezza > vietata.x &&
    rett.y < vietata.y + vietata.profondita &&
    rett.y + rett.profondita > vietata.y
  );
}

// =====================================================================
// SAGOME DISEGNATE DOVE NON STANNO (19/08/2026)
// =====================================================================
//
// 🔴 QUESTA È UNA BUGIA VOLUTA, E VA LETTA PRIMA DI «CORREGGERLA».
// La **Chef Table** in sala sta accanto alla cucina; sulla pianta viene
// disegnata **sotto i divani, in orizzontale**. Decisione di Alessio del
// 19/08, con la sua ragione: *la postazione è una sola e in sala non può
// confondersi con niente, mentre lì in pianta gli dà fastidio.*
//
// ⚠️ **Solo il disegno**: la posizione vera resta quella scritta in
// `dining_tables`, e tutto il resto — accostamento, coperti, tavoloni,
// prenotazioni — continua a usarla. Se un domani la Chef Table si spostasse
// davvero, è la riga del database che va cambiata, non questa.
//
// ⚠️ **Ed è scritto qui perché è la prima cosa che qualcuno raddrizzerebbe
// fra sei mesi credendo di sistemare un errore.** Sta anche nel registro dei
// rovesciamenti.
// ⚠️ IL «SOTTO» E L'«ORIZZONTALE» SONO QUELLI DEL SUO SCHERMO, e senza
// questa riga i numeri qui sotto sembrano sbagliati. Sul telefono la sala
// si mette in piedi (`translate(0 LARGHEZZA) rotate(-90)`), e quel giro
// scambia i due assi: **x della sala = alto/basso dello schermo, al
// contrario** (x piccola = in basso), **y della sala = sinistra/destra**.
// Quindi «sotto i divani» vuol dire x più piccola della loro (300), e
// «in orizzontale» vuol dire lunga lungo la y — cioè `ruotato`.
// I divani stanno a y 800→1000: la Chef Table si affianca a quella colonna
// e resta 80 cm sotto di loro.
// ⚠️ IL PREZZO, DICHIARATO: sul computer la sala è sdraiata, quindi lì la
// Chef Table si vede **a sinistra dei divani e in piedi**. La richiesta è
// nata guardando il telefono, che è la strada maestra; sul computer non è
// sbagliata, è solo l'altra faccia dello stesso spostamento.
export const SPOSTATE_NEL_DISEGNO = {
  "Chef Table": { x: 150, y: 800, ruotato: true },
};

/** La sagoma come va disegnata, se qualcuno l'ha spostata solo sul foglio. */
export function sagomaPerIlDisegno(sagoma) {
  const finta = SPOSTATE_NEL_DISEGNO[sagoma?.label];
  return finta ? { ...sagoma, ...finta } : sagoma;
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
 * Quanto spazio deve restare fra due sagome DISEGNATE che nella sala sono
 * separate davvero. Una riga sottile, ma che si vede.
 *
 * 🔴 ESISTE PERCHÉ UN NUMERO NON BASTAVA — E I NUMERI SONO STATI DUE, uno
 * sbagliato dopo l'altro. Il 19/08 l'ingrandimento era stato accettato su una
 * misura: *«il varco più stretto fra due sagome separate è 80 cm»*. Una
 * validazione l'ha corretta in 40 cm (T5/T6 e T7/T8), io ho scritto la
 * correzione **senza rimisurarla**, e rimisurando davvero:
 *   · gli 80 cm erano GIUSTI, e valgono sulla pianta base *e* su
 *     tutte e tre le giornate esistenti (sono i divani);
 *   · le coppie nominate dalla correzione — T5/T6, T7/T8 — stanno a
 *     **distanza zero**: sono tavoloni, non tavoli vicini.
 * ⚠️ *In questo progetto un numero si chiede al database, anche — e
 * soprattutto — quando arriva da chi controlla.*
 *
 * ⚠️ MA LA REGOLA RESTA, e non poggia su nessuno dei due numeri — è questo
 * che la rende una regola: la griglia di aggancio è a passi di 10 cm,
 * quindi qualunque sera Alessio può mettere due tavoli a 20 cm.
 * **Nessuna misura di oggi può garantire le disposizioni di domani.** Serve
 * una regola, e la regola è questa: la sagoma cresce **fino a**
 * `INGRANDIMENTO_MM`, ma mai al punto di chiudere lo spazio verso un vicino.
 */
export const VARCO_MINIMO_MM = 0.5;

/**
 * La sagoma come va DISEGNATA: cresciuta, ma non oltre i suoi vicini, e
 * tagliata al perimetro della sala.
 *
 * ⚠️ IL TAGLIO AL BORDO NON È PRUDENZA: **T2 tocca il muro in alto**
 * (misurato in produzione il 19/08, distanza zero), quindi senza taglio una
 * sagoma ingrandita uscirebbe dalla sala disegnata — e un tavolo mezzo fuori
 * dalla stanza è una cosa che il disegno non deve poter dire.
 *
 * ⚠️ VERSO UN VICINO ATTACCATO NON SI CRESCE. Se il varco vero è dentro la
 * tolleranza di contatto, quei due sono un **tavolone**: il bordo è già lì,
 * e crescere li farebbe sovrapporre cancellando la linea di giunzione — che
 * dal 18/08 dice «è un tavolone **e** è fatto di tre». Il tavolone cresce
 * verso fuori, non su sé stesso.
 *
 * @param sagoma  { x, y, larghezza, profondita } — già nel verso vero
 * @param vicini  le altre sagome, nella stessa forma
 * @param crescita quanto crescerebbe il lato se fosse sola
 * @param sala    { larghezza, profondita }
 * @param varcoMinimo quanto spazio deve restare fra due sagome separate
 */
export function sagomaDisegnata(sagoma, crescita, sala, vicini = [], varcoMinimo = 0) {
  const { x, y, larghezza, profondita } = sagoma;
  const meta = Math.max(0, crescita) / 2;
  // Quanto si può crescere verso un lato, guardando chi c'è di là.
  const versoIlLato = (prendiVarco, siGuardano) => {
    let libero = meta;
    for (const v of vicini) {
      if (v === sagoma) continue;
      if (!siGuardano(v)) continue;
      const varco = prendiVarco(v);
      if (varco < 0) continue;
      // Attaccati: il bordo è già lì, non si cresce da quella parte —
      // crescere farebbe sparire la linea di giunzione, che dal 18/08 dice
      // «è un tavolone **e** è fatto di tre».
      // ⚠️ OGGI QUESTA RIGA È RIDONDANTE, e va detto invece di lasciarla
      // sembrare necessaria: a varco zero la formula qui sotto dà già zero,
      // e la fascia fra zero e la tolleranza **non può esistere** perché
      // ogni varco è un multiplo del passo della griglia (10 cm). Resta
      // perché il giorno che entrasse un mobile fuori griglia sarebbe
      // l'unica cosa a tenere ferma la giunzione — ed è la stessa ragione
      // per cui la tolleranza esiste. Una rottura fatta apposta non la
      // rende rossa: è un ramo che oggi non si percorre.
      if (varco <= TOLLERANZA_CONTATTO_CM) return 0;
      // Separati: si cresce al massimo per metà dello spazio che avanza,
      // così anche il vicino ha la sua metà e una riga resta in mezzo.
      libero = Math.min(libero, Math.max(0, (varco - varcoMinimo) / 2));
    }
    return libero;
  };
  const inFila = (v) => v.y < y + profondita && v.y + v.profondita > y;
  const inColonna = (v) => v.x < x + larghezza && v.x + v.larghezza > x;
  const sinistra = versoIlLato((v) => x - (v.x + v.larghezza), inFila);
  const destra = versoIlLato((v) => v.x - (x + larghezza), inFila);
  const sopra = versoIlLato((v) => y - (v.y + v.profondita), inColonna);
  const sotto = versoIlLato((v) => v.y - (y + profondita), inColonna);
  const x1 = Math.max(0, x - sinistra);
  const y1 = Math.max(0, y - sopra);
  const x2 = Math.min(sala.larghezza, x + larghezza + destra);
  const y2 = Math.min(sala.profondita, y + profondita + sotto);
  return { x: x1, y: y1, larghezza: x2 - x1, profondita: y2 - y1 };
}
