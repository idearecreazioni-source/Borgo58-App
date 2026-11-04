import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { eseguiLavoro } from "../../ponte/esegui.mjs";
import { unGiro } from "../../ponte/ponte.mjs";
import { postHttp, scambioTcp } from "../../ponte/rete.mjs";
import { avviaSimulatore } from "../../ponte/simulatore.mjs";

// LA COMANDA CHE LA STAMPANTE NON HA RICEVUTO ESCE ALLA RIACCENSIONE
// (04/11/2026): stampante spenta → «riprova»; riaccesa → esce, una volta.
// Un incerto e il fiscale non si riprovano mai.

const PORTA_S = 19700 + (process.pid % 140) * 2;
const PORTA_R = PORTA_S + 1;
const reteVeloce = {
  scambioTcp: (i, p, d, o) => scambioTcp(i, p, d, { ...o, attesaConnessione: 800, attesaRisposta: 600 }),
  postHttp: (o) => postHttp({ ...o, attesaConnessione: 800, attesaRisposta: 600 }),
};
const esegui = (l, o) => eseguiLavoro(l, { ...o, simulatore: true, rete: reteVeloce });

const COMANDA = {
  reparto: "cucina",
  tavolo: "T3",
  ora: "12:27",
  aggiunta: false,
  nota_tavolo: null,
  turni: [{ turno: 1, righe: [{ quantita: 1, nome: "Tagliatelle", senza: [], frasi: [], nota: null }] }],
};
const lavoro = (tipo, dispositivoTipo, porta, contenuto = COMANDA) => ({
  id: `${tipo}-1`,
  tipo,
  contenuto,
  dispositivo: { nome: "finta", tipo: dispositivoTipo, protocollo: "simulatore", indirizzo: "127.0.0.1", porta },
});

async function conModo(modo, prova) {
  const s = await avviaSimulatore({
    modo,
    cartella: mkdtempSync(path.join(os.tmpdir(), "b58-riprova-")),
    portaStampante: PORTA_S,
    portaRegistratore: PORTA_R,
    silenzioso: true,
  });
  try {
    return await prova(s);
  } finally {
    await s.chiudi();
  }
}

async function aspettaFogli(s, quanti) {
  for (let i = 0; i < 40 && s.fogli.length < quanti; i++) await new Promise((ok) => setTimeout(ok, 50));
}

describe("la comanda che la stampante non ha ricevuto", () => {
  it("🔴 spenta → «riprova»; riaccesa → esce una volta sola", async () => {
    const scritti = [];
    const coda = [lavoro("comanda", "stampante_comande", PORTA_S)];
    const g = {
      // Il gestionale finto rimette in coda quello che torna «riprova».
      prendiLavori: async () => coda.splice(0),
      esito: async (id, e) => {
        scritti.push(e.stato);
        if (e.stato === "riprova") coda.push(lavoro("comanda", "stampante_comande", PORTA_S));
      },
    };
    // Stampante spenta: niente risponde sulla porta.
    await unGiro(g, { simulatore: true, esegui });
    expect(scritti).toEqual(["riprova"]);
    // La riaccendono: al giro dopo esce.
    await conModo("normale", async (s) => {
      await unGiro(g, { simulatore: true, esegui });
      await aspettaFogli(s, 1);
      await unGiro(g, { simulatore: true, esegui });
      expect(scritti).toEqual(["riprova", "stampato"]);
      expect(s.fogli).toHaveLength(1);
    });
  });

  it("carta finita o coperchio aperto: la stampante ha detto «non sono pronta», si riprova", async () => {
    await conModo("carta_finita", async () => {
      expect((await esegui(lavoro("comanda", "stampante_comande", PORTA_S))).riprova).toBe(true);
    });
  });

  it("se il gestionale non conosce «riprova», l'esito è quello di sempre: fallito", async () => {
    const scritti = [];
    const g = {
      prendiLavori: async () => (scritti.length ? [] : [lavoro("comanda", "stampante_comande", PORTA_S)]),
      esito: async (id, e) => {
        scritti.push(e.stato);
        if (e.stato === "riprova") throw new Error("L'esito di un lavoro è stampato, fallito o incerto.");
      },
    };
    await unGiro(g, { simulatore: true, esegui });
    expect(scritti).toEqual(["riprova", "fallito"]);
  });

  it("🔴 una prova di stampa, uno scontrino, un annullo, una chiusura: mai «riprova»", async () => {
    for (const l of [
      lavoro("prova", "stampante_comande", PORTA_S, { titolo: "PROVA", righe: ["x"] }),
      lavoro("scontrino", "registratore_fiscale", PORTA_R, {
        righe: [{ descrizione: "a", quantita: 1, prezzo: 1 }],
        pagamenti: [{ mezzo: "contante", importo: 1 }],
      }),
      lavoro("chiusura", "registratore_fiscale", PORTA_R, {}),
    ]) {
      const e = await esegui(l);
      expect(e.stato, l.tipo).toBe("fallito");
      expect(e.riprova, l.tipo).toBeUndefined();
    }
  });

  it("🔴 il foglio è partito e la risposta no: INCERTO, mai «riprova»", async () => {
    const { ErroreDiRete } = await import("../../ponte/rete.mjs");
    let chiamata = 0;
    const rete = {
      postHttp,
      // La prima chiamata è la domanda di stato (pronta), la seconda il foglio.
      scambioTcp: async () => {
        chiamata += 1;
        if (chiamata === 1) return Buffer.from([0x12, 0x12]);
        throw new ErroreDiRete("Mandato, ma la stampante non ha preso tutto in tempo.", { inviato: true, codice: "risposta_a_meta" });
      },
    };
    const e = await eseguiLavoro(lavoro("comanda", "stampante_comande", PORTA_S), { simulatore: true, rete });
    expect(e.stato).toBe("incerto");
    expect(e.riprova).toBeUndefined();
  });
});
