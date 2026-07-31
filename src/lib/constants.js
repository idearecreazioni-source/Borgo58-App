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

export const RECIPE_STATUSES = [
  { value: "in_sviluppo", label: "In sviluppo" },
  { value: "attiva", label: "Attiva" },
  { value: "in_pausa", label: "In pausa" },
  { value: "archiviata", label: "Archiviata" },
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
