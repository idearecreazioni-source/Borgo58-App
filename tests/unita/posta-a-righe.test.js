import { describe, expect, it } from "vitest";
import {
  BOLLINO_POSTA,
  allegatiDaMostrare,
  allegatoTecnico,
  conVerboDavanti,
  descriviRegola,
  indirizzoMittente,
  mittenteProtetto,
  tipoOggetto,
  inScheda,
  motivoAzioneBloccata,
  notaInChiaro,
  statoDellaMail,
  verboConferma,
} from "../../src/lib/calcoli/posta";
import { senzaArchiviareLeGiaRegistrate, testataFattura } from "../../supabase/functions/_shared/pec.js";

// LA POSTA A RIGHE (08/11/2026): una riga per mail con un bollino, tre
// schede, solo gli allegati veri, gli avvisi solo quando tocca ad Alessio.
// Nomi e numeri sono inventati: il repository è pubblico.

describe("gli allegati tecnici restano nascosti", () => {
  it("la busta della PEC e i file dello SdI sono tecnici", () => {
    for (const n of [
      "daticert.xml",
      "daticert_2.xml",
      "smime.p7s",
      "postacert.eml",
      "SubmissionAcceptance.xml",
      "IT01234567890_ab12C_MT_001.xml",
      "IT01234567890_ab12C_RC_001.xml",
      "IT01234567890_ab12C_NS_001.xml",
    ]) {
      expect(allegatoTecnico(n), n).toBe(true);
    }
  });

  it("la fattura, un PDF e un documento qualsiasi si vedono", () => {
    for (const n of ["IT01234567890_ab12C.xml.p7m", "IT01234567890_ab12C.xml", "F24 novembre.pdf", "contratto.docx"]) {
      expect(allegatoTecnico(n), n).toBe(false);
    }
  });

  it("li divide senza perderne nessuno", () => {
    const allegati = [
      { id: "1", file_name: "daticert.xml" },
      { id: "2", file_name: "IT01234567890_ab12C.xml.p7m" },
      { id: "3", file_name: "smime.p7s" },
    ];
    const { visibili, tecnici } = allegatiDaMostrare(allegati);
    expect(visibili.map((a) => a.id)).toEqual(["2"]);
    expect(tecnici.map((a) => a.id)).toEqual(["1", "3"]);
  });
});

describe("la nota di lettura in italiano semplice", () => {
  it("tace i file della busta: se resta niente, nessuna nota", () => {
    expect(
      notaInChiaro(
        "daticert.xml: formato che non so aprire (application/xml); smime.p7s: formato che non so aprire (application/pkcs7-signature)"
      )
    ).toBeNull();
  });

  it("dice gli altri senza il tipo tecnico", () => {
    const n = notaInChiaro("daticert.xml: formato che non so aprire (application/xml); preventivo.pages: formato che non so aprire (application/x-iwork)");
    expect(n).toBe("Non sono riuscito ad aprire «preventivo.pages».");
    expect(n).not.toMatch(/application/);
  });

  it("gli altri motivi restano, col nome del file", () => {
    expect(notaInChiaro("listino.pdf: letto solo in parte, il file è troppo lungo")).toBe(
      "«listino.pdf»: letto solo in parte, il file è troppo lungo."
    );
  });

  it("niente nota, niente frase", () => {
    expect(notaInChiaro(null)).toBeNull();
    expect(notaInChiaro("   ")).toBeNull();
  });
});

describe("il bollino di ogni mail", () => {
  const az = (tipo, stato) => ({ tipo, stato });

  it("una proposta aperta: da decidere", () => {
    expect(statoDellaMail({ stato: "proposta", azioni: [az("archivia_documento", "proposta")] })).toBe("decidere");
  });

  it("solo «nessuna»: niente da fare, non da decidere (il vecchio «Niente — Senza titolo»)", () => {
    expect(statoDellaMail({ stato: "proposta", azioni: [az("nessuna", "proposta")] })).toBe("niente");
  });

  it("una cosa fatta e una rifiutata: fatto", () => {
    expect(statoDellaMail({ stato: "proposta", azioni: [az("promemoria", "fatta"), az("archivia_documento", "rifiutata")] })).toBe("fatto");
    expect(statoDellaMail({ stato: "archiviata", azioni: [] })).toBe("fatto");
  });

  it("tutto rifiutato: niente da fare", () => {
    expect(statoDellaMail({ stato: "proposta", azioni: [az("promemoria", "rifiutata")] })).toBe("niente");
  });

  it("non ancora letta: in lettura, oppure da guardare se MEMO si è fermato", () => {
    expect(statoDellaMail({ stato: "da_leggere" }, { chiave: "in_coda" })).toBe("in_lettura");
    for (const chiave of ["arresa", "lettore_fermo", "non_so"]) {
      expect(statoDellaMail({ stato: "da_leggere" }, { chiave }), chiave).toBe("guarda");
    }
  });

  it("ogni stato ha un bollino con le parole", () => {
    for (const s of ["guarda", "in_lettura", "decidere", "fatto", "niente"]) {
      expect(BOLLINO_POSTA[s], s).toBeTruthy();
    }
  });
});

