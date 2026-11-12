import { describe, expect, it } from "vitest";
import { contaDaDecidere, inScheda, statoDellaMail } from "../../src/lib/calcoli/posta";

// 12/11/2026 — su work la Dashboard contava 8 mail mentre la scheda
// «Da decidere» della pagina Posta era vuota: le «Niente da fare» entravano
// nel conteggio. Il numero deve essere quello della scheda.

const MAIL = [
  { stato: "da_leggere", azioni: [] },
  { stato: "da_leggere" },
  { stato: "proposta", azioni: [{ tipo: "registra_fattura", stato: "proposta" }] },
  // mista: una «nessuna» e una proposta vera → resta da decidere
  { stato: "proposta", azioni: [{ tipo: "nessuna", stato: "proposta" }, { tipo: "promemoria", stato: "proposta" }] },
  { stato: "proposta", azioni: [{ tipo: "nessuna", stato: "proposta" }] },
  { stato: "proposta", azioni: [{ tipo: "promemoria", stato: "rifiutata" }] },
  { stato: "proposta", azioni: [{ tipo: "promemoria", stato: "fatta" }] },
  { stato: "proposta", azioni: [] },
  { stato: "archiviata", azioni: [] },
  { stato: "scartata", filtrata_da: "regola-1", azioni: [] },
  { stato: "scartata", lettura_note: "Filtrata prima di MEMO, senza spesa", azioni: [] },
];

describe("contaDaDecidere", () => {
  it("conta solo le mail non lette e quelle con una proposta vera aperta", () => {
    expect(contaDaDecidere(MAIL)).toBe(4);
  });

  it("🔴 dà lo stesso numero della scheda della pagina Posta, qualunque sia lo stato del lettore", () => {
    for (const chiave of ["in_coda", "arresa", "lettore_fermo", "non_so", "letta"]) {
      const scheda = MAIL.filter((m) => inScheda(statoDellaMail(m, { chiave }), "decidere")).length;
      expect(contaDaDecidere(MAIL)).toBe(scheda);
    }
  });

  it("una lista vuota o mancante fa zero", () => {
    expect(contaDaDecidere([])).toBe(0);
    expect(contaDaDecidere(null)).toBe(0);
  });
});
