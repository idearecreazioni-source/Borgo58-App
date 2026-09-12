import { describe, expect, it } from "vitest";
import {
  RECIPE_STATI,
  STATI_PREPARAZIONE,
  etichettaStato,
  statiPerTipo,
  statoPerTipo,
} from "../../src/lib/constants";
import { costoPerUnitaDiResa } from "../../src/lib/calcoli/tipoRicetta";

// GLI STATI DIPENDONO DA CHE COSA È LA SCHEDA — 12/09/2026, mandato
// notturno, blocco A, corretto lo stesso giorno da Alessio: SOLO la
// preparazione ha stati suoi. Finger e selezioni si vendono e possono
// stare in carta: tengono i quattro stati del piatto.
//
// ⚠️ Ogni caso è scelto perché la risposta sbagliata sarebbe DIVERSA da
//    quella giusta: una preparazione pronta con la regola del piatto
//    direbbe «Pronta per la carta», con quella giusta «Pronta per l'uso»; un
//    finger pronto con la regola della preparazione direbbe il contrario.
describe("gli stati di una scheda secondo il suo tipo", () => {
  it("un piatto ha i quattro stati di sempre", () => {
    expect(statiPerTipo("piatto_finito")).toBe(RECIPE_STATI);
    expect(statiPerTipo("piatto_finito").map((s) => s.value)).toEqual([
      "in_sviluppo",
      "pronta",
      "in_carta",
      "ritirata",
    ]);
  });

  it("un finger resta da piatto: quattro stati, «In carta» compreso", () => {
    expect(statiPerTipo("finger")).toBe(RECIPE_STATI);
    expect(etichettaStato("finger", true, false, null).label).toBe("Pronta per la carta");
    expect(etichettaStato("finger", true, true, null).label).toBe("In carta");
  });

  it("la preparazione ne ha tre, e nessuno parla di carta", () => {
    const stati = statiPerTipo("preparazione");
    expect(stati).toBe(STATI_PREPARAZIONE);
    expect(stati.map((s) => s.value)).toEqual(["in_sviluppo", "pronta", "ritirata"]);
    expect(stati.some((s) => /carta/i.test(s.label))).toBe(false);
    expect(etichettaStato("preparazione", true, false, null).label).toBe("Pronta per l'uso");
  });

  it("una preparazione rimasta in un menu da prima resta «Pronta per l'uso», mai «In carta»", () => {
    // `in_carta` richiede `pronta_per_carta` (vincolo del database): se è
    // vero, la preparazione era stata segnata pronta.
    expect(statoPerTipo("preparazione", true, true, null)).toBe("pronta");
    expect(etichettaStato("preparazione", true, true, null).label).toBe("Pronta per l'uso");
  });

  it("«ritirata» vince in tutti i casi", () => {
    expect(statoPerTipo("preparazione", true, false, "2026-09-01")).toBe("ritirata");
    expect(statoPerTipo("piatto_finito", true, true, "2026-09-01")).toBe("ritirata");
    expect(statoPerTipo("finger", true, true, "2026-09-01")).toBe("ritirata");
  });

  it("un tipo che non si conosce si legge come un piatto, com'era prima", () => {
    expect(etichettaStato(undefined, true, false, null).label).toBe("Pronta per la carta");
    expect(etichettaStato(null, false, false, null).label).toBe("In sviluppo");
  });
});

describe("il costo di una preparazione per unità di resa", () => {
  it("totale di una dose diviso quanto ne viene", () => {
    // 12 € per 3 kg sono 4 €/kg: né 12 (il totale) né 36 (moltiplicato).
    expect(costoPerUnitaDiResa(12, 3)).toBe(4);
    expect(costoPerUnitaDiResa("6.4", "2")).toBe(3.2);
  });

  it("senza resa non c'è un numero: vuoto, mai zero", () => {
    expect(costoPerUnitaDiResa(12, null)).toBeNull();
    expect(costoPerUnitaDiResa(12, 0)).toBeNull();
    expect(costoPerUnitaDiResa(12, "")).toBeNull();
    expect(costoPerUnitaDiResa(null, 3)).toBeNull();
  });
});
