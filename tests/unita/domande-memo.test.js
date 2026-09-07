import { describe, expect, it } from "vitest";
import { NON_LETTO } from "../../src/lib/calcoli/letture";
import {
  DOMANDE_CHE_SO,
  combacia,
  componiRisposta,
  quandoInParole,
  fraICandidati,
  RIGHE_MOSTRATE,
  titoloDellaDomanda,
} from "../../src/lib/calcoli/domande";

// =====================================================================
// LE NOVE DOMANDE DI MEMO — e i casi storti, che sono quelli che contano
// =====================================================================
// ⚠️ QUI NON C'È NESSUN MODELLO E NESSUN DATABASE: la regola riceve i dati
//    già letti. È quello che permette di provare le cose che dal vivo non
//    si sanno far succedere — una lettura che fallisce, un piatto i cui
//    allergeni nessuno ha guardato, due prodotti che si chiamano uguale.
//
// 🔴 LA COSA CHE QUESTE PROVE SORVEGLIANO PIÙ DI TUTTE: che una lettura
//    fallita non diventi mai un numero, uno zero o un elenco vuoto. Sono
//    tre bugie diverse e si leggono tutte come una risposta.

const ricetta = (id, name, extra = {}) => ({
  id,
  name,
  pronta_per_carta: false,
  in_carta: false,
  ritirata_il: null,
  ...extra,
});

const giacenza = (id, nome, quanto, extra = {}) => ({
  ingredient_id: id,
  ingredient_name: nome,
  unit: "l",
  current_quantity: quanto,
  stock_minimum_threshold: null,
  below_threshold: false,
  nearest_expiry: null,
  tenuto_in_magazzino: true,
  ...extra,
});

const impegno = (id, title, giorni, extra = {}) => ({
  id,
  title,
  due_date: giorni == null ? null : "2026-09-16",
  giorni_alla_scadenza: giorni,
  corsia: giorni == null ? "quando_capita" : giorni < 0 ? "in_ritardo" : "questa_settimana",
  ...extra,
});

// =====================================================================
describe("RICETTARIO — «ho la ricetta della carbonara?»", () => {
  const chiedi = (soggetto, ricette) =>
    componiRisposta({ chiede: "ricetta_esiste", soggetto }, { ricette });

  it("ce l'ho: dice sì, in che stato è, e porta ALLA RICETTA", () => {
    const r = chiedi("carbonara", [ricetta("r1", "Carbonara", { in_carta: true })]);
    expect(r.stato).toBe("risposta");
    expect(r.frase).toContain("Sì");
    expect(r.frase).toContain("Carbonara");
    expect(r.frase).toContain("In carta");
    // ⚠️ Il collegamento va al RECORD quando ce n'è uno: mandare all'elenco
    //    obbligherebbe a cercarla di nuovo a mano.
    expect(r.a).toBe("/ricettario/ricette/r1");
  });

  it("non ce l'ho: dice NO, e non è la stessa frase di «non lo so»", () => {
    const r = chiedi("bottarga", []);
    expect(r.stato).toBe("risposta");
    expect(r.frase).toMatch(/^No/);
    expect(r.frase).not.toMatch(/non lo so/i);
  });

  it("🔴 la lettura fallita NON diventa «non ce l'ho»", () => {
    // È il difetto che questo modulo esiste per rendere impossibile: con un
    // `.catch(() => [])` questa prova sarebbe identica a quella sopra, e
    // MEMO direbbe «non hai quella ricetta» perché la rete era caduta.
    const r = chiedi("carbonara", NON_LETTO);
    expect(r.stato).toBe("non_lo_so");
    expect(r.frase).toMatch(/non lo so/i);
    expect(r.frase).not.toMatch(/\bNo:/);
    // ⚠️ E la via d'uscita c'è lo stesso: se non gliela so dire io, la va a
    //    guardare lui.
    expect(r.a).toBe("/ricettario/ricette");
  });

  it("senza soggetto CHIEDE quale piatto, invece di rispondere a caso", () => {
    const r = chiedi(null, []);
    expect(r.stato).toBe("chiarimento");
    expect(r.frase).toBe("Di quale piatto?");
  });

  it("più d'una: le elenca tutte, perché lì elencarle È la risposta", () => {
    const r = chiedi("carbonara", [ricetta("r1", "Carbonara"), ricetta("r2", "Carbonara di mare")]);
    expect(r.stato).toBe("risposta");
    expect(r.righe).toHaveLength(2);
    expect(r.righe.map((x) => x.a)).toEqual([
      "/ricettario/ricette/r1",
      "/ricettario/ricette/r2",
    ]);
  });
});

