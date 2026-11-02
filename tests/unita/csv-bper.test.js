import { describe, expect, it } from "vitest";
import {
  bancaDelCsv,
  centesimiBper,
  dataInLettere,
  eCsvBper,
  leggiCsvBper,
  movimentiCsvDaCaricare,
} from "../../src/lib/calcoli/csvBanca";

// IL CSV DI BPER (01/11/2026): l'XLS di «Lista movimenti» salvato come CSV
// da Excel.
//
// ⚠️ Il file qui sotto è INVENTATO: il repository è pubblico e il file vero
// porta nomi e importi di Alessio. Ricalca la forma misurata sul file vero:
// testata libera, intestazione, movimenti dal più recente, riga «Totale»;
// date in lettere, entrate e uscite in due colonne, decimali solo se
// servono, valuta «"-"» finché il movimento non è contabilizzato.

const TESTA = "Data operazione;Data valuta;Descrizione;Entrate;Uscite;Categoria;Stato";

const R_SOSPESO = '30 ottobre 2026;"""-""";DISTRIBUTORE ROSSI Operazione carta 0000 del 30.10.2026;;-7,8;PAGAMENTO;Da contabilizzare';
const R_CARTA = "27 ottobre 2026;23 ottobre 2026;FORNO BIANCHI   ITA Operazione carta ****0000 del 23.10.2026;;-2,4;PAGAMENTO;Contabilizzato";
const R_BONIFICO = "16 ottobre 2026;16 ottobre 2026;BONIFICO ISTANTANEO a favore di MARIO ROSSI;1000;;BONIFICO;Contabilizzato";
const R_SDD = "08 ottobre 2026;08 ottobre 2026;ADDEBITO SDD TELEFONO SPA;;-1.010;ADDEBITO SDD/RID;Contabilizzato";

function csv(righe, { totale = "1000;-1.020,2", numero = righe.length } = {}) {
  return [
    "Modena,01 novembre 2026;;;;;;",
    ";;;;;;",
    "CONTO;;;Saldo disponibile;100,00 €;;",
    "IBAN;IT00X0000000000000000000000;;Saldo finale;100,00 €;;",
    ";;;;;;",
    `Numero Movimenti: ${numero};;;;;;`,
    TESTA,
    ...righe,
    ` ; ;Totale;${totale}; ; `,
    ";;;;;;",
    "Dati Aggiornati al 01 novembre 2026;;;;;;",
  ].join("\r\n") + "\r\n";
}

const FILE = csv([R_SOSPESO, R_CARTA, R_BONIFICO, R_SDD]);

describe("riconoscere il CSV di BPER", () => {
  it("lo riconosce anche con la testata prima dell'intestazione", () => {
    expect(eCsvBper(FILE)).toBe(true);
    expect(bancaDelCsv(FILE)).toBe("bper");
  });
  it("non lo confonde con Credem né con un testo qualunque", () => {
    expect(bancaDelCsv("Data contabile;Data valuta;Descrizione;Causale Abi;Causale Int;Importo;Note\r\n")).toBe("credem");
    expect(bancaDelCsv("RH qualcosa del CBI")).toBe(null);
  });
});

describe("le date in lettere", () => {
  it("giorno, mese in lettere, anno", () => {
    expect(dataInLettere("30 ottobre 2026")).toBe("2026-10-30");
    expect(dataInLettere("01 settembre 2026")).toBe("2026-09-01");
    expect(dataInLettere("1 Gennaio 2027")).toBe("2027-01-01");
  });
  it("🔴 una data che non esiste o il trattino della valuta: null", () => {
    expect(dataInLettere("31 settembre 2026")).toBe(null);
    expect(dataInLettere('"-"')).toBe(null);
    expect(dataInLettere("30/10/2026")).toBe(null);
  });
});

describe("gli importi di BPER", () => {
  it("decimali solo se servono, punti delle migliaia", () => {
    expect(centesimiBper("-7,8")).toBe(-780);
    expect(centesimiBper("1000")).toBe(100000);
    expect(centesimiBper("-1.020,2")).toBe(-102020);
    expect(centesimiBper("2.307,00")).toBe(230700);
    expect(centesimiBper("-0,75")).toBe(-75);
  });
  it("🔴 qualunque altra forma: null, non un importo indovinato", () => {
    for (const s of ["7.8", "1,234", "€ 5", "", "12,345", "1.00"]) expect(centesimiBper(s), s).toBe(null);
  });
});

