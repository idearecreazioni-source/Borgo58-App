import { useEffect, useId, useRef, useState } from "react";
import { dopoIlGesto } from "../lib/calcoli/didascalia";

// La spiegazione che si apre da un segno, accanto al titolo.
//
// 🔴 PERCHE' ESISTE (24/08/2026, mandato di Alessio sulle didascalie).
// Il gestionale era pieno di righe che spiegano cosa significa la voce
// sopra: si leggono una volta e poi diventano arredamento, e intanto
// occupano lo spazio che in servizio si paga in secondi. È lo stesso
// criterio con cui il 18/08 ha tolto sette spiegazioni dalla sala:
// **una spiegazione che il lettore ha già in testa è ingombro.**
//
// ⚠️ MA NON SI CANCELLANO TUTTE, e il perché sta nel prezzo dichiarato
// quel giorno: il giorno che entrerà personale nuovo quelle parole
// serviranno di nuovo. Quindi le didascalie **restano scritte** e si
// aprono a richiesta; spariscono solo quelle che ripetono il titolo.
//
// ---------------------------------------------------------------------
// PERCHE' NON BASTA IL PASSAGGIO DEL MOUSE
// ---------------------------------------------------------------------
// 🔴 Il gestionale gira su un mini tablet da 8 pollici, dove il mouse non
// esiste: una spiegazione che si apre solo al passaggio **sparirebbe su
// tre schermi su quattro**. Quindi il segno risponde a tutti e tre i
// modi di arrivarci — mouse, dito, tastiera — e non a uno solo.
//
// ⚠️ E IL BERSAGLIO E' IL SEGNO, NON IL TITOLO: durante il servizio si
// tocca per sbaglio, e un titolo che apre un pannello ogni volta che lo
// si sfiora è peggio della didascalia che si voleva togliere.
//
// ⚠️ Il segno DISEGNATO è piccolo (non deve pesare accanto al titolo), ma
// l'area che risponde al dito è `tocco-bottone` — **0,85 cm veri**, la
// soglia del progetto. Sono due cose diverse, e confonderle è il difetto
// misurato il 22/08 sul pulsante del menu: 5,14 mm perché il disegno era
// il bersaglio.
export default function Didascalia({ children, etichetta = "Cosa vuol dire" }) {
  const [aperta, setAperta] = useState(false);
  const contenitore = useRef(null);
  const id = useId();

  // Toccando altrove si chiude. ⚠️ Senza, sul tablet resterebbe aperta
  // finché non si ritocca il segno — e chi l'ha aperta per sbaglio si
  // ritrova un pannello in mezzo alla schermata mentre serve.
  useEffect(() => {
    if (!aperta) return;
    const fuori = (e) => {
      if (contenitore.current && !contenitore.current.contains(e.target)) setAperta(false);
    };
    const esc = (e) => {
      if (e.key === "Escape") setAperta(false);
    };
    document.addEventListener("pointerdown", fuori);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fuori);
      document.removeEventListener("keydown", esc);
    };
  }, [aperta]);

  // Traduce l'evento del browser in un gesto e chiede alla regola cosa
  // fare. ⚠️ LA REGOLA NON STA QUI: sta in `calcoli/didascalia.js`, dove
  // esistono le prove — in questo progetto le prove non hanno un ambiente
  // DOM, quindi un componente non si può provare e una decisione sì,
  // purché stia fuori. Questo segno si è rotto due volte in due giorni,
  // sempre perché i tre modi di arrivarci producono sequenze diverse.
  const reagisci = (gesto, e) => {
    const daTastiera = gesto === "fuoco" && e.target.matches(":focus-visible");
    const puntatore = e.pointerType ?? e.nativeEvent?.pointerType;
    setAperta((v) => dopoIlGesto(gesto, { puntatore, daTastiera }, v));
  };

  return (
    <span ref={contenitore} className="relative inline-flex align-middle print:hidden">
      <button
        type="button"
        aria-label={etichetta}
        aria-expanded={aperta}
        aria-controls={id}
        // 🔴 COL MOUSE IL CLIC NON FA TOGGLE, E SENZA QUESTA RIGA IL SEGNO
        // ERA INUTILIZZABILE COL MOUSE (24/08/2026). La sequenza vera di un
        // mouse è: il cursore ENTRA — e il passaggio apre — e solo dopo
        // arriva il clic, che faceva toggle e **richiudeva**. Quindi
        // cliccando col mouse la didascalia si chiudeva sempre, e chi
        // clicca lo fa proprio perché la vuole aperta.
        //
        // ⚠️ NON L'AVEVA VISTO NESSUNA RILETTURA, e nemmeno la prova con
        // gli eventi finti: `pointerenter` sintetico non arriva a React
        // (che lo simula da `pointerover`), quindi il clic partiva su una
        // didascalia chiusa e il toggle sembrava giusto. **L'ha trovato un
        // clic vero con un mouse vero**, che è quello che Alessio ha
        // chiesto di fare: «non deve restare una cosa scritta e mai
        // esercitata».
        //
        // ⚠️ E col mouse non si perde niente: la didascalia si chiude
        // spostando il cursore, che è il gesto naturale. Il toggle resta
        // per il dito e per la tastiera, dove non esiste un «uscire».
        onClick={(e) => reagisci("clic", e)}
        // ⚠️ `pointerType === "mouse"` e non `onMouseEnter`: sui browser
        // dei tablet il tocco emette ANCHE gli eventi del mouse, quindi
        // un dito aprirebbe col passaggio e richiuderebbe col clic —
        // cioè non si aprirebbe mai. Trovato ragionando sul tablet, che
        // è lo schermo su cui questo gestionale vive.
        onPointerEnter={(e) => reagisci("entra", e)}
        onPointerLeave={(e) => reagisci("esce", e)}
        // 🔴 IL FOCUS APRE SOLO SE ARRIVA DALLA TASTIERA, e senza questa
        // riga il segno non funzionava col mouse ne col dito. Misurato, non
        // dedotto: premendo, il pulsante prende il focus PRIMA del clic —
        // `onFocus` apriva, e subito dopo `onClick` faceva toggle e
        // richiudeva. La didascalia lampeggiava e spariva.
        //
        // ⚠️ E il mio primo test NON lo vedeva: `b.click()` programmatico
        // non da il focus, quindi esercitava una sequenza che nella realta
        // non esiste. La sequenza vera e focus-poi-clic.
        //
        // `:focus-visible` e la distinzione che il browser fa gia": e vero
        // quando il focus arriva da Tab, falso quando arriva da un tocco o
        // da un clic. Chiederlo a lui invece di indovinarlo dal tipo di
        // puntatore e anche l accessibilita fatta come si deve.
        onFocus={(e) => reagisci("fuoco", e)}
        onBlur={(e) => reagisci("fuocoVia", e)}
        // ⚠️ `tocco-bottone` porta gia' con se' 0,85 cm veri in altezza E
        // in larghezza: la misura sta nel foglio di stile, in un posto
        // solo, e ricopiarla qui vorrebbe dire due numeri che un giorno
        // divergono.
        className="tocco-bottone inline-flex items-center justify-center text-b58-charcoal-soft/60 hover:text-b58-terracotta"
      >
        {/* Il segno disegnato: piccolo, perché accanto a un titolo non
            deve pesare. Il bersaglio che risponde al dito è il pulsante
            che lo contiene. */}
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center rounded-full border border-current leading-none"
          style={{ width: "1.15em", height: "1.15em", fontSize: "0.75em" }}
        >
          ?
        </span>
      </button>

      {aperta && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-1 w-64 max-w-[80vw] rounded-lg bg-b58-charcoal px-3 py-2 testo-sala font-normal normal-case tracking-normal text-b58-parchment shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}
