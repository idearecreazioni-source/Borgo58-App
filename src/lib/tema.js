import { useSyncExternalStore } from "react";

// IL TEMA CHIARO O SCURO — 27/10/2026 (restyling, richiesta di Alessio)
//
// Due scelte: «chiaro» e «scuro». La scelta vive sul dispositivo, come la
// calibrazione del tocco: il tablet di sala e il telefono possono volere
// cose diverse. Senza scelta resta il chiaro.
// 🔴 «COME IL TELEFONO» TOLTO — 27/10/2026, sera, chiesto da Alessio.
//    Chi l'aveva scelto si ritrova il tema che il telefono mostrava in
//    quel momento, salvato come scelta sua (`public/tema.js`): niente cambia
//    sotto gli occhi.
//
// ⚠️ LA PRIMA VOLTA il tema lo mette `public/tema.js`, prima che la pagina
//    si disegni; qui si tiene aggiornato quando lo si cambia. La regola è la
//    stessa nei due file.

export const CHIAVE_TEMA = "b58-tema";
export const SCELTE_TEMA = [
  { valore: "chiaro", etichetta: "Chiaro" },
  { valore: "scuro", etichetta: "Scuro" },
];

export function leggiSceltaTema(memoria = globalThis.localStorage) {
  try {
    const s = memoria?.getItem(CHIAVE_TEMA);
    return s === "scuro" ? "scuro" : "chiaro";
  } catch {
    return "chiaro";
  }
}

function applica(scelta) {
  document.documentElement.setAttribute("data-tema", scelta === "scuro" ? "scuro" : "chiaro");
}

// 🔴 UNA SCELTA SOLA PER TUTTO IL GESTIONALE (notte del 28/10/2026, dalla
//    revisione): il menu e' montato due volte (quello del telefono e quello
//    del computer), e ognuno teneva la sua copia. Scelto «Scuro» dal menu del
//    telefono e girato il tablet, quello del computer mostrava ancora
//    «Chiaro» premuto — e toccarlo non faceva niente. Adesso la scelta vive
//    qui, fuori dai componenti, e tutti la leggono da qui.
let sceltaCorrente = null;
const chiAscolta = new Set();

const leggiCorrente = () => {
  if (sceltaCorrente === null) sceltaCorrente = leggiSceltaTema();
  return sceltaCorrente;
};

const ascolta = (avvisa) => {
  chiAscolta.add(avvisa);
  return () => chiAscolta.delete(avvisa);
};

export function scegliTema(nuova) {
  try {
    localStorage.setItem(CHIAVE_TEMA, nuova);
  } catch {
    // Senza memoria vale finché la pagina resta aperta: meglio di niente.
  }
  sceltaCorrente = nuova;
  applica(nuova);
  chiAscolta.forEach((avvisa) => avvisa());
}

export function useTema() {
  const scelta = useSyncExternalStore(ascolta, leggiCorrente, () => "chiaro");
  return [scelta, scegliTema];
}
