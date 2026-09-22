// LA RESA SULLA RIGA DI RICETTA — R12, 22/09/2026.
//
// 🔴 LA DECISIONE, di Alessio, del 14/08/2026: **lo scarto non appartiene
//    all'ingrediente, appartiene alla coppia ingrediente × ricetta.** Le
//    stesse cozze scartano pochissimo per un'impepata e moltissimo se se ne
//    ricava il mollusco: un numero unico sulla scheda del prodotto non
//    descrive nessuno dei due casi e ne precompila uno sbagliato.
//
// 🔴 E SI SCRIVE IN LORDO → NETTO, non in percentuale: «1,5 kg di cozze
//    danno 400 g» è come ragiona un cuoco, ed è leggibile fra sei mesi. La
//    percentuale si **mostra**, non si scrive.
//
// ---------------------------------------------------------------------
// ⚠️ DUE PERCENTUALI DIVERSE, E VANNO TENUTE DISTINTE
// ---------------------------------------------------------------------
// È la confusione che ha prodotto la frase falsa del 24/08 (vedi la
// migrazione `20260922000001`):
//
//    lo SCARTO = (lordo / netto - 1) × 100   → 1,5 su 0,4 fa 275
//    la RESA   = (netto / lordo)     × 100   → 1,5 su 0,4 fa 26,67
//
// Lo **scarto** è quello che il calcolo del costo usa da sempre, e vive nel
// database come **riflesso** dei due numeri. La **resa** è quella che si
// mostra a chi guarda, perché «da un chilo e mezzo ne esce il ventisette per
// cento» si capisce; «lo scarto è il duecentosettantacinque per cento» no.
//
// ⚠️ QUESTO FILE NON E' IL POSTO DOVE VIVE LA REGOLA DEL DATABASE. Il
//    riflesso lo scrive un trigger, e il vincolo «il netto non supera il
//    lordo» è un `check`: una regola nella schermata la aggira chiunque
//    scriva da un'altra porta. Qui si decide **cosa mostrare** e **cosa
//    rifiutare prima di provarci**, per non offrire un gesto che verrebbe
//    respinto.

const numero = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/**
 * La resa: quanta parte del lordo finisce nel piatto, in percentuale.
 *
 * ⚠️ Torna `null` quando non si può dire — non zero. *Assenza di
 *    informazione e informazione di assenza sono due cose diverse* (19/08):
 *    uno zero qui si leggerebbe «non ne resta niente».
 */
export function resaPercento(lordo, netto) {
  const l = numero(lordo);
  const n = numero(netto);
  if (l === null || n === null || l <= 0 || n <= 0) return null;
  return Math.round((n / l) * 1000) / 10;
}

/**
 * Lo scarto in punti, nella forma che il calcolo del costo usa da sempre:
 * il lordo è il netto moltiplicato per (1 + scarto/100).
 *
 * ⚠️ Serve a mostrarlo accanto alla resa quando qualcuno lo cerca, non a
 *    scriverlo: nel database è un riflesso, e scriverlo viene rifiutato.
 */
export function scartoPercento(lordo, netto) {
  const l = numero(lordo);
  const n = numero(netto);
  if (l === null || n === null || n <= 0) return null;
  return Math.round((l / n - 1) * 10000) / 100;
}

/**
 * Quanto lordo serve comprare per avere questo netto.
 *
 * 🔴 E' la domanda della **lista della spesa**, ed è l'altro verso della
 *    stessa riga: la resa dichiarata resta la base per sapere quanto
 *    ordinare (decisione del 14/08). Con la resa di questa riga, per averne
 *    `netto` bisogna prenderne `netto × lordo/netto`.
 *
 * ⚠️ Torna `null` se la riga non dice abbastanza: meglio non rispondere che
 *    rispondere un numero inventato.
 */
export function lordoDaComprare(netto, lordoRiga, nettoRiga) {
  const n = numero(netto);
  const l = numero(lordoRiga);
  const nr = numero(nettoRiga);
  if (n === null || l === null || nr === null || nr <= 0 || l <= 0) return null;
  return (n * l) / nr;
}

// ---------------------------------------------------------------------
// IL VALORE STANDARD DEL PRODOTTO — precompila una volta, poi tace
// ---------------------------------------------------------------------
// 🔴 DECISIONE DI ALESSIO, 22/09/2026, che conferma quella del 25/08: il
//    campo sulla scheda del prodotto RESTA, facoltativo, e serve **solo a
//    precompilare** lordo e netto quando nasce una riga. Dopo, la riga è
//    autonoma e comanda lei.
//
// ⚠️ SOTTO RESTA UNO SCARTO, SOPRA SI LEGGE UNA RESA. Il database conserva
//    `waste_percentage_default` in punti di scarto, perché è la forma che i
//    cinque calcoli usano da sempre. La schermata invece chiede e mostra la
//    **resa** — «da 1 kg ne restano 300 g» — perché una resa si capisce e
//    uno scarto del 275% no. La conversione vive **qui e in nessun altro
//    posto**: due formule per lo stesso numero prima o poi dicono due cose
//    diverse.

/**
 * Da scarto (punti, come sta nel database) a resa (percentuale).
 *
 * ⚠️ Vuoto resta vuoto: *«non lo so»* non è *«non se ne butta niente»*.
 */
