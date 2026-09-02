import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { indirizziDiAccesso, marcatore } from "./scripts/indirizzi-accesso.mjs";

// LE PROVE CHE GUARDANO UNA SCHERMATA — `npm run test:schermate` (01/09/2026)
//
// 🔴 PERCHE' ESISTE, e il numero e' misurato il 01/09/2026 con la copertura
//    alla mano: delle 13.241 istruzioni di `src/`, le prove pure ne
//    toccavano **1.310, cioe' il 9,89%**. E lo squilibrio non era caso:
//    `src/lib/calcoli` — le regole pure, dove questo progetto mette
//    apposta il ragionamento — stava al **91,9%**; `src/pages` (89 file,
//    8.731 istruzioni, i due terzi del gestionale) e `src/components` (25
//    file) stavano a **ZERO**. Non «poco»: zero.
//
// ⚠️ NON ERA UNA DIMENTICANZA, era una mancanza di attrezzi: in questo
//    progetto le prove giravano in `node`, senza nessun ambiente di
//    schermo. Montare un componente non era possibile — quindi nessuno
//    l'ha mai fatto, e il file dei controlli lo dichiarava («nessuna prova
//    di questo progetto guarda una schermata»).
//
// ⚠️ QUELLO CHE QUESTO STRATO NON DIVENTERA' MAI, e va scritto perche' non
//    si scambi per altro: **non e' un occhio**. Un testo troppo piccolo,
//    un colore che non si distingue con le luci basse, un riquadro che
//    sborda di 54 punti — quelli li ha trovati Alessio col tablet in mano,
//    e continueranno a trovarsi cosi'. Qui si prova cio' che si puo'
//    affermare senza guardare: che una schermata **si monta**, che mostra
//    la cosa giusta nei casi che contano, e che quando qualcosa non si sa
//    lo **dice** invece di disegnare il vuoto — la regola del 19/08.
export default defineConfig({
  plugins: [react()],

  // ⚠️ LA STESSA INIEZIONE DI `vite.config.js`, e serve davvero: dal 02/09
  //    `AuthContext.jsx` legge gli indirizzi di accesso da qui invece di
  //    averli scritti dentro. Senza questa riga, qualunque prova che montasse
  //    una schermata dentro `AuthProvider` si romperebbe — e non oggi, il
  //    giorno che qualcuno ne scrive una. *Meglio la riga adesso che
  //    l'indagine fra tre mesi.*
  // ⚠️ E il valore viene dallo STESSO modulo, non ricopiato: se i predefiniti
  //    cambiassero, qui cambierebbero da soli.
  define: {
    __INDIRIZZI_ACCESSO__: JSON.stringify(marcatore(indirizziDiAccesso({}))),
  },
  test: {
    environment: "jsdom",
    env: { TZ: "Europe/Rome" },
    globals: false,
    setupFiles: ["./tests/schermate/preparazione.js"],
  },
});
