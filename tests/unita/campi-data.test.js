import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SENZA_LARGHEZZA_NOTE,
  caselleDelFile,
  caselleSenzaLarghezza,
  contaPerFile,
  cresciuti,
  larghezzaDichiarata,
  senzaCommenti,
  tagDa,
} from "../../scripts/campi-data.mjs";

// =====================================================================
// LE CASELLE DI DATA E ORA — 21/09/2026, mandato «interfaccia operativa»
// =====================================================================
// 🔴 COSA SI PROVA, in quest'ordine: prima che il METRO sia giusto, poi che
//    il numero non cresca. L'ordine non e' casuale — questo setaccio ha dato
//    tre risposte diverse e sbagliate prima di darne una giusta, e ognuna
//    sembrava plausibile:
//      · 68 su 68 malate  (il «>» di `onChange={(e) => …}` chiudeva il tag)
//      ·  ~10 su 24       (svuotando le stringhe spariva anche `type="date"`)
//      ·  27 su 67        (`min-w-0` contava come larghezza dichiarata)
//      ·  29 su 67        ← misurato, e verificato su righe di risposta nota
//
// ⚠️ E' la regola del 26/08: «un misuratore nuovo si prova prima su un caso
//    di cui si conosce gia' la risposta». Le prove qui sotto SONO quei casi.

describe("🔴 il metro: il ritaglio del tag", () => {
  it("una freccia `=>` dentro un gesto non chiude il tag", () => {
    const testo = `<input type="date" onChange={(e) => f(e)} className="x campo-data" />`;
    expect(tagDa(testo, 0)).toBe(testo);
    expect(larghezzaDichiarata(tagDa(testo, 0), "date")).toBe(true);
  });

  it("senza la classe, la stessa casella risulta senza larghezza", () => {
    const testo = `<input type="date" onChange={(e) => f(e)} className="x" />`;
    expect(larghezzaDichiarata(tagDa(testo, 0), "date")).toBe(false);
  });
});

describe("🔴 il metro: cosa vale come larghezza dichiarata", () => {
  it("la classe misurata vale, per tutti e tre i tipi", () => {
    expect(larghezzaDichiarata('<input type="date" className="campo-data" />', "date")).toBe(true);
    expect(larghezzaDichiarata('<input type="time" className="campo-ora" />', "time")).toBe(true);
    expect(larghezzaDichiarata('<input type="month" className="campo-mese" />', "month")).toBe(true);
  });

  it("vale anche una larghezza scritta a mano, in classe o nello stile", () => {
    expect(larghezzaDichiarata('<input type="date" className="w-40" />', "date")).toBe(true);
    expect(larghezzaDichiarata('<input type="date" className="w-[11rem]" />', "date")).toBe(true);
    // La scheda dell'Agenda ha margini piu' stretti e una misura sua.
    expect(larghezzaDichiarata('<input type="date" style={largoAlmeno(2.6)} />', "date")).toBe(true);
    expect(larghezzaDichiarata('<input type="date" style={{ minWidth: "3cm" }} />', "date")).toBe(true);
  });

  it("🔴 `min-w-0` e `max-w-full` NON valgono: dicono quanto puo' stringersi, non quanto e' larga", () => {
    expect(larghezzaDichiarata('<input type="date" className="min-w-0 max-w-full" />', "date")).toBe(false);
  });

  it("la classe dev'essere quella del SUO tipo", () => {
    expect(larghezzaDichiarata('<input type="time" className="campo-data" />', "time")).toBe(false);
  });
});

describe("🔴 il metro: i commenti non sono codice", () => {
  it("una frase che PARLA di una casella non e' una casella", () => {
    const testo = [
      "// un <input type=\"date\"> ha una larghezza minima propria",
      '<input type="date" className="campo-data" />',
    ].join("\n");
    const trovate = caselleDelFile("finto.jsx", testo);
    expect(trovate).toHaveLength(1);
    expect(trovate[0].riga).toBe(2);
  });

  it("vale anche per i commenti a blocco e per quelli dentro il JSX", () => {
    const testo = ['{/* <input type="time" /> */}', '/* <input type="month" /> */', "const x = 1;"].join("\n");
    expect(caselleDelFile("finto.jsx", testo)).toHaveLength(0);
  });

  it("⚠️ un indirizzo dentro una stringa non e' un commento", () => {
    // Le due barre di «https://» prese per commento cancellerebbero il resto
    // della riga — compresa la casella che viene dopo.
    const testo = 'const u = "https://esempio.it"; <input type="date" className="campo-data" />';
    const pulito = senzaCommenti(testo);
    expect(pulito).toContain('type="date"');
    expect(caselleDelFile("finto.jsx", testo)).toHaveLength(1);
  });

  it("le righe restano quelle vere anche dopo aver tolto i commenti", () => {
    const testo = ["/* prima", "  seconda", "  terza */", '<input type="date" />'].join("\n");
    expect(senzaCommenti(testo).split("\n")).toHaveLength(4);
    expect(caselleDelFile("finto.jsx", testo)[0].riga).toBe(4);
  });
});

describe("🔴 la rete: il difetto non cresce", () => {
  const file = execSync('git ls-files "src/**/*.jsx"', { encoding: "utf8" }).trim().split(/\r?\n/);
  const senza = caselleSenzaLarghezza(file, (f) => readFileSync(f, "utf8"));
  const perFile = contaPerFile(senza);

  it("nessun file ne ha piu' di quante lo stato di partenza ne ammetta", () => {
    expect(cresciuti(perFile).join("\n")).toBe("");
  });

  it("🔴 nelle schermate del mandato non ne resta nessuna", () => {
    // Agenda, Sala (la pianta del Calendario), Comande, Cassa e la schermata
    // iniziale: qui il mandato del 21/09 le ha chiuse tutte.
    const dentro = senza.filter((c) =>
      /^src\/pages\/(agenda|comande|cassa)\/|^src\/pages\/Dashboard|^src\/pages\/calendario\/PiantaGiornata|^src\/components\/CampoGiornata/.test(c.file),
    );
    expect(dentro.map((c) => `${c.file}:${c.riga}`)).toEqual([]);
  });

  it("⚠️ lo stato di partenza non contiene file che non esistono piu'", () => {
    // Un elenco congelato che nomina un file sparito perdona una casella che
    // non c'e' — e nasconde di essere invecchiato.
    const mancanti = Object.keys(SENZA_LARGHEZZA_NOTE).filter((f) => !file.includes(f));
    expect(mancanti).toEqual([]);
  });
});
