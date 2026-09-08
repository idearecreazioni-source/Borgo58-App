import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DOMANDE,
  causaInItaliano,
  comeRispondere,
  quandoLAssistenteTace,
  sembraUnaDomanda,
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

  // 🔴 ROVESCIAMENTO DICHIARATO, 08/09/2026: fino al 07/09 questa prova
  //    diceva «una domanda della fase 1 non legge prezzi» e vietava la
  //    parola «costo» in blocco. La ragione era buona — alle nove domande
  //    di allora il denaro non serviva — ma dalla fase 2 due domande
  //    parlano di Cassa, e un divieto che nessuno può rispettare si
  //    cancella invece di diventare più preciso.
  //    ⚠️ QUELLO CHE RESTA È UN CONFINE PIÙ STRETTO, non un divieto in
  //    meno: la Cassa si legge dalle sue funzioni, che il database difende
  //    col portiere del titolare; i COSTI di ricetta, di lotto e di
  //    magazzino non si leggono da nessuna domanda, perché a nessuna
  //    servono — e quello che non arriva al browser non può finire a
  //    schermo per sbaglio.
  it("🔴 nessuna domanda legge un COSTO di ricetta, di lotto o di magazzino", () => {
    const costi = [
      "v_recipe_costs",
      "getRecipeCost",
      "listStockLots",
      "unit_cost",
      "espansione_costo_ricetta",
      "storicoCosti",
      // ⚠️ La vista senza prezzi è `recipe_ingredients_display`: quella
      //    con dentro i costi è un'altra, e chiederla qui sarebbe il modo
      //    silenzioso di far uscire i prezzi d'acquisto.
      "listRecipeIngredients(",
      "listRecipeIngredientsForRecipes",
    ];
    const trovati = costi.filter((p) => sorgente.includes(p));
    expect(trovati, "una domanda non legge prezzi: " + trovati.join(", ")).toEqual([]);
  });

  it("...e gli ingredienti si chiedono alla vista SENZA i costi", () => {
    // ⚠️ La metà che discrimina: senza questa riga la prova qui sopra
    //    resterebbe verde anche se gli ingredienti non si leggessero
    //    affatto — direbbe «non legge prezzi» di un file che non legge
    //    niente.
    expect(sorgente).toContain("listRecipeIngredientsDisplay");
  });

  it("e ogni lettura passa da `leggi()`, così una che fallisce non diventa uno zero", () => {
    const chiamate = (sorgente.match(/await leggi\(/g) ?? []).length;
    expect(chiamate).toBeGreaterThanOrEqual(5);

    // 🔴 IL SETACCIO NOMINAVA LE LETTURE CHE CONOSCEVA, ed è la forma che
    //    questo progetto rifiuta: cercava `await list…`, `await agenda…` e
    //    `await getRecipe…`, cioè i nomi che esistevano il 07/09. La fase 2
    //    ne ha portati sei nuovi — `getEntities`, `getSaldoTesoreria`,
    //    `listaSpesa`, `coseDaFare`, `pulizieDiOggi`, `temperatureDiOggi` —
    //    e nessuno di quelli sarebbe stato guardato. *Un elenco di nomi
    //    scritto a mano copre il passato.*
    // ⚠️ Adesso si guarda la FORMA: qualunque `await qualcosa(` che non sia
    //    `leggi` o `Promise.all` è una lettura che, cadendo, porterebbe giù
    //    tutta la risposta invece di dire «non lo so».
    // ⚠️ `letturePerDomanda` non è una lettura: è lo smistamento, e tutto
    //    quello che chiede passa già da `leggi()` — provarlo due volte
    //    vorrebbe dire pretendere un `leggi(leggi(…))`.
    const ammesse = ["leggi", "Promise", "letturePerDomanda"];
    const nude = (sorgente.match(/await\s+([A-Za-z_$][\w$.]*)\s*\(/g) ?? []).filter(
      (x) => !ammesse.some((a) => x.includes(a)),
    );
    expect(nude, "questa lettura non passa da leggi(): " + nude.join(", ")).toEqual([]);
  });
});

