import { describe, expect, it } from "vitest";
import {
  avvisoFonte,
  dettaglioProposta,
  etichettaTipoProposta,
  fraseNessunaProposta,
  frasePerLaFonte,
  messaggioDellaDecisione,
  ordinaProposte,
  puoCorreggere,
  scadenzaProposta,
  testoCorrettoValido,
} from "../../src/lib/calcoli/scheda-proposte";
import { messaggioDelDatabase } from "../../src/lib/calcoli/scheda";

// Le proposte di MEMO per la Scheda (pezzo B1, 21/11/2026): le regole pure.

const proposta = (extra = {}) => ({
  id: "p1", tipo: "aggiungi", chiave: "fornitori:forn-00000001", sezione: "fornitori",
  testo_prima: null, testo_dopo: "Nuovo fornitore.", fonte_prima: null, fonte_dopo: "riferito",
  abbassa_fonte: false, creata_il: "2026-11-21T09:00:00Z", scade_il: "2026-12-21", ...extra,
});

describe("i tipi di proposta", () => {
  it("hanno parole semplici", () => {
    expect(etichettaTipoProposta("aggiungi")).toBe("Aggiungere alla Scheda");
    expect(etichettaTipoProposta("modifica")).toBe("Aggiornare una voce");
    expect(etichettaTipoProposta("spegni")).toBe("Spegnere una voce");
    expect(etichettaTipoProposta("riconferma")).toBe("Riconfermare una voce");
    expect(etichettaTipoProposta("boh")).toBe("Proposta");
  });

  it("Correggi si offre solo dove c'è un testo nuovo", () => {
    expect(puoCorreggere({ tipo: "aggiungi" })).toBe(true);
    expect(puoCorreggere({ tipo: "modifica" })).toBe(true);
    expect(puoCorreggere({ tipo: "spegni" })).toBe(false);
    expect(puoCorreggere({ tipo: "riconferma" })).toBe(false);
    expect(puoCorreggere(null)).toBe(false);
  });
});

describe("cosa si mostra «prima → dopo»", () => {
  it("una voce nuova non mostra mai un numero [S#] e dice in che sezione andrebbe", () => {
    const d = dettaglioProposta(proposta());
    expect(d.prima).toBeNull();
    expect(d.dopo).toBe("Nuovo fornitore.");
    expect(d.etichettaDopo).toBe("Nuova voce in «I fornitori»");
    expect(JSON.stringify(d)).not.toMatch(/\[S\d+\]/);
  });

  it("una modifica mostra il testo di adesso e quello nuovo", () => {
    const d = dettaglioProposta(proposta({ tipo: "modifica", testo_prima: "Prima.", testo_dopo: "Dopo." }));
    expect(d).toMatchObject({ prima: "Prima.", dopo: "Dopo." });
  });

  it("spegnere e riconfermare mostrano solo la voce com'è", () => {
    expect(dettaglioProposta(proposta({ tipo: "spegni", testo_prima: "Voce." }))).toMatchObject({ prima: "Voce.", dopo: null });
    expect(dettaglioProposta(proposta({ tipo: "riconferma", testo_prima: "Voce.", testo_dopo: "Voce." }))).toMatchObject({ prima: "Voce.", dopo: null });
  });
});

describe("la fonte non scende in silenzio", () => {
  it("avvisa quando la fonte scende, con le parole della pagina", () => {
    const frase = avvisoFonte(proposta({ abbassa_fonte: true, fonte_prima: "confermato", fonte_dopo: "riferito" }));
    expect(frase).toContain("«Confermato da te»");
    expect(frase).toContain("«Riferito»");
    expect(avvisoFonte(proposta())).toBeNull();
  });

  it("dice quando la fonte sale o è indicata per la prima volta", () => {
    expect(frasePerLaFonte(proposta({ fonte_prima: "riferito", fonte_dopo: "confermato" }))).toBe("La fonte diventa «Confermato da te».");
    expect(frasePerLaFonte(proposta())).toBe("Fonte: «Riferito».");
    expect(frasePerLaFonte(proposta({ tipo: "spegni", fonte_prima: "confermato", fonte_dopo: null }))).toBeNull();
    expect(frasePerLaFonte(proposta({ fonte_prima: "riferito", fonte_dopo: "riferito" }))).toBeNull();
  });
});

