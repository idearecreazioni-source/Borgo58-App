import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { LUNGHEZZA_MASSIMA, bozzaDaTesto } from "../../src/lib/calcoli/ricettaDaTesto";

// UNA BOZZA DA UN TESTO INCOLLATO — il nucleo offline (Fase 1B, 07/10/2026).
//
// ⚠️ I testi qui sotto sono INVENTATI apposta: nessun contenuto preso da
//    Clove, da un social o da una pagina vera.

const RICETTA = `Pasta al pomodoro

Per 4 persone

Ingredienti
- 320 g di spaghetti
- 400g pomodori pelati
- olio extravergine 30 ml
- 2 spicchi d'aglio
- sale q.b.
- 1/2 cipolla

Procedimento
1. Scaldare l'olio in una padella.
2. Aggiungere i pomodori e cuocere.
3. Scolare la pasta e condire.`;

const soloGliIngredienti = (esito) =>
  esito.ingredienti.map(({ nome, quantita, unita }) => ({ nome, quantita, unita }));

describe("estrae ciò che è scritto, e solo quello", () => {
  it("titolo, porzioni, ingredienti e passaggi dichiarati chiaramente", () => {
    const e = bozzaDaTesto(RICETTA);
    expect(e.ok).toBe(true);
    expect(e.bozza.titolo).toBe("Pasta al pomodoro");
    expect(e.bozza.porzioni).toBe(4);
    expect(e.bozza.origine_tipo).toBe("testo");
    expect(soloGliIngredienti(e)).toEqual([
      { nome: "spaghetti", quantita: 320, unita: "g" },
      { nome: "pomodori pelati", quantita: 400, unita: "g" },
      { nome: "olio extravergine", quantita: 30, unita: "ml" },
      { nome: "aglio", quantita: 2, unita: "spicchi" },
      { nome: "sale", quantita: null, unita: null },
      { nome: "cipolla", quantita: 0.5, unita: null },
    ]);
    expect(e.passaggi).toEqual([
      { posizione: 1, fase: null, descrizione: "Scaldare l'olio in una padella." },
      { posizione: 2, fase: null, descrizione: "Aggiungere i pomodori e cuocere." },
      { posizione: 3, fase: null, descrizione: "Scolare la pasta e condire." },
    ]);
    expect(e.ingredienti[0].testo_originale).toBe("- 320 g di spaghetti");
    expect(e.ingredienti.every((r) => r.ingredient_id === null)).toBe(true);
  });

  it("i campi sono quelli delle tabelle delle bozze, e niente è indovinato", () => {
    const e = bozzaDaTesto(RICETTA);
    expect(Object.keys(e.bozza).sort()).toEqual(
      ["buchi_dichiarati", "categoria", "origine_riferimento", "origine_tipo", "porzioni", "sunto", "titolo"].sort()
    );
    expect(e.bozza.categoria).toBeNull();
    expect(e.bozza.sunto).toBeNull();
    expect(e.passaggi.every((p) => p.fase === null)).toBe(true);
  });

  it("si usano le intestazioni anche con i due punti e senza elenco puntato", () => {
    const e = bozzaDaTesto("Frittata\nIngredienti:\n3 uova\nProcedimento:\nSbattere le uova");
    expect(soloGliIngredienti(e)).toEqual([{ nome: "uova", quantita: 3, unita: null }]);
    expect(e.passaggi.map((p) => p.descrizione)).toEqual(["Sbattere le uova"]);
  });

  it("un link dentro un testo vero si conserva, non si visita e non diventa una riga", () => {
    const e = bozzaDaTesto(`Torta\nhttps://esempio.invalid/torta\nIngredienti\n200 g zucchero`);
    expect(e.bozza.origine_riferimento).toBe("https://esempio.invalid/torta");
    expect(e.non_classificate).toEqual([]);
  });
});

describe("🔴 nessuna invenzione quando manca qualcosa", () => {
  it("un numero senza unità resta senza unità (non diventa «pz»)", () => {
    const e = bozzaDaTesto("Prova\nIngredienti\n2 uova\nuova 2");
    expect(soloGliIngredienti(e)).toEqual([
      { nome: "uova", quantita: 2, unita: null },
      { nome: "uova", quantita: 2, unita: null },
    ]);
  });

  it("un ingrediente senza numero resta senza quantità (non diventa zero)", () => {
    const e = bozzaDaTesto("Prova\nIngredienti\nprezzemolo");
    expect(soloGliIngredienti(e)).toEqual([{ nome: "prezzemolo", quantita: null, unita: null }]);
  });

  it("un'unità diversa non si converte: «ml» resta «ml»", () => {
    const e = bozzaDaTesto("Prova\nIngredienti\n250 ml latte");
    expect(soloGliIngredienti(e)).toEqual([{ nome: "latte", quantita: 250, unita: "ml" }]);
  });

  it("i sinonimi dello stesso codice sì, e solo quelli", () => {
    const e = bozzaDaTesto("Prova\nIngredienti\n1 chilo farina\n200 grammi burro\n1 litro brodo");
    expect(soloGliIngredienti(e).map((r) => r.unita)).toEqual(["kg", "g", "l"]);
  });

  it("niente titolo, niente porzioni, niente sezioni: vuoti e dichiarati", () => {
    const e = bozzaDaTesto("Si fa rosolare la cipolla e poi si aggiunge il riso, mescolando spesso.");
    expect(e.ok).toBe(true);
    expect(e.bozza.titolo).toBeNull();
    expect(e.bozza.porzioni).toBeNull();
    expect(e.ingredienti).toEqual([]);
    expect(e.passaggi).toEqual([]);
    expect(e.bozza.buchi_dichiarati).toContain("manca il titolo: va scritto a mano");
    expect(e.bozza.buchi_dichiarati.some((b) => b.includes("intestazioni"))).toBe(true);
  });

  it("una riga di passaggio con un numero non diventa porzioni", () => {
    const e = bozzaDaTesto("Prova\nProcedimento\nPer 10 minuti cuocere a fuoco basso");
    expect(e.bozza.porzioni).toBeNull();
    expect(e.passaggi.map((p) => p.descrizione)).toEqual(["Per 10 minuti cuocere a fuoco basso"]);
  });
});

