import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DOMANDE,
  comeRispondere,
  istruzioniDomande,
  leggiDomanda,
} from "../../supabase/functions/ascolta-voce/domande.ts";
import { DOMANDE_CHE_SO } from "../../src/lib/calcoli/domande";

// =====================================================================
// DOMANDA O COMANDO — la regola che decide, e non è nel prompt
// =====================================================================
// 🔴 I DUE SCAMBI NON COSTANO UGUALE, ed è tutto il senso di questa regola:
//      · una domanda scambiata per comando produce un appunto che non
//        scrive niente finché nessuno lo approva — si butta in un tocco;
//      · un comando scambiato per domanda **si perde**: MEMO risponde
//        qualcosa, e la cosa da segnare non esiste più da nessuna parte.
//    Quindi la precedenza è scritta nel codice, dove nessun modello può
//    ripensarci: se dalla frase è uscita anche una sola azione, quella
//    frase è un comando.

describe("chi vince fra le due", () => {
  it("🔴 se è uscita un'azione, è un COMANDO — anche se c'è anche una domanda", () => {
    const r = comeRispondere({
      azioni: [{ tipo: "lista_spesa", dati: { nome_libero: "pesce spada" } }],
      domanda: { chiede: "quanto_ho", soggetto: "pesce spada" },
    });
    expect(r.tipo).toBe("azioni");
    expect(r.azioni).toHaveLength(1);
  });

  it("senza azioni, la domanda passa", () => {
    // ⚠️ La metà che discrimina: una regola che facesse sempre vincere il
    //    comando passerebbe la prova qui sopra e non risponderebbe mai.
    const r = comeRispondere({ azioni: [], domanda: { chiede: "cosa_manca" } });
    expect(r.tipo).toBe("domanda");
    expect(r.domanda.chiede).toBe("cosa_manca");
  });

  it("né azioni né domanda torna come comando vuoto, e la frase non si perde", () => {
    // Chi chiama ci mette dentro la nota con quello che è stato detto: qui
    // si prova solo che il caso non finisce in un ramo inesistente.
    const r = comeRispondere({});
    expect(r.tipo).toBe("azioni");
    expect(r.azioni).toEqual([]);
    expect(comeRispondere(null).tipo).toBe("azioni");
  });
});

describe("che cosa ha chiesto", () => {
  it("le nove si riconoscono, con la loro area", () => {
    for (const [chiede, nota] of Object.entries(DOMANDE)) {
      const d = leggiDomanda({ domanda: { chiede, area: "sbagliata" } });
      expect(d.chiede, chiede).toBe(chiede);
      // ⚠️ L'area la decide l'elenco, non il modello: se le due cose
      //    divergessero, il gestionale leggerebbe la fonte sbagliata.
      expect(d.area, chiede).toBe(nota.area);
    }
  });

  it("🔴 una domanda fuori dalle nove NON diventa una delle nove", () => {
    // È il difetto del 06/09 — la spesa spicciola ricondotta alla lista
    // della spesa — spostato dai comandi alle domande. Lì produceva un
    // appunto da buttare; qui produrrebbe una risposta falsa.
    const d = leggiDomanda({ domanda: { chiede: "quanto_costa", soggetto: "carbonara" } });
    expect(d.chiede).toBeNull();
    expect(d.soggetto).toBe("carbonara");
  });

  it("gli spazi non diventano un soggetto", () => {
    const d = leggiDomanda({ domanda: { chiede: "quanto_ho", soggetto: "   " } });
    expect(d.soggetto).toBeNull();
  });

  it("quello che non è un oggetto non è una domanda", () => {
    expect(leggiDomanda({ domanda: "sì" })).toBeNull();
    expect(leggiDomanda({ domanda: ["a"] })).toBeNull();
    expect(leggiDomanda({})).toBeNull();
    expect(leggiDomanda(null)).toBeNull();
  });
});

describe("le istruzioni per il modello si costruiscono dall'elenco", () => {
  it("nominano tutte e nove, e non una in meno", () => {
    // ⚠️ Il testo per il modello NON è scritto a mano accanto all'elenco:
    //    due elenchi divergono al primo ritocco, e questo progetto l'ha
    //    già pagato tre volte. Se domani se ne aggiunge una, questa prova
    //    resta verde da sola.
    const testo = istruzioniDomande();
    for (const chiede of Object.keys(DOMANDE)) {
      expect(testo, chiede).toContain(`"${chiede}"`);
    }
  });

  it("dice al modello di NON rispondere lui", () => {
    // 🔴 È la condizione che rende verificabile tutta la fase 1: se il
    //    numero lo dicesse il modello, sarebbe plausibile e non
    //    controllabile.
    expect(istruzioniDomande()).toContain("NON RISPONDERE TU ALLA DOMANDA");
  });

  it("e dichiara il verso in cui si sbaglia: nel dubbio è un comando", () => {
    expect(istruzioniDomande()).toContain("NEL DUBBIO E' UN COMANDO");
  });
});

