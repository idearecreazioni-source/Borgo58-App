import { describe, expect, it } from "vitest";
import {
  BOZZE,
  FINGER,
  FINGER_IN_CARTA,
  MATERIE_PRIME,
  NOMI_INGREDIENTI,
  NOMI_RICETTE,
  PIATTI,
  PIATTI_IN_CARTA,
  PREPARAZIONI,
} from "../../scripts/scenario/carta.mjs";

// Il catalogo dello scenario di collaudo (22/08).
//
// ⚠️ PERCHE' UNA PROVA SU DEI DATI. Il catalogo non e' codice, ma se e'
// incoerente lo scenario **fallisce a meta'** e lascia il progetto di prova
// costruito per meta': ingredienti si', ricette no, e nessuno sa dove si e'
// fermato. Un errore qui si vede in un secondo; là si vede dopo dieci
// minuti di esecuzione e un database da rifare.
//
// ⚠️ E c'e' la ragione del 17/08: le regole di questo progetto valgono
// anche per il codice che non e' l'app. Uno scenario sbagliato non fa
// sbagliare il gestionale — fa sbagliare **chi lo giudica**.

const nomiMaterie = new Set(NOMI_INGREDIENTI);
const nomiPrep = new Set(PREPARAZIONI.map((r) => r[0]));
const componibili = new Set([...nomiMaterie, ...nomiPrep]);

describe("il catalogo dello scenario regge da solo", () => {
  it("ogni componente esiste", () => {
    const mancanti = [];
    for (const lista of [PREPARAZIONI, FINGER, PIATTI])
      for (const [nome, , , componenti] of lista)
        for (const [c] of componenti)
          if (!componibili.has(c)) mancanti.push(`${c} (usato da ${nome})`);
    expect(mancanti, "componenti che non esistono").toEqual([]);
  });

  it("nessuna preparazione dipende da se stessa", () => {
    // Il database vieta i cicli fra preparazioni; qui si scopre prima, con
    // la catena scritta invece di un errore SQL.
    const dipendenze = new Map(
      PREPARAZIONI.map((p) => [p[0], p[3].map((c) => c[0]).filter((n) => nomiPrep.has(n))])
    );
    const cicli = [];
    const visita = (n, catena = []) => {
      if (catena.includes(n)) return cicli.push([...catena, n].join(" -> "));
      for (const d of dipendenze.get(n) ?? []) visita(d, [...catena, n]);
    };
    for (const n of nomiPrep) visita(n);
    expect(cicli).toEqual([]);
  });

  it("niente doppioni: due righe con lo stesso nome sarebbero una sola dopo la pulizia", () => {
    for (const lista of [NOMI_INGREDIENTI, NOMI_RICETTE]) {
      const doppi = [...new Set(lista.filter((n, i) => lista.indexOf(n) !== i))];
      expect(doppi).toEqual([]);
    }
  });

  it("🔴 nessun nome porta un marchio di servizio", () => {
    // E' il reperto: il prefisso `BASE-` mangiava 5 dei 16 caratteri che
    // stanno su una riga, e faceva andare a capo 13 nomi su 15 invece di 8.
    const marchiati = [...NOMI_INGREDIENTI, ...NOMI_RICETTE].filter((n) =>
      /^(BASE|TEST|PROVA)[-_ ]/i.test(n)
    );
    expect(marchiati, "un marchio nel nome falsa ogni misura sui nomi").toEqual([]);
  });

  it("⚠️ i nomi hanno lunghezze diverse: nomi tutti uguali non distinguono", () => {
    const lunghezze = NOMI_INGREDIENTI.map((n) => n.length);
    const corti = lunghezze.filter((l) => l <= 16).length;
    // Servono ENTRAMBI i casi: quelli che stanno su una riga (16 caratteri
    // nella colonna misurata) e quelli che vanno a capo.
    expect(corti).toBeGreaterThan(NOMI_INGREDIENTI.length * 0.25);
    expect(corti).toBeLessThan(NOMI_INGREDIENTI.length * 0.85);
    expect(Math.max(...lunghezze)).toBeGreaterThan(28);
  });

  it("la scala e' quella misurata: sopra le 11 righe di una schermata", () => {
    // 11 righe e' quanto entra in un elenco sul tablet vero. Sotto quella
    // soglia una schermata non ha mai bisogno di essere cercata.
    expect(MATERIE_PRIME.length).toBeGreaterThan(11 * 8);
    expect(NOMI_RICETTE.length).toBeGreaterThan(11 * 5);
  });

  it("🔴 nessuna bozza finisce in carta", () => {
    // Il database RIFIUTA di mettere in un menu attivo una ricetta non
    // pronta, ed e' il vincolo giusto: se lo scenario ci provasse,
    // fallirebbe a meta'.
    const inCarta = new Set([...FINGER_IN_CARTA, ...PIATTI_IN_CARTA]);
    expect(BOZZE.filter((b) => inCarta.has(b))).toEqual([]);
  });

  it("la carta attiva e' quella descritta da Alessio: venti finger e tredici piatti", () => {
    expect(FINGER_IN_CARTA).toHaveLength(20);
    expect(PIATTI_IN_CARTA).toHaveLength(13);
    // ⚠️ E il ricettario e' piu' grande della carta, come in una cucina vera.
    expect(NOMI_RICETTE.length).toBeGreaterThan(33);
  });

  it("⚠️ i non alimentari non entrano in nessuna ricetta, e ci sono", () => {
    const usati = new Set();
    for (const lista of [PREPARAZIONI, FINGER, PIATTI])
      for (const r of lista) for (const [c] of r[3]) usati.add(c);
    const nonAlimentari = MATERIE_PRIME.filter((r) => r[1] === "altro").map((r) => r[0]);
    expect(nonAlimentari.length).toBeGreaterThan(0);
    // Ci sono perche' la sorveglianza dei prezzi vale anche per lo
    // sgrassante, e il Ricettario NON deve mostrarli.
    expect(nonAlimentari.filter((n) => usati.has(n))).toEqual([]);
    // E tutto il resto della dispensa e' usato: un ristorante non compra
    // quello che non entra in niente.
    const alimentariOrfani = MATERIE_PRIME.filter((r) => r[1] !== "altro" && !usati.has(r[0]));
    expect(alimentariOrfani.map((r) => r[0])).toEqual([]);
  });

  it("i prezzi non sono tondi, e le quantita' nemmeno", () => {
    // Numeri tondi tornano sempre belli e non mostrano mai un
    // arrotondamento sbagliato.
    const tondi = MATERIE_PRIME.filter((r) => Number.isInteger(r[3])).length;
    expect(tondi).toBeLessThan(MATERIE_PRIME.length * 0.2);
  });
});