describe("🔴 l'ambiguo diventa un buco", () => {
  const buchiDi = (riga) => bozzaDaTesto(`Prova\nIngredienti\n${riga}`);

  it("«q.b.»", () => {
    const e = buchiDi("sale q.b.");
    expect(e.ingredienti[0]).toMatchObject({ nome: "sale", quantita: null, unita: null, nota: "q.b." });
    expect(e.bozza.buchi_dichiarati).toContain("«sale»: «q.b.» non è una quantità");
  });

  it("un intervallo", () => {
    const e = buchiDi("2-3 patate");
    expect(e.ingredienti[0].quantita).toBeNull();
    expect(e.bozza.buchi_dichiarati).toContain("«2-3 patate»: la quantità è un intervallo, va scelta");
  });

  it("due numeri", () => {
    const e = buchiDi("2 confezioni da 125 g di mozzarella");
    expect(e.ingredienti[0].quantita).toBeNull();
    expect(e.bozza.buchi_dichiarati[0]).toMatch(/più di un numero/);
  });

  it("un numero in lettere", () => {
    const e = buchiDi("due uova");
    expect(e.ingredienti[0].quantita).toBeNull();
    expect(e.bozza.buchi_dichiarati[0]).toMatch(/in lettere/);
  });

  it("le porzioni come intervallo", () => {
    const e = bozzaDaTesto("Prova\nPer 4-6 persone\nIngredienti\n100 g riso");
    expect(e.bozza.porzioni).toBeNull();
    expect(e.bozza.buchi_dichiarati[0]).toMatch(/porzioni indicate come intervallo/);
  });

  it("un sottotitolo dentro gli ingredienti non diventa un ingrediente", () => {
    const e = bozzaDaTesto("Prova\nIngredienti\nPer la crema:\n100 g zucchero");
    expect(e.ingredienti.map((r) => r.nome)).toEqual(["zucchero"]);
    expect(e.non_classificate).toEqual(["Per la crema:"]);
    expect(e.bozza.buchi_dichiarati).toContain("1 righe fuori da ogni sezione, da rivedere");
  });
});

describe("🔴 cosa si rifiuta", () => {
  it("un testo vuoto, o di soli spazi", () => {
    for (const t of ["", "   ", "\n\n\t"]) {
      expect(bozzaDaTesto(t)).toMatchObject({ ok: false, motivo: "vuoto" });
    }
  });

  it("un solo indirizzo, anche con spazi attorno o senza «https»", () => {
    for (const t of ["https://esempio.invalid/ricetta", "  www.esempio.invalid/x  \n", "http://a.invalid https://b.invalid"]) {
      const e = bozzaDaTesto(t);
      expect(e).toMatchObject({ ok: false, motivo: "solo_indirizzo" });
      expect(e.bozza).toBeUndefined();
    }
  });

  it("qualcosa che non è testo", () => {
    for (const t of [null, undefined, 42, { testo: "x" }]) {
      expect(bozzaDaTesto(t)).toMatchObject({ ok: false, motivo: "non_testo" });
    }
  });

  it("un testo troppo lungo", () => {
    expect(bozzaDaTesto("a".repeat(LUNGHEZZA_MASSIMA + 1))).toMatchObject({ ok: false, motivo: "troppo_lungo" });
  });
});

describe("stesso testo, stesso risultato", () => {
  it("è deterministico, anche ripetuto e con altri testi in mezzo", () => {
    const primo = JSON.stringify(bozzaDaTesto(RICETTA));
    bozzaDaTesto("Altro\nIngredienti\n1 kg farina");
    expect(JSON.stringify(bozzaDaTesto(RICETTA))).toBe(primo);
    expect(JSON.stringify(bozzaDaTesto(RICETTA.replace(/\n/g, "\r\n")))).toBe(primo);
  });
});

describe("🔴 nessuna chiamata esterna, nessuna persistenza", () => {
  const SORGENTE = readFileSync("src/lib/calcoli/ricettaDaTesto.js", "utf8");
  const CODICE = SORGENTE.replace(/^\s*\/\/.*$/gm, "");
  const salvati = {};
  const NOMI = ["fetch", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage", "indexedDB"];

  afterEach(() => {
    for (const n of NOMI) {
      if (n in salvati) globalThis[n] = salvati[n];
      else delete globalThis[n];
    }
  });

  it("il modulo non importa niente e non nomina rete, disco, memoria o ambiente", () => {
    expect(CODICE).not.toMatch(/^\s*import\b|\brequire\(|\bimport\(/m);
    expect(CODICE).not.toMatch(
      /\b(fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|process|Date|Math\.random|crypto|supabase|document|window)\b/
    );
  });

  it("e funziona anche con rete e memoria rese inutilizzabili", () => {
    const vietato = () => {
      throw new Error("chiamata esterna");
    };
    for (const n of NOMI) {
      if (n in globalThis) salvati[n] = globalThis[n];
      globalThis[n] = new Proxy(vietato, { get: vietato, apply: vietato, construct: vietato });
    }
    const e = bozzaDaTesto(RICETTA);
    expect(e.ok).toBe(true);
    expect(e.ingredienti).toHaveLength(6);
  });
});
