import { describe, expect, it } from "vitest";
import {
  DOVE_AGENDA,
  TIPO_FATTO,
  TIPO_PROMEMORIA,
  TIPO_QUALE,
  TIPO_SPOSTA,
  correggiAgenda,
  cosaManca,
  cosaVuoleFare,
  dataNuova,
  destinazioneAgenda,
  istruzioniAgenda,
  titoloSentito,
} from "../../supabase/functions/ascolta-voce/agenda.ts";

// =====================================================================
// L'AGENDA A VOCE — tre cose che si dicono in modo simile
// =====================================================================
// 🔴 IL DIFETTO CHE QUESTE PROVE TENGONO CHIUSO: «segna come fatto il
//    rinnovo della firma digitale» non è una cosa nuova da ricordare. Senza
//    la regola, il modello la riconduce alla cosa più vicina che il
//    gestionale sa fare — un promemoria — e nasce un impegno NUOVO con quel
//    titolo, **approvabile**, accanto a quello vero che resta aperto. Due
//    righe per la stessa cosa, e nessun errore da nessuna parte.
//
// 🔴 E IL GESTIONALE OGGI NON SA CHIUDERE NÉ SPOSTARE un impegno dalla
//    voce: non c'è nessun ramo che lo esegua, e costruirlo vuole una
//    migrazione. Quello che si fa al suo posto è la regola di SPEC-0013 —
//    l'appunto nasce lo stesso e **dichiara che il gesto manca**.
//
// ⚠️ QUESTE PROVE GUARDANO LA REGOLA, NON IL MODELLO: si prova che,
//    qualunque cosa il modello proponga, sono le parole dette a decidere.

const detta = (tipo, dati, extra = {}) => ({
  tipo,
  sicuro: true,
  frase: "una frase",
  dati,
  ...extra,
});

// =====================================================================
describe("che cosa vuole fare, guardando la frase detta", () => {
  it("🔴 «segna come fatto …» non è un promemoria", () => {
    for (const frase of [
      "Segna come fatto il rinnovo della firma digitale",
      "segna fatto l'ordine delle verdure",
      "l'ho fatto il rinnovo della firma",
      "spunta la chiamata al commercialista",
    ]) {
      expect(cosaVuoleFare(frase), frase).toBe("fatto");
    }
  });

  it("🔴 «sposta a venerdì …» non è un promemoria", () => {
    for (const frase of [
      "Sposta a venerdì l'ordine delle verdure",
      "rimanda a lunedì la chiamata al commercialista",
      "posticipa il rinnovo della firma",
      "cambia la data dell'ordine delle verdure",
    ]) {
      expect(cosaVuoleFare(frase), frase).toBe("sposta");
    }
  });

  it("🔴 e una frase che CREA resta una cosa nuova", () => {
    // 🔴 È LA METÀ CHE DISCRIMINA, ed è quella che protegge dal danno
    //    peggiore: una regola che dirottasse tutto romperebbe il gesto più
    //    frequente dell'Agenda — segnarsi una cosa da fare.
    for (const frase of [
      "Ricordami di chiamare Tiziana domani",
      "Aggiungi il rinnovo della firma digitale per venerdì",
      "ricordami di comprare il pane",
      "segnami che devo chiamare Laura",
    ]) {
      expect(cosaVuoleFare(frase), frase).toBe("altro");
    }
  });

  it("una frase vuota non vuole fare niente", () => {
    expect(cosaVuoleFare("")).toBe("altro");
    expect(cosaVuoleFare(null)).toBe("altro");
  });
});

