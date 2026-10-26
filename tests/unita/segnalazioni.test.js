import { describe, expect, it } from "vitest";
import {
  MASSIMO_COSA_SI_VEDEVA,
  rigaSegnalazione,
  testoAbbastanza,
  testoDellaSchermata,
} from "../../src/lib/calcoli/segnalazioni";

describe("il quaderno dei difetti", () => {
  it("porta con sé il momento in cui è nata", () => {
    const r = rigaSegnalazione("  il latte risulta vuoto  ", {
      indirizzo: "/magazzino",
      titolo: "Magazzino",
      testo: "Latte intero\n\n\n   0 l",
      larghezza: 390,
      pxcm: 64,
      database: "il database di prova",
    });
    expect(r).toEqual({
      testo: "il latte risulta vuoto",
      provenienza: "pulsante",
      schermata: "/magazzino",
      titolo_schermata: "Magazzino",
      cosa_si_vedeva: "Latte intero\n 0 l",
      contesto: { larghezza: 390, pxcm: 64, database: "il database di prova" },
    });
  });

  it("la provenienza si dice sempre, anche quando non è il pulsante", () => {
    expect(rigaSegnalazione("prova", {}, "voce").provenienza).toBe("voce");
  });

  it("senza contesto la segnalazione vale lo stesso", () => {
    const r = rigaSegnalazione("non si apre");
    expect(r.schermata).toBeNull();
    expect(r.cosa_si_vedeva).toBeNull();
    expect(r.contesto).toEqual({});
  });

  it("una schermata lunga si taglia invece di far rifiutare tutto", () => {
    const lungo = "a".repeat(MASSIMO_COSA_SI_VEDEVA + 500);
    expect(testoDellaSchermata(lungo)).toHaveLength(MASSIMO_COSA_SI_VEDEVA);
  });

  it("servono almeno tre lettere, come nel database", () => {
    expect(testoAbbastanza("  ok ")).toBe(false);
    expect(testoAbbastanza("non va")).toBe(true);
  });
});
