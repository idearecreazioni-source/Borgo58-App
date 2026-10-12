// LA RISPOSTA PARLATA DI MEMO (V2, 11/10/2026).
//
// ⚠️ Non sostituisce niente: la conferma a schermo resta com'è. È una
//    comodità per chi detta con le mani occupate, e si spegne.
// ⚠️ La sintesi vocale è del BROWSER, non nostra: ogni telefono ha la sua
//    voce, e qualcuno non ne ha. Dove non c'è, semplicemente tace.
// 🔴 SU iPHONE LA VOCE PARTE SOLO DENTRO UN TOCCO. La risposta arriva dopo
//    un giro di rete, cioè fuori dal tocco: per questo `sbloccaVoce()` si
//    chiama sul pulsante del microfono e pronuncia una frase vuota, che è il
//    modo in cui Safari concede la voce alla pagina. Non provato su un
//    telefono vero quando è stato scritto: è la prima cosa da guardare.

const CHIAVE = "borgo58.memo.rispostaParlata";

export const vocePresente = () => typeof window !== "undefined" && "speechSynthesis" in window;

// La scelta è del dispositivo (una comodità per chi guarda), quindi sta nel
// browser. Se il browser non la lascia leggere, vale «accesa».
export function rispostaParlataAccesa() {
  try {
    return window.localStorage.getItem(CHIAVE) !== "spenta";
  } catch {
    return true;
  }
}

export function impostaRispostaParlata(accesa) {
  try {
    window.localStorage.setItem(CHIAVE, accesa ? "accesa" : "spenta");
  } catch {
    /* senza memoria vale per questa visita */
  }
}

export function sbloccaVoce() {
  if (!vocePresente()) return;
  try {
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    /* niente voce: si resta allo schermo */
  }
}

export function parla(testo) {
  if (!testo || !vocePresente()) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(testo);
    u.lang = "it-IT";
    const italiana = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("it"));
    if (italiana) u.voice = italiana;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}
