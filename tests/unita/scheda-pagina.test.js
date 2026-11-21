import { describe, expect, it } from "vitest";
import {
  CARATTERI_MASSIMI,
  SEZIONI,
  TESTO_MASSIMO,
  VOCI_MASSIME,
  avvisoParoleDelicate,
  chiaveNuova,
  contatoreTesto,
  daRivedere,
  dataItaliana,
  frasiDelloStorico,
  messaggioDelDatabase,
  ordineInFondo,
  raggruppaVoci,
  riferimentoVoce,
  riquadroLimiti,
} from "../../src/lib/calcoli/scheda";

// La pagina della Scheda di Borgo 58 (pezzo S3, 21/11/2026): le regole pure.

const voce = (n, extra = {}) => ({ id: `v${n}`, numero: n, sezione: "fornitori", testo: `Voce ${n}`, fonte: "confermato", attiva: true, ordine: 0, ...extra });

describe("i limiti sono quelli del database", () => {
  it("60 voci, 10.000 caratteri, 300 a voce", () => {
    expect([VOCI_MASSIME, CARATTERI_MASSIMI, TESTO_MASSIMO]).toEqual([60, 10000, 300]);
  });

  it("le sezioni sono le otto del database, nello stesso ordine", () => {
    expect(SEZIONI.map((s) => s.valore)).toEqual([
      "titolare", "societa", "locale", "concept", "fornitori", "consulenti", "decisioni", "come_rispondere",
    ]);
  });
});

describe("il contatore del testo di una voce", () => {
  it("dice quanti caratteri restano e quanti sono di troppo", () => {
    expect(contatoreTesto("abc")).toEqual({ scritti: 3, restanti: 297, oltre: 0 });
    expect(contatoreTesto("x".repeat(300)).oltre).toBe(0);
    expect(contatoreTesto("x".repeat(305))).toEqual({ scritti: 305, restanti: 0, oltre: 5 });
    expect(contatoreTesto(null).scritti).toBe(0);
  });
});

describe("l'elenco per sezione", () => {
  it("mette le voci attive nella sezione giusta, ordinate, e le spente a parte", () => {
    const { sezioni, spente } = raggruppaVoci([
      voce(3, { ordine: 20 }), voce(1, { ordine: 20 }), voce(2, { ordine: 10 }),
      voce(4, { sezione: "locale" }), voce(5, { attiva: false }),
    ]);
    expect(sezioni.find((s) => s.valore === "fornitori").voci.map((v) => v.numero)).toEqual([2, 1, 3]);
    expect(sezioni.find((s) => s.valore === "locale").voci.map((v) => v.numero)).toEqual([4]);
    expect(spente.map((v) => v.numero)).toEqual([5]);
  });

  it("una Scheda vuota o non letta non rompe niente", () => {
    expect(raggruppaVoci([]).sezioni.every((s) => s.voci.length === 0)).toBe(true);
    expect(raggruppaVoci(null).spente).toEqual([]);
  });

  it("una voce nuova va in fondo alla sua sezione", () => {
    expect(ordineInFondo([voce(1, { ordine: 10 }), voce(2, { ordine: 30 }), voce(3, { sezione: "locale", ordine: 99 })], "fornitori")).toBe(40);
    expect(ordineInFondo([], "locale")).toBe(10);
  });

  it("il riferimento è quello che MEMO cita", () => {
    expect(riferimentoVoce({ numero: 12 })).toBe("[S12]");
  });
});

describe("la chiave interna", () => {
  it("la fa la pagina: senza accenti, senza simboli, con una coda che evita i doppioni", () => {
    expect(chiaveNuova("fornitori", "Ortofrutta Rossi: consegna il martedì!", 0)).toBe("fornitori:ortofrutta-rossi-consegna-il-martedi-0000");
    expect(chiaveNuova("locale", "???", 0.5)).toMatch(/^locale:voce-[0-9a-z]{4}$/);
    expect(chiaveNuova("locale", "Stessa frase", 0.1)).not.toBe(chiaveNuova("locale", "Stessa frase", 0.9));
  });
});

