import { describe, expect, it } from "vitest";
import {
  SCAMBI_MASSIMI,
  idDaSostituire,
  istruzioniConversa,
  leggiChiarimento,
  messaggiConMemoria,
  righeInAttesa,
  tokenCache,
} from "../../supabase/functions/ascolta-voce/conversa.ts";

// =====================================================================
// MEMO RICORDA GLI ULTIMI MINUTI, E SE NON HA CAPITO CHIEDE
// =====================================================================
// 🔴 QUELLO CHE SI PROVA QUI È LA FORMA che arriva al modello: turni
//    alternati, l'ultimo sempre di Alessio, e le cose di prima dichiarate
//    «già segnate». Se l'ultimo turno non fosse suo, l'API respingerebbe la
//    chiamata e la frase di adesso si perderebbe.

const ADESSO = "Oggi è domenica 25 ottobre 2026, sono le 21:10.";

describe("messaggiConMemoria", () => {
  it("senza scambi manda la frase da sola, come prima di oggi", () => {
    const m = messaggiConMemoria([], ADESSO, "aggiungi il latte");
    expect(m).toEqual([{ role: "user", content: `${ADESSO} Alessio ha detto:\n\naggiungi il latte` }]);
  });

  it("con gli scambi alterna i turni e chiude con la frase di adesso", () => {
    const m = messaggiConMemoria(
      [
        { quando: "21:05", detto: "aggiungi il latte alla spesa", capito: "Latte nella lista della spesa" },
        { quando: "21:07", detto: "quanti?", capito: "Ho chiesto: Quanti litri?" },
      ],
      ADESSO,
      "due litri",
    );
    expect(m.map((x) => x.role)).toEqual(["user", "assistant", "user", "assistant", "user"]);
    expect(m[0].content).toContain("alle 21:05");
    expect(m[1].content).toContain("gia' segnato");
    expect(m[3].content).toContain("Ho chiesto: Quanti litri?");
    expect(m.at(-1)).toEqual({ role: "user", content: `${ADESSO} Adesso Alessio dice:\n\ndue litri` });
  });

  it("salta gli scambi senza frase invece di mandare un turno vuoto", () => {
    const m = messaggiConMemoria([{ detto: "  ", capito: "x" }, null, { detto: "uno" }], ADESSO, "due");
    expect(m).toHaveLength(3);
    expect(m[1].content).toMatch(/niente\.$/);
    expect(m.every((x) => x.content.trim() !== "")).toBe(true);
  });

  it("non manda più scambi del tetto, e tiene i più recenti", () => {
    const tanti = Array.from({ length: SCAMBI_MASSIMI + 3 }, (_, i) => ({ detto: `frase ${i}` }));
    const m = messaggiConMemoria(tanti, ADESSO, "adesso");
    expect(m).toHaveLength(SCAMBI_MASSIMI * 2 + 1);
    expect(m[0].content).toContain("frase 3");
  });

  it("non si rompe se gli scambi non sono un elenco", () => {
    expect(messaggiConMemoria(null, ADESSO, "x")).toHaveLength(1);
    expect(messaggiConMemoria({ detto: "a" }, ADESSO, "x")).toHaveLength(1);
  });
});

describe("leggiChiarimento", () => {
  it("legge la domanda quando non ci sono azioni", () => {
    expect(leggiChiarimento({ azioni: [], chiedo: " Quanti chili? " })).toBe("Quanti chili?");
  });

  it("se ci sono azioni, le azioni vincono e la domanda cade", () => {
    expect(leggiChiarimento({ azioni: [{ tipo: "lista_spesa" }], chiedo: "Quanti?" })).toBeNull();
  });

  it("senza domanda non inventa niente", () => {
    expect(leggiChiarimento({ azioni: [] })).toBeNull();
    expect(leggiChiarimento({ azioni: [], chiedo: "   " })).toBeNull();
    expect(leggiChiarimento(null)).toBeNull();
    expect(leggiChiarimento({ chiedo: 42 })).toBeNull();
  });

  it("accorcia una domanda troppo lunga da dire ad alta voce", () => {
    const d = leggiChiarimento({ azioni: [], chiedo: "a".repeat(500) });
    expect(d).toHaveLength(198);
    expect(d.endsWith("…")).toBe(true);
  });
});

