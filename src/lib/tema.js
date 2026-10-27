import { useEffect, useState } from "react";

// IL TEMA CHIARO O SCURO — 27/10/2026 (restyling, richiesta di Alessio)
//
// Tre scelte: «chiaro», «scuro», «auto» (come il telefono). La scelta vive
// sul dispositivo, come la calibrazione del tocco: il tablet di sala e il
// telefono possono volere cose diverse. Senza scelta resta il chiaro.
//
// ⚠️ LA PRIMA VOLTA il tema lo mette `public/tema.js`, prima che la pagina
//    si disegni; qui si tiene aggiornato quando lo si cambia, e quando il
//    telefono passa da giorno a sera con la scelta «Come il telefono».
//    La regola è la stessa nei due file.

export const CHIAVE_TEMA = "b58-tema";
export const SCELTE_TEMA = [
  { valore: "chiaro", etichetta: "Chiaro" },
  { valore: "scuro", etichetta: "Scuro" },
  { valore: "auto", etichetta: "Come il telefono" },
];

const BUIO = "(prefers-color-scheme: dark)";

export function leggiSceltaTema(memoria = globalThis.localStorage) {
  try {
    const s = memoria?.getItem(CHIAVE_TEMA);
    return s === "scuro" || s === "auto" ? s : "chiaro";
  } catch {
    return "chiaro";
  }
}

/** Il tema da mostrare per una scelta: «auto» segue il telefono. */
export function temaEffettivo(scelta, telefonoAlBuio) {
  if (scelta === "scuro") return "scuro";
  if (scelta === "auto" && telefonoAlBuio) return "scuro";
  return "chiaro";
}

function alBuio() {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(BUIO).matches;
}

function applica(scelta) {
  document.documentElement.setAttribute("data-tema", temaEffettivo(scelta, alBuio()));
}

export function useTema() {
  const [scelta, setScelta] = useState(leggiSceltaTema);

  useEffect(() => {
    applica(scelta);
    if (scelta !== "auto" || !window.matchMedia) return undefined;
    const m = window.matchMedia(BUIO);
    const cambia = () => applica(scelta);
    m.addEventListener?.("change", cambia);
    return () => m.removeEventListener?.("change", cambia);
  }, [scelta]);

  const scegli = (nuova) => {
    try {
      localStorage.setItem(CHIAVE_TEMA, nuova);
    } catch {
      // Senza memoria vale finché la pagina resta aperta: meglio di niente.
    }
    setScelta(nuova);
  };

  return [scelta, scegli];
}
