// Etichette italiane per gli enum del database (schema Ricettario, migrazione 0001).

export const INGREDIENT_CATEGORIES = [
  { value: "verdura", label: "Verdura" },
  { value: "frutta", label: "Frutta" },
  { value: "carne_rossa", label: "Carne rossa" },
  { value: "carne_bianca", label: "Carne bianca" },
  { value: "pesce", label: "Pesce" },
  { value: "crostacei_molluschi", label: "Crostacei e molluschi" },
  { value: "latticini", label: "Latticini" },
  { value: "uova", label: "Uova" },
  { value: "farine_cereali", label: "Farine e cereali" },
  { value: "legumi", label: "Legumi" },
  { value: "olio_condimenti", label: "Olio e condimenti" },
  { value: "spezie_aromi", label: "Spezie e aromi" },
  { value: "secco_dispensa", label: "Secco / dispensa" },
  { value: "bevande", label: "Bevande" },
  { value: "altro", label: "Altro" },
];

export const UNITS = [
  { value: "kg", label: "kg" },
  { value: "l", label: "l" },
  { value: "pz", label: "pz" },
  { value: "mazzo", label: "mazzo" },
];

export const STORAGE_TYPES = [
  { value: "frigo_0_4", label: "Frigo 0-4°C" },
  { value: "frigo_4_8", label: "Frigo 4-8°C" },
  { value: "freezer", label: "Freezer" },
  { value: "dispensa", label: "Dispensa" },
  { value: "temperatura_ambiente", label: "Temperatura ambiente" },
];

export const MONTHS = [
  { value: "gen", label: "Gen" },
  { value: "feb", label: "Feb" },
  { value: "mar", label: "Mar" },
  { value: "apr", label: "Apr" },
  { value: "mag", label: "Mag" },
  { value: "giu", label: "Giu" },
  { value: "lug", label: "Lug" },
  { value: "ago", label: "Ago" },
  { value: "set", label: "Set" },
  { value: "ott", label: "Ott" },
  { value: "nov", label: "Nov" },
  { value: "dic", label: "Dic" },
  { value: "tutto_anno", label: "Tutto l'anno" },
];

export const ALLERGENS = [
  { value: "glutine", label: "Glutine" },
  { value: "crostacei", label: "Crostacei" },
  { value: "uova", label: "Uova" },
  { value: "pesce", label: "Pesce" },
  { value: "arachidi", label: "Arachidi" },
  { value: "soia", label: "Soia" },
  { value: "latte", label: "Latte" },
  { value: "frutta_guscio", label: "Frutta a guscio" },
  { value: "sedano", label: "Sedano" },
  { value: "senape", label: "Senape" },
  { value: "sesamo", label: "Sesamo" },
  { value: "anidride_solforosa", label: "Anidride solforosa" },
  { value: "lupini", label: "Lupini" },
  { value: "molluschi", label: "Molluschi" },
];

export const SUPPLIER_CATEGORIES = [
  { value: "ortofrutta", label: "Ortofrutta" },
  { value: "carne", label: "Carne" },
  { value: "pesce", label: "Pesce" },
  { value: "latticini", label: "Latticini" },
  { value: "secco", label: "Secco" },
  { value: "bevande", label: "Bevande" },
  { value: "economato", label: "Economato" },
  { value: "altro", label: "Altro" },
];

export const RECIPE_CATEGORIES = [
  { value: "antipasto", label: "Antipasto" },
  { value: "primo", label: "Primo" },
  { value: "secondo", label: "Secondo" },
  { value: "dolce", label: "Dolce" },
];

export const RECIPE_TYPES = [
  { value: "piatto_finito", label: "Piatto finito" },
  { value: "preparazione", label: "Preparazione (semilavorato)" },
];

// Sostituisce il vecchio status unico: due flag indipendenti, non un enum
// (§4 del brief, revisione 02/08/2026). Etichetta derivata, non salvata.
export const recipeStatusLabel = (prontaPerCarta, inCarta) => {
  if (inCarta) return { label: "In carta", colorClass: "bg-b58-olive" };
  if (prontaPerCarta) return { label: "Pronta (non in carta)", colorClass: "bg-b58-gold" };
  return { label: "In sviluppo", colorClass: "bg-b58-charcoal-soft" };
};

export const VIDEO_PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "altro", label: "Altro" },
];

export const SEASONS = [
  { value: "primavera", label: "Primavera" },
  { value: "estate", label: "Estate" },
  { value: "autunno", label: "Autunno" },
  { value: "inverno", label: "Inverno" },
  { value: "tutto_anno", label: "Tutto l'anno" },
];

export const STEP_PHASES = [
  { value: "mise_en_place", label: "Mise en place" },
  { value: "cottura", label: "Cottura" },
  { value: "finitura", label: "Finitura" },
  { value: "impiattamento", label: "Impiattamento" },
];

