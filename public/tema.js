// IL TEMA PRIMA DELLA PRIMA PITTURA — 27/10/2026 (restyling)
//
// Mette `data-tema="chiaro"` o `"scuro"` su <html> PRIMA che la pagina si
// disegni: caricato da index.html come script classico, sincrono, nel
// <head>. Da main.jsx arriverebbe tardi (è un modulo, parte dopo) e chi ha
// scelto lo scuro vedrebbe un lampo bianco a ogni apertura.
//
// ⚠️ Un file e non uno script scritto dentro index.html: la politica di
//    sicurezza del sito (public/_headers) ammette solo script da 'self'.
// ⚠️ La stessa regola sta in src/lib/tema.js, che poi tiene il tema
//    aggiornato mentre si usa il gestionale: se cambia una, cambia l'altra.
// 🔴 «Come il telefono» non c'è più (27/10/2026, sera): chi l'aveva scelto
//    tiene il tema che il telefono mostra adesso, salvato come scelta sua.
(function () {
  var scuro = false;
  try {
    var s = localStorage.getItem("b58-tema");
    if (s === "auto") {
      s = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "scuro" : "chiaro";
      try {
        localStorage.setItem("b58-tema", s);
      } catch {
        // Se non si può salvare, per stavolta vale lo stesso.
      }
    }
    scuro = s === "scuro";
  } catch {
    // Senza memoria del browser resta il chiaro di sempre.
  }
  document.documentElement.setAttribute("data-tema", scuro ? "scuro" : "chiaro");
})();