describe("RICETTARIO — «la carbonara ha il sedano?»", () => {
  const chiedi = (soggetto, allergene, ricette, allergeni, scelto) =>
    componiRisposta({ chiede: "allergeni", soggetto, allergene, scelto }, { ricette, allergeni });

  const guardati = (dentro, extra = {}) => ({
    allergens: dentro,
    daVerificare: false,
    ingredienti: [],
    tracce: [],
    ...extra,
  });

  it("ce l'ha: sì", () => {
    const r = chiedi("carbonara", "sedano", [ricetta("r1", "Carbonara")], guardati(["sedano"]));
    expect(r.stato).toBe("risposta");
    expect(r.frase).toMatch(/^Sì/);
    expect(r.frase).toContain("Sedano");
  });

  it("non ce l'ha E li ha guardati tutti: no", () => {
    const r = chiedi("carbonara", "sedano", [ricetta("r1", "Carbonara")], guardati(["uova", "latte"]));
    expect(r.stato).toBe("risposta");
    expect(r.frase).toMatch(/^No/);
  });

  it("🔴 non ce l'ha ma qualcuno NON l'ha guardato: NON LO SO, mai «no»", () => {
    // 🔴 È la riga più importante di tutto il blocco. Un «no» qui è una
    //    promessa che nessuno può mantenere, e chi legge la gira a un
    //    cliente che ha un'allergia.
    const r = chiedi(
      "carbonara",
      "sedano",
      [ricetta("r1", "Carbonara")],
      guardati(["uova"], { daVerificare: true, ingredienti: ["Guanciale"] }),
    );
    expect(r.stato).toBe("non_lo_so");
    // ⚠️ «Non te lo so dire» comincia per «Non»: il confine di parola
    //    distingue il rifiuto dalla negazione, ed è quello che conta.
    expect(r.frase).not.toMatch(/^No[,.: ]/);
    expect(r.frase).toContain("Guanciale");
  });

  it("le tracce non si confondono col «contiene»", () => {
    const r = chiedi(
      "carbonara",
      "soia",
      [ricetta("r1", "Carbonara")],
      guardati(["uova"], { tracce: ["soia"] }),
    );
    expect(r.frase).toContain("tracce");
    expect(r.frase).not.toMatch(/^Sì/);
  });

  it("🔴 due piatti che ci somigliano: CHIEDE quale, non ne sceglie uno", () => {
    const r = chiedi("carbonara", null, [
      ricetta("r1", "Carbonara"),
      ricetta("r2", "Carbonara di mare"),
    ], null);
    expect(r.stato).toBe("scegli");
    expect(r.candidati.map((c) => c.soggetto)).toEqual(["Carbonara", "Carbonara di mare"]);
  });

  it("🔴 e il nome esatto NON scioglie il dubbio da solo: lo scioglie il TOCCO", () => {
    // 🔴 «Carbonara» è il nome esatto della prima, e prenderla per buona
    //    sarebbe scegliere al posto suo: se intendeva «Carbonara di mare»,
    //    la risposta è sbagliata e ha l'aria di essere giusta.
    const due = [ricetta("r1", "Carbonara"), ricetta("r2", "Carbonara di mare")];
    expect(chiedi("Carbonara", null, due, guardati(["uova"])).stato).toBe("scegli");

    // ⚠️ E col tocco il giro finisce: senza questa metà, chi sceglie si
    //    vedrebbe rifare la stessa domanda per sempre.
    const dopo = chiedi("Carbonara", null, due, guardati(["uova"]), "r1");
    expect(dopo.stato).toBe("risposta");
    expect(dopo.frase).toContain("Uova");
  });

  it("l'elenco completo dichiara il limite quando qualcuno non è stato guardato", () => {
    const r = chiedi(
      "carbonara",
      null,
      [ricetta("r1", "Carbonara")],
      guardati(["uova"], { daVerificare: true, ingredienti: ["Guanciale", "Pecorino"] }),
    );
    expect(r.stato).toBe("risposta");
    expect(r.limite).toContain("2 ingredienti");
  });

  it("gli allergeni non letti NON diventano «non ne ha»", () => {
    const r = chiedi("carbonara", null, [ricetta("r1", "Carbonara")], NON_LETTO);
    expect(r.stato).toBe("non_lo_so");
  });
});