export const COOKING_TECHNIQUES = [
  { value: "tradizionale", label: "Tradizionale" },
  { value: "sottovuoto", label: "Sottovuoto" },
  { value: "CBT", label: "CBT" },
  { value: "abbattitore", label: "Abbattitore" },
  { value: "bagnomaria", label: "Bagnomaria" },
  { value: "frittura", label: "Frittura" },
  { value: "griglia", label: "Griglia" },
  { value: "forno", label: "Forno" },
  { value: "crudo", label: "Crudo" },
  { value: "altro", label: "Altro" },
];

// ⚠️ Vocabolario CHIUSO, e in tre posti che devono restare d'accordo: qui,
// dentro `record_stock_consumption` e nel vincolo della tabella
// `stock_consumptions`. Testo libero produrrebbe «vitto», «Vitto
// personale» e «pasto staff», cioè tre totali che non si sommano.
export const CONSUMPTION_REASONS = [
  { value: "consumo", label: "Consumo" },
  { value: "spreco", label: "Spreco" },
  // Il cibo che mangia la brigata è food cost che non genera ricavo: se
  // non lo si distingue, gonfia il food cost dei piatti venduti e fa
  // cercare un problema in cucina che non esiste (16/08/2026).
  { value: "vitto_personale", label: "Vitto del personale" },
  { value: "rettifica", label: "Rettifica (correzione da conteggio fisico)" },
];

// Dove sono finite le mance: quelle in contanti restano nel cassetto,
// quelle su carta arrivano in banca insieme agli incassi.
export const TIP_MEZZI = [
  { value: "contanti", label: "Contanti" },
  { value: "carta", label: "Carta" },
];

// Come si paga una FATTURA FORNITORE.
//
// ⚠️ L'assegno c'è dal 17/08/2026: mancava, e Alessio conta di usarne una
// trentina prima dell'apertura. Un pagamento vero che il gestionale non sa
// nominare finisce registrato come qualcos'altro.
// ⚠️ Il vocabolario è chiuso in TRE posti che devono restare d'accordo: qui,
// nella funzione `pay_supplier_invoice` e nel vincolo su
// `supplier_invoices`. Da oggi c'è una rete che lo controlla —
// `src/lib/calcoli/vocabolari.js` e `tests/app/vocabolari.test.js`.
export const PAYMENT_METHODS = [
  { value: "contante", label: "Contante" },
  { value: "bonifico", label: "Bonifico" },
  { value: "assegno", label: "Assegno" },
  { value: "carta", label: "Carta" },
];

// Come si paga una spesa CHIUSA DALLA LISTA — e sono due vocabolari, non
// uno.
//
// 🔴 Fino al 17/08 la lista della spesa usava l'elenco delle fatture, e
// finché i due coincidevano non si vedeva. Aggiungendo l'assegno alle
// fatture, questo menu ha cominciato a offrire un valore che il database
// rifiuta (`shopping_list_items_payment_method_check` ammette contante,
// bonifico, carta): sceglierlo faceva fallire la chiusura della riga.
// Trovato costruendo la rete dei vocabolari, non da un errore.
//
// ⚠️ NON si è allargato il vincolo per far posto all'assegno: quale sia il
// vocabolario della sua spesa lo decide Alessio, e aggiungere un valore per
// far tornare un conto sarebbe una regola scritta da me sul suo modo di
// comprare. Se un giorno pagherà la spesa con un assegno, è una riga qui e
// una migrazione.
export const PAYMENT_METHODS_SPESA = [
  { value: "contante", label: "Contante" },
  { value: "bonifico", label: "Bonifico" },
  { value: "carta", label: "Carta" },
];

export const CLEANING_FREQUENCIES = [
  { value: "giornaliera", label: "Giornaliera" },
  { value: "settimanale", label: "Settimanale" },
  { value: "mensile", label: "Mensile" },
  { value: "altro", label: "Altro" },
];

export const PEST_CONTROL_TYPES = [
  { value: "ispezione", label: "Ispezione" },
  { value: "trattamento", label: "Trattamento" },
];

export const NC_CATEGORIES = [
  { value: "temperatura", label: "Temperatura" },
  { value: "ricevimento", label: "Ricevimento merci" },
  { value: "pulizia", label: "Pulizia e sanificazione" },
  { value: "disinfestazione", label: "Disinfestazione" },
  // Nasce dallo scadenziario (13/08/2026): buttare una partita scaduta
  // scrive da sé la riga qui. In "Altro" non la ritroverebbe nessuno.
  { value: "scadenza", label: "Prodotto scaduto o eliminato" },
  { value: "altro", label: "Altro" },
];

