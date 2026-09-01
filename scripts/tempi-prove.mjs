// I TEMPI DELLA BONIFICA — un posto solo, leggibile anche da `node` nudo
// (01/09/2026)
//
// 🔴 PERCHE' NON STANNO IN `tests/app/aiuto.js`. Ci stavano, e il
//    programma che impone il tetto (`scripts/prove-app.mjs`) li importava
//    da li'. Ma `aiuto.js` legge `import.meta.env`, che esiste sotto Vite
//    e **non esiste in node**: lanciato senza `VITE_SUPABASE_URL`
//    nell'ambiente — cioe' esattamente com'e' fatta la pipeline — il
//    programma moriva prima di far partire una sola prova.
//
// ⚠️ E NON SI VEDEVA COL COLLAUDO SBAGLIATO: con la variabile presente,
//    `process.env.VITE_SUPABASE_URL || import.meta.env...` si ferma a
//    sinistra e non tocca mai il ramo rotto. L'ha trovato la baseline,
//    che gira con l'ambiente ripulito come quello di GitHub.
//
// Qui dentro non si importa niente: e' la condizione perche' questo file
// valga in tutti e due i mondi.

/**
 * Quanto aspettare prima di considerare abbandonata una riga di prova.
 * Vedi la nota estesa in `tests/app/aiuto.js`.
 */
export const MINUTI_DI_GRAZIA = 45;

/** Il tetto di tempo di UN GIRO DI PROVE, anche lanciato a mano. */
export const MINUTI_MASSIMI_DI_UN_GIRO = 40;

/** L'istante prima del quale una riga di prova non e' piu' di nessun giro vivo. */
export const nonDiNessuno = () =>
  new Date(Date.now() - MINUTI_DI_GRAZIA * 60_000).toISOString();
