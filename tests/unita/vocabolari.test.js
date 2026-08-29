import { describe, expect, it } from "vitest";
import {
  elenchiDiCategorieNelCodice,
  guardieSospette,
  problemiVocabolari,
  SPECCHI_ESENTI,
  specchiNonDichiarati,
} from "../../src/lib/calcoli/vocabolari";

// LA RETE DEI VOCABOLARI, PROVATA AL CONTRARIO.
//
// ⚠️ Questo file esiste per una ragione sola: **una rete che non si è mai
// vista scattare è una rete di cui non si sa se scatta.** La prova sul
// database (`tests/app/vocabolari.test.js`) dice che oggi i tre posti sono
// d'accordo — cioè misura una coincidenza. Qui si producono le divergenze
// una per una e si pretende che la rete le nomini.
//
// E si fa su dati inventati invece che mutando i file dell'app, perché il
// gestionale gira dalla stessa cartella in cui si lavora: rompere
// `constants.js` per vedere la prova diventare rossa farebbe comparire menu
// rotti sotto le mani di chi sta collaudando.

const DB = [
  { tabella: "supplier_invoices", colonna: "payment_method", valori: ["assegno", "bonifico", "carta", "contante"] },
  { tabella: "shopping_list_items", colonna: "payment_method", valori: ["bonifico", "carta", "contante"] },
  { tabella: "orders", colonna: "payment_method", valori: ["carta", "contante", "misto"] },
  { tabella: "tasks", colonna: "ricorrenza", valori: ["annuale", "mensile", "semestrale", "trimestrale"] },
];

const etichette = (...valori) => valori.map((v) => ({ value: v, label: v }));

describe("la rete dei vocabolari scatta quando i tre posti divergono", () => {
  it("tace quando tutto combacia", () => {
    const problemi = problemiVocabolari(
      [
        {
          costante: "PAYMENT_METHODS",
          valori: etichette("contante", "bonifico", "assegno", "carta"),
          tabella: "supplier_invoices",
          colonna: "payment_method",
        },
      ],
      DB
    );
    expect(problemi).toEqual([]);
  });

  it("grida su un valore che la schermata offre e il database rifiuta", () => {
    // È il difetto vero del 17/08: «assegno» nel menu della lista della
    // spesa, dove il vincolo ammette solo tre valori. Chi lo scegliesse si
    // vedrebbe fallire il salvataggio.
    const problemi = problemiVocabolari(
      [
        {
          costante: "PAYMENT_METHODS_SPESA",
          valori: etichette("contante", "bonifico", "carta", "assegno"),
          tabella: "shopping_list_items",
          colonna: "payment_method",
        },
      ],
      DB
    );
    expect(problemi).toHaveLength(1);
    expect(problemi[0]).toContain("assegno");
    expect(problemi[0]).toContain("il database li rifiuta");
  });

  it("grida su un valore legittimo che la schermata NON offre — il caso silenzioso", () => {
    // ⚠️ Questo è il verso che non dà nessun errore a nessuno: il valore
    // esiste, il database lo accetterebbe, e semplicemente non c'è modo di
    // scegliierlo. Senza la rete lo si scopre solo per caso.
    const problemi = problemiVocabolari(
      [
        {
          costante: "PAYMENT_METHODS",
          valori: etichette("contante", "bonifico", "carta"),
          tabella: "supplier_invoices",
          colonna: "payment_method",
        },
      ],
      DB
    );
    expect(problemi).toHaveLength(1);
    expect(problemi[0]).toContain("assegno");
    expect(problemi[0]).toContain("in silenzio");
  });

  it("grida se la colonna dichiarata non è un vocabolario chiuso", () => {
    const problemi = problemiVocabolari(
      [{ costante: "TALE", valori: etichette("a"), tabella: "orders", colonna: "note" }],
      DB
    );
    expect(problemi).toHaveLength(1);
    expect(problemi[0]).toContain("non è un vocabolario chiuso");
  });

  it("accetta un valore che il database scrive da sé, se è dichiarato", () => {
    // «misto» sui conti è un riflesso scritto da un trigger: offrirlo
    // vorrebbe dire lasciar scrivere a mano un numero che il database
    // calcola. L'eccezione va dichiarata, non dedotta.
    const specchio = {
      costante: "ORDER_PAYMENT_METHODS",
      valori: etichette("contante", "carta"),
      tabella: "orders",
      colonna: "payment_method",
    };
    expect(problemiVocabolari([{ ...specchio, inPiuNelDatabase: ["misto"] }], DB)).toEqual([]);
    // E senza la dichiarazione la rete grida: è il verso che rende
    // l'eccezione una scelta invece di un silenzio.
    expect(problemiVocabolari([specchio], DB)).toHaveLength(1);
  });

  it("ignora il valore vuoto solo dove è dichiarato che significa «niente»", () => {
    const specchio = {
      costante: "TASK_RICORRENZE",
      valori: etichette("", "mensile", "trimestrale", "semestrale", "annuale"),
      tabella: "tasks",
      colonna: "ricorrenza",
    };
    expect(problemiVocabolari([{ ...specchio, ignora: [""] }], DB)).toEqual([]);
    expect(problemiVocabolari([specchio], DB)).toHaveLength(1);
  });
});