describe("le tre schede", () => {
  it("«Da decidere» tiene tutto ciò che non è chiuso, «Sistemate» il resto, «Tutte» tutto", () => {
    for (const s of ["decidere", "guarda", "in_lettura"]) {
      expect(inScheda(s, "decidere"), s).toBe(true);
      expect(inScheda(s, "sistemate"), s).toBe(false);
    }
    for (const s of ["fatto", "niente"]) {
      expect(inScheda(s, "decidere"), s).toBe(false);
      expect(inScheda(s, "sistemate"), s).toBe(true);
    }
    for (const s of ["decidere", "guarda", "in_lettura", "fatto", "niente"]) expect(inScheda(s, "tutte")).toBe(true);
  });
});

describe("i pulsanti corti", () => {
  it("un verbo per tipo, che sta su un telefono", () => {
    expect(verboConferma({ tipo: "archivia_documento" })).toBe("Archivia");
    expect(verboConferma({ tipo: "promemoria" })).toBe("Metti in agenda");
    expect(verboConferma({ tipo: "promemoria_multipli" })).toBe("Metti in agenda");
    expect(verboConferma({ tipo: "registra_fattura" })).toBe("Registra");
    expect(verboConferma({ tipo: "carico_magazzino" })).toBe("Carica");
    for (const tipo of ["archivia_documento", "archivia_testo", "promemoria", "carico_magazzino", "da_fare_a_mano", "registra_fattura", "boh"]) {
      expect(verboConferma({ tipo }).length, tipo).toBeLessThanOrEqual(16);
    }
  });
});

// 🔴 08/11, prima PEC vera dopo il rilascio: la 330/F era già registrata, e
// accanto a «è già registrata» c'era anche «Archivia Fattura notaio 330/F».
describe("una fattura già registrata non si propone anche da archiviare", () => {
  const allegati = [
    { id: "a1", file_name: "IT01234567890_ab12C.xml.p7m" },
    { id: "a2", file_name: "IT01234567890_ab12C_MT_001.xml" },
    { id: "a3", file_name: "contratto.pdf" },
  ];
  const azioni = [
    { tipo: "archivia_documento", parametri: { allegato_id: "a1" } },
    { tipo: "archivia_documento", parametri: { allegato_id: "a3" } },
    { tipo: "nessuna", parametri: { file_sdi: "IT01234567890_ab12C.xml.p7m" } },
    { tipo: "promemoria", parametri: { allegato_id: "a1" } },
  ];

  it("toglie l'archiviazione del file della fattura, e solo quella", () => {
    const tenute = senzaArchiviareLeGiaRegistrate(azioni, allegati, ["IT01234567890_ab12C.xml.p7m"]);
    expect(tenute).toEqual([azioni[1], azioni[2], azioni[3]]);
  });

  it("riconosce lo stesso file anche col nome senza .p7m", () => {
    const tenute = senzaArchiviareLeGiaRegistrate(
      [{ tipo: "archivia_testo", parametri: { allegato_id: "x" } }],
      [{ id: "x", file_name: "IT01234567890_ab12C.xml" }],
      ["IT01234567890_ab12C.xml.p7m"]
    );
    expect(tenute).toEqual([]);
  });

  it("senza fatture già registrate non tocca niente", () => {
    expect(senzaArchiviareLeGiaRegistrate(azioni, allegati, [])).toBe(azioni);
  });
});

describe("il nome del pulsante comincia con quello che si vede", () => {
  it("se il nome intero comincia già col verbo resta com'è, altrimenti il verbo va davanti", () => {
    expect(conVerboDavanti("Archivia", "Archivia «Fattura 412/F»")).toBe("Archivia «Fattura 412/F»");
    expect(conVerboDavanti("Carica", "Metti 3 righe in magazzino")).toBe("Carica: Metti 3 righe in magazzino");
    expect(conVerboDavanti("Registra", "")).toBe("Registra");
  });
});

