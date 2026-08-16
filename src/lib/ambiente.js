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
