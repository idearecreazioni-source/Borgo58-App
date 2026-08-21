// A quale database è collegato quello che sto guardando.
//
// ⚠️ Serve perché dal 16/08/2026 il gestionale si può puntare al progetto
// di prova (`npm run dev:prova`), e da quel momento esiste un modo nuovo
// di sbagliare che prima non c'era: **scrivere dati finti nel locale
// vero**, o credere finto un dato che è vero. Nessuno dei due si vede
// guardando la schermata — sono identiche.
//
// La regola scelta: **si dichiara sempre**, in tutte e due le direzioni.
// Un avviso che compare solo sul progetto di prova protegge solo chi si
// ricorda che quell'avviso esiste; qui il caso pericoloso — sto sul vero
// e credo di stare sulla prova — ha un segno suo.
//
// Il riferimento del progetto è la parte dell'indirizzo che Supabase dà a
// ogni progetto: sta nell'indirizzo del database, quindi si legge senza
// chiedere niente a nessuno.

/** Il progetto del locale. Gli stessi valori vivono in scripts/comune.mjs. */
export const RIFERIMENTO_PRODUZIONE = "oudjuqbqszisdtwzbxdo";
export const RIFERIMENTO_PROVA = "bnwqgpuyzmzujxfbtyvs";

/**
 * Che database è, dato il suo indirizzo. Funzione pura: si prova senza
 * bisogno di un browser e senza bisogno di un database.
 */
export function ambienteDa(url) {
  const riferimento = String(url ?? "").match(/https?:\/\/([a-z0-9-]+)\.supabase\./i)?.[1] ?? "";

  if (!riferimento) {
    return { riferimento: "", produzione: false, genere: "sconosciuto", nome: "nessun database" };
  }
  if (riferimento === RIFERIMENTO_PRODUZIONE) {
    return { riferimento, produzione: true, genere: "produzione", nome: "il locale vero" };
  }
  if (riferimento === RIFERIMENTO_PROVA) {
    return { riferimento, produzione: false, genere: "prova", nome: "il database di prova" };
  }
  // ⚠️ Un terzo database non è «probabilmente la prova»: è un database
  // che nessuno ha dichiarato, e va trattato come tale.
  return { riferimento, produzione: false, genere: "sconosciuto", nome: "un database sconosciuto" };
}

/** Quello a cui è collegata QUESTA copia dell'app. */
export function ambienteCorrente() {
  return ambienteDa(import.meta.env.VITE_SUPABASE_URL);
}

// =====================================================================
// LE PAGINE CHE VEDONO I CLIENTI
// =====================================================================
// 🔴 TROVATO IL 21/08 aprendo borgo58.it/prenota: in cima al modulo con cui
// un cliente prenota un tavolo campeggiava **«DATI VERI — quello che scrivi
// qui conta davvero»**. Misurato che si vedeva per davvero: visibile, opaco,
// alto 17 punti, a 9 punti dal bordo.
//
// ⚠️ E ERA VOLUTO: il commento in `App.jsx` diceva *«vale anche sulla pagina
// pubblica»*. La ragione era buona — il segnale sta fuori dal Layout perché
// le Comande e il modulo pubblico non lo usano — ma **ha portato con sé un
// destinatario che non c'entra**.
//
// Il segnale serve a chi **scrive nel gestionale**, per sapere se quello che
// scrive è vero. Un cliente che prenota un tavolo non scrive nel gestionale:
// manda una richiesta. Per lui quella frase non vuol dire niente, e nel
// migliore dei casi è rumore tecnico sul sito del ristorante.
//
// ⚠️ L'elenco vive QUI e non dentro il segnale, perché la domanda *«questa
// pagina la vede un cliente?»* tornerà: ogni pagina nuova aperta al pubblico
// dovrà comparire in questo elenco, e il posto per cercarlo è uno solo.
export const PAGINE_DEI_CLIENTI = ["/prenota", "/privacy"];

/**
 * Questa pagina la vede un cliente?
 *
 * ⚠️ La pagina di accesso NON è fra queste, ed è voluto: chi digita il PIN
 * sta per scrivere nel gestionale, ed è il momento in cui sapere su quale
 * database si sta entrando conta di più.
 */
export function paginaDeiClienti(percorso = "") {
  return PAGINE_DEI_CLIENTI.some((p) => percorso === p || percorso.startsWith(p + "/"));
}
