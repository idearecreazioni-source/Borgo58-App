import { describe, expect, it } from "vitest";
import {
  dataLocale,
  meseLocale,
  primoDelMeseLocale,
  traGiorniLocale,
} from "../../src/lib/constants";

// Il difetto originale (audit 08/08/2026): fra mezzanotte e le 02:00 l'app
// datava tutto al giorno prima, perche' usava la data UTC. Per un'osteria
// che chiude all'una significava prima nota, HACCP e mance sul giorno
// sbagliato. Queste prove CONGELANO il comportamento corretto: se qualcuno
// reintroduce il calcolo UTC, falliscono.
//
// Presupposto dichiarato (vitest.config.js): orologio su Europe/Rome, lo
// stesso dei tablet del locale.
describe("date del locale, non di Greenwich", () => {
  // Fine servizio: 1 agosto 2026, ore 00:30 in Italia (ora legale, UTC+2).
  // In UTC sono ancora le 22:30 del 31 luglio.
  const fineServizio = new Date("2026-08-01T00:30:00+02:00");

  it("a fine servizio è già il 1° agosto, non il 31 luglio", () => {
    expect(dataLocale(fineServizio)).toBe("2026-08-01");
    // Controprova: il vecchio calcolo dava il giorno prima.
    expect(fineServizio.toISOString().slice(0, 10)).toBe("2026-07-31");
  });

  it("il mese di fine servizio è agosto", () => {
    expect(meseLocale(fineServizio)).toBe("2026-08");
  });

  it("il primo del mese è il 1° agosto (il riepilogo di cassa parte da lì)", () => {
    expect(primoDelMeseLocale(fineServizio)).toBe("2026-08-01");
  });

  it("fra 60 giorni è il 30 settembre; ieri era il 31 luglio", () => {
    expect(traGiorniLocale(60, fineServizio)).toBe("2026-09-30");
    expect(traGiorniLocale(-1, fineServizio)).toBe("2026-07-31");
  });

  it("capodanno con ora solare: anno e mese cambiano insieme", () => {
    const capodanno = new Date("2027-01-01T00:30:00+01:00");
    expect(dataLocale(capodanno)).toBe("2027-01-01");
    expect(meseLocale(capodanno)).toBe("2027-01");
    expect(primoDelMeseLocale(capodanno)).toBe("2027-01-01");
  });
});
