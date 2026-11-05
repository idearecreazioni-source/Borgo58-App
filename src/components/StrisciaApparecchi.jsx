import { useEffect, useRef, useState } from "react";
import { allarmiApparecchi } from "../lib/api/stampanti";
import { ogniTantoSeVisibile } from "../lib/ogniTanto";

// LA STRISCIA DEGLI APPARECCHI IN ALLARME — 04/11/2026, chiesto da Alessio:
// «un controllo regolare che si accerti che tutte le stampanti siano in
// funzione e mi avverta qualora non lo fossero».
//
// 🔴 In cima a ogni schermata, per chi lavora nel locale: «La stampante
//    della cucina non risponde dalle 12:40». Le frasi le scrive il database
//    (`allarmi_apparecchi`), fisse e senza indirizzi; sparisce da sola
//    quando il ponte la trova a posto. Col ponte spento l'avviso è uno solo.
// ⚠️ Se la lettura non riesce si tiene quella di prima e lo si dice: una
//    striscia sparita per un guasto di rete direbbe «tutto a posto».

const OGNI_MS = 30000;

export default function StrisciaApparecchi() {
  const [allarmi, setAllarmi] = useState([]);
  // Quante letture di fila non sono riuscite: la riga «potrebbe essere
  // vecchio» compare dalla terza, non a ogni battito di rete.
  const [mancate, setMancate] = useState(0);
  const [senzaRuolo, setSenzaRuolo] = useState(false);
  const ultima = useRef(0);

  const leggi = () => {
    const questa = ++ultima.current;
    return allarmiApparecchi()
      .then((r) => {
        if (questa !== ultima.current) return;
        setAllarmi(r?.allarmi ?? []);
        setMancate(0);
      })
      .catch((e) => {
        if (questa !== ultima.current) return;
        // Chi non ha un ruolo nel locale non vede gli apparecchi: niente
        // striscia, e non si richiede più.
        if (/solo a chi lavora nel locale/.test(e?.message ?? "")) setSenzaRuolo(true);
        else setMancate((n) => n + 1);
      });
  };

  useEffect(() => {
    if (senzaRuolo) return undefined;
    leggi();
    return ogniTantoSeVisibile(leggi, OGNI_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [senzaRuolo]);

  const vecchia = mancate >= 3;
  if (senzaRuolo || (allarmi.length === 0 && !vecchia)) return null;
  return (
    <div data-striscia-apparecchi role="status" className="print:hidden mb-4 space-y-1">
      {allarmi.map((a) => (
        <p
          key={a.chi}
          className="rounded-lg bg-b58-terracotta-dark px-3 py-2 testo-sala font-semibold text-b58-sul-colore"
        >
          {a.frase}
        </p>
      ))}
      {vecchia && (
        <p className="testo-sala text-b58-terracotta-dark-testo">
          {allarmi.length
            ? "Non riesco a rileggere lo stato degli apparecchi: questo avviso potrebbe essere vecchio."
            : "Non riesco a leggere lo stato delle stampanti e del registratore."}
        </p>
      )}
    </div>
  );
}
