import { describe, expect, it } from "vitest";
import {
  centesimiCbi,
  dataCbi,
  improntaMovimento,
  leggiFlussoCbi,
  movimentiDaCaricare,
} from "../../src/lib/calcoli/cbi";

// IL LETTORE DEI FLUSSI CBI DELLA BANCA (24/10/2026).
//
// ⚠️ I file qui sotto sono COSTRUITI, non presi dalla banca: il repository
// è pubblico, e un flusso vero porta IBAN, nomi e importi del locale. Le
// posizioni dei campi però sono quelle misurate su tre flussi veri di
// Credem — la costruzione le ricalca carattere per carattere.

/** Una riga CBI: i pezzi messi alla posizione giusta, il resto a spazi. */
function riga(pezzi) {
  const r = Array(120).fill(" ");
  for (const [da, testo] of pezzi) {
    for (let i = 0; i < testo.length; i++) r[da - 1 + i] = testo[i];
  }
  return r.join("");
}

const imp = (euro) => {
  const [i, d] = euro.toFixed(2).split(".");
  return `${i.padStart(12, "0")},${d}`;
};

const testa = riga([[2, "RH"], [4, "03032"], [9, "AB123"], [14, "211026"], [20, "20261021000001AB123"]]);
const saldoIniziale = (euro) =>
  riga([[2, "61"], [4, "0000001"], [29, "93001"], [34, "C/C ITALIA"], [50, "10"], [52, "X"],
    [53, "03032"], [58, "12345"], [63, "000000000001"], [75, "EUR"], [78, "201026"],
    [84, "C"], [85, imp(euro)], [100, "IT"], [102, "60"]]);
const movimento = (prog, segno, euro, abi, rif, descr, valuta = "201026", contabile = "201026") =>
  riga([[2, "62"], [4, "0000001"], [11, prog], [14, valuta], [20, contabile], [26, segno],
    [27, imp(euro)], [42, abi], [44, "XX"], [62, rif], [87, descr]]);
const dettaglio = (prog, testo) => riga([[2, "63"], [4, "0000001"], [11, prog], [14, testo]]);
const saldoFinale = (euro) =>
  riga([[2, "64"], [4, "0000001"], [11, "EUR"], [14, "201026"], [20, "C"], [21, imp(euro)], [36, "C"], [37, imp(euro)]]);
const liquidita = riga([[2, "65"], [4, "0000001"]]);
const coda = (n) => riga([[2, "EF"], [4, "03032"], [83, String(n).padStart(7, "0")]]);

/** Il caso che ha qualcosa da fare: un'uscita con dettaglio, una
 *  commissione e un'entrata con l'IBAN di chi ha mandato i soldi. */
function flussoConMovimenti() {
  const corpo = [
    testa,
    saldoIniziale(1000),
    movimento("001", "D", 244, "26", "11111111", "BONIFICO A DEBITO"),
    dettaglio("001", "A FAVORE DI Fornitore di prova srl fattura nr. 12/26"),
    movimento("002", "D", 1, "16", "", "COMM. BONIFICO"),
    movimento("003", "C", 500, "48", "22222222", "BONIFICO A CREDITO"),
    dettaglio("003", "YYY00001000 MARIO ROSSI CITTA DI PROVA"),
    dettaglio("003", "YY2VIA DI PROVA 1 IT00X0000000000000000000001"),
    saldoFinale(1255),
    liquidita,
  ];
  return [...corpo, coda(corpo.length + 1)].join("\r\n") + "\r\n";
}

describe("il flusso CBI si legge per posizione", () => {
  it("un flusso che quadra non dà errori", () => {
    expect(leggiFlussoCbi(flussoConMovimenti()).errori).toEqual([]);
  });

  it("il conto e i suoi saldi", () => {
    const { conti, supporto } = leggiFlussoCbi(flussoConMovimenti());
    expect(supporto.nome).toBe("20261021000001AB123");
    expect(conti).toHaveLength(1);
    expect(conti[0].iban).toBe("IT60X0303212345000000000001");
    expect(conti[0].saldoIniziale).toEqual({ data: "2026-10-20", centesimi: 100000 });
    expect(conti[0].saldoFinale.centesimi).toBe(125500);
  });

  it("ogni movimento col suo segno, in centesimi", () => {
    const m = leggiFlussoCbi(flussoConMovimenti()).conti[0].movimenti;
    expect(m.map((x) => x.centesimi)).toEqual([-24400, -100, 50000]);
    expect(m.map((x) => x.causaleAbi)).toEqual(["26", "16", "48"]);
    expect(m[0].riferimentoBanca).toBe("11111111");
    expect(m[1].riferimentoBanca).toBeNull();
  });

  it("i dettagli restano attaccati al loro movimento, non al successivo", () => {
    const m = leggiFlussoCbi(flussoConMovimenti()).conti[0].movimenti;
    expect(m[0].dettagli).toEqual(["A FAVORE DI Fornitore di prova srl fattura nr. 12/26"]);
    expect(m[1].dettagli).toEqual([]);
    expect(m[2].dettagli).toHaveLength(2);
    expect(m[2].ibanControparte).toBe("IT00X0000000000000000000001");
  });

  it("valuta e contabile si separano quando differiscono", () => {
    // Le competenze trimestrali: contabilizzate l'8 ottobre, valuta 30 settembre.
    const corpo = [testa, saldoIniziale(10), movimento("001", "D", 7, "18", "", "COMPETENZE", "300926", "081026"), saldoFinale(3)];
    const m = leggiFlussoCbi([...corpo, coda(corpo.length + 1)].join("\n")).conti[0].movimenti[0];
    expect(m.dataValuta).toBe("2026-09-30");
    expect(m.dataContabile).toBe("2026-10-08");
  });

  it("gli spazi in coda persi per strada non rompono la lettura", () => {
    const tagliato = flussoConMovimenti().split("\r\n").map((l) => l.trimEnd()).join("\n");
    expect(leggiFlussoCbi(tagliato).errori).toEqual([]);
  });

  it("un giorno senza movimenti è un flusso valido", () => {
    const corpo = [testa, saldoIniziale(50), saldoFinale(50), liquidita];
    const r = leggiFlussoCbi([...corpo, coda(corpo.length + 1)].join("\n"));
    expect(r.errori).toEqual([]);
    expect(r.conti[0].movimenti).toEqual([]);
  });
});

