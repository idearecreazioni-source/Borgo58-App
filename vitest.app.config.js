import { defineConfig } from "vitest/config";

import { leggiChiaviDiProva } from "./scripts/chiavi.mjs";

// LE PROVE CONTRO IL DATABASE DI PROVA — `npm run test:app`.
//
// 🔴 PERCHE' E' UN FILE A SE' (01/09/2026): perche' quello che c'e' qui
//    dentro non deve poter cambiare l'esito delle prove pure. Vedi la nota
//    in cima a `vitest.config.js` — il caso e' successo davvero.
//
// 🔴 LA TRADUZIONE DEI NOMI E' IL CUORE DI QUESTO FILE, e sta in un posto
//    solo: `leggiChiaviDiProva()` in `scripts/chiavi.mjs`. In `.env` il
//    progetto di prova si chiama `PROVA_*`, perche' li' dentro
//    `VITE_SUPABASE_URL` vuol dire il LOCALE VERO — e' la riga che finisce
//    nel sito pubblicato. Qui i due nomi vengono ribattezzati `VITE_*` per
//    la durata delle prove, cosi' i moduli dell'app trovano quello che si
//    aspettano ma puntati altrove.
//
// ⚠️ SE QUESTA TRADUZIONE CADESSE, le prove non girerebbero in silenzio sul
//    database vero: `tests/app/aiuto.js` guarda l'indirizzo e si RIFIUTA di
//    partire se ci riconosce il progetto del locale, e prima ancora si
//    rifiuta il preflight (`node scripts/chiavi-di-prova.mjs`, che
//    `npm run test:app` lancia per primo). La rete e' sul valore, in tre
//    punti della stessa catena, mai su questo file.
//
// ⚠️ Su GitHub `.env` non esiste: i valori arrivano dai Secrets come
//    variabili d'ambiente gia' chiamate `VITE_*`, e il lettore le prende da
//    li'. L'ambiente vince sul file — regola dichiarata e provata.
export default defineConfig({
  test: {
    environment: "node",
    env: { TZ: "Europe/Rome", ...leggiChiaviDiProva() },
    // Le prove contro il database vero possono richiedere qualche secondo.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
