// CHI PUÒ ANDARE IN UN MENU — 20/08/2026, decisione di Alessio:
// «le preparazioni non devono stare nell'elenco del menu, ci devono stare
// solo i piatti taggati pronti per la carta».
//
// ⚠️ IL CRITERIO CHIEDE UNA PROPRIETÀ, NON ELENCA I TIPI, ed è la forma che
// si difende da sola: «restano i piatti pronti per la carta» invece di
// «togliamo i tipi che non servono». Un tipo nuovo domani non ricompare dove
// non deve, perché non c'è nessun elenco da ricordarsi di aggiornare — è la
// stessa cura fatta lo stesso giorno sulla colonna delle porzioni
// nell'elenco delle ricette.
//
// ⚠️ E LE DUE METÀ DEL CRITERIO STANNO IN DUE POSTI DIVERSI, apposta:
//   · **«è un piatto»** è un invariante — una preparazione dentro un menu è
//     un errore di categoria — e vive nel DATABASE (trigger
//     `solo_piatti_in_menu`, migrazione 20260820000002). Questo file non è
//     la difesa: è la cortesia di non proporre ciò che verrebbe respinto.
//   · **«è pronto per la carta»** è una condizione di maturità che cambia
//     nel tempo, e vive SOLO qui. Un vincolo la renderebbe una gabbia:
//     togliere il segno «pronta» a un piatto che sta in un menu in bozza
//     verrebbe respinto, e non è una cosa che qualcuno ha deciso.
export function puoAndareInCarta(ricetta) {
  if (!ricetta) return false;
  return ricetta.recipe_type === "piatto_finito" && ricetta.pronta_per_carta === true;
}
