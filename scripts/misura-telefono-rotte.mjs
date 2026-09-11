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
// `verifica` è codice della pagina che restituisce un elenco di difetti in
// più, propri di quella schermata; `formeInPiu` aggiunge forme di schermo
// solo per lei.

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
  {
    rotta: "/personale/mance",
    nome: "Mance",
    // 🔴 DAL COLLAUDO SU IPHONE DELL'11/09: in «Distribuzione mensile» il
    //    campo Mese e il menu «Paghi con» si sovrapponevano. Chrome disegna
    //    il mese dentro la sua casella, Safari più largo: per questo la
    //    misura generale dava la schermata per corretta. La verifica qui
    //    sotto non guarda quanto è largo il mese — che da qui non si sa
    //    misurare per Safari — ma la REGOLA: sul telefono i due vanno a
    //    capo sempre, compatti, e non si toccano mai.
    // ⚠️ Col telefono largo (440 punti) in più: lì il vecchio codice li
    //    teneva affiancati anche in Chrome, cioè il caso delle fotografie.
    formeInPiu: [{ nome: "iPhone largo 440", larghezza: 440, altezza: 956, scala: 3, mobile: true }],
    verifica: `
      const titolo = [...document.querySelectorAll("h2")].find((h) => h.textContent.trim() === "Distribuzione mensile");
      if (!titolo) return ["non trovo «Distribuzione mensile»"];
      const box = titolo.parentElement;
      const mese = box.querySelector("input[type=month]");
      const etichettaPaghi = [...box.querySelectorAll("label")].find((l) => l.textContent.trim() === "Paghi con");
      const paghi = etichettaPaghi && etichettaPaghi.parentElement.querySelector("select");
      if (!mese || !paghi) return ["non trovo Mese e «Paghi con» (sulla prova servono dipendenti attivi)"];
      const d = [];
      const riga = mese.closest(".riga-campi");
      if (!riga || riga !== paghi.closest(".riga-campi")) {
        d.push("Mese e «Paghi con» non stanno nella stessa riga della regola comune (riga-campi)");
      }
      const pxcm = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--pxcm"));
      const finestra = document.documentElement.clientWidth;
      const a = mese.getBoundingClientRect();
      const b = paghi.getBoundingClientRect();
      const incrocio = (p, q) =>
        Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 1 && Math.min(p.right, q.right) - Math.max(p.left, q.left) > 1;
      if (incrocio(a, b)) d.push("Mese e «Paghi con» si sovrappongono");
      const aCapo = b.top >= a.bottom - 1;
      if (finestra < 640 && !aCapo) {
        d.push("sul telefono Mese e «Paghi con» stanno affiancati: il mese che Safari disegna più largo finisce sopra «Paghi con»");
      }
      if (!aCapo && b.left - a.right < 0.2 * pxcm) d.push("affiancati, ma senza spazio fra Mese e «Paghi con»");
      // ⚠️ COMPATTI vuol dire «larghi quanto il loro contenuto», non «sotto
      //    una percentuale della riga»: a 64 punti per cm il mese occupa
      //    256 punti su 310 perché è quanto chiede «settembre 2026» a quel
      //    testo — la prima stesura di questo controllo lo segnalava, e
      //    avrebbe spinto a tagliarlo. Stirato è un campo molto più largo del
      //    suo contenuto (misurato su una copia lasciata libera).
      const contenuto = (e) => {
        const c = e.cloneNode(true);
        if ("value" in e) c.value = e.value;
        c.style.cssText += ";position:absolute;visibility:hidden;width:auto;min-width:0;max-width:none";
        e.parentNode.appendChild(c);
        const w = c.getBoundingClientRect().width;
        c.remove();
        return w;
      };
      for (const [nome, el, r] of [["Mese", mese, a], ["Paghi con", paghi, b]]) {
        const serve = contenuto(el);
        if (r.width > serve + pxcm) {
          d.push("«" + nome + "» è stirato: " + r.width.toFixed(0) + " punti, il contenuto ne chiede " + serve.toFixed(0));
        }
      }
      if (aCapo) {
        const vuoto = etichettaPaghi.getBoundingClientRect().top - a.bottom;
        if (vuoto > 0.6 * pxcm) d.push("fra Mese e «Paghi con» resta un vuoto di " + vuoto.toFixed(0) + " punti");
        if (Math.abs(a.left - b.left) > 1) d.push("a capo, «Paghi con» non parte dallo stesso bordo di Mese");
      }
      return d;
    `,
  },
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
