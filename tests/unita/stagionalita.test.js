import { describe, expect, it } from "vitest";
import {
  MESI_DELL_ANNO,
  TUTTO_ANNO,
  meseAcceso,
  stagionalitaDopoIlTocco,
  stagionalitaNormalizzata,
} from "../../src/lib/calcoli/stagionalita";

// ⚠️ QUESTE PROVE MISURANO UNA DIFFERENZA, non una coincidenza: ogni caso
// è scelto perché la risposta sbagliata sarebbe DIVERSA da quella giusta.
// Un elenco di undici mesi e uno di dodici si distinguono; uno di due e
// uno di due no, e infatti qui non ce ne sono.
describe("la stagionalità di un prodotto", () => {
  it("dodici mesi accesi diventano «tutto l'anno»", () => {
    expect(stagionalitaNormalizzata(MESI_DELL_ANNO)).toEqual([TUTTO_ANNO]);
  });

  it("undici mesi restano undici — è il verso che dimostra che discrimina", () => {
    const undici = MESI_DELL_ANNO.filter((m) => m !== "ago");
    expect(stagionalitaNormalizzata(undici)).toEqual(undici);
  });

  it("togliendo un mese da «tutto l'anno» restano undici mesi, non zero", () => {
    const dopo = stagionalitaDopoIlTocco([TUTTO_ANNO], "ago");
    expect(dopo).toHaveLength(11);
    expect(dopo).not.toContain("ago");
    expect(dopo).not.toContain(TUTTO_ANNO);
    // L'ordine è quello del calendario, non quello dell'alfabeto.
    expect(dopo[0]).toBe("gen");
    expect(dopo[dopo.length - 1]).toBe("dic");
  });

  it("accendendo l'ultimo mese mancante si arriva a «tutto l'anno»", () => {
    const undici = MESI_DELL_ANNO.filter((m) => m !== "ago");
    expect(stagionalitaDopoIlTocco(undici, "ago")).toEqual([TUTTO_ANNO]);
  });

  it("«tutto l'anno» è un interruttore: spegnendolo resta vuoto", () => {
    expect(stagionalitaDopoIlTocco([TUTTO_ANNO], TUTTO_ANNO)).toEqual([]);
    expect(stagionalitaDopoIlTocco([], TUTTO_ANNO)).toEqual([TUTTO_ANNO]);
  });

  it("«tutto l'anno» insieme ai mesi si riduce a «tutto l'anno»", () => {
    expect(stagionalitaNormalizzata([TUTTO_ANNO, "gen", "feb"])).toEqual([TUTTO_ANNO]);
  });

  it("i doppioni spariscono e l'ordine è quello del calendario", () => {
    expect(stagionalitaNormalizzata(["mar", "gen", "gen", "feb"])).toEqual([
      "gen",
      "feb",
      "mar",
    ]);
  });

  it("vuoto resta vuoto: «nessuno l'ha ancora detto» non è «tutto l'anno»", () => {
    // ⚠️ È la distinzione su cui questo progetto è già inciampato più volte:
    // assenza di informazione non è informazione di assenza. Un elenco
    // vuoto NON deve diventare «tutto l'anno», o 82 prodotti su 133
    // direbbero da soli una cosa che nessuno ha scritto.
    expect(stagionalitaNormalizzata([])).toEqual([]);
    expect(stagionalitaNormalizzata(null)).toEqual([]);
  });

  it("con «tutto l'anno» scritto, a schermo i dodici mesi si vedono accesi", () => {
    expect(meseAcceso([TUTTO_ANNO], "ago")).toBe(true);
    expect(meseAcceso([TUTTO_ANNO], TUTTO_ANNO)).toBe(true);
    expect(meseAcceso(["gen"], "ago")).toBe(false);
    expect(meseAcceso(["gen"], TUTTO_ANNO)).toBe(false);
  });
});
