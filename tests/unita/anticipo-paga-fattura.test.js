import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// L'ANTICIPO PAGA LA FATTURA — 01/11/2026
// =====================================================================
// Collegando una nota «Anticipo da rimborsarmi» a una fattura fornitore, la
// fattura diventa «pagata (anticipo)» senza muovere cassa ne' banca.
//
// ⚠️ QUI NON C'E' IL DATABASE. Le prove di sotto guardano (1) la parte del
//    gestionale e (2) il TESTO della migrazione, per le proprieta' che si
//    possono leggere senza eseguirla. Il comportamento vero (importi,
//    cassa, costi, quadratura, eliminazione) lo prova il blocco di
//    verifica DENTRO la migrazione, quando gira sulla Prova.

const spie = vi.hoisted(() => ({ operazione: null, inserimenti: [] }));

vi.mock("../../src/lib/operazioni", () => ({
  eseguiOperazione: vi.fn(async (nome, parametri) => {
    spie.operazione = [nome, parametri];
    return "nuovo-id";
  }),
}));

vi.mock("../../src/lib/supabase", () => ({
  supabase: {
    from: () => ({
      insert: (riga) => {
        spie.inserimenti.push(riga);
        return { select: () => ({ single: async () => ({ data: { id: "diretto", ...riga }, error: null }) }) };
      },
    }),
  },
}));

import {
  createAnticipazione,
  parametriRegistraAnticipazione,
  payloadAnticipazione,
} from "../../src/lib/api/anticipazioni";
import {
  avvisoImportoAnticipo,
  eFatturaPagataConAnticipo,
  etichettaPagamento,
} from "../../src/lib/calcoli/fatturaAnticipo";
import { problemiVocabolari, SPECCHIATI } from "../../src/lib/calcoli/vocabolari";

const base = {
  entityId: "e1",
  importo: "1.22",
  pagataIl: "2026-10-30",
  tagId: "t1",
  fondi: "conto_personale",
  supplierInvoiceId: "f1",
  documento: " ZZ-1 ",
  nota: " dominio ",
  eInvestimento: true,
};

beforeEach(() => {
  spie.operazione = null;
  spie.inserimenti = [];
});

describe("createAnticipazione", () => {
  it("con una fattura collegata passa dal corridoio, non da un inserimento", async () => {
    const r = await createAnticipazione(base);
    expect(spie.operazione[0]).toBe("registra_anticipazione");
    expect(spie.inserimenti).toHaveLength(0);
    expect(r.id).toBe("nuovo-id");
  });

  it("senza fattura resta l'inserimento diretto (una tabella sola)", async () => {
    await createAnticipazione({ ...base, supplierInvoiceId: "" });
    expect(spie.operazione).toBeNull();
    expect(spie.inserimenti).toHaveLength(1);
    expect(spie.inserimenti[0].supplier_invoice_id).toBeNull();
  });

  it("🔴 ogni campo della nota arriva alla funzione, col suo nome", () => {
    expect(parametriRegistraAnticipazione(base)).toEqual({
      p_entity_id: "e1",
      p_importo: 1.22,
      p_pagata_il: "2026-10-30",
      p_tag_id: "t1",
      p_fondi: "conto_personale",
      p_supplier_invoice_id: "f1",
      p_documento_riferimento: "ZZ-1",
      p_e_investimento: true,
      p_nota: "dominio",
    });
  });

  it("🔴 i parametri sono costruiti dall'elenco dei campi della nota: uno in piu' li fa rossi", () => {
    // Se `payloadAnticipazione` guadagna un campo e i parametri della
    // funzione no, la nota perde quel campo solo quando c'e' una fattura.
    const campi = Object.keys(payloadAnticipazione(base));
    const parametri = Object.keys(parametriRegistraAnticipazione(base)).map((k) => k.replace(/^p_/, ""));
    expect(parametri.sort()).toEqual(campi.sort());
  });
});

