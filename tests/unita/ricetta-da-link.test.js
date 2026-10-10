import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  indirizzoAmmesso,
  ricettaDallaPagina,
  titoloSenzaCoda,
} from "../../supabase/functions/ricetta-da-link/lettura";
import { bozzaDaRicettaLetta, porzioniDaTesto, testoDellaRicetta } from "../../src/lib/calcoli/ricettaDaLink";

// =====================================================================
// LA RICETTA DA UN LINK — 10/10/2026
// =====================================================================
// ⚠️ Le pagine qui sotto sono INVENTATE: niente contenuto preso da Clove o
//    da una pagina vera. Hanno la forma che una pagina di Clove ha davvero
//    (misurata il 10/10/2026: un blocco ld+json con un oggetto Recipe,
//    ingredienti come righe di testo, passaggi come HowToStep).

const pagina = (dato) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(dato)}</script></head><body>…</body></html>`;

const RICETTA = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Crema di prova Recipe (with video) | Clove",
  recipeYield: "4 servings",
  recipeIngredient: ["200 ml latte intero", " Zucchero, q.b.", "2-3 tuorli", "1 pizzico sale"],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Scalda il latte." },
    { "@type": "HowToStep", text: "Unisci i tuorli &amp; mescola." },
  ],
  video: { "@type": "VideoObject", contentUrl: "https://esempio.invalid/video.mp4" },
};

describe("quale link si apre", () => {
  it("Clove sì, e i parametri di tracciamento vanno via", () => {
    expect(indirizzoAmmesso("https://clove.kitchen/recipes/crema-ABC?utm_source=share&utm_medium=more")).toEqual({
      ok: true,
      url: "https://clove.kitchen/recipes/crema-ABC",
    });
  });

  it("🔴 qualunque altro sito no: la funzione gira su un server, e un indirizzo libero la manderebbe dove vuole chiunque", () => {
    for (const u of [
      "https://esempio.invalid/ricetta",
      "https://clove.kitchen.esempio.invalid/r",
      "https://127.0.0.1/r",
      "https://169.254.169.254/latest",
      "https://localhost/r",
    ]) {
      expect(indirizzoAmmesso(u).ok, u).toBe(false);
    }
  });

  it("niente http, niente credenziali o porte dentro il link, niente non-link", () => {
    expect(indirizzoAmmesso("http://clove.kitchen/recipes/x").ok).toBe(false);
    expect(indirizzoAmmesso("https://utente:segreto@clove.kitchen/recipes/x").ok).toBe(false);
    expect(indirizzoAmmesso("https://clove.kitchen:8443/recipes/x").ok).toBe(false);
    expect(indirizzoAmmesso("una ricetta qualsiasi").ok).toBe(false);
    expect(indirizzoAmmesso("").ok).toBe(false);
    expect(indirizzoAmmesso(undefined).ok).toBe(false);
  });
});

describe("cosa si legge dalla pagina", () => {
  it("titolo senza la coda del sito, porzioni, righe e passaggi come sono scritti", () => {
    const e = ricettaDallaPagina(pagina(RICETTA));
    expect(e.ok).toBe(true);
    expect(e.ricetta).toEqual({
      titolo: "Crema di prova",
      porzioni: "4 servings",
      ingredienti: ["200 ml latte intero", "Zucchero, q.b.", "2-3 tuorli", "1 pizzico sale"],
      passaggi: ["Scalda il latte.", "Unisci i tuorli & mescola."],
      video: "https://esempio.invalid/video.mp4",
    });
  });

  it("la ricetta si trova anche dentro @graph, in un elenco, e coi passaggi raggruppati in sezioni", () => {
    const e = ricettaDallaPagina(
      pagina({
        "@graph": [
          { "@type": "WebPage", name: "x" },
          {
            ...RICETTA,
            "@type": ["Recipe", "Thing"],
            recipeInstructions: [
              { "@type": "HowToSection", name: "Base", itemListElement: [{ "@type": "HowToStep", text: "Uno." }] },
              "Due.",
            ],
          },
        ],
      })
    );
    expect(e.ok).toBe(true);
    expect(e.ricetta.passaggi).toEqual(["Uno.", "Due."]);
  });

  it("un blocco malformato non ferma la ricerca nei blocchi successivi", () => {
    const html = `<script type="application/ld+json">{ rotto</script>` + pagina(RICETTA);
    expect(ricettaDallaPagina(html).ok).toBe(true);
  });

  it("🔴 una pagina senza ricetta lo dice, e indica la strada del testo incollato", () => {
    const e = ricettaDallaPagina(pagina({ "@type": "WebPage", name: "Accedi" }));
    expect(e.ok).toBe(false);
    expect(e.messaggio).toMatch(/anteprima da testo/);
    expect(ricettaDallaPagina("").ok).toBe(false);
  });

  it("una ricetta dichiarata ma vuota non si importa", () => {
    const e = ricettaDallaPagina(pagina({ "@type": "Recipe", name: "Vuota" }));
    expect(e.ok).toBe(false);
  });

  it("🔴 le entità si sciolgono una volta sola: «&amp;lt;» resta «&lt;», e un numero fuori misura non rompe la lettura", () => {
    const e = ricettaDallaPagina(
      pagina({
        ...RICETTA,
        recipeIngredient: ["5 g &amp;lt;sale&amp;gt;", "1 &#9999999999; uovo", "2 &#233;clair"],
      })
    );
    expect(e.ok).toBe(true);
    expect(e.ricetta.ingredienti).toEqual(["5 g &lt;sale&gt;", "1 &#9999999999; uovo", "2 éclair"]);
  });

  it("la coda del titolo: via il sito e «Recipe», ma un titolo che è solo coda resta vuoto", () => {
    expect(titoloSenzaCoda("Pasta e fagioli Recipe | Clove")).toBe("Pasta e fagioli");
    expect(titoloSenzaCoda("Pasta e fagioli")).toBe("Pasta e fagioli");
    expect(titoloSenzaCoda(" | Clove")).toBe(null);
    expect(titoloSenzaCoda(null)).toBe(null);
  });
});

describe("la bozza che ne nasce", () => {
  const letta = ricettaDallaPagina(pagina(RICETTA)).ricetta;
  const b = bozzaDaRicettaLetta(letta, "https://clove.kitchen/recipes/crema-ABC");

  it("origine «link», riferimento al link, porzioni come numero, video nel sunto", () => {
    expect(b.ok).toBe(true);
    expect(b.bozza).toMatchObject({
      titolo: "Crema di prova",
      origine_tipo: "link",
      origine_riferimento: "https://clove.kitchen/recipes/crema-ABC",
      porzioni: 4,
      sunto: "Video originale: https://esempio.invalid/video.mp4",
    });
  });

  it("🔴 le quantità le decide il lettore dell'anteprima: scritte → numero, «q.b.» e intervalli → buchi", () => {
    const [latte, zucchero, tuorli, sale] = b.ingredienti;
    expect([latte.quantita, latte.unita]).toEqual([0.2, "l"]);
    expect(zucchero.quantita).toBe(null);
    expect(tuorli.quantita).toBe(null);
    expect([sale.quantita, sale.unita]).toEqual([1, "pizzico"]);
    expect(b.bozza.buchi_dichiarati.join(" | ")).toMatch(/q\.b\./);
    expect(b.bozza.buchi_dichiarati.join(" | ")).toMatch(/intervallo/);
    expect(b.passaggi.map((p) => p.descrizione)).toEqual(["Scalda il latte.", "Unisci i tuorli & mescola."]);
    expect(b.non_classificate).toEqual([]);
  });

  it("⚠️ nessun ingrediente arriva collegato all'anagrafica", () => {
    expect(b.ingredienti.every((i) => i.ingredient_id == null)).toBe(true);
  });

  it("porzioni che non sono un numero solo diventano un buco, non un numero scelto", () => {
    expect(porzioniDaTesto("4 servings")).toBe(4);
    expect(porzioniDaTesto("4-6 porzioni")).toBe(null);
    expect(porzioniDaTesto(null)).toBe(null);
    const c = bozzaDaRicettaLetta({ ...letta, porzioni: "4-6" }, "https://clove.kitchen/recipes/x");
    expect(c.bozza.porzioni).toBe(null);
    expect(c.bozza.buchi_dichiarati.join(" | ")).toMatch(/porzioni scritte come «4-6»/);
  });

  it("il testo ricomposto ha le intestazioni che il lettore riconosce", () => {
    const t = testoDellaRicetta(letta);
    expect(t).toMatch(/^Crema di prova\nPorzioni: 4\n\nIngredienti\n- 200 ml latte intero/);
    expect(t).toMatch(/\nProcedimento\n1\. Scalda il latte\./);
  });
});

describe("i fili che legano i pezzi", () => {
  it("la creazione passa dal corridoio, che la conosce", () => {
    const corridoio = readFileSync("supabase/functions/operazioni-atomiche/index.ts", "utf8");
    expect(corridoio).toMatch(/"crea_bozza_da_lettura"/);
    const api = readFileSync("src/lib/api/bozzeRicetta.js", "utf8");
    expect(api).toMatch(/eseguiOperazione\("crea_bozza_da_lettura"/);
  });

  it("⚠️ la funzione online segue i rinvii a mano, e ricontrolla ogni indirizzo", () => {
    const f = readFileSync("supabase/functions/ricetta-da-link/index.ts", "utf8");
    expect(f).toMatch(/redirect:\s*"manual"/);
    expect(f).toMatch(/indirizzoAmmesso\(new URL\(dove, attuale\)/);
    expect(f).toMatch(/rpc\("is_titolare"\)/);
  });
});

// =====================================================================
// LE PROPOSTE DELL'ASSISTENTE — 10/10/2026
// =====================================================================
import {
  CATEGORIE_PROPONIBILI,
  FASI_PROPONIBILI,
  domandaPerAssistente,
  jsonDallaRisposta,
  proposteValide,
} from "../../supabase/functions/ricetta-da-link/proposte";
import { applicaProposte } from "../../src/lib/calcoli/ricettaDaLink";
import { STEP_PHASES, RECIPE_CATEGORIES } from "../../src/lib/constants";

describe("le proposte dell'assistente si controllano prima di usarle", () => {
  it("gli elenchi sono quelli del gestionale (il finger food no: la promozione lo rifiuta)", () => {
    expect([...FASI_PROPONIBILI].sort()).toEqual(STEP_PHASES.map((f) => f.value).sort());
    expect([...CATEGORIE_PROPONIBILI].sort()).toEqual(
      RECIPE_CATEGORIES.map((c) => c.value).filter((v) => v !== "finger_food").sort()
    );
  });

  it("valori fuori elenco diventano vuoti, non indovinati", () => {
    const p = proposteValide(
      { categoria: "bevanda", fasi: ["cottura", "riposo"], ingredienti: [{ nome: "panna", nota: 5 }] },
      1,
      2
    );
    expect(p).toEqual({ categoria: null, fasi: ["cottura", null], ingredienti: [{ nome: "panna", nota: null }] });
  });

  it("🔴 se le righe non sono tante quante quelle della ricetta, si scartano TUTTE", () => {
    const p = proposteValide(
      { categoria: "dolce", fasi: ["cottura"], ingredienti: [{ nome: "a" }, { nome: "b" }] },
      3,
      2
    );
    expect(p).toEqual({ categoria: "dolce", fasi: null, ingredienti: null });
  });

  it("una risposta che non è un oggetto non rompe niente", () => {
    expect(proposteValide(null, 1, 1)).toEqual({ categoria: null, fasi: null, ingredienti: null });
    expect(jsonDallaRisposta('```json\n{"categoria":"primo"}\n```')).toEqual({ categoria: "primo" });
  });

  it("la domanda numera righe e passaggi e dice quanti sono", () => {
    const d = domandaPerAssistente({ titolo: "X", ingredienti: ["a", "b"], passaggi: ["uno"] });
    expect(d).toMatch(/Ingredienti \(2 righe\):\n1\. a\n2\. b/);
    expect(d).toMatch(/Passaggi \(1\):\n1\. uno/);
  });
});

describe("le proposte sopra la bozza", () => {
  const letta = ricettaDallaPagina(pagina(RICETTA)).ricetta;

  it("categoria, fasi e nomi entrano, e la bozza dichiara cosa ha proposto l'assistente", () => {
    const b = bozzaDaRicettaLetta(letta, "https://clove.kitchen/recipes/x", {
      categoria: "dolce",
      fasi: ["cottura", "mise_en_place"],
      ingredienti: [
        { nome: "latte", nota: "intero" },
        { nome: "zucchero", nota: null },
        { nome: "", nota: null },
        { nome: "sale", nota: null },
      ],
    });
    expect(b.bozza.categoria).toBe("dolce");
    expect(b.passaggi.map((p) => p.fase)).toEqual(["cottura", "mise_en_place"]);
    expect(b.ingredienti.map((i) => i.nome)).toEqual(["latte", "zucchero", "2-3 tuorli", "sale"]);
    expect(b.ingredienti[0].nota).toBe("intero");
    expect(b.bozza.proposte_assistente).toEqual(["la categoria", "le fasi dei passaggi", "i nomi degli ingredienti"]);
  });

  it("🔴 l'assistente non tocca i numeri, e la nota del lettore («q.b.») resta", () => {
    const senza = bozzaDaRicettaLetta(letta, "u");
    const con = bozzaDaRicettaLetta(letta, "u", {
      categoria: null,
      fasi: null,
      ingredienti: [
        { nome: "latte", nota: null },
        { nome: "zucchero", nota: "per la crema" },
        { nome: "tuorli", nota: null },
        { nome: "sale", nota: null },
      ],
    });
    expect(con.ingredienti.map((i) => [i.quantita, i.unita])).toEqual(senza.ingredienti.map((i) => [i.quantita, i.unita]));
    expect(con.ingredienti[1].nota).toBe("q.b. · per la crema");
    expect(con.bozza.buchi_dichiarati).toEqual(senza.bozza.buchi_dichiarati);
  });

  it("senza proposte la bozza non dichiara niente", () => {
    expect(bozzaDaRicettaLetta(letta, "u").bozza.proposte_assistente).toEqual([]);
    expect(applicaProposte({ bozza: {}, ingredienti: [], passaggi: [] }, null).proposte).toEqual([]);
  });
});
