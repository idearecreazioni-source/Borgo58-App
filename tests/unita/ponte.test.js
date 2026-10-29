import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eseguiLavoro, linguaDi } from "../../ponte/esegui.mjs";
import { foglioDiProva, leggiStato } from "../../ponte/protocolli/escpos.mjs";
import { documentoNonFiscale, leggiRisposta } from "../../ponte/protocolli/fpmate.mjs";
import { perXml, rigaPulita, soloAscii } from "../../ponte/protocolli/testo.mjs";
import { postHttp, scambioTcp } from "../../ponte/rete.mjs";
import { nellaReteDelLocale, perchéNonSiChiama } from "../../ponte/sicurezza.mjs";
import { avviaSimulatore } from "../../ponte/simulatore.mjs";
import { unGiro } from "../../ponte/ponte.mjs";

// Il ponte del mini-PC (28/10/2026), provato senza gestionale e senza
// apparecchi veri: contro il simulatore, che sa anche andare storto.

describe("il ponte chiama solo la rete del locale", () => {
  it("riconosce gli indirizzi del locale, come il vincolo del database", () => {
    for (const si of ["192.168.1.50", "10.0.0.7", "172.16.0.9", "172.31.255.1"]) expect(nellaReteDelLocale(si), si).toBe(true);
    for (const no of ["8.8.8.8", "172.32.0.1", "192.168.1.255", "192.168.1.0", "127.0.0.1", "169.254.1.1", "100.64.0.1", "192.168.01.5", "192.168.1.5/24", "::ffff:192.168.1.5", "stampante.local", ""]) {
      expect(nellaReteDelLocale(no), no).toBe(false);
    }
  });

  it("rifiuta porte sbagliate e l'apparecchio finto fuori posto o fuori dalle prove", () => {
    expect(perchéNonSiChiama({ protocollo: "escpos_tcp", indirizzo: "192.168.1.50", porta: 9100 })).toBeNull();
    expect(perchéNonSiChiama({ protocollo: "escpos_tcp", indirizzo: "192.168.1.50", porta: 22 })).toMatch(/porta 22/);
    expect(perchéNonSiChiama({ protocollo: "fpmate_http", indirizzo: "8.8.8.8", porta: 80 })).toMatch(/non chiama fuori/);
    expect(perchéNonSiChiama({ protocollo: "simulatore", indirizzo: "127.0.0.1", porta: 19100 })).toMatch(/non è stato avviato per le prove/);
    expect(perchéNonSiChiama({ protocollo: "simulatore", indirizzo: "192.168.1.5", porta: 19100 }, { simulatore: true })).toMatch(/127\.0\.0\.1/);
    expect(perchéNonSiChiama({ protocollo: "simulatore", indirizzo: "127.0.0.1", porta: 5432 }, { simulatore: true })).toMatch(/porta/);
    expect(perchéNonSiChiama({ protocollo: "telnet", indirizzo: "192.168.1.5", porta: 23 })).toMatch(/non sa parlare/);
  });
});

