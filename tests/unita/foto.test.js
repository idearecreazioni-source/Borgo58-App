import { describe, expect, it } from "vitest";
import {
  bytesDelBase64,
  LATO_MASSIMO,
  misureRidotte,
  QUALITA_MINIMA,
  qualitaSuccessiva,
  tipoAmmesso,
} from "../../src/lib/calcoli/foto";
import {
  allergeniDaScrivere,
  campiProposti,
  campiRimastiDellAssistente,
} from "../../src/lib/calcoli/schedaLetta";

describe("la foto si rimpicciolisce prima di partire", () => {
  it("porta il lato lungo alla misura giusta tenendo le proporzioni", () => {
    // Una foto da telefono, in verticale.
    const m = misureRidotte(3024, 4032);
    expect(m.ridotta).toBe(true);
    expect(Math.max(m.larghezza, m.altezza)).toBe(LATO_MASSIMO);
    // ⚠️ La proporzione si controlla, non si dà per scontata: una foto
    //    schiacciata renderebbe illeggibile proprio la scritta piccola per
    //    cui la foto viene scattata.
    expect(m.larghezza / m.altezza).toBeCloseTo(3024 / 4032, 3);
  });

  it("non ingrandisce mai una foto già piccola", () => {
    // ⚠️ Ingrandire aggiungerebbe punti inventati: peserebbe di più senza
    //    contenere nulla di più.
    const m = misureRidotte(800, 600);
    expect(m).toEqual({ larghezza: 800, altezza: 600, ridotta: false });
  });

  it("tiene almeno un punto anche su un'immagine lunga e strettissima", () => {
    // Il caso limite: arrotondando verso il basso si otterrebbe zero, e un
    // canvas largo zero non disegna niente — senza nessun errore.
    const m = misureRidotte(10000, 3);
    expect(m.larghezza).toBe(LATO_MASSIMO);
    expect(m.altezza).toBeGreaterThanOrEqual(1);
  });

  it("non risponde niente se non sa quanto è grande", () => {
    expect(misureRidotte(0, 0)).toBeNull();
    expect(misureRidotte(undefined, 100)).toBeNull();
  });
});

describe("quanto pesa davvero una foto", () => {
  it("conta i byte veri, togliendo l'imbottitura finale", () => {
    // "AAAA" sono 3 byte pieni; "AAA=" ne sono 2; "AA==" uno solo.
    expect(bytesDelBase64("AAAA")).toBe(3);
    expect(bytesDelBase64("AAA=")).toBe(2);
    expect(bytesDelBase64("AA==")).toBe(1);
    expect(bytesDelBase64("")).toBe(0);
  });
});

describe("la qualità scende a scalini, ma non oltre", () => {
  it("scende finché può", () => {
    expect(qualitaSuccessiva(0.82)).toBeLessThan(0.82);
  });

  it("si ferma prima di rendere illeggibile la scritta piccola", () => {
    // ⚠️ Il verso che conta: sotto questa soglia le scritte si impastano,
    //    e una foto leggera e illeggibile è peggio di nessuna foto.
    let q = 0.82;
    let giri = 0;
    while (q !== null && giri < 50) {
      const prossima = qualitaSuccessiva(q);
      if (prossima === null) break;
      expect(prossima).toBeGreaterThanOrEqual(QUALITA_MINIMA);
      q = prossima;
      giri += 1;
    }
    expect(qualitaSuccessiva(QUALITA_MINIMA)).toBeNull();
  });
});

describe("che immagini si accettano", () => {
  it("prende le foto e rifiuta il resto", () => {
    expect(tipoAmmesso("image/jpeg")).toBe(true);
    expect(tipoAmmesso("IMAGE/PNG")).toBe(true);
    expect(tipoAmmesso("application/pdf")).toBe(false);
    expect(tipoAmmesso("")).toBe(false);
    expect(tipoAmmesso(undefined)).toBe(false);
  });
});

