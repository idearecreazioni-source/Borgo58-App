const REF_PRODUZIONE = "oudjuqbqszisdtwzbxdo";

export const VARIABILI_TEST_APP = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "TEST_TITOLARE_EMAIL",
  "TEST_TITOLARE_PASSWORD",
  "TEST_STAFF_EMAIL",
  "TEST_STAFF_PASSWORD",
];

export function verificaAmbienteTestApp(env = process.env) {
  const mancanti = VARIABILI_TEST_APP.filter((nome) => !env[nome]?.trim());
  if (mancanti.length > 0) {
    throw new Error(
      `Le prove dell'app non possono partire: mancano ${mancanti.join(", ")}. ` +
        "Compila .env.test come descritto in tests/app/LEGGIMI.md."
    );
  }

  if (env.VITE_SUPABASE_URL.includes(REF_PRODUZIONE)) {
    throw new Error(
      "FERMO: VITE_SUPABASE_URL indica il database di produzione. " +
        "Le prove dell'app possono usare soltanto il progetto di prova."
    );
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    verificaAmbienteTestApp();
  } catch (errore) {
    console.error(errore.message);
    process.exitCode = 1;
  }
}
