import { useLayoutEffect, useRef, useState } from "react";
import {
  GRIGLIA_CM,
  SALA_LARGHEZZA_CM,
  SALA_PROFONDITA_CM,
  ZONE_FONDALE,
  RIDUZIONE_DISEGNO,
  agganciaAiVicini,
  areaVietataAiMobili,
  dentroAreaVietata,
  VARCO_MINIMO_MM,
  ingrandimentoCm,
  misureSagoma,
  sagomaDisegnata,
  sagomaPerIlDisegno,
  raggioMagneteCm,
} from "../lib/calcoli/sala";

// LA PIANTA DELLA SALA — la stessa in Calendario e in Comande.
//
// Deliberatamente povera, e va tenuta povera (§4 del mandato): sagome in
// scala approssimativa, aggancio a griglia, niente rotazione, niente
// collisioni fini, niente zoom libero. Divani e Chef Table si disegnano
// ma non si trascinano — e non perché questa schermata non li lasci
// prendere: è un vincolo del database (dining_tables_sagoma_check).
//
// ⚠️ IL SALVATAGGIO AVVIENE AL RILASCIO, MAI DURANTE IL TRASCINAMENTO.
// Salvare a ogni movimento vorrebbe dire decine di scritture per un solo
// gesto, e una connessione lenta trasformerebbe un trascinamento in uno
// scatto.
//
// ⚠️ QUANTO È GRANDE SULLO SCHERMO. Il tavolo più piccolo è 90 cm; il
// target di tocco minimo del progetto è 1,05 cm reali (§3.2.1). Da qui la
// larghezza minima del disegno: 2070 / 90 × 1,05 ≈ 24 cm reali. Su un
// monitor la pianta ci sta tutta; su un tablet verticale la sala scorre
// in orizzontale — che è quello che fa una pianta di sala su un foglio
// piccolo. Non si rimpicciolisce sotto quella soglia: un tavolo che non
// si riesce a toccare durante un servizio non è una pianta, è un disegno.
// ⚠️ ROVESCIAMENTO DICHIARATO (18/08, giro E). Il fattore RIDUZIONE_DISEGNO
// abbassa questa soglia: il tavolo piu' piccolo non misura piu' 1,05 cm
// reali ma poco piu' di tre quarti. La ragione di allora non era sbagliata
// nel principio — un bersaglio troppo piccolo non si prende — ma 1,05 era
// una convenzione presa da fuori, non una misura su questa app: Alessio
// oggi trascina i tavoli col dito a 6,6 mm senza inciampare. Il perche' del
// numero, e il prezzo che accettiamo, stanno in lib/calcoli/sala.js.
const LARGHEZZA_MINIMA_CM_REALI = (SALA_LARGHEZZA_CM / 90) * 1.05 * RIDUZIONE_DISEGNO;

// ⚠️ E DA QUI IN POI SONO DUE NUMERI DIVERSI, che prima erano lo stesso.
// «Quanto piccolo può diventare il disegno» e «quando la sala sta male
// sdraiata» sono due domande, e la riduzione del giro E le separa: se la
// soglia si rimpicciolisse insieme al disegno, un tablet in verticale
// (768 punti) smetterebbe di girare la sala e mostrerebbe una pianta
// sdraiata dove le Comande, sullo STESSO tablet, la mostrano in piedi —
// cioè si allargherebbe la differenza fra le due schermate proprio nel
// giro che la deve chiudere.
// Quindi il verso si decide con la misura di PRIMA: nessuno schermo
// cambia orientamento per via di questo giro, cambia solo quanto è grande
// il disegno.
const SOGLIA_IN_PIEDI_CM_REALI = (SALA_LARGHEZZA_CM / 90) * 1.05;

// ⚠️ LA SALA IN PIEDI, per il tablet della sala (chiesto da Alessio il
// 14/08 dopo aver aperto il primo tavolo dal vivo: la pianta sbordava di
// lato e si vedeva mezza).
//
// La sala è larga il doppio di quanto è profonda: su un tablet tenuto in
// verticale, sdraiata, o esce dallo schermo o diventa troppo piccola per
// toccarla. Girata di un quarto ci sta in larghezza e scorre in
// verticale — che è il verso in cui si scorre su un telefono.
//
// **Il disegno gira, la sala no.** L'ingresso finisce in basso, cioè
// dalla parte da cui si entra guardando lo schermo, e la sala alta in
// cima. ⚠️ **Le scritte NON girano**: ogni etichetta si rigira di un
// quarto in senso contrario, altrimenti si leggerebbe di traverso — e un
// nome di tavolo che si legge piegando la testa, durante un servizio,
// non si legge.
export const LARGHEZZA_MINIMA_IN_PIEDI = (SALA_PROFONDITA_CM / 90) * 1.05 * RIDUZIONE_DISEGNO;

// L'aggancio a griglia: 10 cm. Abbastanza fine da accostare due tavoli
// senza fatica, abbastanza grosso da non lasciare fessure di 3 cm che a
// schermo sembrano un errore di chi trascina.
//
// ⚠️ Dal 18/08/2026 NON è più un numero di questo file: è legato alla
// tolleranza con cui il database decide che due tavoli si toccano, e i due
// devono accordarsi. Il rapporto è scritto in `lib/calcoli/sala.js`, in un
// posto solo — prima stavano in due file che non si nominavano.

