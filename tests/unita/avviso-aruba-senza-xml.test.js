import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  correggiSenzaFattura,
  datiAvvisoAruba,
  eAvvisoArubaFattura,
  promettePerSe,
  propostaFatturaDaScaricare,
  senzaPromesse,
} from "../../supabase/functions/_shared/pec.js";
import { statoDellaMail } from "../../src/lib/calcoli/posta.js";

// L'AVVISO DI ARUBA SENZA LA FATTURA (13/11/2026).
//
// Da noreply@fatturazioneelettronica.aruba.it è arrivata «Hai ricevuto una
// nuova fattura elettronica» (Fabio Lorito, n. 1992/2026 del 12/11, 235,00 €)
// SENZA il file: MEMO ha scritto «il gestionale la registrerà da solo» e l'ha
// messa fra le «Niente da fare». Nessuno l'avrebbe registrata.
//
// ⚠️ Il testo qui sotto è FINTO, con la forma probabile dell'avviso: quella
//    vera non entra (il repository è pubblico), e la forma esatta non è
//    garantita. Per questo si provano più forme, e il ripiego sui dati letti
//    dal modello.

const MITTENTE = "Aruba Fatturazione Elettronica <noreply@fatturazioneelettronica.aruba.it>";
const OGGETTO = "Hai ricevuto una nuova fattura elettronica";
const TESTO_A_RIGHE = [
  "Gentile Cliente,",
  "ti informiamo che hai ricevuto una nuova fattura elettronica.",
  "",
  "Fornitore: FABIO LORITO",
  "Numero fattura: 1992/2026",
  "Data fattura: 12/11/2026",
  "Importo totale: 235,00 €",
  "",
  "Puoi consultarla nella sezione Fatture ricevute del pannello.",
].join("\n");

// L'azione come la scrive il modello, sbagliata: è il difetto del 13/11.
const NESSUNA_FALSA = {
  posta_id: "m1",
  tipo: "nessuna",
  titolo: "Fattura Fabio Lorito",
  descrizione: "Il gestionale la registrerà da solo.",
  perche: "È una fattura elettronica: la registrazione la propone il gestionale.",
  parametri: {},
};

describe("riconoscere l'avviso di Aruba", () => {
  it("mittente di Aruba FE e oggetto «Hai ricevuto una nuova fattura»: sì", () => {
    expect(eAvvisoArubaFattura({ mittente: MITTENTE, oggetto: OGGETTO })).toBe(true);
    expect(eAvvisoArubaFattura({ mittente: "noreply@fatturazioneelettronica.aruba.it", oggetto: `Fwd: ${OGGETTO}` })).toBe(true);
  });

  it("il nome davanti non conta: conta l'indirizzo", () => {
    expect(eAvvisoArubaFattura({ mittente: '"noreply@fatturazioneelettronica.aruba.it" <truffa@esempio.it>', oggetto: OGGETTO })).toBe(false);
  });

  it("una ricevuta di una fattura EMESSA non è un avviso da scaricare", () => {
    expect(eAvvisoArubaFattura({ mittente: MITTENTE, oggetto: "Ricevuta di consegna della fattura n. 12" })).toBe(false);
    expect(eAvvisoArubaFattura({ mittente: MITTENTE, oggetto: "Nuova fattura ricevuta" })).toBe(true);
  });

  it("altro oggetto di Aruba (sicurezza) o altro mittente: no", () => {
    expect(eAvvisoArubaFattura({ mittente: MITTENTE, oggetto: "Hai disattivato la verifica in 2 passaggi" })).toBe(false);
    expect(eAvvisoArubaFattura({ mittente: "borgo58@pec.it", oggetto: OGGETTO })).toBe(false);
    expect(eAvvisoArubaFattura({ mittente: "posta-certificata@pec.aruba.it", oggetto: "POSTA CERTIFICATA: Invio File 18141078362" })).toBe(false);
  });
});