describe("leggere il file", () => {
  it("i contabilizzati, dal più recente, con entrate positive e uscite negative", () => {
    const { movimenti, errori, daContabilizzare } = leggiCsvBper(FILE);
    expect(errori).toEqual([]);
    expect(daContabilizzare).toBe(1);
    expect(movimenti.map((m) => m.centesimi)).toEqual([-240, 100000, -101000]);
    expect(movimenti[0]).toMatchObject({
      dataContabile: "2026-10-27",
      dataValuta: "2026-10-23",
      causaleInterna: "PAGAMENTO",
      descrizione: "FORNO BIANCHI ITA Operazione carta ****0000 del 23.10.2026",
    });
  });

  it("🔴 i «Da contabilizzare» restano fuori: tornerebbero con un'altra impronta", () => {
    const { movimenti } = leggiCsvBper(FILE);
    expect(movimenti.some((m) => m.descrizione.startsWith("DISTRIBUTORE"))).toBe(false);
  });

  it("i movimenti vanno nella forma del caricamento, con l'impronta del CSV", () => {
    const righe = movimentiCsvDaCaricare(leggiCsvBper(FILE).movimenti);
    expect(righe[0].impronta.startsWith("csv§")).toBe(true);
    expect(righe[1]).toMatchObject({ importo: 1000, causale_abi: null, causale_interna: "BONIFICO" });
  });

  it("🔴 il Totale che non torna ferma tutto", () => {
    const { movimenti, errori } = leggiCsvBper(csv([R_SOSPESO, R_CARTA, R_BONIFICO, R_SDD], { totale: "1000;-1.000" }));
    expect(movimenti).toEqual([]);
    expect(errori.join(" ")).toMatch(/Totale/);
  });

  it("🔴 senza la riga Totale il file è troncato", () => {
    const tronco = FILE.split("\r\n").filter((r) => !r.includes("Totale")).join("\r\n");
    expect(leggiCsvBper(tronco).errori.join(" ")).toMatch(/troncato/);
  });

  it("🔴 «Numero Movimenti» diverso dalle righe lette ferma tutto", () => {
    const { errori } = leggiCsvBper(csv([R_SOSPESO, R_CARTA, R_BONIFICO, R_SDD], { numero: 5 }));
    expect(errori.join(" ")).toMatch(/dice 5 movimenti, ma ne ho letti 4/);
  });

  it("🔴 entrata e uscita sulla stessa riga, o nessuna delle due: errore", () => {
    const doppia = "08 ottobre 2026;08 ottobre 2026;STRANO;5;-5;ALTRO;Contabilizzato";
    const vuota = "08 ottobre 2026;08 ottobre 2026;VUOTO;;;ALTRO;Contabilizzato";
    expect(leggiCsvBper(csv([doppia], { totale: "5;-5" })).errori.join(" ")).toMatch(/ne serve una sola/);
    expect(leggiCsvBper(csv([vuota], { totale: "0;0" })).errori.join(" ")).toMatch(/ne serve una sola/);
  });

  it("🔴 un'uscita senza il meno è un errore, non un'entrata", () => {
    const r = "08 ottobre 2026;08 ottobre 2026;SENZA SEGNO;;5;ALTRO;Contabilizzato";
    expect(leggiCsvBper(csv([r], { totale: "0;5" })).errori.join(" ")).toMatch(/ne serve una sola/);
  });

  it("🔴 uno stato sconosciuto ferma tutto", () => {
    const r = R_CARTA.replace("Contabilizzato", "Stornato");
    expect(leggiCsvBper(csv([r], { totale: "0;-2,4" })).errori.join(" ")).toMatch(/Stornato/);
  });

  it("senza intestazione: lo dice", () => {
    expect(leggiCsvBper("solo;testo\r\n").errori.join(" ")).toMatch(/intestazione/);
  });
});

describe("le difese aggiunte dalla revisione (01/11/2026)", () => {
  it("🔴 la Categoria cambiata dall'app della banca non cambia l'impronta", () => {
    const prima = movimentiCsvDaCaricare(leggiCsvBper(FILE).movimenti);
    const dopo = movimentiCsvDaCaricare(leggiCsvBper(FILE.replace(";-2,4;PAGAMENTO;", ";-2,4;ALIMENTARI;")).movimenti);
    expect(dopo[0].causale_interna).toBe("ALIMENTARI");
    expect(dopo.map((r) => r.impronta)).toEqual(prima.map((r) => r.impronta));
  });

  it("🔴 solo movimenti da contabilizzare: errore chiaro, niente scheda vuota", () => {
    const { movimenti, errori } = leggiCsvBper(csv([R_SOSPESO], { totale: "0;-7,8" }));
    expect(movimenti).toEqual([]);
    expect(errori.join(" ")).toMatch(/solo movimenti ancora «da contabilizzare»/);
  });

  it("🔴 senza «Numero Movimenti» ci si ferma", () => {
    const senza = FILE.split("\r\n").filter((r) => !r.startsWith("Numero Movimenti")).join("\r\n");
    expect(leggiCsvBper(senza).errori.join(" ")).toMatch(/Numero Movimenti/);
  });
});
