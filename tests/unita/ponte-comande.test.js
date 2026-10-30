import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { eseguiLavoro } from "../../ponte/esegui.mjs";
import { foglioComanda as foglioEpos } from "../../ponte/protocolli/epos.mjs";
import { foglioComanda } from "../../ponte/protocolli/escpos.mjs";
import { aCapo, righeDellaComanda, righeImpaginate } from "../../ponte/protocolli/testo.mjs";
import { scambioTcp } from "../../ponte/rete.mjs";
import { avviaSimulatore, leggibile } from "../../ponte/simulatore.mjs";

// LE COMANDE DAL PONTE (29/10/2026): il foglio che esce dalla stampante
// della cucina dice le stesse cose della pagina Cucina, e il testo che
// arriva dal gestionale non diventa mai un comando per la stampante.

const COMANDA = {
  reparto: "cucina",
  tavolo: "Tavolo 12",
  ora: "20:41",
  aggiunta: false,
  nota_tavolo: "Bambino al tavolo",
  turni: [
    {
      turno: 1,
      righe: [
        { quantita: 2, nome: "Tagliere della casa", senza: [], frasi: [], nota: null },
        { quantita: 1, nome: "bis di Bocconcino", senza: ["Latte", "Glutine"], frasi: ["Pane senza glutine"], nota: "poco sale" },
      ],
    },
    { turno: 2, righe: [{ quantita: 3, nome: "Tagliata", senza: [], frasi: [], nota: "al sangue" }] },
  ],
};