describe("l'elenco e la scadenza", () => {
  it("le più recenti in alto, e a parità l'ordine non cambia da una lettura all'altra", () => {
    const elenco = [proposta({ id: "a", chiave: "b", creata_il: "2026-11-20T00:00:00Z" }), proposta({ id: "b", chiave: "z", creata_il: "2026-11-21T00:00:00Z" }), proposta({ id: "c", chiave: "a", creata_il: "2026-11-21T00:00:00Z" })];
    expect(ordinaProposte(elenco).map((p) => p.id)).toEqual(["c", "b", "a"]);
    expect(ordinaProposte(null)).toEqual([]);
  });

  it("la scadenza è all'italiana", () => {
    expect(scadenzaProposta(proposta())).toBe("Si può decidere fino al 21/12/2026.");
    expect(scadenzaProposta({})).toBeNull();
  });
});

describe("Correggi ha lo stesso tetto del database", () => {
  it("da 1 a 300 caratteri, spazi esclusi ai bordi", () => {
    expect(testoCorrettoValido("x".repeat(300))).toBe(true);
    expect(testoCorrettoValido("x".repeat(301))).toBe(false);
    expect(testoCorrettoValido("   ")).toBe(false);
    expect(testoCorrettoValido(null)).toBe(false);
  });
});

describe("le risposte della decisione", () => {
  it("un Sì o un Non farlo andati a buon fine non hanno niente da segnalare", () => {
    expect(messaggioDellaDecisione({ esito: "accettata" })).toBeNull();
    expect(messaggioDellaDecisione({ esito: "rifiutata" })).toBeNull();
  });

  it("obsoleta, già decisa e scaduta hanno ognuna la sua frase", () => {
    expect(messaggioDellaDecisione({ esito: "obsoleta" })).toMatch(/cambiata nel frattempo/);
    expect(messaggioDellaDecisione({ esito: "gia_decisa" })).toMatch(/già stata decisa/);
    expect(messaggioDellaDecisione({ esito: "scaduta" })).toMatch(/scaduta/);
  });

  it("una risposta sconosciuta non finge che sia andata bene", () => {
    expect(messaggioDellaDecisione(null)).toMatch(/Non so com'è andata/);
    expect(messaggioDellaDecisione({ esito: "boh" })).toMatch(/Non so com'è andata/);
  });
});

describe("quando non ci sono proposte", () => {
  it("lo dice e dice dove guarda", () => {
    expect(fraseNessunaProposta()).toMatch(/MEMO non ha proposte oggi/);
    expect(fraseNessunaProposta()).toMatch(/fornitori nuovi, i contratti nuovi e le voci da riconfermare/);
  });

  it("se alcune sono state tenute da parte per privacy, lo dice col numero", () => {
    expect(fraseNessunaProposta(1)).toMatch(/Una possibile proposta è stata tenuta da parte/);
    expect(fraseNessunaProposta(3)).toMatch(/3 possibili proposte sono state tenute da parte/);
  });
});

describe("i rifiuti del database sulle proposte, in parole semplici", () => {
  it("mostra com'erano i messaggi che il database scrive già in italiano", () => {
    const fonte = "Questa proposta abbassa la fonte da «confermato dal titolare» a «riferito»: conferma di averlo letto.";
    expect(messaggioDelDatabase({ message: fonte })).toBe(fonte);
    const corretto = "Il testo corretto deve avere da 1 a 300 caratteri.";
    expect(messaggioDelDatabase({ message: corretto })).toBe(corretto);
    const solo = "Questa proposta si può solo accettare o rifiutare.";
    expect(messaggioDelDatabase({ message: solo })).toBe(solo);
  });

  it("i limiti della Scheda arrivano com'erano anche passando da una proposta", () => {
    const pieno = "La Scheda ha già 60 voci attive: spegni una voce prima di aggiungerne o riattivarne un'altra.";
    expect(messaggioDelDatabase({ message: pieno })).toBe(pieno);
  });

  it("un errore sconosciuto non mostra il gergo", () => {
    expect(messaggioDelDatabase({ message: "ERROR: 42P01 relation does not exist" })).toBe("Non è stato salvato. Riprova tra un momento.");
  });
});