// =====================================================================
describe("creare un impegno resta come prima", () => {
  it("🔴 un promemoria vero non viene toccato", () => {
    const a = detta(TIPO_PROMEMORIA, { titolo: "Chiamare Tiziana", data: "2026-09-09" });
    const dopo = destinazioneAgenda(a, "Ricordami di chiamare Tiziana domani");
    expect(dopo.tipo).toBe(TIPO_PROMEMORIA);
    expect(dopo.dati.titolo).toBe("Chiamare Tiziana");
    expect(dopo.motivo).toBeUndefined();
  });

  it("...e nemmeno un promemoria senza data", () => {
    // ⚠️ Una data NON serve per creare: l'Agenda ha la corsia «quando
    //    capita», e pretenderla farebbe rifiutare il gesto più comodo che
    //    c'è. Si chiede solo dove serve davvero — per spostare.
    const dopo = destinazioneAgenda(
      detta(TIPO_PROMEMORIA, { titolo: "Comprare il pane", data: null }),
      "ricordami di comprare il pane",
    );
    expect(dopo.tipo).toBe(TIPO_PROMEMORIA);
  });

  it("🔴 e quello che non è Agenda non cambia comportamento", () => {
    // ⚠️ È la rete che protegge tutto il resto della voce: temperature,
    //    spese, giacenze e liste non devono accorgersi di questo modulo.
    for (const tipo of ["temperatura", "lista_spesa", "spesa_tasca", "movimento_cassa", "giacenza"]) {
      const a = detta(tipo, { qualcosa: 1 });
      expect(destinazioneAgenda(a, "segna come fatto qualunque cosa").tipo, tipo).toBe(tipo);
      expect(destinazioneAgenda(a, "sposta a venerdì qualunque cosa").motivo, tipo).toBeUndefined();
    }
  });
});

// =====================================================================
describe("segnare fatto un impegno", () => {
  it("🔴 diventa un appunto che dichiara il gesto mancante", () => {
    const dopo = destinazioneAgenda(
      detta(TIPO_PROMEMORIA, { titolo: "Segna come fatto il rinnovo della firma" }),
      "Segna come fatto il rinnovo della firma digitale",
    );
    expect(dopo.tipo).toBe(TIPO_FATTO);
    expect(dopo.tipo).not.toBe(TIPO_PROMEMORIA);
    expect(dopo.destinazione).toBe("Da segnare fatto in Agenda");
    expect(dopo.motivo).toMatch(/non sa ancora chiudere/i);
    expect(dopo.motivo).toMatch(/Agenda/);
  });

  it("e il titolo dell'impegno resta scritto, così non si perde", () => {
    const dopo = destinazioneAgenda(
      detta(TIPO_FATTO, { impegno: "rinnovo della firma digitale" }),
      "Segna come fatto il rinnovo della firma digitale",
    );
    expect(dopo.dati.titolo).toBe("rinnovo della firma digitale");
    expect(dopo.dati.gesto).toBe("segna fatto");
  });

  it("🔴 e NON è approvabile: il tipo non è nel catalogo", () => {
    // 🔴 Non è un controllo da ricordare: `siPuoApprovare()` guarda
    //    `eseguibile`, che il database ricava dal catalogo delle azioni
    //    vocali. Un tipo che lì non c'è nasce non approvabile per
    //    costruzione — è lo stesso meccanismo con cui, il 07/09, un
    //    anticipo da rimborsare non è potuto finire nella tasca.
    for (const t of [TIPO_FATTO, TIPO_SPOSTA, TIPO_QUALE]) {
      expect(t).not.toBe(TIPO_PROMEMORIA);
      expect(t.startsWith("agenda_")).toBe(true);
    }
  });
});

