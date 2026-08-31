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
  // 🔴 UN VALORE STORTO QUI AVVELENA ANCHE LE PROVE PURE — difetto mio,
  //    trovato da Alessio il 01/09/2026 e riprodotto prima di correggerlo.
  //    Questa mappatura entra in `env`, che vitest applica a TUTTE le prove:
  //    quindi un `PROVA_SUPABASE_URL` scritto male (per esempio il solo
  //    riferimento del progetto, senza `https://`) copriva il
  //    `VITE_SUPABASE_URL` buono e faceva fallire `npm run test` con
  //    «Invalid supabaseUrl» — su prove che col progetto di prova non
  //    c'entrano niente. Il suo `.env` era corretto nella riga che lui
  //    guardava, e il valore rotto arrivava da un'altra riga.
  //
  // ⚠️ LA CURA NON E' SCARTARLO IN SILENZIO: un valore storto scartato
  //    farebbe girare `npm run test:app` senza sapere dove, e il rifiuto
  //    arriverebbe piu' avanti con un'altra faccia. Si RIFIUTA qui, e il
  //    messaggio nomina la casella e cosa c'e' che non va.
  const male = (v) => v && !/^https:\/\//i.test(v);
  if (male(out.PROVA_SUPABASE_URL)) {
    throw new Error(
      `PROVA_SUPABASE_URL in .env non e' un indirizzo: "${out.PROVA_SUPABASE_URL}".\n` +
        "Deve cominciare per https:// — e' l'indirizzo del progetto Borgo58-Prova\n" +
        "(Settings -> Data API), non il suo riferimento. Vedi .env.example."
    );
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
