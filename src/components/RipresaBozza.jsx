import { useEffect, useState } from "react";
import { ascoltaRipresa, dimenticaLaBozza, ripresaInCorso } from "../lib/bozza";

// LA RIGA CHE DICE «QUESTO L'AVEVI SCRITTO TU».
//
// ⚠️ NON È UNA CORTESIA, ed è la stessa ragione della striscia che spiega
// perché un modulo si apre pieno: **un valore che compare da solo deve dire
// da dove viene**. Senza questa riga, chi ritrova la schermata piena dopo
// una ricarica non sa se sta guardando quello che aveva scritto lui o
// qualcosa rimasto lì da prima — e nel dubbio o svuota tutto o salva senza
// guardare.
//
// ⚠️ E SE NE VA DA SOLA dopo qualche secondo, al contrario dell'avviso
// delle letture tagliate. Quello dichiara che dei **numeri sono parziali**,
// e finché resta sullo schermo qualcuno potrebbe crederci; questo dichiara
// un fatto già avvenuto e verificabile guardando i campi. Un avviso che
// resta su una cosa già capita diventa arredamento.
const SECONDI = 8;

export default function RipresaBozza() {
  const [ripresa, setRipresa] = useState(ripresaInCorso);

  useEffect(() => ascoltaRipresa(setRipresa), []);

  useEffect(() => {
    if (!ripresa) return undefined;
    const t = setTimeout(() => setRipresa(null), SECONDI * 1000);
    return () => clearTimeout(t);
  }, [ripresa]);

  if (!ripresa) return null;

  return (
    <div className="bg-b58-olive/15 ring-1 ring-b58-olive/40 rounded-lg px-3 py-2 mb-4 print:hidden">
      <p className="testo-sala text-b58-charcoal">
        La pagina si è ricaricata e ho <strong>rimesso quello che stavi scrivendo</strong> — controlla
        che sia giusto prima di salvare.{" "}
        <button
          type="button"
          onClick={() => { dimenticaLaBozza(); setRipresa(null); }}
          className="tocco-bottone underline text-b58-terracotta-dark hover:text-b58-charcoal"
        >
          Non l&apos;avevo scritto io
        </button>
      </p>
    </div>
  );
}
