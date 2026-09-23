import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  QUESITO_APERTO,
  chiusuraConAvviso,
  estremiDellAnno,
  fraseAvviso,
  fraseMesiFotografati,
  fraseRegolarizzazioneSuccessiva,
  serveConferma,
  siPuoChiudere,
  statoChiusura,
} from "../../src/lib/calcoli/chiusuraAnno";

// =====================================================================
// LA CHIUSURA DELL'ANNO — LE REGOLE — C5, 23/09/2026
// =====================================================================
// ⚠️ QUESTE PROVANO CHE LA REGOLA RISPONDE GIUSTO, non che la schermata
//    la chiami: quella è `tests/schermate/chiusura-anno.test.jsx`, e sono
//    due cose diverse — il 16/08 il menu del mezzo di pagamento delle
//    mance si vedeva, si sceglieva, e il campo non arrivava al database.

const finite = (extra = {}) => ({
  anno_finito: true,
  conti_senza_documento: 0,
  incasso_senza_documento: 0,
  mesi_fotografati: 0,
  ...extra,
});

describe("i quattro stati, e l'ordine in cui si guardano", () => {
  it("senza misure non si inventa uno stato", () => {
    // ⚠️ «Non lo so» non è «si può chiudere»: sono due cose diverse, e
    //    confonderle è la famiglia del 19/08.
    expect(statoChiusura(null)).toBe("sconosciuto");
    expect(siPuoChiudere(null)).toBe(false);
    expect(serveConferma(null)).toBe(false);
  });

  it("un anno non finito non si chiude, nemmeno se è tutto pulito", () => {
    const m = finite({ anno_finito: false });
    expect(statoChiusura(m)).toBe("anno_non_finito");
    expect(siPuoChiudere(m)).toBe(false);
  });

  it("🔴 e «non finito» viene PRIMA dell'avviso, anche con conti senza documento", () => {
    // ⚠️ È la parte che si può sbagliare senza che niente diventi rosso:
    //    chiedere una conferma per un gesto che verrà rifiutato comunque
    //    insegna a premere «sì» senza leggere.
    const m = finite({ anno_finito: false, conti_senza_documento: 3 });
    expect(statoChiusura(m)).toBe("anno_non_finito");
    expect(serveConferma(m)).toBe(false);
  });

  it("un anno già chiuso non si richiude, e nemmeno lì si chiede conferma", () => {
    const m = finite({ conti_senza_documento: 2 });
    expect(statoChiusura(m, true)).toBe("gia_chiuso");
    expect(siPuoChiudere(m, true)).toBe(false);
    expect(serveConferma(m, true)).toBe(false);
  });

  it("senza conti senza documento la chiusura è pulita e non chiede niente", () => {
    const m = finite();
    expect(statoChiusura(m)).toBe("pulita");
    expect(siPuoChiudere(m)).toBe(true);
    expect(serveConferma(m)).toBe(false);
  });

  it("🔴 con anche un solo conto senza documento serve una conferma esplicita", () => {
    const m = finite({ conti_senza_documento: 1, incasso_senza_documento: 40 });
    expect(statoChiusura(m)).toBe("con_avviso");
    expect(siPuoChiudere(m)).toBe(true);
    expect(serveConferma(m)).toBe(true);
  });

  it("e il conteggio si legge anche se arriva come testo da PostgREST", () => {
    // I numeri di PostgREST arrivano come stringhe più spesso di quanto si
    // creda: un `> 0` su "1" sarebbe vero per caso, su "0" falso per caso.
    expect(serveConferma(finite({ conti_senza_documento: "2" }))).toBe(true);
    expect(serveConferma(finite({ conti_senza_documento: "0" }))).toBe(false);
  });
});

describe("l'avviso dice quanti, quanto, e che restano dove sono", () => {
  it("non dice niente quando non c'è niente da dire", () => {
    expect(fraseAvviso(0, 0)).toBe("");
    expect(fraseAvviso(null, null)).toBe("");
  });

  it("al singolare e al plurale", () => {
    expect(fraseAvviso(1, 40)).toMatch(/^1 conto senza documento fiscale/);
    expect(fraseAvviso(3, 120)).toMatch(/^3 conti senza documento fiscale/);
  });

  it("porta l'importo", () => {
    expect(fraseAvviso(2, 1234.5)).toContain("1.234,50");
  });

  it("🔴 e dice che restano dove sono: confermare vuol dire «li ho visti», non «sistemali»", () => {
    const f = fraseAvviso(2, 10);
    expect(f).toMatch(/restano esattamente dove sono/i);
    expect(f).toMatch(/non li sposta e non li classifica/i);
  });
});

