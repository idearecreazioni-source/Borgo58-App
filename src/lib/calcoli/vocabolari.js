// Dove il gestionale ridice un elenco chiuso del database, e perché.
//
// ⚠️ IL PROBLEMA, terza ricomparsa in due giorni: un vocabolario chiuso vive
// in **tre** posti che devono restare d'accordo, e nessuno controllava che
// lo fossero.
//   1. il database decide (un tipo `enum` o un vincolo `check`);
//   2. una funzione ridice l'elenco, per dare un messaggio leggibile invece
//      di un errore di vincolo;
//   3. questo file di etichette italiane riempie il menu a tendina.
//
// E i tre sbagliano in modi diversi. Fra 1 e 2 l'errore è **rumoroso ma
// incomprensibile** (16/08 gli scarichi, 17/08 i metodi di pagamento). Fra 1
// e 3, se il JavaScript è più STRETTO l'errore è **silenzioso** — un valore
// legittimo non si può scegliere e nessuno lo scopre; se è più LARGO, il
// salvataggio fallisce sull'unica persona che ci prova. È quest'ultimo il
// caso trovato costruendo la rete: «Assegno», aggiunto il 17/08 ai metodi di
// pagamento, compariva anche nel menu della lista della spesa, dove il
// database ammette solo contante, bonifico e carta.
//
// ⚠️ PERCHÉ UNA RETE E NON UN «RIFLESSO». La regola del 16/08 dice che
// quando due posti direbbero la stessa cosa il secondo va reso un riflesso
// del primo, invece di costruirgli un guardiano. Qui non si applica, e il
// perché va scritto: i tre posti **non dicono la stessa cosa**. Il database
// dice *quali valori sono legali*; questo file dice *come si scrivono in
// italiano*, e un'etichetta italiana è roba della schermata. Ciò che si
// sovrappone è solo l'insieme delle chiavi — e su quello serve un guardiano.
//
// La rete è `tests/app/vocabolari.test.js`, e legge gli elenchi veri dal
// database (`vocabolari_chiusi()`, `guardie_vocabolario()`).

import {
  ALLERGENS,
  CASH_DIRECTIONS,
  CASH_DOCUMENT_TYPES,
  CLEANING_FREQUENCIES,
  COMPLIANCE_DOC_TYPES,
  CONSUMPTION_REASONS,
  CONTRACT_TYPES,
  COOKING_TECHNIQUES,
  CROP_STATUSES,
  DISCOUNT_GIFT_TYPES,
  EMPLOYEE_STATUSES,
  FISCAL_PAYMENT_METHODS,
  FISCAL_TOOL_CATEGORIES,
  FISCAL_TOOL_STATUSES,
  LEAVE_TYPES,
  MONTHS,
  NC_CATEGORIES,
  ORDER_DESTINATIONS,
  ORDER_PAYMENT_METHODS,
  ESITI_RIGA_LISTA,
  PAYMENT_METHODS,
  PEST_CONTROL_TYPES,
  LINEE_PREVISIONE,
  FORME_LINEA,
  RECIPE_CATEGORIES,
  RECIPE_TYPES,
  RESERVATION_STATUSES,
  RESERVATION_TYPES,
  SEASONS,
  STEP_PHASES,
  STORAGE_TYPES,
  SUPPLIER_CATEGORIES,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TASK_RICORRENZE,
  TASK_STATUSES,
  TIP_MEZZI,
  UNITS,
  VIDEO_PLATFORMS,
} from "../constants";

