import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 🔴 LA DOPPIA DECODIFICA NELLA LETTURA DEI DOCUMENTI — 02/09/2026.
//
// Trovato dal primo giro di CodeQL su `master` (`js/double-escaping`, #6 e
// #7). La catena che ripulisce il testo di un `.odt`/`.docx` decodificava
// `&amp;` **per primo**, quindi un documento che contiene scritto
// `&amp;lt;` — cioè il testo letterale `&lt;` — usciva come `<`.
//
// ⚠️ NON è un difetto di sicurezza: quel testo non finisce mai dentro una
// pagina. È un difetto di **trascrizione**, ed è quello che conta: su quel
// testo l'assistente risponde a domande su contratti e fatture, e il 12/08 è
// stato deciso che dev'essere una trascrizione esatta.
//
// ---------------------------------------------------------------------
// 🔴 PERCHÉ QUESTA PROVA LEGGE I FILE INVECE DI RICOPIARE LA CATENA
// ---------------------------------------------------------------------
// Le funzioni online sono in Deno e ognuna è autonoma: non si possono
// importare da qui. La strada facile sarebbe **ricopiare** la catena dentro
// la prova — e sarebbe una prova che non prova niente: resterebbe verde
// anche se qualcuno rimettesse l'ordine sbagliato nel file vero.
//
// Quindi la catena si **estrae dal sorgente** e si esegue. Se il file cambia
// in modo che l'estrazione non riesca più, la prova **fallisce** invece di
// tacere — vedi la prima verifica di ogni blocco.

const FILE = [
  "supabase/functions/documento-leggi/index.ts",
  "supabase/functions/posta-leggi/index.ts",
];

/**
 * Prende la catena di `.replace(...)` vera dal sorgente e la rende
 * eseguibile. Va da `.decode(contenuto)` fino a `.trim()` escluso.
 */
function catenaVera(percorso) {
  const sorgente = readFileSync(percorso, "utf8").replace(/\r\n/g, "\n");
  const dopoDecode = sorgente.indexOf(".decode(contenuto)");
  if (dopoDecode < 0) return null;
  const finoATrim = sorgente.indexOf(".trim()", dopoDecode);
  if (finoATrim < 0) return null;

  const pezzo = sorgente.slice(dopoDecode + ".decode(contenuto)".length, finoATrim);
  // Via i commenti: restano solo i `.replace(...)`.
  const soloCodice = pezzo.replace(/^\s*\/\/[^\n]*$/gm, "");
  if (!soloCodice.includes(".replace(")) return null;

  // eslint-disable-next-line no-new-func
  return new Function("t", `return t${soloCodice};`);
}

describe("la catena si estrae davvero dai file", () => {
  for (const f of FILE) {
    it(`${f} — la catena è leggibile ed eseguibile`, () => {
      // 🔴 Se questa fallisce, le prove qui sotto NON stanno provando il
      //    codice vero: è la guardia che impedisce a questo file di
      //    diventare verde per il motivo sbagliato.
      const pulisci = catenaVera(f);
      expect(pulisci).not.toBeNull();
      expect(pulisci("niente da fare")).toBe("niente da fare");
    });
  }

  it("i due file hanno la STESSA catena", () => {
    // ⚠️ Sono due copie della stessa regola in due funzioni autonome: possono
    //    divergere, e a divergere sarebbe quella toccata meno. Questa prova
    //    diventa rossa il giorno che qualcuno corregge un file solo.
    const [a, b] = FILE.map((f) =>
      readFileSync(f, "utf8")
        .replace(/\r\n/g, "\n")
        .match(/\.replace\(\/&[a-z]+;\/g[^\n]*/g)
        ?.join("\n"),
    );
    expect(a).toBeDefined();
    expect(a).toBe(b);
  });
});

describe("🔴 la decodifica dei simboli, sul codice vero", () => {
  for (const f of FILE) {
    describe(f, () => {
      const pulisci = catenaVera(f);

      it("il caso semplice: un simbolo scritto in codice torna simbolo", () => {
        expect(pulisci("<w:p>Prezzo &lt; 10 euro</w:p>").trim()).toBe(
          "Prezzo < 10 euro",
        );
        expect(pulisci("<w:p>a &gt; b</w:p>").trim()).toBe("a > b");
        expect(pulisci("<w:p>Ditta A &amp; B</w:p>").trim()).toBe("Ditta A & B");
        expect(pulisci("<w:p>&quot;citato&quot;</w:p>").trim()).toBe('"citato"');
        expect(pulisci("<w:p>l&apos;olio</w:p>").trim()).toBe("l'olio");
      });

      it("🔴 il caso annidato NON si sovracorregge", () => {
        // È il difetto. `&amp;lt;` nel documento significa: il testo
        // letterale `&lt;`. Deve restare `&lt;`, non diventare `<`.
        expect(pulisci("<w:p>Scrivi &amp;lt; per il minore</w:p>").trim()).toBe(
          "Scrivi &lt; per il minore",
        );
        expect(pulisci("<w:p>Ditta A &amp;amp; B</w:p>").trim()).toBe(
          "Ditta A &amp; B",
        );
        expect(pulisci("<w:p>&amp;quot;</w:p>").trim()).toBe("&quot;");
      });

      it("e il doppio annidamento regge un giro in più", () => {
        // `&amp;amp;lt;` = il testo letterale `&amp;lt;`.
        expect(pulisci("<w:p>&amp;amp;lt;</w:p>").trim()).toBe("&amp;lt;");
      });

      it("le due cose insieme, nella stessa riga", () => {
        // ⚠️ Il caso che discrimina davvero: se la decodifica fosse ancora
        //    nell'ordine sbagliato, il primo pezzo verrebbe giusto e il
        //    secondo no — e una prova che guardasse solo il primo passerebbe.
        expect(
          pulisci("<w:p>Vero &lt; e scritto &amp;lt; insieme</w:p>").trim(),
        ).toBe("Vero < e scritto &lt; insieme");
      });

      it("la ripulitura dei tag continua a funzionare", () => {
        expect(pulisci("<w:p>uno</w:p><w:p>due</w:p>").trim()).toBe("uno\ndue");
        expect(pulisci("<text:p>abc</text:p>").trim()).toBe("abc");
      });
    });
  }
});
