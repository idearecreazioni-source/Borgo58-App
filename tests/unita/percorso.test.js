import { describe, expect, it } from "vitest";
import { percorsoEntrando, ritornoIndietro } from "../../src/lib/calcoli/percorso";

const ELENCO = { elenco: "/ricettario/ricette", etichettaElenco: "Ricette" };

describe("il percorso inverso fra le ricette", () => {
  it("senza percorso, il ritorno è l'elenco — cioè come si comportava prima", () => {
    expect(ritornoIndietro([], ELENCO)).toEqual({
      a: "/ricettario/ricette",
      etichetta: "Ricette",
      percorso: [],
    });
    expect(ritornoIndietro(undefined, ELENCO).etichetta).toBe("Ricette");
  });

  it("entrando in una preparazione, il ritorno porta alla ricetta di prima e la NOMINA", () => {
    const p = percorsoEntrando([], { id: "ragu", nome: "Ragù alla siciliana" });
    const r = ritornoIndietro(p, ELENCO);
    expect(r.a).toBe("/ricettario/ricette/ragu");
    expect(r.etichetta).toBe("Ragù alla siciliana");
  });

  it("a tre livelli si torna un passo per volta, mai all'elenco", () => {
    // ⚠️ È il caso di Alessio: un ragù che contiene un soffritto che
    // contiene altro. Prima di oggi, da «altro» si finiva in «Ricette».
    let p = percorsoEntrando([], { id: "ragu", nome: "Ragù" });
    p = percorsoEntrando(p, { id: "soffritto", nome: "Soffritto" });

    const primo = ritornoIndietro(p, ELENCO);
    expect(primo.etichetta).toBe("Soffritto");

    const secondo = ritornoIndietro(primo.percorso, ELENCO);
    expect(secondo.etichetta).toBe("Ragù");

    const terzo = ritornoIndietro(secondo.percorso, ELENCO);
    expect(terzo.etichetta).toBe("Ricette");
  });

  it("tornare su un passo già fatto ACCORCIA il percorso invece di allungarlo", () => {
    // ⚠️ Senza questo, il giro A → B → A → B crescerebbe all'infinito: ogni
    // ricetta elenca sia i propri componenti sia le ricette che la usano,
    // quindi si torna indietro «in avanti» senza accorgersene.
    let p = percorsoEntrando([], { id: "a", nome: "A" });
    p = percorsoEntrando(p, { id: "b", nome: "B" });
    p = percorsoEntrando(p, { id: "a", nome: "A" }); // si rientra in A

    expect(p).toEqual([]); // A era il primo passo: il percorso torna a zero
    expect(ritornoIndietro(p, ELENCO).etichetta).toBe("Ricette");
  });

  it("il percorso che si porta dietro NON contiene il passo in cui si sta tornando", () => {
    // Senza questo taglio si rientrerebbe in sé stessi al giro successivo.
    let p = percorsoEntrando([], { id: "ragu", nome: "Ragù" });
    p = percorsoEntrando(p, { id: "soffritto", nome: "Soffritto" });
    expect(ritornoIndietro(p, ELENCO).percorso).toEqual([{ id: "ragu", nome: "Ragù" }]);
  });

  it("un passo senza nome non produce una freccia nuda", () => {
    const p = percorsoEntrando([], { id: "x", nome: "   " });
    expect(ritornoIndietro(p, ELENCO).etichetta).toBe("Ricette");
  });

  it("un passo con una destinazione propria la usa (si entra anche da un menu)", () => {
    const p = [{ id: "m1", nome: "Carta d'estate", a: "/ricettario/menu/m1" }];
    expect(ritornoIndietro(p, ELENCO)).toEqual({
      a: "/ricettario/menu/m1",
      etichetta: "Carta d'estate",
      percorso: [],
    });
  });
});
