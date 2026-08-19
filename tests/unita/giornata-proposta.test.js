import { describe, expect, it } from "vitest";
import { serataDiServizio, serataScaduta } from "../../src/lib/calcoli/serata";
import { dataLocale } from "../../src/lib/constants";

// LA SECONDA METÀ DELLA REGOLA DELLE 5 — quello che la SCHERMATA propone.
//
// ⚠️ Le prove sui bordi della serata stanno già in `serata.test.js`. Qui si
// prova la cosa che quel file non poteva provare: che le due domande
// **danno due risposte diverse**, e che ognuna resta dove deve stare. Senza
// questa distinzione, «uniformare tutto alla serata» sembrerebbe una
// pulizia invece che un difetto.

const ORA = "05:00:00"; // nel programma arriva da service_settings, mai da qui

describe("Cassa e conti propongono la serata, il calendario resta calendario", () => {
  it("alle 00:30 le due risposte DIVERGONO, ed è il momento in cui conta", () => {
    const notte = new Date(2026, 7, 22, 0, 30);
    // Quello che propone una schermata di cassa o di conti…
    expect(serataDiServizio(notte, ORA)).toBe("2026-08-21");
    // …e quello che propone una di prenotazioni, turni, scadenze o HACCP.
    expect(dataLocale(notte)).toBe("2026-08-22");
  });

  it("alle 21 le due risposte COINCIDONO, ed è il motivo per cui il difetto non si vedeva", () => {
    const sera = new Date(2026, 7, 21, 21, 0);
    expect(serataDiServizio(sera, ORA)).toBe(dataLocale(sera));
  });

  it("il confine sposta la proposta: 04:59 e 05:01 non propongono la stessa giornata", () => {
    const prima = new Date(2026, 7, 22, 4, 59);
    const dopo = new Date(2026, 7, 22, 5, 1);
    expect(serataDiServizio(prima, ORA)).toBe("2026-08-21");
    expect(serataDiServizio(dopo, ORA)).toBe("2026-08-22");
    // ⚠️ E il calendario NON si sposta: è la metà che dimostra che il
    // confine agisce su una domanda sola. Senza, una funzione che spostasse
    // tutte e due passerebbe.
    expect(dataLocale(prima)).toBe(dataLocale(dopo));
  });
});

describe("La sala di Comande dice quando la serata è finita", () => {
  it("durante la serata non dice niente", () => {
    expect(serataScaduta("2026-08-21", new Date(2026, 7, 22, 2, 0), ORA)).toBe(false);
  });

  it("passato il confine lo dice — ed è il tablet ripreso la mattina", () => {
    expect(serataScaduta("2026-08-21", new Date(2026, 7, 22, 9, 0), ORA)).toBe(true);
  });

  it("il confine è quello di Alessio, non un numero scritto qui", () => {
    // ⚠️ Prova al contrario: con le 02:00 la stessa ora è già scaduta.
    // Se il confine fosse dentro la funzione, questa passerebbe lo stesso.
    const treDiNotte = new Date(2026, 7, 22, 3, 0);
    expect(serataScaduta("2026-08-21", treDiNotte, "05:00")).toBe(false);
    expect(serataScaduta("2026-08-21", treDiNotte, "02:00")).toBe(true);
  });

  it("senza l'ora non inventa un allarme", () => {
    // Se le impostazioni non si leggono, meglio nessun avviso che un avviso
    // costruito su un'ora immaginata.
    expect(serataScaduta("2026-08-21", new Date(2026, 7, 22, 9, 0), null)).toBe(false);
    expect(serataScaduta(null, new Date(2026, 7, 22, 9, 0), ORA)).toBe(false);
  });
});
