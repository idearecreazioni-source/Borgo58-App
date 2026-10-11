// Quali indirizzi sono pagine pubbliche (11/10/2026).
//
// ⚠️ UN POSTO SOLO: lo legge `src/main.jsx` per decidere quale pezzo di
//    codice scaricare. Le rotte vere stanno in `src/Pubblico.jsx`; se una
//    pagina pubblica nuova finisse solo li', qui non verrebbe riconosciuta e
//    il telefono scaricherebbe di nuovo tutto il gestionale — senza nessun
//    errore. La prova `tests/unita/pubblico.test.js` le tiene d'accordo.
export const PAGINE_PUBBLICHE = ["/prenota", "/privacy"];

export function pubblica(percorso) {
  const p = String(percorso ?? "").replace(/\/+$/, "") || "/";
  return PAGINE_PUBBLICHE.includes(p);
}
