import { describe, expect, it } from "vitest";
import {
  allergeniTolti,
  eUnBis,
  frasiSostituzioni,
  nomeRiga,
  puoBissare,
  supplementoRiga,
  totaleRiga,
} from "../../src/lib/calcoli/righeComanda";
import { orderTotals } from "../../src/lib/calcoli/conto";

// UNA RIGA DI COMANDA — 24/08/2026.
//
// 🔴 QUESTE PROVE NASCONO DA UN DIFETTO MISURATO, non da un'idea di
// completezza: `lineLabel` esisteva in QUATTRO copie e una sola sapeva
// riconoscere un bis, quindi il bocconcino in più arrivava in cucina col
// suo nome nudo. Adesso la regola è una, e queste prove la tengono ferma.

const piatto = (extra = {}) => ({
  id: "r1",
  quantity: 1,
  unit_price: "20.00",
  sent_at: "2026-08-24T20:00:00Z",
  recipe: { name: "Ravioli di ricotta", recipe_type: "piatto_finito", category: "primo" },
  ...extra,
});

describe("il nome di una riga", () => {
  it("una riga che punta a un finger E' un bis, e lo dice", () => {
    const riga = piatto({ recipe: { name: "Arancinetto", recipe_type: "finger", category: "antipasto" } });
    expect(eUnBis(riga)).toBe(true);
    expect(nomeRiga(riga)).toBe("bis di Arancinetto");
  });

  it("un piatto normale si chiama col suo nome", () => {
    expect(nomeRiga(piatto())).toBe("Ravioli di ricotta");
    expect(eUnBis(piatto())).toBe(false);
  });

  it("una voce libera usa il testo scritto a mano", () => {
    expect(nomeRiga({ free_text_name: "Acqua naturale" })).toBe("Acqua naturale");
  });

  it("il bis si puo' chiedere sui piatti di finger food e su nessun altro", () => {
    expect(puoBissare(piatto({ recipe: { name: "Selezione", category: "finger_food" } }))).toBe(true);
    expect(puoBissare(piatto())).toBe(false);
  });
});

describe("il supplemento di una sostituzione", () => {
  const senzaLattosio = [
    { allergene: "latte", costo_aggiuntivo: "1.00", descrizione: "burro → burro senza lattosio" },
    { allergene: "latte", costo_aggiuntivo: "0.50", descrizione: "panna (si toglie)" },
  ];

  it("somma tutte le sostituzioni di quella riga", () => {
    expect(supplementoRiga(piatto({ sostituzioni: senzaLattosio }))).toBe(1.5);
  });

  it("una riga senza sostituzioni non ne ha", () => {
    expect(supplementoRiga(piatto())).toBe(0);
  });

  // 🔴 IL NUMERO DELLE PORZIONI E' SCELTO PER DISCRIMINARE: con una sola
  // porzione «supplemento per riga» e «supplemento per porzione» darebbero
  // lo stesso risultato, e la prova non misurerebbe niente. Con due, le due
  // risposte si separano — 43,00 contro 41,50.
  it("il supplemento segue la quantita': due porzioni senza lattosio sono due sostituzioni", () => {
    expect(totaleRiga(piatto({ quantity: 2, sostituzioni: senzaLattosio }))).toBe(43);
    expect(totaleRiga(piatto({ quantity: 2 }))).toBe(40);
  });

  it("gli allergeni tolti si contano una volta sola, anche con due sostituzioni", () => {
    expect(allergeniTolti(piatto({ sostituzioni: senzaLattosio }))).toEqual(["latte"]);
  });

  it("le frasi per la cucina arrivano fotografate e in ordine", () => {
    expect(frasiSostituzioni(piatto({ sostituzioni: senzaLattosio }))).toEqual([
      "burro → burro senza lattosio",
      "panna (si toglie)",
    ]);
  });
});

describe("il totale del conto", () => {
  const conto = (items) => ({ items, coperti: 2, coperto_unit_price: "5.00" });

  it("i supplementi entrano nel totale e si vedono a parte", () => {
    const t = orderTotals(
      conto([
        piatto({
          quantity: 2,
          sostituzioni: [{ allergene: "latte", costo_aggiuntivo: "1.50", descrizione: "x" }],
        }),
      ]),
      5
    );
    expect(t.supplementi).toBe(3);
    expect(t.itemsTotal).toBe(43);
    expect(t.total).toBe(53); // 43 + 2 coperti a 5,00
  });

  // 🔴 LA PROVA CHE SORVEGLIA IL MODO IN CUI IL DIFETTO SAREBBE SILENZIOSO:
  // se la `select` smettesse di chiedere `sostituzioni`, ogni riga
  // arriverebbe senza quel campo e il conto sarebbe piu' basso del vero
  // SENZA nessun errore. Qui si misura la differenza fra le due situazioni,
  // cosi' la regola resta scritta.
  it("una riga a cui la lettura non ha portato le sostituzioni vale meno: e' la differenza da sorvegliare", () => {
    const conSost = orderTotals(
      conto([
        piatto({ sostituzioni: [{ allergene: "latte", costo_aggiuntivo: "1.50", descrizione: "x" }] }),
      ]),
      5
    );
    const senzaCampo = orderTotals(conto([piatto()]), 5);
    expect(conSost.total - senzaCampo.total).toBe(1.5);
  });

  it("una riga mai mandata in cucina non porta ne' prezzo ne' supplemento", () => {
    const t = orderTotals(
      conto([
        piatto({
          sent_at: null,
          sostituzioni: [{ allergene: "latte", costo_aggiuntivo: "1.50", descrizione: "x" }],
        }),
      ]),
      5
    );
    expect(t.itemsTotal).toBe(0);
    expect(t.supplementi).toBe(0);
    expect(t.nonInviateTotal).toBe(21.5);
  });
});
