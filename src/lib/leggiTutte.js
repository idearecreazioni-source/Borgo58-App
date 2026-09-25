// =====================================================================
// LEGGERE UN ELENCO INTERO, A PAGINE — 26/09/2026
// =====================================================================
// 🔴 PERCHÉ ESISTE. Il progetto Supabase consegna al massimo mille righe
//    per richiesta («Max rows»), senza nessun errore. Il punto unico delle
//    letture (`supabase.js`) se ne accorge e accende l'avviso, ma l'avviso
//    dice soltanto che manca qualcosa. Misurato il 26/09 sul progetto di
//    prova: 1388 prodotti, 1000 consegnati, e fra quelli esclusi c'erano
//    undici prodotti veri — «Tonno rosso» non si poteva scegliere in una
//    ricetta.
//
// ⚠️ COME FUNZIONA. `crea()` costruisce ogni volta la stessa lettura da
//    capo (un costruttore di supabase-js si usa una volta sola), e deve
//    chiedere il conteggio: `.select(colonne, { count: "exact" })`. Qui si
//    chiedono le pagine una dopo l'altra finché le righe raccolte arrivano
//    al totale dichiarato dal database.
//
// ⚠️ SI AVANZA DI QUANTE RIGHE SONO ARRIVATE, non di quante se ne sono
//    chieste: se il tetto del progetto fosse più basso del passo, avanzare
//    del passo salterebbe le righe in mezzo **senza nessun errore** — la
//    stessa forma del difetto che questo file chiude.
//
// ⚠️ L'ORDINE DEVE ESSERE STABILE, o fra una pagina e l'altra una riga si
//    ripete e un'altra sparisce. Chi chiama ordina per una colonna che non
//    si ripete (in coda, dopo l'ordine voluto: di solito `id`).
//
// ⚠️ Se il conteggio manca, è un errore di chi chiama, e si dice subito:
//    senza il totale non si sa quando fermarsi, e fermarsi alla prima
//    pagina corta rifarebbe il difetto con un tetto più basso.

export const PASSO_LETTURA = 1000;

export async function leggiTutte(crea, { passo = PASSO_LETTURA } = {}) {
  const righe = [];
  for (;;) {
    const { data, error, count } = await crea().range(righe.length, righe.length + passo - 1);
    if (error) throw error;
    if (typeof count !== "number") {
      throw new Error(
        'leggiTutte: la lettura non ha chiesto il conteggio — serve .select(colonne, { count: "exact" })',
      );
    }
    const pagina = data ?? [];
    righe.push(...pagina);
    // Una pagina vuota prima del totale vuol dire che l'elenco si è
    // accorciato mentre lo si leggeva: ci si ferma su quello che c'è,
    // invece di chiedere pagine vuote per sempre.
    if (pagina.length === 0 || righe.length >= count) return righe;
  }
}
