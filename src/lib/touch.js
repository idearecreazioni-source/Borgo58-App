// Calibrazione dei target di tocco in centimetri reali (§3.2.1).
//
// Perche' esiste: i pixel CSS non hanno una dimensione fisica costante.
// Lo stesso pulsante "da 40 pixel" e' 1,1 cm su un tablet e 0,6 cm su un
// altro. Durante un servizio pieno la differenza e' fra premere il piatto
// giusto e premere quello sotto. Le schermate operative dimensionano
// quindi i tocchi in cm (classi .tocco-* in index.css) e questo modulo
// dice quanti pixel vale un centimetro su QUESTO schermo.
//
// Il valore si calibra una volta per dispositivo appoggiando un righello
// (componente CalibrazioneTocco) e resta nel localStorage del tablet.

const STORAGE_KEY = "b58_pxcm";

// Stima a 96 dpi: 1 cm = 96/2.54 pixel. Punto di partenza ragionevole
// prima che qualcuno calibri davvero.
export const PXCM_DEFAULT = 37.79528;

// Limiti di sicurezza: fuori da qui il valore e' certamente sbagliato e
// renderebbe la schermata inusabile (bottoni giganti o invisibili).
const PXCM_MIN = 15;
const PXCM_MAX = 120;

export function getPxCm() {
  const raw = Number(localStorage.getItem(STORAGE_KEY));
  if (!raw || Number.isNaN(raw) || raw < PXCM_MIN || raw > PXCM_MAX) return PXCM_DEFAULT;
  return raw;
}

export function setPxCm(value) {
  const v = Math.min(PXCM_MAX, Math.max(PXCM_MIN, Number(value) || PXCM_DEFAULT));
  localStorage.setItem(STORAGE_KEY, String(v));
  applyPxCm(v);
  return v;
}

export function resetPxCm() {
  localStorage.removeItem(STORAGE_KEY);
  applyPxCm(PXCM_DEFAULT);
  return PXCM_DEFAULT;
}

export function applyPxCm(value = getPxCm()) {
  document.documentElement.style.setProperty("--pxcm", `${value}px`);
}