const COLORI = {
  libero: { riempimento: "var(--color-b58-parchment)", bordo: "var(--color-b58-charcoal)" },
  selezionato: {
    riempimento: "var(--color-b58-terracotta)",
    bordo: "var(--color-b58-terracotta-dark)",
  },
  // ⚠️ SCURO, E FINO AL 18/08 ERA DORATO. Il cambio non è estetico: dal giro
  // D2 le fasce arrivano anche in Comande, e lì il dorato vuol già dire
  // «primo giro». Sulla stessa schermata lo stesso quadratino avrebbe detto
  // «sono seduti» su un tavolo e «arriveranno presto» su quello accanto, e
  // nessuna legenda può disfare un'ambiguità così: chi guarda non ha modo di
  // sapere quale dei due sta guardando. Il terracotta della selezione resta
  // doppio (è anche la fascia «ultimo giro»), e lì l'ambiguità si scioglie da
  // sé — il tavolo selezionato è al massimo uno, ed è quello che hai appena
  // toccato tu.
  occupato: { riempimento: "var(--color-b58-charcoal-soft)", bordo: "var(--color-b58-charcoal)" },
  prenotato: { riempimento: "var(--color-b58-olive)", bordo: "var(--color-b58-olive-dark)" },
  // ⚠️ LE TRE FASCE DELLA SERATA (idea di Alessio, 14/08; il terzo colore
  // è del 18/08). Non è un vincolo e non impedisce niente: è l'ora resa
  // visibile senza doverla leggere.
  //   giallo  = arriva prima dell'ora del primo giro → il tavolo può
  //             servire una seconda volta;
  //   verde   = arriva a servizio avviato → il tavolo resta suo;
  //   arancio = arriva dopo l'ultimo ingresso → è l'ultimo turno, e può
  //             stare sullo stesso tavolo di un giallo.
  // ⚠️ I confini NON sono qui e non sono due ore fisse: vengono dagli
  // orari **di quel servizio** (`service_hours`). La domenica è pranzo, e
  // tre fasce calcolate sugli orari della cena direbbero «primo giro» a
  // chiunque pranzi.
  presto: { riempimento: "var(--color-b58-gold)", bordo: "var(--color-b58-gold-dark)" },
  pieno: { riempimento: "var(--color-b58-olive)", bordo: "var(--color-b58-olive-dark)" },
  tardi: { riempimento: "var(--color-b58-terracotta)", bordo: "var(--color-b58-terracotta-dark)" },
  // Mezzo e mezzo: sul tavolo c'è più di una fascia — tipicamente un
  // giallo e un arancio, che è proprio il secondo giro.
  misto: { riempimento: "url(#mezzoEmezzo)", bordo: "var(--color-b58-olive-dark)" },
  fisso: { riempimento: "var(--color-b58-cream-dark)", bordo: "var(--color-b58-charcoal-soft)" },
};


// ⚠️ IL SEGNO CHE IL MAGNETE HA PRESO, e deve vedersi MENTRE si trascina,
// non dopo aver lasciato. Un aggancio che si scopre solo al rilascio non
// e' un aggancio: e' una sorpresa, e la volta dopo si trascina piano per
// paura. Il colore e' quello con cui la sala dice «questo e' pieno»: lo
// stesso che avra' il tavolone appena esiste.
const COLORE_AGGANCIO = "var(--color-b58-olive-dark)";

const aggancia = (v) => Math.round(v / GRIGLIA_CM) * GRIGLIA_CM;
// Quanti punti di schermo vale un centimetro vero su QUESTO dispositivo.
// Sta qui perche' lo leggono in due: la soglia che gira la sala e il
// raggio del magnete, che e' scritto in dito reale.
const leggiPxCm = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pxcm")) || 37.79528;
const limita = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * @param sagome      righe di pianta_del_giorno (o della pianta base)
 * @param selezione   array di id selezionati
 * @param onSeleziona (sagoma) => void — assente: le sagome non si toccano
 * @param onSposta    (sagoma, x, y) => void — assente: niente trascinamento
 * @param gruppi      i tavoloni della giornata come li conta il DATABASE
 *                    ([{ tavoli: [id] }]). Non si ricalcolano qui: chi
 *                    e' accostato lo decide `coperti_del_giorno()`, e una
 *                    seconda regola in JavaScript finirebbe per disegnare
 *                    un tavolone dove il numero non ne vede nessuno.
 * @param stato       { [id]: { colore, barrato, coperti, corretto } } — il
 *                    colore, la sbarratura del ritardo, e dal 18/08 la sola
 *                    CIFRA dei coperti col punto che segna «corretto a mano».
 *                    Niente altro: dentro una sagoma di 90 cm non ci sta
 *                    altro di leggibile.
 *                    ⚠️ Chi decide il colore NON è questa componente: è
 *                    `segnoDelTavolo()` in lib/calcoli/ritardo.js, che tiene
 *                    la precedenza in un posto solo per le due schermate. Qui
 *                    si disegna quello che quella funzione ha deciso.
 */
