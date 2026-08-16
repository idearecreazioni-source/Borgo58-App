import { describe, expect, it } from "vitest";
// Si importa il modulo PURO, non api/orders.js: quello crea il client
// Supabase e su una macchina senza .env farebbe esplodere la prova ancora
// prima di partire (Attività B del pacchetto rifiniture).
import { orderTotals } from "../../src/lib/calcoli/conto";

// orderTotals è L'UNICO calcolo del conto: schermata Sala, Bar, preconto e
// chiusura usano tutti questa funzione (CLAUDE.md §6). Se il calcolo
// cambia per sbaglio, tre schermate direbbero tre numeri diversi davanti
// al cliente. Queste prove congelano le regole.
describe("il conto: un solo calcolo per tutte le schermate", () => {
  const INVIATA = "2026-08-16T19:30:00Z";
  const ordine = {
    coperti: 4,
    coperto_unit_price: null, // conto APERTO: vale il listino di adesso
    items: [
      { quantity: 2, unit_price: "10.00", voided_at: null, sent_at: INVIATA },
      { quantity: 1, unit_price: 5, voided_at: null, sent_at: INVIATA },
      // riga annullata con motivo: NON deve contare
      { quantity: 3, unit_price: 99, voided_at: "2026-08-09T20:00:00Z", sent_at: INVIATA },
    ],
  };

  it("somma le righe vive, esclude le annullate, aggiunge i coperti", () => {
    const c = orderTotals(ordine, 5);
    expect(c.itemsTotal).toBe(25);
    expect(c.coperti).toBe(4);
    expect(c.copertoTotal).toBe(20);
    expect(c.total).toBe(45);
  });

  it("un conto chiuso conserva il prezzo del coperto di allora, non quello di oggi", () => {
    // Il coperto è passato da 4,00 a 5,00: il conto chiuso a 4,00 non cambia.
    const chiuso = { ...ordine, coperto_unit_price: 4 };
    const c = orderTotals(chiuso, 5);
    expect(c.copertoUnitPrice).toBe(4);
    expect(c.copertoTotal).toBe(16);
    expect(c.total).toBe(41);
  });

  it("senza coperti il totale è solo la somma delle righe", () => {
    const c = orderTotals({ ...ordine, coperti: 0 }, 5);
    expect(c.copertoTotal).toBe(0);
    expect(c.total).toBe(25);
  });

  it("senza ordine risponde zeri, non errori", () => {
    const c = orderTotals(null, 5);
    expect(c.total).toBe(0);
    expect(c.items).toEqual([]);
    expect(c.nonInviate).toEqual([]);
  });

  // ⚠️ Blocco 4.2 del mandato di correzione, deciso da Alessio: una riga
  // scritta e mai mandata in cucina non è un piatto servito.
  it("una riga mai mandata in cucina non entra nel conto, e viene dichiarata", () => {
    const conBozza = {
      ...ordine,
      items: [...ordine.items, { quantity: 2, unit_price: 7, voided_at: null, sent_at: null }],
    };
    const c = orderTotals(conBozza, 5);
    // Il totale è quello di prima: la bozza da 14,00 non lo tocca.
    expect(c.total).toBe(45);
    // Ma non sparisce in silenzio: chi chiude deve poterla vedere.
    expect(c.nonInviate).toHaveLength(1);
    expect(c.nonInviateTotal).toBe(14);
  });

  // ⚠️ La rete contro il difetto peggiore possibile di questa modifica: se
  // `sent_at` non arrivasse dalla query (una colonna dimenticata in una
  // select), OGNI riga risulterebbe non inviata e il conto crollerebbe ai
  // soli coperti — in silenzio, davanti al cliente.
  it("se sent_at manca del tutto, il conto NON somma le righe: il difetto è rumoroso, non muto", () => {
    const senzaColonna = {
      ...ordine,
      items: ordine.items.map(({ sent_at: _via, ...resto }) => resto),
    };
    const c = orderTotals(senzaColonna, 5);
    expect(c.itemsTotal).toBe(0);
    expect(c.nonInviate).toHaveLength(2);
  });
});