describe("RICETTARIO — «quali piatti ho in carta?»", () => {
  it("li elenca, uno per uno, coi collegamenti", () => {
    const r = componiRisposta(
      { chiede: "piatti_in_carta" },
      { ricette: [ricetta("r1", "Caponata", { in_carta: true })] },
    );
    expect(r.stato).toBe("risposta");
    expect(r.righe[0].a).toBe("/ricettario/ricette/r1");
  });

  it("nessuno in carta è una risposta vera; non letto no", () => {
    expect(componiRisposta({ chiede: "piatti_in_carta" }, { ricette: [] }).frase).toContain(
      "Non c'è nessun piatto",
    );
    expect(componiRisposta({ chiede: "piatti_in_carta" }, { ricette: NON_LETTO }).stato).toBe(
      "non_lo_so",
    );
  });
});

// =====================================================================
describe("MAGAZZINO — «quanto olio ho?»", () => {
  const chiedi = (soggetto, giacenze, scelto) =>
    componiRisposta({ chiede: "quanto_ho", soggetto, scelto }, { giacenze });

  it("dice quanto ce n'è, con la sua unità", () => {
    const r = chiedi("olio", [giacenza("i1", "Olio extravergine", 12.5)]);
    expect(r.stato).toBe("risposta");
    expect(r.frase).toContain("Olio extravergine");
    expect(r.frase).toContain("12,5 l");
  });

  it("🔴 quello che non c'è NON vale zero", () => {
    // «Zero» si legge «l'hai finito». Sono due fatti diversi, e chi legge
    // il primo va a cercarlo in cella.
    const r = chiedi("bottarga", [giacenza("i1", "Olio extravergine", 12.5)]);
    expect(r.stato).toBe("risposta");
    expect(r.frase).toContain("non ce l'ho in magazzino");
    expect(r.frase).not.toMatch(/\b0\b/);
  });

  it("🔴 due oli: CHIEDE quale, e non ne somma né ne sceglie uno", () => {
    const due = [giacenza("i1", "Olio extravergine", 12.5), giacenza("i2", "Olio di semi", 2)];
    const r = chiedi("olio", due);
    expect(r.stato).toBe("scegli");
    expect(r.candidati).toHaveLength(2);
    expect(r.frase).not.toContain("14,5");

    // ⚠️ E il tocco chiude il giro, per identificativo.
    const dopo = chiedi("Olio di semi", due, "i2");
    expect(dopo.stato).toBe("risposta");
    expect(dopo.frase).toContain("Olio di semi");
  });

  // ===================================================================
  // 🔴 IL CASO VERO DEL COLLAUDO A MANO — 07/09/2026
  // ===================================================================
  // Alessio chiede «quanto olio ho?» e fra i candidati compare «Pomodoro
  // secco di Pachino sott'olio». La parola «olio» nel nome ce l'ha davvero:
  // e' la RICERCA a trattarla come se definisse il prodotto.
  const SCAFFALE = [
    giacenza("i1", "Olio extravergine", 12.5),
    giacenza("i2", "Olio di semi di arachide", 2),
    giacenza("i3", "Pomodoro secco di Pachino sott'olio", 1, { unit: "kg" }),
  ];

  it("🔴 «quanto olio ho?» NON propone il pomodoro sott'olio", () => {
    const r = chiedi("olio", SCAFFALE);
    expect(r.stato).toBe("scegli");
    // ⚠️ Il chiarimento si conserva: gli oli veri sono due, e fra due si
    //    chiede ancora quale.
    expect(r.candidati.map((x) => x.testo)).toEqual([
      "Olio extravergine",
      "Olio di semi di arachide",
    ]);
    expect(r.candidati.map((x) => x.testo).join(" ")).not.toContain("Pomodoro");
  });

  it("...e dichiara di aver lasciato fuori qualcosa, invece di scremare in silenzio", () => {
    // ⚠️ Una scrematura silenziosa e' la stessa famiglia dell'elenco tagliato
    //    senza dirlo: chi guarda non saprebbe che il gestionale ha scelto.
    const r = chiedi("olio", SCAFFALE);
    expect(r.limite).toContain("Pomodoro secco di Pachino sott'olio");
  });

  it("🔴 con un olio solo il pomodoro resta fuori, e la risposta e' quella dell'olio", () => {
    // ⚠️ La meta' che discrimina sul verso opposto: senza la cura qui
    //    uscirebbe «ne ho 2: di quale?» — cioe' un chiarimento inventato su
    //    una domanda che ha una risposta sola.
    const r = chiedi("olio", [SCAFFALE[0], SCAFFALE[2]]);
    expect(r.stato).toBe("risposta");
    expect(r.frase).toContain("Olio extravergine");
    expect(r.limite).toContain("Pomodoro");
  });

  it("🔴 e il pomodoro NON diventa irraggiungibile: chi lo nomina lo trova", () => {
    // 🔴 E' il verso in cui la cura poteva fare piu' danno del difetto. Si
    //    guarda in testa; solo se in testa non c'e' nessuno si torna a
    //    guardare dentro il nome — quindi «pachino» e «sott'olio» trovano
    //    ancora il pomodoro, e «extravergine» trova ancora l'olio.
    expect(chiedi("pomodoro", SCAFFALE).frase).toContain("Pomodoro secco");
    expect(chiedi("pachino", SCAFFALE).frase).toContain("Pomodoro secco");
    expect(chiedi("extravergine", SCAFFALE).frase).toContain("Olio extravergine");
  });

  it("...e quando non si e' scremato niente non si dichiara niente", () => {
    // Un «ho lasciato fuori» che comparisse sempre sarebbe rumore.
    expect(chiedi("pomodoro", SCAFFALE).limite).toBeNull();
  });

  it("la lettura fallita non diventa «non ce l'ho»", () => {
    const r = chiedi("olio", NON_LETTO);
    expect(r.stato).toBe("non_lo_so");
    expect(r.frase).not.toContain("non ce l'ho in magazzino");
  });

  it("gli accenti e le maiuscole non fanno sparire un prodotto", () => {
    const r = chiedi("ragu", [giacenza("i1", "Ragù di maiale", 3, { unit: "kg" })]);
    expect(r.stato).toBe("risposta");
    expect(r.frase).toContain("Ragù di maiale");
  });

  it("sotto la scorta minima lo dice, e dice quanta è", () => {
    const r = chiedi("olio", [
      giacenza("i1", "Olio extravergine", 1, {
        stock_minimum_threshold: 5,
        below_threshold: true,
      }),
    ]);
    expect(r.righe.some((x) => x.testo.includes("scorta minima"))).toBe(true);
  });

  it("🔴 un prodotto FUORI MAGAZZINO non riceve nessun numero", () => {
    // 🔴 Trovato dalla revisione del diff. La prima stesura rispondeva
    //    «Ghiaccio secco: 0 kg» con un'avvertenza sotto — ma il Magazzino,
    //    al posto della giacenza, scrive «fuori magazzino» apposta: quel
    //    numero è quello dell'ultimo carico e non scenderà mai.
    // ⚠️ E il punto non è l'avvertenza: è che MEMO diceva una cosa DIVERSA
    //    da quella che si legge aprendo la schermata, cioè rompeva la
    //    promessa su cui poggia tutta la fase 1.
    const r = chiedi("ghiaccio", [
      giacenza("i1", "Ghiaccio secco", 0, {
        unit: "kg",
        tenuto_in_magazzino: false,
        stock_minimum_threshold: 5,
        below_threshold: true,
      }),
    ]);
    expect(r.stato).toBe("risposta");
    expect(r.frase).toContain("non lo tieni in magazzino");
    // Nessuna cifra, nessuna unità, nessuna soglia: la schermata non le mostra.
    expect(r.frase).not.toMatch(/d/);
    expect(r.righe).toEqual([]);
    expect(r.limite).toBeTruthy();
  });
});