// ⚠️ LE ROTTURE: un file letto a metà deve FERMARE il caricamento, mai
// sembrare intero. Ognuna di queste prove rompe una cosa diversa.
describe("un flusso incompleto si ferma, non continua zitto", () => {
  const righe = () => flussoConMovimenti().split("\r\n").filter(Boolean);

  it("una riga sparita: la coda non torna", () => {
    const r = righe();
    r.splice(3, 1); // il dettaglio del primo movimento
    expect(leggiFlussoCbi(r.join("\n")).errori.join(" ")).toMatch(/dichiara 11 righe, ne sono state lette 10/);
  });

  it("un movimento sparito: il saldo non quadra", () => {
    const r = righe();
    r.splice(4, 1); // la commissione
    const errori = leggiFlussoCbi(r.join("\n")).errori.join(" ");
    expect(errori).toMatch(/non quadra/);
  });

  it("un importo cambiato: il saldo non quadra", () => {
    const testo = flussoConMovimenti().replace(imp(244), imp(243));
    expect(leggiFlussoCbi(testo).errori.join(" ")).toMatch(/non quadra/);
  });

  it("un file troncato a metà", () => {
    const r = righe().slice(0, 5);
    const errori = leggiFlussoCbi(r.join("\n")).errori;
    expect(errori).toContain("Un conto è rimasto senza saldo finale: il file è troncato.");
    expect(errori).toContain("Manca la coda del file (EF): il file è troncato.");
  });

  it("un file che non è un CBI", () => {
    const errori = leggiFlussoCbi("Data;Descrizione;Importo\n20/10/2026;Bonifico;-10,00").errori;
    expect(errori.length).toBeGreaterThan(0);
    expect(errori.join(" ")).toMatch(/non sembra un flusso CBI/);
  });

  it("un dettaglio orfano non si attacca al movimento sbagliato", () => {
    const r = righe();
    r.splice(3, 1, dettaglio("009", "di nessuno"));
    expect(leggiFlussoCbi(r.join("\n")).errori.join(" ")).toMatch(/non appartiene al movimento/);
  });
});

describe("i pezzi", () => {
  it("le date", () => {
    expect(dataCbi("201026")).toBe("2026-10-20");
    expect(dataCbi("310226")).toBeNull(); // il 31 febbraio non esiste
    expect(dataCbi("      ")).toBeNull();
  });

  it("gli importi in centesimi", () => {
    expect(centesimiCbi("D", "000000004941,00")).toBe(-494100);
    expect(centesimiCbi("C", "000000000000,01")).toBe(1);
    expect(centesimiCbi("X", "000000000000,01")).toBeNull();
    expect(centesimiCbi("C", "4941,00")).toBeNull();
  });

  it("l'impronta distingue due movimenti diversi e riconosce lo stesso", () => {
    const m = leggiFlussoCbi(flussoConMovimenti()).conti[0].movimenti;
    const iban = "IT60X0303212345000000000001";
    const ancora = leggiFlussoCbi(flussoConMovimenti()).conti[0].movimenti;
    expect(improntaMovimento(iban, m[0])).toBe(improntaMovimento(iban, ancora[0]));
    expect(new Set(m.map((x) => improntaMovimento(iban, x))).size).toBe(3);
  });
});

describe("i movimenti da caricare", () => {
  it("due commissioni identiche sono due fatti, e restano due anche ricaricando", () => {
    const corpo = [
      testa,
      saldoIniziale(1000),
      movimento("001", "D", 1, "16", "", "COMM. BONIFICO"),
      movimento("002", "D", 1, "16", "", "COMM. BONIFICO"),
      saldoFinale(998),
      liquidita,
    ];
    const testo = [...corpo, coda(corpo.length + 1)].join("\r\n") + "\r\n";
    const { conti, errori } = leggiFlussoCbi(testo);
    expect(errori).toEqual([]);
    const una = movimentiDaCaricare(conti[0]);
    const due = movimentiDaCaricare(leggiFlussoCbi(testo).conti[0]);
    expect(una).toHaveLength(2);
    expect(una[0].impronta).not.toBe(una[1].impronta);
    expect(una[1].impronta).toBe(`${una[0].impronta}#2`);
    // la stessa lettura dà le stesse impronte: il database scarta i doppioni
    expect(due.map((m) => m.impronta)).toEqual(una.map((m) => m.impronta));
  });

  it("gli importi in euro col segno, le date ISO, i dettagli a capo", () => {
    const m = movimentiDaCaricare(leggiFlussoCbi(flussoConMovimenti()).conti[0]);
    expect(m.map((x) => x.importo)).toEqual([-244, -1, 500]);
    expect(m[0].data_contabile).toBe("2026-10-20");
    expect(m[2].dettagli.split("\n")).toHaveLength(2);
    expect(m[1].dettagli).toBeNull();
    expect(m[2].iban_controparte).toBe("IT00X0000000000000000000001");
  });
});
