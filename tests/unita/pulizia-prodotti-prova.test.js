import { describe, expect, it } from "vitest";
import {
  MASSIMO_MARCATI,
  REGEX_MARCATI,
  RELAZIONI_AMMESSE,
  leggiEsito,
  problemaDelBersaglio,
  righeDiErrore,
  sqlDellaPulizia,
} from "../../scripts/pulizia-prodotti-prova.mjs";
import { REF_PRODUZIONE, REF_PROVA } from "../../scripts/comune.mjs";

// =====================================================================
// LA PULIZIA DEI PRODOTTI DI PROVA: COSA TOCCA E COSA NO — 26/09/2026
// =====================================================================
// ⚠️ Queste prove non si collegano a nessun database: guardano le parti
//    del comando che decidono (il bersaglio, il modo, i nomi, l'esito).
//    La transazione vera si prova solo lanciandola, a mano, sul progetto
//    di prova — ed è voluto: un comando che cancella non parte da una prova.

const nomi = (lista) => lista.filter((n) => new RegExp(REGEX_MARCATI).test(n));

describe("🔴 si rifiuta di partire fuori dal progetto di prova", () => {
  it("la produzione è respinta", () => {
    expect(problemaDelBersaglio(`postgresql://postgres.${REF_PRODUZIONE}:x@h:5432/postgres`)).toMatch(/VERO/);
  });
  it("un progetto sconosciuto è respinto", () => {
    expect(problemaDelBersaglio("postgresql://postgres.altroprogetto:x@h:5432/postgres")).toMatch(/Borgo58-Prova/);
  });
  it("una stringa vuota è respinta", () => {
    expect(problemaDelBersaglio("")).toMatch(/DB_URL_PROVA/);
  });
  it("il progetto di prova passa", () => {
    expect(problemaDelBersaglio(`postgresql://postgres.${REF_PROVA}:x@h:5432/postgres`)).toBeNull();
  });
  it("🔴 il messaggio non ripete mai la stringa di collegamento", () => {
    const url = `postgresql://postgres.${REF_PRODUZIONE}:segreto@h:5432/postgres`;
    expect(problemaDelBersaglio(url)).not.toMatch(/segreto|postgresql:/);
  });
});

describe("🔴 di norma legge soltanto", () => {
  it("senza --applica la transazione è in sola lettura e non cancella", () => {
    const sql = sqlDellaPulizia({ applica: false });
    expect(sql.startsWith("set transaction read only;")).toBe(true);
    expect(sql).toMatch(/v_applica\s+boolean := false/);
  });
  it("con --applica la transazione scrive, e i controlli dopo ci sono", () => {
    const sql = sqlDellaPulizia({ applica: true });
    expect(sql).not.toMatch(/read only/);
    expect(sql).toMatch(/v_applica\s+boolean := true/);
    expect(sql).toMatch(/restano prodotti marcati/);
    expect(sql).toMatch(/sparito un prodotto senza marchio/);
    expect(sql).toMatch(/registro delle migrazioni/);
  });
  it("le relazioni ammesse sono le due misurate, e nient'altro", () => {
    expect(RELAZIONI_AMMESSE).toEqual([
      ["stock_consumptions", "ingredient_id"],
      ["rettifiche_giacenza", "ingredient_id"],
    ]);
  });
  it("il tetto dei marcati è 1500", () => {
    expect(MASSIMO_MARCATI).toBe(1500);
    expect(sqlDellaPulizia({ applica: false })).toMatch(/v_marcati > 1500/);
  });
});

describe("🔴 riconosce solo i due nomi, e solo col marchio del giro", () => {
  it("i prodotti di un giro sì", () => {
    const marcati = [
      "TEST-AUTO prodotto fermo#1a2bxyz9",
      "TEST-AUTO prodotto fermo#1a2bxyz9 reso",
      "TEST-AUTO allineamento#k3j2ab1c farina",
    ];
    expect(nomi(marcati)).toEqual(marcati);
  });
  it("🔴 i cinque vecchi senza marchio no", () => {
    expect(
      nomi([
        "TEST-AUTO prodotto fermo",
        "TEST-AUTO prodotto fermo reso",
        "TEST-AUTO allineamento farina",
        "TEST-AUTO pizzico",
        "TEST-AUTO scarico",
      ]),
    ).toEqual([]);
  });
  it("altri prodotti di prova e prodotti veri no", () => {
    expect(
      nomi([
        "TEST-AUTO scarico#1a2bxyz9",
        "ZZZ-PROVA-voce",
        "Tonno rosso",
        "BASE-Farina",
        "Prodotto TEST-AUTO prodotto fermo#1a2bxyz9",
      ]),
    ).toEqual([]);
  });
});

describe("l'esito e gli errori dicono solo numeri", () => {
  it("l'esito si legge dalla riga della transazione", () => {
    const uscita = 'psql:x.sql:9: NOTICE:  ESITO {"modo": "sola lettura", "marcati": 3}\n';
    expect(leggiEsito(uscita)).toEqual({ modo: "sola lettura", marcati: 3 });
  });
  it("senza esito, niente esito", () => {
    expect(leggiEsito("ERROR: qualcosa")).toBeNull();
  });
  it("🔴 un errore che contiene la stringa di collegamento la nasconde", () => {
    const righe = righeDiErrore(
      'psql: error: connection to "postgresql://postgres.x:segreto@h:5432/postgres" failed: ERROR boh',
    );
    expect(righe.join(" ")).not.toMatch(/segreto/);
  });
});