describe("MAGAZZINO — «cosa mi manca?»", () => {
  const chiedi = (giacenze) => componiRisposta({ chiede: "cosa_manca" }, { giacenze });

  it("elenca quello che è sotto la scorta minima", () => {
    const r = chiedi([
      giacenza("i1", "Olio", 1, { stock_minimum_threshold: 5, below_threshold: true }),
      giacenza("i2", "Sale", 9, { stock_minimum_threshold: 2 }),
    ]);
    expect(r.righe).toHaveLength(1);
    expect(r.righe[0].testo).toContain("Olio");
  });

  it("🔴 un prodotto fuori magazzino NON è mai «sotto soglia»", () => {
    // ⚠️ Stesso criterio del Magazzino: la sua giacenza non scende, quindi
    //    il confronto non vuol dire niente — e in lista della spesa non ci
    //    entra comunque. Contarlo qui farebbe dire a MEMO che manca una cosa
    //    che la schermata non segnala.
    const r = chiedi([
      giacenza("i1", "Ghiaccio secco", 0, {
        stock_minimum_threshold: 5,
        below_threshold: true,
        tenuto_in_magazzino: false,
      }),
    ]);
    expect(r.frase).toContain("Non manca niente");
    expect(r.righe).toEqual([]);
  });

  it("🔴 «non manca niente» dichiara QUANTI prodotti non possono comparire", () => {
    // ⚠️ Senza questa riga la frase sembrerebbe la fotografia del magazzino
    //    intero, mentre è quella dei soli prodotti che una soglia ce l'hanno.
    const r = chiedi([
      giacenza("i1", "Olio", 9, { stock_minimum_threshold: 5 }),
      giacenza("i2", "Sale", 3),
      giacenza("i3", "Pepe", 3),
    ]);
    expect(r.frase).toContain("Non manca niente");
    expect(r.limite).toContain("2 prodotti");
  });

  it("e quando hanno tutti la loro soglia, non c'è nessun limite da dichiarare", () => {
    // La metà che discrimina: un limite scritto sempre sarebbe rumore.
    const r = chiedi([giacenza("i1", "Olio", 9, { stock_minimum_threshold: 5 })]);
    expect(r.limite).toBeNull();
  });

  it("non letto resta non letto", () => {
    expect(chiedi(NON_LETTO).stato).toBe("non_lo_so");
  });
});

