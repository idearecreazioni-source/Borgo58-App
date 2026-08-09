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
  const ordine = {
    coperti: 4,
    coperto_unit_price: null, // conto APERTO: vale il listino di adesso
    items: [
      { quantity: 2, unit_price: "10.00", voided_at: null },
      { quantity: 1, unit_price: 5, voided_at: null },
      // riga annullata con motivo: NON deve contare
      { quantity: 3, unit_price: 99, voided_at: "2026-08-09T20:00:00Z" },
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
  });
});
