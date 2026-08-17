import { describe, expect, it } from "vitest";
import {
  guardieSospette,
  problemiVocabolari,
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