describe("MAGAZZINO — «cosa scade?»", () => {
  const partita = (id, ingrediente, giorni, segnalare) => ({
    lotto_id: id,
    ingrediente,
    quantita: 2,
    unita: "kg",
    scadenza: "2026-09-10",
    giorni_mancanti: giorni,
    da_segnalare: segnalare,
  });
  const chiedi = (partite) => componiRisposta({ chiede: "cosa_scade" }, { partite });

  it("elenca le partite segnalate, e porta allo scadenziario", () => {
    const r = chiedi([partita("l1", "Ricotta", 2, true), partita("l2", "Farina", 200, false)]);
    expect(r.righe).toHaveLength(1);
    expect(r.righe[0].testo).toContain("scade fra 2 giorni");
    expect(r.a).toBe("/magazzino/scadenze");
  });

  it("🔴 «non scade niente» dice quante partite tacciono apposta", () => {
    const r = chiedi([partita("l1", "Farina", 200, false)]);
    expect(r.frase).toContain("Non scade niente");
    expect(r.limite).toContain("non è segnalata");
  });

  it("una già scaduta non si legge «fra -3 giorni»", () => {
    const r = chiedi([partita("l1", "Ricotta", -3, true)]);
    expect(r.righe[0].testo).toContain("scaduta da 3 giorni");
    expect(r.righe[0].testo).not.toContain("-3");
  });

  it("non letto resta non letto", () => {
    expect(chiedi(NON_LETTO).stato).toBe("non_lo_so");
  });
});

// =====================================================================
describe("AGENDA — «cosa devo fare oggi?»", () => {
  const chiedi = (impegni) => componiRisposta({ chiede: "agenda_oggi" }, { impegni });

  it("mostra solo quello di oggi, non tutta la settimana", () => {
    const r = chiedi([impegno("t1", "Portare i corrispettivi", 0), impegno("t2", "Ordinare il pane", 3)]);
    expect(r.righe).toHaveLength(1);
    expect(r.righe[0].a).toBe("/agenda/t1");
  });

  it("🔴 «per oggi niente» non tace sui ritardi", () => {
    // ⚠️ Vero e fuorviante: «non hai niente» con quattordici scadute dietro
    //    è la stessa famiglia dell'elenco che sembra completo.
    const r = chiedi([impegno("t1", "F24", -5)]);
    expect(r.frase).toContain("Per oggi non hai niente");
    expect(r.limite).toContain("in ritardo");
  });

  it("senza ritardi non inventa un avviso", () => {
    const r = chiedi([impegno("t1", "Ordinare il pane", 3)]);
    expect(r.limite).toBeNull();
  });

  it("non letto resta non letto", () => {
    expect(chiedi(NON_LETTO).stato).toBe("non_lo_so");
  });
});

describe("AGENDA — «cosa sono in ritardo?»", () => {
  const chiedi = (impegni) => componiRisposta({ chiede: "agenda_in_ritardo" }, { impegni });

  it("li elenca dicendo da quando", () => {
    const r = chiedi([impegno("t1", "F24", -5), impegno("t2", "Pane", 1)]);
    expect(r.righe).toHaveLength(1);
    expect(r.righe[0].testo).toContain("5 giorni fa");
  });

  it("nessun ritardo è una risposta vera", () => {
    expect(chiedi([impegno("t2", "Pane", 1)]).frase).toContain("Non sei in ritardo");
  });

  it("non letto resta non letto", () => {
    expect(chiedi(NON_LETTO).stato).toBe("non_lo_so");
  });
});