// Ogni elenco di etichette dichiara QUALE colonna rispecchia. Il nome della
// costante è scritto a mano perché finisca nel messaggio di una prova rossa:
// «PAYMENT_METHODS non combacia» si legge, «la riga 14 non combacia» no.
// 🔴 «INGREDIENT_CATEGORIES» NON È PIÙ IN QUESTO ELENCO (27/08/2026), e va
// detto perché togliere una riga da una rete somiglia a indebolirla.
//
// Le categorie degli ingredienti sono diventate DATI — la tabella
// `categorie_ingrediente` — e il gestionale non le ridice più: le LEGGE
// (`listCategorieIngrediente()`). Quindi il disaccordo che questa rete
// sorveglia **non può più esistere**: non ci sono due elenchi da tenere
// d'accordo, ce n'è uno.
//
// ⚠️ Lasciarla qui avrebbe fatto il contrario di sorvegliare: il primo
// giorno in cui Alessio aggiunge una categoria, la prova sarebbe diventata
// ROSSA per un gesto legittimo — un allarme falso, cioè il modo in cui una
// rete viene spenta.
//
// ⚠️ Al suo posto c'è una prova che impedisce di rimettere un elenco statico
// in `constants.js`, in `tests/unita/vocabolari.test.js`: senza, fra sei mesi
// qualcuno lo riscrive credendo di sistemare qualcosa.
export const SPECCHIATI = [
  { costante: "UNITS", valori: UNITS, tabella: "ingredients", colonna: "unit" },
  { costante: "STORAGE_TYPES", valori: STORAGE_TYPES, tabella: "ingredients", colonna: "storage_type" },
  { costante: "MONTHS", valori: MONTHS, tabella: "ingredients", colonna: "seasonality" },
  { costante: "ALLERGENS", valori: ALLERGENS, tabella: "ingredients", colonna: "allergens" },
  { costante: "SUPPLIER_CATEGORIES", valori: SUPPLIER_CATEGORIES, tabella: "suppliers", colonna: "category" },
  { costante: "RECIPE_CATEGORIES", valori: RECIPE_CATEGORIES, tabella: "recipes", colonna: "category" },
  { costante: "LINEE_PREVISIONE", valori: LINEE_PREVISIONE, tabella: "scenario_linee_accessorie", colonna: "codice" },
  { costante: "FORME_LINEA", valori: FORME_LINEA, tabella: "scenario_linee_accessorie", colonna: "forma" },
  { costante: "RECIPE_TYPES", valori: RECIPE_TYPES, tabella: "recipes", colonna: "recipe_type" },
  { costante: "SEASONS", valori: SEASONS, tabella: "recipes", colonna: "seasonality" },
  { costante: "VIDEO_PLATFORMS", valori: VIDEO_PLATFORMS, tabella: "recipe_videos", colonna: "platform" },
  { costante: "STEP_PHASES", valori: STEP_PHASES, tabella: "recipe_steps", colonna: "phase" },
  { costante: "COOKING_TECHNIQUES", valori: COOKING_TECHNIQUES, tabella: "recipe_steps", colonna: "technique" },
  { costante: "CONSUMPTION_REASONS", valori: CONSUMPTION_REASONS, tabella: "stock_consumptions", colonna: "reason" },
  { costante: "TIP_MEZZI", valori: TIP_MEZZI, tabella: "tips_collected", colonna: "mezzo" },
  // 🔴 I DUE METODI DI PAGAMENTO SONO TORNATI UNO, il 19/08 (decisione di
  // Alessio). Il 17/08 erano stati separati perché la lista della spesa
  // rifiutava l'assegno, e la separazione era giusta *allora*: quella
  // schermata non sapeva cosa farsene del mezzo — lo registrava e non ne
  // conseguiva niente. Da quando la chiusura scrive un'uscita vera in prima
  // nota, «con che cosa hai pagato» ha la stessa risposta in tutte e due, e
  // lo stesso elenco copre due tabelle.
  // ⚠️ La rete resta, e adesso sorveglia entrambe: se qualcuno riseparasse
  // i vincoli, una delle due righe qui sotto diventerebbe rossa.
  { costante: "PAYMENT_METHODS", valori: PAYMENT_METHODS, tabella: "supplier_invoices", colonna: "payment_method" },
  { costante: "PAYMENT_METHODS", valori: PAYMENT_METHODS, tabella: "shopping_list_items", colonna: "payment_method" },
  { costante: "ESITI_RIGA_LISTA", valori: ESITI_RIGA_LISTA, tabella: "shopping_list_items", colonna: "esito" },
  { costante: "CLEANING_FREQUENCIES", valori: CLEANING_FREQUENCIES, tabella: "haccp_cleaning_tasks", colonna: "frequency" },
  { costante: "PEST_CONTROL_TYPES", valori: PEST_CONTROL_TYPES, tabella: "haccp_pest_control_logs", colonna: "type" },
  { costante: "NC_CATEGORIES", valori: NC_CATEGORIES, tabella: "haccp_non_conformities", colonna: "category" },
  { costante: "CASH_DIRECTIONS", valori: CASH_DIRECTIONS, tabella: "cash_movements", colonna: "direction" },
  { costante: "CASH_DOCUMENT_TYPES", valori: CASH_DOCUMENT_TYPES, tabella: "cash_movements", colonna: "tipo_documento" },
  { costante: "DISCOUNT_GIFT_TYPES", valori: DISCOUNT_GIFT_TYPES, tabella: "discounts_gifts", colonna: "type" },
  { costante: "ORDER_DESTINATIONS", valori: ORDER_DESTINATIONS, tabella: "order_items", colonna: "destination" },
  {
    costante: "ORDER_PAYMENT_METHODS",
    valori: ORDER_PAYMENT_METHODS,
    tabella: "orders",
    colonna: "payment_method",
    // ⚠️ Il database ne ha uno in più — «misto» — e NON va offerto: è un
    // riflesso, lo scrive un trigger quando il conto si chiude con più di
    // una forma di pagamento (16/08). Offrirlo vorrebbe dire lasciar
    // scrivere a mano un valore che il database calcola da sé.
    inPiuNelDatabase: ["misto"],
    perche: "«misto» è un riflesso scritto dal trigger delle quote, non una scelta di chi chiude il conto",
  },
  { costante: "FISCAL_PAYMENT_METHODS", valori: FISCAL_PAYMENT_METHODS, tabella: "deductible_expenses", colonna: "payment_method" },
  { costante: "FISCAL_TOOL_CATEGORIES", valori: FISCAL_TOOL_CATEGORIES, tabella: "fiscal_tools", colonna: "category" },
  { costante: "FISCAL_TOOL_STATUSES", valori: FISCAL_TOOL_STATUSES, tabella: "fiscal_tools", colonna: "status" },
  { costante: "EMPLOYEE_STATUSES", valori: EMPLOYEE_STATUSES, tabella: "employees", colonna: "status" },
  { costante: "CONTRACT_TYPES", valori: CONTRACT_TYPES, tabella: "employees", colonna: "contract_type" },
  { costante: "LEAVE_TYPES", valori: LEAVE_TYPES, tabella: "employee_leaves", colonna: "leave_type" },
  { costante: "COMPLIANCE_DOC_TYPES", valori: COMPLIANCE_DOC_TYPES, tabella: "employee_documents", colonna: "doc_type" },
  { costante: "CROP_STATUSES", valori: CROP_STATUSES, tabella: "crops", colonna: "status" },
  { costante: "RESERVATION_TYPES", valori: RESERVATION_TYPES, tabella: "reservations", colonna: "type" },
  { costante: "RESERVATION_STATUSES", valori: RESERVATION_STATUSES, tabella: "reservations", colonna: "status" },
  { costante: "TASK_CATEGORIES", valori: TASK_CATEGORIES, tabella: "tasks", colonna: "category" },
  { costante: "TASK_PRIORITIES", valori: TASK_PRIORITIES, tabella: "tasks", colonna: "priority" },
  { costante: "TASK_STATUSES", valori: TASK_STATUSES, tabella: "tasks", colonna: "status" },
  {
    costante: "TASK_RICORRENZE",
    valori: TASK_RICORRENZE,
    tabella: "tasks",
    colonna: "ricorrenza",
    // Il valore vuoto non è un valore del database: è «non si ripete»,
    // cioè `null`. La colonna ammette `null` per quello.
    ignora: [""],
    perche: "il valore vuoto del menu significa «non si ripete», che nel database è null",
  },
];

