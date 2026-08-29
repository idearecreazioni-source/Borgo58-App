import { describe, expect, it } from "vitest";
import { COLORI } from "../../src/lib/coloriSala";
import { SEGNI_IN_ORDINE } from "../../src/lib/calcoli/ritardo";

// LA LEGENDA NON PUÒ RACCONTARE UNA SALA DIVERSA DA QUELLA DISEGNATA.
//
// 🔴 È l'unica ragione per cui questa prova esiste. La legenda è tornata il
// 29/08/2026 su richiesta di Alessio, dopo essere stata tolta il 18/08; e il
// difetto di una legenda non è che sia brutta — è che **invecchia in
// silenzio**. Un colore aggiunto alla pianta e non spiegato, o una voce
// spiegata che nessuno disegna più, non danno nessun errore: danno una
// spiegazione che dice il falso, e chi la legge ci crede.
//
// ⚠️ E la prova guarda i DUE VERSI. Uno solo lascerebbe scoperta metà del
// problema, e sarebbe proprio la metà silenziosa.

// I colori che la pianta usa per cose che NON sono un segno da spiegare.
// ⚠️ Dichiarati con la ragione, non nascosti: un'eccezione senza la sua
//    ragione scritta si allarga da sola.
const NON_SONO_SEGNI = {
  fisso: "gli arredi fissi — divani e Chef Table — non sono uno stato: sono mobili",
};

describe("la legenda della sala", () => {
  it("🔴 ogni segno spiegato esiste davvero fra i colori della pianta", () => {
    const inventati = SEGNI_IN_ORDINE.map((s) => s.campione ?? s.chiave).filter((c) => !COLORI[c]);
    expect(inventati, "la legenda spiega colori che la pianta non disegna").toEqual([]);
  });

  it("🔴 e ogni colore della pianta è spiegato — o dichiarato non un segno", () => {
    const spiegati = new Set(SEGNI_IN_ORDINE.map((s) => s.campione ?? s.chiave));
    const muti = Object.keys(COLORI).filter((c) => !spiegati.has(c) && !NON_SONO_SEGNI[c]);
    expect(
      muti,
      "la pianta disegna colori che la legenda non spiega: o si spiegano, o si dichiarano in NON_SONO_SEGNI con la ragione"
    ).toEqual([]);
  });

  it("il segno nato il 29/08 c'è, e dice che è un'informazione che manca", () => {
    // ⚠️ Non è un doppione del primo controllo: quello dice che i nomi
    //    combaciano, questo che «non lo so» non è stato spiegato come se
    //    fosse una quarta fascia — che è il difetto da cui è nato.
    const ignota = SEGNI_IN_ORDINE.find((s) => s.chiave === "ignota");
    expect(ignota, "manca la voce di «non lo so»").toBeTruthy();
    expect(ignota.dice).toMatch(/manca|non sa/i);
  });

  it("ogni voce ha un nome e una frase: nessuna riga vuota", () => {
    for (const s of SEGNI_IN_ORDINE) {
      expect(s.nome?.trim(), `la voce «${s.chiave}» non ha un nome`).toBeTruthy();
      expect(s.dice?.trim(), `la voce «${s.chiave}» non dice niente`).toBeTruthy();
    }
  });

  it("...e la prova DISCRIMINA nei due versi", () => {
    // Su elenchi inventati, per non toccare quelli veri mentre qualcuno
    // sta collaudando (stessa ragione della rete dei vocabolari).
    const colori = { libero: {}, presto: {}, misto: {} };
    const soloDue = [{ chiave: "libero" }, { chiave: "presto" }];
    const unoInventato = [...soloDue, { chiave: "misto" }, { chiave: "arcobaleno" }];

    expect(Object.keys(colori).filter((c) => !new Set(soloDue.map((s) => s.chiave)).has(c))).toEqual(["misto"]);
    expect(unoInventato.map((s) => s.chiave).filter((c) => !colori[c])).toEqual(["arcobaleno"]);
  });
});
