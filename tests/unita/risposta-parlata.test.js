import { describe, expect, it } from "vitest";
import { fraseDaDire } from "../../src/lib/calcoli/voce";

// V2 (11/10/2026): cosa MEMO dice a voce dopo una giacenza dettata.
// Si prova la frase, non la voce: la voce è del browser, e va guardata su un
// telefono vero.

const g = (stato, frase, errore = null) => ({ tipo: "giacenza", stato, frase, errore });

describe("la risposta parlata delle giacenze", () => {
  it("ripete la riga dello schermo, e nient'altro", () => {
    expect(fraseDaDire([g("eseguita", "Passata di pomodoro Mutti: ce ne sono 4 kg")])).toBe(
      "Segnato. Passata di pomodoro Mutti: ce ne sono 4 kg."
    );
  });

  it("dice il rifiuto vero quando non l'ha segnato", () => {
    expect(fraseDaDire([g("fallita", "Farina: 3 kg", "Non trovo il prodotto")])).toBe(
      "Non l'ho segnato: Non trovo il prodotto."
    );
  });

  it("🔴 una giacenza in attesa non si dice «segnata»", () => {
    const f = fraseDaDire([g("in_attesa", "Olio: 2 l")]);
    expect(f).not.toMatch(/Segnato/);
    expect(f).toBe("Una giacenza aspetta che tu la guardi.");
  });

  it("le altre cose dettate non si dicono a voce", () => {
    expect(fraseDaDire([{ tipo: "promemoria", stato: "eseguita", frase: "Promemoria: pane" }])).toBeNull();
    expect(fraseDaDire([])).toBeNull();
  });

  it("più giacenze insieme in una frase sola, senza punti doppi", () => {
    expect(
      fraseDaDire([g("eseguita", "Olio: ce ne sono 2 l."), g("eseguita", "Sale: ce ne sono 1 kg")])
    ).toBe("Segnato. Olio: ce ne sono 2 l. Sale: ce ne sono 1 kg.");
  });
});