describe("la rete sulle guardie delle funzioni", () => {
  const VOC = DB;

  it("tace su una guardia che dice esattamente quello che dice il database", () => {
    const guardie = [
      { funzione: "pay_supplier_invoice", parametro: "p_payment_method", valori: ["contante", "bonifico", "carta", "assegno"] },
    ];
    expect(guardieSospette(guardie, VOC, [])).toEqual([]);
  });

  it("grida quando una funzione è stata allargata e il suo vincolo no", () => {
    // È il morso del 16/08 (gli scarichi) e quello del 17/08 (i metodi di
    // pagamento): la funzione accetta un valore in più, la tabella lo
    // rifiuta, e l'errore arriva al primo uso vero in una forma
    // incomprensibile.
    const guardie = [
      {
        funzione: "close_shopping_list_item",
        parametro: "p_payment_method",
        valori: ["contante", "bonifico", "carta", "assegno"],
      },
    ];
    // Nel database quel vocabolario ne ha tre — ma un ALTRO vocabolario ne
    // ha esattamente quei quattro, e la rete non deve confondersi: la
    // guardia combacia con `supplier_invoices`, quindi tace. È il limite
    // dichiarato del confronto per insiemi.
    expect(guardieSospette(guardie, VOC, [])).toEqual([]);

    // Il caso che invece deve gridare: un insieme che non è quello di
    // nessun vocabolario.
    const rotta = [
      {
        funzione: "close_shopping_list_item",
        parametro: "p_payment_method",
        valori: ["contante", "bonifico", "carta", "baratto"],
      },
    ];
    const sospette = guardieSospette(rotta, VOC, []);
    expect(sospette).toHaveLength(1);
    expect(sospette[0]).toContain("baratto");
  });

  it("un'esenzione dichiarata zittisce quella guardia e solo quella", () => {
    const guardie = [
      { funzione: "annulla_prenotazione", parametro: "p_stato", valori: ["annullata", "rifiutata"] },
      { funzione: "altra_funzione", parametro: "p_stato", valori: ["annullata", "rifiutata"] },
    ];
    const esenti = [{ funzione: "annulla_prenotazione", parametro: "p_stato", perche: "sottoinsieme voluto" }];
    const sospette = guardieSospette(guardie, VOC, esenti);
    expect(sospette).toHaveLength(1);
    expect(sospette[0]).toContain("altra_funzione");
  });
});

describe("il lato JavaScript si costruisce da solo", () => {
  it("nomina gli elenchi di etichette che nessuno ha dichiarato", () => {
    const modulo = {
      PRIMO: etichette("a", "b"),
      SECONDO: etichette("c"),
      SOGLIA_QUALCOSA: 400,
      unaFunzione: () => null,
      NON_ETICHETTE: [1, 2, 3],
      VUOTO: [],
    };
    const nonDichiarati = specchiNonDichiarati(modulo, [{ costante: "PRIMO" }]);
    // Solo SECONDO: la soglia, la funzione, l'array di numeri e l'elenco
    // vuoto non sono menu a tendina.
    expect(nonDichiarati).toEqual(["SECONDO"]);
  });
});

