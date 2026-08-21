import { describe, expect, it } from "vitest";
import {
  ARRIVO_PER_STATO,
  contoProvaArrivo,
  fascePerIlTavolo,
  ritardiDellaSerata,
  ritardoPrenotazione,
  insiemiPerTavolo,
  segniDellaSala,
  segnoDelTavolo,
} from "../../src/lib/calcoli/ritardo";
import { istanteDellaSerata, serataDiServizio } from "../../src/lib/calcoli/serata";

// IL RITARDO — provato con le coppie che misurano una DIFFERENZA.
//
// ⚠️ Ogni prova qui dentro ha la sua gemella al contrario, perché nessuna da
// sola discrimina: una funzione che rispondesse sempre «no» passerebbe metà
// di questo file, e una che rispondesse sempre «sì» passerebbe l'altra metà.
// Il modo in cui sono state trovate è quello del 18/08: non rileggendo il
// codice appena scritto, ma chiedendosi *come farlo fallire*.

const FINE_SERATA = "05:00";
const SERATA = "2026-08-18";
const alle = (g, h, m) => new Date(2026, 7, g, h, m);

describe("Quando un tavolo è in ritardo", () => {
  const conto = (arrivata) => ({
    istante: istanteDellaSerata(SERATA, "20:00", FINE_SERATA),
    minutiTolleranza: 30,
    arrivata,
  });

  it("al minuto esatto della tolleranza NON è ancora in ritardo", () => {
    expect(ritardoPrenotazione({ ...conto(false), adesso: alle(18, 20, 30) }).inRitardo).toBe(false);
  });

  it("il minuto dopo sì — ed è la gemella della prova qui sopra", () => {
    const esito = ritardoPrenotazione({ ...conto(false), adesso: alle(18, 20, 31) });
    expect(esito.inRitardo).toBe(true);
    expect(esito.minuti).toBe(31);
  });

  it("prima dell'ora prenotata i minuti sono negativi e non è in ritardo", () => {
    const esito = ritardoPrenotazione({ ...conto(false), adesso: alle(18, 19, 40) });
    expect(esito.minuti).toBe(-20);
    expect(esito.inRitardo).toBe(false);
  });

  it("chi è arrivato non è mai in ritardo, per quanto tardi si guardi", () => {
    expect(ritardoPrenotazione({ ...conto(true), adesso: alle(18, 23, 59) }).inRitardo).toBe(false);
  });

  it("la tolleranza è un DATO, non un numero dentro la funzione", () => {
    // ⚠️ La prova scritta al contrario, come quella dell'ora di fine serata:
    // se i 30 minuti fossero scritti dentro il calcolo, questa passerebbe
    // lo stesso cambiando solo la prima riga. Servono tutt'e due i versi.
    const adesso = alle(18, 20, 45);
    const istante = istanteDellaSerata(SERATA, "20:00", FINE_SERATA);
    expect(ritardoPrenotazione({ istante, adesso, minutiTolleranza: 30 }).inRitardo).toBe(true);
    expect(ritardoPrenotazione({ istante, adesso, minutiTolleranza: 120 }).inRitardo).toBe(false);
  });

  it("DOPO MEZZANOTTE conta i minuti veri, non la differenza fra due orologi", () => {
    // ⚠️ È la prova che vale più di tutte, perché è il punto in cui la
    // trappola della serata ricomparirebbe per la sesta volta: alle 00:15 la
    // sottrazione fra «00:15» e «22:30» dà meno ventidue ore, cioè «arriva
    // domani», e un tavolo lasciato vuoto tutta la notte non si sbarrerebbe
    // mai. Il locale chiude all'una: è un'ora che capita ogni sera.
    const esito = ritardoPrenotazione({
      istante: istanteDellaSerata(SERATA, "22:30", FINE_SERATA),
      adesso: alle(19, 0, 15),
      minutiTolleranza: 30,
      arrivata: false,
    });
    expect(esito.minuti).toBe(105);
    expect(esito.inRitardo).toBe(true);
  });

  it("e l'istante di un'ora piccola cade nel giorno dopo — andata e ritorno", () => {
    // La gemella di `serataDiServizio`: le due funzioni sono la stessa regola
    // letta nei due versi, e restano incollate solo se qualcuno lo controlla.
    const i = istanteDellaSerata(SERATA, "00:30", FINE_SERATA);
    expect(i.getDate()).toBe(19);
    expect(serataDiServizio(i, FINE_SERATA)).toBe(SERATA);
    const sera = istanteDellaSerata(SERATA, "22:30", FINE_SERATA);
    expect(sera.getDate()).toBe(18);
    expect(serataDiServizio(sera, FINE_SERATA)).toBe(SERATA);
  });
});

