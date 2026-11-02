import { describe, expect, it } from "vitest";
import {
  centesimiItaliani,
  controllaSaldi,
  dataItaliana,
  eCsvCredem,
  euroScritti,
  formatoDi,
  leggiCsvCredem,
  movimentiCsvDaCaricare,
  sovrapposizioni,
} from "../../src/lib/calcoli/csvBanca";

// IL CSV DELLA BANCA (31/10/2026). Credem, da home banking, «Elenco
// movimenti di conto».
//
// ⚠️ Il file qui sotto è INVENTATO: il repository è pubblico e il file vero
// porta nomi e importi del locale. Ricalca la forma misurata sul file vero:
// UTF-8 col BOM, righe CRLF, separatore «;», descrizione fra virgolette con
// «;» e spazi multipli dentro, importi all'italiana col segno.

const TESTA = "Data contabile;Data valuta;Descrizione;Causale Abi;Causale Int;Importo;Note";

function csv(righe, { bom = true } = {}) {
  return (bom ? "﻿" : "") + [TESTA, ...righe].join("\r\n") + "\r\n";
}

const R_BONIFICO =
  '20/10/2026;20/10/2026;"BONIFICO A VOSTRO FAVORE   rif. banca: 1234567; Ordinante: MARIO ROSSI; ulteriori descrizioni: PRESTITO   causale interna: 48";48;48;5.000,00;';
const R_PAGAMENTO =
  '21/10/2026;20/10/2026;"PAGAMENTO FORNITORE rif. banca: 7654321; beneficiario: IT60X0542811101000000123456";26;26;-1.220,00;fattura 12';
const R_COMMISSIONE = "22/10/2026;22/10/2026;COMMISSIONI;66;66;-1,00;";

describe("riconoscere il CSV", () => {
  it("riconosce l'intestazione di Credem, col BOM o senza", () => {
    expect(eCsvCredem(csv([R_COMMISSIONE]))).toBe(true);
    expect(eCsvCredem(csv([R_COMMISSIONE], { bom: false }))).toBe(true);
  });

  it("non scambia un CBI o un testo qualsiasi per il CSV", () => {
    expect(eCsvCredem(" RH03032AB123")).toBe(false);
    expect(eCsvCredem("Data;Importo\r\n")).toBe(false);
    expect(eCsvCredem("")).toBe(false);
  });
});

describe("date e importi all'italiana", () => {
  it("legge gg/mm/aaaa e rifiuta le date impossibili", () => {
    expect(dataItaliana("20/10/2026")).toBe("2026-10-20");
    expect(dataItaliana("31/02/2026")).toBeNull();
    expect(dataItaliana("2026-10-20")).toBeNull();
  });

  it("legge gli importi col segno e i punti delle migliaia, in centesimi", () => {
    expect(centesimiItaliani("5.000,00")).toBe(500000);
    expect(centesimiItaliani("-1.220,00")).toBe(-122000);
    expect(centesimiItaliani("-1,00")).toBe(-100);
    expect(centesimiItaliani("1234,56")).toBe(123456);
  });

  it("rifiuta un importo che non si legge con certezza", () => {
    expect(centesimiItaliani("1.22,00")).toBeNull();
    expect(centesimiItaliani("12,5")).toBeNull();
    expect(centesimiItaliani("1220.00")).toBeNull();
    expect(centesimiItaliani("")).toBeNull();
  });

  it("i saldi scritti a mano si accettano nelle forme comuni", () => {
    expect(euroScritti("1.234,56")).toBe(123456);
    expect(euroScritti("1234,56")).toBe(123456);
    expect(euroScritti("1234.56")).toBe(123456);
    expect(euroScritti("1234")).toBe(123400);
    expect(euroScritti("-50,5")).toBe(-5050);
    expect(euroScritti(" 3.000 ")).toBe(300000);
    expect(euroScritti("")).toBeNull();
    expect(euroScritti("tremila")).toBeNull();
  });
});

