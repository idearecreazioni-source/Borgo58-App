import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { problemiDelPiano, riepilogoDelPiano, sqlDelPiano } from "../../scripts/piano-carica-regole.mjs";

// Il caricamento del punto di partenza del piano dell'investimento
// (07/11/2026). Qui le regole: il file vero e quello finto, i controlli,
// la SQL. Che la SQL giri davvero lo prova il caricamento su Prova.

const finto = JSON.parse(readFileSync("scripts/dati/piano-finto.json", "utf8"));
const copia = (o) => structuredClone(o);
const BS = String.fromCharCode(92); // la barra rovesciata, scritta senza escape
const NUL = String.fromCharCode(0);

describe("il file finto per Prova", () => {
  it("è finto, va bene per Prova e non per work", () => {
    expect(finto.finto).toBe(true);
    expect(problemiDelPiano(finto, "prova")).toEqual([]);
    expect(problemiDelPiano(finto, "work")).toEqual(["Questo è il file finto per Prova: su work non si carica."]);
  });
  it("un file senza «finto» non va su Prova", () => {
    const vero = copia(finto);
    delete vero.finto;
    expect(problemiDelPiano(vero, "prova")[0]).toMatch(/solo dati finti/);
    expect(problemiDelPiano(vero, "work")).toEqual([]);
  });
});

describe("i controlli del file", () => {
  it("le rate che non fanno la voce si dicono, con i due numeri", () => {
    const d = copia(finto);
    d.voci[0].rate = { 0: 610 };
    expect(problemiDelPiano(d, "prova")).toEqual(["Voce 1 («Finto - forno combinato»): le rate fanno 610.00 €, la voce 1220.00 €."]);
  });
  it("gruppo, IVA, stato, dilazione, mese e nomi doppi", () => {
    const d = copia(finto);
    Object.assign(d.voci[0], { gruppo: "Z", aliquota_iva: 7, stato: "Stimato", dilazione: "", rate: { 13: 1220 } });
    d.voci[1].descrizione = "finto - FORNO combinato";
    const p = problemiDelPiano(d, "prova").join(" | ");
    expect(p).toMatch(/gruppo «Z»/);
    expect(p).toMatch(/IVA «7»/);
    expect(p).toMatch(/stato «Stimato»/);
    expect(p).toMatch(/dilazione «»/);
    expect(p).toMatch(/mese «13»/);
    expect(p).toMatch(/stesso nome/);
  });
  it("il mese dell'apertura è il primo del mese", () => {
    expect(problemiDelPiano({ ...copia(finto), mese_apertura: "2027-04-15" }, "prova")[0]).toMatch(/primo del mese/);
  });
  it("un file vuoto o senza voci non passa", () => {
    expect(problemiDelPiano(null, "work")).toHaveLength(1);
    expect(problemiDelPiano({ mese_apertura: "2027-04-01", voci: [] }, "work")).toEqual(["Il file non ha nessuna voce."]);
  });
});

describe("i testi che entrano nella SQL (revisione di sicurezza del 07/11)", () => {
  it("un nome con «$» o con la barra rovesciata non passa: chiuderebbe il blocco o diventerebbe un comando", () => {
    for (const cattivo of ["Forno $carica$; drop table piano_voci; --", `Forno ${BS}! dir`]) {
      const d = copia(finto);
      d.voci[0].descrizione = cattivo;
      expect(problemiDelPiano(d, "prova")[0]).toMatch(/non sono ammessi/);
      expect(() => sqlDelPiano(d, "prova")).toThrow(/non passa i controlli/);
    }
  });
  it("anche la nota, i caratteri di controllo e i testi troppo lunghi", () => {
    const d = copia(finto);
    d.voci[0].nota = "riga$uno";
    d.voci[1].descrizione = `a${NUL}b`;
    d.voci[2].descrizione = "x".repeat(121);
    const p = problemiDelPiano(d, "prova").join(" | ");
    expect(p).toMatch(/la nota contiene/);
    expect(p).toMatch(/caratteri di controllo/);
    expect(p).toMatch(/più lungo di 120/);
  });
  it("i numeri devono essere numeri: niente testo, e l'ordine intero", () => {
    const d = copia(finto);
    d.voci[0].importo_ivato = "1220";
    d.voci[1].ordine = 1.5;
    d.voci[2].rate = { 0: "300" };
    d.voci[3].descrizione = { nome: "x" };
    const p = problemiDelPiano(d, "prova").join(" | ");
    expect(p).toMatch(/l.importo non è un numero/);
    expect(p).toMatch(/ordine deve essere un numero intero/);
    expect(p).toMatch(/rata del mese 0/);
    expect(p).toMatch(/il nome non è un testo/);
  });
});

describe("il riepilogo", () => {
  it("conta voci, rate e totali al centesimo", () => {
    expect(riepilogoDelPiano(finto)).toEqual({
      voci: 6,
      rate: 10,
      totale: 3370.5,
      perGruppo: { A: 1220, B: 100, C: 300, D: 450.5, E: 1300 },
      perMese: { 0: 2185.5, 1: 635, 2: 25, 3: 25, 6: 500 },
    });
  });
});

describe("la SQL", () => {
  const sql = sqlDelPiano(finto, "prova");
  it("blocca le tabelle prima di guardare, e controlla la data di apertura", () => {
    expect(sql.startsWith("lock table piano_impostazioni, piano_voci, piano_rate in share row exclusive mode;")).toBe(true);
    expect(sql).toMatch(/if not found then raise exception/);
    expect(sql).toContain("mese_apertura from piano_impostazioni) <> '2027-04-01'::date");
  });
  it("si rifiuta su un piano che ha già voci", () => {
    expect(sql).toMatch(/if exists \(select 1 from piano_voci\) then\s+raise exception/);
  });
  it("raddoppia gli apostrofi: «dell'acqua» non rompe niente", () => {
    expect(sql).toContain("'Finto - allaccio dell''acqua'");
    expect(sql).not.toMatch(/dell'acqua/);
  });
  it("scrive ogni voce e ogni rata, e verifica i conti alla fine", () => {
    expect(sql.match(/insert into piano_voci/g)).toHaveLength(6);
    expect(sql.match(/insert into piano_rate/g)).toHaveLength(10);
    expect(sql).toMatch(/count\(\*\) from piano_voci\) <> 6/);
    expect(sql).toMatch(/sum\(importo\) from piano_rate\) <> 3370\.50/);
    expect(sql).toContain("'2027-04-01'::date");
  });
  it("la nota c'è dove c'è, null dove manca", () => {
    expect(sql).toContain("'Senza IVA, come l''affitto vero.'");
    expect(sql).toMatch(/'stimata', null\) returning id/);
  });
  it("non scrive SQL per un file che non passa i controlli", () => {
    expect(() => sqlDelPiano(finto, "work")).toThrow(/non passa i controlli/);
  });
});
