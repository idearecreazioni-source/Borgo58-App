import { describe, expect, it } from "vitest";
import {
  barraDivisione,
  chiaveOrigine,
  descriviParte,
  esitoDivisione,
  nomeDellaFattura,
  pagamentiDaDividere,
  partiPerOrigine,
  righeIniziali,
} from "../../src/lib/calcoli/dividiSpesa.js";

// 🔴 «DIVIDI SU PIÙ VOCI» (12/11/2026, modello approvato da Alessio
//    l'11/11). I conti del modulo: resto, esito, righe che non si capiscono,
//    e la riga «divisa: il resto è su …». Il controllo vero lo fa il
//    database (dividi_spesa, migrazione 20261112000003): qui si prova che
//    la pagina lo dica PRIMA di premere, con le stesse parole.

// formatEUR mette uno spazio che non va a capo prima di «€».
const testo = (s) => s.replace(/ /g, " ");

describe("esitoDivisione: si divide tutta, al centesimo", () => {
  it("San Cataldo: 4.500 + 2.700 di 7.200 è divisa tutta", () => {
    const e = esitoDivisione(7200, [
      { voceId: "forno", testo: "4.500" },
      { voceId: "sedie", testo: "2.700" },
    ], "fattura");
    expect(e.esito).toBe("tutta");
    expect(e.resto).toBe(0);
    expect(testo(e.frase)).toBe("✓ Divisa tutta: restano 0,00 €");
    expect(e.pronta).toBe(true);
    expect(e.parti).toEqual([
      { voceId: "forno", rataId: "", importo: 4500 },
      { voceId: "sedie", rataId: "", importo: 2700 },
    ]);
  });

  it("se manca qualcosa lo dice, e non si salva", () => {
    const e = esitoDivisione(7200, [{ voceId: "forno", testo: "4.500" }, { voceId: "sedie", testo: "2.400" }], "fattura");
    expect(e.esito).toBe("manca");
    expect(testo(e.frase)).toBe("Restano da dividere 300,00 €");
    expect(e.pronta).toBe(false);
  });

  it("se si divide troppo lo dice con la parola giusta (fattura o spesa)", () => {
    const f = esitoDivisione(7200, [{ voceId: "forno", testo: "4.500" }, { voceId: "sedie", testo: "3.000" }], "fattura");
    expect(testo(f.frase)).toBe("Hai diviso 300,00 € in più della fattura");
    const s = esitoDivisione(100, [{ voceId: "forno", testo: "150" }], "prima_nota");
    expect(testo(s.frase)).toBe("Hai diviso 50,00 € in più della spesa");
    expect(s.pronta).toBe(false);
  });

  it("i centesimi tornano: 0,10 + 0,20 fa 0,30, non 0,30000000000000004", () => {
    const e = esitoDivisione(0.3, [{ voceId: "a", testo: "0,10" }, { voceId: "b", testo: "0,20" }]);
    expect(e.esito).toBe("tutta");
    expect(e.pronta).toBe(true);
  });

  it("una parte sola va bene: è «Metti su una voce» per tutto", () => {
    const e = esitoDivisione(1200, [{ voceId: "cappa", testo: "1200" }, { voceId: "", testo: "" }]);
    expect(e.pronta).toBe(true);
    expect(e.parti.length).toBe(1);
  });

  it("la riga vuota non conta e non è un errore; senza parti non si salva", () => {
    const e = esitoDivisione(1200, [{ voceId: "", testo: "" }, { voceId: "", testo: " " }]);
    expect(e.errori).toEqual([]);
    expect(e.pronta).toBe(false);
    expect(testo(e.frase)).toBe("Restano da dividere 1.200,00 €");
  });

  it("le righe che non si capiscono si dicono, una per una, e fermano il salvataggio", () => {
    const e = esitoDivisione(1000, [
      { voceId: "", testo: "500" },
      { voceId: "b", testo: "" },
      { voceId: "c", testo: "tanti" },
      { voceId: "d", testo: "0" },
      { voceId: "e", testo: "1.000" },
    ]);
    expect(e.errori).toEqual([
      "Riga 1: scegli dove va.",
      "Riga 2: scrivi quanto va su questa voce.",
      "Riga 3: non capisco «tanti». Scrivi per esempio 4.500 oppure 1.500,50.",
      "Riga 4: la cifra deve essere più di zero, oppure togli la riga.",
    ]);
    // La riga buona fa già il totale, ma con errori non si salva.
    expect(e.esito).toBe("tutta");
    expect(e.pronta).toBe(false);
  });

  it("la stessa voce due volte si dice (il database la rifiuterebbe)", () => {
    const e = esitoDivisione(1000, [{ voceId: "a", testo: "500" }, { voceId: "a", testo: "500" }]);
    expect(e.errori).toEqual(["Riga 2: questa voce c'è già in un'altra riga. Metti le due cifre in una riga sola."]);
    expect(e.pronta).toBe(false);
  });

  it("una parte su una voce che non si sceglie più (archiviata, madre) si dice, e non si salva", () => {
    const e = esitoDivisione(100, [{ voceId: "vecchia", testo: "100" }], "prima_nota", new Set(["a", "b"]));
    expect(e.errori).toEqual(["Riga 1: questa voce non si sceglie più (archiviata, o divisa in sottovoci). Scegline un'altra."]);
    expect(e.pronta).toBe(false);
    // Finché le voci non si sono lette, non si giudica.
    expect(esitoDivisione(100, [{ voceId: "vecchia", testo: "100" }], "prima_nota", null).pronta).toBe(true);
  });

  it("«16.000» è sedicimila, non sedici (leggiImporto, come il resto della pagina)", () => {
    const e = esitoDivisione(16000, [{ voceId: "a", testo: "16.000" }]);
    expect(e.parti[0].importo).toBe(16000);
    expect(e.pronta).toBe(true);
  });

  it("la rata di una parte che c'era resta con la sua voce", () => {
    const e = esitoDivisione(100, [{ voceId: "a", rataId: "r1", testo: "100" }]);
    expect(e.parti[0]).toEqual({ voceId: "a", rataId: "r1", importo: 100 });
  });
});

