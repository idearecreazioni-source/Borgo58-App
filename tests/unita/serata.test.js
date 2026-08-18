import { describe, expect, it } from "vitest";
import { serataDiServizio } from "../../src/lib/calcoli/serata";

// «Quale sera è questa» — provata AI BORDI, e nei due versi.
//
// ⚠️ Un solo verso non discrimina: una funzione che restituisse sempre
// «ieri» passerebbe la prova delle 00:30, e una che restituisse sempre
// «oggi» passerebbe quella delle 05:30. Servono entrambe.

const ORA = "05:00:00"; // il valore di Alessio, che nel programma arriva da service_settings

describe("Quale sera è questa", () => {
  it("alle 00:30 è ancora la sera prima", () => {
    expect(serataDiServizio(new Date(2026, 7, 19, 0, 30), ORA)).toBe("2026-08-18");
  });

  it("alle 04:59 è ancora la sera prima — l'ultimo minuto", () => {
    expect(serataDiServizio(new Date(2026, 7, 19, 4, 59), ORA)).toBe("2026-08-18");
  });

  it("alle 05:01 è il giorno nuovo — il primo minuto", () => {
    expect(serataDiServizio(new Date(2026, 7, 19, 5, 1), ORA)).toBe("2026-08-19");
  });

  it("alle 05:00 in punto è già il giorno nuovo", () => {
    // Il confine appartiene al giorno nuovo: «fino alle 5» esclude le 5.
    expect(serataDiServizio(new Date(2026, 7, 19, 5, 0), ORA)).toBe("2026-08-19");
  });

  it("in pieno servizio, alle 21, è la sera di oggi", () => {
    expect(serataDiServizio(new Date(2026, 7, 18, 21, 0), ORA)).toBe("2026-08-18");
  });

  it("attraversa il cambio di mese e di anno senza inventarsi date", () => {
    expect(serataDiServizio(new Date(2027, 0, 1, 1, 0), ORA)).toBe("2026-12-31");
    expect(serataDiServizio(new Date(2026, 8, 1, 2, 0), ORA)).toBe("2026-08-31");
  });

  it("l'ora del confine è un dato, non una costante di questo file", () => {
    // ⚠️ La prova che conta se un giorno Alessio cambia idea: cambiando il
    // parametro il risultato cambia. Se l'ora fosse scritta dentro la
    // funzione, questa prova passerebbe lo stesso — ed è per questo che è
    // scritta al contrario.
    const notte = new Date(2026, 7, 19, 3, 0);
    expect(serataDiServizio(notte, "05:00")).toBe("2026-08-18");
    expect(serataDiServizio(notte, "02:00")).toBe("2026-08-19");
  });
});