describe("il testo resta testo", () => {
  it("toglie i byte di controllo, che in ESC/POS sarebbero comandi", () => {
    expect(rigaPulita("Ciao\x1bp\x00\x19\x1dV")).toBe("Ciao p   V");
  });
  it("in XML i segni non cambiano la forma del documento", () => {
    expect(perXml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&apos;");
  });
  it("sulla stampante di base gli accenti diventano apostrofi", () => {
    expect(soloAscii("Perché è «così» — più")).toBe(`Perche' e' "cosi'" - piu'`);
  });
  it("il foglio di prova ESC/POS ha il testo, il taglio, e nessun comando che venga dal contenuto", () => {
    const b = foglioDiProva({ titolo: "PROVA", righe: ["Borgo 58", "Stampante\x1bp cucina"] });
    const testo = b.toString("latin1");
    expect(testo).toContain("Borgo 58");
    expect(testo).toContain("Stampante p cucina");
    expect(b.subarray(-4)).toEqual(Buffer.from([0x1d, 0x56, 66, 0]));
    expect(testo).not.toContain("\x1bp");
  });
  it("il documento del registratore è NON fiscale, e l'XML resta chiuso", () => {
    const xml = documentoNonFiscale({ titolo: "PROVA", righe: [`a"/><printerFiscalReceipt>`] });
    expect(xml).toContain("<printerNonFiscal>");
    expect(xml).not.toContain("<printerFiscalReceipt>");
    expect(xml).not.toMatch(/printerFiscalReceipt(?!&gt;)/);
  });
});

describe("le risposte degli apparecchi", () => {
  it("ESC/POS: pronto, coperchio aperto, carta finita, rumore", () => {
    expect(leggiStato(Buffer.from([0x12, 0x12])).stato).toBe("pronto");
    expect(leggiStato(Buffer.from([0x16, 0x12])).stato).toBe("coperchio_aperto");
    expect(leggiStato(Buffer.from([0x32, 0x72])).stato).toBe("carta_finita");
    expect(leggiStato(Buffer.from([0x12, 0x1e])).testo).toMatch(/sta per finire/);
    expect(leggiStato(Buffer.from([0xff, 0x00])).stato).toBe("errore");
    expect(leggiStato(Buffer.from([0x12])).stato).toBe("errore");
  });
  it("FPMate: riuscito, carta, coperchio, rifiuto, risposta che non è FPMate", () => {
    expect(leggiRisposta('<response success="true" code="" status="2"/>').riuscito).toBe(true);
    expect(leggiRisposta('<response success="false" code="EPTR_REC_EMPTY"/>').stato).toBe("carta_finita");
    expect(leggiRisposta('<response success="false" code="EPTR_COVER_OPEN"/>').stato).toBe("coperchio_aperto");
    expect(leggiRisposta('<response success="false" code="X"/>').codice).toBe("rifiutato");
    expect(leggiRisposta("<html>ciao</html>").riuscito).toBe(false);
  });
  it("l'apparecchio finto parla ESC/POS se è una stampante, FPMate se è il registratore", () => {
    expect(linguaDi({ protocollo: "simulatore", tipo: "stampante_comande" })).toBe("escpos");
    expect(linguaDi({ protocollo: "simulatore", tipo: "registratore_fiscale" })).toBe("fpmate");
  });
});

// ---------------------------------------------------------------------
// Contro il simulatore, modo per modo.
// ---------------------------------------------------------------------
const base = 18000 + (process.pid % 800) * 2;
const PORTA_S = base + 1000 > 19999 ? base : base + 1000;
const PORTA_R = PORTA_S - 1000 + 1;

// Attese corte: in prova «muto» non deve costare dieci secondi.
const reteVeloce = {
  scambioTcp: (i, p, d, o) => scambioTcp(i, p, d, { ...o, attesaConnessione: 800, attesaRisposta: 600 }),
  postHttp: (o) => postHttp({ ...o, attesaConnessione: 800, attesaRisposta: 600 }),
};

const lavoro = (tipo, dispositivoTipo, porta) => ({
  id: "l",
  tipo,
  contenuto: { titolo: "PROVA DI STAMPA", righe: ["Borgo 58", "Documento non fiscale"] },
  dispositivo: { nome: "finto", tipo: dispositivoTipo, protocollo: "simulatore", indirizzo: "127.0.0.1", porta },
});
const stampante = (tipo = "prova") => lavoro(tipo, "stampante_comande", PORTA_S);
const registratore = (tipo = "prova") => lavoro(tipo, "registratore_fiscale", PORTA_R);
const esegui = (l) => eseguiLavoro(l, { simulatore: true, rete: reteVeloce });

// Il foglio esce quando la stampante chiude la connessione: si aspetta che
// ci sia, fino a due secondi, invece di dormire un tempo fisso.
async function aspettaFogli(s, quanti) {
  for (let i = 0; i < 40 && s.fogli.length < quanti; i++) await new Promise((ok) => setTimeout(ok, 50));
}

async function conModo(modo, prova) {
  const cartella = mkdtempSync(path.join(os.tmpdir(), "b58-ponte-"));
  const s = await avviaSimulatore({ modo, cartella, portaStampante: PORTA_S, portaRegistratore: PORTA_R, silenzioso: true });
  try {
    return await prova(s);
  } finally {
    await s.chiudi();
  }
}

describe("il ponte contro l'apparecchio finto", () => {
  it("normale: la stampante stampa il foglio, il registratore il documento non fiscale", async () => {
    await conModo("normale", async (s) => {
      const a = await esegui(stampante());
      expect(a.stato).toBe("stampato");
      expect(a.stato_dispositivo).toBe("pronto");
      const b = await esegui(registratore());
      expect(b.stato).toBe("stampato");
      await aspettaFogli(s, 2);
      const testi = s.fogli.map((f) => readFileSync(f.file, "utf8")).join("\n");
      expect(testi).toContain("PROVA DI STAMPA");
      expect(testi).toContain("documento non fiscale");
    });
  });

  it("la lettura di stato non stampa niente", async () => {
    await conModo("normale", async (s) => {
      expect((await esegui(stampante("stato"))).stato).toBe("stampato");
      expect((await esegui(registratore("stato"))).stato).toBe("stampato");
      await new Promise((ok) => setTimeout(ok, 300));
      expect(s.fogli).toEqual([]);
    });
  });

  it("carta finita e coperchio aperto: fallito, con la frase per chi legge", async () => {
    await conModo("carta_finita", async () => {
      const a = await esegui(stampante());
      expect([a.stato, a.errore_codice, a.stato_dispositivo]).toEqual(["fallito", "carta_finita", "carta_finita"]);
      expect(a.errore_testo).toMatch(/rotolo/);
      expect((await esegui(registratore())).errore_codice).toBe("carta_finita");
    });
    await conModo("coperchio_aperto", async () => {
      expect((await esegui(stampante())).errore_codice).toBe("coperchio_aperto");
      expect((await esegui(registratore())).errore_codice).toBe("coperchio_aperto");
    });
  });

  it("🔴 muto: la stampante non ha ancora stampato (fallito); il registratore ha ricevuto (INCERTO)", async () => {
    await conModo("muto", async () => {
      const a = await esegui(stampante());
      expect(a.stato).toBe("fallito");
      const b = await esegui(registratore());
      expect(b.stato).toBe("incerto");
      expect(b.errore_testo).toMatch(/forse/);
      // Una lettura di stato non stampa: mai incerta.
      expect((await esegui(registratore("stato"))).stato).toBe("fallito");
    });
  });

  it("a metà: il registratore è incerto, mai «fatto»", async () => {
    await conModo("a_meta", async () => {
      expect((await esegui(stampante())).stato).toBe("fallito");
      expect((await esegui(registratore())).stato).toBe("incerto");
    });
  });

  it("rifiuta: fallito, con il codice dell'apparecchio nell'esito", async () => {
    await conModo("rifiuta", async () => {
      const b = await esegui(registratore());
      expect(b.stato).toBe("fallito");
      expect(b.esito.risposta).toContain("EPTR_PRINTER_OFFLINE");
    });
  });

  it("⚠️ pagina bianca: risponde «fatto», ed è giusto che il ponte ci creda — la difesa è chi ha il foglio in mano", async () => {
    await conModo("pagina_bianca", async () => {
      expect((await esegui(registratore())).stato).toBe("stampato");
    });
  });

  it("apparecchio spento: fallito, «non risponde»", async () => {
    const a = await esegui(stampante());
    expect([a.stato, a.stato_dispositivo]).toEqual(["fallito", "non_risponde"]);
  });

  it("un giro del ponte porta l'esito di ogni lavoro al gestionale", async () => {
    const scritti = [];
    const g = {
      prendiLavori: async () => [stampante(), registratore()].map((l, i) => ({ ...l, id: `l${i}` })),
      esito: async (id, e) => scritti.push([id, e.stato]),
    };
    await conModo("normale", async () => {
      const fatti = await unGiro(g, { simulatore: true, esegui: (l, o) => eseguiLavoro(l, { ...o, rete: reteVeloce }) });
      expect(fatti).toBe(2);
    });
    expect(scritti).toEqual([["l0", "stampato"], ["l1", "stampato"]]);
  });
});

describe("senza il permesso delle prove, l'apparecchio finto non si chiama", () => {
  let s;
  beforeAll(async () => {
    s = await avviaSimulatore({ cartella: mkdtempSync(path.join(os.tmpdir(), "b58-ponte-")), portaStampante: PORTA_S, portaRegistratore: PORTA_R, silenzioso: true });
  });
  afterAll(() => s?.chiudi());
  it("rifiutato prima di aprire la connessione", async () => {
    const a = await eseguiLavoro(stampante(), { simulatore: false, rete: reteVeloce });
    expect([a.stato, a.errore_codice]).toEqual(["fallito", "rifiutato"]);
    expect(s.fogli).toEqual([]);
  });
});

describe("un guasto del ponte non ferma gli altri lavori", () => {
  it("un lavoro che non finisce diventa INCERTO al suo tetto, e il prossimo va lo stesso", async () => {
    const scritti = [];
    const g = {
      prendiLavori: async () => [{ id: "fermo", tipo: "prova", dispositivo: {} }, { id: "dopo", tipo: "prova", dispositivo: {} }],
      esito: async (id, e) => scritti.push([id, e.stato]),
    };
    const esegui = (l) => (l.id === "fermo" ? new Promise(() => {}) : Promise.resolve({ stato: "stampato" }));
    await unGiro(g, { esegui, limiteMs: 200 });
    expect(scritti).toEqual([["fermo", "incerto"], ["dopo", "stampato"]]);
  });

  it("un lavoro che si rompe diventa incerto, non ferma il giro", async () => {
    const scritti = [];
    const g = { prendiLavori: async () => [{ id: "rotto", tipo: "prova" }], esito: async (id, e) => scritti.push([id, e.stato]) };
    await unGiro(g, { esegui: () => Promise.reject(new TypeError("x")) });
    expect(scritti).toEqual([["rotto", "incerto"]]);
  });

  it("un «no» esplicito dell'apparecchio (HTTP 4xx) è fallito, non incerto", async () => {
    const rete = { postHttp: () => Promise.reject(Object.assign(new Error("L'apparecchio ha risposto 403."), { inviato: true, codice: "rifiutato" })) };
    const e = await eseguiLavoro(registratore(), { simulatore: true, rete });
    expect([e.stato, e.errore_codice]).toEqual(["fallito", "rifiutato"]);
  });

  it("una risposta che non è una risposta di stampa: per una prova è incerta", async () => {
    const rete = { postHttp: async () => "<html>pagina del router</html>" };
    expect((await eseguiLavoro(registratore(), { simulatore: true, rete })).stato).toBe("incerto");
    expect((await eseguiLavoro(registratore("stato"), { simulatore: true, rete })).stato).toBe("fallito");
  });
});

describe("il registro del portatile tiene la risposta grezza (collaudo, 29/10/2026)", () => {
  it("una riga con la risposta dell'apparecchio, su una riga sola e tagliata", async () => {
    const righe = [];
    const g = { prendiLavori: async () => [{ id: "uno", tipo: "stato", dispositivo: { nome: "Cassa" } }], esito: async () => {} };
    const lunga = `<response success="true">\n${"x".repeat(5000)}</response>`;
    await unGiro(g, { scrivi: (r) => righe.push(r), esegui: async () => ({ stato: "stampato", esito: { lingua: "fpmate", risposta: lunga } }) });
    const grezza = righe.find((r) => r.includes("risposta dell'apparecchio"));
    expect(grezza).toContain('success=\\"true\\"');
    expect(grezza).not.toContain("\n");
    expect(grezza.length).toBeLessThan(2100);
  });
  it("senza risposta (apparecchio spento) nessuna riga in più", async () => {
    const righe = [];
    const g = { prendiLavori: async () => [{ id: "due", tipo: "prova", dispositivo: {} }], esito: async () => {} };
    await unGiro(g, { scrivi: (r) => righe.push(r), esegui: async () => ({ stato: "fallito", esito: null }) });
    expect(righe).toHaveLength(1);
  });
});
