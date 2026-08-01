// Fonte: APP_Borgo58_Brief_Tecnico_v2.md §4-5
export const PHASES = {
  1: { label: "Fase 1 · Nucleo operativo", colorClass: "bg-b58-terracotta" },
  2: { label: "Fase 2 · Fiscale e amministrativo", colorClass: "bg-b58-olive" },
  3: { label: "Fase 3 · Comunicazione", colorClass: "bg-b58-gold" },
};

export const MODULES = [
  {
    id: "ricettario",
    number: 1,
    name: "Ricettario",
    description: "Food cost dinamico, HACCP, allergeni UE, simulatore menu.",
    phase: 1,
    icon: "book",
    next: true,
    route: "/ricettario",
    staffVisible: true, // staff: solo le ricette (senza food cost) — §3.5
  },
  {
    id: "fatture-fornitori",
    number: 2,
    name: "Fatture Fornitori",
    description: "Integrazione Fatture in Cloud, storico prezzi per fornitore.",
    phase: 1,
    icon: "receipt",
  },
  {
    id: "magazzino",
    number: 3,
    name: "Magazzino",
    description: "Carico/scarico, soglie minime, scadenze in avvicinamento.",
    phase: 1,
    icon: "box",
    staffVisible: true, // staff: scorte/scadenze senza valore economico — §3.5
  },
  {
    id: "cassa-riconciliazione",
    number: 4,
    name: "Cassa & Riconciliazione",
    description: "Incassi, sconto vs omaggio, margine reale per piatto.",
    phase: 1,
    icon: "cash",
  },
  {
    id: "calendario-eventi",
    number: 5,
    name: "Calendario Eventi",
    description: "Prenotazioni, eventi, Giovedì della Terra, Green Card.",
    phase: 1,
    icon: "calendar",
    route: "/calendario-eventi",
    staffVisible: true, // staff: vista operativa del servizio, senza caparra — §3.5
  },
  {
    id: "agricolo",
    number: 6,
    name: "Agricolo / Orto",
    description: "Semine, raccolti, cessione intercompany verso la S.r.l.s.",
    phase: 2,
    icon: "leaf",
  },
  {
    id: "proiezione-fiscale",
    number: 7,
    name: "Proiezione Fiscale",
    description: "IVA, stima IRES/IRAP, scadenze, simulatore what-if.",
    phase: 2,
    icon: "percent",
  },
  {
    id: "ricerca-ricorrente",
    number: 8,
    name: "Ricerca Ricorrente",
    description: "Digest su sgravi, bandi, normativa, tecniche di cucina.",
    phase: 2,
    icon: "search",
  },
  {
    id: "sito-social",
    number: 9,
    name: "Sito & Social",
    description: "Sync menu/eventi, bozze post, pubblicazione sempre manuale.",
    phase: 3,
    icon: "share",
  },
  {
    id: "editor-menu",
    number: 10,
    name: "Editor Menu Cartaceo",
    description: "Template grafico B58 \"Dal 1958\", export PDF per tipografo.",
    phase: 3,
    icon: "printer",
  },
  {
    id: "chat-ai",
    number: 11,
    name: "Chat AI",
    description: "Query in linguaggio naturale sui dati reali dell'app.",
    phase: 3,
    icon: "chat",
  },
];

export const getModule = (id) => MODULES.find((m) => m.id === id);