// Gli elenchi di etichette che NON rispecchiano nessuna colonna, e la
// ragione di ciascuno (24/08/2026).
//
// 🔴 NASCE DA UNA RETE CHE HA FATTO IL SUO LAVORO: aggiungendo
// `RECIPE_STATI` la prova è diventata rossa da sola, com'era scritto che
// facesse. Ma il verdetto giusto qui non è «agganciala a una colonna» —
// quell'elenco una colonna non ce l'ha, e non deve averla.
//
// ⚠️ E LA DIFFERENZA CONTA, perché è la stessa distinzione del 17/08 fra
// un doppione e una rete: un elenco che rispecchia una colonna PUÒ
// divergere da lei, e allora va sorvegliato; un elenco DERIVATO da altre
// colonne non può divergere da niente, perché non c'è nessun secondo posto
// che dice la stessa cosa. Sorvegliarlo darebbe un allarme permanente su
// un caso legittimo — e un guardiano che grida sempre si impara a
// spegnere.
export const SPECCHI_ESENTI = [
  {
    costante: "RECIPE_STATI",
    perche:
      "non è un vocabolario del database: i quattro stati di una ricetta si DERIVANO da tre cose diverse — `pronta_per_carta` (booleano), `in_carta` (un riflesso scritto da un trigger) e `ritirata_il` (una data). Non esiste nessuna colonna «stato» con cui possano divergere, e crearne una distruggerebbe il riflesso, cioè l'unica ragione per cui oggi «in carta» non può mentire (16/08)",
  },
];

