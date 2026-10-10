import { beforeEach, describe, expect, it, vi } from "vitest";

// =====================================================================
// UN ELENCO OLTRE LE MILLE RIGHE TORNA INTERO — 26/09/2026
// =====================================================================
// 🔴 Il progetto Supabase consegna al massimo mille righe per richiesta,
//    senza errore. Misurato sul progetto di prova: 1388 prodotti, 1000
//    consegnati, e undici prodotti veri fuori da ogni elenco.
//
// ⚠️ Il database qui è FINTO e ha un tetto suo, come quello vero: a ogni
//    richiesta restituisce al massimo `tetto` righe, qualunque intervallo
//    gli si chieda. È così che si prova la parte che conta — che si avanzi
//    di quante righe sono arrivate, non di quante se ne sono chieste.

const { leggiTutte, PASSO_LETTURA } = await import("../../src/lib/leggiTutte");

// Una tabella finta: righe già ordinate, un tetto per richiesta, e il
// registro degli intervalli chiesti.
function tabellaFinta(n, { tetto = 1000, errore = null, senzaConteggio = false } = {}) {
  const righe = Array.from({ length: n }, (_, i) => ({ id: `r${String(i).padStart(5, "0")}` }));
  const chieste = [];
  const crea = () => ({
    range(da, a) {
      chieste.push([da, a]);
      if (errore) return Promise.resolve({ data: null, error: errore, count: null });
      const fine = Math.min(a + 1, da + tetto, righe.length);
      return Promise.resolve({
        data: righe.slice(da, fine),
        error: null,
        count: senzaConteggio ? null : righe.length,
      });
    },
  });
  return { righe, chieste, crea };
}

const senzaDoppioni = (lista) => new Set(lista.map((r) => r.id)).size === lista.length;

