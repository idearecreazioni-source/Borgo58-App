import { describe, expect, it } from "vitest";
import { senzaRipetizioni } from "../../src/lib/calcoli/avvertenze";

// ⚠️ Le due avvertenze qui sotto sono quelle VERE, misurate a schermo il
// 24/08 su «Come sta andando» — non riscritte a memoria. Contengono
// entrambe la frase sull'IRAP, che è il caso che ha aperto il lavoro.
const IRAP =
  "Stima semplificata, ancora da confermare con la commercialista. " +
  "L'IRAP qui e' calcolata sull'utile come l'IRES, ma ha una base sua.";

const DUE_IMPOSTE = `27 conti incassati non hanno ancora un documento fiscale. ${IRAP}`;
const FINE_ANNO = `Stima a fine anno: quello che e' successo finora piu' quello che resta. ${IRAP}`;

describe("la stessa avvertenza, una volta sola", () => {
  it("la prima resta intera", () => {
    const [prima] = senzaRipetizioni([DUE_IMPOSTE, FINE_ANNO]);
    expect(prima).toBe(DUE_IMPOSTE);
  });

  // 🔴 IL CASO CHE HA APERTO IL LAVORO: la seconda perde la parte già
  // detta e tiene la propria.
  it("la seconda perde solo la parte già detta", () => {
    const [, seconda] = senzaRipetizioni([DUE_IMPOSTE, FINE_ANNO]);
    expect(seconda).toBe("Stima a fine anno: quello che e' successo finora piu' quello che resta.");
    expect(seconda).not.toMatch(/IRAP/);
  });

  // ⚠️ E il verso opposto conta quanto il primo: **il limite del numero
  // non deve sparire da tutte e due**. Se la prima perdesse la frase
  // sull'IRAP, quel numero resterebbe senza il suo limite dichiarato in
  // nessun punto della pagina — che è il difetto che quella frase esiste
  // per impedire.
  it("la frase non sparisce dalla pagina: resta nella prima", () => {
    const fuori = senzaRipetizioni([DUE_IMPOSTE, FINE_ANNO]);
    expect(fuori.join(" ")).toMatch(/IRAP/);
  });

  it("due avvertenze identiche: la seconda resta vuota", () => {
    expect(senzaRipetizioni([IRAP, IRAP])).toEqual([IRAP, ""]);
  });

  it("avvertenze senza niente in comune restano intere", () => {
    const a = "Prima cosa.";
    const b = "Seconda cosa.";
    expect(senzaRipetizioni([a, b])).toEqual([a, b]);
  });

  // ⚠️ Un apostrofo diverso non fa una frase nuova: la stessa frase può
  // arrivare da due funzioni del database scritte in momenti diversi.
  it("un apostrofo tipografico non basta a farla passare due volte", () => {
    const dritto = "L'IRAP e' calcolata sull'utile.";
    const curvo = "L’IRAP e’ calcolata sull’utile.";
    expect(senzaRipetizioni([dritto, curvo])[1]).toBe("");
  });

  // ⚠️ PROPRIETA', non quantità: su una pagina senza avvertenze la
  // funzione non deve rompersi né inventare righe.
  it("nessuna avvertenza, nessuna riga", () => {
    expect(senzaRipetizioni([])).toEqual([]);
    expect(senzaRipetizioni(null)).toEqual([]);
    expect(senzaRipetizioni([null, undefined, ""])).toEqual(["", "", ""]);
  });
});