describe("i dati scritti nell'avviso", () => {
  it("a righe «Etichetta: valore»", () => {
    expect(datiAvvisoAruba(TESTO_A_RIGHE)).toEqual({
      fornitore: "FABIO LORITO",
      numero: "1992/2026",
      data: "2026-11-12",
      importo: 235,
    });
  });

  it("a tabella (l'HTML ridotto a testo: etichetta e valore separati da tab o a capo)", () => {
    const t = "Mittente\tFabio Lorito\nNumero\n1992/2026\nData documento\t12/11/2026\nTotale documento\tEUR 1.235,50";
    expect(datiAvvisoAruba(t)).toEqual({ fornitore: "Fabio Lorito", numero: "1992/2026", data: "2026-11-12", importo: 1235.5 });
  });

  it("in una frase", () => {
    const t = "Hai ricevuto la fattura n. 1992/2026 del 12/11/2026 emessa da Fabio Lorito, importo 235,00 euro.";
    expect(datiAvvisoAruba(t)).toEqual({ fornitore: "Fabio Lorito", numero: "1992/2026", data: "2026-11-12", importo: 235 });
  });

  it("«Totale imponibile» non è il totale della fattura", () => {
    expect(datiAvvisoAruba("Totale imponibile: 200,00 €\nImporto totale: 244,00 €").importo).toBe(244);
  });

  it("un indirizzo email non diventa il fornitore", () => {
    expect(datiAvvisoAruba("Mittente: noreply@fatturazioneelettronica.aruba.it\nFornitore: Fabio Lorito").fornitore).toBe("Fabio Lorito");
  });

  it("un PDF vero accanto all'avviso si archivia lo stesso", () => {
    const pdf = { tipo: "archivia_documento", titolo: "Copia PDF", descrizione: "Archivio la copia", parametri: { allegato_id: "a1" } };
    const r = correggiSenzaFattura({ mittente: MITTENTE, oggetto: OGGETTO, testo: TESTO_A_RIGHE, azioni: [NESSUNA_FALSA, pdf] });
    expect(r.azioni.map((a) => a.tipo)).toEqual(["da_fare_a_mano", "archivia_documento"]);
  });

  it("quello che non c'è resta vuoto, non si indovina", () => {
    expect(datiAvvisoAruba("Hai ricevuto una nuova fattura. Numero verde 800 000 000.")).toEqual({
      fornitore: null,
      numero: null,
      data: null,
      importo: null,
    });
    expect(datiAvvisoAruba("Data fattura: 31/02/2026").data).toBeNull();
  });
});

describe("la cosa da fare", () => {
  it("con tutti i dati: scarica da Aruba e carica in Fatture Fornitori", () => {
    const a = propostaFatturaDaScaricare({ fornitore: "Fabio Lorito", numero: "1992/2026", data: "2026-11-12", importo: 235 });
    expect(a.tipo).toBe("da_fare_a_mano");
    expect(a.titolo).toBe("Scarica da Aruba la fattura n. 1992/2026 di Fabio Lorito");
    expect(a.descrizione).toContain("La fattura n. 1992/2026 di Fabio Lorito (del 12/11/2026, 235,00 €)");
    expect(a.descrizione).toContain("Aruba → Fatture ricevute");
    expect(a.descrizione).toContain("Fatture Fornitori");
    expect(a.parametri).toMatchObject({
      titolo: a.titolo,
      data: null, // l'Agenda non riceve la data della fattura come scadenza
      avviso_aruba: true,
      fornitore: "Fabio Lorito",
      numero: "1992/2026",
      data_fattura: "2026-11-12",
      importo: 235,
    });
    expect(a.parametri.passi.length).toBeGreaterThan(0);
    expect(promettePerSe(a.descrizione)).toBe(false);
  });

  it("senza dati: la frase regge lo stesso", () => {
    const a = propostaFatturaDaScaricare({});
    expect(a.titolo).toBe("Scarica da Aruba la fattura");
    expect(a.descrizione).not.toMatch(/null|undefined|\(\)/);
  });
});

