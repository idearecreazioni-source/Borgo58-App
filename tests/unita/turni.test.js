import { describe, expect, it } from "vitest";
import { bigliettiCucina, etichettaTurno, righePerTurno } from "../../src/lib/calcoli/turni";

// I TURNI DEI PASTI — prove pure.
//
// ⚠️ IL NUMERO DEGLI ELEMENTI È SCELTO PERCHÉ DISCRIMINI (regola del
// 19/08). Le risposte sbagliate possibili qui sono due, e sono opposte:
// «raggruppo per invio» (i tre turni finiscono in un foglio solo) e «faccio
// un foglio per riga» (tre fogli per un turno di tre piatti). Ogni prova
// sotto usa numeri che rendono quelle due risposte diverse fra loro e dalla
// giusta — con un piatto per turno sarebbero indistinguibili.

const riga = (o) => ({
  id: o.id,
  order_id: o.order ?? "conto-1",
  turno: o.turno,
  sent_at: o.sent ?? "2026-08-21T20:00:00Z",
  prepared_at: o.uscito ?? null,
  order: { table_label: o.tavolo ?? "T3", note: null },
});

describe("etichettaTurno", () => {
  it("dice il turno in italiano", () => {
    expect(etichettaTurno(1)).toBe("1° turno");
    expect(etichettaTurno(3)).toBe("3° turno");
  });

  // ⚠️ Una riga scritta prima del 21/08 non ha il turno: vale uno. Senza
  // questo, ogni comanda vecchia si mostrerebbe come «0° turno».
  it("una riga senza turno è del primo", () => {
    expect(etichettaTurno(undefined)).toBe("1° turno");
    expect(etichettaTurno(null)).toBe("1° turno");
  });
});