describe("le parole sulla fattura", () => {
  it("una fattura pagata con l'anticipo si legge «pagata (anticipo)»", () => {
    const f = { status: "pagata", payment_method: "anticipo" };
    expect(eFatturaPagataConAnticipo(f)).toBe(true);
    expect(etichettaPagamento(f, () => "mai usata")).toBe("pagata (anticipo)");
  });

  it("le altre mantengono il nome del metodo", () => {
    const f = { status: "pagata", payment_method: "bonifico" };
    expect(eFatturaPagataConAnticipo(f)).toBe(false);
    expect(etichettaPagamento(f, (m) => m.toUpperCase())).toBe("BONIFICO");
  });

  it("null, vuoti e fatture non pagate non sono «anticipo»", () => {
    expect(eFatturaPagataConAnticipo(null)).toBe(false);
    expect(eFatturaPagataConAnticipo({})).toBe(false);
    expect(eFatturaPagataConAnticipo({ status: "da_pagare", payment_method: "anticipo" })).toBe(false);
    expect(etichettaPagamento(undefined, () => "x")).toBe("");
  });

  it("l'avviso sull'importo scatta solo se la cifra non coincide", () => {
    const f = { da_pagare: "1.22", amount: "1.22" };
    expect(avvisoImportoAnticipo("1.22", f)).toBeNull();
    expect(avvisoImportoAnticipo("", f)).toBeNull();
    expect(avvisoImportoAnticipo("1.23", f)).toMatch(/quanto resta da pagare/);
    expect(avvisoImportoAnticipo("5", null)).toBeNull();
  });

  it("il confronto e' in centesimi, non in virgola mobile", () => {
    expect(avvisoImportoAnticipo("0.3", { da_pagare: 0.1 + 0.2 })).toBeNull();
  });
});

describe("la rete dei vocabolari conosce «anticipo»", () => {
  const riga = SPECCHIATI.filter((s) => s.costante === "PAYMENT_METHODS");
  const tutti = ["assegno", "bonifico", "carta", "contante"];

  it("il database ha «anticipo» in piu' e la schermata non lo offre: non e' un problema", () => {
    const db = [
      { tabella: "supplier_invoices", colonna: "payment_method", valori: [...tutti, "anticipo"] },
      { tabella: "shopping_list_items", colonna: "payment_method", valori: tutti },
    ];
    expect(problemiVocabolari(riga, db)).toEqual([]);
  });

  it("ma su shopping_list_items un valore in piu' resterebbe un problema", () => {
    const db = [
      { tabella: "supplier_invoices", colonna: "payment_method", valori: [...tutti, "anticipo"] },
      { tabella: "shopping_list_items", colonna: "payment_method", valori: [...tutti, "anticipo"] },
    ];
    expect(problemiVocabolari(riga, db).join(" ")).toMatch(/shopping_list_items/);
  });
});