export default function PiantaSala({
  sagome = [],
  selezione = [],
  onSeleziona,
  onSposta,
  stato = {},
  gruppi = [],
  pannello,
  riquadroPannello,
  inPiedi = "auto",
}) {
  const svgRef = useRef(null);
  const contenitoreRef = useRef(null);
  const [stretto, setStretto] = useState(false);
  // Quanto è largo il DISEGNO adesso, in punti di schermo. Serve a tradurre
  // in centimetri di sala i millimetri veri dell'ingrandimento delle sagome.
  const [largPx, setLargPx] = useState(0);

  // ⚠️ SI GIRA DA SOLA QUANDO LO SCHERMO È STRETTO. Trovato da Alessio
  // aprendo il Calendario dal cellulare: la sala sdraiata si vedeva a
  // metà. La soglia non è un numero di pixel scelto a occhio — è la
  // stessa che decide se le sagome restano toccabili: se il posto non
  // basta per la sala sdraiata, si mette in piedi. E si misura in
  // centimetri VERI, con la calibrazione del dispositivo, non in pixel:
  // due schermi con gli stessi pixel possono essere grandi il doppio.
  // useLayoutEffect e non useEffect: la misura avviene PRIMA che il
  // browser disegni, cosi la pianta non si vede girare per un istante a
  // ogni apertura della pagina.
  useLayoutEffect(() => {
    const el = contenitoreRef.current;
    if (!el) return;
    const misura = () => {
      // Larghezza zero = il riquadro non è ancora stato disegnato. Senza
      // questa riga, al primo istante la pianta risulterebbe "stretta" e
      // si vedrebbe girare sotto gli occhi a ogni apertura della pagina.
      if (!el.clientWidth) return;
      setLargPx(el.clientWidth);
      setStretto(el.clientWidth / leggiPxCm() < SOGLIA_IN_PIEDI_CM_REALI);
    };
    misura();
    const osservatore = new ResizeObserver(misura);
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, []);

  // In Comande è sempre in piedi (tablet verticale, deciso). Altrove
  // decide lo spazio che c'è.
  const verticale = inPiedi === true || (inPiedi !== false && stretto);
  // La sagoma che si sta trascinando adesso: vive solo qui, e sparisce al
  // rilascio. La posizione vera resta quella del database finché non
  // arriva la conferma della scrittura.
  const [trascina, setTrascina] = useState(null);

  // 🔴 LE SAGOME SI DISEGNANO PIÙ GRANDI DEL VERO (19/08, decisione di
  // Alessio: tavoli più facili da afferrare col dito). Qui il disegno
  // smette di dire il vero sullo spazio — il perché e il prezzo stanno in
  // `lib/calcoli/sala.js` e nel registro dei rovesciamenti.
  //
  // ⚠️ SOLO IL DISEGNO: accostamento, coperti, tavoloni e colore restano
  // sulle misure vere, e `misureSagoma()` non si tocca.
  // ⚠️ MA IL BERSAGLIO DI TOCCO SEGUE LA SAGOMA DISEGNATA, ed è tutto il
  // punto della richiesta: il rettangolo che si vede **è** quello che
  // intercetta il dito. Un tavolo che si vede grande e si prende piccolo
  // sarebbe peggio di prima.
  const crescitaCm = largPx
    ? ingrandimentoCm((verticale ? SALA_PROFONDITA_CM : SALA_LARGHEZZA_CM) / largPx, leggiPxCm())
    : 0;
  // ⚠️ Il varco che deve restare fra due sagome disegnate, nella stessa
  // unità dell'ingrandimento: millimetri veri, tradotti in centimetri di
  // sala. Perché serve — e perché un numero misurato non bastava — sta in
  // `lib/calcoli/sala.js`.
  const varcoMinimoCm = largPx
    ? ingrandimentoCm(
        (verticale ? SALA_PROFONDITA_CM : SALA_LARGHEZZA_CM) / largPx,
        leggiPxCm(),
        VARCO_MINIMO_MM
      )
    : 0;
  const limitiSala = { larghezza: SALA_LARGHEZZA_CM, profondita: SALA_PROFONDITA_CM };
  // ⚠️ DOVE I MOBILI NON POSSONO ANDARE (19/08, idea di Alessio): cucina e
  // servizi. La sala dei tavoli è una L capovolta, non un rettangolo — e
  // l'area è **la stessa** del pannello, perché il pannello sta lì proprio
  // in quanto lì non ci sono mobili.
  const vietata = areaVietataAiMobili(ZONE_FONDALE);
  // I vicini con cui una sagoma deve fare i conti quando cresce: tutti, in
  // misure VERE — è il varco vero che decide quanto si può crescere.
  const viciniVeri = sagome
    .map(sagomaPerIlDisegno)
    .map((v) => ({ x: v.x, y: v.y, ...misureSagoma(v) }));

  const selezionati = new Set(selezione);

  // I TAVOLONI DA DISEGNARE COME UNO. Chi sta con chi arriva dal database
  // (`gruppi`), mai da un secondo calcolo qui dentro. Qui si decide solo
  // se quel gruppo si puo' DISEGNARE come un rettangolo unico.
  //
  // ⚠️ IL LIMITE, DICHIARATO: si disegna il riquadro solo quando i pezzi
  // riempiono esattamente il loro ingombro — cioe' quando il tavolone e'
  // una fila o un blocco pieno. Tre tavoli a L formano un gruppo vero ma
  // il loro ingombro comprende un angolo vuoto, e un perimetro tirato li'
  // attorno disegnerebbe un tavolo dove non c'e' niente. In quel caso i
  // pezzi restano col loro bordo pieno: meno bello, mai falso.
  const perId = new Map(sagome.map((s) => [s.id, s]));
  const tavoloni = (gruppi ?? [])
    .map((g) => {
      const ids = g?.tavoli ?? [];
      if (ids.length < 2) return null;
      // Mentre un pezzo e' in mano il tavolone non esiste ancora: la sua
      // posizione sta cambiando, e un riquadro fermo attorno a una sagoma
      // che si muove sarebbe una bugia disegnata.
      if (trascina && ids.includes(trascina.id)) return null;
      const pezzi = ids.map((id) => perId.get(id)).filter(Boolean);
      if (pezzi.length !== ids.length) return null;
      const scatole = pezzi.map((s) => ({ s, m: misureSagoma(s) }));
      const x1 = Math.min(...scatole.map((p) => p.s.x));
      const y1 = Math.min(...scatole.map((p) => p.s.y));
      const x2 = Math.max(...scatole.map((p) => p.s.x + p.m.larghezza));
      const y2 = Math.max(...scatole.map((p) => p.s.y + p.m.profondita));
      const pieno = scatole.reduce((t, p) => t + p.m.larghezza * p.m.profondita, 0);
      if (pieno !== (x2 - x1) * (y2 - y1)) return null;
      return { chiave: ids.join("+"), ids, x: x1, y: y1, larghezza: x2 - x1, profondita: y2 - y1 };
    })
    .filter(Boolean);
  const dentroUnTavolone = new Set(tavoloni.flatMap((t) => t.ids));

  // Da pixel dello schermo a centimetri della sala. Con la sala in piedi
  // gli assi si scambiano: chi trascina muove il dito verso il basso e il
  // tavolo deve andare verso l'ingresso, non verso destra.
  const inCentimetri = (evento) => {
    const riquadro = svgRef.current.getBoundingClientRect();
    const fx = (evento.clientX - riquadro.left) / riquadro.width;
    const fy = (evento.clientY - riquadro.top) / riquadro.height;
    if (verticale) {
      return { x: SALA_LARGHEZZA_CM * (1 - fy), y: fx * SALA_PROFONDITA_CM };
    }
    return { x: fx * SALA_LARGHEZZA_CM, y: fy * SALA_PROFONDITA_CM };
  };


  const iniziaTrascinamento = (evento, sagoma) => {
    if (!onSposta || !sagoma.spostabile) return;
    const punto = inCentimetri(evento);
    evento.currentTarget.setPointerCapture(evento.pointerId);
    setTrascina({
      id: sagoma.id,
      // Scarto fra dove si è toccato e l'angolo della sagoma: senza, la
      // sagoma salta col suo angolo sotto il dito al primo movimento.
      dx: punto.x - sagoma.x,
      dy: punto.y - sagoma.y,
      x: sagoma.x,
      y: sagoma.y,
      mosso: false,
    });
  };

  const muovi = (evento) => {
    if (!trascina) return;
    const punto = inCentimetri(evento);
    const sagoma = sagome.find((s) => s.id === trascina.id);
    if (!sagoma) return;
    const mia = misureSagoma(sagoma);
    const limiti = { larghezza: SALA_LARGHEZZA_CM, profondita: SALA_PROFONDITA_CM };
    const grezzoX = aggancia(punto.x - trascina.dx);
    const grezzoY = aggancia(punto.y - trascina.dy);
    let x = limita(grezzoX, 0, SALA_LARGHEZZA_CM - mia.larghezza);
    let y = limita(grezzoY, 0, SALA_PROFONDITA_CM - mia.profondita);
    // ⚠️ FUORI DALLA SALA IL GESTO SI ANNULLA, e il tavolo torna dov'era
    // (Alessio, 19/08). Prima si fermava appoggiato al bordo, e i due esiti
    // dicono cose diverse: **fermarsi al bordo somiglia a «l'ho messo lì»**,
    // tornare indietro dice «quel gesto non si poteva fare». Un tavolo
    // appoggiato al muro è una posizione che nessuno ha scelto e che resta
    // scritta come se qualcuno l'avesse scelta.
    //
    // ⚠️ E TORNA ESATTAMENTE DA DOV'ERA PARTITO, non in un posto calcolato:
    // basta **non salvare**. Così non può finire sopra un altro tavolo né
    // dentro il pannello — la posizione di partenza era valida per
    // definizione.
    //
    // ⚠️ Ma si vede PRIMA di lasciare, altrimenti sarebbe una sorpresa: la
    // sagoma si fa trasparente e cambia bordo mentre il dito è fuori. È la
    // stessa scelta del segno del magnete, che si vede mentre si trascina.
    // ⚠️ CUCINA E SERVIZI SI COMPORTANO COME IL FUORI SALA: stessa
    // trasparenza, stesso bordo tratteggiato, stesso annullamento al
    // rilascio. Non è una scorciatoia — per chi trascina sono la stessa
    // cosa (*«lì non ci va»*), e due segni diversi per due divieti che si
    // comportano uguale si imparano peggio di uno solo.
    const fuoriDaiBordi = grezzoX !== x || grezzoY !== y;

    // ⚠️ IL MAGNETE, e il suo raggio si misura in DITO. Il riquadro dice
    // quanti punti di schermo occupa la pianta adesso, quindi quanti
    // centimetri di sala vale un punto: cosi' il magnete resta grande
    // uguale sotto il dito anche quando la pianta si rimpicciolisce —
    // che e' esattamente cio' che il giro E fa al disegno.
    const riquadro = svgRef.current?.getBoundingClientRect();
    const cmPerPunto = riquadro?.width
      ? (verticale ? SALA_PROFONDITA_CM : SALA_LARGHEZZA_CM) / riquadro.width
      : 0;
    const preso = agganciaAiVicini({
      sagoma: { id: sagoma.id, formato_id: sagoma.formato_id, ...mia },
      vicini: sagome
        .filter((v) => v.id !== sagoma.id && v.tipo === "tavolo")
        .map((v) => ({ id: v.id, formato_id: v.formato_id, x: v.x, y: v.y, ...misureSagoma(v) })),
      x,
      y,
      // ⚠️ IL MAGNETE SI MISURA SUL DISEGNO, non sulle misure vere (19/08,
      // rilievo di Alessio: *«si è perso il magnetismo»*). Non si era perso:
      // gli era passato davanti l'ingrandimento. Il magnete scattava a ~22 cm
      // di distanza VERA mentre le sagome si disegnano ~33 cm più grandi,
      // quindi quando sullo schermo i due tavoli si toccavano erano ancora
      // fuori portata e bisognava spingere fino a sovrapporli.
      // ⚠️ Cambia la metrica del GESTO e del DISEGNO, non quella del
      // database: cosa conta come accostato — la tolleranza, i coperti, i
      // tavoloni — non si tocca.
      raggioCm: raggioMagneteCm(cmPerPunto, leggiPxCm()),
      limiti,
      vietata,
    });
    x = preso.x;
    y = preso.y;
    // Il divieto si guarda DOPO il magnete: è l'aggancio a decidere dove la
    // sagoma finisce davvero, e proporla lì per poi rifiutarla al rilascio
    // sarebbe una sorpresa.
    const fuori =
      fuoriDaiBordi ||
      dentroAreaVietata({ x, y, larghezza: mia.larghezza, profondita: mia.profondita }, vietata);
    setTrascina((t) =>
      t
        ? { ...t, x, y, fuori, agganci: preso.agganci, mosso: t.mosso || x !== sagoma.x || y !== sagoma.y }
        : t
    );
  };

  const rilascia = (sagoma) => {
    if (!trascina || trascina.id !== sagoma.id) return;
    const { x, y, mosso, fuori } = trascina;
    setTrascina(null);
    // Un tocco senza movimento è una selezione, non uno spostamento: in
    // sala si tocca il tavolo per aprirlo molto più spesso di quanto lo
    // si sposti.
    // Fuori dalla sala: il gesto si annulla in silenzio — la sagoma torna
    // dov'era perche' non si scrive niente, e non si apre nemmeno il
    // pannello: chi ha trascinato voleva spostare, non toccare.
    if (fuori) return;
    if (mosso) onSposta?.(sagoma, x, y);
    else onSeleziona?.(sagoma);
  };

  const coloreDi = (sagoma) => {
    if (selezionati.has(sagoma.id)) return COLORI.selezionato;
    const s = stato[sagoma.id];
    if (s?.colore && COLORI[s.colore]) return COLORI[s.colore];
    if (!sagoma.spostabile) return COLORI.fisso;
    return COLORI.libero;
  };

  return (
    // ⚠️ QUI DENTRO SI SCORRE COL DITO, e prima non si poteva. L'SVG
    // aveva `touch-none`, che serve a non far scappare il dito mentre si
    // trascina un tavolo — ma spegneva anche lo scorrimento di tutta la
    // pianta: dal cellulare la sala si vedeva a metà e non c'era modo di
    // arrivare al resto. Ora il divieto sta SOLO sulle sagome che si
    // trascinano: il dito sul tavolo lo muove, il dito sul pavimento
    // sposta la vista.
    <div
      ref={contenitoreRef}
      className="overflow-auto rounded-xl bg-b58-cream ring-1 ring-b58-charcoal/10"
    >
      {/* ⚠️ IL RIQUADRO CHE TIENE INSIEME DISEGNO E PANNELLO. La larghezza
          minima si è spostata qui dallo SVG: il pannello si posiziona in
          percentuale del DISEGNO, non del contenitore, e quando la pianta è
          più larga dello schermo le due cose non coincidono. */}
      <div
        className="relative"
        style={{
          minWidth: `calc(${(verticale ? LARGHEZZA_MINIMA_IN_PIEDI : LARGHEZZA_MINIMA_CM_REALI).toFixed(1)} * var(--pxcm))`,
        }}
      >
      <svg
        ref={svgRef}
        viewBox={
          verticale
            ? `0 0 ${SALA_PROFONDITA_CM} ${SALA_LARGHEZZA_CM}`
            : `0 0 ${SALA_LARGHEZZA_CM} ${SALA_PROFONDITA_CM}`
        }
        className="block w-full select-none"
        style={{
          // La larghezza minima si è spostata sul riquadro che contiene
          // questo disegno: il pannello si posiziona in percentuale del
          // DISEGNO, e quando la pianta è più larga dello schermo il
          // contenitore e il disegno non coincidono.
          aspectRatio: verticale
            ? `${SALA_PROFONDITA_CM} / ${SALA_LARGHEZZA_CM}`
            : `${SALA_LARGHEZZA_CM} / ${SALA_PROFONDITA_CM}`,
          height: "auto",
        }}
        onPointerMove={muovi}
      >
        {/* Un quarto di giro a tutto il disegno: l'ingresso finisce in
            basso, la sala alta in cima. Le coordinate di ogni sagoma
            restano quelle della sala vera — qui gira il foglio, non la
            stanza. */}
        <defs>
          {/* Il tavolo con due giri: metà giallo, metà verde. Due tappe
              secche sullo stesso punto, non una sfumatura — una sfumatura
              direbbe «un po' presto e un po' tardi», che non vuol dire
              niente. */}
          <linearGradient id="mezzoEmezzo" x1="0" y1="0" x2="1" y2="0">
            <stop offset="50%" stopColor="var(--color-b58-gold)" />
            <stop offset="50%" stopColor="var(--color-b58-olive)" />
          </linearGradient>
          {/* ⚠️ LA SBARRATURA DEL RITARDO. Non è un colore: è un tratteggio
              che passa SOPRA qualunque riempimento, e per questo può convivere
              col tavolo selezionato e con la fascia oraria invece di
              cancellarli. Un terzo rosso non era disponibile — il terracotta
              è già la fascia «ultimo giro» ed è già il tavolo che stai
              toccando. Le misure sono in centimetri di sala, quindi il passo
              del tratteggio si rimpicciolisce insieme al disegno: qui è
              giusto così, perché non è un bersaglio da prendere col dito ma
              una texture da riconoscere. */}
          <pattern
            id="sbarrato"
            patternUnits="userSpaceOnUse"
            width="34"
            height="34"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="34"
              stroke="var(--color-b58-charcoal)"
              strokeWidth="11"
              strokeOpacity="0.5"
            />
          </pattern>
        </defs>
        <g transform={verticale ? `translate(0 ${SALA_LARGHEZZA_CM}) rotate(-90)` : undefined}>
        {/* IL FONDALE — sfondo statico, mai interattivo: pareti e zone non
            si spostano, non si ridimensionano, non hanno stato. */}
        {/* ⚠️ LE ZONE SI DISEGNANO, I LORO NOMI NO (Alessio, 19/08:
            via SALA ALTA, SALA BASSA, BANCONE, CUCINA, SERVIZI e l'ingresso
            per intero, parola e segno della porta). Con le sagome, i colori,
            i coperti e il pannello dentro la pianta, quelle scritte erano
            diventate rumore — e una si sovrapponeva all'etichetta NOTE del
            modulo.
            🔴 MA I NOMI RESTANO NEI DATI, ed è la trappola da non prendere:
            `riquadroDelPannello()` filtra le zone PER NOME per sapere dove
            mettere il pannello. Se sparisse il campo `nome`, il pannello
            smetterebbe di comparire **senza nessun errore** — si limiterebbe
            a non succedere. La prova che dichiara il fatto sta in
            tests/unita/sala-misure.test.js. */}
        {ZONE_FONDALE.map((z) => (
          <rect
            key={z.nome}
            x={z.x}
            y={z.y}
            width={z.larghezza}
            height={z.profondita}
            fill={z.servizio ? "var(--color-b58-cream-dark)" : "var(--color-b58-parchment)"}
            fillOpacity={z.servizio ? 0.6 : 0.45}
          />
        ))}

        {/* ⚠️ LE ZONE NON HANNO PIÙ IL BORDO (Alessio, 19/08). Tolte le
            didascalie, restavano due righe che non separavano più niente —
            il confine fra servizi e cucina e quello fra sala bassa e
            bancone. Le altre coincidevano col perimetro o fra colori uguali,
            e non si notavano.
            ⚠️ Le zone restano nei dati, coi loro nomi: sparisce la riga
            disegnata, come per le didascalie — e `riquadroDelPannello()`
            continua a cercarle per nome.
            Il perimetro della sala invece resta, ed è uno solo: senza, la
            stanza non avrebbe più un contorno. */}
        <rect
          x={0}
          y={0}
          width={SALA_LARGHEZZA_CM}
          height={SALA_PROFONDITA_CM}
          fill="none"
          stroke="var(--color-b58-charcoal)"
          strokeOpacity="0.18"
          strokeWidth="4"
        />

        {/* LE SAGOME — le uniche cose vive del disegno. */}
        {sagome.map((vera) => {
          // ⚠️ La sola riga che puo` far comparire una sagoma dove non sta:
          // vedi SPOSTATE_NEL_DISEGNO in lib/calcoli/sala.js. Il tocco, il
          // trascinamento e tutto il resto continuano a usare la sagoma vera.
          const sagoma = sagomaPerIlDisegno(vera);
          const inMano = trascina?.id === sagoma.id;
          const x = inMano ? trascina.x : sagoma.x;
          const y = inMano ? trascina.y : sagoma.y;
          const colore = coloreDi(sagoma);
          const info = stato[sagoma.id];
          const tondo = sagoma.forma === "tondo";
          // ⚠️ IL VERSO. Fino al 18/08 il disegno ignorava `ruotato`
          // mentre il conteggio lo onorava: T1 e T2 — due tavoli veri
          // della sala — erano disegnati sdraiati 180×90 e contati in
          // piedi 90×180. Da qui in avanti nessuno legge `larghezza_cm`
          // senza passare da `misureSagoma()`.
          const misure = misureSagoma(sagoma);
          const inGruppo = dentroUnTavolone.has(sagoma.id);
          const selezionabile = Boolean(onSeleziona || (onSposta && sagoma.spostabile));

          // ⚠️ Con la sala in piedi, un'etichetta raddrizzata ha a
          // disposizione la PROFONDITA' della sagoma, non la larghezza:
          // "Chef Table" su un bancone profondo 70 cm sborderebbe sui
          // vicini. Quindi si raddrizza solo cio' che ci sta, e il resto
          // corre lungo il lato lungo della sagoma — che e' come le
          // piante di sala scrivono da sempre. La decisione vale per
          // TUTTE le righe della stessa sagoma: mezze scritte diritte e
          // mezze di traverso sarebbero peggio di entrambe.
          // ⚠️ DENTRO LA SAGOMA CI STA IL SUO NOME E BASTA.
          // Decisione di Alessio dopo averlo visto: in un quadrato di 90
          // cm non entrano un nome e un'ora a una dimensione leggibile —
          // sul telefono le due righe di un divano si accavallavano, sul
          // computer l'ora usciva tagliata («0:00 · 2»). Chi c'è e a che
          // ora si legge nell'elenco sotto la pianta, dove lo spazio c'è.
          // Sulla sagoma resta il colore, che si legge senza leggere.
          // ⚠️ IL NUMERO DEI COPERTI RIENTRA NELLA SAGOMA (18/08), e
          // cambia la decisione del 14/08 «dentro la sagoma ci sta il suo
          // nome e basta». La ragione di allora vale ancora — in un
          // quadrato di 90 cm due righe lunghe si accavallano — quindi il
          // prezzo accettato è che qui entra una CIFRA e nient'altro: non
          // «4 posti», non l'ora, che resta nell'elenco sotto.
          // ⚠️ E si vede quale dei due numeri si sta guardando: quello
          // corretto a mano porta un punto. Il perché sta nel mandato — su
          // quella cifra si decide se accettare una prenotazione, quindi
          // deve poter essere quella vera e deve dirsi tale. Le parole
          // (di quanto, e perché) stanno nell'elenco: sulla sagoma il
          // segno, sotto la spiegazione.
          const largo = (t, f) => (t ? String(t).length * f * 0.55 : 0);
          const coperti = info?.coperti;
          const posti =
            coperti != null
              ? `${coperti}${info?.corretto ? " ·" : ""}`
              : sagoma.posti_fissi && misure.profondita >= 110
                ? `${sagoma.posti_fissi} posti`
                : null;
          const serve = Math.max(largo(sagoma.label, 36), largo(posti, 26));
          // Con la sala in piedi un'etichetta raddrizzata ha a
          // disposizione la PROFONDITÀ della sagoma, non la larghezza:
          // "Chef Table" su un bancone profondo 70 cm sborderebbe sui
          // vicini. Si raddrizza solo ciò che ci sta; il resto corre lungo
          // il lato lungo, come le piante di sala scrivono da sempre.
          // Il rettangolo COME SI DISEGNA: cresciuto e tagliato al muro.
          // Le coordinate sono relative al translate(x y) del gruppo.
          const box = sagomaDisegnata(
            { x, y, larghezza: misure.larghezza, profondita: misure.profondita },
            crescitaCm,
            limitiSala,
            viciniVeri,
            varcoMinimoCm
          );
          const bx = box.x - x;
          const by = box.y - y;
          const raddrizza = verticale && serve <= box.profondita * 0.95;
          const cx = bx + box.larghezza / 2;
          const cy = by + box.profondita / 2;
          const chiaro = selezionati.has(sagoma.id) || Boolean(info?.colore);

          return (
            <g
              key={sagoma.id}
              transform={`translate(${x} ${y})`}
              style={{
                cursor: selezionabile ? "pointer" : "default",
                // Solo dove si trascina davvero: altrove il dito deve
                // poter scorrere la pianta.
                touchAction: onSposta && sagoma.spostabile ? "none" : undefined,
              }}
              // ⚠️ I gesti ricevono la sagoma VERA, non quella disegnata: chi
              // tocca sta agendo sul mobile, e il mobile sta dove dice il
              // database. Solo il disegno può mentire (SPOSTATE_NEL_DISEGNO).
              onPointerDown={(e) => iniziaTrascinamento(e, vera)}
              onPointerUp={() => rilascia(vera)}
              onClick={() => {
                // Chi non si trascina (divani, Chef Table) non passa mai
                // da rilascia(): il tocco arriva da qui.
                if (!vera.spostabile || !onSposta) onSeleziona?.(vera);
              }}
            >
              {/* ⚠️ LA LINEA DI GIUNZIONE (4-bis del mandato). Dentro un
                  tavolone i lati NON spariscono: si assottigliano. Un
                  rettangolo unico direbbe «questo è un tavolone» e
                  perderebbe «è fatto di tre» — che serve quando lo si
                  smonta, e serve alla correzione a mano, che ha per chiave
                  proprio l'insieme dei tavoli. Il perimetro forte del
                  tavolone lo ridisegna il riquadro del gruppo. */}
              <rect
                x={bx}
                y={by}
                width={box.larghezza}
                height={box.profondita}
                rx={tondo ? Math.min(box.larghezza, box.profondita) / 2 : 12}
                fill={colore.riempimento}
                stroke={
                  inMano && trascina?.fuori
                    ? "var(--color-b58-terracotta)"
                    : inMano && trascina?.agganci?.length
                      ? COLORE_AGGANCIO
                      : colore.bordo
                }
                strokeWidth={inMano ? 10 : inGruppo ? 1.5 : 5}
                strokeOpacity={!inMano && inGruppo ? 0.3 : 1}
                // ⚠️ Fuori dalla sala si vede PRIMA di lasciare: la sagoma si
                // fa trasparente e prende il bordo del rifiuto. Un gesto che
                // si annulla solo al rilascio è una sorpresa, e la volta dopo
                // si trascina piano per paura — è la stessa ragione per cui il
                // magnete si vede mentre prende.
                strokeDasharray={inMano && trascina?.fuori ? "30 18" : undefined}
                opacity={inMano ? (trascina?.fuori ? 0.45 : 0.85) : 1}
              />
              {/* IN RITARDO — sopra il colore e SOTTO il nome: il tavolo si
                  vede sbarrato e si continua a leggere quale tavolo è. Chi
                  sta in sala deve poterlo chiamare per nome mentre decide se
                  ridarlo via. */}
              {info?.barrato && (
                <rect
                  x={bx}
                  y={by}
                  width={box.larghezza}
                  height={box.profondita}
                  rx={tondo ? Math.min(box.larghezza, box.profondita) / 2 : 12}
                  fill="url(#sbarrato)"
                  pointerEvents="none"
                />
              )}
              {/* ⚠️ UN SOLO gruppo per tutte le scritte della sagoma, e non
                  una controrotazione per ciascuna. Girando ogni etichetta
                  attorno a sé stessa, due righe che stanno una SOTTO
                  l'altra finiscono una ACCANTO all'altra e si sovrappongono
                  — è il difetto che Alessio ha visto sui divani. Girando il
                  blocco intero attorno al centro della sagoma, la rotazione
                  del disegno e la controrotazione si annullano esattamente:
                  le scritte restano dritte E impilate come sono scritte
                  qui. */}
              <g transform={raddrizza ? `rotate(90 ${cx} ${cy})` : undefined}>
                <text
                  x={cx}
                  y={cy + (posti ? -6 : 12)}
                  textAnchor="middle"
                  fontSize="36"
                  fontWeight="600"
                  fill={chiaro ? "var(--color-b58-parchment)" : "var(--color-b58-charcoal)"}
                >
                  {sagoma.label}
                </text>
                {posti && (
                  <text
                    x={cx}
                    y={cy + 32}
                    textAnchor="middle"
                    fontSize="26"
                    fill={chiaro ? "var(--color-b58-parchment)" : "var(--color-b58-charcoal-soft)"}
                  >
                    {posti}
                  </text>
                )}
              </g>
              {/* Qui c'era un pallino che segnava «spostato solo per oggi».
                  Tolto su richiesta di Alessio: quale tavolo ha spostato
                  lo sa, l'ha appena fatto lui — e un segno che non serve
                  su una sagoma piccola è solo una cosa in meno di spazio
                  per il nome. Quanti ne ha spostati resta scritto sotto la
                  pianta, dove serve a rimetterli a posto. */}
            </g>
          );
        })}

        {/* IL PERIMETRO DEL TAVOLONE — disegnato DOPO le sagome, quindi
            sopra le loro linee sottili. Non intercetta il dito: si tocca
            sempre il tavolo che c'è sotto, perché è il singolo tavolo che
            si sposta e si smonta, non il gruppo. */}
        {tavoloni.map((t) => {
          const scelto = t.ids.some((id) => selezionati.has(id));
          const primo = perId.get(t.ids[0]);
          const colore = scelto ? COLORI.selezionato : coloreDi(primo);
          // ⚠️ Cresce insieme alle sagome che racchiude: col solo ingombro
          // vero il perimetro finirebbe DENTRO i tavoli, e il tavolone
          // sembrerebbe segnato da una riga che gli passa in mezzo.
          const b = sagomaDisegnata(t, crescitaCm, limitiSala);
          return (
            <rect
              key={`tavolone-${t.chiave}`}
              x={b.x}
              y={b.y}
              width={b.larghezza}
              height={b.profondita}
              rx={12}
              fill="none"
              stroke={colore.bordo}
              strokeWidth={5}
              pointerEvents="none"
            />
          );
        })}

        {/* ⚠️ «STA PER PRENDERE» — il segno del magnete mentre il dito è
            ancora giù. Racconta la stessa cosa del perimetro qui sopra, un
            attimo prima che sia vera: questi tavoli stanno per diventarne
            uno. Tratteggiato apposta — è una promessa, non un fatto. */}
        {trascina?.agganci?.length > 0 && (() => {
          const mia = misureSagoma(sagome.find((s) => s.id === trascina.id));
          const pezzi = [
            { x: trascina.x, y: trascina.y, m: mia },
            ...trascina.agganci
              .map((id) => perId.get(id))
              .filter(Boolean)
              .map((s) => ({ x: s.x, y: s.y, m: misureSagoma(s) })),
          ];
          const x1 = Math.min(...pezzi.map((p) => p.x));
          const y1 = Math.min(...pezzi.map((p) => p.y));
          const x2 = Math.max(...pezzi.map((p) => p.x + p.m.larghezza));
          const y2 = Math.max(...pezzi.map((p) => p.y + p.m.profondita));
          // ⚠️ Cresce insieme alle sagome: prima si allargava di 10 cm per
          // lato mentre le sagome crescono di ~16, quindi il tratteggio
          // cadeva DENTRO i tavoli invece che intorno.
          const b = sagomaDisegnata(
            { x: x1, y: y1, larghezza: x2 - x1, profondita: y2 - y1 },
            crescitaCm + 20,
            limitiSala
          );
          return (
            <rect
              x={b.x}
              y={b.y}
              width={b.larghezza}
              height={b.profondita}
              rx={16}
              fill="none"
              stroke={COLORE_AGGANCIO}
              strokeWidth={8}
              strokeDasharray="30 18"
              pointerEvents="none"
            />
          );
        })()}
        </g>
      </svg>

      {/* IL PANNELLO DENTRO LA PIANTA (19/08, idea di Alessio). Sta nello
          spazio di cucina e servizi, che sul disegno è vuoto: così il modulo
          della prenotazione non spinge più la pianta in basso e non obbliga a
          scorrere per prendere una prenotazione — il gesto più frequente di
          questa schermata.
          ⚠️ In percentuale del DISEGNO, e le percentuali si girano insieme a
          lui: con la sala in piedi quell'area finisce in basso a sinistra.
          ⚠️ E ci arriva SOLO se là dentro non c'è nessun tavolo. La decisione
          la prende chi chiama (`pannelloNellaPianta` in lib/calcoli/sala.js);
          qui si disegna quello che è stato deciso. */}
      {pannello && riquadroPannello && (
        <div
          // ⚠️ TRASPARENTE E SENZA BORDO: il contenuto porta già il suo
          // riquadro, e due riquadri uno dentro l'altro costavano 24 punti di
          // altezza su 487 — che è quello che faceva sforare la casella
          // dell'ora (Alessio, 19/08).
          className="absolute overflow-auto"
          style={
            verticale
              ? {
                  left: `${(riquadroPannello.y / SALA_PROFONDITA_CM) * 100}%`,
                  top: `${((SALA_LARGHEZZA_CM - riquadroPannello.x - riquadroPannello.larghezza) / SALA_LARGHEZZA_CM) * 100}%`,
                  width: `${(riquadroPannello.profondita / SALA_PROFONDITA_CM) * 100}%`,
                  height: `${(riquadroPannello.larghezza / SALA_LARGHEZZA_CM) * 100}%`,
                }
              : {
                  left: `${(riquadroPannello.x / SALA_LARGHEZZA_CM) * 100}%`,
                  top: `${(riquadroPannello.y / SALA_PROFONDITA_CM) * 100}%`,
                  width: `${(riquadroPannello.larghezza / SALA_LARGHEZZA_CM) * 100}%`,
                  height: `${(riquadroPannello.profondita / SALA_PROFONDITA_CM) * 100}%`,
                }
          }
          /* ⚠️ LA TASTIERA DELL'IPHONE copre metà schermo, e questo pannello
             sta in fondo alla pianta: senza questa riga il campo su cui si
             sta scrivendo finirebbe sotto la tastiera. Si chiede la distanza
             MINIMA, così dove la tastiera non c'è non si muove niente. */
          onFocus={(e) => e.target?.scrollIntoView?.({ block: "nearest" })}
        >
          {pannello}
        </div>
      )}
      </div>
    </div>
  );
}