// =====================================================================
describe("spostare un impegno", () => {
  it("mostra il titolo e la data nuova", () => {
    const dopo = destinazioneAgenda(
      detta(TIPO_SPOSTA, { impegno: "ordine delle verdure", data_nuova: "2026-09-11" }),
      "Sposta a venerdì l'ordine delle verdure",
    );
    expect(dopo.tipo).toBe(TIPO_SPOSTA);
    expect(dopo.destinazione).toBe("Da spostare in Agenda");
    expect(dopo.dati.titolo).toBe("ordine delle verdure");
    expect(dopo.dati.data_nuova).toBe("2026-09-11");
    expect(dopo.motivo).toMatch(/non sa ancora spostare/i);
  });

  it("🔴 senza il giorno nuovo NON si inventa: si chiede", () => {
    // 🔴 Spostare senza sapere a quando non vuol dire niente, e mettere
    //    «domani» al posto suo sarebbe decidere su una scadenza.
    const dopo = destinazioneAgenda(
      detta(TIPO_SPOSTA, { impegno: "ordine delle verdure", data_nuova: null }),
      "Sposta l'ordine delle verdure",
    );
    expect(dopo.tipo).toBe(TIPO_QUALE);
    expect(dopo.motivo).toMatch(/a quando/);
  });

  it("🔴 e senza sapere QUALE impegno, nemmeno", () => {
    const dopo = destinazioneAgenda(
      detta(TIPO_SPOSTA, { data_nuova: "2026-09-11" }),
      "Sposta a venerdì",
    );
    expect(dopo.tipo).toBe(TIPO_QUALE);
    expect(dopo.motivo).toMatch(/quale impegno/);
  });

  it("se mancano tutt'e due le nomina TUTTE, non la prima", () => {
    // ⚠️ Dirne una per volta fa scoprire la seconda dopo aver rimediato
    //    alla prima, e alla terza si smette di leggere.
    const dopo = destinazioneAgenda(detta(TIPO_SPOSTA, {}), "Sposta");
    expect(dopo.motivo).toMatch(/quale impegno/);
    expect(dopo.motivo).toMatch(/a quando/);
  });

  it("una data che non ha la forma di una data non è una data", () => {
    // ⚠️ Meglio «non l'ho capita» che una stringa infilata in un campo
    //    data: là dentro diventerebbe una scadenza sbagliata.
    for (const v of ["venerdì", "la settimana prossima", "11/09/2026", "", null]) {
      expect(dataNuova(detta(TIPO_SPOSTA, { data_nuova: v })), String(v)).toBeNull();
    }
    expect(dataNuova(detta(TIPO_SPOSTA, { data_nuova: "2026-09-11" }))).toBe("2026-09-11");
  });
});

// =====================================================================
describe("quello che manca, e il titolo sentito", () => {
  it("per chiudere serve solo l'impegno, per spostare anche il giorno", () => {
    expect(cosaManca(detta(TIPO_FATTO, { impegno: "x" }), "fatto")).toEqual([]);
    expect(cosaManca(detta(TIPO_SPOSTA, { impegno: "x" }), "sposta")).toEqual(["a quando"]);
    expect(cosaManca(detta(TIPO_SPOSTA, { impegno: "x", data_nuova: "2026-09-11" }), "sposta")).toEqual([]);
    expect(cosaManca(detta(TIPO_FATTO, {}), "fatto")).toEqual(["quale impegno"]);
  });

  it("il titolo si legge da «impegno», da «titolo» o da «nome»", () => {
    expect(titoloSentito(detta(TIPO_FATTO, { impegno: "a" }))).toBe("a");
    expect(titoloSentito(detta(TIPO_FATTO, { titolo: "b" }))).toBe("b");
    expect(titoloSentito(detta(TIPO_FATTO, { nome: "c" }))).toBe("c");
    expect(titoloSentito(detta(TIPO_FATTO, { impegno: "   " }))).toBeNull();
    expect(titoloSentito(detta(TIPO_FATTO, {}))).toBeNull();
  });
});

// =====================================================================
describe("su tutta la filza", () => {
  it("converte solo quello che va convertito", () => {
    const dopo = correggiAgenda(
      [
        detta(TIPO_PROMEMORIA, { titolo: "Chiamare Tiziana", data: "2026-09-09" }),
        detta(TIPO_SPOSTA, { impegno: "verdure", data_nuova: "2026-09-11" }),
        detta(TIPO_FATTO, { impegno: "firma" }),
        detta("temperatura", { gradi: 3 }),
      ],
      "una frase qualunque",
    );
    expect(dopo.map((a) => a.tipo)).toEqual([
      TIPO_PROMEMORIA,
      TIPO_SPOSTA,
      TIPO_FATTO,
      "temperatura",
    ]);
  });

  it("una filza vuota non esplode", () => {
    expect(correggiAgenda([], "")).toEqual([]);
    expect(correggiAgenda(null, "")).toEqual([]);
  });
});

