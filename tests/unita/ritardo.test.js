import { describe, expect, it } from "vitest";
import {
  ARRIVO_PER_STATO,
  contoProvaArrivo,
  ritardiDellaSerata,
  ritardoPrenotazione,
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
  it("il conto aperto copre la fascia oraria", () => {
    expect(segnoDelTavolo({ contoAperto: true, fasce: ["presto"] }).colore).toBe("occupato");
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
    expect(scelto).toEqual({ colore: "selezionato", barrato: true });
    const solo = segnoDelTavolo({ fasce: [], inRitardo: true });
    expect(solo).toEqual({ colore: null, barrato: true });
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

  it("il conto aperto su un tavolo del gruppo copre la fascia di TUTTI", () => {
    const segni = segniDellaSala({
      sagome,
      gruppi,
      fatti: { t7: { contoAperto: true }, t9: { fasce: ["tardi"] } },
    });
    expect(segni.t8.colore).toBe("occupato");
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
    expect(segni.t8).toEqual({ colore: "selezionato", barrato: true });
  });
});
