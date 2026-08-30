import { useLayoutEffect, useRef, useState } from "react";
import {
  GRIGLIA_CM,
  SALA_LARGHEZZA_CM,
  SALA_PROFONDITA_CM,
  ZONE_FONDALE,
  SOGLIA_IN_PIEDI_CM_REALI,
  agganciaAiVicini,
  areaVietataAiMobili,
  dentroAreaVietata,
  VARCO_MINIMO_MM,
  ingrandimentoCm,
  misureSagoma,
  sagomaDisegnata,
  sagomeTagliateDallaVista,
  sagomaPerIlDisegno,
  raggioMagneteCm,
} from "../lib/calcoli/sala";
import { COLORI } from "../lib/coloriSala";


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
  onSfondo,
  onSposta,
  stato = {},
  gruppi = [],
  // 🔴 I PANNELLI DENTRO LA PIANTA SONO PIU' D'UNO (21/08). Prima era
  // uno solo, e bastava: il Calendario ne ha uno. In Comande ne servono
  // due — i nomi delle prenotazioni nel bancone, e i pulsanti del conto
  // nell'area di cucina e servizi.
  // ⚠️ Ognuno porta il suo riquadro, calcolato da `pannelloNellaPianta`:
  // qui si disegna quello che e' stato deciso, e la decisione «c'e' un
  // tavolo sopra?» resta di chi chiama.
  pannelli = [],
  inPiedi = "auto",
}) {
  const svgRef = useRef(null);
  const contenitoreRef = useRef(null);
  const [stretto, setStretto] = useState(false);
  // Quanto è largo il DISEGNO adesso, in punti di schermo. Serve a tradurre
  // in centimetri di sala i millimetri veri dell'ingrandimento delle sagome.
  const [largPx, setLargPx] = useState(0);
  // 🔴 QUALI SAGOME NON SI VEDONO PER INTERO — il guardiano nato il
  // 22/08, dopo che una sala tagliata è arrivata fino al collaudo **due
  // volte** senza che nessun controllo la nominasse.
  //
  // ⚠️ VIVE NEL BROWSER PERCHÉ LA DOMANDA VIVE LÌ. Le prove di questo
  // progetto non hanno una pagina: possono dire se una sagoma sta dentro
  // il FOGLIO (geometria), non se sta dentro quello che si VEDE — che
  // dipende da ogni antenato della pagina, dai margini, da un ritaglio
  // che nessuno ha misurato. Qui invece si legge la pagina vera.
  //
  // ⚠️ E SI DENUNCIA, non si registra in un angolo: è la stessa scelta
  // dell'avviso delle letture tagliate (19/08). Una sala con meno tavoli
  // non somiglia a un errore — somiglia a una sala.
  const [tagliate, setTagliate] = useState([]);

  // ⚠️ SI GIRA DA SOLA QUANDO LO SCHERMO È STRETTO. Trovato da Alessio
  // aprendo il Calendario dal cellulare: la sala sdraiata si vedeva a
  // metà. La soglia non è un numero di pixel scelto a occhio — è la
  // stessa che decide se le sagome restano toccabili: se il posto non
  // basta per la sala sdraiata, si mette in piedi. E si misura in
  // centimetri VERI, con la calibrazione del dispositivo, non in pixel:
  // due schermi con gli stessi pixel possono essere grandi il doppio.
  // La misura del guardiano, chiamata da due posti: quando il riquadro
  // cambia taglia e quando cambia il disegno. ⚠️ Servono tutti e due —
  // una sagoma spostata non fa cambiare taglia a niente.
  const misuraTagliate = () => {
    const el = contenitoreRef.current;
    if (!el || !el.clientWidth) return;
    // ⚠️ Il riquadro VISIBILE è `clientWidth/clientHeight`, non
    // `getBoundingClientRect()`: il primo esclude quello che è fuori
    // dallo scorrimento, il secondo no. È esattamente la differenza
    // fra «c'è» e «si vede».
    const b = el.getBoundingClientRect();
    const riquadro = {
      sinistra: b.left,
      cima: b.top,
      destra: b.left + el.clientWidth,
      fondo: b.top + el.clientHeight,
    };
    const rettangoli = [...el.querySelectorAll("[data-sagoma]")].map((g) => {
      const r = g.getBoundingClientRect();
      const testo = g.querySelector("text");
      return {
        nome: testo ? testo.textContent.trim() : "?",
        sinistra: r.left,
        destra: r.right,
        cima: r.top,
        fondo: r.bottom,
      };
    });
    // 🔴 SI SCRIVE SOLO SE È CAMBIATO, e non è un'ottimizzazione: questo
    // controllo gira **dopo ogni disegno**, e `sagomeTagliateDallaVista`
    // restituisce ogni volta un elenco nuovo. Scriverlo sempre farebbe
    // ridisegnare, che farebbe ricontrollare, all'infinito — «Maximum
    // update depth exceeded», e la pianta non si disegna affatto.
    // ⚠️ Trovato aprendo la schermata, non rileggendo: la compilazione
    // passava e il lint pure.
    const adesso = sagomeTagliateDallaVista(rettangoli, riquadro);
    const firma = (e) => e.map((s) => s.nome + ":" + s.versi.join("+")).join("|");
    setTagliate((prima) => (firma(prima) === firma(adesso) ? prima : adesso));
  };

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
      misuraTagliate();
    };
    misura();
    const osservatore = new ResizeObserver(misura);
    osservatore.observe(el);
    // 🔴 E ANCHE IL DISEGNO, non solo il riquadro (22/08, trovato
    // rompendolo dal vivo). Il disegno può cambiare taglia **senza che il
    // riquadro cambi**: un carattere che finisce di caricarsi, un foglio
    // di stile che arriva, un antenato che si stringe. Osservando solo il
    // contenitore, il guardiano dormiva proprio nel caso per cui esiste —
    // messo apposta un disegno più largo del riquadro, non ha detto
    // niente.
    if (svgRef.current) osservatore.observe(svgRef.current);
    return () => osservatore.disconnect();
  }, []);

  // ⚠️ E dopo OGNI ridisegno: un tavolo trascinato, una sagoma che compare,
  // la sala che si gira. Nessuno di questi cambia la taglia del riquadro,
  // quindi l'osservatore qui sopra non se ne accorgerebbe.
  useLayoutEffect(misuraTagliate);

  // In Comande è sempre in piedi (tablet verticale, deciso). Altrove
  // decide lo spazio che c'è.
  // 🔴 UN TAVOLONE È UN CONTO SOLO, QUINDI UN BADGE SOLO — regola di Alessio,
  // 21/08. Su T7·T8·T9 accostati tre badge direbbero «tre cose da fare» dove
  // ce n'è una: il conto è uno, e il gesto che manca è uno.
  //
  // ⚠️ Lo porta il tavolo più in ALTO A DESTRA del gruppo, che è dove il
  // badge sta comunque. Si sceglie confrontando `x + larghezza` e poi `y`, e
  // non l'ordine in cui i tavoli arrivano: quell'ordine lo decide il
  // database e cambierebbe il badge di posto senza che nessuno l'abbia
  // spostato.
  const portaIlBadge = (() => {
    const capofila = new Set();
    const soli = new Set(sagome.map((s) => s.id));
    for (const g of gruppi) {
      const dentro = (g.tavoli ?? []).map((id) => sagome.find((s) => s.id === id)).filter(Boolean);
      if (dentro.length === 0) continue;
      dentro.forEach((s) => soli.delete(s.id));
      const scelto = dentro.reduce((a, b) => {
        const da = a.x + (a.larghezza ?? 0);
        const db = b.x + (b.larghezza ?? 0);
        if (db !== da) return db > da ? b : a;
        return b.y < a.y ? b : a;
      });
      capofila.add(scelto.id);
    }
    // Le sagome che in nessun gruppo compaiono (divani, Chef Table) portano
    // il proprio badge: sono insiemi di uno.
    for (const id of soli) capofila.add(id);
    return capofila;
  })();

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
      {/* 🔴 LA SALA TAGLIATA SI DENUNCIA (22/08/2026). Due volte una
          pianta monca è arrivata fino al collaudo, e le due volte nessun
          controllo l'ha nominata: il difetto non fa rumore — **una sala
          con meno tavoli somiglia a una sala**, e un tavolo che non c'è
          non si può nemmeno toccare per accorgersene.
          ⚠️ Sta DENTRO il riquadro della pianta e non in cima alla pagina:
          il dubbio nasce guardando la sala, e lì deve trovare la
          risposta. E non sparisce da sola. */}
      {tagliate.length > 0 && (
        <p className="testo-sala bg-b58-terracotta/15 text-b58-terracotta-dark px-3 py-2 leading-tight">
          <b>Attenzione: la sala non si vede tutta.</b> Non ci stanno per intero{" "}
          {tagliate.map((t) => t.nome).join(", ")}. Gira il tablet o allarga la
          finestra: quello che non si vede non si può toccare.
        </p>
      )}
      {/* 🔴 IL DISEGNO NON HA PIÙ UN PAVIMENTO IN CENTIMETRI REALI
          (22/08/2026, difetto trovato da Alessio col tablet).

          Qui c'era `min-width: 9,01 cm × --pxcm` — 667 punti alla
          calibrazione 74. L'SVG è `w-full`, quindi prendeva la larghezza
          di QUESTO riquadro: **una misura fissa in centimetri veri dentro
          un contenitore elastico**. Sotto quella soglia il disegno teneva
          la sua taglia e la parte che avanzava finiva fuori dalla vista —
          T9 a metà, i divani e la Chef Table non disegnati affatto.

          ⚠️ E NON SOMIGLIAVA A UN ERRORE: somigliava a una sala con meno
          tavoli. Il contenitore scorreva di lato (che è già vietato), ma
          nessuno scorre di lato una pianta — la si guarda e basta. *Un
          tavolo che non c'è non si può toccare.*

          ⚠️ COSA SI PAGA, dichiarato: sotto i 667 punti il bersaglio del
          tavolo più piccolo scende sotto 1,05 cm. Si vede con
          `bersaglioTavoloCm()`, e resta sopra i **5,3 mm che Alessio ha
          provato con le mani** fino a ~449 punti (alla calibrazione 74).
          Fra «i tavoli si toccano un po' più piccoli» e «tre tavoli non
          ci sono», la scelta non è in dubbio. */}
      <div className="relative">
      {/* ⚠️ IL TOCCO SUL VUOTO. Serve a DESELEZIONARE, ed e' meta' del
          gesto: senza, l'unico modo di annullare una scelta sbagliata e'
          ritoccare esattamente il tavolo giusto.

          ⚠️ Si riconosce dal BERSAGLIO, non dalla propagazione: `closest`
          risale dal punto toccato e, se sopra c'e' una sagoma, questo
          gesto non e' suo. Fermare la propagazione sulle sagome avrebbe
          funzionato uguale oggi e rotto il giorno che qualcuno aggiunge
          un elemento dentro una sagoma dimenticandosi di fermarla. */}
      <svg
        ref={svgRef}
        onClick={(e) => {
          if (!onSfondo) return;
          if (e.target.closest && e.target.closest("[data-sagoma]")) return;
          onSfondo();
        }}
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
          {/* Il rigato di «non lo so»: grigio su fondo chiaro, e in diagonale
              nell'altro verso rispetto alla sbarratura del ritardo — così i
              due si distinguono anche quando stanno sullo stesso tavolo. */}
          <pattern id="fasciaIgnota" width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="var(--color-b58-cream-dark)" />
            <path
              d="M 0 14 L 14 0"
              stroke="var(--color-b58-charcoal-soft)"
              strokeWidth="2.5"
              opacity="0.45"
            />
          </pattern>
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
          // 🔴 LE TAGLIE VERE SONO 44 E 34, non 36 e 26 (24/08/2026,
          // rilievo di Alessio: «Chef Table sfora il riquadro che lo
          // contiene»). Qui si stimava con le taglie di PRIMA del 21/08 —
          // quel giorno il testo fu ingrandito per il tablet e questa
          // stima resto' indietro. Misurato dal vivo: «Chef Table» e'
          // largo **230 unita' di sala** su una sagoma di 200, e la stima
          // ne dichiarava 198. Un numero che dice «ci sta» su una cosa
          // che sfora.
          const serve = Math.max(largo(sagoma.label, 44), largo(posti, 34));

          // 🔴 E LA STIMA DA SOLA NON BASTAVA, perche' decideva soltanto se
          // GIRARE la scritta: se il nome non ci stava nemmeno per il
          // lungo, nessuno lo fermava e usciva dai bordi.
          //
          // ⚠️ `textLength` non e' una stima: e' il browser che stringe il
          // testo fino alla misura data, quindi il nome sta dentro **per
          // costruzione** invece che per un fattore indovinato. Si applica
          // solo quando serve — comprimere un nome che ci sta gia' lo
          // renderebbe brutto per niente.
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
          // 🔴 LA SCRITTA SI GIRA QUANDO STA MEGLIO GIRATA, e la domanda e'
          // sulla SAGOMA, non sulla sala (24/08/2026). Prima era
          // `verticale && ...`: si guardava se era in piedi la STANZA, e
          // una sagoma stretta e profonda dentro una sala orizzontale
          // restava con la scritta per il largo. E' il caso della Chef
          // Table — larga 200 e profonda 70, ma **disegnata girata** per
          // decisione di Alessio (rovesciamento n. 15): sul disegno ha 93
          // di larghezza e il nome ne chiede 177.
          //
          // ⚠️ Il caso normale non cambia: su un tavolo quadrato il nome
          // ci sta per il largo, quindi la condizione non scatta e la
          // scritta resta dritta come e' sempre stata.
          // ⚠️ «STA MEGLIO GIRATA», non «ci sta girata»: la prima versione
          // chiedeva che il nome entrasse per il verso lungo **a taglia
          // piena**, e su «Chef Table» non entrava nemmeno li' (chiede 242
          // su 188). Cosi' non girava, restava per il largo su 93, e
          // sforava di piu'. Le due cure lavorano insieme — prima si sceglie
          // il verso che da' piu' spazio, poi si rimpicciolisce quanto basta.
          const staMeglioGirata =
            box.profondita > box.larghezza && serve > box.larghezza * 0.94;
          const raddrizza = (verticale && serve <= box.profondita * 0.95) || staMeglioGirata;

          // 🔴 SI RIMPICCIOLISCE IL CARATTERE, NON SI SCHIACCIA IL TESTO.
          // La prima cura usava `textLength`, che porta il testo alla
          // misura data comprimendo le lettere: su «Chef Table» sarebbe
          // stata una **compressione del 62%**, cioe' una striscia
          // illeggibile. Una cura peggiore del difetto.
          //
          // ⚠️ E IL MINIMO E' 34 UNITA', non zero: sono i 3,2 mm sotto i
          // quali il testo non si legge in piedi, col tablet a distanza di
          // braccio (regola del 21/08). Se nemmeno a 34 ci sta, si tronca —
          // meglio un nome tagliato che una riga che nessuno puo' leggere.
          const spazioNome = (raddrizza ? box.profondita : box.larghezza) * 0.94;
          const nomeChiede = largo(sagoma.label, 44);
          const tagliaNome = nomeChiede > spazioNome
            ? Math.max(34, Math.floor((44 * spazioNome) / nomeChiede))
            : 44;
          const cx = bx + box.larghezza / 2;
          const cy = by + box.profondita / 2;
          const chiaro = selezionati.has(sagoma.id) || Boolean(info?.colore);

          return (
            <g
              key={sagoma.id}
              data-sagoma=""
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
              {/* 🔴 I DUE PALLINI DEL CONTO (21/08). Sono UNA COPPIA A DUE
                  GRADI e hanno la stessa forma apposta:
                    · CONTORNO  → il conto è aperto e non è stato ordinato
                      ancora niente: **devo tornare al tavolo**;
                    · PIENO     → ci sono piatti segnati e mai partiti:
                      **devo mandare in cucina**.
                  Il pieno è più forte perché costa di più — un tavolo che
                  aspetta e una cucina che non sa.
                  ⚠️ Non inventare un secondo simbolo per il vuoto: è la
                  stessa cosa a un grado minore, e due forme diverse
                  direbbero che sono due fatti scollegati.
                  ⚠️ Sta nell'angolo in alto a destra della sagoma VERA e
                  fuori dal gruppo delle scritte, perché non deve girare col
                  testo: un pallino è un pallino in tutti i versi. */}
              {info?.pallino && portaIlBadge.has(sagoma.id) && (
                <>
                  {/* ⚠️ L'ANELLO CHIARO, ed è la parte che fa funzionare tutto
                      il resto. Un badge sovrapposto poggia su qualunque
                      colore: il rosso dell'ultimo turno, l'ambra, il marrone,
                      il bianco. Senza l'anello andrebbe misurato contro
                      ognuno — e col rosso nuovo il pallino pieno starebbe a
                      **17,5** di distanza, a contatto diretto. Con l'anello
                      il problema non si fa esistere: il badge è staccato da
                      tutto per costruzione, ed è anche come sono fatte le
                      notifiche che Alessio aveva in mente. */}
                  <circle
                    cx={bx + box.larghezza}
                    cy={by}
                    r={20}
                    fill="var(--color-b58-parchment)"
                    pointerEvents="none"
                  />
                  <circle
                    cx={bx + box.larghezza}
                    cy={by}
                    r={15}
                    fill={info.pallino === "pieno" ? "var(--color-b58-terracotta)" : "none"}
                    stroke="var(--color-b58-terracotta-dark)"
                    strokeWidth={6}
                    pointerEvents="none"
                  />
                </>
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
                  // 🔴 MISURATO ALLA CALIBRAZIONE VERA (21/08): 36 unità di
                  // sala fanno 3,5 mm sul tablet di Alessio — appena sopra la
                  // soglia dei 3 mm. 44 ne fanno 4,2, che è la misura del testo
                  // grande delle Comande. ⚠️ Sono unità di SALA, non punti: la
                  // scritta cresce e rimpicciolisce insieme al disegno, che è
                  // ciò che la tiene dentro la sagoma su ogni schermo.
                  // ⚠️ 44 quando ci sta, meno quando non ci sta, mai sotto
                  // 34: vedi il calcolo di `tagliaNome` qui sopra.
                  fontSize={tagliaNome}
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
                    // La cifra dei coperti: 26 unità facevano 2,5 mm, sotto la
                    // soglia. 34 ne fanno 3,2.
                    fontSize="34"
                    fill={chiaro ? "var(--color-b58-parchment)" : "var(--color-b58-charcoal-soft)"}
                  >
                    {posti}
                  </text>
                )}
              </g>
              {/* 🔴 QUANTE PRENOTAZIONI CI SONO SOPRA — 30/08/2026, richiesta
                  di Alessio: *«tre prenotazioni sullo stesso tavolo alla
                  stessa ora e non è successo niente. E servono più di due
                  tinte per dire che sono tre: due tinte dicono "due"»*.
                  🔴 MISURATO costruendo la scena: tre prenotazioni alle 20:30
                     su T3 danno **una tinta sola**, ed è giusto — sono tutte
                     della stessa fascia. La domanda «quante sono» non era
                     mai stata fatta.
                  ⚠️ E NON È UNA TERZA TINTA: tre tinte direbbero «tre» e
                     quattro no, e servirebbe una legenda per un numero.
                     **Un numero si scrive.** Il colore continua a dire la
                     fascia; la pastiglia dice quante — due canali per due
                     domande, come la sbarratura e il pallino.
                  ⚠️ FUORI DALLA SAGOMA, in alto a destra: dentro ci stanno
                     il nome e la cifra dei coperti, e la decisione del
                     18/08 dice che non ci entra altro. Sul bordo non ruba
                     spazio a nessuna delle due. */}
              {/* 🔴 LA CIFRA SI CONTRORUOTA, e questa l'ha trovata l'OCCHIO e
                  non il codice: sul telefono la pianta si mette in piedi
                  (`rotate(-90)` su tutto il disegno) e il «3» usciva
                  coricato. Le scritte della sagoma hanno la loro
                  controrotazione dal 14/08; le pastiglie che c'erano prima
                  sono cerchi, e su un cerchio girare non si vede.
                  ⚠️ `rotate(90)` DOPO il `translate`: così gira attorno al
                  centro della pastiglia invece che attorno all'origine della
                  sagoma — che la manderebbe da un'altra parte. */}
              {info?.quante > 1 && (
                <g
                  transform={`translate(${bx + box.larghezza} ${by})${
                    verticale ? " rotate(90)" : ""
                  }`}
                >
                  <circle r="26" fill="var(--color-b58-charcoal)" />
                  <text
                    y="12"
                    textAnchor="middle"
                    fontSize="34"
                    fontWeight="600"
                    fill="var(--color-b58-parchment)"
                  >
                    {info.quante}
                  </text>
                </g>
              )}
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
      {pannelli
        .filter((p) => p && p.contenuto && p.riquadro)
        .map((p, i) => (
        <div
          key={i}
          // ⚠️ TRASPARENTE E SENZA BORDO: il contenuto porta già il suo
          // riquadro, e due riquadri uno dentro l'altro costavano 24 punti di
          // altezza su 487 — che è quello che faceva sforare la casella
          // dell'ora (Alessio, 19/08).
          // ⚠️ `pannello-pianta`: rende questo riquadro il METRO del testo
          //    che ci sta dentro (30/08). Vedi il commento in index.css —
          //    senza, il testo si misura sulla finestra e resta uguale
          //    mentre il riquadro cambia taglia.
          className="pannello-pianta absolute overflow-auto"
          style={
            verticale
              ? {
                  left: `${(p.riquadro.y / SALA_PROFONDITA_CM) * 100}%`,
                  top: `${((SALA_LARGHEZZA_CM - p.riquadro.x - p.riquadro.larghezza) / SALA_LARGHEZZA_CM) * 100}%`,
                  width: `${(p.riquadro.profondita / SALA_PROFONDITA_CM) * 100}%`,
                  height: `${(p.riquadro.larghezza / SALA_LARGHEZZA_CM) * 100}%`,
                }
              : {
                  left: `${(p.riquadro.x / SALA_LARGHEZZA_CM) * 100}%`,
                  top: `${(p.riquadro.y / SALA_PROFONDITA_CM) * 100}%`,
                  width: `${(p.riquadro.larghezza / SALA_LARGHEZZA_CM) * 100}%`,
                  height: `${(p.riquadro.profondita / SALA_PROFONDITA_CM) * 100}%`,
                }
          }
          /* ⚠️ LA TASTIERA DELL'IPHONE copre metà schermo, e questi pannelli
             stanno dentro la pianta: senza questa riga il campo su cui si
             sta scrivendo finirebbe sotto la tastiera. Si chiede la distanza
             MINIMA, così dove la tastiera non c'è non si muove niente. */
          onFocus={(e) => e.target?.scrollIntoView?.({ block: "nearest" })}
        >
          {p.contenuto}
        </div>
      ))}
      </div>
    </div>
  );
}