describe("Quale conto prova che sono arrivati", () => {
  it("un conto CHIUSO conta: chi ha cenato e pagato non torna in ritardo", () => {
    // ⚠️ È la differenza fra «esiste un conto in questa serata» e «c'è un
    // conto aperto». Con la seconda domanda ogni tavolo tornerebbe rosso
    // alla chiusura del conto — cioè ogni sera, dopo che è andato tutto bene.
    expect(contoProvaArrivo("chiuso")).toBe(true);
    expect(contoProvaArrivo("aperto")).toBe(true);
    expect(contoProvaArrivo("omaggiato")).toBe(true);
  });

  it("un conto ANNULLATO non prova niente — è il caso vero di T3", () => {
    // Misurato in produzione il 18/08: T3 aveva la prenotazione delle 20:00,
    // un conto aperto alle 21:06 e annullato alle 21:07. Lì non c'è nessuno,
    // e il tavolo si può ridare via.
    expect(contoProvaArrivo("annullato")).toBe(false);
  });

  it("uno stato che non conosciamo NON accende l'allarme, ed è una scelta", () => {
    // Fra un avviso mancato e un avviso falso, il progetto ha già deciso
    // quale costa di più. Il caso non resta scoperto: la prova sui dati veri
    // confronta questo elenco con i valori veri di `order_status`.
    expect(contoProvaArrivo("un_domani_qualcosa")).toBe(true);
    expect(Object.keys(ARRIVO_PER_STATO).sort()).toEqual([
      "annullato",
      "aperto",
      "chiuso",
      "omaggiato",
    ]);
  });

  it("su una serata intera, il conto chiuso spegne il rosso e l'annullato no", () => {
    const comune = {
      adesso: alle(18, 21, 30),
      minutiTolleranza: 30,
      serata: SERATA,
      oraFineSerata: FINE_SERATA,
      prenotazioni: [
        { reservation_id: "p1", ora: "20:00", tavoli: ["t1"] },
        { reservation_id: "p2", ora: "20:00", tavoli: ["t2"] },
        { reservation_id: "p3", ora: "20:00", tavoli: ["t3"] },
      ],
    };
    const esito = ritardiDellaSerata({
      ...comune,
      conti: [
        { reservation_id: "p1", status: "chiuso" },
        { reservation_id: "p2", status: "annullato" },
      ],
    });
    expect(esito.perPrenotazione.get("p1").inRitardo).toBe(false);
    expect(esito.perPrenotazione.get("p2").inRitardo).toBe(true);
    expect(esito.perPrenotazione.get("p3").inRitardo).toBe(true);
    // I tavoli sbarrati sono quelli delle due in ritardo, non tutti e tre.
    expect([...esito.tavoli].sort()).toEqual(["t2", "t3"]);
  });

  it("una prenotazione su più tavoli li sbarra TUTTI", () => {
    const esito = ritardiDellaSerata({
      prenotazioni: [{ reservation_id: "p1", ora: "20:00", tavoli: ["t7", "t8", "t9"] }],
      conti: [],
      adesso: alle(18, 21, 0),
      minutiTolleranza: 30,
      serata: SERATA,
      oraFineSerata: FINE_SERATA,
    });
    expect([...esito.tavoli].sort()).toEqual(["t7", "t8", "t9"]);
  });
});