// Le funzioni che ridicono un elenco chiuso SENZA che debba combaciare con
// un vocabolario: sono due, e sono due cose diverse fra loro.
//
// ⚠️ Una rete che grida su un caso legittimo viene spenta. Ma un'eccezione
// senza la sua ragione scritta si allarga da sola, quindi ognuna ha la sua.
export const GUARDIE_ESENTI = [
  {
    funzione: "azione_domanda",
    parametro: "p_stato",
    perche:
      "non è una guardia ma un ramo: nomina i due stati in cui una cosa dettata sta ancora ASPETTANDO (in_attesa, fallita), che sono di proposito un sottoinsieme dei quattro stati possibili. Una riga già eseguita o annullata non chiede più niente, e la funzione risponde vuoto invece di rifiutare. ⚠️ E il verso conta: se un giorno nascesse un quinto stato in cui una riga aspetta, questa funzione direbbe «non chiede niente» — quindi il tipo nuovo va nominato anche qui (27/08/2026)",
  },
  {
    funzione: "azione_scelte",
    parametro: "p_tipo",
    perche:
      "non è una guardia ma un ramo, e nemmeno sui tipi di azione: elenca i tre tipi i cui candidati sono PRODOTTI (giacenza, merce_buttata, carico_merce), accanto ai rami che traducono i frigoriferi e le pulizie. È «di che natura è la cosa da scegliere», che è un'altra domanda da «che tipo di comando vocale è» — e il discriminante del 17/08 dice che allora non si fondono (27/08/2026)",
  },
  {
    funzione: "annulla_prenotazione",
    parametro: "p_stato",
    perche:
      "non valida un vocabolario: accetta di proposito SOLO i due stati in cui si può annullare (annullata, rifiutata), che sono un sottoinsieme voluto degli stati di una prenotazione",
  },
  {
    funzione: "chiudi_riga_lista",
    parametro: "p_esito",
    perche:
      "i tre esiti che si SCELGONO chiudendo a mano (comprata, gratis, non_presa) non sono i tre che si possono SCRIVERE nella colonna: «non_presa» cancella la riga e non lascia un esito, e «arrivata_con_documento» lo scrive il gestionale quando la merce arriva con una fattura, non chi chiude. Sono due elenchi che rispondono a due domande diverse — e il 17/08 il discriminante dice che allora non si fondono",
  },
  {
    funzione: "check_recipe_component",
    parametro: "p_type",
    perche:
      "elenca cosa PUÒ STARE DENTRO un'altra ricetta (preparazione, finger), che è di proposito un sottoinsieme dei tipi di ricetta: un piatto finito è un tipo legittimo e non può essere un componente. Sono due domande diverse — «che ricetta è» e «può entrare in un'altra» — e il discriminante del 17/08 dice che allora non si fondono. ⚠️ E il verso conta: la funzione elenca ciò che è ammesso, quindi un tipo nuovo domani sarebbe rifiutato finché nessuno lo nomina lì (19/08/2026, blocco 1 dei finger food)",
  },
  {
    funzione: "close_order_paid",
    parametro: "p_payment_method",
    perche:
      "elenca come il cliente può pagare ADESSO, in sala (contante, carta), che dal 26/08/2026 è di proposito un sottoinsieme di ciò che `order_payments.mezzo` ammette: il terzo valore, «caparra», è una quota già saldata settimane prima e non un modo di pagare che un cameriere possa scegliere. Lo scrive solo il gestionale, quando Alessio conferma lo scalo. Sono due domande diverse — «come stai pagando» e «come è stata saldata questa quota» — e il discriminante del 17/08 dice che allora non si fondono. ⚠️ E il verso conta: se un giorno la guardia venisse allargata a «caparra», un cameriere potrebbe chiudere un conto dichiarando una caparra che non esiste",
  },
  {
    funzione: "voce_risolvi_dati",
    parametro: "p_tipo",
    perche:
      "non valida niente e non rifiuta niente: elenca i tipi di azione vocale che nominano qualcosa del catalogo — un prodotto (giacenza, merce_buttata, carico_merce), un frigo, una pulizia, una causale, e dal 29/08/2026 una preparazione da segnare fra le cose da fare — per tradurre il numero del catalogo nell'identificativo vero. Gli altri passano di lì e ne escono intatti. ⚠️ QUI C'ERA UN CONTEGGIO («gli altri otto tipi»), ed è diventato falso il giorno stesso in cui è stato aggiunto un tipo: un numero scritto in un commento è una frase destinata a diventare falsa, e quanti sono lo dice `tipi_azione_vocale`. ⚠️ E il vocabolario dei tipi non è nemmeno un vincolo `check`: vive in `tipi_azione_vocale`, una tabella, perché aggiungere un'azione deve essere una riga e non una migrazione — quindi non esiste nessun insieme del database con cui questa guardia potrebbe combaciare (26/08/2026, i comandi vocali)",
  },
];

