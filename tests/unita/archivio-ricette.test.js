import { describe, expect, it } from "vitest";
import {
  aggiungiTag,
  allergeniDellaRicetta,
  eSenza,
  filtraBozze,
  normalizzaTag,
  tagUsati,
  togliTag,
} from "../../src/lib/calcoli/archivioRicette";

// L'archivio delle ricette (25/10/2026): tag, allergeni d'archivio, filtri.

describe("i tag", () => {
  it("si scrivono in un modo solo", () => {
    expect(normalizzaTag("  Al   Cucchiaio ")).toBe("al cucchiaio");
    expect(normalizzaTag("x".repeat(40))).toHaveLength(30);
    expect(normalizzaTag(null)).toBe("");
  });
  it("non si doppiano e un tag vuoto non cambia niente", () => {
    expect(aggiungiTag(["siciliana"], "Siciliana")).toEqual(["siciliana"]);
    expect(aggiungiTag(["siciliana"], "  ")).toEqual(["siciliana"]);
    expect(aggiungiTag(null, "estiva")).toEqual(["estiva"]);
    expect(togliTag(["a", "b"], "a")).toEqual(["b"]);
  });
  it("l'elenco dei tag usati è unico e in ordine", () => {
    expect(tagUsati([{ tags: ["zuppe", "siciliana"] }, { tags: ["siciliana"] }, { tags: null }])).toEqual([
      "siciliana",
      "zuppe",
    ]);
  });
});

describe("gli allergeni di una ricetta", () => {
  const vista = { allergens: ["latte"], allergeni_da_verificare: false };

  it("tutta collegata: comandano i prodotti", () => {
    expect(allergeniDellaRicetta({}, vista, false)).toEqual({ noti: true, elenco: ["latte"], origine: "prodotti" });
  });

  it("tutta collegata ma con prodotti da verificare, o senza riga: non si sa", () => {
    expect(allergeniDellaRicetta({}, { ...vista, allergeni_da_verificare: true }, false).noti).toBe(false);
    expect(allergeniDellaRicetta({}, undefined, false).noti).toBe(false);
  });

  // 🔴 Il caso che il filtro faceva passare prima del 25/10: metà collegata,
  // e la metà collegata non ha glutine.
  it("con ingredienti da collegare e nessun elenco d'archivio: non si sa, anche se la vista dice «senza»", () => {
    const a = allergeniDellaRicetta({ allergeni_archivio: null }, vista, true);
    expect(a.noti).toBe(false);
    expect(eSenza(a, "glutine")).toBe(false);
  });

  it("con l'elenco d'archivio: l'unione con i prodotti già collegati, e la sua origine", () => {
    const a = allergeniDellaRicetta(
      { allergeni_archivio: ["glutine"], allergeni_archivio_origine: "proposti" },
      vista,
      true,
    );
    expect(a).toEqual({ noti: true, elenco: ["glutine", "latte"], origine: "proposti" });
    expect(eSenza(a, "glutine")).toBe(false);
    expect(eSenza(a, "latte")).toBe(false);
    expect(eSenza(a, "uova")).toBe(true);
  });

  it("un elenco d'archivio VUOTO è una risposta: nessun allergene", () => {
    const a = allergeniDellaRicetta({ allergeni_archivio: [], allergeni_archivio_origine: "confermati" }, undefined, true);
    expect(a.noti).toBe(true);
    expect(eSenza(a, "glutine")).toBe(true);
  });
});

describe("il filtro delle bozze", () => {
  const bozze = [
    { titolo: "Crema di ricotta", categoria: "dolce", tipo: "preparazione", stato: "in_revisione", tags: ["siciliana"] },
    { titolo: "Pasta alla Norma", categoria: "primo", tipo: null, stato: "ispirazione", tags: [] },
    { titolo: "Cannolo", categoria: "dolce", tipo: "piatto_finito", stato: "in_revisione", promossa_il: "2026-10-01", tags: ["siciliana"] },
  ];
  const titoli = (f) => filtraBozze(bozze, f).map((b) => b.titolo);

  it("senza filtri restano tutte", () => expect(titoli()).toHaveLength(3));
  it("cerca nel titolo senza badare alle maiuscole", () => expect(titoli({ testo: "norma" })).toEqual(["Pasta alla Norma"]));
  it("un tipo vuoto vale «piatto»", () => expect(titoli({ tipo: "piatto_finito" })).toEqual(["Pasta alla Norma", "Cannolo"]));
  it("categoria e tag insieme", () => expect(titoli({ categoria: "dolce", tag: "siciliana" })).toEqual(["Crema di ricotta", "Cannolo"]));
  it("una bozza promossa non è più «da rivedere», è «diventata ricetta»", () => {
    expect(titoli({ stato: "in_revisione" })).toEqual(["Crema di ricotta"]);
    expect(titoli({ stato: "diventata" })).toEqual(["Cannolo"]);
  });
});

import { cambiaAllergene } from "../../src/lib/calcoli/archivioRicette";

describe("gli allergeni si toccano", () => {
  it("toccare un allergene parte da «non detto» e arriva a un elenco", () => {
    expect(cambiaAllergene(null, "latte")).toEqual(["latte"]);
    expect(cambiaAllergene(["latte", "uova"], "latte")).toEqual(["uova"]);
  });
});
