// L'IMMAGINE DELLA PAGINA PER UNA SEGNALAZIONE — 28/10/2026.
//
// Chiesto da Alessio dopo la sua prima segnalazione: i pulsanti storti
// della conferma «Elimina» non si capivano dal testo salvato.
//
// 🔴 NON È UNA FOTO DELLO SCHERMO, È UN RIDISEGNO. Un sito non può
//    fotografare lo schermo da solo: il telefono chiede il permesso ogni
//    volta, e l'iPhone non lo permette affatto. Qui il browser ridisegna
//    la pagina in un'immagine con le misure e le posizioni che sta
//    mostrando — che per un difetto di aspetto (un testo schiacciato, un
//    pulsante fuori dallo schermo) è proprio quello che serve.
//
// ⚠️ SI CARICA SOLO QUANDO SI PREME «SEGNALA» (`import()` in useSegnala):
//    la libreria non pesa sul gestionale che si apre ogni mattina.
//
// ⚠️ Resta fuori dall'immagine ciò che è marcato `data-fuori-dalla-foto`
//    (il riquadro stesso di «Segnala», che si apre mentre l'immagine si
//    fa) e ciò che è marcato `data-riservato` (dalla revisione di
//    sicurezza: un dato che non deve finire in una segnalazione).

import { domToBlob } from "modern-screenshot";

// Una pagina lunghissima (l'Agenda con cento righe) si taglia qui: la
// parte che conta è quasi sempre quella in alto, e un'immagine troppo
// grande l'iPhone non la sa disegnare.
const ALTEZZA_MASSIMA = 8000;
// Il tetto dei punti dell'immagine: sotto quello dell'iPhone (16,7 milioni)
// con margine, perché l'immagine si fa in memoria.
const PUNTI_MASSIMI = 8_000_000;
const LARGHEZZA_MASSIMA = 1400;
const ATTESA_MASSIMA = 15_000;

export const fuoriDallaFoto = (nodo) =>
  !(nodo?.nodeType === 1 && (nodo.hasAttribute("data-fuori-dalla-foto") || nodo.hasAttribute("data-riservato")));

/**
 * Quanto ingrandire: nitida come lo schermo (fino a 2), ma mai oltre la
 * larghezza e i punti massimi. Pura, per le prove.
 */
export function scalaDelloScatto(larghezza, altezza, densita = 1) {
  const l = Math.max(1, larghezza);
  const a = Math.max(1, altezza);
  return Math.min(2, Math.max(1, densita), LARGHEZZA_MASSIMA / l, Math.sqrt(PUNTI_MASSIMI / (l * a)));
}

/** Le misure della pagina da ridisegnare, con l'altezza già tagliata. */
export function misureDelloScatto(radice) {
  const larghezza = Math.ceil(radice.scrollWidth || radice.getBoundingClientRect().width);
  const intera = Math.ceil(radice.scrollHeight || radice.getBoundingClientRect().height);
  return { larghezza, altezza: Math.min(intera, ALTEZZA_MASSIMA), tagliata: intera > ALTEZZA_MASSIMA };
}

/**
 * Ridisegna la pagina intera e restituisce `{ blob, tagliata }`.
 * Se non ci riesce lancia un errore con una frase in italiano: chi chiama
 * lo dice nel riquadro, e la segnalazione parte lo stesso senza immagine.
 */
export async function scattaPagina(radice = document.getElementById("root") ?? document.body) {
  const { larghezza, altezza, tagliata } = misureDelloScatto(radice);
  const scala = scalaDelloScatto(larghezza, altezza, window.devicePixelRatio || 1);
  let scaduto;
  const tempo = new Promise((_, rifiuta) => {
    scaduto = setTimeout(
      () => rifiuta(new Error("L'immagine della pagina ci metteva troppo.")),
      ATTESA_MASSIMA,
    );
  });
  try {
    const blob = await Promise.race([
      domToBlob(radice, {
        width: larghezza,
        height: altezza,
        scale: scala,
        type: "image/jpeg",
        quality: 0.72,
        backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
        filter: fuoriDallaFoto,
        timeout: ATTESA_MASSIMA,
      }),
      tempo,
    ]);
    if (!blob || blob.size === 0) throw new Error("L'immagine della pagina è venuta vuota.");
    return { blob, tagliata };
  } finally {
    clearTimeout(scaduto);
  }
}
