import { describe, expect, it } from "vitest";
import {
  SEZIONI,
  campiImpegno,
  daFareAdesso,
  sezioneDi,
  sezioniDellAgenda,
} from "../../src/lib/calcoli/agenda";

// COME SI LEGGE L'AGENDA, provata al contrario.
//
// ⚠️ Il caso che conta è **una riga stellata E in ritardo**: è quello in cui
// le due regole si toccano, ed è l'unico in cui una riga potrebbe finire in
// due elenchi. Su una stellata senza scadenza le due risposte coincidono e
// la prova non misurerebbe niente (la trappola del caso vuoto, 17/08).

const r = (over) => ({
  id: Math.random().toString(36).slice(2),
  title: "x",
  corsia: "questa_settimana",
  preferito: false,
  giorni_in_lista: 1,
  giorni_alla_scadenza: 3,
  due_date: "2026-09-02",
  category: "documenti",
  ...over,
});

describe("in quale sezione entra un impegno", () => {
  it("una riga stellata va in testa, qualunque corsia avesse", () => {
    expect(sezioneDi(r({ preferito: true, corsia: "in_ritardo" }))).toBe("per_me_conta");
    expect(sezioneDi(r({ preferito: true, corsia: "quando_capita" }))).toBe("per_me_conta");
  });

  it("una riga non stellata resta nella sua corsia", () => {
    expect(sezioneDi(r({ corsia: "in_ritardo" }))).toBe("in_ritardo");
  });

  it("🔴 una riga stellata E in ritardo compare UNA VOLTA SOLA", () => {
    const righe = [r({ preferito: true, corsia: "in_ritardo" })];
    const sez = sezioniDellAgenda(righe);
    const quante = sez.reduce((n, s) => n + s.righe.length, 0);
    expect(quante).toBe(1);
    expect(sez.find((s) => s.key === "per_me_conta").righe).toHaveLength(1);
    expect(sez.find((s) => s.key === "in_ritardo").righe).toHaveLength(0);
  });

  it("nessuna riga si perde per strada", () => {
    const righe = [
      r({ corsia: "in_ritardo" }),
      r({ corsia: "questa_settimana" }),
      r({ corsia: "piu_avanti" }),
      r({ corsia: "quando_capita", due_date: null }),
      r({ preferito: true }),
    ];
    const sez = sezioniDellAgenda(righe);
    expect(sez.reduce((n, s) => n + s.righe.length, 0)).toBe(righe.length);
  });

  it("una corsia che il database non conosce non fa sparire la riga", () => {
    // ⚠️ Se domani `agenda_corsie` restituisse un nome nuovo, la riga deve
    // comparire da qualche parte: sparire in silenzio è il difetto peggiore
    // di un elenco.
    const sez = sezioniDellAgenda([r({ corsia: "una_corsia_che_non_esiste" })]);
    expect(sez.reduce((n, s) => n + s.righe.length, 0)).toBe(1);
  });
});

describe("le sezioni che si chiudono", () => {
  it("si chiudono «in ritardo» e «più avanti», e nascono chiuse", () => {
    const chiudibili = SEZIONI.filter((s) => s.chiudibile).map((s) => s.key);
    expect(chiudibili).toEqual(["in_ritardo", "piu_avanti"]);
    expect(SEZIONI.filter((s) => s.chiudibile).every((s) => s.chiusaDiSuo)).toBe(true);
  });

  it("«per me conta» NON si chiude: è la ragione per cui esiste la stella", () => {
    expect(SEZIONI.find((s) => s.key === "per_me_conta").chiudibile).toBeUndefined();
  });
});

describe("il numero accanto al titolo", () => {
  it("conta ritardo e oggi, non il resto", () => {
    const righe = [
      r({ corsia: "in_ritardo", giorni_alla_scadenza: -3 }),
      r({ corsia: "questa_settimana", giorni_alla_scadenza: 0 }),
      r({ corsia: "questa_settimana", giorni_alla_scadenza: 4 }),
      r({ corsia: "quando_capita", due_date: null, giorni_alla_scadenza: null }),
      r({ corsia: "piu_avanti", giorni_alla_scadenza: 30 }),
    ];
    expect(daFareAdesso(righe)).toBe(2);
  });

  it("🔴 una riga stellata continua a contare", () => {
    // La stella cambia dove si legge, non se è in ritardo. Se il conteggio
    // guardasse la sezione invece della corsia, stellare un impegno lo
    // farebbe sparire dal numero — cioè il gesto che serve a non perderlo di
    // vista lo nasconderebbe.
    expect(daFareAdesso([r({ preferito: true, corsia: "in_ritardo" })])).toBe(1);
  });
});

describe("i campi di un quadrotto", () => {
  it("il titolo non è fra i campi", () => {
    expect(campiImpegno(r()).some((c) => c.chiave === "titolo")).toBe(false);
  });

  it("senza scadenza lo dice invece di lasciare un buco", () => {
    const campi = campiImpegno(r({ due_date: null }));
    const scadenza = campi.find((c) => c.chiave === "scadenza");
    expect(scadenza.valore).toBe("");
    expect(scadenza.vuoto).toBe("quando capita");
  });

  it("l'anzianità compare solo dove serve", () => {
    // Su una riga con la scadenza il dato c'è già, e ripeterlo toglie una
    // riga a quelle che servono.
    expect(campiImpegno(r({ giorni_in_lista: 90 })).some((c) => c.chiave === "eta")).toBe(false);
    expect(
      campiImpegno(r({ due_date: null, giorni_in_lista: 90 })).some((c) => c.chiave === "eta")
    ).toBe(true);
    // …e non su una nata ieri: «in lista da 1 giorni» è rumore.
    expect(
      campiImpegno(r({ due_date: null, giorni_in_lista: 2 })).some((c) => c.chiave === "eta")
    ).toBe(false);
  });

  it("da dove viene si legge in italiano, e «scritto a mano» non è un buco", () => {
    expect(campiImpegno(r({ origine_modulo: "posta" })).find((c) => c.chiave === "da").valore).toBe(
      "Posta"
    );
    const senza = campiImpegno(r({ origine_modulo: null })).find((c) => c.chiave === "da");
    expect(senza.valore).toBe("");
    expect(senza.vuoto).toBe("scritto a mano");
  });
});