describe("righePerTurno", () => {
  it("divide in gruppi ordinati, e non perde nessuna riga", () => {
    const righe = [
      riga({ id: "c", turno: 2 }),
      riga({ id: "a", turno: 1 }),
      riga({ id: "d", turno: 3 }),
      riga({ id: "b", turno: 1 }),
    ];
    const gruppi = righePerTurno(righe);
    expect(gruppi.map((g) => g.turno)).toEqual([1, 2, 3]);
    expect(gruppi[0].items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(gruppi.flatMap((g) => g.items)).toHaveLength(4);
  });

  it("una comanda tutta nello stesso turno fa UN gruppo solo", () => {
    // È il caso normale fino al 21/08, ed è quello su cui la schermata
    // decide di NON scrivere «1° turno»: un gruppo solo, nessuna riga di
    // stacco.
    const gruppi = righePerTurno([riga({ id: "a" }), riga({ id: "b" }), riga({ id: "c" })]);
    expect(gruppi).toHaveLength(1);
    expect(gruppi[0].turno).toBe(1);
  });
});

describe("bigliettiCucina", () => {
  it("una comanda mandata TUTTA INSIEME esce in UN foglio, coi tre turni dentro", () => {
    // 🔴 QUESTA PROVA È STATA CAPOVOLTA IL 22/08, e vale la pena dire
    // perché: il 21/08 pretendeva **tre fogli**, uno per turno. Era la
    // traduzione sbagliata di una richiesta di Alessio — lui voleva le
    // righe di separazione DENTRO la comanda, non tre pezzi di carta.
    //
    // ⚠️ E il difetto che l'aveva fatta nascere resta chiuso: prima del
    // 21/08 queste sei righe uscivano su un foglio solo **coi turni
    // invisibili**. Adesso escono su un foglio solo **coi turni separati**,
    // che è un'altra cosa — e infatti la prova guarda `turni`, non il
    // numero dei fogli.
    const righe = [
      riga({ id: "a1", turno: 1 }),
      riga({ id: "a2", turno: 1 }),
      riga({ id: "a3", turno: 1 }),
      riga({ id: "b1", turno: 2 }),
      riga({ id: "b2", turno: 2 }),
      riga({ id: "c1", turno: 3 }),
    ];
    const fogli = bigliettiCucina(righe, []);
    expect(fogli).toHaveLength(1);
    expect(fogli[0].turni.map((t) => t.turno)).toEqual([1, 2, 3]);
    expect(fogli[0].turni.map((t) => t.items.length)).toEqual([3, 2, 1]);
    expect(fogli[0].items).toHaveLength(6);
    expect(fogli[0].tipo).toBe("comanda");
  });

  it("due tavoli non finiscono mai nello stesso foglio", () => {
    const fogli = bigliettiCucina(
      [
        riga({ id: "a", turno: 1, order: "conto-1", tavolo: "T3" }),
        riga({ id: "b", turno: 1, order: "conto-2", tavolo: "T7" }),
      ],
      []
    );
    expect(fogli).toHaveLength(2);
    expect(fogli.map((f) => f.tavolo).sort()).toEqual(["T3", "T7"]);
  });

  it("un piatto aggiunto a un turno già stampato fa un foglio SUO, marcato aggiunta", () => {
    // ⚠️ Il foglio nuovo contiene SOLO il piatto nuovo: rimettere anche le
    // righe già uscite farebbe ricucinare roba già fatta. È il caso che
    // Alessio ha accettato il 21/08 — a condizione che il foglio dica a
    // quale turno appartiene.
    const righe = [
      riga({ id: "a1", turno: 2, uscito: "2026-08-21T20:30:00Z" }),
      riga({ id: "a2", turno: 2, uscito: "2026-08-21T20:30:00Z" }),
      riga({ id: "a3", turno: 2, sent: "2026-08-21T20:45:00Z" }),
    ];
    const fogli = bigliettiCucina(righe, []);
    expect(fogli).toHaveLength(2);

    const uscito = fogli.find((f) => f.stampato);
    const nuovo = fogli.find((f) => !f.stampato);
    expect(uscito.items.map((i) => i.id)).toEqual(["a1", "a2"]);
    expect(nuovo.items.map((i) => i.id)).toEqual(["a3"]);
    expect(nuovo.turno).toBe(2);
    expect(nuovo.aggiunta).toBe(true);
  });

  it("il primo foglio di un turno NON è un'aggiunta", () => {
    // La prova al contrario di quella sopra: senza, «aggiunta: true» a
    // tappeto passerebbe la prova precedente senza discriminare niente.
    const fogli = bigliettiCucina([riga({ id: "a", turno: 2 })], []);
    expect(fogli[0].aggiunta).toBe(false);
  });

  it("i biglietti del turno stanno nella stessa coda, in ordine di orario", () => {
    const fogli = bigliettiCucina(
      [riga({ id: "a", turno: 1, sent: "2026-08-21T20:00:00Z" })],
      [
        {
          id: "ch-1",
          order_id: "conto-1",
          creata_il: "2026-08-21T20:30:00Z",
          stampata_il: null,
          order: { table_label: "T3" },
        },
      ]
    );
    expect(fogli.map((f) => f.tipo)).toEqual(["comanda", "chiamata"]);
    expect(fogli[1].tavolo).toBe("T3");
    expect(fogli[1].stampato).toBe(false);
  });

  it("un biglietto già stampato risulta stampato", () => {
    const fogli = bigliettiCucina(
      [],
      [
        {
          id: "ch-1",
          order_id: "conto-1",
          creata_il: "2026-08-21T20:30:00Z",
          stampata_il: "2026-08-21T20:31:00Z",
          order: { table_label: "T3" },
        },
      ]
    );
    expect(fogli[0].stampato).toBe(true);
  });

  it("senza righe e senza biglietti non inventa fogli", () => {
    expect(bigliettiCucina([], [])).toEqual([]);
  });
});

// =====================================================================
// 🔴 UN FOGLIO PER INVIO, COI TURNI DENTRO (22/08/2026)
// =====================================================================
describe("il foglio della cucina è uno solo", () => {
  const riga2 = (o) => ({
    id: o.id,
    order_id: o.order ?? "conto-1",
    turno: o.turno,
    sent_at: o.sent ?? "2026-08-22T20:00:00Z",
    prepared_at: o.uscito ?? null,
    order: { table_label: "T3", note: null },
  });

  it("🔴 le righe già uscite si raggruppano per la STAMPA con cui sono uscite", () => {
    // ⚠️ È la firma del foglio, non l'invio: una ristampa deve riprodurre
    // esattamente la carta di prima. Qui due stampe diverse dello stesso
    // tavolo restano due fogli, anche se le righe erano partite insieme.
    const fogli = bigliettiCucina(
      [
        riga2({ id: "a", turno: 1, uscito: "2026-08-22T20:10:00Z" }),
        riga2({ id: "b", turno: 2, uscito: "2026-08-22T20:10:00Z" }),
        riga2({ id: "c", turno: 3, uscito: "2026-08-22T20:40:00Z" }),
      ],
      []
    );
    expect(fogli).toHaveLength(2);
    expect(fogli.map((f) => f.items.length).sort()).toEqual([1, 2]);
    // e il foglio con due turni li tiene separati dentro
    const doppio = fogli.find((f) => f.items.length === 2);
    expect(doppio.turni.map((t) => t.turno)).toEqual([1, 2]);
  });

  it("l'aggiunta esce da sola e porta il SUO turno, il resto sta insieme", () => {
    // Il 2° turno è già uscito; arrivano un piatto del 2° (aggiunta) e uno
    // del 3° (mai visto). Devono essere DUE fogli diversi: il primo dice
    // «2° turno · AGGIUNTA», il secondo è comanda normale.
    const fogli = bigliettiCucina(
      [
        riga2({ id: "vecchio", turno: 2, uscito: "2026-08-22T20:10:00Z" }),
        riga2({ id: "agg", turno: 2, sent: "2026-08-22T20:30:00Z" }),
        riga2({ id: "nuovo", turno: 3, sent: "2026-08-22T20:30:00Z" }),
      ],
      []
    );
    const daStampare = fogli.filter((f) => !f.stampato);
    expect(daStampare).toHaveLength(2);

    const aggiunta = daStampare.find((f) => f.aggiunta);
    const normale = daStampare.find((f) => !f.aggiunta);
    expect(aggiunta.items.map((i) => i.id)).toEqual(["agg"]);
    expect(aggiunta.turno).toBe(2);
    expect(normale.items.map((i) => i.id)).toEqual(["nuovo"]);
    // ⚠️ Solo l'aggiunta ha UN turno dichiarato: gli altri fogli ne
    // portano dentro quanti ne servono.
    expect(normale.turno).toBeNull();
  });

  it("un turno solo: un foglio, e la banda c'è lo stesso", () => {
    // ⚠️ Sulla carta il turno si scrive SEMPRE, anche quando è uno: chi
    // cucina non ha davanti la schermata dove l'ha composto.
    const fogli = bigliettiCucina([riga2({ id: "a", turno: 1 }), riga2({ id: "b", turno: 1 })], []);
    expect(fogli).toHaveLength(1);
    expect(fogli[0].turni).toHaveLength(1);
    expect(fogli[0].turni[0].turno).toBe(1);
  });
});

// =====================================================================
// ⚠️ «PER STAMPA», NON «PER INVIO» (22/08/2026)
//
// Il commento in cima a `bigliettiCucina` diceva «un foglio per invio», e
// descriveva una regola che il codice non ha: la chiave di ciò che deve
// ancora uscire è il **solo conto**. Questa prova congela il fatto vero,
// così la frase non può tornare a divergere dal comportamento.
// =====================================================================
describe("due invii mai stampati", () => {
  const r = (id, turno, sent) => ({
    id,
    order_id: "c1",
    turno,
    sent_at: sent,
    prepared_at: null,
    order: { table_label: "T3", note: null },
  });

  it("escono su UN foglio solo, coi turni separati dentro", () => {
    const fogli = bigliettiCucina(
      [r("primo", 1, "2026-08-22T20:00:00Z"), r("secondo", 2, "2026-08-22T20:25:00Z")],
      []
    );
    expect(fogli).toHaveLength(1);
    expect(fogli[0].items.map((i) => i.id)).toEqual(["primo", "secondo"]);
    expect(fogli[0].turni.map((t) => t.turno)).toEqual([1, 2]);
  });

  it("⚠️ un turno SALTATO non si rinumera: il foglio dice quello che dice la comanda", () => {
    // Caso vero, visto in collaudo: chi preme «Prossimo turno» e poi cambia
    // idea lascia un buco (1, 2, 4). Il foglio deve portare **gli stessi
    // numeri della schermata** — rinumerarli a 1, 2, 3 farebbe dire due
    // cose diverse ai due posti sullo stesso piatto.
    const fogli = bigliettiCucina(
      [r("a", 1, "2026-08-22T20:00:00Z"), r("b", 2, "2026-08-22T20:00:00Z"), r("c", 4, "2026-08-22T20:00:00Z")],
      []
    );
    expect(fogli[0].turni.map((t) => t.turno)).toEqual([1, 2, 4]);
  });
});