describe("che cosa si mette nei campi da una scheda letta", () => {
  const scheda = {
    nome: "Pesto alla Genovese",
    categoria: "olio_condimenti",
    unita: "kg",
    conservazione: "dispensa",
    temperatura: "ambiente",
    allergeni: [
      { codice: "latte", origine: "etichetta", fonte: null },
      { codice: "frutta_guscio", origine: "etichetta", fonte: null },
    ],
  };

  it("riempie i campi vuoti", () => {
    const { valori, proposti } = campiProposti(scheda, {});
    expect(valori.name).toBe("Pesto alla Genovese");
    expect(valori.storage_type).toBe("dispensa");
    expect(proposti).toContain("nome");
    expect(proposti).toContain("conservazione");
    // 🔴 E LA DURATA NON C'È PIÙ (28/08/2026, decisione di Alessio): la
    // durata di un prodotto comprato non si compila e non si deduce.
    // ⚠️ Questa riga vale quanto le altre: senza, il giorno che qualcuno
    // rimettesse il campo nel prompt nessuno se ne accorgerebbe.
    expect(proposti).not.toContain("durata");
    expect(valori.shelf_life_days).toBeUndefined();
  });

  it("NON sovrascrive quello che una persona ha già scritto", () => {
    // ⚠️ È il verso che conta: una foto non deve cancellare quello che
    //    Alessio ha appena digitato. Senza questa prova, la cura ovvia
    //    (riempire tutto) passerebbe inosservata.
    const { valori, proposti } = campiProposti(scheda, { name: "Il mio pesto" });
    expect(valori.name).toBeUndefined();
    expect(proposti).not.toContain("nome");
    // ...ma gli altri campi vuoti li riempie lo stesso.
    expect(valori.storage_type).toBe("dispensa");
  });

  it("non propone niente da una scheda che non c'è", () => {
    expect(campiProposti(null, {})).toEqual({ valori: {}, proposti: [] });
  });
});

describe("quali campi sono rimasti dell'assistente", () => {
  it("tiene quelli intatti e lascia cadere quelli riscritti", () => {
    const proposti = { name: "Pesto", storage_type: "dispensa", temperatura_attesa: "ambiente" };
    const alSalvataggio = { name: "Pesto mio", storage_type: "dispensa", temperatura_attesa: "ambiente" };
    const rimasti = campiRimastiDellAssistente(proposti, alSalvataggio);
    expect(rimasti).not.toContain("nome");
    expect(rimasti).toContain("conservazione");
    expect(rimasti).toContain("temperatura");
    // ⚠️ «durata» non è più un campo che l'assistente possa proporre: se
    // ricomparisse qui, i due elenchi (questo e quello del database, in
    // `marca_campi_dall_assistente`) si sarebbero separati.
    expect(rimasti).not.toContain("durata");
  });

  it("confronta gli elenchi per contenuto, non per ordine", () => {
    // La stagionalità è un elenco: se il confronto fosse fatto sull'ordine,
    // gli stessi mesi in ordine diverso risulterebbero «riscritti da
    // Alessio» — cioè la marcatura direbbe il falso su un campo intatto.
    const proposti = { seasonality: ["gen", "feb"] };
    expect(campiRimastiDellAssistente(proposti, { seasonality: ["feb", "gen"] })).toContain(
      "stagionalita"
    );
    expect(campiRimastiDellAssistente(proposti, { seasonality: ["gen"] })).not.toContain(
      "stagionalita"
    );
  });

  it("non inventa niente se non c'è stata nessuna proposta", () => {
    expect(campiRimastiDellAssistente(null, {})).toEqual([]);
    expect(campiRimastiDellAssistente({}, {})).toEqual([]);
  });
});

describe("quali origini di allergene si scrivono", () => {
  const scheda = {
    allergeni: [
      { codice: "latte", origine: "etichetta", fonte: null },
      { codice: "soia", origine: "dedotto", fonte: null },
    ],
  };

  it("scrive solo le origini degli allergeni rimasti nel modulo", () => {
    // 🔴 Alessio ha tolto la soia: la sua origine non si scrive. Un'origine
    //    per un allergene che il prodotto non ha afferma qualcosa su una
    //    cosa che non esiste.
    const da = allergeniDaScrivere(scheda, ["latte"]);
    expect(da).toHaveLength(1);
    expect(da[0].codice).toBe("latte");
  });

  it("non inventa un'origine per un allergene aggiunto a mano", () => {
    // Quello aggiunto da Alessio non compare qui, e in sala si leggerà
    // «verificato da Alessio» — che è vero.
    const da = allergeniDaScrivere(scheda, ["latte", "sedano"]);
    expect(da.map((a) => a.codice)).toEqual(["latte"]);
  });

  it("mette «dedotto» quando l'origine non è stata dichiarata", () => {
    // ⚠️ Il valore prudente è quello che NON promette: un allergene senza
    //    origine dichiarata non può passare per letto in etichetta.
    const da = allergeniDaScrivere({ allergeni: [{ codice: "uova" }] }, ["uova"]);
    expect(da[0].origine).toBe("dedotto");
  });

  it("non si rompe su una scheda senza allergeni", () => {
    expect(allergeniDaScrivere({}, ["latte"])).toEqual([]);
    expect(allergeniDaScrivere(null, null)).toEqual([]);
  });
});
