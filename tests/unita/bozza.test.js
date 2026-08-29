import { describe, expect, it } from "vitest";
import {
  cosaSiConserva,
  daConservare,
  MINUTI_DI_VALIDITA,
  nomeDelCampo,
  numera,
  siRimette,
} from "../../src/lib/calcoli/bozza";

// QUELLO CHE SI STA SCRIVENDO SOPRAVVIVE A UNA RICARICA — provato al
// contrario.
//
// ⚠️ Le due regole che contano qui non si vedono guardando lo schermo, e
// sbagliandole si sbaglia in silenzio: il PIN che non deve MAI essere
// conservato, e il vuoto che non deve MAI essere conservato (perché
// rimetterlo cancellerebbe dei dati veri arrivati nel frattempo).

const campo = (extra) => ({
  tipo: "text", nome: "", soloLettura: false, spento: false,
  fuoriBozza: false, valore: "", spuntato: false, attorno: "", ...extra,
});

describe("cosa si conserva e cosa no", () => {
  it("🔴 il PIN non si conserva, per nessun motivo", () => {
    expect(daConservare(campo({ tipo: "password", valore: "1234" }))).toBe(false);
    const dentro = cosaSiConserva([campo({ tipo: "password", valore: "1234", attorno: "PIN" })]);
    expect(Object.keys(dentro)).toHaveLength(0);
    expect(JSON.stringify(dentro)).not.toContain("1234");
  });

  it("non si conserva quello che non si può rimettere né toccare", () => {
    expect(daConservare(campo({ tipo: "file" }))).toBe(false);
    expect(daConservare(campo({ soloLettura: true }))).toBe(false);
    expect(daConservare(campo({ spento: true }))).toBe(false);
    expect(daConservare(campo({ fuoriBozza: true }))).toBe(false);
  });

  it("si conserva un campo di testo pieno", () => {
    expect(daConservare(campo({ valore: "Caponata" }))).toBe(true);
  });

  it("🔴 il VUOTO non si conserva: rimetterlo cancellerebbe dati veri", () => {
    // Il caso vero: si mette l'app in secondo piano mentre i dati stanno
    // ancora arrivando, quindi i campi sono vuoti. Se il vuoto si
    // conservasse, la ricarica dopo svuoterebbe la scheda.
    const dentro = cosaSiConserva([
      campo({ nome: "nome", valore: "" }),
      campo({ nome: "prezzo", valore: "" }),
    ]);
    expect(dentro).toEqual({});
  });

  it("una casella si conserva solo se è spuntata", () => {
    const spuntata = cosaSiConserva([campo({ tipo: "checkbox", nome: "carta", spuntato: true })]);
    const no = cosaSiConserva([campo({ tipo: "checkbox", nome: "carta", spuntato: false })]);
    expect(Object.values(spuntata)).toEqual([true]);
    expect(no).toEqual({});
  });
});

describe("ritrovare il campo giusto", () => {
  it("due campi che si somigliano si distinguono per posto", () => {
    const c = numera([
      campo({ nome: "", tipo: "number", valore: "1" }),
      campo({ nome: "", tipo: "number", valore: "2" }),
    ]);
    expect(c.map((x) => x.posto)).toEqual([0, 1]);
    expect(nomeDelCampo(c[0])).not.toBe(nomeDelCampo(c[1]));
  });

  it("🔴 se la parola accanto cambia, il campo NON si riconosce più", () => {
    // È il verso giusto in cui sbagliare: un elenco che arriva dal database
    // più tardi sposta le righe, e un valore rimesso nel campo sbagliato
    // sarebbe peggio di un valore non rimesso.
    const prima = numera([campo({ tipo: "number", attorno: "Quantità" })])[0];
    const dopo = numera([campo({ tipo: "number", attorno: "Prezzo" })])[0];
    expect(nomeDelCampo(prima)).not.toBe(nomeDelCampo(dopo));
  });

  it("lo stesso campo si riconosce", () => {
    const a = numera([campo({ nome: "nome", attorno: "Nome" })])[0];
    const b = numera([campo({ nome: "nome", attorno: "Nome" })])[0];
    expect(nomeDelCampo(a)).toBe(nomeDelCampo(b));
  });
});

describe("quando una fotografia si rimette", () => {
  const adesso = 1_700_000_000_000;
  const buona = { dove: "/ricettario/7", quando: adesso - 60_000, campi: { a: "x" } };

  it("si rimette quella recente della stessa schermata", () => {
    expect(siRimette(buona, "/ricettario/7", adesso).rimetti).toBe(true);
  });

  it("NON si rimette su un'altra schermata, e lo dice", () => {
    const e = siRimette(buona, "/ricettario/9", adesso);
    expect(e.rimetti).toBe(false);
    expect(e.perche).toMatch(/altra schermata/);
  });

  it("NON si rimette una vecchia, e lo dice", () => {
    const vecchia = { ...buona, quando: adesso - (MINUTI_DI_VALIDITA + 1) * 60_000 };
    const e = siRimette(vecchia, "/ricettario/7", adesso);
    expect(e.rimetti).toBe(false);
    expect(e.perche).toMatch(/troppo tempo/);
  });

  it("quando non ce n'è, dice che non ce n'è — non risponde di sì", () => {
    expect(siRimette(null, "/x", adesso)).toEqual({ rimetti: false, perche: "non ce n'e'" });
    expect(siRimette({ dove: "/x", quando: adesso, campi: {} }, "/x", adesso).rimetti).toBe(false);
  });

  it("una data storta non passa per recente", () => {
    expect(siRimette({ ...buona, quando: "ieri" }, "/ricettario/7", adesso).rimetti).toBe(false);
  });
});
