import { createClient } from "@supabase/supabase-js";

// Attrezzi per le prove contro un database vero (npm run test:app).
//
// Il database e' quello del progetto di PROVA, mai quello del locale:
// le prove scrivono, e cio' che scrive non deve poter sbagliare bersaglio.
//
// Le prove entrano come entrano i tablet: con utenti di PROVA dedicati
// (test-titolare / test-staff), mai con i PIN reali. Le credenziali vivono
// solo in `.env`, che .gitignore esclude dal repository.
//
// Regola di comportamento delle prove: leggere liberamente, scrivere SOLO
// dati di prova marcati e ripulirli sempre — e mai toccare le tabelle
// sorvegliate da deleted_records, per non lasciare lapidi di prova nel
// registro delle cancellazioni.

// Il progetto VERO. Le prove non devono poterlo toccare: dal 10/08/2026
// girano sul progetto di prova, e questa costante e' il controllo che lo
// impone da solo — non una raccomandazione scritta in un documento.
const REF_PRODUZIONE = "oudjuqbqszisdtwzbxdo";

// I valori arrivano da `.env` (il progetto di prova si chiama li' dentro
// `PROVA_*`, ribattezzato `VITE_*` da vitest.config.js) oppure dalle
// variabili d'ambiente della pipeline. Il processo ha la precedenza sul
// file, quindi e' sempre la mappatura a decidere su quale database si
// gira — e il controllo qui sotto e' la rete se sbagliasse.
const URL = process.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export function clientAnonimo() {
  if (!URL || !ANON) {
    throw new Error(
      "Manca l'indirizzo del progetto di prova in .env " +
        "(PROVA_SUPABASE_URL e PROVA_SUPABASE_ANON_KEY). Vedi docs/AMBIENTE_PROVA.md."
    );
  }
  if (URL.includes(REF_PRODUZIONE)) {
    throw new Error(
      "FERMO: le prove stanno puntando al database VERO del locale. " +
        "In .env, PROVA_SUPABASE_URL deve essere il progetto di prova (docs/AMBIENTE_PROVA.md)."
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
      "Mancano in .env le credenziali degli utenti di prova. " +
        "Copiare .env.example in .env e completarlo (vedi tests/app/LEGGIMI.md)."
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

  // Dal 18/08/2026 un tavolo DEVE avere un formato: è da lì che vengono i
  // suoi coperti, e senza il conteggio della serata sarebbe più basso del
  // vero senza dare nessun errore. Il vincolo lo impedisce, e queste
  // sagome vanno create come quelle vere.
  const { data: formato, error: erroreFormato } = await titolare
    .from("formati_tavolo")
    .select("id")
    .eq("nome", "Quadrato 90x90")
    .single();
  if (erroreFormato) throw new Error(`Manca il formato dei tavoli di prova: ${erroreFormato.message}`);

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
        formato_id: formato.id,
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

// ---------------------------------------------------------------------
// LA SENTINELLA DEI SALTI — 20/08/2026
// ---------------------------------------------------------------------
// 🔴 IL DIFETTO CHE CHIUDE. Le prove condizionate al corridoio sono **26**,
// sparse su **nove** file. La sentinella che denunciava il salto viveva in
// UN SOLO file (`permessi.test.js`) e il suo messaggio diceva «le tre prove
// del corridoio»: erano tre quando è stata scritta.
//
// Due cose sbagliate insieme, e sono di natura diversa:
//   · **il numero era scritto a mano**, quindi invecchiava da solo — la
//     stessa forma che questo progetto ha già tolto con `collaudo:stato`;
//   · **il salto si denunciava da un file solo**, quindi chi lanciasse
//     `vitest run tests/app/tesoreria.test.js` con il corridoio spento
//     vedrebbe tre prove «passate» che non sono mai partite.
//
// ⚠️ *Una prova saltata in silenzio, dopo un mese, è una prova che nessuno
// sa di non avere più.*

/**
 * Quante prove di un file sono condizionate al corridoio.
 *
 * ⚠️ Il numero si CONTA, non si scrive: è una funzione pura che legge il
 * sorgente, e la prova che la sorveglia sta in `tests/unita/`.
 */
export function proveCondizionate(sorgente) {
  // 🔴 DUE FORME, NON UNA, e la seconda è stata trovata dalla prova scritta
  // al contrario — non rileggendo. `allarmi.test.js` salta un `describe`
  // INTERO, non le singole prove: cercando solo `it.skipIf` risultava «zero
  // prove condizionate» su un file che ne salta tre. È la stessa forma del
  // guardiano del 19/08 che riconosceva una sola delle due scritture dello
  // stesso gesto.
  const singole = (sorgente.match(/it\.skipIf\(\s*!\s*CORRIDOIO\s*\)/g) ?? []).length;
  if (!/describe\.skipIf\(\s*!\s*CORRIDOIO\s*\)/.test(sorgente)) return singole;

  // ⚠️ LIMITE DICHIARATO: quando un `describe` intero è condizionato, si
  // contano TUTTE le prove del file. È esatto finché quel describe copre il
  // file (il caso di oggi) e sovrastima se un domani ne convivessero due.
  // Sovrastimare qui è il verso giusto: il numero serve a dire «non sono
  // partite», e dirne una in più non fa spegnere una sentinella.
  const tutte = (sorgente.match(/\bit(\.skipIf\([^)]*\))?\s*\(/g) ?? []).length;
  return Math.max(singole, tutte);
}

/**
 * Da chiamare in OGNI file che ha prove condizionate al corridoio, passando
 * `import.meta.url`. Se il corridoio non è installato, questo file diventa
 * rosso e dice **quante** delle sue prove non sono partite.
 */
export async function denunciaSaltiCorridoio(installato, urlDelFile) {
  const { describe, expect, it } = await import("vitest");
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");

  const percorso = fileURLToPath(urlDelFile);
  const nome = percorso.split(/[\\/]/).pop();
  const quante = proveCondizionate(readFileSync(percorso, "utf8"));

  describe(`sentinella dei salti — ${nome}`, () => {
    it("il corridoio è installato, quindi nessuna prova di questo file è stata saltata", () => {
      expect(
        installato,
        `La funzione online 'operazioni-atomiche' non è installata sul progetto di prova: ` +
          `${quante} prove di ${nome} sono state SALTATE, e sono passate senza partire. ` +
          `Si installa con \`npm run funzione operazioni-atomiche -- --prova --conferma\` ` +
          `(docs/AMBIENTE_PROVA.md §6).`
      ).toBe(true);
    });
  });
}

/**
 * 🔴 IL REGISTRO DELLE PROPRIE RIGHE — 23/08/2026, regola di Alessio nata
 * da un danno vero.
 *
 * Uno script di prova ha cancellato «l'ultima riga di `discounts_gifts`»
 * invece di quella che aveva creato lui, e se n'è andato uno **sconto
 * vero** dello scenario. L'identificativo c'era: non era suo.
 *
 * La regola: *una pulizia cancella SOLO righe di cui conosce
 * l'identificativo, perché le ha create lei e se l'è segnato. Mai «la più
 * recente», mai «l'ultima inserita», mai un criterio che potrebbe pescare
 * un dato vero.*
 *
 * ⚠️ QUESTO NON È UN CONTROLLO, È UNA STRADA: `tests/unita/pulizie.test.js`
 * setaccia le forme grossolane, ma un setaccio sul testo non sa da dove
 * viene un identificativo passato dentro una variabile. Qui invece la cosa
 * giusta è **anche la più comoda**, ed è l'unico modo in cui una regola
 * sopravvive a una giornata lunga.
 *
 *   const mie = righeMie(titolare);
 *   const { data } = await titolare.from("customers").insert({...}).select("id").single();
 *   mie.segna("customers", data.id);
 *   ...
 *   await mie.pulisci();     // cancella SOLO quelle, in ordine inverso
 *
 * ⚠️ L'ordine inverso non è un vezzo: le righe figlie sono nate dopo le
 * madri, e cancellare una madre prima dei figli viene respinto dalle
 * chiavi esterne.
 *
 * ⚠️ E se una cancellazione fallisce NON si tace: si solleva, dicendo
 * quale riga è rimasta. Una pulizia che fallisce in silenzio lascia dati
 * di prova in mezzo a quelli veri, ed è la cosa che il §5 punto 8 vieta.
 */
export function righeMie(client) {
  const segnate = [];
  return {
    segna(tabella, id) {
      if (!id) throw new Error(`righeMie: «${tabella}» segnata senza identificativo.`);
      segnate.push({ tabella, id });
      return id;
    },
    /** Quante righe questa prova sa di aver creato. */
    quante: () => segnate.length,
    async pulisci() {
      const rimaste = [];
      for (const { tabella, id } of [...segnate].reverse()) {
        const { error } = await client.from(tabella).delete().eq("id", id);
        if (error) rimaste.push(`${tabella}/${id}: ${error.message}`);
      }
      segnate.length = 0;
      if (rimaste.length > 0) {
        throw new Error(
          "La pulizia non è riuscita a togliere tutto quello che aveva creato:\n  " +
            rimaste.join("\n  ")
        );
      }
    },
  };
}
