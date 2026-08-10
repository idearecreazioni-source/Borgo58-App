import { createClient } from "@supabase/supabase-js";

// Attrezzi per le prove contro un database vero (npm run test:app).
//
// Il database e' quello del progetto di PROVA, mai quello del locale:
// le prove scrivono, e cio' che scrive non deve poter sbagliare bersaglio.
//
// Le prove entrano come entrano i tablet: con utenti di PROVA dedicati
// (test-titolare / test-staff), mai con i PIN reali. Le credenziali vivono
// solo in .env.test, che .gitignore esclude dal repository.
//
// Regola di comportamento delle prove: leggere liberamente, scrivere SOLO
// dati di prova marcati e ripulirli sempre — e mai toccare le tabelle
// sorvegliate da deleted_records, per non lasciare lapidi di prova nel
// registro delle cancellazioni.

// Il progetto VERO. Le prove non devono poterlo toccare: dall'11/08/2026
// girano sul progetto di prova, e questa costante e' il controllo che lo
// impone da solo — non una raccomandazione scritta in un documento.
const REF_PRODUZIONE = "oudjuqbqszisdtwzbxdo";

// .env.test (caricato da vitest.config.js) ha la precedenza su .env.local:
// e' quel file a dire su quale database girano le prove.
const URL = process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export function clientAnonimo() {
  if (!URL || !ANON) {
    throw new Error(
      "Manca l'indirizzo del progetto di prova in .env.test " +
        "(VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY). Vedi docs/AMBIENTE_PROVA.md."
    );
  }
  if (URL.includes(REF_PRODUZIONE)) {
    throw new Error(
      "FERMO: le prove stanno puntando al database VERO del locale. " +
        "In .env.test va l'indirizzo del progetto di prova (docs/AMBIENTE_PROVA.md)."
    );
  }
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function credenziali() {
  const {
    TEST_TITOLARE_EMAIL,
    TEST_TITOLARE_PASSWORD,
    TEST_STAFF_EMAIL,
    TEST_STAFF_PASSWORD,
  } = process.env;
  if (!TEST_TITOLARE_EMAIL || !TEST_TITOLARE_PASSWORD || !TEST_STAFF_EMAIL || !TEST_STAFF_PASSWORD) {
    throw new Error(
      "Manca .env.test con le credenziali degli utenti di prova. " +
        "Copiare .env.test.example in .env.test e completarlo (vedi tests/app/LEGGIMI.md)."
    );
  }
  return {
    titolare: { email: TEST_TITOLARE_EMAIL, password: TEST_TITOLARE_PASSWORD },
    staff: { email: TEST_STAFF_EMAIL, password: TEST_STAFF_PASSWORD },
  };
}

export async function clientAutenticato({ email, password }) {
  const c = clientAnonimo();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(
      `Login di prova fallito per ${email}: ${error.message}. ` +
        "Gli utenti di prova esistono nella dashboard e hanno il ruolo in user_roles? (tests/app/LEGGIMI.md)"
    );
  }
  return c;
}
