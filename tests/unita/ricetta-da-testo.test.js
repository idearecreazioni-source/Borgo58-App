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
      { nome: "olio extravergine", quantita: 0.03, unita: "l" },
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

  it("le conversioni ESATTE sì (ml, cl, dl → l; mg → g), senza rumore di virgola", () => {
    const e = bozzaDaTesto("Prova\nIngredienti\n250 ml latte\n3 dl panna\n5 cl rum\n500 mg sale\n1,5 ml estratto");
    expect(soloGliIngredienti(e)).toEqual([
      { nome: "latte", quantita: 0.25, unita: "l" },
      { nome: "panna", quantita: 0.3, unita: "l" },
      { nome: "rum", quantita: 0.05, unita: "l" },
      { nome: "sale", quantita: 0.5, unita: "g" },
      { nome: "estratto", quantita: 0.0015, unita: "l" },
    ]);
  });

  it("🔴 ciò che non ha un peso esatto resta com'è scritto: cucchiaio, pizzico", () => {
    const e = bozzaDaTesto("Prova\nIngredienti\n2 cucchiai olio\n1 pizzico sale");
    expect(soloGliIngredienti(e)).toEqual([
      { nome: "olio", quantita: 2, unita: "cucchiai" },
      { nome: "sale", quantita: 1, unita: "pizzico" },
    ]);
  });

  it("togliendo «q.b.» in mezzo alla riga non restano due virgole", () => {
    const e = bozzaDaTesto("Prova\nIngredienti\nAcqua fredda, q.b., per ammorbidire la gelatina");
    expect(e.ingredienti[0].nome).toBe("Acqua fredda, per ammorbidire la gelatina");
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

// ── Fase 1D (09/10/2026): robustezza. Testi tutti INVENTATI apposta. ──────
//
// Ogni caso dubbio deve finire VUOTO, come BUCO dichiarato o RIFIUTATO.
// Nessuna di queste prove allarga il lettore: dove una forma non è sicura,
// la risposta giusta è lasciarla incompleta.

const conIngredienti = (...righe) => bozzaDaTesto(`Prova\nIngredienti\n${righe.join("\n")}`);
const buchi = (e) => e.bozza.buchi_dichiarati;

describe("1D · intestazioni ed elenchi", () => {
  it("intestazioni in maiuscolo, con spazi e due punti staccati, e i loro sinonimi", () => {
    for (const [ing, pas] of [
      ["  INGREDIENTI :  ", "PREPARAZIONE"],
      ["ingredienti:", "Istruzioni:"],
      ["Ingredienti occorrenti", "Come si fa"],
      ["Ingredients", "Metodo :"],
    ]) {
      const e = bozzaDaTesto(`Prova\n${ing}\n200 g farina\n${pas}\nImpastare`);
      expect(soloGliIngredienti(e)).toEqual([{ nome: "farina", quantita: 200, unita: "g" }]);
      expect(e.passaggi.map((p) => p.descrizione)).toEqual(["Impastare"]);
      expect(e.non_classificate).toEqual([]);
    }
  });

  it("trattini, pallini, asterischi, numeri e «Passo N» si tolgono, il resto no", () => {
    const e = bozzaDaTesto(
      "Crostata\nIngredienti\n• 200 g farina\n* 100 g burro\n1) 2 uova\n– 50 g zucchero\n" +
        "Procedimento\nPasso 1: Impastare\nStep 2 - Stendere\n3. Infornare"
    );
    expect(soloGliIngredienti(e)).toEqual([
      { nome: "farina", quantita: 200, unita: "g" },
      { nome: "burro", quantita: 100, unita: "g" },
      { nome: "uova", quantita: 2, unita: null },
      { nome: "zucchero", quantita: 50, unita: "g" },
    ]);
    expect(e.passaggi.map((p) => p.descrizione)).toEqual(["Impastare", "Stendere", "Infornare"]);
  });
});

describe("1D · quantità scritte in modo esplicito", () => {
  it("la virgola decimale e le frazioni di cucina", () => {
    const e = conIngredienti("1,5 kg patate", "0,125 kg burro", "3/4 tazza zucchero", "1/3 l latte");
    expect(soloGliIngredienti(e)).toEqual([
      { nome: "patate", quantita: 1.5, unita: "kg" },
      { nome: "burro", quantita: 0.125, unita: "kg" },
      { nome: "zucchero", quantita: 0.75, unita: "tazza" },
      { nome: "latte", quantita: 1 / 3, unita: "l" },
    ]);
    expect(buchi(e)).toEqual([]);
  });

  it("il numero prima o dopo il nome, con o senza i due punti, con l'unità attaccata", () => {
    const e = conIngredienti("farina: 200 g", "burro 50g", "Uova: 3", "200 gr. zucchero", "latte 250 ml");
    expect(soloGliIngredienti(e)).toEqual([
      { nome: "farina", quantita: 200, unita: "g" },
      { nome: "burro", quantita: 50, unita: "g" },
      { nome: "Uova", quantita: 3, unita: null },
      { nome: "zucchero", quantita: 200, unita: "g" },
      { nome: "latte", quantita: 0.25, unita: "l" },
    ]);
  });
});

describe("1D · 🔴 quantità ambigue: vuote, e il buco lo dice", () => {
  it("intervalli con «o», con la lineetta e con gli spazi", () => {
    const e = conIngredienti("1 o 2 cucchiai olio", "2 – 3 carote", "100 - 150 g burro");
    expect(e.ingredienti.every((r) => r.quantita === null && r.unita === null)).toBe(true);
    expect(buchi(e)).toHaveLength(3);
    expect(buchi(e).every((b) => b.includes("intervallo"))).toBe(true);
  });

  it("più numeri, anche quando uno è un numero misto o il tipo della farina", () => {
    const e = conIngredienti("3 uova grandi (circa 180 g)", "1 1/2 tazze latte", "farina 00 500 g");
    expect(e.ingredienti.every((r) => r.quantita === null)).toBe(true);
    expect(buchi(e)).toHaveLength(3);
    expect(buchi(e).every((b) => b.includes("più di un numero"))).toBe(true);
  });

  it("un numero in cifre accanto a uno in lettere sono due numeri", () => {
    const e = conIngredienti("2 uova e un tuorlo");
    expect(e.ingredienti[0]).toMatchObject({ quantita: null, unita: null });
    expect(buchi(e)).toEqual(["«2 uova e un tuorlo»: più di un numero, la quantità va scelta"]);
  });

  it("numeri in lettere e «q.b.» in tutte le grafie", () => {
    const e = conIngredienti("mezzo limone", "una noce di burro", "pepe QB", "quanto basta di sale", "Origano: q. b.");
    expect(soloGliIngredienti(e)).toEqual([
      { nome: "mezzo limone", quantita: null, unita: null },
      { nome: "una noce di burro", quantita: null, unita: null },
      { nome: "pepe", quantita: null, unita: null },
      { nome: "sale", quantita: null, unita: null },
      { nome: "Origano", quantita: null, unita: null },
    ]);
    expect(buchi(e).filter((b) => b.includes("in lettere"))).toHaveLength(2);
    expect(buchi(e).filter((b) => b.includes("q.b."))).toHaveLength(3);
  });

  it("«1.000» e «1,250» si leggono in due modi: non diventano 1 né 1,25", () => {
    const e = conIngredienti("1.000 g farina", "1,250 kg patate");
    expect(e.ingredienti.map((r) => r.quantita)).toEqual([null, null]);
    expect(buchi(e)).toEqual([
      "«1.000 g farina»: «1.000» si legge in due modi, la quantità va riscritta",
      "«1,250 kg patate»: «1,250» si legge in due modi, la quantità va riscritta",
    ]);
  });

  it("una barra che non è una frazione di cucina non si divide", () => {
    const e = conIngredienti("100/150 g burro", "3/2 tazze acqua", "1/0 cipolla");
    expect(e.ingredienti.map((r) => r.quantita)).toEqual([null, null, null]);
    expect(buchi(e)).toHaveLength(3);
    expect(buchi(e).every((b) => b.includes("la quantità non si legge"))).toBe(true);
  });

  it("zero, o un numero che è il tipo della farina, non è una quantità", () => {
    const e = conIngredienti("0 g sale", "farina 00");
    expect(e.ingredienti.map((r) => r.quantita)).toEqual([null, null]);
    expect(buchi(e)).toHaveLength(2);
  });

  it("un numero senza nome non diventa un ingrediente con un nome inventato", () => {
    const e = conIngredienti("200 g");
    expect(e.ingredienti[0]).toMatchObject({ nome: "200 g", quantita: null, unita: null });
    expect(buchi(e)).toEqual(["«200 g»: manca il nome dell'ingrediente"]);
  });
});

describe("1D · porzioni", () => {
  it("le forme sicure", () => {
    for (const [riga, n] of [
      ["Dosi per 6 persone", 6],
      ["Porzioni: 8", 8],
      ["Serve 2", 2],
      ["PER 4 PERSONE", 4],
      ["Per 10 pax", 10],
    ]) {
      expect(bozzaDaTesto(`Prova\n${riga}\nIngredienti\n500 g riso`).bozza.porzioni).toBe(n);
    }
  });

  it("dette due volte uguali valgono; dette in due modi diversi non si sceglie", () => {
    expect(bozzaDaTesto("Prova\nPer 4 persone\nPer 4 persone\nIngredienti\n1 kg riso").bozza.porzioni).toBe(4);
    for (const due of ["Per 4 persone\nPorzioni: 6", "Per 4-6 persone\nPorzioni: 4", "Porzioni: 4\nPer 4-6 persone"]) {
      const e = bozzaDaTesto(`Prova\n${due}\nIngredienti\n1 kg riso`);
      expect(e.bozza.porzioni).toBeNull();
      expect(buchi(e).some((b) => b.startsWith("porzioni"))).toBe(true);
    }
  });

  it("zero porzioni non è un numero di porzioni", () => {
    const e = bozzaDaTesto("Prova\nPer 0 persone\nIngredienti\n1 kg riso");
    expect(e.bozza.porzioni).toBeNull();
    expect(buchi(e)).toContain("porzioni non leggibili («0»)");
  });

  it("tempi, temperature e istruzioni con numeri non diventano porzioni", () => {
    const e = bozzaDaTesto(
      "Riso\nForno a 180 gradi\nPer 30 minuti\nTempo: 40 minuti\nIngredienti\n500 g riso\n" +
        "Procedimento\nPer 2 ore lasciare riposare\nPer 4 persone servire caldo\nCuocere a 180 °C per 25 minuti"
    );
    expect(e.bozza.porzioni).toBeNull();
    expect(e.non_classificate).toEqual(["Forno a 180 gradi", "Per 30 minuti", "Tempo: 40 minuti"]);
    expect(e.passaggi.map((p) => p.descrizione)).toEqual([
      "Per 2 ore lasciare riposare",
      "Per 4 persone servire caldo",
      "Cuocere a 180 °C per 25 minuti",
    ]);
  });
});

describe("1D · titolo", () => {
  it("una riga breve vale; 80 caratteri sì, 81 no", () => {
    expect(bozzaDaTesto(`${"x".repeat(80)}\nIngredienti\n1 kg riso`).bozza.titolo).toBe("x".repeat(80));
    const e = bozzaDaTesto(`${"x".repeat(81)}\nIngredienti\n1 kg riso`);
    expect(e.bozza.titolo).toBeNull();
    expect(e.non_classificate).toEqual(["x".repeat(81)]);
  });

  it("una frase con la punteggiatura finale non è un titolo", () => {
    const e = bozzaDaTesto("Che buona!\nIngredienti\n1 kg riso");
    expect(e.bozza.titolo).toBeNull();
    expect(buchi(e)).toContain("manca il titolo: va scritto a mano");
  });

  it("se la prima riga non è un titolo, la seconda non le ruba il posto", () => {
    const e = bozzaDaTesto(
      "Ciao a tutti, oggi vi propongo una ricetta che faccio sempre la domenica.\nMescolare bene\nIngredienti\n1 kg riso"
    );
    expect(e.bozza.titolo).toBeNull();
    expect(e.non_classificate).toHaveLength(2);
  });

  it("una riga con dentro un indirizzo non diventa titolo, nemmeno mutilata", () => {
    const e = bozzaDaTesto("Vista su https://esempio.invalid/a e poi\nIngredienti\n1 kg riso");
    expect(e.bozza.titolo).toBeNull();
    expect(e.non_classificate).toEqual(["Vista su e poi"]);
  });

  it("con l'intestazione come prima riga il titolo resta vuoto", () => {
    expect(bozzaDaTesto("Ingredienti\n1 kg riso").bozza.titolo).toBeNull();
  });
});

describe("1D · sottotitoli e sezioni mancanti", () => {
  it("i sottotitoli negli ingredienti, in qualunque grafia, non sono ingredienti", () => {
    const e = bozzaDaTesto(
      "Torta\nIngredienti\nPer la base:\n200 g biscotti\nPER LA CREMA:\n250 g mascarpone\nProcedimento\nTritare"
    );
    expect(e.ingredienti.map((r) => r.nome)).toEqual(["biscotti", "mascarpone"]);
    expect(e.non_classificate).toEqual(["Per la base:", "PER LA CREMA:"]);
  });

  it("senza intestazioni nessuna riga diventa ingrediente o passaggio", () => {
    const e = bozzaDaTesto("200 g farina\n100 g zucchero\nmescolare tutto");
    expect(e.ingredienti).toEqual([]);
    expect(e.passaggi).toEqual([]);
    expect(e.bozza.porzioni).toBeNull();
    expect(buchi(e).some((b) => b.includes("intestazioni"))).toBe(true);
  });

  it("una sezione sola: l'altra resta vuota, non si ricava", () => {
    const soloIng = bozzaDaTesto("Pesto\nIngredienti\n50 g basilico");
    expect(soloIng.passaggi).toEqual([]);
    const soloPas = bozzaDaTesto("Pesto\nProcedimento\nFrullare 50 g di basilico");
    expect(soloPas.ingredienti).toEqual([]);
    expect(soloPas.passaggi.map((p) => p.descrizione)).toEqual(["Frullare 50 g di basilico"]);
  });
});

describe("1D · 🔴 indirizzi", () => {
  it("da solo si rifiuta anche in maiuscolo, fra parentesi o fra virgolette", () => {
    for (const t of [
      "HTTPS://ESEMPIO.INVALID/RICETTA",
      "<https://esempio.invalid/x>",
      "(https://esempio.invalid/x)",
      "«www.esempio.invalid/y»",
      "https://esempio.invalid/a,\nwww.esempio.invalid/b.",
    ]) {
      const e = bozzaDaTesto(t);
      expect(e).toMatchObject({ ok: false, motivo: "solo_indirizzo" });
      expect(e.bozza).toBeUndefined();
    }
  });

  it("dentro un testo vero: si conserva il primo, senza la punteggiatura che lo chiude", () => {
    const e = bozzaDaTesto(
      "Torta\n(https://esempio.invalid/torta)\nIngredienti\n200 g farina https://esempio.invalid/c\n" +
        "Procedimento\nVedi www.esempio.invalid/d per il forno"
    );
    expect(e.bozza.origine_riferimento).toBe("https://esempio.invalid/torta");
    expect(e.non_classificate).toEqual([]);
    expect(soloGliIngredienti(e)).toEqual([{ nome: "farina", quantita: 200, unita: "g" }]);
    expect(e.passaggi.map((p) => p.descrizione)).toEqual(["Vedi per il forno"]);
  });
});

describe("1D · 🔴 limiti e tipi", () => {
  it("la lunghezza massima esatta passa, un carattere in più no, gli spazi attorno non contano", () => {
    const giusto = `Prova\n${"a".repeat(LUNGHEZZA_MASSIMA - 6)}`;
    expect(giusto).toHaveLength(LUNGHEZZA_MASSIMA);
    expect(bozzaDaTesto(`  ${giusto}\n\n`).ok).toBe(true);
    expect(bozzaDaTesto(`${giusto}x`)).toMatchObject({ ok: false, motivo: "troppo_lungo" });
  });

  it("altri tipi che non sono testo, compreso un oggetto String", () => {
    for (const t of [true, 0, [], ["Prova"], Object("Prova"), () => "Prova", Symbol("x")]) {
      expect(bozzaDaTesto(t)).toMatchObject({ ok: false, motivo: "non_testo" });
    }
  });
});

describe("1D · ripetibilità", () => {
  const TESTI = [
    RICETTA,
    "Riso\nPer 4-6 persone\nIngredienti\n1.000 g riso\n2 uova e un tuorlo\nsale q.b.",
    "Prova\nhttps://esempio.invalid/a\nIngredienti\n100/150 g burro",
    "solo testo senza sezioni",
  ];

  it("ogni testo dà sempre lo stesso risultato, in qualunque ordine", () => {
    const primi = TESTI.map((t) => JSON.stringify(bozzaDaTesto(t)));
    const rovescio = [...TESTI]
      .reverse()
      .map((t) => JSON.stringify(bozzaDaTesto(t)))
      .reverse();
    expect(rovescio).toEqual(primi);
  });

  it("modificare un risultato non cambia il successivo", () => {
    const a = bozzaDaTesto(RICETTA);
    a.bozza.buchi_dichiarati.push("intruso");
    a.ingredienti[0].quantita = 999;
    const b = bozzaDaTesto(RICETTA);
    expect(b.bozza.buchi_dichiarati).not.toContain("intruso");
    expect(b.ingredienti[0].quantita).toBe(320);
  });
});

describe("1D · 🔴 nessuna strada laterale", () => {
  const CODICE = readFileSync("src/lib/calcoli/ricettaDaTesto.js", "utf8").replace(/^\s*\/\/.*$/gm, "");

  it("il modulo non nomina valutazione di codice, timer, navigazione o globali", () => {
    expect(CODICE).not.toMatch(
      /\b(eval|Function|globalThis|import\.meta|setTimeout|setInterval|navigator|location|Worker|postMessage)\b/
    );
  });

  it("i casi della Fase 1D girano con rete e memoria rese inutilizzabili", () => {
    const NOMI = ["fetch", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage", "indexedDB"];
    const salvati = {};
    const vietato = () => {
      throw new Error("chiamata esterna");
    };
    for (const n of NOMI) {
      if (n in globalThis) salvati[n] = globalThis[n];
      globalThis[n] = new Proxy(vietato, { get: vietato, apply: vietato, construct: vietato });
    }
    try {
      for (const t of [
        "Prova\nIngredienti\n1.000 g farina\n100/150 g burro\n2 uova e un tuorlo",
        "(https://esempio.invalid/x)",
        "Prova\nPer 4 persone\nPorzioni: 6",
      ]) {
        expect(() => bozzaDaTesto(t)).not.toThrow();
      }
    } finally {
      for (const n of NOMI) {
        if (n in salvati) globalThis[n] = salvati[n];
        else delete globalThis[n];
      }
    }
  });
});