describe("righeIniziali: il modulo parte da quello che la spesa ha già", () => {
  it("una spesa nuova: due righe vuote, niente cifra indovinata", () => {
    expect(righeIniziali(7200, [])).toEqual([
      { voceId: "", rataId: "", testo: "" },
      { voceId: "", rataId: "", testo: "" },
    ]);
  });

  it("già in parte su una voce: quella parte, più una riga con il resto", () => {
    expect(righeIniziali(800, [{ voce_id: "affitto", rata_id: null, importo_attribuito: 300 }])).toEqual([
      { voceId: "affitto", rataId: "", testo: "300" },
      { voceId: "", rataId: "", testo: "500" },
    ]);
  });

  it("già divisa tutta: le sue parti, senza righe in più", () => {
    const righe = righeIniziali(7200, [
      { voce_id: "forno", rata_id: "r1", importo_attribuito: 4500 },
      { voce_id: "sedie", rata_id: null, importo_attribuito: 2700.5 },
    ]);
    expect(righe).toEqual([
      { voceId: "forno", rataId: "r1", testo: "4500" },
      { voceId: "sedie", rataId: "", testo: "2700,50" },
    ]);
  });

  it("tutta su una voce: quella, più una riga vuota per dividerla", () => {
    expect(righeIniziali(1200, [{ voce_id: "cappa", importo_attribuito: 1200 }])).toEqual([
      { voceId: "cappa", rataId: "", testo: "1200" },
      { voceId: "", rataId: "", testo: "" },
    ]);
  });
});

describe("le parti di una spesa e la riga «divisa»", () => {
  const coll = [
    { id: "c1", voce_id: "forno", supplier_invoice_id: "f1", importo_attribuito: 4500 },
    { id: "c2", voce_id: "sedie", supplier_invoice_id: "f1", importo_attribuito: 2700 },
    { id: "c3", voce_id: "forno", cash_movement_id: "m1", importo_attribuito: 3000, da_dividere: true },
    { id: "c4", voce_id: "banco", anticipazione_id: "a1", importo_attribuito: 50 },
  ];
  const nomi = { forno: "Cucina calda › Forno combinato", sedie: "Sedie e tavoli", banco: "Banco" };

  it("ogni collegamento sa da quale spesa viene", () => {
    expect(coll.map(chiaveOrigine)).toEqual(["fattura:f1", "fattura:f1", "prima_nota:m1", "anticipazione:a1"]);
    expect(chiaveOrigine({})).toBeNull();
    const per = partiPerOrigine(coll);
    expect(per.get("fattura:f1").map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(per.get("prima_nota:m1").length).toBe(1);
  });

  it("«4.500,00 € di 7.200,00 € · divisa: il resto è su Sedie e tavoli»", () => {
    const d = descriviParte(coll[0], partiPerOrigine(coll).get("fattura:f1"), 7200, (id) => nomi[id]);
    expect(testo(d.cifra)).toBe("4.500,00 € di 7.200,00 €");
    expect(d.divisa).toBe("divisa: il resto è su Sedie e tavoli");
  });

  it("una spesa tutta su una voce dice solo la cifra", () => {
    const d = descriviParte(coll[3], [coll[3]], 50, (id) => nomi[id]);
    expect(testo(d.cifra)).toBe("50,00 €");
    expect(d.divisa).toBeNull();
  });

  it("con tre voci le nomina tutte; senza totale non inventa il «di»", () => {
    const parti = [
      { voce_id: "a", importo_attribuito: 1 },
      { voce_id: "b", importo_attribuito: 2 },
      { voce_id: "c", importo_attribuito: 3 },
    ];
    const d = descriviParte(parti[0], parti, null, (id) => id.toUpperCase());
    expect(testo(d.cifra)).toBe("1,00 €");
    expect(d.divisa).toBe("divisa: il resto è su B e C");
    expect(descriviParte(parti[1], parti, 6, (id) => id.toUpperCase()).divisa).toBe("divisa: il resto è su A e C");
  });

  it("i pagamenti «da dividere» sono quelli con almeno un collegamento segnato", () => {
    const d = pagamentiDaDividere(coll);
    expect(d.map((p) => [p.fonte, p.id, p.parti.length])).toEqual([["prima_nota", "m1", 1]]);
  });

  it("il nome di una fattura collegata", () => {
    expect(nomeDellaFattura({ invoice_number: "14", invoice_date: "2026-11-05", status: "da_pagare", supplier: { name: "San Cataldo" } }))
      .toBe("Fattura n. 14 · 05/11/2026 · San Cataldo · da pagare");
    expect(nomeDellaFattura({ invoice_number: null, status: "pagata" })).toBe("Fattura senza numero");
    expect(nomeDellaFattura(null)).toBe("Fattura");
  });
});

describe("barraDivisione", () => {
  it("le parti in percento del totale, mai oltre il 100% in tutto", () => {
    expect(barraDivisione(7200, [{ importo: 4500 }, { importo: 2700 }])).toEqual([62.5, 37.5]);
    expect(barraDivisione(100, [{ importo: 80 }, { importo: 50 }])).toEqual([80, 20]);
    expect(barraDivisione(0, [{ importo: 10 }])).toEqual([0]);
  });
});