describe("leggere il file", () => {
  it("legge ogni movimento, con le virgolette e i «;» dentro la descrizione", () => {
    const { movimenti, errori } = leggiCsvCredem(csv([R_BONIFICO, R_PAGAMENTO, R_COMMISSIONE]));
    expect(errori).toEqual([]);
    expect(movimenti).toHaveLength(3);

    const [b, p, c] = movimenti;
    expect(b).toMatchObject({
      dataContabile: "2026-10-20",
      dataValuta: "2026-10-20",
      centesimi: 500000,
      causaleAbi: "48",
      causaleInterna: "48",
      riferimentoBanca: "1234567",
    });
    // Gli spazi multipli si stringono, il testo resta intero.
    expect(b.descrizione).toBe(
      "BONIFICO A VOSTRO FAVORE rif. banca: 1234567; Ordinante: MARIO ROSSI; ulteriori descrizioni: PRESTITO causale interna: 48",
    );
    expect(p).toMatchObject({ dataContabile: "2026-10-21", dataValuta: "2026-10-20", centesimi: -122000 });
    expect(p.ibanControparte).toBe("IT60X0542811101000000123456");
    expect(p.dettagli).toEqual(["fattura 12"]);
    expect(c).toMatchObject({ centesimi: -100, riferimentoBanca: null, dettagli: [] });
  });

  it("le virgolette doppie dentro un campo si leggono come una sola", () => {
    const { movimenti, errori } = leggiCsvCredem(
      csv(['22/10/2026;22/10/2026;"PAGAMENTO ""POS"" BAR";43;43;-3,50;']),
    );
    expect(errori).toEqual([]);
    expect(movimenti[0].descrizione).toBe('PAGAMENTO "POS" BAR');
  });

  it("un file con l'intestazione e nessun movimento non carica niente, e lo dice", () => {
    const { movimenti, errori } = leggiCsvCredem(csv([]));
    expect(movimenti).toEqual([]);
    expect(errori.join(" ")).toMatch(/nessun movimento/i);
  });

  it("si ferma e raccoglie TUTTI gli errori, non solo il primo", () => {
    const { errori } = leggiCsvCredem(
      csv([
        "31/02/2026;20/10/2026;X;48;48;5,00;",
        "20/10/2026;20/10/2026;Y;48;48;cinque;",
        "20/10/2026;20/10/2026;Z;48;48;0,00;",
        "20/10/2026;20/10/2026;W;48;48",
      ]),
    );
    expect(errori).toHaveLength(4);
    expect(errori[0]).toMatch(/Riga 2/);
    expect(errori[1]).toMatch(/Riga 3/);
    expect(errori[2]).toMatch(/zero/);
    expect(errori[3]).toMatch(/colonne/);
  });

  it("legge anche le righe che finiscono col solo «\\r» (vecchi Mac)", () => {
    const testo = csv([R_COMMISSIONE, R_COMMISSIONE]).replace(/\r\n/g, "\r");
    const { movimenti, errori } = leggiCsvCredem(testo);
    expect(errori).toEqual([]);
    expect(movimenti).toHaveLength(2);
  });

  it("una virgoletta lasciata aperta è un file troncato, non una descrizione lunga", () => {
    const { errori } = leggiCsvCredem(csv(['20/10/2026;20/10/2026;"TRONCATO;48;48;5,00;']));
    expect(errori.join(" ")).toMatch(/virgolett/);
  });

  it("rifiuta un'intestazione diversa: le colonne potrebbero essere spostate", () => {
    const { errori } = leggiCsvCredem(
      "Data valuta;Data contabile;Descrizione;Causale Abi;Causale Int;Importo;Note\r\n20/10/2026;20/10/2026;X;48;48;5,00;\r\n",
    );
    expect(errori.join(" ")).toMatch(/intestazione/);
  });
});

describe("il controllo dei saldi scritti a mano", () => {
  const { movimenti } = leggiCsvCredem(csv([R_BONIFICO, R_PAGAMENTO, R_COMMISSIONE]));

  it("passa quando iniziale + movimenti = finale, al centesimo", () => {
    // 100,00 + 5.000,00 − 1.220,00 − 1,00 = 3.879,00
    expect(controllaSaldi(movimenti, 10000, 387900)).toEqual([]);
  });

  it("si ferma quando non tornano, e dice di quanto", () => {
    const errori = controllaSaldi(movimenti, 10000, 388000);
    expect(errori).toHaveLength(1);
    expect(errori[0]).toMatch(/3\.879,00|3879,00/);
    expect(errori[0]).toMatch(/3\.880,00|3880,00/);
  });

  it("senza i due saldi non si carica", () => {
    expect(controllaSaldi(movimenti, null, 387900)).toHaveLength(1);
    expect(controllaSaldi(movimenti, 10000, null)).toHaveLength(1);
  });
});

