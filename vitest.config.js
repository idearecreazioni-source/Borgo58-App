import { defineConfig } from "vitest/config";
import { existsSync, readFileSync } from "node:fs";

// Carica da `.env` (mai committato: coperto da .gitignore) l'indirizzo del
// progetto di PROVA e le credenziali dei suoi utenti. Dal 10/08/2026 le
// prove non girano piu' sul database del locale.
// Serve solo a `npm run test:app`; le prove di unità (`npm run test`) no.
//
// 🔴 LA MAPPATURA DEI NOMI E' IL CUORE DI QUESTO FILE, dal 31/08/2026.
//    In `.env` il progetto di prova si chiama `PROVA_*`, perche' li'
//    dentro `VITE_SUPABASE_URL` vuol dire il LOCALE VERO — e' la riga
//    che finisce nel sito pubblicato. Qui i due nomi di prova vengono
//    RIBATTEZZATI `VITE_*` per la durata delle prove, cosi' i moduli
//    dell'app trovano quello che si aspettano ma puntati altrove.
//    E' questo il posto che rende possibile un file solo: due nomi
//    diversi per due cose diverse, e la traduzione in un punto unico.
//
// ⚠️ SE QUESTA MAPPATURA CADESSE, le prove non girerebbero in silenzio
//    sul database vero: `tests/app/aiuto.js` guarda l'indirizzo e si
//    RIFIUTA di partire se ci riconosce il progetto del locale. La rete
//    e' sul valore, non su questo file.
//
// ⚠️ Su GitHub `.env` non esiste: i valori arrivano dai Secrets come
//    variabili d'ambiente gia' chiamate `VITE_*`, e questa funzione
//    restituisce un oggetto vuoto che non copre niente.
function credenzialiDiProva() {
  const out = {};
  if (existsSync(".env")) {
    for (const riga of readFileSync(".env", "utf8").split(/\r?\n/)) {
      const m = riga.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
  }
  const prova = {};
  if (out.PROVA_SUPABASE_URL) prova.VITE_SUPABASE_URL = out.PROVA_SUPABASE_URL;
  if (out.PROVA_SUPABASE_ANON_KEY) prova.VITE_SUPABASE_ANON_KEY = out.PROVA_SUPABASE_ANON_KEY;
  for (const n of ["TEST_TITOLARE_EMAIL", "TEST_TITOLARE_PASSWORD", "TEST_STAFF_EMAIL", "TEST_STAFF_PASSWORD"]) {
    if (out[n]) prova[n] = out[n];
  }
  return prova;
}

export default defineConfig({
  test: {
    environment: "node",
    // Le prove sulle date presumono l'orologio del locale (Europe/Rome):
    // e' esattamente il comportamento che l'app deve avere sui tablet.
    env: { TZ: "Europe/Rome", ...credenzialiDiProva() },
    // Le prove contro il database vero possono richiedere qualche secondo.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
