import { describe, it, expect } from "vitest";
import { selezioneDopoIlTocco } from "../../src/lib/calcoli/selezione.js";

// ⚠️ La sala di prova è quella vera: T5·T6 accostati, T7·T8·T9 accostati,
// T1 e T2 soli. Serve che i casi si DISTINGUANO fra loro — con due soli
// tavoli, «somma» e «cambia» darebbero risposte confondibili.
const T1 = ["T1"];
const T2 = ["T2"];
const TAVOLONE = ["T7", "T8", "T9"];

describe("si seleziona un tavolo o un tavolone, mai due tavoli lontani", () => {
  it("da niente, un tavolo singolo seleziona se stesso", () => {
    expect(selezioneDopoIlTocco([], T1)).toEqual(["T1"]);
  });

  it("🔴 toccare un ALTRO tavolo cambia la selezione, NON la somma", () => {
    // Era questo il difetto: prima veniva ["T1","T2"], e su due tavoli
    // lontani si apriva una comanda sola.
    expect(selezioneDopoIlTocco(["T1"], T2)).toEqual(["T2"]);
    expect(selezioneDopoIlTocco(["T1"], T2)).not.toContain("T1");
  });

  it("un tavolo accostato porta con sé tutto il tavolone", () => {
    expect(selezioneDopoIlTocco([], TAVOLONE)).toEqual(["T7", "T8", "T9"]);
  });

  it("ritoccare lo stesso tavolo annulla", () => {
    expect(selezioneDopoIlTocco(["T1"], T1)).toEqual([]);
  });

  it("...e toccare un ALTRO tavolo dello stesso tavolone annulla anche lui", () => {
    // ⚠️ Perché è lo stesso insieme: T7 e T9 non sono due scelte diverse.
    expect(selezioneDopoIlTocco(["T7", "T8", "T9"], TAVOLONE)).toEqual([]);
  });

  it("dal tavolone si passa a un singolo senza portarsi dietro niente", () => {
    expect(selezioneDopoIlTocco(["T7", "T8", "T9"], T1)).toEqual(["T1"]);
  });

  it("da un singolo si passa al tavolone intero", () => {
    expect(selezioneDopoIlTocco(["T1"], TAVOLONE)).toEqual(["T7", "T8", "T9"]);
  });

  it("un insieme vuoto non tocca la selezione: non si sa cosa è stato toccato", () => {
    expect(selezioneDopoIlTocco(["T1"], [])).toEqual(["T1"]);
  });
});

import { cosaSiVede, esitoDelTocco } from "../../src/lib/calcoli/selezione.js";

