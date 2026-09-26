import { describe, expect, it } from "vitest";
import { candidatiDellElemento, datiInChiaro } from "../../src/lib/calcoli/appunti";

// =====================================================================
// GLI IMPEGNI CHE POTREBBERO ESSERE QUELLO DETTO — 09/09/2026
// =====================================================================
// 🔴 QUANDO MEMO NON SA QUALE IMPEGNO SIA, non ne sceglie nessuno. Quello
//    che si prova qui è la metà che mancava: che **dica quali sono**, col
//    loro giorno. Prima diceva soltanto «quale dei 2», e chi lo leggeva
//    doveva andare in Agenda a cercarli — cioè rifare a mano il lavoro che
//    il gestionale aveva appena fatto.

const el = (candidati) => ({ dati: { titolo: "ordine verdure", impegni_possibili: candidati } });

describe("i candidati si leggono, col loro giorno", () => {
  it("titolo e giorno di ognuno", () => {
    const fuori = candidatiDellElemento(
      el([
        { titolo: "Ordine verdure", data: "2027-03-03" },
        { titolo: "Ordine delle verdure", data: "2027-03-04" },
      ])
    );
    expect(fuori).toHaveLength(2);
    expect(fuori[0].titolo).toBe("Ordine verdure");
    // ⚠️ Non si confronta con una stringa scritta a mano: il modo di
    //    scrivere una data lo decide `formatDate`, che è di tutta l'app.
    //    Quello che questa prova pretende è che il giorno CI SIA — e il
    //    difetto che coglierebbe è quello vero: un giorno che si perde per
    //    strada e lascia due titoli somiglianti senza niente che li
    //    distingua.
    expect(fuori[0].quando).toBeTypeOf("string");
    expect(fuori[0].quando).toContain("2027");
    expect(fuori[1].quando).toContain("2027");
    expect(fuori[0].quando).not.toBe(fuori[1].quando);
  });

  it("🔴 «senza scadenza» è un'informazione, e non si lascia vuota", () => {
    // Un impegno senza data è proprio una delle cose che lo distinguono
    // dagli altri: qui si pretende che il vuoto arrivi come vuoto
    // dichiarato (`null`), che la schermata scrive «senza scadenza».
    const fuori = candidatiDellElemento(el([{ titolo: "Ordine verdure", data: null }]));
    expect(fuori).toHaveLength(1);
    expect(fuori[0].quando).toBeNull();
  });

  it("senza candidati non inventa niente", () => {
    expect(candidatiDellElemento({ dati: {} })).toEqual([]);
    expect(candidatiDellElemento({})).toEqual([]);
    expect(candidatiDellElemento(null)).toEqual([]);
    expect(candidatiDellElemento(undefined)).toEqual([]);
  });

  it("una forma che non è un elenco non fa esplodere niente", () => {
    expect(candidatiDellElemento({ dati: { impegni_possibili: "due" } })).toEqual([]);
    expect(candidatiDellElemento({ dati: { impegni_possibili: 3 } })).toEqual([]);
  });

  it("un candidato senza titolo si scarta: una riga muta non aiuta a scegliere", () => {
    const fuori = candidatiDellElemento(
      el([
        { titolo: "  ", data: "2027-03-03" },
        { titolo: "Ordine verdure", data: "2027-03-04" },
      ])
    );
    expect(fuori).toHaveLength(1);
    expect(fuori[0].titolo).toBe("Ordine verdure");
  });
});

describe("🔴 i candidati NON stanno fra i dati che verrebbero scritti", () => {
  it("non compaiono nella riga dei dati concreti", () => {
    // ⚠️ È la ragione per cui `candidati` è fra i campi di servizio: i dati
    //    concreti sono «cosa verrebbe scritto approvando», e i candidati
    //    sono l'esatto contrario — la ragione per cui non si scrive niente.
    //    Mostrarli lì direbbe a chi firma che sta autorizzando due impegni.
    const chiaro = datiInChiaro({
      titolo: "ordine verdure",
      impegni_possibili: [{ titolo: "Ordine verdure", data: "2027-03-03" }],
    });
    expect(chiaro).toContain("ordine verdure");
    expect(chiaro).not.toContain("Ordine verdure");
    expect(chiaro.toLowerCase()).not.toContain("candidati");
  });

  it("...e un elemento fatto di soli candidati non ha niente da scrivere", () => {
    expect(datiInChiaro({ impegni_possibili: [{ titolo: "X", data: null }] })).toBe("");
  });
});
