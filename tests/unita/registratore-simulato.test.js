import { describe, expect, it } from "vitest";
import { ESITI, scontrinoEmesso } from "../../src/lib/registratore";
import { GUASTI, creaRegistratoreSimulato } from "../../src/lib/registratoreSimulato";

// IL REGISTRATORE CHE SI RIFIUTA DI STAMPARE — blocco 2 del mandato.
//
// ⚠️ Queste prove sono PURE: non toccano il database. Provano che il finto
// registratore riproduca davvero i modi di fallire — che è la condizione
// perché le prove sul gestionale (quelle che toccano i conti) significhino
// qualcosa. Un simulatore che risponde sempre «fatto» le farebbe passare
// tutte senza misurare niente.

const CONTO = "conto-1";

describe("i guasti che il protocollo SA riportare", () => {
  it.each([
    [GUASTI.MUTO, ESITI.MUTO],
    [GUASTI.A_META, ESITI.A_META],
    [GUASTI.ERRORE, ESITI.ERRORE],
    [GUASTI.NON_COLLEGATO, ESITI.NON_COLLEGATO],
  ])("con il guasto «%s» lo scontrino NON risulta emesso", async (guasto, atteso) => {
    const r = creaRegistratoreSimulato({ guasto });
    const risposta = await r.emettiScontrino({ id: CONTO });
    expect(risposta.esito).toBe(atteso);
    // ⚠️ È la domanda che conta: non «cosa ha risposto», ma «è uscito?»
    expect(scontrinoEmesso(risposta)).toBe(false);
    expect(r.cartaUscitaPer(CONTO)).toBe(0);
  });

  it("senza guasti esce uno scontrino, e uno solo", async () => {
    const r = creaRegistratoreSimulato();
    const risposta = await r.emettiScontrino({ id: CONTO });
    expect(scontrinoEmesso(risposta)).toBe(true);
    expect(r.cartaUscitaPer(CONTO)).toBe(1);
  });
});

describe("🔴 i due guasti che il protocollo NON sa riportare", () => {
  it("PAGINA BIANCA: risposta perfetta, e dalla stampante non è uscito niente", async () => {
    const r = creaRegistratoreSimulato({ guasto: GUASTI.PAGINA_BIANCA });
    const risposta = await r.emettiScontrino({ id: CONTO });

    // Dal lato del gestionale è indistinguibile da una stampa riuscita…
    expect(risposta.esito).toBe(ESITI.FATTO);
    expect(risposta.numero).toBeTruthy();
    expect(scontrinoEmesso(risposta)).toBe(true);

    // …e invece la carta è bianca.
    expect(r.cartaUscitaPer(CONTO)).toBe(0);
  });

  it("⚠️ e questo è il punto: NESSUN controllo sulla risposta può accorgersene", async () => {
    const buono = creaRegistratoreSimulato();
    const bianca = creaRegistratoreSimulato({ guasto: GUASTI.PAGINA_BIANCA });
    const a = await buono.emettiScontrino({ id: CONTO });
    const b = await bianca.emettiScontrino({ id: CONTO });

    // Le due risposte sono la STESSA COSA, campo per campo.
    expect({ esito: b.esito, haNumero: !!b.numero }).toEqual({ esito: a.esito, haNumero: !!a.numero });
    // La differenza esiste solo sulla carta, cioè solo per un occhio in sala.
    expect(buono.cartaUscitaPer(CONTO)).toBe(1);
    expect(bianca.cartaUscitaPer(CONTO)).toBe(0);
  });

  it("DOPPIA STAMPA: due scontrini sulla carta, una risposta sola", async () => {
    const r = creaRegistratoreSimulato({ guasto: GUASTI.DOPPIA_STAMPA });
    const risposta = await r.emettiScontrino({ id: CONTO });

    expect(scontrinoEmesso(risposta)).toBe(true);
    expect(r.cartaUscitaPer(CONTO)).toBe(2);
    // ⚠️ Il gestionale ne conosce UNO: se contasse gli incassi dalla carta
    // invece che dai conti chiusi, questo li raddoppierebbe.
    expect(r.risposte).toHaveLength(1);
  });
});

describe("⚠️ i numeri non si ripetono", () => {
  it("due conti diversi prendono due numeri diversi", async () => {
    const r = creaRegistratoreSimulato();
    const a = await r.emettiScontrino({ id: "conto-a" });
    const b = await r.emettiScontrino({ id: "conto-b" });
    expect(a.numero).not.toBe(b.numero);
  });

  it("anche la doppia stampa consuma due numeri, non uno", async () => {
    // ⚠️ Un registratore vero incrementa il progressivo a ogni foglio: se il
    // simulatore ne consumasse uno solo, la prova sulla ristampa (blocco 3)
    // girerebbe su una numerazione che nella realtà non esiste.
    const r = creaRegistratoreSimulato({ guasto: GUASTI.DOPPIA_STAMPA });
    await r.emettiScontrino({ id: CONTO });
    expect(r.stampate.map((s) => s.numero)).toEqual(["0001", "0002"]);
  });
});