describe("«quando scade …?» — e la cosa che scade può stare in due posti", () => {
  // 🔴 IL DIFETTO CHE CHIUDE, dal collaudo a mano del 07/09/2026: «quando
  //    scade l'astice?» cercava un IMPEGNO chiamato astice e rispondeva che
  //    non lo trovava. L'astice sta in cella.
  const partita = (id, prodotto, scadenza, extra = {}) => ({
    lotto_id: id,
    prodotto,
    unita: "kg",
    giacenza: 3,
    scadenza,
    ...extra,
  });
  const OGGI = "2026-09-07";

  const chiedi = (soggetto, impegni, partite = [], extra = {}) =>
    componiRisposta(
      { chiede: "quando_scade", soggetto },
      { impegni, partite, oggi: OGGI, ...extra },
    );

  it("dice la data E fra quanto, col collegamento all'impegno", () => {
    const r = chiedi("f24", [impegno("t1", "F24 di settembre", 9)], []);
    expect(r.stato).toBe("risposta");
    expect(r.frase).toContain("fra 9 giorni");
    expect(r.a).toBe("/agenda/t1");
  });

  it("🔴 «quando scade l'astice?» risponde dal MAGAZZINO, non dall'Agenda", () => {
    // ⚠️ Prima della cura questa frase cercava un impegno chiamato «astice»
    //    e rispondeva «non ne trovo nessuno»: la risposta era in cella.
    const r = chiedi("astice", [impegno("t1", "Ordinare il pane", 2)], [
      partita("l1", "Astice", "2026-08-05"),
      partita("l2", "Astice", "2026-09-20"),
    ]);
    expect(r.stato).toBe("risposta");
    expect(r.frase).toContain("Astice");
    expect(r.frase).toContain("5 ago 2026");
    expect(r.frase).toContain("già scaduta");
    expect(r.righe).toHaveLength(2);
    // Porta allo scadenziario, non all'Agenda.
    expect(r.a).toBe("/magazzino/scadenze");
  });

  it("🔴 ...e «quando scade l'impegno F24?» resta AGENDA", () => {
    // ⚠️ È la metà che discrimina: una cura che mandasse tutto in magazzino
    //    passerebbe la prova qui sopra e romperebbe gli adempimenti.
    const r = chiedi("F24", [impegno("t1", "F24 di settembre", 9)], [], {
      agendaEsplicita: true,
    });
    expect(r.stato).toBe("risposta");
    expect(r.frase).toContain("F24 di settembre");
    expect(r.a).toBe("/agenda/t1");
  });

  it("un impegno si trova ANCHE senza nominare l'Agenda, se in magazzino non c'è", () => {
    // ⚠️ La precedenza decide l'ordine, non l'esito: «quando scade l'F24?»
    //    detto nudo continua a rispondere.
    const r = chiedi("F24", [impegno("t1", "F24 di settembre", 9)], []);
    expect(r.a).toBe("/agenda/t1");
  });

  it("🔴 quando la cosa sta in tutt'e due i posti, l'altro si DICHIARA", () => {
    const r = chiedi("astice", [impegno("t1", "Ordinare l'astice", 2)], [
      partita("l1", "Astice", "2026-09-20"),
    ]);
    expect(r.frase).toContain("Astice");
    expect(r.limite).toContain("in Agenda");
  });

  it("🔴 «non lo trovo» dice che ha guardato in TUTT'E DUE i posti", () => {
    const r = chiedi("bottarga", [impegno("t1", "Ordinare il pane", 2)], []);
    expect(r.frase).toContain("né fra le cose in magazzino");
    expect(r.frase).toContain("né fra gli impegni");
  });

  it("🔴 e se una delle due letture è caduta NON dice «non c'è»", () => {
    // La trappola del 19/08: assenza di informazione e informazione di
    // assenza sono due cose diverse.
    expect(chiedi("astice", [], NON_LETTO).stato).toBe("non_lo_so");
    expect(chiedi("f24", NON_LETTO, []).stato).toBe("non_lo_so");
  });

  it("un impegno senza scadenza lo dice invece di inventarne una", () => {
    const r = chiedi("dominio", [impegno("t1", "Intestazione del dominio", null)], []);
    expect(r.frase).toContain("non ha una scadenza");
  });

  it("più d'uno: li elenca tutti con la loro data", () => {
    const r = chiedi("f24", [impegno("t1", "F24 giugno", -2), impegno("t2", "F24 settembre", 9)], []);
    expect(r.righe).toHaveLength(2);
  });

  it("senza soggetto chiede che cosa", () => {
    expect(chiedi(null, [], []).stato).toBe("chiarimento");
  });

  it("non letto da tutt'e due resta non letto", () => {
    expect(chiedi("f24", NON_LETTO, NON_LETTO).stato).toBe("non_lo_so");
  });
});

