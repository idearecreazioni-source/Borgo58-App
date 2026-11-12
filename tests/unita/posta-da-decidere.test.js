import { describe, expect, it } from "vitest";
import { contaDaDecidere } from "../../src/lib/calcoli/posta";

// 12/11/2026 — su work la Dashboard contava 8 mail mentre la scheda
// «Da decidere» della pagina Posta era vuota: le «Niente da fare» entravano
// nel conteggio. Il numero deve essere quello della scheda.
describe("contaDaDecidere", () => {
  it("conta le mail non ancora lette e quelle con una proposta aperta", () => {
    const mail = [
      { stato: "da_leggere", azioni: [] },
      { stato: "proposta", azioni: [{ tipo: "registra_fattura", stato: "proposta" }] },
    ];
    expect(contaDaDecidere(mail)).toBe(2);
  });

  it("non conta le mail «Niente da fare» né quelle già sistemate", () => {
    const mail = [
      { stato: "proposta", azioni: [{ tipo: "nessuna", stato: "proposta" }] },
      { stato: "proposta", azioni: [{ tipo: "promemoria", stato: "rifiutata" }] },
      { stato: "proposta", azioni: [{ tipo: "promemoria", stato: "fatta" }] },
      { stato: "proposta", azioni: [] },
    ];
    expect(contaDaDecidere(mail)).toBe(0);
  });

  it("una lista vuota o mancante fa zero", () => {
    expect(contaDaDecidere([])).toBe(0);
    expect(contaDaDecidere(null)).toBe(0);
  });
});
