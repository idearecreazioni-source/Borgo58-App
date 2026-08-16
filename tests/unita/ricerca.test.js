import { describe, expect, it } from "vitest";
import { filtroRicerca, valorePerFiltro } from "../../src/lib/calcoli/ricerca";

// Il testo digitato in una casella di ricerca finisce dentro un filtro di
// PostgREST, dove la virgola separa le condizioni. Cercare «Rossi, Mario»
// spezzava il filtro e tornava un errore di sintassi in faccia all'utente
// (archivio documenti, prenotazioni, clienti — tre schermate, la stessa
// riga copiata tre volte).
//
// Queste prove congelano la regola in un posto solo: se domani qualcuno
// «semplifica» l'escape, diventano rosse prima di arrivare in schermata.
describe("il testo cercato non deve spezzare il filtro", () => {
  it("mette il termine fra virgolette, cosi' la virgola resta dentro", () => {
    expect(valorePerFiltro("Rossi, Mario")).toBe('"%Rossi, Mario%"');
  });

  it("disinnesca le virgolette che l'utente ha scritto", () => {
    expect(valorePerFiltro('il "Circolo"')).toBe('"%il \\"Circolo\\"%"');
  });

  it("disinnesca la barra rovescia prima delle virgolette", () => {
    // Se si sfuggissero nell'ordine inverso, la barra aggiunta per la
    // virgoletta verrebbe a sua volta raddoppiata e il filtro cambierebbe
    // significato.
    expect(valorePerFiltro('a\\b"c')).toBe('"%a\\\\b\\"c%"');
  });

  it("toglie gli spazi ai bordi", () => {
    expect(valorePerFiltro("  mililli  ")).toBe('"%mililli%"');
  });

  it("regge parentesi e punti, che in un filtro sono riservati", () => {
    expect(valorePerFiltro("S.r.l.s. (Borgo 58)")).toBe('"%S.r.l.s. (Borgo 58)%"');
  });

  it("lascia passare il jolly per scelta: chi scrive % lo sta cercando", () => {
    expect(valorePerFiltro("sconto 50%")).toBe('"%sconto 50%%"');
  });

  it("un termine vuoto non produce spazzatura", () => {
    expect(valorePerFiltro("")).toBe('"%%"');
    expect(valorePerFiltro(null)).toBe('"%%"');
  });

  it("compone il filtro su piu' colonne con lo stesso termine", () => {
    expect(filtroRicerca(["name", "phone"], "Rossi, Mario")).toBe(
      'name.ilike."%Rossi, Mario%",phone.ilike."%Rossi, Mario%"'
    );
  });
});