// =====================================================================
describe("una domanda che non è fra le nove", () => {
  it("🔴 NON viene ricondotta alla più vicina: si dichiara e si elencano le nove", () => {
    // ⚠️ È il difetto del 06/09 — la spesa spicciola diventata lista della
    //    spesa — spostato dai comandi alle domande. Qui ricondurre non
    //    produrrebbe un appunto da buttare: produrrebbe una risposta falsa.
    const r = componiRisposta({ chiede: null, soggetto: "carbonara" }, {});
    expect(r.stato).toBe("non_so_farlo");
    expect(r.righe).toHaveLength(Object.keys(DOMANDE_CHE_SO).length);
  });

  it("e un `chiede` inventato non entra da un'altra porta", () => {
    expect(componiRisposta({ chiede: "quanto_costa", soggetto: "carbonara" }, {}).stato).toBe(
      "non_so_farlo",
    );
  });

  it("🔴 l'elenco delle nove NON si taglia, a differenza di tutti gli altri", () => {
    // ⚠️ È l'unica eccezione al taglio, e ha la sua ragione: le altre
    //    risposte elencano DATI, e il resto si va a leggere nella sua
    //    schermata. Queste sono *cosa MEMO sa fare*: mostrarne sei su nove
    //    nasconderebbe tre cose senza nessun posto dove trovarle.
    const r = componiRisposta({ chiede: null }, {});
    expect(r.righe.length).toBeGreaterThan(RIGHE_MOSTRATE);
    expect(r.troppe).toBe(0);
  });

  it("🔴 se il modello ha capito l'AREA, la via d'uscita c'è", () => {
    // ⚠️ Trovato dalla revisione: senza collegamento il riquadro è un vicolo
    //    cieco. «Quanto mi costa la carbonara» è una domanda di Ricettario
    //    che MEMO non sa fare, e lì mandare al Ricettario serve.
    const conArea = componiRisposta({ chiede: null, area: "ricettario" }, {});
    expect(conArea.a).toBe("/ricettario/ricette");

    // ⚠️ E la metà che discrimina: senza area non si inventa una
    //    destinazione, che manderebbe a cercare in una schermata a caso.
    expect(componiRisposta({ chiede: null }, {}).a).toBeNull();
  });
});

describe("i pezzi minuti", () => {
  it("le parole del tempo hanno un verso", () => {
    expect(quandoInParole(0)).toBe("oggi");
    expect(quandoInParole(1)).toBe("domani");
    expect(quandoInParole(-1)).toBe("ieri");
    expect(quandoInParole(5)).toBe("fra 5 giorni");
    expect(quandoInParole(-5)).toBe("5 giorni fa");
    expect(quandoInParole(null)).toBeNull();
  });

  it("`combacia` non risponde sì a una domanda vuota", () => {
    // ⚠️ Senza questa riga un soggetto vuoto combacerebbe con TUTTO, e
    //    «quanto ne ho?» elencherebbe l'intero magazzino.
    expect(combacia("Olio extravergine", "")).toBe(false);
    expect(combacia("Olio extravergine", null)).toBe(false);
    expect(combacia("Olio extravergine", "olio")).toBe(true);
  });

  it("`fraICandidati` sceglie per identificativo, e senza scelta non sceglie", () => {
    const due = [{ id: "a", n: "Olio" }, { id: "b", n: "Olio di semi" }];
    expect(fraICandidati(due, "b", "id")).toEqual([due[1]]);
    expect(fraICandidati(due, null, "id")).toHaveLength(2);
    // ⚠️ Un identificativo che non trova niente torna a far chiedere quale,
    //    invece di svuotare la risposta.
    expect(fraICandidati(due, "sparito", "id")).toHaveLength(2);
  });

  it("il titolo dice la domanda e, se c'è, di che cosa", () => {
    expect(titoloDellaDomanda({ chiede: "quanto_ho", soggetto: "olio" })).toContain("«olio»");
    expect(titoloDellaDomanda({ chiede: "cosa_manca" })).toBe("Cosa mi manca?");
    expect(titoloDellaDomanda({ chiede: null })).toContain("domanda");
  });
});