// =====================================================================
// 🔴 QUANDO L'ASSISTENTE NON RISPONDE — 07/09/2026, dal collaudo a mano
// =====================================================================
// Il credito dell'account AI e' finito, la chiamata al modello e' stata
// rifiutata prima di partire, e da «Quanto olio ho?» e' nato un appunto
// «Da riguardare» da approvare o buttare.
//
// 🔴 LA RAGIONE PER CUI LE DUE COSE SI TRATTANO DIVERSAMENTE NON E' IL
//    FASTIDIO: un comando porta un fatto che esiste solo nella testa di chi
//    ha parlato — quanti chili sono arrivati, quanto ha pagato — e perderlo
//    perde quel fatto. Una domanda no: rifarla costa il tempo di ridirla.
// =====================================================================
// 🔴 I DUE MODI DI RESTARE SENZA SOLDI — 08/09/2026, dal telefono
// =====================================================================
// Tre domande fatte con le mani sul progetto di prova hanno risposto tutte
// «L'assistente non ha risposto». Il rifiuto vero, letto nel registro
// delle dettature:
//
//   400 {"type":"error","error":{"type":"invalid_request_error",
//   "message":"You have reached your specified API usage limits.
//   You will regain access on 2026-10-01 at 00:00 UTC."}}
//
// 🔴 NON È IL CREDITO, ED È LA DISTINZIONE CHE VALE: col credito finito si
//    ricarica e MEMO riparte; col tetto raggiunto non c'è niente da
//    ricaricare — o si alza il tetto, o si aspetta il mese nuovo. Dirle
//    con la stessa frase manda a fare la cosa sbagliata.
describe("perché l'assistente non ha risposto, in italiano", () => {
  const TETTO =
    '400 {"type":"error","error":{"type":"invalid_request_error","message":"You have reached your specified API usage limits. You will regain access on 2026-10-01 at 00:00 UTC."},"request_id":"req_011CeqRj9Df84VRzdSrmE9Et"}';

  it("🔴 il tetto dell'account si riconosce, e NON si chiama «credito finito»", () => {
    const c = causaInItaliano(TETTO);
    expect(c).toMatch(/tetto di spesa dell'account/i);
    expect(c).not.toMatch(/ricaricat/i);
  });

  it("🔴 e dice fino a QUANDO, perché «aspetta» senza una data è un vicolo cieco", () => {
    expect(causaInItaliano(TETTO)).toContain("01/10/2026");
  });

  it("...ma se la data non c'è non se la inventa", () => {
    // ⚠️ La metà che discrimina: una regola che scrivesse sempre una data
    //    ne scriverebbe una falsa il giorno che il rifiuto non la porta.
    const c = causaInItaliano("You have reached your specified API usage limits.");
    expect(c).toMatch(/tetto di spesa dell'account/i);
    expect(c).not.toMatch(/fino al/);
  });

  it("🔴 e dichiara che non è il tetto del GESTIONALE", () => {
    // 🔴 È la parte che inganna di più: «spesa_ai_del_mese» conta quello
    //    che ha speso QUESTO database, e l'08/09 sulla prova diceva 2,10 €
    //    su 10 — «sotto il tetto». Chi guarda quel numero conclude che il
    //    blocco è un guasto del programma.
    expect(causaInItaliano(TETTO)).toMatch(/database/i);
  });

  it("il credito finito resta una cosa a sé", () => {
    const c = causaInItaliano('{"error":{"message":"Your credit balance is too low"}}');
    expect(c).toMatch(/credito/i);
    expect(c).toMatch(/ricaricat/i);
    expect(c).not.toMatch(/tetto/i);
  });

  it("occupato e sovraccarico non diventano un problema di soldi", () => {
    expect(causaInItaliano("429 rate limit exceeded")).toMatch(/occupato/i);
    expect(causaInItaliano("529 overloaded_error")).toMatch(/sovraccarico/i);
  });

  it("e quello che non si riconosce si dice come tale, senza indovinare", () => {
    expect(causaInItaliano("ECONNRESET")).toBe("L'assistente non ha risposto.");
    expect(causaInItaliano("")).toBe("L'assistente non ha risposto.");
  });

  it("🔴 col tetto raggiunto una DOMANDA non diventa comunque un appunto", () => {
    // 🔴 È la proprietà che ha retto anche mentre il modello era muto: le
    //    tre domande fatte col telefono l'08/09 non hanno creato niente.
    //    Quello che era sbagliato era solo la frase.
    const t = quandoLAssistenteTace("Quanti soldi ci sono in cassa", causaInItaliano(TETTO));
    expect(t.azioni).toEqual([]);
    expect(t.messaggio).toMatch(/tetto di spesa dell'account/i);
    expect(t.messaggio).toContain("non ho segnato niente");
  });

  it("...e un COMANDO invece si conserva, tetto o non tetto", () => {
    const t = quandoLAssistenteTace("Segna due chili di astice", causaInItaliano(TETTO));
    expect(t.azioni).toHaveLength(1);
    expect(t.azioni[0].dati.sentito).toBe("Segna due chili di astice");
  });
});

describe("una domanda che nessuno ha capito non diventa un appunto", () => {
  it("🔴 la frase esatta del collaudo non produce nessuna azione", () => {
    const t = quandoLAssistenteTace("Quanto olio ho?", "L'assistente non ha risposto.");
    expect(t.azioni).toEqual([]);
    expect(t.messaggio).toContain("non ho segnato niente");
  });

  it("...e vale anche senza il punto interrogativo, che la dettatura spesso non mette", () => {
    // ⚠️ È il caso vero: dal telefono e' arrivato «Quanto olio ho», nudo.
    expect(quandoLAssistenteTace("Quanto olio ho", "x").azioni).toEqual([]);
  });

  it("🔴 ma un COMANDO diventa un appunto, come prima", () => {
    // ⚠️ È la meta' che discrimina, ed e' quella che protegge dal danno
    //    peggiore: una regola che lasciasse cadere tutto passerebbe la
    //    prova qui sopra e perderebbe ogni cosa da segnare.
    const t = quandoLAssistenteTace("Segna due chili di astice", "L'assistente non ha risposto.");
    expect(t.azioni).toHaveLength(1);
    expect(t.azioni[0].tipo).toBe("nota_non_capita");
    expect(t.azioni[0].dati.sentito).toBe("Segna due chili di astice");
    expect(t.messaggio).toContain("messo da parte");
  });

  it("le domande si riconoscono tutte, anche senza punto", () => {
    for (const frase of [
      "Quanto olio ho",
      "Quanti piatti ho in carta",
      "Quali piatti ho in carta",
      "Cosa devo fare oggi",
      "Cosa sono in ritardo",
      "Cosa mi manca",
      "Cosa scade",
      "Quando scade l'F24",
      "Che cosa devo fare oggi",
      "C'è olio",
    ]) {
      expect(sembraUnaDomanda(frase), frase).toBe(true);
    }
  });

  it("🔴 gli ESEMPI che non reggono senza il punto sono un elenco CHIUSO", () => {
    // 🔴 GLI ESEMPI SONO ISTRUZIONI, e vanno provati come tali: quando MEMO
    //    non sa rispondere mostra le frasi di `DOMANDE_CHE_SO.esempio`, e
    //    chi le legge le ridice al telefono — dove il punto interrogativo
    //    quasi sempre non arriva. Un esempio che senza punto viene preso
    //    per un comando insegna una frase che poi diventa un appunto da
    //    buttare.
    //
    // ⚠️ UNO C'È, ED È VOLUTO: «ho la ricetta della carbonara» comincia
    //    identica a «ho pagato trenta euro al fornitore», e nell'elenco
    //    delle aperture non si può mettere «ho» senza perdere i comandi.
    //    Il prezzo è dichiarato dal 07/09 in `APERTURE_DI_DOMANDA`.
    // ⚠️ QUELLO CHE QUESTA PROVA IMPEDISCE È CHE L'ELENCO CRESCA IN
    //    SILENZIO: aggiungendo domani una domanda il cui esempio comincia
    //    con un verbo, diventa rossa e chi la scrive deve scegliere — o
    //    cambiare l'esempio, o dichiarare il prezzo qui.
    //    È successo scrivendo la fase 2: l'esempio delle temperature era
    //    «Ho segnato le temperature?», ed è stato cambiato.
    const fragili = Object.entries(DOMANDE_CHE_SO)
      .filter(([, d]) => !sembraUnaDomanda(d.esempio.replace(/\?+$/, "")))
      .map(([chiede]) => chiede);
    expect(fragili).toEqual(["ricetta_esiste"]);
  });

  it("...e col punto le riconosce TUTTE", () => {
    // ⚠️ La metà che discrimina: senza, un elenco di esempi tutti storti
    //    passerebbe la prova qui sopra dichiarandoli tutti fragili.
    for (const d of Object.values(DOMANDE_CHE_SO)) {
      expect(sembraUnaDomanda(d.esempio), d.esempio).toBe(true);
    }
  });

  it("🔴 e NESSUN comando viene scambiato per domanda", () => {
    // 🔴 È il verso in cui sbagliare costa: una frase da segnare che si
    //    perde. Dentro l'elenco non c'e' niente che possa aprire un
    //    imperativo italiano.
    for (const frase of [
      "Segna due chili di astice",
      "Aggiungi il deodorante alla spesa",
      "Ho pagato trenta euro al fornitore",
      "Sono arrivate due casse di pomodori",
      "Chiama il fornitore del pane",
      "Cella carni tre gradi",
      "Mi manca il pane, segnalo",
      "Ricordami di fare il ragù",
    ]) {
      expect(sembraUnaDomanda(frase), frase).toBe(false);
    }
  });

  it("⚠️ «ho la ricetta della carbonara» senza punto resta un appunto, ed è il prezzo dichiarato", () => {
    // «Ho …» non e' fra le aperture, e non puo' esserlo: «ho pagato trenta
    // euro» comincia identico ed e' un comando. Col punto, invece, chi ha
    // dettato ha gia' dichiarato.
    expect(sembraUnaDomanda("Ho la ricetta della carbonara")).toBe(false);
    expect(sembraUnaDomanda("Ho la ricetta della carbonara?")).toBe(true);
  });

  it("il vuoto non e' una domanda", () => {
    expect(sembraUnaDomanda("")).toBe(false);
    expect(sembraUnaDomanda("   ")).toBe(false);
    expect(sembraUnaDomanda(null)).toBe(false);
  });
});

describe("perché non ha risposto, detto in italiano", () => {
  it("🔴 il credito finito si riconosce e si dice", () => {
    // ⚠️ Senza questa riga chi legge «l'assistente non ha risposto» cerca
    //    il difetto nel programma — ed e' successo il 07/09.
    const f = causaInItaliano(
      '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}',
    );
    expect(f).toContain("credito");
    expect(f).toContain("ricaricato");
  });

  it("e quello che non si riconosce non si inventa", () => {
    expect(causaInItaliano("boom")).toBe("L'assistente non ha risposto.");
    expect(causaInItaliano(null)).toBe("L'assistente non ha risposto.");
  });
});