describe("da rivedere", () => {
  it("scatta solo per una voce attiva con la data già passata", () => {
    expect(daRivedere(voce(1, { rivedere_entro: "2026-11-01" }), "2026-11-21")).toBe(true);
    expect(daRivedere(voce(1, { rivedere_entro: "2026-11-21" }), "2026-11-21")).toBe(false);
    expect(daRivedere(voce(1, { rivedere_entro: "2026-11-01", attiva: false }), "2026-11-21")).toBe(false);
    expect(daRivedere(voce(1), "2026-11-21")).toBe(false);
  });

  it("le date si scrivono all'italiana", () => {
    expect(dataItaliana("2026-11-03")).toBe("03/11/2026");
    expect(dataItaliana(null)).toBe("");
  });
});

describe("il riquadro dei limiti", () => {
  it("mostra i numeri del database e avvisa quando è quasi piena", () => {
    expect(riquadroLimiti({ voci: 12, caratteri: 3400 }).quasiPiena).toBe(false);
    expect(riquadroLimiti({ voci: 12, caratteri: 3400 }).frase).toBeNull();
    expect(riquadroLimiti({ voci: 55, caratteri: 3400 }).quasiPiena).toBe(true);
    expect(riquadroLimiti({ voci: 5, caratteri: 9100 }).frase).toMatch(/quasi piena/);
  });

  it("se i contatori non si sono letti non inventa uno zero", () => {
    expect(riquadroLimiti(null)).toBeNull();
  });
});

describe("i rifiuti del database, in parole semplici", () => {
  it("lascia com'erano i messaggi che il database scrive già in italiano", () => {
    const pieno = "La Scheda ha già 60 voci attive: spegni una voce prima di aggiungerne o riattivarne un'altra.";
    expect(messaggioDelDatabase({ message: pieno })).toBe(pieno);
    const troppo = "Il testo composto per MEMO supera il limite di 10.000 caratteri di 120 caratteri.";
    expect(messaggioDelDatabase({ message: troppo })).toBe(troppo);
    expect(messaggioDelDatabase({ message: "La Scheda non accetta IBAN, codici fiscali di persona o numeri di carta." })).toMatch(/IBAN/);
  });

  it("traduce i vincoli tecnici", () => {
    expect(messaggioDelDatabase({ message: 'duplicate key value violates unique constraint "scheda_voci_chiave_attiva_unica"' })).toMatch(/già una voce attiva/);
    expect(messaggioDelDatabase({ message: 'new row violates check constraint "scheda_voce_testo_corto"' })).toMatch(/300 caratteri/);
    expect(messaggioDelDatabase({ message: "new row violates row-level security policy" })).toMatch(/titolare/);
  });

  it("un errore sconosciuto non mostra il gergo", () => {
    expect(messaggioDelDatabase({ message: "ERROR: 42P01 relation does not exist" })).toBe("Non è stato salvato. Riprova tra un momento.");
    expect(messaggioDelDatabase(null)).toBe("Non è stato salvato. Riprova tra un momento.");
  });
});

describe("le parole delicate avvisano e non vietano", () => {
  it("nessuna parola, nessun avviso", () => {
    expect(avvisoParoleDelicate([])).toBeNull();
    expect(avvisoParoleDelicate(null)).toBeNull();
  });

  it("elenca le parole e dice che si può salvare lo stesso", () => {
    const una = avvisoParoleDelicate(["debito"]);
    expect(una).toContain("(debito)");
    expect(una).toContain("Puoi salvare lo stesso");
    expect(avvisoParoleDelicate(["debito", "salute", "causa"])).toContain("(debito, salute e causa)");
  });
});

describe("lo storico di una voce", () => {
  it("racconta cosa è cambiato", () => {
    expect(frasiDelloStorico({ testo_prima: null, testo_dopo: "Nuova" })).toEqual(["Voce creata."]);
    expect(frasiDelloStorico({ testo_prima: "a", testo_dopo: "b" })).toEqual(["Testo cambiato."]);
    expect(frasiDelloStorico({ testo_prima: "a", testo_dopo: "a", attiva_prima: true, attiva_dopo: false })).toEqual(["Spenta."]);
    expect(frasiDelloStorico({ testo_prima: "a", testo_dopo: "a", attiva_prima: false, attiva_dopo: true })).toEqual(["Riaccesa."]);
    expect(frasiDelloStorico({ testo_prima: "a", testo_dopo: "a", fonte_prima: "riferito", fonte_dopo: "confermato" })[0]).toContain("«Riferito» a «Confermato da te»");
  });
});
