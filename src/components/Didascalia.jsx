import { useEffect, useId, useRef, useState } from "react";

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

  return (
    <span ref={contenitore} className="relative inline-flex align-middle print:hidden">
      <button
        type="button"
        aria-label={etichetta}
        aria-expanded={aperta}
        aria-controls={id}
        onClick={() => setAperta((v) => !v)}
        // ⚠️ `pointerType === "mouse"` e non `onMouseEnter`: sui browser
        // dei tablet il tocco emette ANCHE gli eventi del mouse, quindi
        // un dito aprirebbe col passaggio e richiuderebbe col clic —
        // cioè non si aprirebbe mai. Trovato ragionando sul tablet, che
        // è lo schermo su cui questo gestionale vive.
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setAperta(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setAperta(false);
        }}
        onFocus={() => setAperta(true)}
        onBlur={() => setAperta(false)}
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
