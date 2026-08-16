// Il testo che si scrive in una casella di ricerca finisce dentro un
// filtro «o questo o quello» di PostgREST, che ha una sintassi propria:
// le condizioni sono separate da VIRGOLE e raccolte fra PARENTESI.
//
// Scrivendolo grezzo, cercare «Rossi, Mario» spezzava il filtro a metà e
// tornava un errore di sintassi in faccia. Non era un buco di sicurezza —
// la RLS regge comunque, e non si può leggere niente che non si potesse
// già leggere — era una ricerca che si rompeva su un carattere che in un
// nome ci sta benissimo.
//
// La cura: il valore si mette fra virgolette doppie, che è il modo che
// PostgREST prevede per i valori con dentro caratteri riservati; le
// virgolette e le barre rovesce che l'utente avesse scritto si
// disinnescano con una barra rovescia davanti.
//
// ⚠️ Il carattere `%` NON viene disinnescato, ed è voluto: in `ilike` è
// il jolly, e chi scrive «pomo%» sta cercando apposta. Cambiarlo sarebbe
// una decisione di prodotto, non la riparazione di un errore.
export function valorePerFiltro(testo) {
  const pulito = String(testo ?? "").trim().replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"%${pulito}%"`;
}

// Costruisce il filtro «o questo o quello» su più colonne, con lo stesso
// termine cercato in tutte. Sta qui e non in tre moduli diversi: una
// regola di escape scritta tre volte è una regola che prima o poi viene
// corretta in due posti su tre.
export function filtroRicerca(colonne, testo) {
  const valore = valorePerFiltro(testo);
  return colonne.map((c) => `${c}.ilike.${valore}`).join(",");
}