describe("la migrazione, letta come testo", () => {
  const sql = readFileSync("supabase/migrations/20261101000001_l_anticipo_paga_la_fattura.sql", "utf8");
  const corridoio = readFileSync("supabase/functions/operazioni-atomiche/index.ts", "utf8");
  const corpo = (nome) => {
    const i = sql.indexOf(`function ${nome}`);
    expect(i).toBeGreaterThan(-1);
    // Il corpo arriva fino alla funzione (o al blocco) che segue.
    const fine = sql.indexOf("create or replace function", i + 20);
    // Senza i commenti: un commento che NOMINA un'istruzione non la esegue.
    return sql.slice(i, fine === -1 ? undefined : fine).replace(/--.*$/gm, "");
  };

  it("il corridoio ammette l'operazione", () => {
    expect(corridoio).toMatch(/^\s*"registra_anticipazione",/m);
  });

  it("🔴 pagare con l'anticipo NON scrive in prima nota", () => {
    expect(corpo("registra_anticipazione(")).not.toMatch(/insert\s+into\s+cash_movements/i);
  });

  it("e' titolare-only, security definer con search_path, chiusa a anon e public", () => {
    expect(corpo("registra_anticipazione(")).toMatch(/if not is_titolare\(\)/);
    expect(sql).toMatch(/security definer\s+set search_path = public/);
    expect(sql).toMatch(/revoke all on function registra_anticipazione\([^)]*\)\s+from public, anon, authenticated/);
    expect(sql).toMatch(/grant execute on function registra_anticipazione\([^)]*\)\s+to authenticated/);
  });

  it("la fattura deve esistere, essere della stessa societa', da pagare e di importo uguale", () => {
    const c = corpo("registra_anticipazione(");
    expect(c).toMatch(/Fattura non trovata/);
    expect(c).toMatch(/entity_id is distinct from p_entity_id/);
    expect(c).toMatch(/status <> 'da_pagare'/);
    expect(c).toMatch(/da_pagare\(v_inv\)/);
  });

  it("il vincolo ammette «anticipo» e pay_supplier_invoice non e' toccata", () => {
    expect(sql).toMatch(/array\['contante', 'bonifico', 'carta', 'assegno', 'anticipo'\]/);
    expect(sql).not.toMatch(/create or replace function (public\.)?pay_supplier_invoice/i);
  });

  it("annulla_pagamento_fattura rifiuta una fattura pagata con l'anticipo", () => {
    expect(corpo("annulla_pagamento_fattura")).toMatch(/payment_method = 'anticipo'/);
  });

  it("delete_anticipazione riapre la fattura, ma solo se e' ancora «anticipo» e senza altre note", () => {
    const c = corpo("delete_anticipazione");
    expect(c).toMatch(/status = 'pagata'/);
    expect(c).toMatch(/payment_method = 'anticipo'/);
    expect(c).toMatch(/not exists \(select 1 from anticipazioni_socio/);
  });

  it("la quadratura non segnala l'anticipo e segnala i due guasti rovesciati", () => {
    const c = corpo("public.quadratura_pagamenti");
    expect(c).toMatch(/payment_method is distinct from 'anticipo'/);
    expect(c).toMatch(/anticipo_senza_nota/);
    expect(c).toMatch(/anticipo_e_uscita/);
  });

  it("🔴 il passo sui dati vecchi tocca solo fatture ancora da pagare con una nota di importo uguale", () => {
    const i = sql.indexOf("do $dati$");
    const dati = sql.slice(i, sql.indexOf("$dati$;", i + 10));
    expect(dati).toMatch(/i\.status = 'da_pagare'/);
    expect(dati).toMatch(/where x\.supplier_invoice_id = i\.id\) = 1/);
    expect(dati).toMatch(/a\.importo = da_pagare\(i\)/);
    expect(dati).not.toMatch(/cash_movements/);
  });

  it("🔴 i messaggi scrivono il denaro con euro(), non con to_char a mano", () => {
    for (const nome of ["registra_anticipazione(", "delete_anticipazione"]) {
      const c = corpo(nome);
      expect(c).toContain("euro(");
      expect(c).not.toMatch(/FM999999990/);
    }
    expect(corpo("delete_anticipazione")).toContain("euro(coalesce(v_importo, a.importo))");
  });

  it("delete_anticipazione blocca la riga fattura prima di riaprirla", () => {
    expect(corpo("delete_anticipazione")).toMatch(/from supplier_invoices where id = a.supplier_invoice_id for update/);
  });

  it("🔴 un trigger rifiuta il collegamento a una fattura da pagare se non viene dalla funzione", () => {
    const t = corpo("guardia_anticipo_su_fattura");
    expect(t).toContain("i.status = 'da_pagare'");
    expect(t).toContain("current_setting('b58.anticipo_fattura', true) is distinct from new.supplier_invoice_id::text");
    expect(corpo("registra_anticipazione(")).toContain("set_config('b58.anticipo_fattura', p_supplier_invoice_id::text, true)");
    // Senza "of colonna": la trappola del 27/08.
    expect(sql).toMatch(/before insert or update on anticipazioni_socio/);
  });

  it("la verifica, su un database vuoto, controlla la struttura e poi esce con un avviso", () => {
    expect(sql).toMatch(/Verifica sui dati saltata/);
    expect(sql).not.toMatch(/raise exception 'VERIFICA: servono/);
  });

  it("ha il blocco di verifica che si annulla e si registra da sola", () => {
    expect(sql).toMatch(/raise exception 'ZZ_ANNULLA'/);
    expect(sql).toMatch(/pretendi_nessun_residuo/);
    expect(sql).toMatch(/values \('20261101000001', 'l_anticipo_paga_la_fattura'\)/);
  });
});