describe("🔴 L21 resta una decisione APERTA, e il codice lo dichiara", () => {
  it("la frase nomina il quesito per nome", () => {
    const f = fraseRegolarizzazioneSuccessiva(1);
    expect(QUESITO_APERTO).toBe("L21");
    expect(f).toContain("L21");
  });

  it("e dice le DUE strade possibili, senza sceglierne una", () => {
    // ⚠️ Se ne nominasse una sola, il gestionale avrebbe deciso L21
    //    scrivendolo in una frase invece che in una funzione — che è il
    //    modo più silenzioso di decidere.
    const f = fraseRegolarizzazioneSuccessiva(1);
    expect(f).toMatch(/anno in cui il cliente ha mangiato/i);
    expect(f).toMatch(/quello in cui esce il documento/i);
    expect(f).toMatch(/non l'ha ancora deciso nessuno|ancora aperto/i);
  });

  it("e dichiara che questa chiusura non l'ha deciso al posto suo", () => {
    expect(fraseRegolarizzazioneSuccessiva(2)).toMatch(/non l'ha deciso al posto suo/i);
  });

  it("compare solo dove il dubbio c'è: su una chiusura pulita, niente", () => {
    // ⚠️ Regola del 18/08: una spiegazione che c'è sempre diventa
    //    arredamento, e l'arredamento non lo legge nessuno.
    expect(fraseRegolarizzazioneSuccessiva(0)).toBe("");
  });

  it("🔴 e il quesito è ancora dichiarato aperto nel documento dei quesiti", () => {
    // Se un giorno L21 venisse chiuso, questa prova diventa rossa e
    // obbliga a rileggere la schermata invece di lasciarla dire una cosa
    // che non è più vera.
    const quesiti = readFileSync("docs/quesiti/QUESITI_CONSULENTI.md", "utf8");
    const dopo = quesiti.split("## L21 ·")[1] ?? "";
    expect(dopo, "L21 non si trova più nei quesiti").not.toBe("");
    const bloccoL21 = dopo.split("## L22")[0];
    expect(bloccoL21).toMatch(/\*\*Stato\*\*:\s*aperto/i);
  });
});

describe("una chiusura dello storico si legge dal conteggio, non da una seconda colonna", () => {
  it("zero conti senza documento = pulita", () => {
    expect(chiusuraConAvviso({ conti_senza_documento: 0 })).toBe(false);
  });

  it("più di zero = con avviso", () => {
    expect(chiusuraConAvviso({ conti_senza_documento: 4 })).toBe(true);
  });

  it("una riga che non c'è non è una chiusura pulita", () => {
    expect(chiusuraConAvviso(null)).toBe(false);
    expect(chiusuraConAvviso(undefined)).toBe(false);
  });

  it("⚠️ e nel codice NON esiste una colonna che dica la stessa cosa", () => {
    // Un riflesso che si può ricavare non si scrive affatto: due posti che
    // dicono la stessa cosa possono contraddirsi.
    const sql = readFileSync(
      "supabase/migrations/20260923000003_la_chiusura_dell_anno_fiscale.sql",
      "utf8",
    );
    const codice = sql.replace(/--[^\n]*/g, "");
    expect(codice).not.toMatch(/chiusa_con_avviso|con_avviso\s+boolean|pulita\s+boolean/i);
  });
});

describe("gli estremi dell'anno, e i mesi già fotografati", () => {
  it("il primo e l'ultimo giorno", () => {
    expect(estremiDellAnno(2026)).toEqual({ dal: "2026-01-01", al: "2026-12-31" });
    expect(estremiDellAnno("2027")).toEqual({ dal: "2027-01-01", al: "2027-12-31" });
  });

  it("la frase sui mesi non fa sembrare la chiusura un prerequisito", () => {
    expect(fraseMesiFotografati(0)).toMatch(/misurato tutto adesso/i);
    expect(fraseMesiFotografati(5)).toMatch(/5 mesi su 12/);
    expect(fraseMesiFotografati(12)).toMatch(/tutti e dodici/i);
    // ⚠️ Nessuna delle tre dice «devi chiudere i mesi prima»: un anno si
    //    chiude anche con zero mesi fotografati.
    for (const n of [0, 5, 12]) {
      expect(fraseMesiFotografati(n)).not.toMatch(/devi|prima di chiudere|obbligator/i);
    }
  });
});

describe("🔴 la migrazione non tocca i conti, e si può leggere che non li tocca", () => {
  const SQL = readFileSync(
    "supabase/migrations/20260923000003_la_chiusura_dell_anno_fiscale.sql",
    "utf8",
  );
  // Il codice, coi commenti tolti: un setaccio che cerca una forma nel
  // testo trova anche chi la nomina per spiegarla (27/08).
  const codice = SQL.replace(/--[^\n]*/g, "");

  it("nessuna scrittura su `orders`", () => {
    expect(codice).not.toMatch(/update\s+orders\s+set/i);
    expect(codice).not.toMatch(/delete\s+from\s+orders\b/i);
  });

  it("⚠️ l'unico `insert into orders` è quello della VERIFICA, dentro la sotto-transazione annullata", () => {
    const quanti = (codice.match(/insert into orders/gi) ?? []).length;
    expect(quanti, "orders viene scritta fuori dalla verifica").toBe(2);
    const verifica = codice.split("do $verifica$")[1] ?? "";
    expect((verifica.match(/insert into orders/gi) ?? []).length).toBe(2);
    expect(verifica).toContain("ZZ_ANNULLA");
    expect(verifica).toMatch(/perform pretendi_nessun_residuo\(/);
  });

  it("nessuna scrittura sui consuntivi mensili", () => {
    expect(codice).not.toMatch(/insert into consuntivi_mensili/i);
    expect(codice).not.toMatch(/update\s+consuntivi_mensili/i);
    expect(codice).not.toMatch(/delete\s+from\s+consuntivi_mensili/i);
  });

  it("niente SQL pericoloso: né drop di tabelle, né cascade, né permessi rifatti a mano", () => {
    expect(codice).not.toMatch(/drop\s+(table|view|type)\b/i);
    expect(codice).not.toMatch(/\bcascade\b/i);
    expect(codice).not.toMatch(/create\s+policy\s+(?!chiusure_annuali_titolare_all)/i);
  });

  it("🔴 il fermo sui conti senza documento è nel DATABASE, non nella schermata", () => {
    expect(codice).toMatch(/p_conferma_conti_senza_documento/);
    expect(codice).toMatch(/if m\.conti_senza_documento > 0 and not coalesce\(p_conferma/);
  });

  it("⚠️ e il portiere RIFIUTA invece di filtrare — su TUTTE E DUE le funzioni", () => {
    // Un filtro nella `where` risponderebbe un elenco vuoto a chi non deve
    // vedere, e un elenco vuoto si legge «non c'è niente» (27/08).
    //
    // 🔴 E SI CONTANO, non si cerca «almeno uno»: la prima versione di
    //    questa prova chiedeva che il portiere esistesse, e toglierlo da
    //    `misure_dell_anno` la lasciava VERDE perché quello di
    //    `chiudi_anno` bastava a farla passare. Trovato rompendo, non
    //    rileggendo.
    const portieri = (codice.match(/if not is_titolare\(\) then\s*\n\s*raise exception/g) ?? [])
      .length;
    expect(portieri, "le funzioni col portiere che rifiuta").toBe(2);
    expect(codice).not.toMatch(/where[^;]*is_titolare\(\)/i);
  });

  it("⚠️ l'importo del rifiuto passa da `euro()`, non da una maschera scritta a mano", () => {
    expect(codice).toContain("euro(m.incasso_senza_documento)");
    expect(codice).not.toMatch(/to_char\([^)]*9G999/);
  });

  it("⚠️ e l'anno si misura sulla SERATA, senza inventare un giorno fiscale nuovo", () => {
    expect(codice).toMatch(/serata_di_servizio\(now\(\)\) > make_date\(p_anno, 12, 31\)/);
    expect(codice).not.toMatch(/current_date/i);
    expect(codice).not.toMatch(/::date\s*\)\s*::date/);
  });
});