export const CASH_DIRECTIONS = [
  { value: "entrata", label: "Entrata" },
  { value: "uscita", label: "Uscita" },
];

// solo fattura/scontrino/autofattura/documento_raccoglitore_occasionale
// entrano nei calcoli fiscali (§3.4, §3.17)
export const CASH_DOCUMENT_TYPES = [
  { value: "fattura", label: "Fattura" },
  { value: "scontrino", label: "Scontrino" },
  { value: "autofattura", label: "Autofattura" },
  { value: "documento_raccoglitore_occasionale", label: "Documento raccoglitore occasionale" },
  { value: "non_documentato", label: "Non documentato" },
];

export const DISCOUNT_GIFT_TYPES = [
  { value: "sconto", label: "Sconto" },
  { value: "omaggio", label: "Omaggio" },
];

export const ORDER_DESTINATIONS = [
  { value: "cucina", label: "Cucina" },
  { value: "bar", label: "Bar" },
];

export const ORDER_PAYMENT_METHODS = [
  { value: "contante", label: "Contante" },
  { value: "carta", label: "Carta" },
];

// Soglia fattura semplificata (§3.4/§6): scontrino ≤400€ → promemoria IVA.
export const SIMPLIFIED_INVOICE_THRESHOLD = 400;

// Le regole di deducibilità NON stanno più qui (15/08/2026).
// Vivevano in questo file come DEDUCTION_CATEGORIES, con sopra scritto
// «unica fonte di verità», e il calcolo stava in src/lib/deducibility.js.
// Erano due cose sbagliate insieme: percentuali fiscali dentro il bundle
// pubblico — e sono proprio quelle che il quesito L4 aspetta da Laura,
// quindi cambiarle voleva dire fare un deploy invece di riempire un campo —
// e un secondo calcolo accanto a quello che il mandato «personale e
// tesoreria» chiedeva di costruire, cioè due risposte alla stessa domanda.
// Ora: tabella regole_deducibilita e funzione quota_deducibile() nel
// database, governate da Alessio da «Proiezione fiscale → Deducibilità dei
// costi». Il client le legge da src/lib/api/deducibilita.js e non ricalcola.

export const FISCAL_PAYMENT_METHODS = [
  { value: "bonifico", label: "Bonifico", tracciato: true },
  { value: "carta", label: "Carta", tracciato: true },
  { value: "app", label: "App di pagamento", tracciato: true },
  { value: "altro_tracciato", label: "Altro tracciato", tracciato: true },
  { value: "contante", label: "Contante", tracciato: false },
];

export const FISCAL_TOOL_CATEGORIES = [
  { value: "deduzione", label: "Deduzione" },
  { value: "credito_imposta", label: "Credito d'imposta" },
  { value: "bando", label: "Bando" },
  { value: "incentivo", label: "Incentivo" },
];

export const FISCAL_TOOL_STATUSES = [
  { value: "attivo", label: "Attivo" },
  { value: "da_verificare", label: "Da verificare" },
  { value: "scaduto", label: "Scaduto" },
  { value: "abolito", label: "Abolito" },
];

export const EMPLOYEE_STATUSES = [
  { value: "attivo", label: "Attivo" },
  { value: "cessato", label: "Cessato" },
];

export const CONTRACT_TYPES = [
  { value: "indeterminato", label: "Indeterminato" },
  { value: "determinato", label: "Determinato" },
  { value: "apprendistato", label: "Apprendistato" },
  { value: "stagionale", label: "Stagionale" },
  { value: "extra", label: "Extra / a chiamata" },
  { value: "altro", label: "Altro" },
];

export const LEAVE_TYPES = [
  { value: "ferie", label: "Ferie" },
  { value: "permesso", label: "Permesso" },
  { value: "malattia", label: "Malattia" },
  { value: "altro", label: "Altro" },
];

export const COMPLIANCE_DOC_TYPES = [
  { value: "contratto", label: "Contratto" },
  { value: "idoneita_sanitaria", label: "Idoneità sanitaria" },
  { value: "formazione_haccp", label: "Formazione HACCP" },
  { value: "formazione_sicurezza", label: "Formazione sicurezza" },
  { value: "documento_identita", label: "Documento d'identità" },
  { value: "permesso_soggiorno", label: "Permesso di soggiorno" },
  { value: "altro", label: "Altro" },
];

// Regime fiscale mance (§6): imposta sostitutiva 5%, si applica se il reddito
// da lavoro dipendente dell'anno precedente ≤75.000€; le mance agevolate sono
// nel limite del 30% del reddito annuo.
export const MANCE_REGIME_INCOME_THRESHOLD = 75000;
export const MANCE_CAP_RATE = 0.3;
export const MANCE_SUBSTITUTE_TAX_RATE = 0.05;

