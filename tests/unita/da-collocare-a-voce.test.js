import { describe, expect, it } from "vitest";
import { TIPO_DA_COLLOCARE, collocaLeSpese, daCollocare, eUnaSpesa, rigaDellaSpesa } from "../../supabase/functions/ascolta-voce/dacollocare.ts";
import { correggiSpese } from "../../supabase/functions/ascolta-voce/tasca.ts";

// 🔴 DECISO DA ALESSIO L'11/10/2026: TUTTE le spese dette a MEMO vanno
//    nell'elenco «Da collocare». La regola delle parole (tasca.ts) non
//    sceglie più il soggetto: decide la destinazione PROPOSTA.
// ⚠️ Si prova la catena intera — prima la regola delle parole, poi questa —
//    perché è così che gira nella funzione online.

const detta = (dati, extra = {}) => ({
  tipo: "movimento_cassa",
  sicuro: true,
  frase: "Ho pagato",
  dati: { verso: "uscita", importo: 30, descrizione: "il pane", ...dati },
  ...extra,
});
const catena = (azioni, dettato) => collocaLeSpese(correggiSpese(azioni, dettato), dettato);

describe("le spese dette vanno «da collocare»", () => {
  it("un'uscita normale: proposta la prima nota", () => {
    const [a] = catena([detta({})], "ho pagato trenta euro il pane");
    expect(a.tipo).toBe(TIPO_DA_COLLOCARE);
    expect(a.dati.natura_proposta).toBe("prima_nota");
    expect(a.dati.importo).toBe(30);
    expect(a.dati.testo_originale).toBe("ho pagato trenta euro il pane");
    expect(a.dati.incertezza).toBeNull();
  });

  it("«di tasca mia»: proposta la tasca, e non scritta nella tasca", () => {
    const [a] = catena([detta({ soldi: "di tasca mia" })], "trenta euro di tasca mia per il pane");
    expect(a.tipo).toBe(TIPO_DA_COLLOCARE);
    expect(a.dati.natura_proposta).toBe("tasca");
  });

  it("«poi mi rimborso»: proposto l'anticipo", () => {
    const [a] = catena([detta({ soldi: "poi mi rimborso" })], "");
    expect(a.dati.natura_proposta).toBe("anticipo");
  });

  it("«soldi miei» senza dire se tornano: nessuna proposta, e il dubbio è scritto", () => {
    const [a] = catena([detta({ soldi: "con i miei soldi" })], "");
    expect(a.tipo).toBe(TIPO_DA_COLLOCARE);
    expect(a.dati.natura_proposta).toBeNull();
    expect(a.dati.incertezza).toMatch(/tornano indietro|tasca mia|rimborso/);
  });

  it("una spesa della tasca a metà (senza importo) entra lo stesso, col dubbio", () => {
    const [a] = catena([detta({ soldi: "di tasca mia", importo: null })], "");
    expect(a.tipo).toBe(TIPO_DA_COLLOCARE);
    expect(a.dati.importo).toBeNull();
    expect(a.dati.incertezza).toMatch(/quanto hai speso/);
  });

  it("il modello non sicuro lascia il suo motivo come incertezza", () => {
    const a = daCollocare(detta({}, { sicuro: false, motivo: "Non ho capito l'importo." }), "");
    expect(a.dati.incertezza).toBe("Non ho capito l'importo.");
  });

  it("il pezzo di frase vince sul dettato intero, se c'è", () => {
    const a = daCollocare({ ...detta({}), pezzo: "trenta di pane" }, "trenta di pane e segna le uova");
    expect(a.dati.testo_originale).toBe("trenta di pane");
  });

  it("⚠️ un'entrata NON è una spesa: resta il movimento di cassa", () => {
    const e = detta({ verso: "entrata" });
    expect(eUnaSpesa(e)).toBe(false);
    expect(daCollocare(e).tipo).toBe("movimento_cassa");
  });

  it("le altre cose dette passano intatte", () => {
    const g = { tipo: "giacenza", sicuro: true, dati: { quanto_ce: 3 } };
    expect(collocaLeSpese([g])[0]).toBe(g);
  });

  // 🔴 Dal collaudo dell'11/10: la riga del modello diceva «Uscita di
  //    cassa» su una spesa che approvando NON va in cassa.
  it("la riga sull'appunto non è quella del modello: importo e cosa", () => {
    const a = daCollocare(detta({ importo: 12, descrizione: "spesa al panificio" }, { frase: "Uscita di cassa: 12 €" }));
    expect(a.frase).toBe("12,00 € · spesa al panificio");
    expect(a.frase).not.toMatch(/cassa/i);
  });

  it("senza importo lo dice, senza descrizione usa il fornitore", () => {
    expect(rigaDellaSpesa({ fornitore: "Panificio Rossi" })).toBe("importo non detto · Panificio Rossi");
    expect(rigaDellaSpesa({ importo: "7,5" })).toBe("7,50 €");
    expect(rigaDellaSpesa({ importo: 0, descrizione: "x" })).toBe("0,00 € · x");
  });
});
