import { createClient } from "@supabase/supabase-js";

// Attrezzi per le prove contro il database VERO (npm run test:app).
//
// Le prove entrano come entrano i tablet: con utenti di PROVA dedicati
// (test-titolare / test-staff), mai con i PIN reali. Le credenziali vivono
// solo in .env.test, che .gitignore esclude dal repository.
//
// Regola di comportamento delle prove: leggere liberamente, scrivere SOLO
// dati di prova marcati e ripulirli sempre — e mai toccare le tabelle
// sorvegliate da deleted_records, per non lasciare lapidi di prova nel
// registro delle cancellazioni.

const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function clientAnonimo() {
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