describe("il foglio della comanda", () => {
  it("ha le parti della pagina Cucina, nell'ordine della pagina", () => {
    const righe = righeDellaComanda(COMANDA).map((r) => `${r.stile}: ${r.testo}`);
    expect(righe).toEqual([
      "titolo: CUCINA — Tavolo 12",
      "ora: 20:41",
      "turno: 1° turno",
      "piatto: 2 x Tagliere della casa",
      "piatto: 1 x bis di Bocconcino",
      // 🔴 SENZA prima della nota: quella che riguarda la salute si legge per prima.
      "senza: SENZA LATTE, GLUTINE",
      "frase: Pane senza glutine",
      "nota: > poco sale",
      "turno: 2° turno",
      "piatto: 3 x Tagliata",
      "nota: > al sangue",
      "normale: Nota tavolo: Bambino al tavolo",
    ]);
  });

  it("l'aggiunta lo dice sulla riga del turno; il bar non stampa i turni", () => {
    const aggiunta = righeDellaComanda({ ...COMANDA, aggiunta: true, turni: [COMANDA.turni[1]] });
    expect(aggiunta.find((r) => r.stile === "turno").testo).toBe("2° turno · AGGIUNTA");
    const bar = righeDellaComanda({ ...COMANDA, reparto: "bar" });
    expect(bar[0].testo).toBe("BAR — Tavolo 12");
    expect(bar.some((r) => r.stile === "turno")).toBe(false);
  });

  it("il biglietto del turno: tavolo, ora e la frase", () => {
    const r = righeDellaComanda({ reparto: "cucina", chiamata: true, tavolo: "T5", ora: "21:00" });
    expect(r.map((x) => x.testo)).toEqual(["T5", "21:00", "AVANTI COL PROSSIMO TURNO"]);
  });

  it("va a capo fra le parole e sta nella carta da 80 mm", () => {
    expect(aCapo("uno due tre quattro", 9)).toEqual(["uno due", "tre", "quattro"]);
    expect(aCapo("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
    const lungo = { ...COMANDA, tavolo: "Tavolo della terrazza grande", turni: [{ turno: 1, righe: [{ quantita: 1, nome: "x ".repeat(60), senza: [], frasi: [] }] }] };
    for (const r of righeImpaginate(lungo, 42)) {
      // Il titolo è in doppia larghezza: metà caratteri.
      expect(r.testo.length).toBeLessThanOrEqual(r.stile === "titolo" ? 21 : 42);
    }
  });

  it("sulla carta: accenti e segni diventano lettere che la stampante sa fare", () => {
    const testo = leggibile(foglioComanda(COMANDA));
    expect(testo).toContain("CUCINA - Tavolo 12");
    expect(testo).toContain("1o turno");
    expect(testo).toContain("SENZA LATTE, GLUTINE");
    expect(testo).toMatch(/taglio/);
    expect([...foglioComanda(COMANDA)].every((b) => b < 0x80)).toBe(true);
  });

  it("🔴 un byte di controllo nel nome di un piatto non diventa un comando", () => {
    const b = foglioComanda({
      ...COMANDA,
      tavolo: "T1\x1bp\x00\x19",
      turni: [{ turno: 1, righe: [{ quantita: 1, nome: "Pasta\x1d\x56\x00", senza: [], frasi: [] }] }],
    });
    // ESC p (apri cassetto) non c'è, e c'è un solo GS V (taglio): quello in fondo.
    expect(b.includes(Buffer.from([0x1b, 0x70]))).toBe(false);
    expect(b.indexOf(Buffer.from([0x1d, 0x56]))).toBe(b.length - 4);
  });

  it("in ePOS: stesso foglio, e niente che cambi la forma dell'XML", () => {
    const xml = foglioEpos({ ...COMANDA, nota_tavolo: '<cut/> & "x"' });
    expect(xml).toContain("CUCINA - Tavolo 12");
    expect(xml).toContain("&lt;cut/&gt; &amp; &quot;x&quot;");
    expect(xml.match(/<cut /g)).toHaveLength(1);
  });
});

describe("il ponte stampa una comanda", () => {
  const PORTA_S = 19331;
  const PORTA_R = 18331;
  const reteVeloce = {
    scambioTcp: (i, p, d, o) => scambioTcp(i, p, d, { ...o, attesaConnessione: 800, attesaRisposta: 600 }),
  };
  const lavoro = (tipo, dispositivoTipo, porta, contenuto = COMANDA) => ({
    id: "l",
    tipo,
    contenuto,
    dispositivo: { nome: "finto", tipo: dispositivoTipo, protocollo: "simulatore", indirizzo: "127.0.0.1", porta },
  });

  async function conModo(modo, prova) {
    const cartella = mkdtempSync(path.join(os.tmpdir(), "b58-comande-"));
    const s = await avviaSimulatore({ modo, cartella, portaStampante: PORTA_S, portaRegistratore: PORTA_R, silenzioso: true });
    try {
      return await prova(s);
    } finally {
      await s.chiudi();
    }
  }

  it("normale: esce, con i piatti", async () => {
    await conModo("normale", async (s) => {
      const e = await eseguiLavoro(lavoro("comanda", "stampante_comande", PORTA_S), { simulatore: true, rete: reteVeloce });
      expect(e.stato).toBe("stampato");
      for (let i = 0; i < 40 && s.fogli.length < 1; i++) await new Promise((ok) => setTimeout(ok, 50));
      expect(readFileSync(s.fogli[0].file, "utf8")).toContain("3 x Tagliata");
    });
  });

  it("carta finita: non esce, e lo dice (si riprova senza paura di doppioni)", async () => {
    await conModo("carta_finita", async () => {
      const e = await eseguiLavoro(lavoro("chiamata", "stampante_comande", PORTA_S, { chiamata: true, tavolo: "T5" }), {
        simulatore: true,
        rete: reteVeloce,
      });
      expect([e.stato, e.errore_codice]).toEqual(["fallito", "carta_finita"]);
    });
  });

  it("🔴 una comanda non va mai al registratore", async () => {
    const e = await eseguiLavoro(lavoro("comanda", "registratore_fiscale", PORTA_R), { simulatore: true, rete: reteVeloce });
    expect([e.stato, e.errore_codice]).toEqual(["fallito", "rifiutato"]);
  });
});
