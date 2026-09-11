// Il VERO segno «?» (`Didascalia`), montato nei posti dove si trova nel
// gestionale: accanto a un titolo, contro il bordo destro, vicino a un
// pulsante e a un collegamento, in una pagina che scorre. La prova visiva
// ci fa sopra i gesti veri — tocco, trascinamento, mouse, tastiera — col
// protocollo di Chrome, non con clic sintetici.
import { createRoot } from "react-dom/client";
import "../../../src/index.css";
import { applyPxCm } from "../../../src/lib/touch";
import Didascalia from "../../../src/components/Didascalia";

applyPxCm();

// ⚠️ Un elemento, non un componente: il lint pretende che un file che
//    dichiara componenti li esporti, e questo non esporta niente.
const pagina = (
    <main className="p-4 space-y-6">
      <h2 data-caso="titolo" className="font-display testo-sala-grande text-b58-charcoal flex items-center gap-1">
        Da pagare
        <Didascalia>Le fatture registrate e non ancora pagate, dalla più vecchia.</Didascalia>
      </h2>
      <p className="testo-sala text-b58-charcoal">
        Un paragrafo qualunque, per avere del testo fra i segni e poterci toccare in mezzo.
      </p>
      {/* Il «?» DENTRO l'etichetta di una casella, com'è nella scheda di un
          ingrediente: toccarlo non deve spuntare la casella. */}
      <label data-caso="etichetta" className="tocco-campo flex items-center gap-2 testo-sala-grande text-b58-charcoal">
        <input
          type="checkbox"
          data-casella
          onChange={(e) => {
            window.__casella = e.target.checked;
          }}
        />
        Avvisami se il prezzo sale
        <Didascalia>Qualunque aumento, anche piccolo.</Didascalia>
      </label>
      <div className="flex justify-end">
        <span data-caso="bordo" className="testo-sala text-b58-charcoal inline-flex items-center gap-1">
          In fondo a destra
          <Didascalia>
            Una spiegazione vicino al bordo destro dello schermo, abbastanza lunga da andare a capo
            su più righe.
          </Didascalia>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          data-bersaglio="pulsante"
          onClick={() => {
            window.__premuto = (window.__premuto || 0) + 1;
          }}
          className="tocco-bottone rounded-lg border border-b58-charcoal/15 px-4 testo-sala"
        >
          Un pulsante qualunque
        </button>
        <a data-bersaglio="collegamento" href="#arrivato" className="tocco-testo testo-sala text-b58-terracotta">
          Un collegamento
        </a>
      </div>
      {/* Spazio per scorrere: un segno non deve impedire di trascinare la pagina. */}
      <div data-riempitivo style={{ height: "200vh" }} />
    </main>
);

createRoot(document.getElementById("root")).render(pagina);
