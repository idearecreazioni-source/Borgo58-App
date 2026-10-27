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
(function () {
  var scelta = "chiaro";
  try {
    var s = localStorage.getItem("b58-tema");
    if (s === "scuro" || s === "auto") scelta = s;
  } catch {
    // Senza memoria del browser resta il chiaro di sempre.
  }
  var scuro =
    scelta === "scuro" ||
    (scelta === "auto" && !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-tema", scuro ? "scuro" : "chiaro");
})();
