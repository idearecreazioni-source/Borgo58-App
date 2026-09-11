import { describe, expect, it } from "vitest";
import {
  TIPO_CHIARIRE,
  TIPO_FATTO,
  TIPO_PROMEMORIA,
  TIPO_QUALE,
  TIPO_SPOSTA,
  correggiAgenda,
  pezziSeparati,
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
  it("🔴 non è un promemoria: è la CHIUSURA di un impegno che esiste", () => {
    const dopo = destinazioneAgenda(
      detta(TIPO_PROMEMORIA, { titolo: "Segna come fatto il rinnovo della firma" }),
      "Segna come fatto il rinnovo della firma digitale",
    );
    expect(dopo.tipo).toBe(TIPO_FATTO);
    expect(dopo.tipo).not.toBe(TIPO_PROMEMORIA);
    expect(dopo.destinazione).toBe("Da segnare fatto in Agenda");
    // ⚠️ IL MOTIVO NON LO SCRIVE PIU' QUESTO MODULO (fase 2): lo scrive il
    //    database, che è l'unico ad aver guardato in Agenda e a sapere se
    //    l'impegno è uno, nessuno o tanti.
    expect(dopo.motivo).toBeUndefined();
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
    expect(dopo.motivo).toBeUndefined();
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
        detta(TIPO_PROMEMORIA, { titolo: "Chiamare Tiziana", data: "2026-09-09" }, { pezzo: "ricordami di chiamare Tiziana" }),
        detta(TIPO_SPOSTA, { impegno: "verdure", data_nuova: "2026-09-11" }, { pezzo: "sposta le verdure a venerdì" }),
        detta(TIPO_FATTO, { impegno: "firma" }, { pezzo: "segna fatto la firma" }),
        detta("temperatura", { gradi: 3 }, { pezzo: "cella tre gradi" }),
      ],
      "ricordami di chiamare Tiziana, sposta le verdure a venerdì, segna fatto la firma, cella tre gradi",
    );
    expect(dopo.map((a) => a.tipo)).toEqual([
      TIPO_PROMEMORIA,
      TIPO_SPOSTA,
      TIPO_FATTO,
      "temperatura",
    ]);
  });

  // 🔴 DALLA REVISIONE DEL DIFF (11/09/2026): fino a oggi, in una frase
  //    senza nessuna parola di spostamento, lo spostamento DICHIARATO dal
  //    modello passava così com'era. Qui sotto il caso che faceva danno.
  it("🔴 uno spostamento dichiarato in una frase che non parla di spostare resta da chiarire", () => {
    const [a] = correggiAgenda(
      [detta(TIPO_SPOSTA, { impegno: "dentista", data_nuova: "2026-09-14" })],
      "ricordami il dentista lunedì",
    );
    expect(a.tipo).toBe(TIPO_CHIARIRE);
    expect(a.motivo).toMatch(/potrebbe essere un appuntamento nuovo/);
  });

  it("...e anche una chiusura dichiarata senza parole di chiusura", () => {
    const [a] = correggiAgenda(
      [detta(TIPO_FATTO, { impegno: "firma" })],
      "la firma digitale di venerdì",
    );
    expect(a.tipo).toBe(TIPO_CHIARIRE);
  });

  it("⚠️ il prezzo, dichiarato: un verbo che l'elenco non conosce non basta da solo", () => {
    const [a] = correggiAgenda(
      [detta(TIPO_SPOSTA, { impegno: "riunione", data_nuova: "2026-09-17" })],
      "anticipa a giovedì la riunione",
    );
    expect(a.tipo).toBe(TIPO_CHIARIRE);
  });

  it("uno spostamento DETTO come tale resta uno spostamento", () => {
    const [a] = correggiAgenda(
      [detta(TIPO_SPOSTA, { impegno: "ordine delle verdure", data_nuova: "2026-09-18" })],
      "sposta a venerdì l'ordine delle verdure",
    );
    expect(a.tipo).toBe(TIPO_SPOSTA);
  });

  it("⚠️ un «quale impegno?» dato dal modello resta fermo: il database non lo ritraduce", () => {
    const [a] = correggiAgenda(
      [detta(TIPO_QUALE, { impegno: "dentista", gesto: "sposta" })],
      "sposta il dentista",
    );
    expect(a.tipo).toBe(TIPO_CHIARIRE);
  });

  it("una filza vuota non esplode", () => {
    expect(correggiAgenda([], "")).toEqual([]);
    expect(correggiAgenda(null, "")).toEqual([]);
  });
});