describe("da un conto aperto si deve poter uscire, e i due pannelli non convivono", () => {
  it("🔴 con un conto aperto si vede IL CONTO, anche se c'è una selezione", () => {
    // Era questo il difetto visto da Alessio: «Divano 3 · Apri il tavolo»
    // sopra e «COMANDA IN CORSO — T3» sotto, insieme.
    expect(cosaSiVede({ conto: "c1", selezione: ["T5"] })).toBe("conto");
  });

  it("senza conto e con una selezione si vede la selezione", () => {
    expect(cosaSiVede({ conto: null, selezione: ["T5"] })).toBe("selezione");
  });

  it("senza niente si vede la sala", () => {
    expect(cosaSiVede({})).toBe("sala");
  });

  it("modalità veloce: toccare un ALTRO tavolo con un conto lo apre e lascia il precedente", () => {
    const r = esitoDelTocco({ contoAperto: "c1", contoDelTavolo: "c2", insieme: ["T5"] });
    expect(r.azione).toBe("apri-conto");
    expect(r.contoId).toBe("c2");
    expect(r.lasciaIlConto).toBe(true);
  });

  it("...e toccare un tavolo LIBERO lascia il conto e seleziona", () => {
    const r = esitoDelTocco({ contoAperto: "c1", contoDelTavolo: null, selezione: [], insieme: ["T5"] });
    expect(r.azione).toBe("seleziona");
    expect(r.selezione).toEqual(["T5"]);
    expect(r.lasciaIlConto).toBe(true);
  });

  it("toccare il tavolo del conto che si sta già guardando non fa niente", () => {
    // ⚠️ L'uscita è la riga in cima, non il tocco: il pavimento e il proprio
    // tavolo sono a portata di gomito quando si tiene il tablet con due mani.
    const r = esitoDelTocco({ contoAperto: "c1", contoDelTavolo: "c1", insieme: ["T5"] });
    expect(r.azione).toBe("resta");
    expect(r.lasciaIlConto).toBe(false);
  });

  it("🔴 MENTRE SI SPOSTA un conto, il conto NON si lascia mai", () => {
    // Lasciarlo perderebbe proprio la cosa che si sta spostando.
    const r = esitoDelTocco({
      contoAperto: "c1", contoDelTavolo: null, selezione: [], insieme: ["T5"], spostando: true,
    });
    expect(r.azione).toBe("seleziona");
    expect(r.lasciaIlConto).toBe(false);
  });

  it("...e un tavolo già occupato non si può scegliere come destinazione", () => {
    const r = esitoDelTocco({
      contoAperto: "c1", contoDelTavolo: "c2", insieme: ["T5"], spostando: true,
    });
    expect(r.azione).toBe("rifiuta");
  });

  it("senza nessun conto aperto non c'è niente da lasciare", () => {
    const r = esitoDelTocco({ contoAperto: null, contoDelTavolo: null, selezione: [], insieme: ["T1"] });
    expect(r.lasciaIlConto).toBe(false);
  });
});

import { siVedeLaBarraDeiTavoli } from "../../src/lib/calcoli/selezione.js";

// 🔴 REGRESSIONE VERA, trovata da Alessio col tablet il 21/08 e non da qui.
// Nel blocco A `cosaSiVede` non sapeva niente dello spostamento: durante uno
// spostamento il conto è SEMPRE aperto, quindi rispondeva "conto" e la barra
// col pulsante «Sposta qui» spariva. Si sceglievano i tavoli e non c'era
// nessun modo di confermare.
//
// ⚠️ Le prove di allora non potevano prenderlo: misuravano cosa resta
// SELEZIONATO, nessuna misurava cosa COMPARE. Queste interrogano `cosaSiVede`
// con `spostando` acceso, che è precisamente il buco.
describe("mentre si sposta un conto, la barra per confermare si vede", () => {
  it("🔴 spostando, la vista NON è «conto» — era questa la regressione", () => {
    expect(cosaSiVede({ conto: "c1", selezione: ["T4"], spostando: true })).not.toBe("conto");
  });

  it("...è «spostamento», che è un caso suo", () => {
    expect(cosaSiVede({ conto: "c1", selezione: ["T4"], spostando: true })).toBe("spostamento");
  });

  it("🔴 e la barra dei tavoli si vede: senza, non si può confermare", () => {
    const vista = cosaSiVede({ conto: "c1", selezione: ["T4"], spostando: true });
    expect(siVedeLaBarraDeiTavoli(vista)).toBe(true);
  });

  it("si vede anche quando si sceglie dove APRIRE un conto", () => {
    expect(siVedeLaBarraDeiTavoli(cosaSiVede({ conto: null, selezione: ["T4"] }))).toBe(true);
  });

  it("...e NON si vede col conto aperto senza spostare: è il difetto dei due pannelli", () => {
    expect(siVedeLaBarraDeiTavoli(cosaSiVede({ conto: "c1", selezione: ["T5"] }))).toBe(false);
  });

  it("...né sulla sala vuota", () => {
    expect(siVedeLaBarraDeiTavoli(cosaSiVede({}))).toBe(false);
  });

  it("spostando vince anche prima che sia stato scelto un tavolo", () => {
    // Si entra in «cambia tavoli» e la selezione è ancora vuota: la barra
    // deve poter comparire appena si tocca il primo tavolo, non dopo.
    expect(cosaSiVede({ conto: "c1", selezione: [], spostando: true })).toBe("spostamento");
  });
});
