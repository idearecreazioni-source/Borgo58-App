// Fonte: APP_Borgo58_Brief_Tecnico_v2_1.md §4-5 (revisione 02/08/2026, 15 moduli)
export const PHASES = {
  1: { label: "Fase 1 · Nucleo operativo", colorClass: "bg-b58-terracotta" },
  2: { label: "Fase 2 · Fiscale e amministrativo", colorClass: "bg-b58-olive" },
  3: { label: "Fase 3 · Comunicazione", colorClass: "bg-b58-gold" },
  4: { label: "Fase 4 · Extra, quando serve", colorClass: "bg-b58-charcoal-soft" },
};

export const MODULES = [
  {
    id: "ricettario",
    number: 1,
    name: "Ricettario",
    description: "Food cost dinamico, HACCP, allergeni UE, simulatore menu.",
    phase: 1,
    icon: "book",
    route: "/ricettario",
    staffVisible: true, // staff: solo le ricette (senza food cost) — §3.5
  },
  {
    id: "agenda",
    number: 2,
    name: "Agenda",
    description: "Task, priorità, calendario, adempimenti societari.",
    phase: 1,
    icon: "calendar",
    route: "/agenda",
    staffVisible: true, // condivisa, non riservata — §3.9
  },
  {
    id: "fatture-fornitori",
    number: 3,
    name: "Fatture Fornitori",
    description: "Integrazione Fatture in Cloud, storico prezzi per fornitore.",
    phase: 1,
    icon: "receipt",
    route: "/fatture-fornitori",
    // niente staffVisible: accesso solo titolare, esplicito nel brief
  },
  {
    id: "magazzino",
    number: 4,
    name: "Magazzino",
    description: "Carico/scarico, lista della spesa, soglie minime, scadenze.",
    phase: 1,
    icon: "box",
    route: "/magazzino",
    staffVisible: true, // staff: scorte/lista spesa senza valore economico — §3.5
  },
  {
    // Comande vive come voce propria in sidebar (su richiesta esplicita di
    // Alessio, 04/08/2026): per lo staff "Cassa" evoca prima nota/incassi,
    // non la presa ordini. Il legame col modulo 5 del brief resta nello
    // schema dati (orders/order_items -> futuro RT), non nella navigazione.
    id: "comande",
    number: 5,
    name: "Comande",
    description: "Presa ordini, instradamento cucina/bar, chiusura conto.",
    phase: 1,
    icon: "cash",
    route: "/comande",
    staffVisible: true,
  },
  {
    id: "cassa-prima-nota",
    number: 5,
    name: "Cassa, Banca e Prima Nota",
    description: "Preconto, riconciliazione, uscite di cassa, mance, banca.",
    phase: 1,
    icon: "receipt",
    route: "/cassa",
    // niente staffVisible: accesso solo titolare (§3.5) — Comande, sopra,
    // è ora la voce staff-accessibile del modulo 5.
  },
  {
    id: "calendario-eventi",
    number: 6,
    name: "Calendario Eventi",
    description: "Prenotazioni, eventi, Giovedì della Terra, Green Card.",
    phase: 1,
    icon: "calendar",
    route: "/calendario-eventi",
    staffVisible: true, // staff: vista operativa del servizio, senza caparra — §3.5
  },
  {
    id: "haccp",
    number: 7,
    name: "HACCP",
    description: "Piano di autocontrollo: temperature, pulizie, rintracciabilità.",
    phase: 1,
    icon: "leaf",
    route: "/haccp",
    staffVisible: true, // staff: solo immissione operativa quotidiana — §3.5
  },
  {
    id: "agricolo",
    number: 8,
    name: "Agricolo / Orto",
    description: "Semine, raccolti, cessione intercompany verso la S.r.l.s.",
    phase: 2,
    icon: "leaf",
    route: "/agricolo",
    // niente staffVisible: solo titolare
  },
  {
    id: "proiezione-fiscale",
    number: 9,
    name: "Proiezione Fiscale",
    description: "IVA, stima IRES/IRAP, deduzioni, scadenze, simulatore what-if.",
    phase: 2,
    icon: "percent",
    route: "/fiscale",
    // niente staffVisible: accesso solo titolare
  },
  {
    id: "ricerca-ricorrente",
    number: 10,
    name: "Ricerca Ricorrente",
    description: "Digest su sgravi, bandi, normativa, catalogo strumenti fiscali.",
    phase: 2,
    icon: "search",
  },
  {
    id: "personale",
    number: 11,
    name: "Personale & Buste Paga",
    description: "Anagrafica, documenti compliance, buste paga, distribuzione mance.",
    phase: 2,
    icon: "receipt",
    route: "/personale",
    // niente staffVisible: solo titolare (§4 mod. 11)
  },
  {
    id: "monitoraggio-social",
    number: 12,
    name: "Monitoraggio Social",
    description: "Osserva Instagram/TikTok/Google, segnala criticità e recensioni.",
    phase: 3,
    icon: "share",
  },
  {
    id: "editor-menu",
    number: 13,
    name: "Editor Menu Cartaceo",
    description: "Collegato ai piatti in carta, export PDF per tipografo.",
    phase: 3,
    icon: "printer",
    route: "/editor-menu",
    // niente staffVisible: i menu sono titolare-only
  },
  {
    id: "assistente-ai",
    number: 14,
    name: "Assistente AI",
    description: "Query in linguaggio naturale, sintesi periodica.",
    phase: 3,
    icon: "chat",
  },
  {
    id: "archivio-documenti",
    number: 15,
    name: "Archivio Documenti",
    description: "Contratti, licenze, atti societari con estrazione AI e scadenze.",
    phase: 4,
    icon: "box",
    route: "/documenti",
    // niente staffVisible: solo titolare (§3.13)
  },
];

export const getModule = (id) => MODULES.find((m) => m.id === id);