describe("🔴 i due elenchi delle nove domande dicono la stessa cosa", () => {
  it("stessi nomi da tutt'e due le parti", () => {
    // ⚠️ Uno vive nella funzione online (per chi CAPISCE la domanda),
    //    l'altro nel gestionale (per chi la MOSTRA). Sono due file che non
    //    si possono importare a vicenda — uno gira su Deno, l'altro nel
    //    browser — quindi il guardiano è qui.
    //    Se divergessero, MEMO capirebbe una domanda che il gestionale non
    //    sa comporre: nessun errore, e una schermata che dice «questa non
    //    la so fare» su una cosa che sa fare.
    expect(Object.keys(DOMANDE_CHE_SO).sort()).toEqual(Object.keys(DOMANDE).sort());
  });

  it("e le aree combaciano", () => {
    for (const [chiede, nota] of Object.entries(DOMANDE)) {
      expect(DOMANDE_CHE_SO[chiede].area, chiede).toBe(nota.area);
    }
  });

  it("chi vuole un soggetto ha la frase per chiederlo", () => {
    // ⚠️ Senza, una domanda che vuole un soggetto e non ce l'ha resterebbe
    //    muta: «non lo so» al posto di «di che cosa?».
    for (const [chiede, nota] of Object.entries(DOMANDE)) {
      if (nota.soggetto) expect(DOMANDE_CHE_SO[chiede].chiarimento, chiede).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------
// 🔴 LA RETE: LE DOMANDE NON SCRIVONO
// ---------------------------------------------------------------------
// ⚠️ È un controllo di FORMA, come quello sui `catch` muti: non sa cosa fa
//    il gestionale a runtime, sa che in quel file non c'è nessuna delle
//    strade da cui si scrive. Serve per il caso silenzioso — una riga che
//    scrive aggiunta lì fra sei mesi funzionerebbe benissimo, e nessuna
//    prova di comportamento se ne accorgerebbe finché non tocca un dato
//    vero.
describe("una domanda non scrive niente", () => {
  // 🔴 SI GUARDA IL CODICE, NON I COMMENTI, e la prima stesura non lo
  //    faceva: il file dichiara nella sua intestazione «qui non compare
  //    `eseguiOperazione`», e il setaccio trovava proprio quella frase.
  //    ⚠️ È la trappola del 27/08 — *un setaccio che cerca una forma nel
  //    testo trova anche i commenti che parlavano di quella forma* — ed è
  //    la terza volta che si presenta in questo progetto.
  const senzaCommenti = (t) =>
    t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

  const sorgente = senzaCommenti(readFileSync("src/lib/api/domandeMemo.js", "utf8"));

  it("nel file che risponde alle domande non c'è nessuna strada che scrive", () => {
    const proibite = ["eseguiOperazione", ".insert(", ".update(", ".delete(", ".upsert("];
    const trovate = proibite.filter((p) => sorgente.includes(p));
    expect(
      trovate,
      "MEMO consultivo è in SOLA LETTURA: una domanda non crea appunti, azioni, " +
        "movimenti né altre scritture.\n  " + trovate.join("\n  "),
    ).toEqual([]);
  });

  it("...e nemmeno una lettura che porti dei soldi", () => {
    // ⚠️ Alle nove domande della fase 1 il denaro non serve, e non
    //    chiederlo è più forte che chiederlo e non mostrarlo: un costo che
    //    non arriva al browser non può finire a schermo per sbaglio.
    const soldi = ["v_recipe_costs", "getRecipeCost", "listStockLots", "unit_cost", "costo"];
    const trovati = soldi.filter((p) => sorgente.includes(p));
    expect(trovati, "una domanda della fase 1 non legge prezzi").toEqual([]);
  });

  it("e ogni lettura passa da `leggi()`, così una che fallisce non diventa uno zero", () => {
    const chiamate = (sorgente.match(/await leggi\(/g) ?? []).length;
    // Le letture della fase 1 sono cinque: ricette (due volte, la ricerca e
    // la carta), allergeni, giacenze, scadenze, impegni.
    expect(chiamate).toBeGreaterThanOrEqual(5);
    // ⚠️ E nessuna scorciatoia: un `await list…(` nudo sarebbe una lettura
    //    che, cadendo, porterebbe giù tutta la risposta invece di dire
    //    «non lo so».
    const nude = (sorgente.match(/await (list|agenda|getRecipe)\w*\(/g) ?? []).filter(
      (x) => !x.includes("leggi"),
    );
    expect(nude, "questa lettura non passa da leggi(): " + nude.join(", ")).toEqual([]);
  });
});
