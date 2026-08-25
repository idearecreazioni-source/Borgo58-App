import { describe, it, expect } from "vitest";
import { toccaSubito, toccaTutteSubito, togliSubito } from "../../src/lib/calcoli/tocco.js";

// IL TOCCO CHE NON ASPETTA IL DATABASE — prove del 25/08/2026.
//
// ⚠️ LA PROVA CHE VALE E' LA SECONDA, non la prima. Che una riga cambi
// quando tutto va bene lo si vede a occhio in mezzo secondo di collaudo;
// che torni indietro quando il salvataggio fallisce non lo vede nessuno,
// perche' per vederlo bisognerebbe rompere la rete davanti allo scaffale.
//
// 🔴 E NON E' UN'IPOTESI: il 25/08 la prima controprova fatta nel browser
// vero **non ha provato niente** — avevo rotto `window.fetch`, ma il
// collegamento al database ne aveva gia' preso una copia sua, quindi il
// salvataggio e' riuscito lo stesso. Me ne sono accorto solo chiedendo al
// database com'era finita la riga, invece di fidarmi di quello che
// mostrava lo schermo.

const RIGHE = [
  { id: "a", articolo: "Scottex", nel_carrello: false },
  { id: "b", articolo: "Carta forno", nel_carrello: false },
];

// Piccolo simulatore della schermata: tiene l'elenco e l'ultimo avviso.
function schermata(iniziali) {
  let righe = iniziali;
  let avviso = null;
  return {
    get righe() { return righe; },
    get avviso() { return avviso; },
    mostra: (x) => { righe = typeof x === "function" ? x(righe) : x; },
    avvisa: (m) => { avviso = m; },
  };
}

describe("toccaSubito", () => {
  it("cambia la riga PRIMA che il salvataggio sia finito", async () => {
    const s = schermata(RIGHE);
    let salvato = false;
    const fine = toccaSubito({
      righe: s.righe, id: "a", cambio: { nel_carrello: true },
      mostra: s.mostra, avvisa: s.avvisa,
      salva: () => new Promise((ok) => setTimeout(() => { salvato = true; ok(); }, 30)),
    });
    // ⚠️ QUI STA IL PUNTO: si guarda l'elenco mentre il salvataggio e'
    // ancora in volo. Se il cambio arrivasse dopo, questa riga fallirebbe.
    expect(s.righe.find((r) => r.id === "a").nel_carrello).toBe(true);
    expect(salvato).toBe(false);
    await fine;
    expect(salvato).toBe(true);
    expect(s.avviso).toBe("");
  });

  it("rimette la riga com'era se il salvataggio fallisce, e lo dice", async () => {
    const s = schermata(RIGHE);
    const ok = await toccaSubito({
      righe: s.righe, id: "a", cambio: { nel_carrello: true },
      mostra: s.mostra, avvisa: s.avvisa,
      salva: () => Promise.reject(new Error("rete assente")),
    });
    expect(ok).toBe(false);
    expect(s.righe.find((r) => r.id === "a").nel_carrello).toBe(false);
    // Il messaggio nomina la riga: su un elenco dove si tocca una cosa
    // dopo l'altra camminando, un «non salvato» generico non dice quale.
    expect(s.avviso).toContain("Scottex");
    expect(s.avviso).toContain("rete assente");
  });

  it("il ritorno indietro non cancella le righe toccate nel frattempo", async () => {
    // ⚠️ IL CASO VERO DI CHI CAMMINA: si tocca «Scottex», la rete e' lenta,
    // si tocca «Carta forno» mentre il primo e' ancora in volo, e poi il
    // primo fallisce. Se il ritorno indietro ripartisse dalla fotografia
    // di prima, si porterebbe via anche il secondo tocco.
    const s = schermata(RIGHE);
    let rompi;
    const primo = toccaSubito({
      righe: s.righe, id: "a", cambio: { nel_carrello: true },
      mostra: s.mostra, avvisa: s.avvisa,
      salva: () => new Promise((_, no) => { rompi = () => no(new Error("caduta")); }),
    });
    await toccaSubito({
      righe: s.righe, id: "b", cambio: { nel_carrello: true },
      mostra: s.mostra, avvisa: s.avvisa, salva: () => Promise.resolve(),
    });
    rompi();
    await primo;
    expect(s.righe.find((r) => r.id === "a").nel_carrello).toBe(false); // tornata indietro
    expect(s.righe.find((r) => r.id === "b").nel_carrello).toBe(true);  // rimasta
  });

  it("una riga che non c'e' non si finge cambiata", async () => {
    const s = schermata(RIGHE);
    let chiamato = false;
    const ok = await toccaSubito({
      righe: s.righe, id: "non-esiste", cambio: { nel_carrello: true },
      mostra: s.mostra, avvisa: s.avvisa,
      salva: () => { chiamato = true; return Promise.resolve(); },
    });
    expect(ok).toBe(false);
    expect(chiamato).toBe(false);
    expect(s.righe).toEqual(RIGHE);
  });

  it("conserva solo la colonna toccata, non la riga intera", async () => {
    // Se fra il tocco e il fallimento un'altra colonna della STESSA riga
    // fosse cambiata, rimettere la riga intera se la porterebbe via.
    const s = schermata([{ id: "a", articolo: "Scottex", nel_carrello: false, nota: null }]);
    let rompi;
    const p = toccaSubito({
      righe: s.righe, id: "a", cambio: { nel_carrello: true },
      mostra: s.mostra, avvisa: s.avvisa,
      salva: () => new Promise((_, no) => { rompi = () => no(new Error("caduta")); }),
    });
    s.mostra(s.righe.map((r) => ({ ...r, nota: "2 rotoli" })));
    rompi();
    await p;
    expect(s.righe[0].nel_carrello).toBe(false);   // tornata indietro
    expect(s.righe[0].nota).toBe("2 rotoli");      // NON riportata indietro
  });
});

