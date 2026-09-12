import { describe, it, expect } from "vitest";
import {
  CAUSALE_TASCA,
  SENZA_CAUSALE,
  campoDescrizione,
  causaleDaSalvare,
  causaleFissa,
  spaccaturaTasca,
  totaleTasca,
} from "../../src/lib/calcoli/tasca.js";

// SPEC-0005 — LA SPESA DALLA TASCA, DESCRITTA E NON CLASSIFICABILE.
//
// ⚠️ METÀ DI QUESTE PROVE GUARDA GLI ALTRI SOGGETTI, ed è la metà che conta:
//    il mandato dice «non cambiare Borgo 58 e Orto Borgo 58», e una regola
//    che cambia per tutti passerebbe lo stesso ogni prova scritta solo sulla
//    tasca. La rottura da temere non è «sulla tasca non funziona» — quella
//    si vede aprendo la schermata — è «funziona anche dove non doveva».

describe("il campo che descrive la spesa", () => {
  it("sulla tasca si chiama «Descrizione della spesa» e porta un esempio", () => {
    const c = campoDescrizione(true);
    expect(c.etichetta).toBe("Descrizione della spesa");
    expect(c.segnaposto).toBe("Abbonamento AI — nome del servizio, mese");
    expect(c.conEtichetta).toBe(true);
  });

  it("l'esempio nomina il mese, ma niente lo pretende: il testo resta libero", () => {
    // Decisione di Alessio, 06/09: il mese è consigliato, non obbligatorio.
    // La regola non espone nessuna convalida — se un giorno comparisse una
    // funzione che rifiuta una descrizione, questa prova diventerebbe il
    // posto dove accorgersene.
    const c = campoDescrizione(true);
    expect(c.segnaposto).toContain("mese");
    expect(Object.keys(c).sort()).toEqual(["conEtichetta", "etichetta", "segnaposto"]);
  });

  it("sugli altri soggetti NON cambia niente", () => {
    const c = campoDescrizione(false);
    expect(c.etichetta).toBe("Finalità aziendale");
    expect(c.segnaposto).toBe("Finalità aziendale (facoltativo, utile in verifica)");
    // Altrove il campo non prende un titolo: resta com'era, dentro il grigio.
    expect(c.conEtichetta).toBe(false);
  });

  it("le due risposte sono diverse fra loro", () => {
    // Se un domani qualcuno «semplificasse» facendo tornare sempre lo stesso
    // oggetto, le prove qui sopra passerebbero una per una e la specifica
    // sarebbe morta. Questa è la prova che le tiene separate.
    expect(campoDescrizione(true)).not.toEqual(campoDescrizione(false));
  });
});

describe("la causale sulla tasca", () => {
  it("è «Indeducibile», fissa", () => {
    expect(causaleFissa(true)).toBe("Indeducibile");
    expect(CAUSALE_TASCA).toBe("Indeducibile");
  });

  it("altrove non c'è nessuna causale fissa: resta il menu", () => {
    expect(causaleFissa(false)).toBeNull();
  });

  it("dalla tasca non si salva nessuna causale, nemmeno se ne arrivasse una", () => {
    // Il menu non c'è più, quindi non dovrebbe arrivare niente. Se arrivasse
    // — da una schermata rimasta indietro, da una voce dettata — non deve
    // passare lo stesso: la classificazione della tasca la decide il
    // database, e questa è l'unica risposta coerente con quello.
    expect(causaleDaSalvare(true, "una-causale-qualsiasi")).toBeNull();
    expect(causaleDaSalvare(true, "")).toBeNull();
  });

  it("sugli altri soggetti la causale scelta si salva come prima", () => {
    expect(causaleDaSalvare(false, "abc")).toBe("abc");
    // E il vuoto continua a valere «nessuna», non stringa vuota: è la forma
    // che il database si aspetta.
    expect(causaleDaSalvare(false, "")).toBeNull();
  });
});

describe("«Speso dalla tasca» — il totale e la sua spaccatura", () => {
  const righe = [
    { causale: SENZA_CAUSALE, totale: "120.00" },
    { causale: "Spesa alimentare", totale: "30.50" },
  ];

  it("il totale conta tutto, anche le uscite senza causale", () => {
    // Sono uscite vere: toglierle dal totale direbbe che dalla tasca è
    // uscito meno di quello che è uscito.
    expect(totaleTasca(righe)).toBeCloseTo(150.5, 2);
  });

  it("la riga «senza causale» non si mostra", () => {
    const viste = spaccaturaTasca(righe);
    expect(viste).toHaveLength(1);
    expect(viste[0].causale).toBe("Spesa alimentare");
  });

  it("un movimento vecchio con la sua causale continua a comparire", () => {
    // Si toglie l'assenza, non il dato: chi aveva scelto una causale prima
    // del 06/09 la ritrova.
    expect(spaccaturaTasca([{ causale: "Cancelleria", totale: "9" }])).toHaveLength(1);
  });

  it("se non resta niente da spaccare, la spaccatura è vuota e il totale no", () => {
    const sole = [{ causale: SENZA_CAUSALE, totale: "40" }];
    expect(spaccaturaTasca(sole)).toHaveLength(0);
    expect(totaleTasca(sole)).toBe(40);
  });

  it("niente letto è niente, non zero righe inventate", () => {
    // La lettura può non essere arrivata: `null` non deve diventare un
    // elenco vuoto che si legge «non è uscito niente». Qui il totale è 0
    // perché non c'è nulla da sommare, e la schermata mostra il numero solo
    // quando la lettura c'è stata.
    expect(spaccaturaTasca(null)).toEqual([]);
    expect(spaccaturaTasca(undefined)).toEqual([]);
    expect(totaleTasca(null)).toBe(0);
  });
});