describe("La precedenza dei segni sulla sala", () => {
  // 🔴 CAMBIATO IL 21/08: prima un conto aperto copriva la fascia col marrone,
  // e il marrone voleva dire «ci sono seduti adesso». Alessio: in una sala da
  // tredici tavoli quello si vede guardando la sala. Adesso il marrone dice
  // «la comanda è partita», e un conto aperto SENZA invii lascia la fascia
  // dov'era — a dire che c'è qualcuno ci pensa il pallino.
  it("un conto aperto senza invii NON copre più la fascia oraria", () => {
    const s = segnoDelTavolo({ contoAperto: true, fasce: ["presto"] });
    expect(s.colore).toBe("presto");
    expect(s.pallino).toBe("vuoto");
  });

  it("...ma la comanda INVIATA sì: quello è il marrone di adesso", () => {
    const s = segnoDelTavolo({ contoAperto: true, comandaInviata: true, fasce: ["presto"] });
    expect(s.colore).toBe("inviata");
    expect(s.pallino).toBe(null);
  });

  it("🔴 e il pallino PIENO vince sul vuoto: c'è roba da mandare", () => {
    // Il caso che costa di più: piatti segnati e mai partiti.
    expect(segnoDelTavolo({ contoAperto: true, daInviare: true }).pallino).toBe("pieno");
    // Anche quando una parte è già partita: il gesto che manca resta quello.
    expect(
      segnoDelTavolo({ contoAperto: true, comandaInviata: true, daInviare: true }).pallino
    ).toBe("pieno");
  });

  it("e il tavolo che stai toccando copre anche il conto aperto", () => {
    expect(segnoDelTavolo({ selezionato: true, contoAperto: true, fasce: ["tardi"] }).colore).toBe(
      "selezionato"
    );
  });

  it("due fasce sullo stesso tavolo fanno «misto», una sola fa la sua", () => {
    expect(segnoDelTavolo({ fasce: ["presto", "tardi"] }).colore).toBe("misto");
    expect(segnoDelTavolo({ fasce: ["tardi"] }).colore).toBe("tardi");
    expect(segnoDelTavolo({ fasce: [] }).colore).toBeNull();
  });

  it("LA SBARRATURA NON È IN GARA: si aggiunge, non sostituisce", () => {
    // ⚠️ La prova che tiene ferma la decisione. Se un giorno il ritardo
    // diventasse un colore come gli altri, questa diventerebbe rossa — e
    // sarebbe giusto, perché quel giorno il tavolo in ritardo smetterebbe di
    // dire a che ora doveva arrivare, o smetterebbe di rispondere al dito.
    const scelto = segnoDelTavolo({ selezionato: true, fasce: ["presto"], inRitardo: true });
    expect(scelto).toEqual({ colore: "selezionato", barrato: true, pallino: null });
    const solo = segnoDelTavolo({ fasce: [], inRitardo: true });
    expect(solo).toEqual({ colore: null, barrato: true, pallino: null });
  });
});