// ---------------------------------------------------------------------
// La regola della rete, come funzione pura
// ---------------------------------------------------------------------
//
// ⚠️ STA QUI E NON DENTRO LA PROVA, e la ragione è duplice.
//   · Perché la si possa provare AL CONTRARIO senza rompere niente: una
//     rete che non è mai stata vista scattare è una rete di cui non si sa
//     se scatta. Provarla mutando i file dell'app significherebbe far
//     comparire menu rotti sotto le mani di chi sta collaudando — il dev
//     server gira dalla stessa cartella.
//   · Perché la regola sia leggibile in un posto invece che sparsa fra le
//     asserzioni di un file di prove.

const chiaviDi = (elenco, ignora = []) =>
  [...new Set(elenco.map((v) => v.value).filter((v) => !ignora.includes(v)))].sort();

/**
 * Confronta gli elenchi di etichette col vocabolario vero del database.
 * Restituisce le frasi dei problemi trovati — vuoto se tutto combacia.
 *
 * `vocabolari` è quello che risponde `vocabolari_chiusi()`:
 * `[{ tabella, colonna, valori: [...] }]`.
 */
export function problemiVocabolari(specchiati, vocabolari) {
  const problemi = [];
  for (const s of specchiati) {
    const riga = vocabolari.find((v) => v.tabella === s.tabella && v.colonna === s.colonna);
    if (!riga) {
      problemi.push(`${s.costante}: ${s.tabella}.${s.colonna} non è un vocabolario chiuso del database`);
      continue;
    }
    const nelDatabase = [...riga.valori].sort();
    const nellaSchermata = chiaviDi(s.valori, s.ignora ?? []);
    // I valori dichiarati «in più nel database» sono quelli che il
    // gestionale non deve offrire perché li scrive lui (un riflesso).
    const attesi = nelDatabase.filter((v) => !(s.inPiuNelDatabase ?? []).includes(v));

    const mancanti = attesi.filter((v) => !nellaSchermata.includes(v));
    const inventati = nellaSchermata.filter((v) => !nelDatabase.includes(v));

    if (mancanti.length) {
      problemi.push(
        `${s.costante} (${s.tabella}.${s.colonna}): il database ammette ${mancanti.join(", ")} ` +
          "e la schermata non li offre — un valore legittimo che nessuno può scegliere, e in silenzio"
      );
    }
    if (inventati.length) {
      problemi.push(
        `${s.costante} (${s.tabella}.${s.colonna}): la schermata offre ${inventati.join(", ")} ` +
          "e il database li rifiuta — il salvataggio fallisce su chi ci prova"
      );
    }
  }
  return problemi;
}

