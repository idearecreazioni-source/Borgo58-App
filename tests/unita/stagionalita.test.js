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

  it("toccando un mese con «tutto l'anno» acceso resta quel mese solo (12/09/2026)", () => {
    // ⚠️ Fino all'11/09 restavano undici mesi: il verso è stato cambiato dal
    //    mandato notturno del 12/09 — «Tutto l'anno» è l'alternativa ai mesi.
    //    Uno e undici si distinguono: la prova discrimina.
    expect(stagionalitaDopoIlTocco([TUTTO_ANNO], "ago")).toEqual(["ago"]);
  });

  it("l'ordine dei mesi è quello del calendario, non quello dell'alfabeto", () => {
    expect(stagionalitaDopoIlTocco(["dic", "gen"], "ago")).toEqual(["gen", "ago", "dic"]);
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

  it("con «tutto l'anno» scritto, a schermo si vede acceso solo lui (12/09/2026)", () => {
    expect(meseAcceso([TUTTO_ANNO], "ago")).toBe(false);
    expect(meseAcceso([TUTTO_ANNO], TUTTO_ANNO)).toBe(true);
    // Dati di prima con le due forme insieme: vince «tutto l'anno».
    expect(meseAcceso([TUTTO_ANNO, "ago"], "ago")).toBe(false);
    expect(meseAcceso(["gen"], "gen")).toBe(true);
    expect(meseAcceso(["gen"], "ago")).toBe(false);
    expect(meseAcceso(["gen"], TUTTO_ANNO)).toBe(false);
  });
});