describe("l'impronta, per non caricare due volte", () => {
  it("è del CSV e non si confonde con quella del CBI", () => {
    const { movimenti } = leggiCsvCredem(csv([R_COMMISSIONE]));
    const [m] = movimentiCsvDaCaricare(movimenti);
    expect(m.impronta.startsWith("csv§")).toBe(true);
    expect(formatoDi(m.impronta)).toBe("csv");
    expect(formatoDi("IT60X0542811101000000123456§2026-10-20§…")).toBe("cbi");
  });

  it("due commissioni identiche lo stesso giorno sono due movimenti: la seconda prende #2", () => {
    const { movimenti } = leggiCsvCredem(csv([R_COMMISSIONE, R_COMMISSIONE]));
    const [a, b] = movimentiCsvDaCaricare(movimenti);
    expect(b.impronta).toBe(`${a.impronta}#2`);
  });

  it("lo stesso file ricaricato dà le stesse impronte", () => {
    const testo = csv([R_BONIFICO, R_PAGAMENTO, R_COMMISSIONE, R_COMMISSIONE]);
    const prima = movimentiCsvDaCaricare(leggiCsvCredem(testo).movimenti).map((m) => m.impronta);
    const dopo = movimentiCsvDaCaricare(leggiCsvCredem(testo).movimenti).map((m) => m.impronta);
    expect(dopo).toEqual(prima);
  });

  it("dà al database i campi nella sua forma, importi in euro", () => {
    const { movimenti } = leggiCsvCredem(csv([R_PAGAMENTO]));
    expect(movimentiCsvDaCaricare(movimenti)[0]).toMatchObject({
      data_contabile: "2026-10-21",
      data_valuta: "2026-10-20",
      importo: -1220,
      causale_abi: "26",
      riferimento_banca: "7654321",
      dettagli: "fattura 12",
      iban_controparte: "IT60X0542811101000000123456",
      numero_assegno: null,
    });
  });
});

describe("i doppioni fra CBI e CSV", () => {
  const { movimenti } = leggiCsvCredem(csv([R_BONIFICO, R_PAGAMENTO, R_COMMISSIONE])); // 20–22/10

  const esistente = (data, impronta, conto = "c1") => ({
    conto_id: conto,
    data_contabile: data,
    impronta,
    importo: -1,
  });

  it("si ferma se lo stesso conto ha già movimenti del CBI negli stessi giorni", () => {
    const s = sovrapposizioni(movimenti, "csv", "c1", [esistente("2026-10-21", "IT60X§2026-10-21")]);
    expect(s).toEqual({ altroFormato: "cbi", quanti: 1, dal: "2026-10-20", al: "2026-10-22" });
  });

  it("vale anche al contrario: un CBI su giorni già caricati dal CSV", () => {
    const s = sovrapposizioni(movimenti, "cbi", "c1", [esistente("2026-10-22", "csv§2026-10-22")]);
    expect(s?.altroFormato).toBe("csv");
  });

  it("guarda due giorni in più per parte: le due date contabili potrebbero non coincidere", () => {
    expect(sovrapposizioni(movimenti, "csv", "c1", [esistente("2026-10-18", "IT60X§x")])?.altroFormato).toBe("cbi");
    expect(sovrapposizioni(movimenti, "csv", "c1", [esistente("2026-10-24", "IT60X§x")])?.altroFormato).toBe("cbi");
  });

  it("non si ferma per lo stesso formato (lì bastano le impronte), né lontano dai giorni, né su un altro conto", () => {
    expect(sovrapposizioni(movimenti, "csv", "c1", [esistente("2026-10-21", "csv§x")])).toBeNull();
    expect(sovrapposizioni(movimenti, "csv", "c1", [esistente("2026-10-17", "IT60X§x")])).toBeNull();
    expect(sovrapposizioni(movimenti, "csv", "c1", [esistente("2026-10-25", "IT60X§x")])).toBeNull();
    expect(sovrapposizioni(movimenti, "csv", "c1", [esistente("2026-10-21", "IT60X§x", "c2")])).toBeNull();
  });

  it("il margine attraversa la fine del mese", () => {
    const fine = [{ ...movimenti[0], dataContabile: "2026-10-31" }];
    expect(sovrapposizioni(fine, "csv", "c1", [esistente("2026-11-02", "IT60X§x")])?.quanti).toBe(1);
  });
});
