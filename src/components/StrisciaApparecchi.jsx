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
  const [vecchia, setVecchia] = useState(false);
  const ultima = useRef(0);

  const leggi = () => {
    const questa = ++ultima.current;
    return allarmiApparecchi()
      .then((r) => {
        if (questa !== ultima.current) return;
        setAllarmi(r?.allarmi ?? []);
        setVecchia(false);
      })
      .catch((e) => {
        if (questa === ultima.current) setVecchia(Boolean(e));
      });
  };

  useEffect(() => {
    leggi();
    return ogniTantoSeVisibile(leggi, OGNI_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (allarmi.length === 0) return null;
  return (
    <div data-striscia-apparecchi role="alert" className="print:hidden mb-4 space-y-1">
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
          Non riesco a rileggere lo stato degli apparecchi: questo avviso potrebbe essere vecchio.
        </p>
      )}
    </div>
  );
}
