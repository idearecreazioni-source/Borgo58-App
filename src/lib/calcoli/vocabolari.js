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
  INGREDIENT_CATEGORIES,
  LEAVE_TYPES,
  MONTHS,
  NC_CATEGORIES,
  ORDER_DESTINATIONS,
  ORDER_PAYMENT_METHODS,
  PAYMENT_METHODS,
  PAYMENT_METHODS_SPESA,
  PEST_CONTROL_TYPES,
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
export const SPECCHIATI = [
  { costante: "INGREDIENT_CATEGORIES", valori: INGREDIENT_CATEGORIES, tabella: "ingredients", colonna: "category" },
  { costante: "UNITS", valori: UNITS, tabella: "ingredients", colonna: "unit" },
  { costante: "STORAGE_TYPES", valori: STORAGE_TYPES, tabella: "ingredients", colonna: "storage_type" },
  { costante: "MONTHS", valori: MONTHS, tabella: "ingredients", colonna: "seasonality" },
  { costante: "ALLERGENS", valori: ALLERGENS, tabella: "ingredients", colonna: "allergens" },
  { costante: "SUPPLIER_CATEGORIES", valori: SUPPLIER_CATEGORIES, tabella: "suppliers", colonna: "category" },
  { costante: "RECIPE_CATEGORIES", valori: RECIPE_CATEGORIES, tabella: "recipes", colonna: "category" },
  { costante: "RECIPE_TYPES", valori: RECIPE_TYPES, tabella: "recipes", colonna: "recipe_type" },
  { costante: "SEASONS", valori: SEASONS, tabella: "recipes", colonna: "seasonality" },
  { costante: "VIDEO_PLATFORMS", valori: VIDEO_PLATFORMS, tabella: "recipe_videos", colonna: "platform" },
  { costante: "STEP_PHASES", valori: STEP_PHASES, tabella: "recipe_steps", colonna: "phase" },
  { costante: "COOKING_TECHNIQUES", valori: COOKING_TECHNIQUES, tabella: "recipe_steps", colonna: "technique" },
  { costante: "CONSUMPTION_REASONS", valori: CONSUMPTION_REASONS, tabella: "stock_consumptions", colonna: "reason" },
  { costante: "TIP_MEZZI", valori: TIP_MEZZI, tabella: "tips_collected", colonna: "mezzo" },
  // ⚠️ I DUE METODI DI PAGAMENTO SONO DUE VOCABOLARI, non uno. Fino al
  // 17/08 coincidevano e un solo elenco serviva entrambe le schermate;
  // aggiungendo l'assegno alle fatture, il menu della lista della spesa ha
  // cominciato a offrire un valore che il database rifiuta. Tenerli
  // separati è la cura, e la rete è ciò che impedisce che ricapiti.
  { costante: "PAYMENT_METHODS", valori: PAYMENT_METHODS, tabella: "supplier_invoices", colonna: "payment_method" },
  {
    costante: "PAYMENT_METHODS_SPESA",
    valori: PAYMENT_METHODS_SPESA,
    tabella: "shopping_list_items",
    colonna: "payment_method",
  },
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

// Le funzioni che ridicono un elenco chiuso SENZA che debba combaciare con
// un vocabolario: sono due, e sono due cose diverse fra loro.
//
// ⚠️ Una rete che grida su un caso legittimo viene spenta. Ma un'eccezione
// senza la sua ragione scritta si allarga da sola, quindi ognuna ha la sua.
export const GUARDIE_ESENTI = [
  {
    funzione: "annulla_prenotazione",
    parametro: "p_stato",
    perche:
      "non valida un vocabolario: accetta di proposito SOLO i due stati in cui si può annullare (annullata, rifiutata), che sono un sottoinsieme voluto degli stati di una prenotazione",
  },
  {
    funzione: "preavviso_giorni",
    parametro: "p_conservazione",
    perche:
      "non è una guardia ma un ramo: il frigo prende due giorni di preavviso, dispensa e freezer quattordici. Non rifiuta niente",
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
export function specchiNonDichiarati(moduloCostanti, specchiati) {
  const dichiarati = new Set(specchiati.map((s) => s.costante));
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
