import { describe, expect, it } from "vitest";
import {
  INDIRIZZO_MEMO,
  eMemo,
  nomeDellaPartenza,
  origineValida,
  ritornoDaMemo,
  statoVersoMemo,
} from "../../src/lib/calcoli/ritornoMemo";
import { MODULES } from "../../src/data/modules";

// =====================================================================
// IL RITORNO DA MEMO VOCE — 11/09/2026, mandato «MEMO affidabile»
// =====================================================================
// 🔴 COSA TENGONO FERMO QUESTE PROVE: si torna SOLO dentro il gestionale,
//    mai in MEMO stesso, e la partenza non si perde toccando di nuovo
//    «MEMO voce» mentre si è già lì.

describe("a quale indirizzo si può tornare", () => {
  it("una schermata del gestionale sì, anche con la sua domanda", () => {
    expect(origineValida("/cassa")).toBe("/cassa");
    expect(origineValida("/cassa/prima-nota?dal=2026-09-01")).toBe("/cassa/prima-nota?dal=2026-09-01");
  });

  it("🔴 un altro sito NO, in nessuna delle sue forme", () => {
    for (const fuori of ["//altro.it/x", "https://altro.it", "javascript:alert(1)", "cassa", "/a\\b"]) {
      expect(origineValida(fuori), fuori).toBeNull();
    }
  });

  it("⚠️ MEMO stesso e la pagina d'ingresso NO", () => {
    expect(origineValida(INDIRIZZO_MEMO)).toBeNull();
    expect(origineValida(`${INDIRIZZO_MEMO}?x=1`)).toBeNull();
    expect(origineValida(`${INDIRIZZO_MEMO}/altro`)).toBeNull();
    expect(origineValida("/login")).toBeNull();
  });

  it("un valore che non è testo non è un indirizzo", () => {
    for (const v of [null, undefined, 42, {}, []]) expect(origineValida(v)).toBeNull();
  });

  it("«/dettatura» non è MEMO: si confronta il percorso, non l'inizio della parola", () => {
    expect(eMemo("/dettatura")).toBe(false);
    expect(eMemo("/detta")).toBe(true);
  });
});

describe("che cosa si porta dietro il collegamento verso MEMO", () => {
  it("da una schermata: l'indirizzo intero, domanda compresa", () => {
    expect(statoVersoMemo({ pathname: "/agenda", search: "?corsia=ritardo" })).toEqual({
      da: "/agenda?corsia=ritardo",
    });
  });

  it("🔴 da MEMO stesso la partenza di prima NON si perde", () => {
    expect(statoVersoMemo({ pathname: "/detta", state: { da: "/cassa" } })).toEqual({ da: "/cassa" });
  });

  it("da MEMO senza partenza, niente — e una partenza storta non passa", () => {
    expect(statoVersoMemo({ pathname: "/detta" })).toBeNull();
    expect(statoVersoMemo({ pathname: "/detta", state: { da: "//altro.it" } })).toBeNull();
  });

  it("⚠️ porta con sé SOLO l'indirizzo: nessun contesto del modulo per la voce", () => {
    // Se un giorno qui dentro comparisse «modulo: agenda», la stessa frase
    // detta da due schermate diverse potrebbe diventare due cose diverse.
    const stato = statoVersoMemo({ pathname: "/agenda", search: "" });
    expect(Object.keys(stato)).toEqual(["da"]);
  });
});

describe("come si chiama la schermata a cui si torna", () => {
  it("coi nomi veri dei moduli", () => {
    expect(nomeDellaPartenza("/cassa/prima-nota", MODULES)).toBe("Cassa, Banca e Prima Nota");
    expect(nomeDellaPartenza("/agenda/nuovo", MODULES)).toBe("Agenda");
    expect(nomeDellaPartenza("/dashboard", MODULES)).toBe("Dashboard");
    expect(nomeDellaPartenza("/fotografa", MODULES)).toBe("MEMO foto");
  });

  it("🔴 OGNI modulo con una sua rotta ha un nome per il ritorno", () => {
    // ⚠️ È la proprietà che si rompe da sola il giorno che nasce un modulo
    //    nuovo: se il nome non si trovasse, il ritorno direbbe «la schermata
    //    di prima» — vero e inutile.
    for (const m of MODULES.filter((x) => x.route)) {
      expect(nomeDellaPartenza(`${m.route}/qualcosa`, MODULES), m.route).toBe(m.name);
    }
  });

  it("vince la rotta più lunga, e «/ab» non è dentro «/a»", () => {
    const moduli = [
      { route: "/a", name: "A" },
      { route: "/a/b", name: "AB" },
    ];
    expect(nomeDellaPartenza("/a/b/c", moduli)).toBe("AB");
    expect(nomeDellaPartenza("/a/x", moduli)).toBe("A");
    expect(nomeDellaPartenza("/ab", moduli)).toBeNull();
  });
});

describe("le parole del ritorno", () => {
  it("«Torna in …» col nome del modulo", () => {
    expect(ritornoDaMemo("/agenda", MODULES)).toEqual({
      da: "/agenda",
      nome: "Agenda",
      frase: "Torna in Agenda",
      annulla: "Annulla e torna in Agenda",
    });
  });

  it("una schermata senza nome: si dice che si torna indietro, senza inventarlo", () => {
    expect(ritornoDaMemo("/impostazioni-segrete", MODULES).frase).toBe("Torna alla schermata di prima");
  });

  it("nessuna partenza, nessun ritorno", () => {
    expect(ritornoDaMemo(undefined, MODULES)).toBeNull();
    expect(ritornoDaMemo("/detta", MODULES)).toBeNull();
  });
});
