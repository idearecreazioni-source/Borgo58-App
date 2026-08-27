import { describe, expect, it } from "vitest";
import { PARAMETRO, conCampi, indirizzoAMano } from "../../src/lib/calcoli/aMano";

// =====================================================================
// LA VIA D'USCITA A MANO — le regole, provate senza aprire una schermata
// =====================================================================
// 🔴 Decisione di Alessio del 27/08: *«se ti dico segna trenta euro pagati
//    al fornitore, mi aspetto che un collegamento mi porti dove si segnano
//    le spese, coi campi noti già compilati»*.

describe("l'indirizzo per finire a mano", () => {
  it("porta il solo identificativo, mai i campi", () => {
    const i = indirizzoAMano("/cassa/prima-nota", "abc-123");
    expect(i).toBe(`/cassa/prima-nota?${PARAMETRO}=abc-123`);
    // 🔴 Importi e nomi di fornitori NON finiscono in una query string:
    //    li chiede la schermata al database, dove non possono essere
    //    diversi da quelli dell'azione.
    expect(i).not.toMatch(/importo|30|fornitore/);
  });

  it("senza percorso non inventa un indirizzo a metà", () => {
    // È il caso della nota non capita: non si sa dove mandare. Un
    // collegamento che porta da nessuna parte è peggio di nessuno.
    expect(indirizzoAMano(null, "abc-123")).toBeNull();
    expect(indirizzoAMano("", "abc-123")).toBeNull();
  });

  it("senza identificativo non porta da nessuna parte", () => {
    expect(indirizzoAMano("/cassa/prima-nota", null)).toBeNull();
  });

  it("mette al riparo un identificativo con caratteri strani", () => {
    expect(indirizzoAMano("/x", "a b&c")).toBe(`/x?${PARAMETRO}=a%20b%26c`);
  });
});

describe("i campi capiti si applicano senza cancellare gli altri", () => {
  const MAPPA = { importo: "amount", verso: "direction", data: "movement_date" };

  it("scrive quello che è stato detto", () => {
    const fuori = conCampi(
      { amount: "", direction: "uscita", movement_date: "2026-08-26" },
      { importo: "30", verso: "uscita" },
      MAPPA,
    );
    expect(fuori.amount).toBe("30");
  });

  // 🔴 LA REGOLA CHE RENDE INNOCUO IL PRECOMPILAMENTO. Un campo che
  //    l'assistente non ha capito NON arriva, e quello che c'era — la data
  //    proposta dalla serata, il mezzo predefinito — deve restare.
  //    Sovrascrivere con un vuoto sarebbe peggio che non precompilare.
  it("NON sovrascrive con un vuoto ciò che non è stato detto", () => {
    const fuori = conCampi(
      { amount: "", direction: "uscita", movement_date: "2026-08-26" },
      { importo: "30" },
      MAPPA,
    );
    expect(fuori.movement_date).toBe("2026-08-26");
    expect(fuori.direction).toBe("uscita");
  });

  it("tratta la stringa vuota come «non detto», non come «cancella»", () => {
    const fuori = conCampi({ movement_date: "2026-08-26" }, { data: "" }, MAPPA);
    expect(fuori.movement_date).toBe("2026-08-26");
  });

  it("non tocca i campi che non sono nella mappa", () => {
    const fuori = conCampi({ note: "scritta a mano" }, { importo: "30" }, MAPPA);
    expect(fuori.note).toBe("scritta a mano");
  });

  it("non modifica l'oggetto che riceve", () => {
    const prima = { amount: "" };
    conCampi(prima, { importo: "30" }, MAPPA);
    expect(prima.amount).toBe("");
  });

  it("regge un'azione senza nessun campo", () => {
    expect(conCampi({ amount: "7" }, null, MAPPA)).toEqual({ amount: "7" });
    expect(conCampi({ amount: "7" }, {}, MAPPA)).toEqual({ amount: "7" });
  });

  // ⚠️ Uno zero È un valore detto: «giacenza zero» è la cosa più
  //    importante che si possa dire di un prodotto, e trattarlo come
  //    «non detto» lo farebbe sparire.
  it("uno zero è un valore, non un vuoto", () => {
    const fuori = conCampi({ amount: "5" }, { importo: 0 }, MAPPA);
    expect(fuori.amount).toBe(0);
  });
});
