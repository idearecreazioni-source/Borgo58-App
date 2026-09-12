import { describe, expect, it } from "vitest";
import {
  MESI_DELL_ANNO,
  TUTTO_ANNO,
  meseAcceso,
  stagionalitaDopoIlTocco,
  stagionalitaNormalizzata,
  stagioneAccesa,
  stagioniDopoIlTocco,
  stagioniNormalizzate,
} from "../../src/lib/calcoli/stagionalita";

// LE STAGIONI DI UNA RICETTA — 12/09/2026, mandato notturno, blocco A.
// «Tutto l'anno» è l'ALTERNATIVA a Primavera, Estate, Autunno e Inverno:
// accenderlo spegne le stagioni, accendere una stagione lo spegne.
describe("le stagioni di una ricetta", () => {
  it("accendere «Tutto l'anno» spegne le stagioni singole", () => {
    expect(stagioniDopoIlTocco(["estate", "autunno"], TUTTO_ANNO)).toEqual([TUTTO_ANNO]);
  });

  it("accendere una stagione spegne «Tutto l'anno», e resta solo lei", () => {
    // ⚠️ Non «le altre tre»: per le stagioni «Tutto l'anno» non si apre
    //    nelle quattro, come fanno i mesi di un ingrediente. Qui le due
    //    forme sono alternative e basta.
    expect(stagioniDopoIlTocco([TUTTO_ANNO], "estate")).toEqual(["estate"]);
  });

  it("spegnere «Tutto l'anno» lascia vuoto, cioè «non l'ha ancora detto nessuno»", () => {
    expect(stagioniDopoIlTocco([TUTTO_ANNO], TUTTO_ANNO)).toEqual([]);
  });

  it("le stagioni singole si accendono e si spengono come prima, nell'ordine dell'anno", () => {
    expect(stagioniDopoIlTocco(["inverno"], "primavera")).toEqual(["primavera", "inverno"]);
    expect(stagioniDopoIlTocco(["primavera", "inverno"], "inverno")).toEqual(["primavera"]);
  });

  it("dati di prima con le due forme insieme: vince «Tutto l'anno»", () => {
    expect(stagioniNormalizzate([TUTTO_ANNO, "estate"])).toEqual([TUTTO_ANNO]);
    expect(stagioneAccesa([TUTTO_ANNO, "estate"], TUTTO_ANNO)).toBe(true);
    expect(stagioneAccesa([TUTTO_ANNO, "estate"], "estate")).toBe(false);
    // …e toccando una stagione da lì si riparte da quella, non da «estate»
    // rimasta sotto.
    expect(stagioniDopoIlTocco([TUTTO_ANNO, "estate"], "inverno")).toEqual(["inverno"]);
  });

  it("le quattro stagioni sono «Tutto l'anno», a schermo e quando si salva", () => {
    // Decisione di Alessio del 12/09/2026, come i dodici mesi dal 29/08.
    const quattro = ["primavera", "estate", "autunno", "inverno"];
    expect(stagioniNormalizzate(quattro)).toEqual([TUTTO_ANNO]);
    // Tre restano tre: è il caso che dimostra che la regola discrimina.
    expect(stagioniNormalizzate(["primavera", "estate", "autunno"])).toEqual(["primavera", "estate", "autunno"]);
    // Dati di prima con le quattro scritte una per una: si vede «Tutto l'anno».
    expect(stagioneAccesa(quattro, TUTTO_ANNO)).toBe(true);
    expect(stagioneAccesa(quattro, "estate")).toBe(false);
    // Accendendo la quarta si arriva a «Tutto l'anno».
    expect(stagioniDopoIlTocco(["primavera", "estate", "autunno"], "inverno")).toEqual([TUTTO_ANNO]);
  });

  it("vuoto resta vuoto, e un valore che non si conosce non si butta via", () => {
    expect(stagioniNormalizzate([])).toEqual([]);
    expect(stagioniNormalizzate(null)).toEqual([]);
    // ⚠️ Salvare la scheda non deve cancellare in silenzio quello che non
    //    si sa leggere: resta, in fondo.
    expect(stagioniNormalizzate(["estate", "ignota"])).toEqual(["estate", "ignota"]);
  });
});

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
