// Registra il service worker di Casa (scripts/casa-sw.js, copiato in
// sw-casa.js da casa:impacchetta). Solo su Casa: lo chiama avvio.js.
// ⚠️ Se il file non c'e' (una costruzione vecchia) la registrazione fallisce
// in silenzio, e Casa funziona come prima — solo, non senza rete.
export function registraIlServiceWorkerDiCasa() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw-casa.js", { scope: "/" }).catch(() => {});
}
