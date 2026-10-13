import { normalizza } from "./domande";

// DOVE È FINITO UN LOTTO — 12/10/2026 (N6)
//
// Le parole e l'ordine delle righe restituite da `dove_e_finito_il_lotto`
// (migrazione 20261012000001). Stanno qui, e non nella schermata, perché
// la prova pura le possa tenere ferme: un tipo nuovo che il database
// restituisse senza parola comparirebbe a schermo come un codice.

const PAROLE = {
  conto: "Servito",
  produzione: "Usato per preparare",
  consumo: "Uscito dal magazzino",
  spreco: "Buttato",
  reso: "Reso al fornitore",
  vitto: "Pasti del personale",
  rettifica: "Rettifica",
  senza_movimento: "Sceso senza movimento",
  non_annotato: "Uscito prima del 12/10/2026",
};

export function parolaUscita(tipo) {
  return PAROLE[tipo] ?? "Uscita";
}

// ⚠️ Le righe «non annotate» vanno IN FONDO a ogni livello e non dove
//    capita: sono il vuoto dichiarato, e in mezzo alle altre sembrerebbero
//    una destinazione come le altre.
export function righeInOrdine(righe) {
  return [...(righe ?? [])].sort((a, b) => {
    if (a.livello !== b.livello) return a.livello - b.livello;
    const va = a.tipo === "non_annotato" ? 1 : 0;
    const vb = b.tipo === "non_annotato" ? 1 : 0;
    if (va !== vb) return va - vb;
    return String(a.quando ?? "").localeCompare(String(b.quando ?? ""));
  });
}

// Quanto della merce uscita il gestionale sa dire dove è andata, al primo
// livello (il lotto chiesto). Serve alla frase in cima: «di 3 kg usciti,
// 2 sono annotati». Al livello più profondo le quantità sono di ALTRI
// lotti, e sommarle a queste mescolerebbe unità e prodotti diversi.
export function contoDelLotto(righe) {
  let annotato = 0;
  let nonAnnotato = 0;
  for (const r of righe ?? []) {
    if (r.livello !== 0) continue;
    if (r.tipo === "non_annotato") nonAnnotato += Number(r.quantita) || 0;
    else annotato += Number(r.quantita) || 0;
  }
  return { annotato, nonAnnotato };
}

// LA RICERCA FRA I LOTTI — 13/10/2026, chiesta da Alessio provando la
// pagina: con tanti lotti non c'era modo di trovare il proprio. Davanti a
// un richiamo si parte da un PRODOTTO, da un FORNITORE o da un NUMERO DI
// LOTTO, quindi si cerca in tutti e tre.
// ⚠️ Senza accenti e senza maiuscole (`normalizza`, la stessa regola del
//    MEMO): «Calamaro» si trova scrivendo «calamaro», e un lotto «a7-12»
//    scrivendo «A7 12». Più parole devono esserci TUTTE, in qualunque campo:
//    «calamaro mulino» trova il calamaro di quel fornitore.
export function filtraLotti(lotti, testo) {
  const parole = normalizza(testo).split(" ").filter(Boolean);
  if (parole.length === 0) return lotti ?? [];
  return (lotti ?? []).filter((l) => {
    const dove = normalizza(
      [l.ingredient?.name, l.supplier?.name, l.supplier_batch_number].filter(Boolean).join(" ")
    );
    return parole.every((p) => dove.includes(p));
  });
}