describe("togliSubito", () => {
  const ELENCO = [
    { id: "a", titolo: "Pagare fattura" },
    { id: "b", titolo: "Chiamare Laura" },
    { id: "c", titolo: "Ordinare vini" },
  ];

  it("toglie la riga PRIMA che il salvataggio sia finito", async () => {
    const s = schermata(ELENCO);
    let salvato = false;
    const fine = togliSubito({
      righe: s.righe, id: "b", mostra: s.mostra, avvisa: s.avvisa,
      salva: () => new Promise((ok) => setTimeout(() => { salvato = true; ok("nuovo"); }, 30)),
    });
    expect(s.righe.map((r) => r.id)).toEqual(["a", "c"]);
    expect(salvato).toBe(false);
    expect(await fine).toEqual({ ok: true, esito: "nuovo" });   // l'esito arriva a chi deve dirlo
  });

  it("rimette la riga AL SUO POSTO se il salvataggio fallisce", async () => {
    // ⚠️ Al suo posto, non in fondo: in un elenco ordinato per scadenza un
    // impegno che riappare in coda sembra un impegno diverso.
    const s = schermata(ELENCO);
    const esito = await togliSubito({
      righe: s.righe, id: "b", mostra: s.mostra, avvisa: s.avvisa,
      salva: () => Promise.reject(new Error("rete assente")),
    });
    expect(esito).toEqual({ ok: false, esito: undefined });
    expect(s.righe.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(s.avviso).toContain("Chiamare Laura");
  });

  it("non rimette la riga due volte se nel frattempo è già tornata", async () => {
    const s = schermata(ELENCO);
    let rompi;
    const p = togliSubito({
      righe: s.righe, id: "b", mostra: s.mostra, avvisa: s.avvisa,
      salva: () => new Promise((_, no) => { rompi = () => no(new Error("caduta")); }),
    });
    s.mostra(ELENCO);          // un ricarico l'ha già rimessa
    rompi();
    await p;
    expect(s.righe.filter((r) => r.id === "b").length).toBe(1);
  });
});

// ⚠️ LA DISTINZIONE CHE VALE LA RIGA IN PIÙ: «riuscito ma non c'era niente
// da dire» e «fallito» devono essere due risposte diverse. Se l'esito
// fosse nudo, un impegno completato senza ricorrenza sarebbe
// indistinguibile da un salvataggio andato male — e la schermata
// rimetterebbe indietro una riga che invece è stata salvata.
describe("togliSubito: riuscito-ma-vuoto non è fallito", () => {
  it("distingue un esito vuoto da un fallimento", async () => {
    const s = schermata([{ id: "a", titolo: "Pagare fattura" }]);
    const r = await togliSubito({
      righe: s.righe, id: "a", mostra: s.mostra, avvisa: s.avvisa,
      salva: () => Promise.resolve(null),   // riuscito, nessun successore
    });
    expect(r.ok).toBe(true);
    expect(r.esito).toBe(null);
    expect(s.righe).toEqual([]);            // resta tolta
    expect(s.avviso).toBe("");
  });
});

describe("toccaTutteSubito", () => {
  const TICKET = [
    { id: "a", articolo: "Spritz", prepared_at: null },
    { id: "b", articolo: "Negroni", prepared_at: "2026-08-25T10:00:00Z" },
    { id: "c", articolo: "Caffè", prepared_at: null },
  ];

  it("cambia tutte le righe del ticket con UN solo salvataggio", async () => {
    const s = schermata(TICKET);
    let chiamate = 0;
    const fine = toccaTutteSubito({
      righe: s.righe, ids: ["a", "b"], cambio: { prepared_at: "adesso" },
      mostra: s.mostra, avvisa: s.avvisa,
      salva: () => { chiamate += 1; return new Promise((ok) => setTimeout(ok, 20)); },
    });
    // Cambiate subito, e solo quelle del ticket.
    expect(s.righe.map((r) => r.prepared_at)).toEqual(["adesso", "adesso", null]);
    await fine;
    expect(chiamate, "un ticket = una richiesta, non una per riga").toBe(1);
  });

  it("se fallisce tornano indietro TUTTE, ognuna al suo valore di partenza", async () => {
    // ⚠️ IL PUNTO: dentro un ticket le righe possono essere in stati
    // diversi. Rimetterle tutte allo stesso valore inventerebbe uno stato
    // che non c'era mai stato.
    const s = schermata(TICKET);
    const ok = await toccaTutteSubito({
      righe: s.righe, ids: ["a", "b"], cambio: { prepared_at: "adesso" },
      mostra: s.mostra, avvisa: s.avvisa,
      salva: () => Promise.reject(new Error("rete assente")),
    });
    expect(ok).toBe(false);
    expect(s.righe.map((r) => r.prepared_at)).toEqual([null, "2026-08-25T10:00:00Z", null]);
    expect(s.avviso).toContain("Spritz");
  });

  it("un ticket che non c'e' piu' non si finge cambiato", async () => {
    const s = schermata(TICKET);
    let chiamato = false;
    const ok = await toccaTutteSubito({
      righe: s.righe, ids: ["zzz"], cambio: { prepared_at: "adesso" },
      mostra: s.mostra, avvisa: s.avvisa,
      salva: () => { chiamato = true; return Promise.resolve(); },
    });
    expect(ok).toBe(false);
    expect(chiamato).toBe(false);
    expect(s.righe).toEqual(TICKET);
  });
});
