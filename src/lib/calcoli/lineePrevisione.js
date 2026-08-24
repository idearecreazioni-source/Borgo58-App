import { LINEE_PREVISIONE, labelFor } from "../constants";

// QUALI RIGHE DELLE LINEE SI SALVANO, E COME — 24/08/2026.
//
// 🔴 STA IN UNA FUNZIONE PURA PER UNA RAGIONE PRECISA, ed è la stessa di
// `payloadMancia` (16/08): questo è il tratto **fra la schermata e il
// database**, quello che né le prove sul database né la revisione del
// codice guardano. E quando qui si sbaglia, si sbaglia in silenzio.
//
// 🔴 IL DIFETTO CHE L'HA FATTA NASCERE, trovato salvando davvero e non
// rileggendo: il primo filtro teneva solo le righe con un **codice**, e le
// linee scritte prima del 24/08 un codice non ce l'hanno. Correggendo una
// previsione vecchia, `aggiorna_scenario_proiezione` rifà le righe da capo
// — quindi quelle linee **sparivano dal piano**. Nessun errore, nessun
// avviso: una linea di ricavo in meno. Provato: la riga «Aperitivi» di una
// previsione di collaudo se n'è andata davvero.
//
// ⚠️ Lint pulito, build riuscita, 394 prove verdi. L'ha trovata un
// salvataggio fatto con le mani.

/**
 * Le righe da mandare al database, dalle righe della schermata.
 *
 * Vale una riga che ha un **codice** (scelto dall'elenco) oppure un
 * **nome** (com'erano quelle di prima): scartare le seconde vorrebbe dire
 * perderle correggendo una previsione vecchia.
 */
export function righeDaSalvare(righe, { num, daPercento }) {
  return (righe ?? [])
    .filter((a) => (a.codice ?? "").trim() || (a.linea ?? "").trim())
    .map((a) => ({
      codice: a.codice || null,
      forma: a.forma || null,
      // Il nome scritto vince su quello proposto: se Alessio l'ha
      // cambiato, è perché nel suo foglio si chiama così.
      linea: (a.linea ?? "").trim() || labelFor(LINEE_PREVISIONE, a.codice),
      quantita: num(a.quantita),
      prezzoMedio: num(a.prezzoMedio),
      costoPercento: daPercento(a.costoPercento),
      base: a.base,
    }));
}