describe("Il tavolone si colora intero", () => {
  // La sala della foto di Alessio: T7·T8·T9 accostati, T3 da solo, e un
  // divano che in nessun gruppo compare perché non è un tavolo.
  const sagome = [{ id: "t7" }, { id: "t8" }, { id: "t9" }, { id: "t3" }, { id: "divano" }];
  const gruppi = [{ tavoli: ["t7", "t8", "t9"] }, { tavoli: ["t3"] }];

  it("la prenotazione agganciata a UN tavolo colora tutti quelli accostati", () => {
    // ⚠️ È la richiesta di Alessio: nella sua foto T8 era colorato e T7 e T9
    // bianchi, mentre i tre sono un tavolone solo. Stesso principio del giro
    // B — se l'unità è il gruppo per contare i coperti, lo è per il colore.
    const segni = segniDellaSala({
      sagome,
      gruppi,
      fatti: { t8: { fasce: ["pieno"] } },
    });
    expect(segni.t7.colore).toBe("pieno");
    expect(segni.t8.colore).toBe("pieno");
    expect(segni.t9.colore).toBe("pieno");
  });

  it("e NON esce dal tavolone — la gemella al contrario", () => {
    // Senza questa, una funzione che colorasse tutta la sala passerebbe
    // la prova qui sopra.
    const segni = segniDellaSala({ sagome, gruppi, fatti: { t8: { fasce: ["pieno"] } } });
    expect(segni.t3.colore).toBeNull();
    expect(segni.divano.colore).toBeNull();
  });

  it("una sagoma che in nessun gruppo compare resta un insieme di uno", () => {
    // Divani e Chef Table non sono tavoli e non entrano nel conteggio della
    // cena, ma si prenotano: senza questo ramo sparirebbero dai colori.
    const segni = segniDellaSala({ sagome, gruppi, fatti: { divano: { fasce: ["tardi"] } } });
    expect(segni.divano.colore).toBe("tardi");
    expect(segni.t7.colore).toBeNull();
  });

  it("IL CASO INCROCIATO: due fasce diverse sul tavolone fanno «misto»", () => {
    // ⚠️ Dal giro C sullo stesso tavolone possono esserci due prenotazioni in
    // due fasce (un giallo alle 19:30 su T7, un arancio alle 22:30 su T9). Il
    // gruppo non sceglie fra le due e non inventa una precedenza: le fasce si
    // uniscono, ed è la regola che valeva già per due prenotazioni sullo
    // stesso tavolo singolo.
    const segni = segniDellaSala({
      sagome,
      gruppi,
      fatti: { t7: { fasce: ["presto"] }, t9: { fasce: ["tardi"] } },
    });
    expect(segni.t7.colore).toBe("misto");
    expect(segni.t8.colore).toBe("misto");
    expect(segni.t9.colore).toBe("misto");
  });

  it("la comanda inviata su un tavolo del gruppo copre la fascia di TUTTI", () => {
    const segni = segniDellaSala({
      sagome,
      gruppi,
      fatti: { t7: { contoAperto: true, comandaInviata: true }, t9: { fasce: ["tardi"] } },
    });
    expect(segni.t8.colore).toBe("inviata");
  });

  it("🔴 e il pallino si propaga al tavolone: uno solo che aspetta li segna tutti", () => {
    // Un tavolone è UN conto: se c'è roba da mandare, riguarda tutto il gruppo.
    const segni = segniDellaSala({
      sagome,
      gruppi,
      fatti: { t7: { contoAperto: true, daInviare: true } },
    });
    expect(segni.t9.pallino).toBe("pieno");
  });

  it("la sbarratura si propaga: se uno tarda, il tavolone è tutto in gioco", () => {
    const segni = segniDellaSala({ sagome, gruppi, fatti: { t9: { inRitardo: true } } });
    expect(segni.t7.barrato).toBe(true);
    expect(segni.t8.barrato).toBe(true);
    expect(segni.t3.barrato).toBe(false);
  });

  it("LA SELEZIONE NON SI PROPAGA — è l'unica cosa esclusa, ed è voluto", () => {
    // ⚠️ Toccare un tavolo per aggiungerlo a un conto riguarda QUEL tavolo:
    // colorando tutto il gruppo, lo schermo prometterebbe di aprirne tre
    // mentre ne apre uno. La selezione risponde al dito, e il dito ne ha
    // toccato uno solo.
    const segni = segniDellaSala({
      sagome,
      gruppi,
      fatti: { t8: { selezionato: true, fasce: ["pieno"] } },
    });
    expect(segni.t8.colore).toBe("selezionato");
    expect(segni.t7.colore).toBe("pieno");
    expect(segni.t9.colore).toBe("pieno");
  });

  it("ma la sbarratura passa anche sopra il tavolo selezionato", () => {
    const segni = segniDellaSala({
      sagome,
      gruppi,
      fatti: { t8: { selezionato: true }, t9: { inRitardo: true } },
    });
    expect(segni.t8).toEqual({ colore: "selezionato", barrato: true, pallino: null });
  });
});

