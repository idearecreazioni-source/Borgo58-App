import { useEffect, useState } from "react";
import { vociPerLaSpunta } from "../lib/api/spuntaInvestimento";

// LE VOCI DEL PIANO DA SCEGLIERE (parte 6 del piano, 07/11/2026; in un file
// suo dal 12/11/2026, perché le usa anche «Dividi su più voci»).
//
// Tre righe con la spunta aperte insieme non devono fare tre letture
// uguali; ma una voce aggiunta nel piano deve comparire poco dopo, quindi
// la lettura vale solo mezzo minuto.
// ⚠️ Se le voci non si leggono, si dice (errore), non si offre una lista
//    vuota che si leggerebbe «il piano non ha voci».
let inCorso = null;
let lettaIl = 0;
const VALE_PER = 30000;
function leggiVoci() {
  if (inCorso && Date.now() - lettaIl > VALE_PER) inCorso = null;
  if (!inCorso) {
    lettaIl = Date.now();
    inCorso = vociPerLaSpunta().catch((e) => {
      inCorso = null;
      throw e;
    });
  }
  return inCorso;
}

/**
 * @returns {{piano: {voci, rate, meseApertura}|null, errore: string}}
 *   voci già pronte da scegliere (vociSceglibili: niente madri, «Madre › Sottovoce»).
 */
export function useVociDelPiano() {
  const [piano, setPiano] = useState(null);
  const [errore, setErrore] = useState("");
  useEffect(() => {
    let vivo = true;
    leggiVoci()
      .then((p) => vivo && setPiano(p))
      .catch((e) => vivo && setErrore(e.message));
    return () => {
      vivo = false;
    };
  }, []);
  return { piano, errore };
}