// =====================================================================
describe("il collegamento all'Agenda lo dice il DATABASE, non questo modulo", () => {
  // 🔴 FINO ALL'08/09 L'INDIRIZZO VIAGGIAVA DENTRO I DATI DELL'APPUNTO, ed
  //    era un ripiego dichiarato: `azione_percorso` — il posto dove quella
  //    cosa vive dal 27/08 — per un tipo fuori catalogo rispondeva
  //    giustamente niente, e aggiungercelo voleva dire una migrazione che
  //    la fase 1 non poteva fare.
  //
  // 🔴 CON LA FASE 2 LA MIGRAZIONE C'È, e il ripiego si TOGLIE invece di
  //    restare accanto: due posti che dicono dove si va sono due posti che
  //    un giorno diranno cose diverse. Queste prove tengono chiusa quella
  //    porta — se qualcuno rimettesse l'indirizzo qui, diventerebbero rosse.

  it("nessuna delle tre destinazioni si porta dietro un indirizzo", () => {
    const casi = [
      [
        detta(TIPO_FATTO, { impegno: "rinnovo della firma digitale" }),
        "segna come fatto il rinnovo della firma digitale",
      ],
      [
        detta(TIPO_SPOSTA, { impegno: "ordine delle verdure", data_nuova: "2026-09-11" }),
        "sposta a venerdì l'ordine delle verdure",
      ],
      [detta(TIPO_SPOSTA, { impegno: "verdure" }), "sposta le verdure"],
    ];
    for (const [azione, dettato] of casi) {
      expect(destinazioneAgenda(azione, dettato).dati?.dove).toBeUndefined();
    }
  });

  it("🔴 e nemmeno un motivo, sui due che adesso il gestionale sa fare", () => {
    // 🔴 Chi sa com'è andata è il DATABASE: ha guardato in Agenda e sa se
    //    l'impegno è uno, nessuno o tanti. Un motivo scritto qui — prima di
    //    aver guardato — coprirebbe quello vero, ed è la stessa forma del
    //    difetto che la fase 1 ha chiuso: una frase decisa da chi non ha i
    //    dati davanti.
    const fatto = destinazioneAgenda(
      detta(TIPO_FATTO, { impegno: "rinnovo della firma digitale" }),
      "segna come fatto il rinnovo della firma digitale",
    );
    const sposta = destinazioneAgenda(
      detta(TIPO_SPOSTA, { impegno: "ordine delle verdure", data_nuova: "2026-09-11" }),
      "sposta a venerdì l'ordine delle verdure",
    );
    expect(fatto.motivo).toBeUndefined();
    expect(sposta.motivo).toBeUndefined();
  });

  it("⚠️ ma «quale impegno?» il suo motivo ce l'ha ancora, e serve", () => {
    // ⚠️ Qui la mancanza si vede dalle PAROLE — non ha detto a quando, non
    //    ha detto quale — e il database non viene nemmeno interrogato: quel
    //    tipo non è nel catalogo, quindi nessuno lo ritraduce. Se il motivo
    //    sparisse anche da qui, l'appunto resterebbe muto.
    const chiede = destinazioneAgenda(
      detta(TIPO_SPOSTA, { impegno: "verdure" }),
      "sposta le verdure",
    );
    expect(chiede.tipo).toBe(TIPO_QUALE);
    expect(chiede.motivo).toMatch(/a quando/);
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
    expect(Object.keys(a.dati).sort()).toEqual(["gesto", "titolo"]);
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
// =====================================================================
// TRE APPUNTAMENTI NUOVI NELLA STESSA DETTATURA — 11/09/2026
// =====================================================================
// 🔴 Mandato «MEMO affidabile». Una frase unica con più impegni nuovi deve
//    restare più impegni: nessuno perso, nessuno fuso, nessuno trasformato.
//
// ⚠️ FINO A STAMATTINA QUI C'ERANO DUE `it.fails`: la diagnosi del difetto,
//    scritta come comportamento giusto che falliva. Con la variante (a)
//    decisa da Alessio sono diventate prove normali — e sono quelle qui
//    sotto, più i casi che la cura apre.
const DENTISTA = { titolo: "Dentista", data: "2026-09-14", ora: "10:00", avviso_data: "2026-09-13", avviso_ora: "18:00" };
const RIUNIONE = { titolo: "Riunione col commercialista", data: "2026-09-15", ora: "15:30" };
const TOVAGLIE = { titolo: "Ritirare le tovaglie", data: "2026-09-16" };

describe("🔴 tre appuntamenti nuovi detti insieme, con ore diverse", () => {
  it("restano TRE promemoria, nell'ordine detto, ognuno coi SUOI dati — ore comprese", () => {
    const prima = [
      detta(TIPO_PROMEMORIA, DENTISTA, { pezzo: "alle 10 ho il dentista lunedì, avvisami domenica alle 18" }),
      detta(TIPO_PROMEMORIA, RIUNIONE, { pezzo: "martedì alle 15 e 30 la riunione col commercialista" }),
      detta(TIPO_PROMEMORIA, TOVAGLIE, { pezzo: "mercoledì mattina ritirare le tovaglie" }),
    ];
    const dopo = correggiAgenda(
      prima,
      "alle 10 ho il dentista lunedì, avvisami domenica alle 18, martedì alle 15 e 30 la " +
        "riunione col commercialista, mercoledì mattina ritirare le tovaglie",
    );
    expect(dopo.map((a) => a.tipo)).toEqual([TIPO_PROMEMORIA, TIPO_PROMEMORIA, TIPO_PROMEMORIA]);
    expect(dopo.map((a) => a.dati)).toEqual(prima.map((a) => a.dati));
    expect(dopo.map((a) => a.dati.ora ?? null)).toEqual(["10:00", "15:30", null]);
  });

  it("...e senza nessun pezzo di frase restano lo stesso: senza spostamenti non c'è niente da decidere", () => {
    const dopo = correggiAgenda(
      [detta(TIPO_PROMEMORIA, DENTISTA), detta(TIPO_PROMEMORIA, RIUNIONE), detta(TIPO_PROMEMORIA, TOVAGLIE)],
      "ricordami il dentista lunedì alle 10, la riunione martedì alle 15 e 30 e le tovaglie mercoledì",
    );
    expect(dopo.map((a) => a.tipo)).toEqual([TIPO_PROMEMORIA, TIPO_PROMEMORIA, TIPO_PROMEMORIA]);
  });

  it("🔴 «le spuntature» non contiene più «spunta»: le parole si cercano intere", () => {
    const dopo = correggiAgenda(
      [detta(TIPO_PROMEMORIA, { titolo: "Ordinare le spuntature di maiale", data: "2026-09-19" })],
      "ricordami di ordinare le spuntature di maiale per sabato",
    );
    expect(dopo[0].tipo).toBe(TIPO_PROMEMORIA);
    // ⚠️ E il confine di parola non spegne le chiusure vere.
    expect(cosaVuoleFare("spunta la chiamata al commercialista")).toBe("fatto");
    expect(cosaVuoleFare("il pesce fatto in casa")).toBe("altro");
  });
});

// =====================================================================
// FRASE MISTA: APPUNTAMENTI NUOVI E UNO SPOSTAMENTO — variante (a)
// =====================================================================
// 🔴 Il difetto misurato dal vivo: tre appuntamenti più «e sposta a venerdì
//    l'ordine delle verdure» diventavano tutti «da spostare» o «quale
//    impegno?». Con i pezzi di frase ognuno si decide sulle sue parole.
const MISTA =
  "Ricordami il dentista lunedì alle 10, la riunione col commercialista martedì alle 15 e 30, " +
  "e sposta a venerdì l'ordine delle verdure";

describe("🔴 frase mista con appuntamenti nuovi e uno spostamento", () => {
  const filza = () => [
    detta(TIPO_PROMEMORIA, DENTISTA, { pezzo: "Ricordami il dentista lunedì alle 10" }),
    detta(TIPO_PROMEMORIA, RIUNIONE, { pezzo: "la riunione col commercialista martedì alle 15 e 30" }),
    detta(TIPO_SPOSTA, { impegno: "ordine delle verdure", data_nuova: "2026-09-18" }, {
      pezzo: "e sposta a venerdì l'ordine delle verdure",
    }),
  ];

  it("con i pezzi certi, gli appuntamenti restano NUOVI e lo spostamento resta uno spostamento", () => {
    const dopo = correggiAgenda(filza(), MISTA);
    expect(dopo.map((a) => a.tipo)).toEqual([TIPO_PROMEMORIA, TIPO_PROMEMORIA, TIPO_SPOSTA]);
    expect(dopo[0].dati).toEqual(DENTISTA);
    expect(dopo[1].dati).toEqual(RIUNIONE);
    expect(dopo[2].dati.titolo).toBe("ordine delle verdure");
  });

  it("🔴 il pezzo si riconosce anche con accenti e punteggiatura diversi", () => {
    const f = filza();
    f[0].pezzo = "ricordami il DENTISTA lunedi alle 10";
    expect(correggiAgenda(f, MISTA).map((a) => a.tipo)).toEqual([
      TIPO_PROMEMORIA,
      TIPO_PROMEMORIA,
      TIPO_SPOSTA,
    ]);
  });

  it("uno spostamento capito dal modello come promemoria si corregge, sulle SUE parole", () => {
    const f = filza();
    f[2] = detta(TIPO_PROMEMORIA, { titolo: "ordine delle verdure", data: "2026-09-18" }, {
      pezzo: "e sposta a venerdì l'ordine delle verdure",
    });
    const dopo = correggiAgenda(f, MISTA);
    expect(dopo.map((a) => a.tipo)).toEqual([TIPO_PROMEMORIA, TIPO_PROMEMORIA, TIPO_SPOSTA]);
  });

  it("⚠️ «sposta» detto per una cosa del magazzino non tocca il dentista", () => {
    const dopo = correggiAgenda(
      [
        detta("giacenza", { prodotto: 3, quanto_ce: 2 }, { pezzo: "sposta i pomodori in cella" }),
        detta(TIPO_PROMEMORIA, { titolo: "Dentista", data: "2026-09-14" }, { pezzo: "ricordami il dentista lunedì" }),
      ],
      "sposta i pomodori in cella e ricordami il dentista lunedì",
    );
    expect(dopo.map((a) => a.tipo)).toEqual(["giacenza", TIPO_PROMEMORIA]);
  });
});

// =====================================================================
// IL CASO AMBIGUO — resta DA CHIARIRE, e non si approva
// =====================================================================
// 🔴 La regola di Alessio: *«se una frase mista contiene nuovi appuntamenti
//    e uno spostamento/chiusura, ma MEMO non riesce a separare con certezza
//    le parti, gli elementi ambigui devono restare appunti non approvabili e
//    spiegare il motivo»*.
describe("🔴 frase mista che non si separa con certezza", () => {
  const nuovi = (pezzi = [null, null, null]) => [
    detta(TIPO_PROMEMORIA, DENTISTA, { pezzo: pezzi[0] }),
    detta(TIPO_PROMEMORIA, RIUNIONE, { pezzo: pezzi[1] }),
    detta(TIPO_SPOSTA, { impegno: "ordine delle verdure", data_nuova: "2026-09-18" }, { pezzo: pezzi[2] }),
  ];
  const tipi = (azioni) => correggiAgenda(azioni, MISTA).map((a) => a.tipo);

  it("senza pezzi di frase: TUTTE quelle dell'Agenda restano da chiarire", () => {
    expect(tipi(nuovi())).toEqual([TIPO_CHIARIRE, TIPO_CHIARIRE, TIPO_CHIARIRE]);
  });

  it("basta UN pezzo mancante: la separazione non è certa", () => {
    expect(
      tipi(nuovi(["Ricordami il dentista lunedì alle 10", null, "e sposta a venerdì l'ordine delle verdure"])),
    ).toEqual([TIPO_CHIARIRE, TIPO_CHIARIRE, TIPO_CHIARIRE]);
  });

  it("un pezzo che non è stato detto (parole del modello) non vale", () => {
    expect(
      tipi(
        nuovi([
          "appuntamento dal dentista",
          "la riunione col commercialista martedì alle 15 e 30",
          "e sposta a venerdì l'ordine delle verdure",
        ]),
      ),
    ).toEqual([TIPO_CHIARIRE, TIPO_CHIARIRE, TIPO_CHIARIRE]);
  });

  it("due pezzi che si prendono le stesse parole non valgono", () => {
    expect(
      tipi(
        nuovi([
          "Ricordami il dentista lunedì alle 10, la riunione",
          "la riunione col commercialista martedì alle 15 e 30",
          "e sposta a venerdì l'ordine delle verdure",
        ]),
      ),
    ).toEqual([TIPO_CHIARIRE, TIPO_CHIARIRE, TIPO_CHIARIRE]);
  });

  it("con più cose, un pezzo che è la frase intera non è un taglio", () => {
    expect(tipi(nuovi([MISTA, MISTA, MISTA]))).toEqual([TIPO_CHIARIRE, TIPO_CHIARIRE, TIPO_CHIARIRE]);
  });

  it("🔴 uno spostamento dichiarato che le SUE parole non dicono resta da chiarire", () => {
    // È la forma esatta del danno: un appuntamento nuovo dichiarato «da
    // spostare», che approvando sposterebbe l'impegno omonimo che c'è già.
    const dopo = correggiAgenda(
      [
        detta(TIPO_SPOSTA, { impegno: "dentista", data_nuova: "2026-09-14" }, { pezzo: "Ricordami il dentista lunedì alle 10" }),
        detta(TIPO_PROMEMORIA, RIUNIONE, { pezzo: "la riunione col commercialista martedì alle 15 e 30" }),
        detta(TIPO_SPOSTA, { impegno: "ordine delle verdure", data_nuova: "2026-09-18" }, {
          pezzo: "e sposta a venerdì l'ordine delle verdure",
        }),
      ],
      MISTA,
    );
    expect(dopo.map((a) => a.tipo)).toEqual([TIPO_CHIARIRE, TIPO_PROMEMORIA, TIPO_SPOSTA]);
  });

  it("il motivo lo dice, e quello che si era capito resta: titolo, giorno, ora", () => {
    const [a] = correggiAgenda(nuovi(), MISTA);
    expect(a.destinazione).toBe("Da chiarire in Agenda");
    expect(a.motivo).toMatch(/non sono riuscito a capire con certezza/);
    expect(a.motivo).toMatch(/non si può approvare/);
    expect(a.dati).toMatchObject({ titolo: "Dentista", data: "2026-09-14", ora: "10:00" });
  });

  it("⚠️ il tipo da chiarire non è nessuno di quelli che il gestionale esegue", () => {
    for (const t of [TIPO_PROMEMORIA, TIPO_FATTO, TIPO_SPOSTA, TIPO_QUALE]) expect(TIPO_CHIARIRE).not.toBe(t);
  });

  it("quello che non è Agenda non cambia, anche quando il resto è da chiarire", () => {
    const dopo = correggiAgenda([...nuovi(), detta("temperatura", { gradi: 3 })], MISTA);
    expect(dopo[3].tipo).toBe("temperatura");
  });
});

describe("i pezzi di frase", () => {
  it("un pezzo detto due volte non dice quale dei due è il suo", () => {
    const d = "ricordami il dentista e poi ricordami il dentista";
    expect(
      pezziSeparati([detta(TIPO_PROMEMORIA, {}, { pezzo: "ricordami il dentista" }), detta("x", {}, { pezzo: "e poi" })], d),
    ).toBeNull();
  });

  it("pezzi detti, distinti e in fila: la separazione è certa", () => {
    expect(
      pezziSeparati(
        [detta(TIPO_PROMEMORIA, {}, { pezzo: "Ricordami il dentista" }), detta(TIPO_SPOSTA, {}, { pezzo: "sposta le verdure" })],
        "Ricordami il dentista, e sposta le verdure!",
      ),
    ).toEqual(["ricordami il dentista", "sposta le verdure"]);
  });
});

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