describe("correggiSenzaFattura: l'avviso di Aruba senza XML", () => {
  const base = { mittente: MITTENTE, oggetto: OGGETTO, testo: TESTO_A_RIGHE, sintesi: "Fattura Fabio Lorito: il gestionale la registrerà da solo." };

  it("il «nessuna» del modello sparisce: resta la cosa da fare costruita dal codice, coi dati", () => {
    const r = correggiSenzaFattura({ ...base, azioni: [NESSUNA_FALSA], fattureLette: 0 });
    expect(r.azioni).toHaveLength(1);
    expect(r.azioni[0].tipo).toBe("da_fare_a_mano");
    expect(r.azioni[0].titolo).toBe("Scarica da Aruba la fattura n. 1992/2026 di FABIO LORITO");
    expect(r.avvisoAruba).toBe(r.azioni[0]);
    expect(r.sintesi).toContain("1992/2026");
    expect(promettePerSe(r.sintesi)).toBe(false);
  });

  it("la mail resta APERTA fra le «Da decidere» finché non si conferma", () => {
    const r = correggiSenzaFattura({ ...base, azioni: [NESSUNA_FALSA], fattureLette: 0 });
    const azioni = r.azioni.map((a) => ({ tipo: a.tipo, stato: "proposta" }));
    expect(statoDellaMail({ stato: "proposta", azioni })).toBe("decidere");
    // Prima della correzione: solo «nessuna» → «Niente da fare».
    expect(statoDellaMail({ stato: "proposta", azioni: [{ tipo: "nessuna", stato: "proposta" }] })).toBe("niente");
  });

  it("i dati che l'avviso non dice si prendono da quelli letti dal modello, convalidati", () => {
    const r = correggiSenzaFattura({
      ...base,
      testo: "Hai ricevuto una nuova fattura elettronica. Accedi al pannello.",
      azioni: [],
      suggeriti: { fornitore: "Fabio Lorito", numero: "1992/2026", data: "2026-11-12", importo: 235 },
    });
    expect(r.azioni[0].parametri).toMatchObject({ fornitore: "Fabio Lorito", numero: "1992/2026", data_fattura: "2026-11-12", importo: 235 });
    const storti = correggiSenzaFattura({ ...base, testo: "", azioni: [], suggeriti: { data: "domani", importo: "zero", numero: "senza" } });
    expect(storti.azioni[0].parametri).toMatchObject({ numero: null, data_fattura: null, importo: null });
  });
});

describe("correggiSenzaFattura: con la fattura letta non cambia niente", () => {
  it("una PEC dello SdI con l'xml.p7m: proposte e sintesi del modello restano come sono", () => {
    const azioni = [{ tipo: "carico_magazzino", titolo: "Carico", descrizione: "Carico 3 righe" }];
    const r = correggiSenzaFattura({
      mittente: "sdi01@pec.fatturapa.it",
      oggetto: "Invio File 18141078362",
      testo: "",
      azioni,
      sintesi: "Fattura del fornitore: la registrazione la propone il gestionale.",
      fattureLette: 1,
    });
    expect(r.azioni).toBe(azioni);
    expect(r.sintesi).toBe("Fattura del fornitore: la registrazione la propone il gestionale.");
    expect(r.avvisoAruba).toBeNull();
  });

  it("anche un avviso di Aruba CON la fattura allegata passa dal percorso di sempre", () => {
    const azioni = [{ tipo: "nessuna", titolo: "x", descrizione: "y" }];
    const r = correggiSenzaFattura({ mittente: MITTENTE, oggetto: OGGETTO, testo: TESTO_A_RIGHE, azioni, fattureLette: 1 });
    expect(r.azioni).toBe(azioni);
    expect(r.avvisoAruba).toBeNull();
  });
});