export function resaDaScarto(scarto) {
  const s = numero(scarto);
  if (s === null || s < 0) return null;
  return Math.round((100 / (1 + s / 100)) * 10) / 10;
}

/**
 * Da resa (quello che si scrive) a scarto (quello che si conserva).
 *
 * ⚠️ Una resa dev'essere maggiore di zero e non può superare il 100%: da un
 *    chilo non ne escono due. Fuori da lì torna `null`, e chi chiama non
 *    salva — non si salva un numero che il vincolo respingerebbe.
 */
export function scartoDaResa(resa) {
  const r = numero(resa);
  if (r === null || r <= 0 || r > 100) return null;
  return Math.round((100 / r - 1) * 10000) / 100;
}

/**
 * Il lordo da PRECOMPILARE su una riga nuova, dato il netto e lo scarto
 * standard del prodotto.
 *
 * 🔴 Si chiama una volta sola, quando la riga nasce: non è un'eredità. Se
 *    poi Alessio cambia il numero sulla scheda del prodotto, questa riga non
 *    si muove — lo garantisce il database (`waste_percentage` è `not null`,
 *    quindi nessun calcolo torna a pescare il valore del prodotto).
 *
 * ⚠️ Torna `null` quando non c'è niente da proporre, e `null` **non è zero**:
 *    un lordo pari al netto sarebbe la proposta «non si butta niente», che è
 *    una risposta, non un'assenza di risposta.
 */
export function lordoPrecompilato(netto, scartoStandard) {
  const n = numero(netto);
  const s = numero(scartoStandard);
  if (n === null || n <= 0 || s === null || s <= 0) return null;
  return Math.round(n * (1 + s / 100) * 10000) / 10000;
}

/** Come si legge un valore standard: «da 1 kg ne restano 300 g». */
export function comeSiLeggeLoStandard(scartoStandard, unita) {
  const resa = resaDaScarto(scartoStandard);
  if (resa === null) return null;
  const u = unita || "kg";
  const per = Math.round(resa * 10) / 1000;
  return `da 1 ${u} ne restano ${per} ${u} (resa ${resa}%)`;
}

// ---------------------------------------------------------------------
// COSA SI PUO' SCRIVERE
// ---------------------------------------------------------------------
/**
 * Perché questi due numeri non si possono salvare, in italiano.
 *
 * ⚠️ Torna `null` quando vanno bene. Le frasi sono le stesse che il database
 *    direbbe: qui servono a dirle **prima** di provarci, non a sostituire il
 *    vincolo.
 */
export function ragioneNonSalvabile(lordo, netto) {
  const l = numero(lordo);
  const n = numero(netto);
  if (n === null || n <= 0) {
    return "Quanto ne resta dev'essere un numero maggiore di zero: una riga con quantità zero non è un ingrediente.";
  }
  // ⚠️ Il lordo assente non è un errore: vuol dire «non c'è scarto», e il
  //    database lo riempie col netto. È la risposta vera, non un valore
  //    inventato.
  if (l === null) return null;
  if (l <= 0) return "Quanto ne prendi dev'essere un numero maggiore di zero.";
  if (l < n) {
    return "Da quanto ne prendi non può restarne di più: da un chilo di cozze non escono due chili di mollusco. Se una cosa cresce cuocendo — il riso che assorbe l'acqua — quella non è una resa: è la quantità della ricetta.";
  }
  return null;
}

/**
 * Il lordo da salvare: quello scritto, oppure il netto se nessuno lo dice.
 *
 * ⚠️ La stessa regola del trigger, dalla parte della schermata — così il
 *    modulo non manda `null` e poi legge indietro un numero diverso da
 *    quello che ha mostrato.
 */
export function lordoDaSalvare(lordo, netto) {
  const l = numero(lordo);
  const n = numero(netto);
  if (n === null) return null;
  return l === null ? n : l;
}

// ---------------------------------------------------------------------
// LE UNITA'
// ---------------------------------------------------------------------
// ⚠️ LORDO E NETTO STANNO NELLA STESSA UNITA', quella della riga, e non è
//    una semplificazione: sono due pesi della stessa cosa nello stesso
//    momento. Convertirli fra loro non avrebbe senso, e confrontarli in
//    unità diverse sarebbe il difetto che questa funzione esiste per
//    impedire.
//
// ⚠️ La conversione vera — fra l'unità della riga e quella con cui
//    l'ingrediente si compra — esiste già nel database (`unita_conversione`)
//    ed è lì che deve restare: due tabelle di conversione, una in SQL e una
//    in JavaScript, un giorno direbbero due numeri diversi.
export function unitaCoerenti(unitaRiga, unitaLordo) {
  if (!unitaLordo) return true;
  return unitaRiga === unitaLordo;
}

/**
 * Come si legge una riga: «1,5 kg → 400 g netti (27%)».
 *
 * ⚠️ Le parole del modulo, non i codici: si scrive l'unità della riga così
 *    com'è, perché è quella che l'utente ha scelto.
 */
export function comeSiLegge(riga) {
  const l = numero(riga?.quantita_lorda);
  const n = numero(riga?.quantity);
  const u = riga?.unit ?? "";
  if (n === null) return null;
  if (l === null || l === n) return `${n} ${u}`.trim();
  const resa = resaPercento(l, n);
  return `${l} ${u} → ${n} ${u} netti${resa === null ? "" : ` (${resa}%)`}`.trim();
}
