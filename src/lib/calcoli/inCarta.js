// COSA IMPEDISCE A UN PIATTO DI ANDARE IN CARTA — 30/08/2026.
//
// 🔴 PERCHÉ ESISTE. Alessio, guardando una ricetta creata trenta secondi
// prima: *«compare in ROSSO "Questo finger non ha ancora un food cost".
// Vero ma ovvio.»* La sua decisione: **l'avviso resta, ma non è rosso
// mentre inventi il piatto; diventa rosso e bloccante quando provi a
// mandarlo in carta.** *Un piatto senza food cost è un problema il giorno
// che va sul menu, non il giorno che lo inventi.*
//
// ⚠️ IL POSTO GIUSTO NON È LA SCHEDA: sono DUE. Un piatto entra in carta
// dalla striscia degli stati **e** dall'Editor Menu, e un freno messo su
// una porta sola è teatro — è la trappola misurata il 26/08 sul modulo
// voce. Qui la regola sta in un posto e le due porte la domandano.
//
// 🔴 E NON STA NEL DATABASE, che sarebbe il posto naturale in questo
// progetto. La ragione è una MISURA fatta prima di scriverlo: in
// produzione c'è **un menu attivo con 14 piatti** e **zero righe di
// ricetta**, quindi tutti e quattordici i piatti in carta oggi non hanno
// food cost. Un vincolo del database rifiuterebbe lo stato in cui il
// gestionale si trova adesso, e un guardiano che rifiuta il presente è un
// guardiano che si spegne. Quando ci saranno gli ingredienti, questa
// regola può diventare un trigger senza cambiare una parola: è già scritta
// come una domanda sola.

/**
 * Il food cost c'è? — `null`, `undefined` e `0` sono tutti «non ce l'ha».
 * ⚠️ Lo zero qui non è un costo: una ricetta senza righe costa zero e non
 * vuol dire che sia gratis. È la stessa regola del vuoto che non è zero.
 */
export const senzaFoodCost = (costo) =>
  costo == null || Number(costo.food_cost_portion ?? 0) === 0;

/**
 * PERCHÉ QUESTO PIATTO NON PUÒ ANDARE IN CARTA — una frase, o `null`.
 *
 * ⚠️ Restituisce la frase e non un booleano, apposta: un pulsante spento
 * senza il perché insegna a diffidare dei pulsanti (17/08). E la frase
 * nomina **cosa fare prima**, altrimenti è un vicolo cieco.
 */
export function perchePuoNonAndareInCarta(recipe, costo) {
  if (!senzaFoodCost(costo)) return null;
  return `${nome(recipe)} non ha ancora un food cost: senza, non si può sapere quanto ci si guadagna. Aggiungi gli ingredienti, oppure tienilo in un menu non in servizio finché lo stai provando.`;
}

/**
 * La stessa cosa in corto, per stare dentro una riga di elenco.
 */
export function senzaFoodCostInBreve(costo) {
  return senzaFoodCost(costo) ? " — non ha ancora un food cost" : "";
}

const nome = (r) => {
  if (r?.recipe_type === "finger") return "Questo finger";
  if (r?.recipe_type === "preparazione") return "Questa preparazione";
  if (r?.category === "finger_food") return "Questa selezione";
  return "Questo piatto";
};