describe("tokenCache", () => {
  it("legge i due numeri della cache", () => {
    expect(tokenCache({ cache_creation_input_tokens: 13000, cache_read_input_tokens: 0 })).toEqual({
      scritti: 13000,
      letti: 0,
    });
  });

  it("zero quando i campi mancano o sono storti", () => {
    expect(tokenCache(undefined)).toEqual({ scritti: 0, letti: 0 });
    expect(tokenCache({ cache_read_input_tokens: null, cache_creation_input_tokens: -3 })).toEqual({
      scritti: 0,
      letti: 0,
    });
  });
});

describe("istruzioniConversa", () => {
  it("dice che le cose di prima sono già segnate, e come si chiede", () => {
    const t = istruzioniConversa();
    expect(t).toContain("GIA' STATE SEGNATE");
    expect(t).toContain('"chiedo"');
  });
});

// 🔴 LA CORREZIONE PRENDE IL POSTO (25/10/2026): misurato sulla prova,
//    «aggiungi il latte» e poi «mettine due litri» lasciavano in attesa
//    due appunti. Il modello nomina la riga vecchia con un numero, e lo
//    stesso elenco che numera il messaggio deve ritradurre il numero.
const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const ID_C = "33333333-3333-4333-8333-333333333333";

describe("le righe ancora in attesa", () => {
  const scambi = [
    { detto: "aggiungi il latte", capito: "Latte", in_attesa: [{ id: ID_A, frase: "Lista della spesa: latte" }] },
    { detto: "e il pane e le uova", capito: "Pane, uova", in_attesa: [{ id: ID_B, frase: "pane" }, { id: "storto", frase: "x" }, { id: ID_C, frase: "uova" }] },
  ];

  it("si numerano di seguito, saltando gli identificativi storti", () => {
    expect(righeInAttesa(scambi)).toEqual([
      { numero: 1, id: ID_A, frase: "Lista della spesa: latte" },
      { numero: 2, id: ID_B, frase: "pane" },
      { numero: 3, id: ID_C, frase: "uova" },
    ]);
  });

  it("il messaggio le mostra con gli STESSI numeri", () => {
    const m = messaggiConMemoria(scambi, ADESSO, "mettine due litri");
    expect(m[1].content).toContain("[1] Lista della spesa: latte");
    expect(m[3].content).toContain("[2] pane; [3] uova");
    expect(m[3].content).not.toContain("storto");
  });

  it("un numero torna l'identificativo vero; quelli che non esistono cadono", () => {
    const righe = righeInAttesa(scambi);
    expect(idDaSostituire([1], righe)).toEqual([ID_A]);
    expect(idDaSostituire(["3", 3, 9, "x"], righe)).toEqual([ID_C]);
    expect(idDaSostituire(undefined, righe)).toEqual([]);
    expect(idDaSostituire([1], [])).toEqual([]);
  });

  it("gli scambi oltre il tetto non entrano nemmeno nella numerazione", () => {
    const tanti = Array.from({ length: SCAMBI_MASSIMI + 1 }, (_, i) => ({
      detto: `frase ${i}`,
      in_attesa: [{ id: i === 0 ? ID_A : ID_B, frase: `r${i}` }],
    }));
    expect(righeInAttesa(tanti).map((r) => r.id)).not.toContain(ID_A);
  });

  it("senza righe in attesa il turno non cambia", () => {
    const m = messaggiConMemoria([{ detto: "uno", capito: "Fatto" }], ADESSO, "due");
    expect(m[1].content).toBe("Avevo capito, ed e' gia' segnato: Fatto");
  });

  it("il prompt spiega quando mettere sostituisce e quando no", () => {
    const t = istruzioniConversa();
    expect(t).toContain('"sostituisce"');
    expect(t).toContain("cosa in piu'");
  });

  // 🔴 Misurato sulla prova (25/10/2026): «mettine due litri» e «aggiungi
  //    anche il pane» perdevano «lista della spesa» detto nella frase di
  //    prima, e finivano fra le cose «di cui non so in quale lista vanno».
  it("il nome della lista detto poco fa vale anche per la frase che lo continua", () => {
    expect(istruzioniConversa()).toContain("IL NOME DELLA LISTA");
  });
});