describe("Da un tavolo al suo tavolone", () => {
  // 🔴 Nasce da un difetto vero trovato da Alessio provando il giro D3:
  // toccando T8 (prenotato) compariva l'avviso «c'è già qualcuno», toccando
  // T7 — lo stesso tavolone — no. E il difetto era più largo del messaggio:
  // il TOCCO stesso trattava T7 da libero, cioè contraddiceva il colore, che
  // dal giro D2 si propaga a tutto il gruppo.
  const sagome = [{ id: "t7" }, { id: "t8" }, { id: "t9" }, { id: "t3" }, { id: "divano" }];
  const gruppi = [{ tavoli: ["t7", "t8", "t9"] }, { tavoli: ["t3"] }];

  it("ogni tavolo del tavolone risponde con LO STESSO insieme", () => {
    // È la proprietà che regge la cura: chiedere «chi c'è su T7» e «chi c'è su
    // T8» deve voler dire chiedere la stessa cosa.
    const per = insiemiPerTavolo(sagome, gruppi);
    expect([...per.get("t7")].sort()).toEqual(["t7", "t8", "t9"]);
    expect(per.get("t8")).toEqual(per.get("t7"));
    expect(per.get("t9")).toEqual(per.get("t7"));
  });

  it("un tavolo da solo è un insieme di uno — la gemella al contrario", () => {
    // Senza questa, una funzione che mettesse tutta la sala in un insieme
    // solo passerebbe la prova qui sopra.
    const per = insiemiPerTavolo(sagome, gruppi);
    expect(per.get("t3")).toEqual(["t3"]);
    expect(per.get("divano")).toEqual(["divano"]);
  });

  it("copre TUTTE le sagome, anche quelle che in nessun gruppo compaiono", () => {
    // Divani e Chef Table non entrano nel conteggio della cena, ma si toccano
    // e si prenotano: se cadessero fuori dalla mappa, il tocco su un divano
    // non troverebbe mai nessuno sopra.
    const per = insiemiPerTavolo(sagome, gruppi);
    expect([...per.keys()].sort()).toEqual(["divano", "t3", "t7", "t8", "t9"]);
  });

  it("è la STESSA regola che colora la sala, non una seconda", () => {
    // ⚠️ La prova che tiene ferma la cura: se un giorno i due raggruppamenti
    // si separassero, il colore e il tocco tornerebbero a dire cose diverse —
    // che è esattamente il difetto che questa funzione chiude.
    const per = insiemiPerTavolo(sagome, gruppi);
    const segni = segniDellaSala({ sagome, gruppi, fatti: { t8: { fasce: ["pieno"] } } });
    for (const id of per.get("t8")) expect(segni[id].colore).toBe("pieno");
    expect(segni.t3.colore).toBeNull();
  });
});

// 🔴 «IL TAVOLO MOSTRA LA FASCIA CHE DEVE ANCORA ARRIVARE, NON QUELLA GIÀ
// PASSATA» — regola di Alessio, 21/08, dal difetto che ha trovato col
// tablet: chiudendo il conto il tavolo tornava «prenotato» invece di
// liberarsi.
describe("la fascia che deve ancora arrivare", () => {
  const fasce = new Map([
    ["primo", "presto"],
    ["secondo", "tardi"],
  ]);

  it("senza nessuna servita, le fasce restano tutte", () => {
    expect(fascePerIlTavolo(["primo", "secondo"], fasce, new Set())).toEqual(["presto", "tardi"]);
  });

  it("🔴 il PRIMO CASO di Alessio: servito il primo giro, il tavolo torna libero", () => {
    // Con una sola prenotazione e quella servita, non resta nessuna fascia:
    // il tavolo si disegna bianco. È l'effetto che il difetto impediva.
    expect(fascePerIlTavolo(["primo"], fasce, new Set(["primo"]))).toEqual([]);
  });

  it("🔴 il SECONDO CASO: c'è un altro turno, quindi NON torna bianco", () => {
    // Perde il giallo del primo giro e resta il rosso dell'ultimo turno.
    expect(fascePerIlTavolo(["primo", "secondo"], fasce, new Set(["primo"]))).toEqual(["tardi"]);
  });

  it("...e i due casi NON sono scritti da nessuna parte: li produce la regola", () => {
    // La stessa funzione, senza rami dedicati, risponde a un terzo caso che
    // nessuno ha nominato: servite tutte e due.
    expect(fascePerIlTavolo(["primo", "secondo"], fasce, new Set(["primo", "secondo"]))).toEqual([]);
  });

  it("una prenotazione senza fascia non inventa un colore", () => {
    expect(fascePerIlTavolo(["ignota"], fasce, new Set())).toEqual([]);
  });

  it("regge senza l'elenco delle servite", () => {
    expect(fascePerIlTavolo(["primo"], fasce, undefined)).toEqual(["presto"]);
  });
});
