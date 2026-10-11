import { describe, expect, it } from "vitest";
import { notaDalleRicette, righeDaMettere, rigaDiRicetta } from "../../src/lib/calcoli/estrapola";

// «Estrapola» (R11, 11/10/2026): cosa parte verso la lista della spesa.

const P = [
  { chiave: "abc|g", ingredient_id: "abc", nome: "guanciale", unita: "g", quantita: 600, da: ["Amatriciana", "Gricia"] },
  { chiave: "nome:sale|", ingredient_id: null, nome: "sale", unita: null, quantita: null, da: ["Gricia"] },
  { chiave: "ricetta:r9", ingredient_id: null, nome: "Pane", unita: null, quantita: null, da: ["Pane"], problema: "la ricetta non ha ancora ingredienti" },
];

describe("le righe che vanno in lista", () => {
  it("solo quelle tenute, ognuna col legame alle ricette che l'hanno generata", () => {
    const r = righeDaMettere(P, { "abc|g": true, "nome:sale|": false }, {});
    expect(r).toEqual([
      { ingredient_id: "abc", nome: "guanciale", quantita: 600, unita: "g", nota: "Dalle ricette: Amatriciana, Gricia" },
    ]);
  });

  it("la quantità corretta a mano vince, anche con la virgola", () => {
    expect(righeDaMettere(P, { "abc|g": true }, { "abc|g": "450,5" })[0].quantita).toBe(450.5);
  });

  it("⚠️ una quantità svuotata o assente va in lista vuota, mai zero", () => {
    expect(righeDaMettere(P, { "abc|g": true }, { "abc|g": "" })[0].quantita).toBeNull();
    expect(righeDaMettere(P, { "nome:sale|": true }, {})[0].quantita).toBeNull();
  });

  it("una ricetta che non si è potuta estrapolare non diventa una riga di lista", () => {
    expect(rigaDiRicetta(P[2])).toBe(true);
    expect(righeDaMettere(P, { "ricetta:r9": true }, {})).toEqual([]);
  });

  it("la nota al singolare e al plurale", () => {
    expect(notaDalleRicette(["Gricia"])).toBe("Dalla ricetta: Gricia");
    expect(notaDalleRicette([])).toBeNull();
  });
});
