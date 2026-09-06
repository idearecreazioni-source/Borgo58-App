import { describe, expect, it } from "vitest";
import {
  certezza,
  datiInChiaro,
  eta,
  nomeElemento,
  quantiElementi,
  riassunto,
  siPuoApprovare,
} from "../../src/lib/calcoli/appunti.js";

// SPEC-0013 — come si legge un appunto vocale.
//
// ⚠️ QUESTE PROVE GUARDANO LA REGOLA, NON IL DATABASE: che tre articoli
// finiscano davvero in un appunto solo lo prova `tests/app/appunti-vocali`,
// col database vero. Qui si prova cio' che si puo' affermare senza aprire
// niente — che l'appunto DICA la verita' operativa invece di riassumerla.

describe("i dati concreti che verrebbero scritti", () => {
  it("si leggono in chiaro, non riassunti", () => {
    expect(datiInChiaro({ verso: "uscita", importo: 30 })).toBe("verso: uscita · importo: 30");
  });

  it("🔴 lo ZERO si scrive, il vuoto no", () => {
    // 0 gradi e' la temperatura del pesce fresco: saltarlo perche' «e' falso»
    // toglierebbe dall'appunto proprio il dato che si sta approvando.
    expect(datiInChiaro({ gradi: 0, note: "", altro: null })).toBe("gradi: 0");
  });

  it("i campi di servizio non si mostrano: non sono contenuto", () => {
    expect(datiInChiaro({ nome_sentito: "parmareggio", quantita: 2 })).toBe("quantita: 2");
  });

  it("«nessun dato» si distingue da «dati non guardati»", () => {
    // Stringa vuota, e chi chiama lo dice a parole: approvando non si
    // scriverebbe nessun valore, ed e' una cosa da vedere PRIMA di firmare.
    expect(datiInChiaro({})).toBe("");
    expect(datiInChiaro(null)).toBe("");
  });
});

describe("la riga che dice dove va a finire", () => {
  it("destinazione e cose dentro, come nell'esempio della specifica", () => {
    const appunto = {
      titolo: "Spesa spicciola",
      elementi: [
        { dati: { nome_sentito: "parmigiano" } },
        { dati: { nome_libero: "shampoo" } },
      ],
    };
    expect(riassunto(appunto)).toBe("Spesa spicciola → parmigiano; shampoo");
  });

  it("il nome sentito vince sulla frase costruita", () => {
    // ⚠️ E' l'unico modo di accorgersi che si e' capito «parmigiano» dove
    //    lui aveva detto «parmareggio».
    expect(nomeElemento({ dati: { nome_sentito: "parmareggio" }, frase: "Parmigiano Reggiano" }))
      .toBe("parmareggio");
  });

  it("un appunto senza elementi resta leggibile", () => {
    expect(riassunto({ titolo: "Chiedere un preventivo", elementi: [] }))
      .toBe("Chiedere un preventivo");
  });
});

describe("🔴 le risposte sulla certezza sono TRE, non due", () => {
  it("sicuro", () => {
    expect(certezza({ eseguibile: true, incerto: false })).toBe("sicuro");
  });

  it("incerto: MEMO non e' sicuro di aver capito", () => {
    expect(certezza({ eseguibile: true, incerto: true })).toBe("incerto");
  });

  it("senza destinazione: MEMO ha capito, il gestionale non sa farlo", () => {
    // ⚠️ I due «no» si curano in modi diversi, quindi non si dicono uguale:
    //    confonderli farebbe cercare un errore di ascolto che non c'e'.
    expect(certezza({ eseguibile: false, incerto: false })).toBe("senza_destinazione");
    expect(certezza({ eseguibile: false, incerto: true })).toBe("senza_destinazione");
  });

  it("e solo il primo e il secondo si possono approvare", () => {
    expect(siPuoApprovare({ eseguibile: true, quanti: 1 })).toBe(true);
    expect(siPuoApprovare({ eseguibile: true, quanti: 2 })).toBe(true);
    expect(siPuoApprovare({ eseguibile: false, quanti: 3 })).toBe(false);
    expect(siPuoApprovare({ eseguibile: true, quanti: 0 })).toBe(false);
  });
});

describe("da quanto e' aperto, e quanto contiene", () => {
  it("sotto il giorno si contano le ore", () => {
    // Un appunto di stamattina e uno di venti minuti fa direbbero tutt'e due
    // «di oggi», e l'eta' serve proprio a distinguere cosa e' rimasto indietro.
    expect(eta(0, 0)).toBe("da poco");
    expect(eta(1, 0)).toBe("da un'ora");
    expect(eta(5, 0)).toBe("da 5 ore");
  });

  it("dal giorno in su l'ora non serve piu'", () => {
    expect(eta(30, 1)).toBe("da ieri");
    expect(eta(100, 4)).toBe("da 4 giorni");
    expect(eta(500, 20)).toBe("da 2 settimane");
    expect(eta(5000, 200)).toBe("da più di un mese");
  });

  it("il numero di elementi c'e' SEMPRE, anche quando e' uno", () => {
    // Mostrarlo solo da due in su farebbe sembrare l'appunto singolo una cosa
    // di natura diversa, mentre e' lo stesso oggetto con un elemento solo.
    expect(quantiElementi(1)).toBe("1 cosa");
    expect(quantiElementi(3)).toBe("3 cose");
    expect(quantiElementi(0)).toBe("niente dentro");
  });
});