describe("«registrerà da solo» mai senza XML", () => {
  it("riconosce le promesse, e lascia stare le frasi vere", () => {
    for (const f of [
      "Il gestionale la registrerà da solo.",
      "Verrà registrata automaticamente.",
      "La fattura si registra da sola.",
      "La registrazione la propone il gestionale.",
      "Sarà importata in automatico fra le fatture.",
    ]) {
      expect(promettePerSe(f), f).toBe(true);
    }
    for (const f of [
      "Non si registra da sola: scaricala da Aruba.",
      "Il gestionale NON la registra da solo.",
      "Archivio il contratto di locazione.",
    ]) {
      expect(promettePerSe(f), f).toBe(false);
    }
  });

  it("toglie solo la frase che promette", () => {
    expect(senzaPromesse("Fattura di Rossi. Il gestionale la registrerà da solo. Scade il 30/11.")).toBe(
      "Fattura di Rossi. Scade il 30/11.",
    );
  });

  it("su qualunque mail senza fattura: un «nessuna» che promette diventa una cosa da controllare", () => {
    const r = correggiSenzaFattura({
      mittente: "fornitore@esempio.it",
      oggetto: "La sua fattura",
      testo: "In allegato la fattura in PDF.",
      azioni: [NESSUNA_FALSA, { tipo: "archivia_documento", titolo: "Fattura Rossi", descrizione: "Archivio la fattura Rossi. Verrà registrata automaticamente.", perche: null }],
      sintesi: "Fattura: il gestionale la registrerà da solo.",
      fattureLette: 0,
    });
    expect(r.azioni[0].tipo).toBe("da_fare_a_mano");
    expect(r.azioni[0].posta_id).toBe("m1");
    expect(r.azioni[1].descrizione).toBe("Archivio la fattura Rossi.");
    expect(r.avvisoAruba).toBeNull();
    const testi = [r.sintesi, ...r.azioni.flatMap((a) => [a.titolo, a.descrizione, a.perche])];
    for (const t of testi) expect(promettePerSe(t), String(t)).toBe(false);
    expect(statoDellaMail({ stato: "proposta", azioni: r.azioni.map((a) => ({ tipo: a.tipo, stato: "proposta" })) })).toBe("decidere");
  });

  it("una mail che non parla di fatture non si tocca (l'avviso della banca dice il vero)", () => {
    const azioni = [{ tipo: "nessuna", titolo: "Movimento Credem", descrizione: "Il movimento sarà registrato automaticamente.", perche: null }];
    const r = correggiSenzaFattura({ mittente: "avvisi@credem.it", oggetto: "Movimento sul conto", testo: "", azioni, sintesi: "Bonifico in entrata", fattureLette: 0 });
    expect(r.azioni).toBe(azioni);
  });

  it("il «non» lontano dal verbo non salva la promessa; «n. 1992» non spezza la frase", () => {
    expect(promettePerSe("Non c'è il file: verrà registrata automaticamente.")).toBe(true);
    expect(senzaPromesse("Fattura n. 1992/2026 di 235.00 euro. Il gestionale la registrerà da solo.")).toBe(
      "Fattura n. 1992/2026 di 235.00 euro.",
    );
  });

  it("le mail che non parlano di registrazione restano identiche", () => {
    const azioni = [{ tipo: "nessuna", titolo: "Newsletter", descrizione: "Pubblicità: niente da fare.", perche: null }];
    const r = correggiSenzaFattura({ mittente: "news@esempio.it", oggetto: "Offerte", testo: "", azioni, sintesi: "Pubblicità", fattureLette: 0 });
    expect(r.azioni).toEqual(azioni);
    expect(r.sintesi).toBe("Pubblicità");
  });
});

describe("posta-leggi usa la regola, e avvisa sul telefono", () => {
  const codice = readFileSync("supabase/functions/posta-leggi/index.ts", "utf8");
  const telegram = readFileSync("supabase/functions/notify-telegram-reservation/index.ts", "utf8");

  it("le proposte del modello passano da correggiSenzaFattura, col numero di fatture lette", () => {
    expect(codice).toMatch(/correggiSenzaFattura\(\{[\s\S]*fattureLette: fattureLette\.length/);
    expect(codice).toContain("proposta_sintesi: corretta.sintesi");
  });

  it("la fattura da scaricare squilla sotto «DA FARE», non fra i guasti", () => {
    expect(codice).toContain('categoria: "da_fare"');
    expect(telegram).toMatch(/categoria === "da_fare"[\s\S]*DA FARE/);
  });

  it("le istruzioni vietano la promessa senza file", () => {
    expect(codice).toMatch(/non scrivere MAI che\s+il gestionale la registrerà da solo/);
    expect(codice).toContain("noreply@fatturazioneelettronica.aruba.it");
  });
});
