import { describe, expect, it } from "vitest";
import { righeDaSalvare } from "../../src/lib/calcoli/lineePrevisione";

// Gli stessi due aiutanti della schermata, per provare la regola vera e non
// una sua copia.
const num = (v) => (v === "" || v == null ? 0 : Number(v));
const daPercento = (v) => num(v) / 100;
const salva = (righe) => righeDaSalvare(righe, { num, daPercento });

describe("quali linee della previsione si salvano", () => {
  it("🔴 UNA LINEA VECCHIA, SENZA CODICE, NON SPARISCE", () => {
    // È il difetto vero del 24/08, trovato salvando con le mani: filtrando
    // sul solo codice, correggendo una previsione scritta prima di quel
    // giorno le sue linee se ne andavano — e `aggiorna_scenario_proiezione`
    // rifà le righe da capo, quindi sparivano dal piano senza un errore.
    const dentro = [{ linea: "Aperitivi", quantita: "12", prezzoMedio: "7", costoPercento: "22", base: "per_giorno" }];
    const fuori = salva(dentro);
    expect(fuori).toHaveLength(1);
    expect(fuori[0].linea).toBe("Aperitivi");
    expect(fuori[0].codice).toBeNull();
    expect(fuori[0].quantita).toBe(12);
  });

  it("una riga con un codice porta con sé il nome proposto", () => {
    const fuori = salva([{ codice: "barattoli", forma: "a_pezzo", linea: "", quantita: "3", prezzoMedio: "8", costoPercento: "30" }]);
    expect(fuori[0].linea).toBe("Barattoli trasformati");
    expect(fuori[0].forma).toBe("a_pezzo");
    expect(fuori[0].costoPercento).toBeCloseTo(0.3, 4);
  });

  it("il nome scritto a mano VINCE su quello proposto", () => {
    // Se Alessio l'ha cambiato è perché nel suo foglio si chiama così, e
    // riscriverlo col nostro sarebbe cambiargli le parole sotto le mani.
    const fuori = salva([{ codice: "lounge", forma: "a_coperto", linea: "Aperitivo in giardino", quantita: "10", prezzoMedio: "25", costoPercento: "30" }]);
    expect(fuori[0].linea).toBe("Aperitivo in giardino");
    expect(fuori[0].codice).toBe("lounge");
  });

  it("una riga del tutto vuota non si salva", () => {
    // ⚠️ La controprova che discrimina: senza di lei, un filtro che
    // lasciasse passare tutto supererebbe le prove qui sopra — e ogni
    // «+ Aggiungi una riga» toccato per sbaglio finirebbe nel piano come
    // una linea da zero euro.
    expect(salva([{ codice: "", linea: "", quantita: "", prezzoMedio: "", costoPercento: "" }])).toEqual([]);
    expect(salva([{ codice: "  ", linea: "  " }])).toEqual([]);
  });

  it("una linea A ZERO si salva, perché è una scelta", () => {
    // 🔴 Regola n. 1 del disegno: *«chef table e barattoli devono poter
    // restare a zero»*. Scartare una riga a zero vorrebbe dire che il
    // gestionale decide al posto suo che quella linea non esiste — mentre
    // esiste, e non parte ancora.
    const fuori = salva([{ codice: "chef_table", forma: "a_coperto", linea: "", quantita: "0", prezzoMedio: "0", costoPercento: "0" }]);
    expect(fuori).toHaveLength(1);
    expect(fuori[0].quantita).toBe(0);
  });
});