describe("ogni risposta si può andare a controllare", () => {
  it("🔴 tutte e nove portano da qualche parte, comprese quelle che non sanno", () => {
    // ⚠️ È la condizione del mandato, e vale anche sui casi storti: un
    //    «non lo so» senza gesto d'uscita è un vicolo cieco.
    const casi = [
      [{ chiede: "ricetta_esiste", soggetto: "x" }, { ricette: [] }],
      [{ chiede: "ricetta_esiste", soggetto: "x" }, { ricette: NON_LETTO }],
      [{ chiede: "allergeni", soggetto: "x" }, { ricette: [] }],
      [{ chiede: "piatti_in_carta" }, { ricette: [] }],
      [{ chiede: "quanto_ho", soggetto: "x" }, { giacenze: [] }],
      [{ chiede: "quanto_ho", soggetto: "x" }, { giacenze: NON_LETTO }],
      [{ chiede: "cosa_manca" }, { giacenze: [] }],
      [{ chiede: "cosa_scade" }, { partite: [] }],
      [{ chiede: "agenda_oggi" }, { impegni: [] }],
      [{ chiede: "agenda_in_ritardo" }, { impegni: [] }],
      [{ chiede: "quando_scade", soggetto: "x" }, { impegni: [] }],
    ];
    for (const [domanda, letture] of casi) {
      const r = componiRisposta(domanda, letture);
      expect(r.a, `${domanda.chiede} non porta da nessuna parte`).toBeTruthy();
      expect(r.apri, `${domanda.chiede} non dice dove porta`).toBeTruthy();
    }
  });
});

// =====================================================================
// I DUE DIFETTI TROVATI GUARDANDO IL COLLAUDO COL MODELLO VERO
// =====================================================================
describe("🔴 il titolo dice la domanda che è stata fatta", () => {
  it("non nomina un piatto che nessuno ha detto", () => {
    // 🔴 La prima stesura componeva il titolo dall'ESEMPIO col soggetto
    //    appiccicato: «ho la ricetta della caponata?» diventava a schermo
    //    «Ho la ricetta della carbonara — «caponata»». Cioè il riquadro
    //    nominava la carbonara. L'ha visto un occhio, non una prova.
    const t = titoloDellaDomanda({ chiede: "ricetta_esiste", soggetto: "caponata" });
    expect(t).toContain("caponata");
    expect(t).not.toContain("carbonara");

    const q = titoloDellaDomanda({ chiede: "quanto_ho", soggetto: "astice" });
    expect(q).toContain("astice");
    expect(q).not.toContain("olio");
  });

  it("nessun titolo si porta dietro il segnaposto", () => {
    for (const chiede of Object.keys(DOMANDE_CHE_SO)) {
      expect(titoloDellaDomanda({ chiede, soggetto: "x" }), chiede).not.toContain("{x}");
      expect(titoloDellaDomanda({ chiede }), chiede).not.toContain("{x}");
    }
  });
});

describe("🔴 un elenco lungo si taglia, E LO DICHIARA", () => {
  const molte = (n) =>
    Array.from({ length: n }, (_, i) => ({
      lotto_id: `l${i}`,
      ingrediente: `Roba ${i}`,
      quantita: 1,
      unita: "kg",
      scadenza: "2026-09-10",
      giorni_mancanti: 2,
      da_segnalare: true,
    }));

  it("mostra sei righe e dice quante ne restano", () => {
    // 🔴 Misurato col modello vero sul progetto di prova: «cosa scade?»
    //    rispondeva con 68 righe. Non è una risposta, è lo scadenziario
    //    ricopiato in un riquadro.
    const r = componiRisposta({ chiede: "cosa_scade" }, { partite: molte(68) });
    expect(r.righe).toHaveLength(RIGHE_MOSTRATE);
    expect(r.troppe).toBe(68 - RIGHE_MOSTRATE);
    // ⚠️ E il numero nella frase resta quello VERO: un taglio dichiarato
    //    non è un conteggio abbassato.
    expect(r.frase).toContain("68");
  });

  it("🔴 anche i CANDIDATI si tagliano: quindici pulsanti non sono una domanda", () => {
    // Trovato dalla revisione del diff: su un magazzino vero «quanto pomodoro
    // ho?» può trovarne quindici, e su un telefono tenuto in una mano sola
    // quello non è un elenco fra cui scegliere.
    const molti = Array.from({ length: 15 }, (_, i) => ({
      ingredient_id: `i${i}`,
      ingredient_name: `Pomodoro ${i}`,
      unit: "kg",
      current_quantity: 1,
    }));
    const r = componiRisposta({ chiede: "quanto_ho", soggetto: "pomodoro" }, { giacenze: molti });
    expect(r.stato).toBe("scegli");
    expect(r.candidati).toHaveLength(RIGHE_MOSTRATE);
    expect(r.troppe).toBe(15 - RIGHE_MOSTRATE);
    // ⚠️ E la frase continua a dire il numero vero.
    expect(r.frase).toContain("15");
  });

  it("sotto la soglia non taglia niente e non dichiara niente", () => {
    // La metà che discrimina: un «e altre 0» comparirebbe sempre.
    const r = componiRisposta({ chiede: "cosa_scade" }, { partite: molte(3) });
    expect(r.righe).toHaveLength(3);
    expect(r.troppe).toBe(0);
  });
});