// ---------------------------------------------------------------------
// Gli elenchi esenti — 24/08/2026
// ---------------------------------------------------------------------
describe("un elenco che non rispecchia nessuna colonna si dichiara", () => {
  it("un elenco esente non viene più segnalato", () => {
    const modulo = { FINTO_DERIVATO: [{ value: "a" }, { value: "b" }] };
    const esenti = [{ costante: "FINTO_DERIVATO", perche: "è derivato da tre colonne diverse" }];
    expect(specchiNonDichiarati(modulo, [], esenti)).toEqual([]);
  });

  it("MA UN ELENCO NUOVO CONTINUA A ESSERE SEGNALATO — la rete non si è spenta", () => {
    // ⚠️ È la controprova che discrimina: senza di lei, un'esenzione
    // scritta male (o un elenco vuoto di esenti passato per sbaglio)
    // spegnerebbe la rete e la prova sopra passerebbe lo stesso.
    const modulo = {
      FINTO_DERIVATO: [{ value: "a" }],
      FINTO_NUOVO: [{ value: "x" }],
    };
    const esenti = [{ costante: "FINTO_DERIVATO", perche: "derivato" }];
    expect(specchiNonDichiarati(modulo, [], esenti)).toEqual(["FINTO_NUOVO"]);
  });

  it("ogni esente porta la sua ragione scritta", () => {
    // ⚠️ Un'eccezione senza ragione si allarga da sola: chi la legge fra
    // sei mesi non sa se vale ancora. La prova pretende che ci sia, e che
    // non sia una frase di comodo.
    for (const e of SPECCHI_ESENTI) {
      expect(e.perche, `${e.costante} è esente ma non dice perché`).toBeTruthy();
      expect(e.perche.length).toBeGreaterThan(40);
    }
  });
});

// ============================================================================
// LE CATEGORIE NON TORNANO A ESSERE UN ELENCO SCRITTO A MANO
// ============================================================================
describe("le categorie degli ingredienti sono dati, non un elenco nel codice", () => {
  it("`constants.js` non esporta piu' un elenco di categorie", async () => {
    // 🔴 PERCHE' QUESTA PROVA ESISTE. Il 27/08/2026 le categorie sono passate
    // da un enum a una TABELLA, perche' Alessio deve poterne aggiungere una
    // mentre inserisce un prodotto. L'elenco statico e la riga di
    // `SPECCHIATI` che lo sorvegliava sono stati TOLTI — e togliere una riga
    // da una rete somiglia a indebolirla, quindi qui c'e' il guardiano che
    // prende il loro posto.
    //
    // ⚠️ Rimetterlo non darebbe nessun errore: darebbe una seconda verita'
    // che resta indietro appena Alessio aggiunge una categoria, cioe' un
    // valore legittimo che non si puo' scegliere. E' il caso SILENZIOSO fra
    // i due che la rete dei vocabolari esiste per chiudere.
    const costanti = await import("../../src/lib/constants");
    const sospette = elenchiDiCategorieNelCodice(costanti);
    expect(
      sospette,
      "le categorie degli ingredienti sono tornate a essere un elenco nel codice: " +
        "si leggono con listCategorieIngrediente(), vedi la nota in constants.js"
    ).toEqual([]);
  });


  it("...e la prova DISCRIMINA: un elenco rimesso nel codice viene nominato", () => {
    // ⚠️ È la controprova, e si fa su un modulo INVENTATO invece di rompere
    // `constants.js`: il gestionale gira dalla stessa cartella in cui si
    // lavora, e romperlo davvero farebbe comparire menu vuoti sotto le mani
    // di chi sta collaudando (è la ragione scritta in cima a questo file).
    const modulo = {
      UNITS: [{ value: "kg" }],
      INGREDIENT_CATEGORIES: [{ value: "verdura", label: "Verdura" }],
    };
    // ⚠️ Dal 29/08 anche UNITS: le unita sono dati, e un elenco rimesso qui
    //    sarebbe la stessa seconda verita che la rete ha appena trovato.
    expect(elenchiDiCategorieNelCodice(modulo)).toEqual(["INGREDIENT_CATEGORIES", "UNITS"]);

    // ...e non grida su un modulo sano, altrimenti sarebbe un guardiano che
    // segnala sempre — e quelli si imparano a spegnere.
    expect(elenchiDiCategorieNelCodice({ ALLERGENS: [], MONTHS: [] })).toEqual([]);
  });

  it("...e nessuno rispecchia piu' `ingredients.category`", async () => {
    // ⚠️ La controprova dell'altra meta': se qualcuno rimettesse la riga in
    // `SPECCHIATI` puntando a una tabella che ora e' un catalogo, la prova
    // sui dati veri diventerebbe rossa il primo giorno in cui Alessio
    // aggiunge una categoria — un allarme falso su un gesto legittimo.
    const { SPECCHIATI } = await import("../../src/lib/calcoli/vocabolari");
    const specchi = SPECCHIATI.filter(
      (s) => s.tabella === "ingredients" && s.colonna === "category"
    );
    expect(
      specchi.map((s) => s.costante),
      "qualcuno rispecchia di nuovo le categorie: diventerebbe rosso appena Alessio ne aggiunge una"
    ).toEqual([]);
  });
});
