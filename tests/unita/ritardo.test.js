import { describe, expect, it } from "vitest";
import {
  ARRIVO_PER_STATO,
  contoProvaArrivo,
  ritardiDellaSerata,
  ritardoPrenotazione,
  segnoDelTavolo,
  vociLegenda,
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

describe("La legenda dichiara la precedenza", () => {
  it("mette le voci nell'ordine in cui vincono, non in quello in cui le ricevi", () => {
    // ⚠️ La prova al contrario: le chiavi si passano nell'ordine sbagliato
    // apposta. Se la legenda le stampasse così come arrivano, direbbe che la
    // fascia oraria viene prima del conto aperto — cioè il contrario di
    // quello che si vede sulla pianta.
    const voci = vociLegenda(["tardi", "occupato", "selezionato"], {
      tardi: "ultimo giro",
      occupato: "sono seduti",
      selezionato: "lo stai toccando",
    });
    expect(voci.map((v) => v.chiave)).toEqual(["selezionato", "occupato", "tardi"]);
    expect(voci[0].testo).toBe("lo stai toccando");
  });

  it("mostra solo i segni che quella schermata sa fare", () => {
    // In Calendario non esiste «conto aperto»: una legenda che lo elencasse
    // prometterebbe un colore che lì non compare mai.
    const voci = vociLegenda(["presto", "pieno", "tardi", "misto", "selezionato"]);
    expect(voci.map((v) => v.chiave)).not.toContain("occupato");
    expect(voci).toHaveLength(5);
  });
});
