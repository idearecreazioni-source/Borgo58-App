import { useEffect, useState } from "react";
import { EVENTO, tutteLeVoci } from "./coda";

/** Le voci della coda di Casa, aggiornate a ogni cambiamento. */
export function useCoda(attiva = true) {
  const [voci, setVoci] = useState([]);
  const [errore, setErrore] = useState(null);

  useEffect(() => {
    if (!attiva) return undefined;
    let vivo = true;
    const leggi = () =>
      tutteLeVoci()
        .then((v) => {
          if (vivo) {
            setVoci(v.sort((a, b) => b.creata - a.creata));
            setErrore(null);
          }
        })
        .catch((e) => vivo && setErrore(e?.message || "La coda del telefono non si legge."));
    leggi();
    window.addEventListener(EVENTO, leggi);
    return () => {
      vivo = false;
      window.removeEventListener(EVENTO, leggi);
    };
  }, [attiva]);

  return { voci, errore };
}
