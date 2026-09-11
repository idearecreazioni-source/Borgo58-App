// Le schermate del censimento del telefono (`misura-telefono.mjs`).
//
// ⚠️ L'ELENCO VIENE DA UNA MAPPA DEL CODICE (11/09/2026): tutte le schermate
//    con un campo nativo di data/ora (75 campi in 38 file), più il modulo
//    o il filtro in cui stanno. Dove il campo sta dietro un pulsante, la
//    `prepara` preme quel pulsante; dove sta in un filtro, lo ATTIVA — un
//    filtro vuoto non mostra «Togli i filtri», e il difetto di Fatture
//    Fornitori sta proprio lì.
//
// ⚠️ NESSUNA PREPARAZIONE SALVA. Premono pulsanti che APRONO un modulo e
//    impostano filtri di lettura. Quattro schermate salvano appena si tocca
//    un campo (Sala e orari, preventivo, deducibilità, «rimanda»): lì la
//    preparazione non tocca niente, si misura quello che c'è.
//
// ⚠️ Fuori elenco la Lista della spesa: all'apertura il controllo del
//    sotto-soglia può scrivere righe (CLAUDE.md, 13/08), e questo strumento
//    non deve far scrivere il gestionale.
//
// `prepara` è codice della pagina: ha `clicca(testo)`, `imposta(campo,
// valore)`, `campoDi(etichetta)`, `campoEsatto(etichetta)`, e restituisce
// `true` oppure la ragione per cui non ha potuto.
// `id` dice da quale tabella prendere un identificativo per le rotte `:id`.

const FILTRI_DAL_AL = `
  const dal = campoEsatto("Dal") || campoDi("Dal");
  const al = campoEsatto("Al");
  if (!dal || !al) return "non trovo i filtri Dal/Al";
  imposta(dal, "2026-01-01");
  imposta(al, "2026-12-31");
  return true;
`;

export const ROTTE = [
  // --- Fatture Fornitori: il difetto certo ---
  {
    rotta: "/fatture-fornitori",
    nome: "Fatture Fornitori — filtri attivi",
    prepara: `
      const f = campoDi("Fornitore");
      if (!f) return "non trovo il filtro Fornitore";
      const o = [...f.options].find((x) => x.value);
      if (!o) return "sul progetto di prova non c'è nessun fornitore";
      imposta(f, o.value);
      ${FILTRI_DAL_AL}
    `,
  },
  {
    rotta: "/fatture-fornitori",
    nome: "Fatture Fornitori — nuova fattura",
    prepara: `return clicca("+ Aggiungi una fattura ricevuta") || "non trovo «+ Aggiungi una fattura ricevuta»";`,
  },
  {
    rotta: "/fatture-fornitori",
    nome: "Fatture Fornitori — nota di credito",
    prepara: `return clicca("Nota di credito") || "nessuna fattura con «Nota di credito» sulla prova";`,
  },
  // --- Cassa, Banca e Prima nota ---
  { rotta: "/cassa", nome: "Cassa — il cassetto" },
  { rotta: "/cassa/prima-nota", nome: "Prima nota — filtri attivi", prepara: FILTRI_DAL_AL },
  { rotta: "/cassa/sconti-omaggi", nome: "Sconti e omaggi" },
  { rotta: "/cassa/scontrinato", nome: "Incassato e scontrinato" },
  { rotta: "/cassa/personale", nome: "Sezione personale (anticipi)" },
  { rotta: "/cassa/previsione", nome: "Ce la faccio?" },
  { rotta: "/cassa/prestiti", nome: "Prestiti" },
  // --- Calendario Eventi: prenotazioni e preventivi ---
  { rotta: "/calendario-eventi", nome: "Prenotazioni — elenco" },
  { rotta: "/calendario-eventi/nuova", nome: "Prenotazioni — nuova" },
  { rotta: "/calendario-eventi/pianta", nome: "Pianta della giornata" },
  { rotta: "/calendario-eventi/sala-e-orari", nome: "Sala e orari" },
  { rotta: "/calendario-eventi/preventivi/:id", nome: "Preventivo — dettaglio", id: "preventivi" },
  { rotta: "/prenota", nome: "Prenotazione pubblica", pubblica: true },
  // --- Agenda ---
  { rotta: "/agenda/nuovo", nome: "Agenda — nuovo impegno" },
  // --- Magazzino e HACCP ---
  { rotta: "/magazzino/carico", nome: "Registra carico" },
  {
    rotta: "/magazzino/produzioni",
    nome: "Produzioni — registra",
    prepara: `const q = document.querySelector("[data-quadrotto]"); if (!q) return "nessuna preparazione sulla prova"; q.click(); return true;`,
  },
  {
    rotta: "/magazzino/fermi",
    nome: "Fermi — pannello di una partita",
    prepara: `const q = document.querySelector("[data-quadrotto], [data-riga]"); if (!q) return "nessuna partita sulla prova"; q.click(); return true;`,
  },
  {
    rotta: "/magazzino/allineamento",
    nome: "Allineamento — come sta andando",
    prepara: `return clicca("Come sta andando") || "non trovo «Come sta andando»";`,
  },
  { rotta: "/magazzino/cantina", nome: "Cantina — inventario" },
  { rotta: "/haccp/manuale", nome: "Manuale HACCP" },
  {
    rotta: "/haccp/raccolta-propria",
    nome: "Raccolta propria — nuova",
    prepara: `return clicca("+ Nuova raccolta") || "non trovo «+ Nuova raccolta»";`,
  },
  // --- Ricettario ed Editor menu ---
  { rotta: "/ricettario/menu/nuovo", nome: "Menu — nuovo" },
  { rotta: "/editor-menu/giorno", nome: "Piatti del giorno" },
  // --- Fiscale ---
  { rotta: "/fiscale/simulatore", nome: "Simulatore fiscale" },
  { rotta: "/fiscale/deduzioni", nome: "Deduzioni — nuova spesa" },
  { rotta: "/fiscale/deducibilita", nome: "Deducibilità" },
  {
    rotta: "/fiscale/strumenti",
    nome: "Catalogo strumenti — nuovo",
    prepara: `return clicca("+ Nuovo strumento") || "non trovo «+ Nuovo strumento»";`,
  },
  { rotta: "/fiscale/andamento", nome: "Andamento mensile" },
  // --- Personale ---
  { rotta: "/personale/mance", nome: "Mance" },
  { rotta: "/personale/:id", nome: "Dipendente — scheda", id: "employees" },
  // --- Documenti ---
  {
    rotta: "/documenti",
    nome: "Archivio documenti — nuovo",
    prepara: `return clicca("+ Nuovo documento") || "non trovo «+ Nuovo documento»";`,
  },
  { rotta: "/documenti/:id", nome: "Documento — scheda", id: "documents" },
  // --- Agricolo ---
  {
    rotta: "/agricolo",
    nome: "Agricolo — nuova coltura",
    prepara: `return clicca("+ Nuova coltura") || "non trovo «+ Nuova coltura»";`,
  },
  {
    rotta: "/agricolo/cessioni",
    nome: "Cessioni agricole — nuova",
    prepara: `return clicca("+ Nuova cessione") || "non trovo «+ Nuova cessione»";`,
  },
];
