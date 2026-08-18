// I COLORI DELLA SALA — quelli del disegno e quelli della legenda, insieme.
//
// ⚠️ STANNO IN UN FILE SOLO PERCHÉ SONO LO STESSO FATTO DETTO A DUE
// TECNOLOGIE. La pianta è un disegno SVG e la legenda è testo HTML: non
// possono condividere una riga di codice, ma possono condividere questo file.
// Scritti in due posti, il colore del disegno e il quadratino che lo spiega
// divergerebbero alla prima ritoccata — e a divergere sarebbe la
// spiegazione, che è quella che nessuno riesegue.
//
// ⚠️ E IL SIGNIFICATO NON STA QUI: quale colore vince su quale è scritto in
// `calcoli/ritardo.js` (PRECEDENZA), che è anche il dato da cui la legenda
// costruisce le proprie righe. Qui ci sono solo le vernici.

export const COLORI = {
  libero: { riempimento: "var(--color-b58-parchment)", bordo: "var(--color-b58-charcoal)" },
  selezionato: {
    riempimento: "var(--color-b58-terracotta)",
    bordo: "var(--color-b58-terracotta-dark)",
  },
  // ⚠️ SCURO, E FINO AL 18/08 ERA DORATO. Il cambio non è estetico: dal giro
  // D2 le fasce arrivano anche in Comande, e lì il dorato vuol già dire
  // «primo giro». Sulla stessa schermata lo stesso quadratino avrebbe detto
  // «sono seduti» su un tavolo e «arriveranno presto» su quello accanto, e
  // nessuna legenda può disfare un'ambiguità così: chi guarda non ha modo di
  // sapere quale dei due sta guardando. Il terracotta della selezione resta
  // doppio (è anche la fascia «ultimo giro»), e lì l'ambiguità si scioglie da
  // sé — il tavolo selezionato è al massimo uno, ed è quello che hai appena
  // toccato tu.
  occupato: { riempimento: "var(--color-b58-charcoal-soft)", bordo: "var(--color-b58-charcoal)" },
  prenotato: { riempimento: "var(--color-b58-olive)", bordo: "var(--color-b58-olive-dark)" },
  // ⚠️ LE TRE FASCE DELLA SERATA (idea di Alessio, 14/08; il terzo colore
  // è del 18/08). Non è un vincolo e non impedisce niente: è l'ora resa
  // visibile senza doverla leggere.
  //   giallo  = arriva prima dell'ora del primo giro → il tavolo può
  //             servire una seconda volta;
  //   verde   = arriva a servizio avviato → il tavolo resta suo;
  //   arancio = arriva dopo l'ultimo ingresso → è l'ultimo turno, e può
  //             stare sullo stesso tavolo di un giallo.
  // ⚠️ I confini NON sono qui e non sono due ore fisse: vengono dagli
  // orari **di quel servizio** (`service_hours`). La domenica è pranzo, e
  // tre fasce calcolate sugli orari della cena direbbero «primo giro» a
  // chiunque pranzi.
  presto: { riempimento: "var(--color-b58-gold)", bordo: "var(--color-b58-gold-dark)" },
  pieno: { riempimento: "var(--color-b58-olive)", bordo: "var(--color-b58-olive-dark)" },
  tardi: { riempimento: "var(--color-b58-terracotta)", bordo: "var(--color-b58-terracotta-dark)" },
  // Mezzo e mezzo: sul tavolo c'è più di una fascia — tipicamente un
  // giallo e un arancio, che è proprio il secondo giro.
  misto: { riempimento: "url(#mezzoEmezzo)", bordo: "var(--color-b58-olive-dark)" },
  fisso: { riempimento: "var(--color-b58-cream-dark)", bordo: "var(--color-b58-charcoal-soft)" },
};

// Gli stessi colori, scritti come li capisce una pagina HTML. L'unica voce
// che cambia forma è «misto»: nel disegno è un riferimento a una sfumatura
// dell'SVG, che fuori dall'SVG non esiste.
export const CAMPIONI = {
  selezionato: "var(--color-b58-terracotta)",
  occupato: "var(--color-b58-charcoal-soft)",
  presto: "var(--color-b58-gold)",
  pieno: "var(--color-b58-olive)",
  tardi: "var(--color-b58-terracotta)",
  misto: "linear-gradient(90deg, var(--color-b58-gold) 50%, var(--color-b58-olive) 50%)",
  libero: "var(--color-b58-parchment)",
  fisso: "var(--color-b58-cream-dark)",
};

export const CAMPIONE_SBARRATO =
  "repeating-linear-gradient(45deg, var(--color-b58-parchment) 0 2px, var(--color-b58-charcoal) 2px 4px)";
