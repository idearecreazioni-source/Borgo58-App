import { describe, expect, it } from "vitest";
import { REF_PROVA } from "../../scripts/comune.mjs";
import {
  daGuardare,
  differenza,
  leggiArgomenti,
} from "../../scripts/funzioni-allinea.mjs";

// Nessuna di queste prove parla con Supabase: si prova la decisione, cioè
// l'unica parte che può sbagliare in silenzio.

describe("come si leggono gli argomenti", () => {
  it("senza niente: si guarda tutto, e non si installa", () => {
    const r = leggiArgomenti([]);
    expect(r.conferma).toBe(false);
    expect(r.nomi).toEqual([]);
    expect(r.ref).toBe(REF_PROVA);
  });

  it("i nomi limitano il giro, e --conferma è l'unica cosa che installa", () => {
    const r = leggiArgomenti(["posta-leggi", "leggi-foto", "--conferma"]);
    expect(r.nomi).toEqual(["posta-leggi", "leggi-foto"]);
    expect(r.conferma).toBe(true);
  });

  it("«--prova» si accetta e non cambia niente: il progetto è già quello", () => {
    expect(leggiArgomenti(["--prova"]).ref).toBe(REF_PROVA);
    expect(leggiArgomenti(["--prova"]).nomi).toEqual([]);
  });

  it("la produzione è RIFIUTATA, e il rifiuto dice dove andare", () => {
    const r = leggiArgomenti(["--produzione", "--conferma"]);
    expect(r.errore).toMatch(/solo su Borgo58-Prova/);
    expect(r.errore).toMatch(/npm run funzione/);
    expect(r.conferma).toBeUndefined();
  });

  it("un'opzione sconosciuta ferma tutto invece di essere ignorata", () => {
    expect(leggiArgomenti(["--tutte"]).errore).toMatch(/--tutte/);
  });
});

describe("che differenza c'è fra la cartella e ciò che gira", () => {
  const locale = { "index.ts": "a\n", "aiuto.ts": "b\n" };

  it("stesso contenuto: uguale", () => {
    expect(differenza(locale, { "index.ts": "a\n", "aiuto.ts": "b\n" })).toEqual({
      stato: "uguale",
      file: [],
    });
  });

  it("i fine riga NON sono una differenza", () => {
    // ⚠️ Su Windows la copia locale è CRLF e quella scaricata LF: senza
    //    questa regola il confronto direbbe «diversa» su tutto, cioè il
    //    guardiano griderebbe sempre e si imparerebbe a spegnerlo.
    expect(differenza({ "index.ts": "a\r\nb\r\n" }, { "index.ts": "a\nb\n" }).stato).toBe("uguale");
  });

  it("un file cambiato si nomina", () => {
    const d = differenza(locale, { "index.ts": "a\n", "aiuto.ts": "DIVERSO\n" });
    expect(d.stato).toBe("diversa");
    expect(d.file).toEqual(["aiuto.ts"]);
  });

  it("un file che online non c'è è una differenza, non un'uguaglianza", () => {
    const d = differenza(locale, { "index.ts": "a\n" });
    expect(d.stato).toBe("diversa");
    expect(d.file).toEqual(["aiuto.ts"]);
  });

  it("un file che c'è solo online è una differenza: qualcuno l'ha tolto dal ramo", () => {
    const d = differenza(locale, { ...locale, "vecchio.ts": "x\n" });
    expect(d.stato).toBe("diversa");
    expect(d.file).toEqual(["vecchio.ts"]);
  });

  it("niente online vuol dire «non installata», che è un'altra cosa da «diversa»", () => {
    // ⚠️ Distinguerle conta: una funzione mai installata non è un ritardo, è
    //    una decisione che nessuno ha ancora preso.
    const d = differenza(locale, {});
    expect(d.stato).toBe("non installata");
    expect(d.file).toEqual(["aiuto.ts", "index.ts"]);
  });
});

describe("quali funzioni si guardano", () => {
  const presenti = ["posta-leggi", "leggi-foto", "schede-prodotto"];

  it("senza nomi si guardano tutte", () => {
    expect(daGuardare([], presenti).nomi).toEqual(presenti);
  });

  it("un nome che non esiste ferma tutto, e viene detto quale", () => {
    const r = daGuardare(["posta-leggi", "posta-legi"], presenti);
    expect(r.nomi).toBeUndefined();
    expect(r.errore).toMatch(/posta-legi/);
  });
});