export const CROP_STATUSES = [
  { value: "pianificato", label: "Pianificato" },
  { value: "seminato", label: "Seminato" },
  { value: "in_crescita", label: "In crescita" },
  { value: "raccolto", label: "Raccolto" },
  { value: "chiuso", label: "Chiuso" },
];

export const RESERVATION_TYPES = [
  { value: "prenotazione", label: "Prenotazione" },
  { value: "evento", label: "Evento" },
];

// Elenco CHIUSO: prima erano testo libero e su venti righe convivevano
// quattro convenzioni diverse ("Adempimenti societari", "Documenti",
// "amministrativo", vuoto). Il database normalizza e rifiuta il resto —
// qui vivono solo le etichette da mostrare.
export const TASK_CATEGORIES = [
  { value: "fisco_scadenze", label: "Fisco e scadenze" },
  { value: "documenti", label: "Documenti" },
  { value: "fornitori_pagamenti", label: "Fornitori e pagamenti" },
  { value: "personale", label: "Personale" },
  { value: "haccp_locale", label: "HACCP e locale" },
  { value: "altro", label: "Altro" },
];

export const TASK_RICORRENZE = [
  { value: "", label: "Non si ripete" },
  { value: "mensile", label: "Ogni mese" },
  { value: "trimestrale", label: "Ogni tre mesi" },
  { value: "semestrale", label: "Ogni sei mesi" },
  { value: "annuale", label: "Ogni anno" },
];

// ⚠️ Non si usa più in Agenda: l'urgenza la dice la scadenza, non un
// campo dichiarato a mano (su venti righe valeva "alta" per tutti gli
// adempimenti e "media" per tutto il resto — non distingueva niente).
// Resta perché la colonna è `not null` e alcuni moduli la scrivono ancora.
export const TASK_PRIORITIES = [
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "bassa", label: "Bassa" },
];

export const TASK_STATUSES = [
  { value: "da_fare", label: "Da fare" },
  { value: "in_corso", label: "In corso" },
  { value: "completato", label: "Completato" },
];

export const RESERVATION_STATUSES = [
  { value: "richiesta_in_attesa", label: "Richiesta in attesa" },
  { value: "confermata", label: "Confermata" },
  { value: "rifiutata", label: "Rifiutata" },
  { value: "annullata", label: "Annullata" },
];

// Soglie food cost (§5.3 del doc): >25% rosso, >22% giallo, altrimenti verde.
export const foodCostLevel = (pct) => {
  if (pct == null) return "neutral";
  if (pct > 25) return "danger";
  if (pct > 22) return "warning";
  return "ok";
};

export const labelFor = (list, value) =>
  list.find((item) => item.value === value)?.label ?? value;

export const formatEUR = (value) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    value ?? 0
  );

// Una quantità come la scrive una persona.
//
// ⚠️ Nasce da una piccolezza del collaudo (17/08): in Magazzino si leggeva
// «5.8785 kg» — il residuo di uno scarico calcolato, col punto inglese e
// quattro decimali che nessuno userà mai per prendere una decisione.
// Al massimo due decimali, e gli zeri in coda si tolgono: «10 kg» si legge
// meglio di «10,00 kg», e «5,88 kg» dice tutto quello che serve.
export const formatQta = (value) =>
  value == null || value === ""
    ? "—"
    : new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(Number(value));

export const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(
        new Date(value)
      )
    : "—";

// ---------------------------------------------------------------------
// Date "di calendario" nel fuso orario del locale
// ---------------------------------------------------------------------
// ⚠️ NON usare `new Date().toISOString().slice(0, 10)` per sapere che
// giorno è: quella è la data UTC, e l'Italia è avanti di 1-2 ore. Fra
// mezzanotte e le 02:00 restituisce IERI.
//
// Per un ufficio è ininfluente, per un'osteria che chiude all'una no: la
// prima nota di fine servizio, le registrazioni HACCP, le mance e i task
// finivano datati al giorno prima — senza errori e senza avvisi, su
// registri che devono reggere anni. Trovato nell'audit dell'08/08/2026 in
// 14 punti diversi.
//
// Queste funzioni leggono giorno, mese e anno dall'orologio locale, che è
// esattamente quello che intende una persona quando dice "oggi".
export const dataLocale = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const oggiLocale = () => dataLocale();

export const meseLocale = (d = new Date()) => dataLocale(d).slice(0, 7);

// Primo giorno del mese corrente, in locale.
export const primoDelMeseLocale = (d = new Date()) =>
  dataLocale(new Date(d.getFullYear(), d.getMonth(), 1));

// Data fra N giorni (N negativo = indietro), in locale.
export const traGiorniLocale = (giorni, d = new Date()) => {
  const data = new Date(d);
  data.setDate(data.getDate() + giorni);
  return dataLocale(data);
};
