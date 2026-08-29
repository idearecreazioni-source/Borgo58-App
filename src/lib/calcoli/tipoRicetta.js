// CHE COS'È QUESTA RICETTA — 30/08/2026, blocco 1 del mandato.
//
// 🔴 PERCHÉ ESISTE, e il difetto che chiude. Alessio ha aperto una ricetta
// di tipo **finger** e ci ha trovato dentro una sezione «Finger» con
// «Cerca un finger…» — cioè un finger che cerca sé stesso — e più sotto il
// titolo «Dove è usata questa PREPARAZIONE», che è la parola di un altro
// tipo. Due difetti diversi a vedersi, **una sola radice**: le due domande
// che la scheda faceva erano tutt'e due più larghe del vero.
//
//   · «è un piatto composto da finger?» si chiedeva alla sola CATEGORIA
//     (`category = 'finger_food'`) — ed è vera anche su un finger singolo
//     che Alessio ha messo in quella categoria. Misurato sul progetto di
//     prova: **una** ricetta è in quello stato, ed è esattamente quella
//     della sua schermata;
//   · «di che tipo parlo?» si chiedeva a `recipe_type !== 'piatto_finito'`,
//     che mette preparazioni e finger nello stesso sacco — e infatti li
//     chiamava tutt'e due «preparazione».
//
// ⚠️ LA RISPOSTA VIVE QUI E NON NELLE SCHERMATE, perché i posti che se la
// chiedono sono cinque (la scheda, l'elenco, il modulo di creazione, la
// scheda dello staff, l'Editor Menu) e cinque copie divergono alla prima
// modifica. È la stessa forma di `orderTotals()` e di `pianta_del_giorno`.

/**
 * UN PIATTO COMPOSTO DA FINGER — quello che Alessio chiama «selezione».
 *
 * ⚠️ SERVONO TUTT'E DUE LE CONDIZIONI, e la seconda da sola era il difetto:
 * è un **piatto finito** (quindi qualcosa che si vende come tale) **e** sta
 * nella categoria dei finger food (quindi è composto di bocconcini). Un
 * finger singolo messo in quella categoria resta un finger.
 */
export const eSelezione = (r) =>
  r?.recipe_type === "piatto_finito" && r?.category === "finger_food";

/** Un bocconcino singolo: si compone e basta, non si produce a dosi. */
export const eFingerSingolo = (r) => r?.recipe_type === "finger";

/** Un semilavorato: si produce a dosi, ha una resa, va in Produzioni. */
export const ePreparazione = (r) => r?.recipe_type === "preparazione";

/**
 * COME SI CHIAMA QUESTA COSA, in italiano e col suo articolo.
 *
 * ⚠️ Le tre forme servono davvero tutte: una frase dice «questo finger»,
 * un titolo dice «il finger», un elenco dice «finger». Ricavarle a mano
 * ogni volta è come sono nate le parole sbagliate che questo file toglie.
 */
const PAROLE = {
  piatto_finito: { nudo: "piatto", questo: "questo piatto", il: "il piatto" },
  preparazione: { nudo: "preparazione", questo: "questa preparazione", il: "la preparazione" },
  finger: { nudo: "finger", questo: "questo finger", il: "il finger" },
};

export function parolaTipo(recipe, forma = "questo") {
  // ⚠️ Una selezione è un piatto finito, ma chiamarla «piatto» dove serve
  // distinguerla dagli altri sarebbe più largo del vero: ha parole sue.
  if (eSelezione(recipe)) {
    return { nudo: "selezione", questo: "questa selezione", il: "la selezione" }[forma];
  }
  return PAROLE[recipe?.recipe_type]?.[forma] ?? PAROLE.piatto_finito[forma];
}

/**
 * IL RIQUADRO «DOVE FINISCE QUESTA COSA» — titolo e frase del caso vuoto.
 *
 * 🔴 È il posto in cui Alessio ha letto «Dove è usata questa PREPARAZIONE»
 * stando su un finger. Le due frasi stanno insieme perché devono
 * concordare fra loro: cambiare il titolo e lasciare il vuoto al femminile
 * rifarebbe lo stesso difetto un rigo più sotto.
 */
export function doveFinisce(recipe) {
  if (eFingerSingolo(recipe)) {
    return {
      titolo: "In quali selezioni sta questo finger",
      vuoto: "Non ancora messo in nessuna selezione.",
    };
  }
  return {
    titolo: "Dove è usata questa preparazione",
    vuoto: "Non ancora usata come componente in altre ricette.",
  };
}

/**
 * QUALE PORTA APRE QUESTA RICETTA — serve al ritorno indietro e al modulo
 * di creazione, che dal 30/08 non chiede più il tipo: lo eredita dal posto
 * da cui si entra.
 */
export function portaDi(recipe) {
  if (eFingerSingolo(recipe) || eSelezione(recipe)) return "finger";
  if (ePreparazione(recipe)) return "preparazione";
  return "piatto_finito";
}
