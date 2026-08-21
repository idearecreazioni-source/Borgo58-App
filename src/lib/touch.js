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
// 🔴 QUESTO VALORE È UN PUNTO DI PARTENZA, NON UNA LENTE PER PROGETTARE
// (21/08/2026, dal collaudo di Alessio). È la stima di un monitor a 96 dpi.
// Le schermate operative — Comande, la pianta, il Calendario in servizio —
// vivono su un **mini tablet**, dove un centimetro vale **64 punti** (7,9")
// o **59,5** (8,3"), non 38.
//
// ⚠️ E L'ERRORE HA DUE EFFETTI CHE VANNO NELLA STESSA DIREZIONE, che è il
// motivo per cui non si vede: sul tablet i punti disponibili sono **meno**
// (768 contro i 960 di un monitor da 1280) e tutto ciò che è dimensionato
// in centimetri veri diventa **più grande** in punti — una riga del menu
// passa da 40 a 67 punti. Misurando col 37,8 si progetta con più spazio e
// con elementi più piccoli di quelli veri, ed è così che il 21/08 la
// pianta delle Comande è sbordata dallo schermo di Alessio.
//
// **Da adesso: ogni misura su una schermata operativa si fa col valore del
// TABLET.** I numeri veri sono in docs/referti/20260821_le_comande_sul_tablet_vero.md.
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
