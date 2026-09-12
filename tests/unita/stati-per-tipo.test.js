import { describe, expect, it } from "vitest";
import {
  RECIPE_STATI,
  STATI_COMPONENTE,
  etichettaStato,
  statiPerTipo,
  statoPerTipo,
} from "../../src/lib/constants";

// GLI STATI DIPENDONO DA CHE COSA È LA SCHEDA — 12/09/2026, mandato
// notturno, blocco A. Un piatto va in carta; una preparazione e un finger
// no: il database li rifiuta in un menu dal 20/08.
//
// ⚠️ Ogni caso è scelto perché la risposta sbagliata sarebbe DIVERSA da
//    quella giusta: una preparazione pronta con la regola del piatto
//    direbbe «Pronta per la carta», con quella giusta «Pronta per l'uso».
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

  it("preparazione e finger ne hanno tre, e nessuno parla di carta", () => {
    for (const tipo of ["preparazione", "finger"]) {
      const stati = statiPerTipo(tipo);
      expect(stati).toBe(STATI_COMPONENTE);
      expect(stati.map((s) => s.value)).toEqual(["in_sviluppo", "pronta", "ritirata"]);
      expect(stati.some((s) => /carta/i.test(s.label))).toBe(false);
    }
    expect(etichettaStato("preparazione", true, false, null).label).toBe("Pronta per l'uso");
    expect(etichettaStato("piatto_finito", true, false, null).label).toBe("Pronta per la carta");
  });

  it("una preparazione rimasta in un menu da prima resta «Pronta per l'uso», mai «In carta»", () => {
    // `in_carta` richiede `pronta_per_carta` (vincolo del database): se è
    // vero, la preparazione era stata segnata pronta.
    expect(statoPerTipo("preparazione", true, true, null)).toBe("pronta");
    expect(etichettaStato("finger", true, true, null).label).toBe("Pronta per l'uso");
  });

  it("«ritirata» vince in tutti e due i casi", () => {
    expect(statoPerTipo("preparazione", true, false, "2026-09-01")).toBe("ritirata");
    expect(statoPerTipo("piatto_finito", true, true, "2026-09-01")).toBe("ritirata");
  });

  it("un tipo che non si conosce si legge come un piatto, com'era prima", () => {
    // ⚠️ `eComponente(undefined)` è vero (lì è il verso prudente per la
    //    resa); qui il verso prudente è non cambiare le parole a una riga
    //    letta senza il tipo — MEMO, uno storico.
    expect(etichettaStato(undefined, true, false, null).label).toBe("Pronta per la carta");
    expect(etichettaStato(null, false, false, null).label).toBe("In sviluppo");
  });
});
