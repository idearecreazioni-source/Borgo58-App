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

// Il progetto VERO. Le prove non devono poterlo toccare: dal 10/08/2026
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

/**
 * Garantisce che una tabella riservata al titolare abbia almeno una riga.
 *
 * Serve da quando le prove girano sul progetto di prova, che nasce vuoto:
 * il protocollo §7 punto 2 vieta di dichiarare verificata una RLS su una
 * tabella vuota — senza una riga che lo staff NON deve vedere, la prova
 * passerebbe identica anche a RLS spenta. Restituisce la pulizia da
 * chiamare alla fine (che non fa nulla se la riga c'era già).
 */
export async function almenoUnaRiga(titolare, tabella, riga) {
  const { data, error } = await titolare.from(tabella).select("id").limit(1);
  if (error) throw new Error(`Non riesco a leggere ${tabella}: ${error.message}`);
  if (data.length > 0) return async () => {};

  const inserita = await titolare.from(tabella).insert(riga).select("id").single();
  if (inserita.error) {
    throw new Error(`Non riesco a creare la riga di prova in ${tabella}: ${inserita.error.message}`);
  }
  return async () => {
    await titolare.from(tabella).delete().eq("id", inserita.data.id);
  };
}

/** L'entità S.r.l.s.: la prima creata. Serve a ogni riga economica. */
export async function primaEntita(titolare) {
  const { data, error } = await titolare
    .from("entities")
    .select("id")
    .order("created_at")
    .limit(1)
    .single();
  if (error) throw new Error(`Nessuna entità nel database: ${error.message}`);
  return data.id;
}

/**
 * Sagome di prova nella pianta della sala (14/08/2026).
 *
 * Rimpiazza `almenoUnTavolo`, che creava un tavolo «da 20 coperti»: dal
 * blocco Sala nessun tavolo ha coperti, e il database lo rifiuta per
 * vincolo. Qui si creano N tavoli marcati, e si restituisce come toglierli.
 *
 * Le sagome di prova hanno un nome riconoscibile e vengono cancellate a
 * fine corsa: nella pianta di Alessio non deve comparire nulla che non
 * sia un tavolo vero.
 */
export async function sagomeDiProva(titolare, quante = 3) {
  const etichette = Array.from({ length: quante }, (_, i) => `__PROVA__ ${i + 1}`);
  await titolare.from("dining_tables").delete().in("label", etichette);

  const { data, error } = await titolare
    .from("dining_tables")
    .insert(
      etichette.map((label, i) => ({
        label,
        position: 900 + i,
        active: true,
        tipo: "tavolo",
        zona: "sala_bassa",
        larghezza_cm: 90,
        profondita_cm: 90,
        x: 100 + i * 100,
        y: 900,
      }))
    )
    .select("id, label");
  if (error) throw new Error(`Non riesco a creare le sagome di prova: ${error.message}`);

  return {
    sagome: data,
    ids: data.map((s) => s.id),
    async pulisci() {
      await titolare.from("dining_tables").delete().in("label", etichette);
    },
  };
}

/**
 * Il corridoio (Edge Function) è installato su QUESTO progetto?
 *
 * Sul progetto di prova le funzioni online vanno installate a parte: se
 * mancano, il gateway risponde 404 a qualunque chiamata — e le prove del
 * corridoio passerebbero "perché c'è un errore", cioè per il motivo
 * sbagliato. Meglio saperlo e dirlo.
 */
export async function corridoioInstallato(client) {
  const r = await client.functions.invoke("operazioni-atomiche", {
    body: { operazione: "__sonda__", parametri: {} },
  });
  if (!r.error) return true;
  // Attenzione al falso negativo: il corridoio risponde 404 anche alle
  // operazioni fuori elenco, esattamente come il gateway quando la
  // funzione non c'è. A distinguerli è il corpo della risposta, che solo
  // il corridoio scrive. Guardare il solo codice di stato diceva "non
  // installata" su una funzione installata e funzionante.
  const corpo = await r.error.context?.json?.().catch(() => null);
  return corpo?.errore?.codice === "operazione";
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
