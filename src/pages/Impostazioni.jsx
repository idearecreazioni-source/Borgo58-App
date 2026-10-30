import { useId } from "react";
import { SCELTE_SCHERMO, useSchermo } from "../lib/schermo";

// LE IMPOSTAZIONI — 29/10/2026, decisione di Alessio dopo aver visto la
// scelta dello schermo su Prova: «Sposta nelle Impostazioni solo la scelta
// dello schermo, chiaro/scuro resta nel piede del menu».
//
// ⚠️ PERCHÉ SOLO LO SCHERMO: si sceglie una volta per apparecchio, e fissa
//    nel piede del menu rubava spazio da ogni schermata. Chiaro o scuro si
//    cambia anche a metà serata, quindi resta a portata di mano.
// ⚠️ Per tutti, non solo per il titolare: i tablet della sala li usa lo
//    staff, ed è lì che la scelta serve.

function SceltaSchermo() {
  const [scelta, scegli] = useSchermo();
  const idTitolo = useId();
  const idSpiega = useId();
  return (
    // `div` e non `section`: il ruolo «group» toglierebbe alla sezione il
    // suo punto di riferimento (revisione ecc:react-reviewer, 30/10).
    <div
      role="group"
      aria-labelledby={idTitolo}
      aria-describedby={idSpiega}
      className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 space-y-3"
      data-scelta-schermo
    >
      <h2 id={idTitolo} className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft">
        Questo apparecchio
      </h2>
      <p id={idSpiega} className="testo-sala text-b58-charcoal-soft">
        Vale solo per questo apparecchio: il telefono, il tablet e il computer tengono ognuno la sua.
      </p>
      <div className="flex flex-wrap gap-1">
        {SCELTE_SCHERMO.map((s) => (
          <button
            key={s.valore}
            type="button"
            aria-pressed={scelta === s.valore}
            onClick={() => scegli(s.valore)}
            className={`tocco-bottone rounded-lg px-3 testo-sala transition-colors ${
              scelta === s.valore
                ? "bg-b58-azione text-b58-sul-colore"
                : "text-b58-charcoal-soft ring-1 ring-b58-charcoal/15 hover:bg-b58-cream-dark"
            }`}
          >
            {s.etichetta}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Impostazioni() {
  return (
    <div className="testo-sala max-w-2xl mx-auto space-y-6">
      <h1 className="font-display text-2xl text-b58-charcoal">Impostazioni</h1>
      <SceltaSchermo />
    </div>
  );
}