describe("🔴 leggiTutte: l'elenco torna intero, in ordine, senza doppioni", () => {
  it("2500 righe con un tetto di 1000: tre pagine, tutte le righe", async () => {
    const t = tabellaFinta(2500);
    const letto = await leggiTutte(t.crea);
    expect(letto).toHaveLength(2500);
    expect(letto).toEqual(t.righe);
    expect(senzaDoppioni(letto)).toBe(true);
    expect(t.chieste).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("1388 righe — il caso misurato — tornano tutte e 1388", async () => {
    const t = tabellaFinta(1388);
    const letto = await leggiTutte(t.crea);
    expect(letto).toHaveLength(1388);
    expect(letto.at(-1).id).toBe("r01387");
    expect(senzaDoppioni(letto)).toBe(true);
  });

  it("🔴 se il tetto del progetto è più basso del passo, non salta righe", async () => {
    // Col tetto a 700 e il passo a 1000, avanzare di 1000 perderebbe le
    // righe 700-999 di ogni pagina, senza nessun errore.
    const t = tabellaFinta(2100, { tetto: 700 });
    const letto = await leggiTutte(t.crea);
    expect(letto).toEqual(t.righe);
    expect(t.chieste.map(([da]) => da)).toEqual([0, 700, 1400]);
  });

  it("sotto il passo basta una richiesta sola", async () => {
    const t = tabellaFinta(12);
    expect(await leggiTutte(t.crea)).toEqual(t.righe);
    expect(t.chieste).toHaveLength(1);
  });

  it("un elenco vuoto torna vuoto, con una richiesta", async () => {
    const t = tabellaFinta(0);
    expect(await leggiTutte(t.crea)).toEqual([]);
    expect(t.chieste).toHaveLength(1);
  });

  it("l'errore del database arriva a chi chiama, com'era", async () => {
    const errore = { message: "permission denied", code: "42501" };
    const t = tabellaFinta(10, { errore });
    await expect(leggiTutte(t.crea)).rejects.toBe(errore);
  });

  it("senza conteggio non si indovina quando fermarsi: si dice", async () => {
    const t = tabellaFinta(10, { senzaConteggio: true });
    await expect(leggiTutte(t.crea)).rejects.toThrow(/count: "exact"/);
  });

  it("il passo è mille, come il tetto del progetto", () => {
    expect(PASSO_LETTURA).toBe(1000);
  });
});

// =====================================================================
// LE TRE LETTURE USANO LA PAGINAZIONE, e tengono filtri e ordine
// =====================================================================
// ⚠️ Un costruttore finto registra ogni chiamata: così si vede che i
//    filtri di prima ci sono ancora, che l'ordine per nome viene prima di
//    quello per `id`, e che si chiede il conteggio.

const chiamate = [];
let totaleFinto = 0;

function costruttore(tabella) {
  const passi = [["from", tabella]];
  chiamate.push(passi);
  const b = {
    select: (...a) => (passi.push(["select", ...a]), b),
    order: (...a) => (passi.push(["order", ...a]), b),
    eq: (...a) => (passi.push(["eq", ...a]), b),
    is: (...a) => (passi.push(["is", ...a]), b),
    ilike: (...a) => (passi.push(["ilike", ...a]), b),
    range(da, a) {
      passi.push(["range", da, a]);
      const fine = Math.min(a + 1, da + 1000, totaleFinto);
      const data = Array.from({ length: Math.max(0, fine - da) }, (_, i) => ({ id: `x${da + i}` }));
      return Promise.resolve({ data, error: null, count: totaleFinto });
    },
  };
  return b;
}

vi.mock("../../src/lib/supabase", () => ({
  supabase: { from: (t) => costruttore(t), rpc: vi.fn() },
  supabasePubblico: {},
}));
vi.mock("../../src/lib/operazioni", () => ({ eseguiOperazione: vi.fn() }));
vi.mock("../../src/lib/chiamaFunzione", () => ({ chiamaFunzione: vi.fn() }));

const { listIngredients } = await import("../../src/lib/api/ingredients");
const { listStockLevels } = await import("../../src/lib/api/stock");
const { listOrigineAllergeni } = await import("../../src/lib/api/schedeProdotto");

const passiDi = (i) => chiamate[i].filter(([p]) => p !== "range");
const intervalli = () => chiamate.flatMap((c) => c.filter(([p]) => p === "range").map(([, da, a]) => [da, a]));

describe("🔴 le tre letture dei prodotti non si fermano a mille", () => {
  beforeEach(() => {
    chiamate.length = 0;
    totaleFinto = 1388;
  });

  it("listIngredients: 1388 prodotti in due pagine, coi filtri di sempre", async () => {
    const r = await listIngredients();
    expect(r).toHaveLength(1388);
    expect(senzaDoppioni(r)).toBe(true);
    expect(intervalli()).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
    // Ogni pagina è la stessa lettura rifatta da capo.
    for (let i = 0; i < chiamate.length; i++) {
      const p = passiDi(i);
      expect(p[0]).toEqual(["from", "ingredients"]);
      expect(p).toContainEqual(["select", expect.any(String), { count: "exact" }]);
      expect(p).toContainEqual(["eq", "active", true]);
      expect(p).toContainEqual(["is", "preparazione_id", null]);
      expect(p).toContainEqual(["eq", "alimentare", true]);
      const ordini = p.filter(([x]) => x === "order").map(([, c]) => c);
      expect(ordini).toEqual(["name", "id"]);
    }
  });

  it("listIngredients tiene anche ricerca, categoria e «tutti e due»", async () => {
    totaleFinto = 5;
    await listIngredients({ search: "tonno", category: "pesce", alimentare: null, includiNonAttivi: true });
    const p = passiDi(0);
    expect(p).toContainEqual(["ilike", "name", "%tonno%"]);
    expect(p).toContainEqual(["eq", "category", "pesce"]);
    expect(p).not.toContainEqual(["eq", "active", true]);
    expect(p.some(([x, c]) => x === "eq" && c === "alimentare")).toBe(false);
  });

  it("listStockLevels: tutte le righe, per nome e poi per prodotto", async () => {
    const r = await listStockLevels();
    expect(r).toHaveLength(1388);
    expect(intervalli()).toHaveLength(2);
    const p = passiDi(0);
    expect(p[0]).toEqual(["from", "v_stock_levels"]);
    expect(p).toContainEqual(["select", "*", { count: "exact" }]);
    expect(p.filter(([x]) => x === "order").map(([, c]) => c)).toEqual(["ingredient_name", "ingredient_id"]);
  });

  it("listOrigineAllergeni: tutte le righe, coi due filtri", async () => {
    const r = await listOrigineAllergeni();
    expect(r).toHaveLength(1388);
    expect(intervalli()).toHaveLength(2);
    const p = passiDi(0);
    expect(p).toContainEqual(["eq", "active", true]);
    expect(p).toContainEqual(["eq", "alimentare", true]);
    expect(p.filter(([x]) => x === "order").map(([, c]) => c)).toEqual(["name", "id"]);
  });
});
