import { useState } from "react";
import { PXCM_DEFAULT, getPxCm, resetPxCm, setPxCm } from "../../lib/touch";
import { BERSAGLIO_PROVATO_CM, bersaglioTavoloCm } from "../../lib/calcoli/sala";

// Righello di calibrazione (§3.2.1). Si appoggia un righello vero sullo
// schermo del tablet e si regola finche' la barra non misura 10 cm esatti:
// da quel momento tutti i target di tocco dell'app hanno la dimensione
// fisica giusta su QUEL dispositivo. Una volta per tablet, non per sessione.
export default function CalibrazioneTocco({ onClose }) {
  const [pxcm, setValue] = useState(getPxCm);

  const change = (v) => setValue(setPxCm(v));

  // ⚠️ L'AVVERTENZA STA DOVE STA IL GESTO (18/08, giro E). Su uno schermo
  // di telefono il righello di fabbrica SBAGLIA PER DIFETTO: disegna tutto
  // piu' piccolo del vero. Calibrandolo qui, la pianta della sala cresce
  // fino a sbordare — peggio di com'era prima del giro E, che l'ha appena
  // fatta entrare. E' pensata per il tablet, dove il dito deve prendere il
  // piatto giusto durante un servizio.
  //
  // ⚠️ Non e' una soglia di schermo scelta a occhio ne' un avviso scritto
  // in un messaggio di chat, che sarebbe perso: e' il CONTO VERO, fatto
  // con la stessa misura che usa la pianta, e cambia mentre si sposta il
  // righello. Cosi' dice «stai per fare questo», non «attento in generale».
  // 🔴 IL CONTO È CAMBIATO IL 22/08, e con lui quello che l'avviso dice.
  // Prima diceva «la sala sborderà»: era vero finché il disegno aveva un
  // pavimento in centimetri reali, e quel pavimento **tagliava la sala**.
  // Tolto il pavimento, la pianta entra sempre — quello che cambia con la
  // calibrazione non è più se la sala si vede, è **quanto è grande il
  // bersaglio del dito**. L'avviso dice quello, in millimetri.
  const spazio = typeof window === "undefined" ? 0 : window.innerWidth - 32;
  const bersaglioMm = spazio > 0 ? bersaglioTavoloCm(spazio, Number(pxcm)) * 10 : 0;
  // ⚠️ Il confronto è coi 5,3 mm PROVATI CON LE MANI, non con la
  // convenzione di 1,05 cm: sotto quelli si entra in un terreno che
  // nessuno ha verificato.
  const stretto = spazio > 0 && bersaglioMm < BERSAGLIO_PROVATO_CM * 10;

  return (
    <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base text-b58-charcoal">Calibrazione dei tocchi</h2>
          <p className="text-xs text-b58-charcoal-soft/80 leading-relaxed mt-0.5">
            Appoggia un righello sullo schermo e regola finché la barra non misura
            <b> 10 cm esatti</b>. Serve una volta sola per ogni tablet: da lì in poi i
            pulsanti hanno la stessa dimensione reale su qualunque schermo.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-b58-charcoal-soft hover:text-b58-terracotta-dark text-lg leading-none px-1"
        >
          ×
        </button>
      </div>

      <div
        className="h-6 rounded border border-b58-charcoal bg-white"
        style={{
          width: "calc(var(--pxcm) * 10)",
          maxWidth: "100%",
          backgroundImage:
            "repeating-linear-gradient(to right, #2b2621 0, #2b2621 1px, transparent 1px, transparent calc(var(--pxcm) / 2)), repeating-linear-gradient(to right, #2b2621 0, #2b2621 2px, transparent 2px, transparent var(--pxcm))",
        }}
      />

            {stretto && (
        <p className="text-[13px] leading-relaxed rounded-lg bg-b58-gold/15 px-3 py-2 text-b58-charcoal">
          <b>Con questa misura i tavoli diventano piccoli da prendere.</b> Su questo
          schermo il tavolo più piccolo verrebbe {bersaglioMm.toFixed(1)} mm, e col dito
          ne servono almeno {(BERSAGLIO_PROVATO_CM * 10).toFixed(1)}. La sala si vede
          tutta lo stesso — non sborda più — ma il dito sbaglia più spesso. La
          calibrazione col righello è pensata per il <b>tablet</b>; su un telefono
          conviene lasciare la stima di partenza.
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => change(pxcm - 0.5)} className="tocco-bottone rounded-lg border border-b58-charcoal/15 bg-white text-b58-charcoal">
          −
        </button>
        <input
          type="number"
          step="0.1"
          value={Number(pxcm).toFixed(2)}
          onChange={(e) => change(e.target.value)}
          className="w-24 text-center rounded-lg border border-b58-charcoal/15 bg-white px-2 py-2 text-sm"
        />
        <span className="text-xs text-b58-charcoal-soft">pixel per cm</span>
        <button type="button" onClick={() => change(pxcm + 0.5)} className="tocco-bottone rounded-lg border border-b58-charcoal/15 bg-white text-b58-charcoal">
          +
        </button>
        <button
          type="button"
          onClick={() => setValue(resetPxCm())}
          className="text-xs text-b58-charcoal-soft underline hover:text-b58-terracotta-dark"
        >
          ripristina stima ({PXCM_DEFAULT.toFixed(0)})
        </button>
      </div>
    </div>
  );
}
