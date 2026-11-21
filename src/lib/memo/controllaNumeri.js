// I numeri della chat non sono un'opinione del modello. Questa piccola
// guardia riceve i numeri che gli strumenti hanno davvero restituito e
// segnala quelli che MEMO ha aggiunto nella frase senza una fonte.

function numeroItaliano(testo) {
  const pulito = String(testo).replace(/\./g, "").replace(",", ".");
  const numero = Number(pulito);
  return Number.isFinite(numero) ? numero : null;
}

function raccogliNumeri(valore, dentro = []) {
  if (typeof valore === "number" && Number.isFinite(valore)) dentro.push(valore);
  else if (Array.isArray(valore)) valore.forEach((v) => raccogliNumeri(v, dentro));
  else if (valore && typeof valore === "object") Object.values(valore).forEach((v) => raccogliNumeri(v, dentro));
  return dentro;
}

/**
 * Restituisce i numeri scritti nella risposta che non sono fra quelli letti
 * o calcolati dal gestionale. Le date (ISO, gg/mm/aaaa o scritte in lettere come «1° ottobre 2026») e le ore non sono importi e si ignorano;
 * `extra` sono i numeri della data di oggi che il server dà al modello.
 */
export function numeriSenzaFonte(risposta, risultati = [], extra = []) {
  const ammessi = [...raccogliNumeri(risultati), ...extra].map((n) => Math.round(n * 100) / 100);
  const senzaFonte = [];
  const testo = String(risposta ?? "").replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
    .replace(/\b\d{1,2}\s*°?\s*(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+\d{4})?/gi, "")
    .replace(/\b(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+\d{4}\b/gi, "")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, "")
    .replace(/\b\d{1,2}:\d{2}\b/g, "");
  for (const trovato of testo.matchAll(/(?<![\w-])(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:\.\d+)?)(?![\w-])/g)) {
    const numero = numeroItaliano(trovato[1]);
    if (numero === null) continue;
    const arrotondato = Math.round(numero * 100) / 100;
    if (!ammessi.some((n) => Math.abs(n - arrotondato) < 0.005)) senzaFonte.push(trovato[1]);
  }
  return [...new Set(senzaFonte)];
}

export function controllaNumeri(risposta, risultati = []) {
  const senzaFonte = numeriSenzaFonte(risposta, risultati);
  return {
    verificato: senzaFonte.length === 0,
    senzaFonte,
    avviso: senzaFonte.length ? "Controllalo: alcuni numeri della risposta non arrivano dai dati letti." : null,
  };
}