/**
 * Le guardie di funzione che non dicono quello che dice il database.
 *
 * ⚠️ Nessun accoppiamento dichiarato fra funzione e colonna: si pretende che
 * l'insieme di valori della guardia sia **uguale** a quello di qualche
 * vocabolario. Allargare la funzione e non il vincolo (o il contrario) rompe
 * l'uguaglianza, e nessun elenco scritto a mano deve restare aggiornato
 * perché la rete funzioni.
 */
export function guardieSospette(guardie, vocabolari, esenti = GUARDIE_ESENTI) {
  const insiemi = new Set(vocabolari.map((v) => [...v.valori].sort().join(" ")));
  const esentate = new Set(esenti.map((g) => `${g.funzione}.${g.parametro}`));
  return guardie
    .filter((g) => !esentate.has(`${g.funzione}.${g.parametro}`))
    .filter((g) => !insiemi.has([...g.valori].sort().join(" ")))
    .map((g) => `${g.funzione}(${g.parametro}) accetta ${g.valori.join(", ")}`);
}

/**
 * Gli elenchi di etichette esportati da `constants.js` che nessuno ha
 * dichiarato. Il lato JavaScript si costruisce da solo: si guarda cosa il
 * modulo esporta, non un elenco scritto a mano — aggiungere un menu a
 * tendina nuovo e non dichiararlo diventa rosso.
 */
// 🔴 LE CATEGORIE DEGLI INGREDIENTI NON DEVONO TORNARE UN ELENCO NEL CODICE.
//
// Dal 27/08/2026 sono DATI, e il gestionale le LEGGE. Rimettere un elenco
// statico non darebbe nessun errore: darebbe una seconda verità che resta
// indietro appena Alessio ne aggiunge una — cioè un valore legittimo che non
// si può scegliere, il caso SILENZIOSO fra i due che questa rete chiude.
//
// ⚠️ È UNA FUNZIONE PURA CHE RICEVE IL MODULO, e non un controllo scritto
// dentro la prova, per la stessa ragione dichiarata in cima a questo file:
// così si può provare AL CONTRARIO su un modulo inventato, senza rompere
// `constants.js` — che è il file da cui il gestionale prende i menu mentre
// qualcuno lo sta collaudando.
export function elenchiDiCategorieNelCodice(moduloCostanti) {
  return Object.keys(moduloCostanti)
    .filter((k) => /INGREDIENT_CATEG/i.test(k))
    .sort();
}

export function specchiNonDichiarati(moduloCostanti, specchiati, esenti = SPECCHI_ESENTI) {
  const dichiarati = new Set([
    ...specchiati.map((s) => s.costante),
    // ⚠️ Gli esenti sono DICHIARATI, non invisibili: stanno in un elenco
    // con la loro ragione accanto, come le guardie. Un'eccezione senza la
    // sua ragione scritta si allarga da sola.
    ...esenti.map((e) => e.costante),
  ]);
  return Object.entries(moduloCostanti)
    .filter(
      ([, v]) =>
        Array.isArray(v) && v.length > 0 && v.every((r) => r && typeof r === "object" && "value" in r)
    )
    .map(([nome]) => nome)
    .filter((n) => !dichiarati.has(n));
}

// ⚠️ QUEL CHE LA RETE NON COPRE, dichiarato perché non sembri coperto: la
// rete controlla i VALORI, non a quale colonna una schermata li applica.
// Usare l'elenco giusto contro la colonna sbagliata resta possibile — ma
// sbaglia **rumorosamente**, perché il database rifiuta al primo tentativo.
// È il caso silenzioso quello che la rete chiude.
export const LIMITE_DICHIARATO =
  "La rete confronta gli insiemi di valori. Non sa quale schermata usa quale elenco: " +
  "se un elenco venisse usato per la colonna sbagliata, il database rifiuterebbe al " +
  "primo salvataggio — rumorosamente, non in silenzio.";
