// LA CARTA DEI VINI COME SI STAMPA (N19, 11/10/2026).
//
// 🔴 UNA BOTTIGLIA PUÒ STARE IN CARTA DUE VOLTE — al calice e in bottiglia —
//    perché una riga di carta non è un prodotto di magazzino. Sul foglio però
//    il cliente legge UN vino con due prezzi: qui le righe con lo stesso nome
//    e lo stesso produttore, nella stessa categoria, diventano una riga sola
//    coi suoi formati. Il dato resta di due righe; cambia solo come si stampa.
// ⚠️ Solo le voci IN CARTA: una voce tolta non si stampa.

const chiave = (s) => (s ?? "").trim().toLowerCase();

/** categorie: [{ nome, voci: [{ name, producer, serving, selling_price, active }] }] */
export function cartaDaStampare(categorie = []) {
  return categorie
    .map((cat) => {
      const righe = new Map();
      for (const v of cat.voci ?? []) {
        if (!v.active) continue;
        const k = `${chiave(v.name)}|${chiave(v.producer)}`;
        if (!righe.has(k)) righe.set(k, { nome: v.name, produttore: v.producer || null, formati: [] });
        righe.get(k).formati.push({ formato: v.serving || null, prezzo: v.selling_price });
      }
      return { nome: cat.nome, righe: [...righe.values()] };
    })
    .filter((c) => c.righe.length > 0);
}