// IL FILTRO PRIMA DI MEMO (11/11/2026): le letture della pagina devono
// dire le stesse cose di quelle del database (20261111000001), che le prova
// con gli stessi esempi nella sua verifica.
describe("il filtro della posta legge mittente e oggetto come il database", () => {
  it("l'indirizzo dentro le parentesi, in minuscolo", () => {
    expect(indirizzoMittente("Credem <BusinessOn@Credem.it>")).toBe("businesson@credem.it");
    expect(indirizzoMittente("info@esempio.it")).toBe("info@esempio.it");
    expect(indirizzoMittente("")).toBeNull();
  });

  it("il tipo di oggetto: senza R:/Fwd:, cifre come #", () => {
    expect(tipoOggetto("R: Fwd: Notifica Accesso del 10/11/2026 ore 09:32")).toBe("notifica accesso del #/#/# ore #:#");
    expect(tipoOggetto("Le offerte della settimana 45")).toBe("le offerte della settimana #");
    expect(tipoOggetto("   ")).toBeNull();
  });

  it("lo SdI e il gestore PEC sono protetti, Credem no", () => {
    expect(mittenteProtetto("sdi38@pec.fatturapa.it")).toBe(true);
    expect(mittenteProtetto("posta-certificata@pec.aruba.it")).toBe(true);
    expect(mittenteProtetto("businesson@credem.it")).toBe(false);
  });

  it("una mail filtrata sta fra le sistemate, col suo bollino", () => {
    const s = statoDellaMail({ stato: "scartata", filtrata_da: "f1" });
    expect(s).toBe("filtrata");
    expect(BOLLINO_POSTA[s]).toBe("Filtrata");
    expect(inScheda(s, "sistemate")).toBe(true);
    expect(inScheda(s, "decidere")).toBe(false);
  });

  it("la regola si dice in italiano", () => {
    expect(descriviRegola({ mittente: "a@b.it", oggetto_tipo: "avviso" })).toBe("da a@b.it con oggetto «avviso»");
    expect(descriviRegola({ mittente: "a@b.it", oggetto_tipo: "avviso", modo: "inizia" })).toBe("da a@b.it con oggetto che comincia per «avviso»");
    expect(descriviRegola({ mittente: "a@b.it", oggetto_tipo: null })).toBe("tutte le mail da a@b.it");
  });
});

// PR8b (11/11/2026): i tre difetti della Posta visti da Alessio.
describe("la Posta, i difetti dell'11/11", () => {
  it("una sezione che non esiste spegne «Archivia», con la ragione", () => {
    const a = { tipo: "archivia_documento" };
    const m = motivoAzioneBloccata(a, { tipo: "fatture_inventate", data: "2026-11-11" }, ["fatture", "contratti"]);
    expect(m).toMatch(/non esiste nell'archivio/);
    expect(motivoAzioneBloccata(a, { tipo: "fatture", data: "2026-11-11" }, ["fatture", "contratti"])).toBeNull();
    // Senza l'elenco (non letto) non si indovina: decide il database.
    expect(motivoAzioneBloccata(a, { tipo: "fatture_inventate", data: "2026-11-11" }, null)).toBeNull();
  });

  it("con una fattura già registrata non si archivia né il suo file, né la busta, né la mail senza allegato", () => {
    const allegati = [
      { id: "f", file_name: "IT01234567890_ab12C.xml.p7m" },
      { id: "d", file_name: "daticert.xml" },
      { id: "c", file_name: "contratto.pdf" },
    ];
    const azioni = [
      { tipo: "archivia_documento", parametri: { allegato_id: "f" } },
      { tipo: "archivia_documento", parametri: { allegato_id: "d" } },
      { tipo: "archivia_testo", parametri: {} },
      { tipo: "archivia_documento", parametri: { allegato_id: "c" } },
      { tipo: "nessuna", parametri: {} },
    ];
    const tenute = senzaArchiviareLeGiaRegistrate(azioni, allegati, ["IT01234567890_ab12C.xml.p7m"]);
    expect(tenute).toEqual([azioni[3], azioni[4]]);
  });

  it("la testata di una fattura dice chi, numero e totale", () => {
    expect(
      testataFattura([{ tipo: "registra_fattura", parametri: { fattura: { numero: "412/F", totale: 488, fornitore: { denominazione: "Fornitore Esempio srl" } } } }])
    ).toEqual({ chi: "Fornitore Esempio srl", numero: "412/F", totale: 488 });
    expect(
      testataFattura([{ tipo: "nessuna", parametri: { gia_registrata: { invoice_number: "330/F" }, fornitore: "Studio Esempio", numero: "330/F", totale: 460 } }])
    ).toEqual({ chi: "Studio Esempio", numero: "330/F", totale: 460 });
    // Una proposta vecchia, senza fornitore: almeno il numero.
    expect(testataFattura([{ tipo: "nessuna", parametri: { gia_registrata: { invoice_number: "330/F" } } }])).toEqual({ chi: null, numero: "330/F", totale: null });
    expect(testataFattura([{ tipo: "archivia_documento", parametri: {} }])).toBeNull();
  });
});
