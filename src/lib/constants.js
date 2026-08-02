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
