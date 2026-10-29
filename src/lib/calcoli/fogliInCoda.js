// UN FOGLIO DELLA CUCINA E I SUOI LAVORI NELLA CODA — modulo PURO (29/10/2026).
//
// La pagina Cucina disegna i fogli con `bigliettiCucina` (turni.js); il
// database accoda un lavoro per ogni invio (migrazione 20261029000001).
// Non sono sempre uno a uno: due invii che la cucina non ha ancora avuto
// sono un foglio solo a schermo e due lavori nella coda. Qui si decide
// cosa dire di quel foglio, ed è puro perché si deve poter provare senza
// browser e senza chiavi.
//
// 🔴 IL CASO PEGGIORE VINCE. Se uno dei lavori del foglio non è uscito,
//    il foglio non è uscito: dire «in coda» perché l'altro aspetta
//    sarebbe dire alla cucina di aspettare una carta che non arriverà.
// ⚠️ E una riga che nessun lavoro porta vuol dire «non è in coda»: è il
//    foglio da mandare (o da stampare da qui), anche se il resto aspetta.

const GRAVITÀ = ["fallito", "incerto", "in_corso", "in_coda", "stampato"];

/** I lavori (non annullati) che portano questo foglio. */
export function lavoriDelFoglio(g, lavori = []) {
  const vivi = (lavori ?? []).filter((l) => l.stato !== "annullato");
  if (g.tipo === "chiamata") return vivi.filter((l) => l.tipo === "chiamata" && l.chiamata_id === g.id);
  const ids = new Set((g.items ?? []).map((i) => i.id));
  return vivi.filter((l) => l.tipo === "comanda" && (l.righe ?? []).some((id) => ids.has(id)));
}

/**
 * Come sta il foglio nella coda.
 * @returns {{stato: "fuori"|"fallito"|"incerto"|"in_corso"|"in_coda"|"stampato", errore: string|null}}
 */
export function lavoroDelFoglio(g, lavori = []) {
  const suoi = lavoriDelFoglio(g, lavori);
  if (suoi.length === 0) return { stato: "fuori", errore: null };

  // Per ogni riga conta il lavoro più recente: uno fallito e poi
  // rimandato non è più fallito.
  const ultimi = new Map();
  for (const l of [...suoi].sort((a, b) => new Date(a.creato_il) - new Date(b.creato_il))) {
    for (const chiave of g.tipo === "chiamata" ? [l.chiamata_id] : l.righe ?? []) ultimi.set(chiave, l);
  }
  const peggiore = [...new Set(ultimi.values())].sort(
    (a, b) => GRAVITÀ.indexOf(a.stato) - GRAVITÀ.indexOf(b.stato)
  )[0];

  // 🔴 Un incerto o un fallito si dice PRIMA di «non è in coda»: con
  //    «Mandalo alla stampante» si sostituirebbe un incerto senza che
  //    nessuno abbia guardato la carta (revisione, 29/10).
  if (["fallito", "incerto"].includes(peggiore.stato)) return { stato: peggiore.stato, errore: peggiore.errore ?? null };

  if (g.tipo !== "chiamata") {
    const portate = new Set(suoi.flatMap((l) => l.righe ?? []));
    if ((g.items ?? []).some((i) => !portate.has(i.id))) return { stato: "fuori", errore: null };
  }
  return { stato: peggiore.stato, errore: peggiore.errore ?? null };
}