// =====================================================================
describe("il collegamento all'Agenda", () => {
  // 🔴 SENZA COLLEGAMENTO L'APPUNTO È UN VICOLO CIECO: dice che il gesto
  //    non c'è e lascia chi legge a cercarsi la schermata da solo. In
  //    questo progetto un rifiuto senza via d'uscita è un difetto a sé
  //    (16/08), e qui il rifiuto è per costruzione.

  it("le due destinazioni che non si eseguono portano in Agenda", () => {
    const fatto = destinazioneAgenda(
      detta(TIPO_FATTO, { impegno: "rinnovo della firma digitale" }),
      "segna come fatto il rinnovo della firma digitale",
    );
    const sposta = destinazioneAgenda(
      detta(TIPO_SPOSTA, { impegno: "ordine delle verdure", data_nuova: "2026-09-11" }),
      "sposta a venerdì l'ordine delle verdure",
    );
    expect(fatto.dati.dove).toEqual(DOVE_AGENDA);
    expect(sposta.dati.dove).toEqual(DOVE_AGENDA);
    expect(DOVE_AGENDA.a).toBe("/agenda");
  });

  it("e ci porta anche quando manca qualcosa", () => {
    // ⚠️ È il caso in cui serve di più: il gestionale non sa quale impegno
    //    sia, quindi l'unica cosa che può fare è mandare dove stanno tutti.
    const chiede = destinazioneAgenda(
      detta(TIPO_SPOSTA, { impegno: "verdure" }),
      "sposta le verdure",
    );
    expect(chiede.tipo).toBe(TIPO_QUALE);
    expect(chiede.dati.dove).toEqual(DOVE_AGENDA);
  });

  it("🔴 e un promemoria NON se lo porta dietro", () => {
    // 🔴 LA METÀ CHE DISCRIMINA: il promemoria si esegue, quindi ha già la
    //    sua via d'uscita dal database (azione_percorso → /agenda/nuovo).
    //    Dargli anche questo metterebbe due collegamenti diversi sulla
    //    stessa riga, e uno dei due porterebbe nel posto sbagliato.
    const p = destinazioneAgenda(
      detta(TIPO_PROMEMORIA, { titolo: "Chiamare Tiziana", data: "2026-09-09" }),
      "ricordami di chiamare Tiziana domani",
    );
    expect(p.dati?.dove).toBeUndefined();
  });
});

// =====================================================================
describe("il nome dell'impegno si scrive UNA volta sola", () => {
  it("🔴 «impegno» e «titolo» non compaiono tutti e due", () => {
    // 🔴 Il modello lo chiama in tre modi, e l'appunto li mostrerebbe tutti
    //    con lo stesso valore: chi legge prima di firmare si chiederebbe
    //    quali sono le due cose. Un appunto che confonde chi lo firma è
    //    peggio di un appunto più corto.
    const a = destinazioneAgenda(
      detta(TIPO_FATTO, {
        impegno: "rinnovo della firma",
        titolo: "rinnovo della firma",
        nome: "rinnovo della firma",
      }),
      "segna come fatto il rinnovo della firma",
    );
    expect(Object.keys(a.dati).sort()).toEqual(["dove", "gesto", "titolo"]);
    expect(a.dati.titolo).toBe("rinnovo della firma");
  });

  it("e quello che il modello aveva capito in più non si butta via", () => {
    // ⚠️ Si tolgono i doppioni del nome, non i dati: una descrizione detta
    //    resta, perché è roba sua.
    const a = destinazioneAgenda(
      detta(TIPO_FATTO, { impegno: "firma", descrizione: "quella della Camera di Commercio" }),
      "segna come fatto la firma",
    );
    expect(a.dati.descrizione).toBe("quella della Camera di Commercio");
  });
});

// =====================================================================
describe("le istruzioni per il modello", () => {

  it("nominano tutti e tre i tipi", () => {
    const t = istruzioniAgenda();
    expect(t).toContain(`"${TIPO_FATTO}"`);
    expect(t).toContain(`"${TIPO_SPOSTA}"`);
    expect(t).toContain('"promemoria"');
  });

  it("🔴 e dicono PERCHÉ non vanno ricondotte a un promemoria", () => {
    // ⚠️ Senza la ragione, la riga verrebbe tolta dal primo che la trova
    //    ridondante — è la lezione del 27/08 sulla data di oggi.
    expect(istruzioniAgenda()).toMatch(/NON RICONDURRE/);
    expect(istruzioniAgenda()).toMatch(/accanto a quello vero/);
  });

  it("e dicono di non inventare la data", () => {
    expect(istruzioniAgenda()).toMatch(/Non mettere una data che non ha detto/);
  });
});
