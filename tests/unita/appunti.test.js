import { describe, expect, it } from "vitest";
import {
  avvisoDellElemento,
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

// =====================================================================
// IL PROMEMORIA CHE AVVISA — Blocco 3 del mandato notturno, 10/09/2026
// =====================================================================
// 🔴 «APPROVA» È UNA FIRMA, e su un promemoria con avviso quello che si
//    firma non è un dato in tabella: è **un telefono che suonerà**. Quindi
//    quello che queste prove sorvegliano non è che il dato ci sia — è che
//    si LEGGA, e che le due date non si confondano fra loro.

describe("le due date di un promemoria non si confondono", () => {
  it("🔴 «data» è il giorno dell'impegno, «avviso_data» il giorno in cui suona", () => {
    // Chiamandole «data» e «avviso data» sembrerebbero la stessa cosa
    // scritta due volte: sono il giorno in cui la cosa succede e il giorno
    // in cui il telefono suona, e quasi sempre non coincidono.
    const riga = datiInChiaro({
      titolo: "Appuntamento in banca",
      data: "2026-09-13",
      avviso_data: "2026-09-12",
      avviso_ora: "15:00",
    });
    expect(riga).toContain("giorno: 13 set 2026");
    expect(riga).toContain("ti avviso il: 12 set 2026");
    expect(riga).toContain("alle: 15:00");
  });

  it("una data si scrive come la scrive il resto del gestionale", () => {
    // Una «2026-09-13» in mezzo a una frase italiana è un dato che chi
    // legge deve tradurre a mente — e chi traduce a mente sbaglia, su una
    // firma.
    expect(datiInChiaro({ data: "2026-09-13" })).toBe("giorno: 13 set 2026");
    // E i secondi di un'ora non dicono niente di più.
    expect(datiInChiaro({ avviso_ora: "15:00:00" })).toBe("alle: 15:00");
  });

  it("⚠️ un campo che nessuno ha battezzato compare lo stesso", () => {
    // Sparire sarebbe il difetto peggiore: chi firma non vedrebbe una cosa
    // che sta approvando.
    expect(datiInChiaro({ una_cosa_nuova: "x" })).toBe("una cosa nuova: x");
  });
});

describe("l'avviso che un appunto promette", () => {
  const el = (dati) => ({ dati });

  it("si legge in italiano, giorno e ora", () => {
    expect(avvisoDellElemento(el({ avviso_data: "2026-09-12", avviso_ora: "15:00" }))).toEqual({
      giorno: "12 set 2026",
      ora: "15:00",
    });
  });

  it("🔴 mezzo avviso non è un avviso: non si annuncia niente", () => {
    // Annunciare «ti avviso il 12» senza l'ora prometterebbe una notifica
    // che il gestionale non sa quando mandare — e infatti si rifiuta di
    // scriverla. La schermata non deve prometterla al posto suo.
    expect(avvisoDellElemento(el({ avviso_data: "2026-09-12" }))).toBeNull();
    expect(avvisoDellElemento(el({ avviso_ora: "15:00" }))).toBeNull();
  });

  it("senza avviso non c'è niente da dire, ed è il caso normale", () => {
    expect(avvisoDellElemento(el({ titolo: "Chiamare Tiziana" }))).toBeNull();
    expect(avvisoDellElemento(null)).toBeNull();
  });

  it("⚠️ e una forma che non si sa leggere non si mostra come un'ora", () => {
    // «verso sera» non è un'ora: stamparlo dentro «alle …» farebbe sembrare
    // che il gestionale abbia capito quando.
    expect(
      avvisoDellElemento(el({ avviso_data: "2026-09-12", avviso_ora: "verso sera" }))
    ).toBeNull();
    expect(avvisoDellElemento(el({ avviso_data: "sabato", avviso_ora: "15:00" }))).toBeNull();
  });
});
