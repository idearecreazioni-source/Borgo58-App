import { mkdtempSync, readFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { eseguiLavoro } from "../../ponte/esegui.mjs";
import {
  CHIUSURA_GIORNALIERA,
  PAGAMENTI,
  annulloFiscale,
  datiChiusura,
  datiScontrino,
  euro,
  leggiRisposta,
  scontrinoFiscale,
} from "../../ponte/protocolli/fpmate.mjs";
import { postHttp, scambioTcp } from "../../ponte/rete.mjs";
import { avviaSimulatore } from "../../ponte/simulatore.mjs";

// Lo scontrino fiscale dalla chiusura del conto (04/11/2026), provato senza
// gestionale e senza registratore vero.

// La risposta vera del registratore Epson FP-81 II RT al collaudo del
// 04/11, alle 09:33 (scontrino di prova da 1,00 euro in contanti).
const RISPOSTA_VERA = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
<soapenv:Body>
<response success="true" code="" status="2">
	<addInfo>
	<elementList>lastCommand,printerStatus,fiscalReceiptNumber,fiscalReceiptAmount,fiscalReceiptDate,fiscalReceiptTime,zRepNumber</elementList>
		<lastCommand>74</lastCommand>
		<printerStatus>00110</printerStatus>
		<fiscalReceiptNumber>14</fiscalReceiptNumber>
		<fiscalReceiptAmount>1,00</fiscalReceiptAmount>
		<fiscalReceiptDate>4/11/2026</fiscalReceiptDate>
		<fiscalReceiptTime>9:33</fiscalReceiptTime>
		<zRepNumber>1627</zRepNumber>
	</addInfo>
</response>
</soapenv:Body>
</soapenv:Envelope>`;

const CONTENUTO = {
  tavolo: "7",
  righe: [
    { descrizione: "Tagliatelle al ragù", quantita: 2, prezzo: 12, reparto: 1 },
    { descrizione: "Calice <rosso> & \"bianco\"", quantita: 1, prezzo: 5.5, reparto: 1 },
  ],
  pagamenti: [{ mezzo: "contante", importo: 29.5 }],
  totale: 29.5,
};

describe("lo scontrino fiscale in FPMate", () => {
  it("ha la forma provata sul registratore vero: prezzi con la virgola, reparto 1, contanti 0/0", () => {
    const xml = scontrinoFiscale(CONTENUTO);
    expect(xml).toContain("<printerFiscalReceipt>");
    expect(xml).toContain('<beginFiscalReceipt operator="1" />');
    expect(xml).toContain(
      '<printRecItem operator="1" description="Tagliatelle al ragù" quantity="2" unitPrice="12,00" department="1" justification="1" />',
    );
    expect(xml).toContain(
      '<printRecTotal operator="1" description="CONTANTI" payment="29,50" paymentType="0" index="0" justification="1" />',
    );
    expect(xml.indexOf("<printRecTotal")).toBeGreaterThan(xml.lastIndexOf("<printRecItem"));
    expect(xml.trim().endsWith("</s:Envelope>")).toBe(true);
    expect(xml).toContain('<endFiscalReceipt operator="1" />');
  });

  it("i segni di una descrizione non cambiano la forma del documento", () => {
    const xml = scontrinoFiscale(CONTENUTO);
    expect(xml).toContain('description="Calice &lt;rosso&gt; &amp; &quot;bianco&quot;"');
    expect(xml.match(/<printRecItem /g)).toHaveLength(2);
  });

  it("descrizione lunga tagliata, vuota sostituita; pagamento misto = un totale per quota, carta 2/1", () => {
    const xml = scontrinoFiscale({
      righe: [
        { descrizione: "x".repeat(60), quantita: 1, prezzo: 10 },
        { descrizione: "   ", quantita: 1, prezzo: 2 },
      ],
      pagamenti: [
        { mezzo: "carta", importo: 7 },
        { mezzo: "contante", importo: 5 },
      ],
    });
    expect(xml).toContain(`description="${"x".repeat(38)}"`);
    expect(xml).toContain('description="Piatto"');
    expect(xml).toContain(`paymentType="${PAGAMENTI.carta.paymentType}" index="${PAGAMENTI.carta.index}"`);
    expect(xml.match(/<printRecTotal /g)).toHaveLength(2);
  });

  it("si rifiuta di comporre uno scontrino sbagliato, prima di mandare", () => {
    expect(() => scontrinoFiscale({ righe: [], pagamenti: [{ mezzo: "contante", importo: 1 }] })).toThrow(/riga/);
    expect(() => scontrinoFiscale({ righe: [{ descrizione: "a", quantita: 1, prezzo: 1 }], pagamenti: [] })).toThrow(/pagato/);
    expect(() => scontrinoFiscale({ righe: [{ descrizione: "a", quantita: 1, prezzo: 1 }], pagamenti: [{ mezzo: "assegno", importo: 1 }] })).toThrow(/assegno/);
    expect(() => scontrinoFiscale({ righe: [{ descrizione: "a", quantita: 0, prezzo: 1 }], pagamenti: [{ mezzo: "contante", importo: 1 }] })).toThrow(/Quantità/);
    expect(() => euro(-1)).toThrow();
    expect(() => euro(null)).toThrow();
    expect(euro("12.5")).toBe("12,50");
  });

  it("dalla risposta vera legge numero, data, ora, importo e chiusura", () => {
    expect(leggiRisposta(RISPOSTA_VERA).riuscito).toBe(true);
    expect(datiScontrino(RISPOSTA_VERA)).toEqual({
      numero: "14",
      data: "4/11/2026",
      ora: "9:33",
      importo: "1,00",
      chiusura: "1627",
      matricola: null,
    });
    expect(datiScontrino("<response success=\"true\"/>").numero).toBeNull();
  });
});

// ---------------------------------------------------------------------
// Contro il registratore finto.
// ---------------------------------------------------------------------
const PORTA_R = 19600 + (process.pid % 190) * 2;
const PORTA_S = PORTA_R + 1;

const reteVeloce = {
  scambioTcp: (i, p, d, o) => scambioTcp(i, p, d, { ...o, attesaConnessione: 800, attesaRisposta: 600 }),
  postHttp: (o) => postHttp({ ...o, attesaConnessione: 800, attesaRisposta: 600 }),
};

const scontrino = (tipoApparecchio = "registratore_fiscale", contenuto = CONTENUTO) => ({
  id: "s",
  tipo: "scontrino",
  contenuto,
  dispositivo: { nome: "finto", tipo: tipoApparecchio, protocollo: "simulatore", indirizzo: "127.0.0.1", porta: PORTA_R },
});
// L'annullo è sospeso dal 04/11 (esegui.mjs): qui si prova com'è fatto.
const esegui = (l) => eseguiLavoro(l, { simulatore: true, rete: reteVeloce, annulloSospeso: false });

async function conModo(modo, prova) {
  const cartella = mkdtempSync(path.join(os.tmpdir(), "b58-scontrino-"));
  const s = await avviaSimulatore({ modo, cartella, portaStampante: PORTA_S, portaRegistratore: PORTA_R, silenzioso: true });
  try {
    return await prova(s);
  } finally {
    await s.chiudi();
  }
}

describe("lo scontrino contro il registratore finto", () => {
  it("normale: emesso, e l'esito porta numero, data, ora e chiusura", async () => {
    await conModo("normale", async (s) => {
      const e = await esegui(scontrino());
      expect(e.stato).toBe("stampato");
      expect(e.esito.scontrino.numero).toBe("1");
      expect(e.esito.scontrino.importo).toBe("29,50");
      expect(e.esito.scontrino.chiusura).toBe("1");
      expect(e.esito.scontrino.data).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
      const testo = readFileSync(s.fogli[0].file, "utf8");
      expect(testo).toContain("Tagliatelle al ragù");
      expect(testo).toContain("scontrino fiscale finto");
    });
  });

  it("🔴 muto: mandato senza risposta = INCERTO, e dice di guardare il registratore", async () => {
    await conModo("muto", async () => {
      const e = await esegui(scontrino());
      expect(e.stato).toBe("incerto");
      expect(e.errore_testo).toMatch(/registratore.*guardalo prima di rifarlo/);
    });
  });

  it("🔴 a metà: INCERTO, mai emesso", async () => {
    await conModo("a_meta", async () => {
      expect((await esegui(scontrino())).stato).toBe("incerto");
    });
  });

  it("un «no» del registratore è fallito, e dice di guardare il display prima di rifarlo", async () => {
    await conModo("carta_finita", async () => {
      const e = await esegui(scontrino());
      expect([e.stato, e.errore_codice]).toEqual(["fallito", "carta_finita"]);
      expect(e.errore_testo).toMatch(/display/);
    });
  });

  it("registratore spento: fallito (non è partito niente)", async () => {
    const e = await esegui(scontrino());
    expect([e.stato, e.stato_dispositivo]).toEqual(["fallito", "non_risponde"]);
  });

  it("🔴 risposta tagliata senza lunghezza, codice sconosciuto o guasto 5xx: INCERTO, mai fallito", async () => {
    const conRisposta = (corpo) =>
      eseguiLavoro(scontrino(), {
        simulatore: true,
        rete: { scambioTcp, postHttp: async () => corpo },
      });
    for (const corpo of ["<response suc", "<response ", '<response success="false" code="EPTR_REC_EMPTY"', '<response success="false" code="EPTR_BUSY" status="2"></response>']) {
      const e = await conRisposta(corpo);
      expect(e.stato, corpo).toBe("incerto");
    }
    // Un «no» intero per un motivo che ferma la stampa resta fallito.
    expect((await conRisposta('<response success="false" code="EPTR_COVER_OPEN" status="2"></response>')).stato).toBe("fallito");
    // Un registratore che risponde 503 a documento ricevuto.
    const server = http.createServer((q, r) => {
      q.resume();
      q.on("end", () => {
        r.writeHead(503);
        r.end("guasto");
      });
    });
    await new Promise((ok) => server.listen(PORTA_R, "127.0.0.1", ok));
    try {
      const guasto = await esegui(scontrino());
      expect([guasto.stato, guasto.errore_codice]).toEqual(["incerto", "risposta_a_meta"]);
    } finally {
      await new Promise((ok) => server.close(ok));
    }
  });

  it("uno scontrino non va a una stampante delle comande, né si compone se è sbagliato", async () => {
    expect((await esegui(scontrino("stampante_comande"))).errore_codice).toBe("rifiutato");
    const e = await esegui(scontrino("registratore_fiscale", { righe: [], pagamenti: [] }));
    expect([e.stato, e.errore_codice]).toEqual(["fallito", "rifiutato"]);
  });
});

// ---------------------------------------------------------------------
// L'annullo e la chiusura giornaliera (04/11/2026), dal manuale Epson
// «ePOS Fiscal Print Solution Development Guide» Rev. U, §5.6 e §5.8.
// ---------------------------------------------------------------------
const ANNULLO = { ...CONTENUTO, riferimento: "VOID 1627 0014 04112026 99IEC123456" };

describe("l'annullo e la chiusura in FPMate", () => {
  it("🔴 l'annullo è SOLO il VOID di tipo 4, come l'esempio §11.29: mai righe di vendita", () => {
    const xml = annulloFiscale(ANNULLO);
    expect(xml).toContain(
      '<printerFiscalReceipt>\n<printRecMessage operator="1" messageType="4" message="VOID 1627 0014 04112026 99IEC123456" />\n</printerFiscalReceipt>',
    );
    expect(xml).not.toMatch(/printRecItem|printRecTotal|beginFiscalReceipt|endFiscalReceipt/);
    expect(xml.trim().endsWith("</s:Envelope>")).toBe(true);
  });

  it("lo stato RT si riconosce dalla risposta (§5.9.16)", async () => {
    const { DOMANDA_STATO_RT, eUnRt } = await import("../../ponte/protocolli/fpmate.mjs");
    expect(DOMANDA_STATO_RT).toContain('<queryPrinterStatus operator="1" statusType="1" />');
    expect(eUnRt('<response success="true"><addInfo><rtType>I</rtType><rtMainStatus>02</rtMainStatus></addInfo></response>')).toBe(true);
    expect(eUnRt('<response success="true"><addInfo><lastCommand>74</lastCommand></addInfo></response>')).toBe(false);
    expect(eUnRt('<response success="false"><addInfo><rtType>I</rtType><rtMainStatus>02</rtMainStatus></addInfo></response>')).toBe(false);
  });

  it("un riferimento sbagliato non parte", () => {
    for (const riferimento of ["VOID 1627 14 04112026 99IEC123456", "VOID 1627 0014 4112026 99IEC123456", "VOID 1627 0014 04112026", 'VOID 1627 0014 04112026 99IEC12345" /><x', ""]) {
      expect(() => annulloFiscale({ ...CONTENUTO, riferimento }), riferimento).toThrow(/Riferimento/);
    }
  });

  it("la chiusura giornaliera è un printZReport, e dalla risposta si legge il numero", () => {
    expect(CHIUSURA_GIORNALIERA).toContain("<printerFiscalReport>");
    expect(CHIUSURA_GIORNALIERA).toContain('<printZReport operator="1" timeout="30000" />');
    // La risposta d'esempio del manuale, §5.8.1.
    const risposta =
      '<response success="true" code="" status="2"><addInfo><elementList>lastCommand,printerStatus,zRepNumber,dailyAmount,serialNumber</elementList>' +
      "<lastCommand>74</lastCommand><printerStatus>20110</printerStatus><zRepNumber>11</zRepNumber><dailyAmount>332,33</dailyAmount><serialNumber>99IEB004001</serialNumber></addInfo></response>";
    expect(datiChiusura(risposta)).toEqual({ chiusura: "11", importo: "332,33", matricola: "99IEB004001" });
  });
});

const fiscale = (tipo, contenuto = {}) => ({ ...scontrino("registratore_fiscale", contenuto), tipo });

describe("annullo e chiusura contro il registratore finto", () => {
  it("normale: l'annullo esce col suo numero, la chiusura fa salire il numero e riparte da 1", async () => {
    await conModo("normale", async (s) => {
      const a = await esegui(fiscale("annullo", ANNULLO));
      expect(a.stato).toBe("stampato");
      expect(a.esito.annullo.numero).toBe("1");
      expect(readFileSync(s.fogli[0].file, "utf8")).toContain("VOID 1627 0014 04112026 99IEC123456");
      const z = await esegui(fiscale("chiusura"));
      expect(z.stato).toBe("stampato");
      expect(z.esito.chiusura).toEqual({ chiusura: "2", importo: "0,00", matricola: "99IEC000000" });
      expect((await esegui(scontrino())).esito.scontrino).toMatchObject({ numero: "1", chiusura: "2" });
    });
  });

  it("🔴 muto e a metà: la chiusura è INCERTA; l'annullo non parte nemmeno (si ferma alla domanda RT)", async () => {
    await conModo("muto", async (s) => {
      expect((await esegui(fiscale("annullo", ANNULLO))).stato).toBe("fallito");
      expect((await esegui(fiscale("chiusura"))).stato).toBe("incerto");
      expect(s.fogli).toHaveLength(0);
    });
    await conModo("a_meta", async () => {
      expect((await esegui(fiscale("annullo", ANNULLO))).stato).toBe("fallito");
      expect((await esegui(fiscale("chiusura"))).stato).toBe("incerto");
    });
  });

  it("🔴 il registratore del collaudo (modalità MF): l'annullo non parte, e non esce niente", async () => {
    await conModo("mf", async (s) => {
      const e = await esegui(fiscale("annullo", ANNULLO));
      expect([e.stato, e.errore_codice]).toEqual(["fallito", "rifiutato"]);
      expect(e.errore_testo).toMatch(/non risponde come un RT/);
      await new Promise((ok) => setTimeout(ok, 100));
      expect(s.fogli).toHaveLength(0);
    });
  });

  it("🔴 il finto rifiuta un annullo con righe di vendita, la forma che il 04/11 ha fatto una vendita", async () => {
    await conModo("normale", async (s) => {
      const corpo =
        '<printerFiscalReceipt><printRecMessage operator="1" messageType="4" message="VOID 1628 0001 04112026 99MEX063404" /><beginFiscalReceipt operator="1" />' +
        '<printRecItem operator="1" description="Ravioli" quantity="1" unitPrice="16,00" department="1" justification="1" /><endFiscalReceipt operator="1" /></printerFiscalReceipt>';
      const r = await reteVeloce.postHttp({ indirizzo: "127.0.0.1", porta: PORTA_R, percorso: "/cgi-bin/fpmate.cgi", corpo });
      expect(r).toContain('success="false"');
      expect(s.fogli).toHaveLength(0);
    });
  });

  it("sospeso (com'è adesso): l'annullo non chiama nemmeno il registratore", async () => {
    let chiamato = false;
    const e = await eseguiLavoro(fiscale("annullo", ANNULLO), { simulatore: true, rete: { scambioTcp, postHttp: async () => ((chiamato = true), "") } });
    expect([e.stato, e.errore_codice]).toEqual(["fallito", "rifiutato"]);
    expect(chiamato).toBe(false);
  });

  it("un annullo senza riferimento valido fallisce prima di partire; niente fiscale sulle stampanti", async () => {
    const e = await esegui(fiscale("annullo", CONTENUTO));
    expect([e.stato, e.errore_codice]).toEqual(["fallito", "rifiutato"]);
    expect((await esegui({ ...scontrino("stampante_comande"), tipo: "chiusura" })).errore_codice).toBe("rifiutato");
  });
});

describe("annullo e chiusura: il «no» sicuro e i tempi", () => {
  const RT = '<response success="true"><addInfo><rtType>I</rtType><rtMainStatus>02</rtMainStatus></addInfo></response>';
  const conRisposta = (tipo, corpo, contenuto) =>
    eseguiLavoro(fiscale(tipo, contenuto), {
      simulatore: true,
      annulloSospeso: false,
      rete: { scambioTcp, postHttp: async (o) => (/statusType="1"/.test(o.corpo) ? RT : corpo) },
    });

  it("🔴 un codice sconosciuto è INCERTO, un no intero per la carta è fallito", async () => {
    for (const [tipo, contenuto] of [["annullo", ANNULLO], ["chiusura", {}]]) {
      expect((await conRisposta(tipo, '<response success="false" code="EPTR_BUSY" status="2"></response>', contenuto)).stato, tipo).toBe("incerto");
      expect((await conRisposta(tipo, '<response success="false" code="EPTR_REC_EMPTY" status="2"></response>', contenuto)).stato, tipo).toBe("fallito");
    }
  });

  it("la chiusura usa il suo indirizzo e la sua attesa, e il tetto del ponte è più lungo", async () => {
    const { ATTESA_CHIUSURA_MS, PERCORSO_CHIUSURA } = await import("../../ponte/protocolli/fpmate.mjs");
    const { LIMITE_DELLA_CHIUSURA_MS } = await import("../../ponte/ponte.mjs");
    let opzioni = null;
    await eseguiLavoro(fiscale("chiusura"), {
      simulatore: true,
      rete: {
        scambioTcp,
        postHttp: async (o) => {
          opzioni = o;
          return '<response success="true" code="" status="2"></response>';
        },
      },
    });
    expect(opzioni.percorso).toBe(PERCORSO_CHIUSURA);
    expect(opzioni.attesaRisposta).toBe(ATTESA_CHIUSURA_MS);
    expect(PERCORSO_CHIUSURA).toMatch(/timeout=40000/);
    expect(ATTESA_CHIUSURA_MS).toBeGreaterThan(40000);
    expect(LIMITE_DELLA_CHIUSURA_MS).toBeGreaterThan(ATTESA_CHIUSURA_MS + 3000);
  });
});
