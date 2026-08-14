import { describe, expect, it } from "vitest";
import { leggiFoglioExcel } from "../../src/lib/foglioExcel";
import { leggiScenarioDaFoglio } from "../../src/lib/foglioProiezione";

// Il lettore del foglio Excel, provato su un file costruito qui dentro.
//
// ⚠️ PERCHÉ NON SI USA IL FOGLIO VERO. Il modello finanziario di Alessio
// non entra nel repository, che è pubblico (vincolo suo del 14/08/2026):
// quindi la prova si fabbrica un foglio con gli stessi indirizzi di cella
// e numeri inventati. Quello che qui si tiene fermo non è «i suoi conti
// tornano» — quello lo verifica il gestionale a ogni importazione,
// confrontando i totali dichiarati dal foglio — ma che **il lettore
// prenda i valori dagli indirizzi giusti**.
//
// ⚠️ E il caso che conta è il primo: le celle vuote di Excel sono scritte
// auto-chiuse (`<c r="B8"/>`), e un lettore che pretende la chiusura le
// salta assegnando al loro indirizzo il contenuto della cella successiva.
// Non è un errore che si vede: sono numeri plausibili agli indirizzi
// sbagliati. È successo davvero, alla prima stesura del modulo.

// --- un .xlsx minimo, senza compressione (metodo "stored") ---
function zip(voci) {
  const enc = new TextEncoder();
  const locali = [];
  const indice = [];
  let offset = 0;

  const crcTab = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (b) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTab[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  for (const [nome, testo] of voci) {
    const n = enc.encode(nome);
    const d = enc.encode(testo);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(8, 0, true); // stored
    h.setUint32(14, crc32(d), true);
    h.setUint32(18, d.length, true);
    h.setUint32(22, d.length, true);
    h.setUint16(26, n.length, true);
    locali.push(new Uint8Array(h.buffer), n, d);

    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(10, 0, true);
    c.setUint32(16, crc32(d), true);
    c.setUint32(20, d.length, true);
    c.setUint32(24, d.length, true);
    c.setUint16(28, n.length, true);
    c.setUint32(42, offset, true);
    indice.push(new Uint8Array(c.buffer), n);
    offset += 30 + n.length + d.length;
  }

  const corpoIndice = indice.reduce((s, a) => s + a.length, 0);
  const coda = new DataView(new ArrayBuffer(22));
  coda.setUint32(0, 0x06054b50, true);
  coda.setUint16(8, voci.length, true);
  coda.setUint16(10, voci.length, true);
  coda.setUint32(12, corpoIndice, true);
  coda.setUint32(16, offset, true);

  const pezzi = [...locali, ...indice, new Uint8Array(coda.buffer)];
  const fuori = new Uint8Array(pezzi.reduce((s, a) => s + a.length, 0));
  let p = 0;
  for (const a of pezzi) { fuori.set(a, p); p += a.length; }
  return fuori.buffer;
}

const testi = [
  "Versione di prova", "Scontrino food per coperto (€)", "Scontrino beverage per coperto",
  "Food cost (%)", "Beverage cost (%)", "Lavanderia per coperto (€)",
  "% pagamenti elettronici", "Commissione POS (%)",
  "Aliquota fiscale", "Tasso annuo", "Importo finanziamento", "Durata (anni)", "Amm. annui",
  "Resp. sala", "Extra weekend", "Affitto", "Lounge apericena",
];
const s = (t) => testi.indexOf(t);

// ⚠️ Le celle vuote sono AUTO-CHIUSE, come le scrive Excel: è il caso che
// ha fatto sbagliare indirizzo alla prima stesura del lettore.
function cella(rif, valore, tipo) {
  if (valore === null) return `<c r="${rif}"/>`;
  if (tipo === "s") return `<c r="${rif}" t="s"><v>${valore}</v></c>`;
  return `<c r="${rif}"><v>${valore}</v></c>`;
}

function foglioDiProva({ etichettaScontrino = "Scontrino food per coperto (€)" } = {}) {
  const righe = [];
  const riga = (n, celle) => righe.push(`<row r="${n}">${celle.join("")}</row>`);

  riga(4, [cella("A4", s("Versione di prova"), "s")]);
  // A = etichetta, B e C VUOTE e auto-chiuse, D = valore.
  riga(8, [cella("A8", testi.indexOf(etichettaScontrino), "s"), cella("B8", null), cella("C8", null),
           cella("D8", 40), cella("G8", s("Resp. sala"), "s")]);
  riga(9, [cella("A9", s("Scontrino beverage per coperto"), "s"), cella("D9", 10)]);
  riga(10, [cella("A10", s("Food cost (%)"), "s"), cella("D10", 0.25),
            cella("G10", s("Resp. sala"), "s"), cella("I10", 7.5), cella("J10", 60), cella("L10", 0.9)]);
  riga(11, [cella("A11", s("Beverage cost (%)"), "s"), cella("D11", 0.5)]);
  riga(12, [cella("A12", s("Lavanderia per coperto (€)"), "s"), cella("D12", 0)]);
  riga(13, [cella("A13", s("% pagamenti elettronici"), "s"), cella("D13", 0.5)]);
  riga(14, [cella("A14", s("Commissione POS (%)"), "s"), cella("D14", 0.015)]);
  riga(21, [cella("A21", s("Extra weekend"), "s"), cella("C21", 10), cella("D21", 60), cella("F21", 0.5),
            cella("I21", s("Affitto"), "s"), cella("M21", 1000)]);
  riga(33, [cella("A33", s("Lounge apericena"), "s"), cella("E33", 10), cella("F33", 25), cella("G33", 0.3)]);

  const colonne = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
  riga(41, colonne.map((c) => cella(`${c}41`, 3)));
  riga(42, colonne.map((c) => cella(`${c}42`, 10)));
  riga(43, colonne.map((c) => cella(`${c}43`, 0)));
  riga(45, colonne.map((c) => cella(`${c}45`, 0)));
  riga(46, colonne.map((c) => cella(`${c}46`, 10)));
  riga(48, colonne.map((c) => cella(`${c}48`, 0)));

  riga(107, [cella("F107", s("Aliquota fiscale"), "s"), cella("H107", 0.3)]);
  riga(108, [cella("F108", s("Tasso annuo"), "s"), cella("H108", 0.06)]);
  riga(109, [cella("F109", s("Importo finanziamento"), "s"), cella("H109", 0)]);
  riga(110, [cella("F110", s("Durata (anni)"), "s"), cella("H110", 7),
             cella("B110", 343)]);
  riga(111, [cella("F111", s("Amm. annui"), "s"), cella("H111", 1200), cella("B111", 343)]);

  return zip([
    ["xl/workbook.xml", `<workbook><sheets><sheet name="Prova" sheetId="1"/></sheets></workbook>`],
    ["xl/sharedStrings.xml", `<sst>${testi.map((t) => `<si><t>${t}</t></si>`).join("")}</sst>`],
    ["xl/worksheets/sheet1.xml", `<worksheet><sheetData>${righe.join("")}</sheetData></worksheet>`],
  ]);
}

describe("leggere il foglio della proiezione", () => {
  it("prende i valori dagli indirizzi giusti anche con le celle vuote in mezzo", async () => {
    const { nomeFoglio, celle } = await leggiFoglioExcel(foglioDiProva());
    expect(nomeFoglio).toBe("Prova");
    // Se le celle auto-chiuse venissero saltate, in B8 finirebbe il 40 di D8.
    expect(celle.get("D8")).toBe(40);
    expect(celle.has("B8")).toBe(false);
    expect(celle.has("C8")).toBe(false);
  });

  it("legge parametri, mesi e ricava le ore al giorno dalla paga", async () => {
    const { celle } = await leggiFoglioExcel(foglioDiProva());
    const scenario = leggiScenarioDaFoglio(celle);

    expect(scenario.problemi).toEqual([]);
    expect(scenario.parametri.scontrinoFood).toBe(40);
    expect(scenario.parametri.scontrinoBeverage).toBe(10);
    expect(scenario.parametri.foodCostPercento).toBe(0.25);
    // 60 al giorno / 7,5 all'ora = 8 ore: nel foglio è dentro una formula.
    expect(scenario.parametri.oreGiorno).toBe(8);
    expect(scenario.parametri.pressionePersonale).toBe(0.9);
    expect(scenario.mesi).toHaveLength(12);
    expect(scenario.mesi[0]).toMatchObject({ mese: 1, giorniLavorativi: 10, copertiFeriali: 10 });
    expect(scenario.costiFissi).toEqual([{ voce: "Affitto", euroMese: 1000 }]);
  });

  it("riconosce gli extra sugli eventi e la linea accessoria a evento", async () => {
    const { celle } = await leggiFoglioExcel(foglioDiProva());
    const scenario = leggiScenarioDaFoglio(celle);
    // «Extra weekend» non dipende dagli eventi; «Lounge» va a giornata.
    expect(scenario.extra[0]).toMatchObject({ tipo: "Extra weekend", daEventi: false });
    expect(scenario.accessorie[0]).toMatchObject({ linea: "Lounge apericena", base: "per_giorno" });
  });

  it("si ferma e dice quale riga non ha riconosciuto, invece di leggere a caso", async () => {
    // ⚠️ È la protezione che vale più di tutte: una riga in più nel foglio
    // sposterebbe gli indirizzi, e senza questo controllo entrerebbe un
    // numero plausibile al posto sbagliato — falso in modo credibile.
    const { celle } = await leggiFoglioExcel(foglioDiProva({ etichettaScontrino: "Affitto" }));
    const scenario = leggiScenarioDaFoglio(celle);

    expect(scenario.problemi.length).toBeGreaterThan(0);
    expect(scenario.problemi[0]).toContain("A8");
  });

  it("porta con sé i totali dichiarati dal foglio, per poterli confrontare", async () => {
    const { celle } = await leggiFoglioExcel(foglioDiProva());
    const scenario = leggiScenarioDaFoglio(celle);
    expect(scenario.controlli.bepSoloSala).toBe(343);
    // Quelli che il foglio di prova non ha vengono dichiarati mancanti,
    // non dati per zero.
    expect(scenario.avvisi.length).toBeGreaterThan(0);
    expect(scenario.controlli.ricaviSala).toBeUndefined();
  });
});
