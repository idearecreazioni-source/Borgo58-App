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

export const CONSUMPTION_REASONS = [
  { value: "consumo", label: "Consumo" },
  { value: "spreco", label: "Spreco" },
  { value: "rettifica", label: "Rettifica (correzione da conteggio fisico)" },
];

export const PAYMENT_METHODS = [
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

// Regole di deducibilità (§6). Unica fonte di verità: il calcolo lato UI
// mostra sempre da quale regola deriva ogni importo (§3.10, niente scatola nera).
//   rate       = % deducibile della quota ammessa
//   plafond    = soggetto a plafond (rappresentanza: % dei ricavi)
//   cashRule   = dal 2025 il pagamento in contanti la rende indeducibile
export const DEDUCTION_CATEGORIES = [
  {
    value: "formazione",
    label: "Formazione / aggiornamento",
    rate: 1.0,
    plafond: false,
    cashRule: false,
    note: "Interamente deducibile per una società, nessun plafond.",
  },
  {
    value: "trasferta",
    label: "Trasferte (vitto/alloggio/trasporto)",
    rate: 0.75,
    plafond: false,
    cashRule: true,
    note: "75% deducibile. Dal 2025 il pagamento in contanti la rende indeducibile (esenti i biglietti di trasporto pubblico di linea e le indennità chilometriche entro i limiti).",
  },
  {
    value: "rappresentanza",
    label: "Rappresentanza",
    rate: 1.0,
    plafond: true,
    cashRule: true,
    note: "Deducibile entro il plafond dell'1,5% dei ricavi (fino a 10 mln). Sotto 50€/persona sempre deducibile fuori plafond. Dal 2025 il contante la rende indeducibile.",
  },
  {
    value: "marketing",
    label: "Marketing / pubblicità",
    rate: 1.0,
    plafond: false,
    cashRule: false,
    note: "Spese di pubblicità deducibili.",
  },
  {
    value: "altro",
    label: "Altro (spesa aziendale documentata)",
    rate: 1.0,
    plafond: false,
    cashRule: false,
    note: "Spesa aziendale documentata.",
  },
];

// Plafond rappresentanza: 1,5% ricavi fino a 10 mln (Borgo 58 è ben sotto).
export const RAPPRESENTANZA_PLAFOND_RATE = 0.015;
// Soglia rappresentanza sempre deducibile fuori plafond (§6).
export const RAPPRESENTANZA_PER_PERSON_THRESHOLD = 50;

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
