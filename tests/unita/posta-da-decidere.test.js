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
  // 12/11/2026: l'avviso della banca nasce scartato e non è da decidere.
  { stato: "scartata", lettura_note: "Avviso della banca: va in Banca, non in MEMO. Senza spesa; la copia è fra gli avvisi della banca.", azioni: [] },
];

describe("l'avviso della banca (12/11/2026)", () => {
  it("si mostra come filtrato, con la sua nota intera, e non è da decidere", () => {
    const avviso = MAIL.at(-1);
    expect(statoDellaMail(avviso, null)).toBe("filtrata");
    expect(inScheda(statoDellaMail(avviso, null), "decidere")).toBe(false);
  });

  it("la stessa nota su una mail non scartata non la fa filtrata", () => {
    expect(statoDellaMail({ stato: "da_leggere", lettura_note: "Avviso della banca: va in Banca" }, null)).toBe("in_lettura");
  });
});

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
