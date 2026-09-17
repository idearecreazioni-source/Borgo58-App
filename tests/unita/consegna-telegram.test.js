import { describe, expect, it } from "vitest";
import {
  chiaveDiConsegna,
  consegnaUnaVoltaSola,
} from "../../supabase/functions/notify-telegram-reservation/consegna";

// =====================================================================
// UN TELEGRAM NON PARTE DUE VOLTE — 17/09/2026
// =====================================================================
// 🔴 IL DIFETTO CHE QUESTE PROVE CHIUDONO, rilevato dalla revisione sul
//    commit 887a5e4. La correzione di ieri toglieva il falso «inviato» e
//    **non impediva il doppione**: una risposta persa rendeva il tentativo
//    ritentabile, e il ritentativo arrivava a chi riceve come una richiesta
//    qualunque. *Il caso che la correzione trattava bene — «non so se sia
//    arrivato, riprovo» — era esattamente quello che produceva il secondo
//    messaggio.*
//
// ⚠️ SI PROVA SENZA MANDARE NIENTE, ed è il motivo per cui la decisione vive
//    in un file suo: dentro la funzione online l'unico modo di metterla alla
//    prova sarebbe mandare Telegram veri per collaudare un guardiano.
//
// 🔴 IL MAGAZZINO FINTO QUI SOTTO RISPECCHIA `prendi_consegna` DEL DATABASE,
//    riga per riga. Non è un dettaglio: se si comportasse diversamente,
//    queste prove dimostrerebbero la proprietà di un magazzino che non
//    esiste. Il primo blocco lo TARA su casi di risposta nota, come vuole la
//    regola del 26/08 — *un misuratore si prova prima su qualcosa di cui si
//    conosce già la risposta*.

/** Gli stessi cinque minuti di `consegna_presa_scaduta()` nel database. */
const SCADUTA = 5 * 60 * 1000;

/**
 * La memoria durevole di chi riceve, come la tiene il database.
 * Porta anche il contatore dei messaggi partiti davvero: è il numero su cui
 * si misura tutto quello che segue.
 */
function magazzino() {
  let adesso = Date.parse("2026-09-20T15:00:00Z");
  const righe = new Map();
  const m = {
    partiti: 0,
    avanza: (ms) => {
      adesso += ms;
    },
    prendi: async (chiave) => {
      const r = righe.get(chiave);
      if (!r) {
        righe.set(chiave, { stato: "presa", presa_il: adesso });
        return "manda";
      }
      if (r.stato === "consegnata") return "gia_consegnata";
      if (adesso - r.presa_il < SCADUTA) return "in_corso";
      return "ignota";
    },
    conferma: async (chiave) => {
      const r = righe.get(chiave);
      if (r) {
        r.stato = "consegnata";
      }
    },
    // ⚠️ Solo una presa NON confermata torna libera: su una consegnata non
    //    deve fare niente, o si riaprirebbe la porta al doppione dove era
    //    stata chiusa.
    rilascia: async (chiave) => {
      const r = righe.get(chiave);
      if (r && r.stato === "presa") righe.delete(chiave);
    },
  };
  return m;
}

/** Un giro completo, con un Telegram che risponde come si vuole. */
const giro = (m, chiave, manda) =>
  consegnaUnaVoltaSola({
    chiave,
    prendi: m.prendi,
    conferma: m.conferma,
    rilascia: m.rilascia,
    manda: async () => {
      m.partiti += 1;
      return manda();
    },
  });

const vaBene = () => ({ riuscito: true });
const CHIAVE = "promemoria:00000000-0000-0000-0000-0000000000ff:2026-09-20T15:00:00.000Z";

describe("🔴 la chiave di consegna, e il punto di giunzione coi due lati", () => {
  // 🔴 LA STESSA STRINGA CHE PRETENDE LA VERIFICA DELLA MIGRAZIONE. È così
  //    che si dimostra, senza un database acceso, che il database e la
  //    funzione online compongono la STESSA chiave. Se divergessero, il
  //    riconoscimento non avverrebbe mai e ogni ritentativo manderebbe un
  //    secondo Telegram — in silenzio, che è il modo peggiore.
  it("ha la forma esatta che il database si aspetta", () => {
    expect(
      chiaveDiConsegna({
        id: "00000000-0000-0000-0000-0000000000ff",
        remind_at: "2026-09-20T15:00:00Z",
      }),
    ).toBe(CHIAVE);
  });

  it("⚠️ lo stesso istante scritto in due fusi dà UNA chiave sola", () => {
    // Due scritture diverse dello stesso momento darebbero due chiavi, cioè
    // due Telegram: il caso si presenta da sé, perché il database scrive in
    // UTC e chi legge può ricevere l'ora locale.
    expect(
      chiaveDiConsegna({
        id: "00000000-0000-0000-0000-0000000000ff",
        remind_at: "2026-09-20T17:00:00+02:00",
      }),
    ).toBe(CHIAVE);
  });

  it("🔴 ma spostando l'avviso la chiave CAMBIA", () => {
    // Senza questo, un secondo avviso — legittimo e diverso — verrebbe
    // scambiato per un doppione del primo e non partirebbe mai.
    expect(
      chiaveDiConsegna({
        id: "00000000-0000-0000-0000-0000000000ff",
        remind_at: "2026-09-21T15:00:00Z",
      }),
    ).not.toBe(CHIAVE);
  });

  it("senza i suoi due ingredienti non si compone", () => {
    expect(chiaveDiConsegna({ id: "x" })).toBeNull();
    expect(chiaveDiConsegna({ remind_at: "2026-09-20T15:00:00Z" })).toBeNull();
    expect(chiaveDiConsegna(null)).toBeNull();
  });
});

describe("⚠️ il magazzino finto si comporta come quello del database", () => {
  // Senza questa taratura, tutto il resto proverebbe la proprietà di un
  // magazzino che non esiste.
  it("manda una volta sola, poi in corso, poi già consegnata", async () => {
    const m = magazzino();
    expect(await m.prendi(CHIAVE)).toBe("manda");
    expect(await m.prendi(CHIAVE)).toBe("in_corso");
    await m.conferma(CHIAVE);
    expect(await m.prendi(CHIAVE)).toBe("gia_consegnata");
  });

  it("una presa vecchia e mai confermata diventa «ignota», non torna a «manda»", async () => {
    const m = magazzino();
    expect(await m.prendi(CHIAVE)).toBe("manda");
    m.avanza(SCADUTA + 1000);
    expect(await m.prendi(CHIAVE)).toBe("ignota");
  });

  it("il rilascio libera una presa, e NON tocca una consegnata", async () => {
    const m = magazzino();
    await m.prendi(CHIAVE);
    await m.rilascia(CHIAVE);
    expect(await m.prendi(CHIAVE)).toBe("manda");
    await m.conferma(CHIAVE);
    await m.rilascia(CHIAVE);
    expect(await m.prendi(CHIAVE)).toBe("gia_consegnata");
  });
});

describe("🔴 la stessa chiave ripetuta non manda un secondo Telegram", () => {
  it("è il caso della RISPOSTA PERSA: si riprova, e parte un messaggio solo", async () => {
    const m = magazzino();

    // Primo tentativo: il messaggio parte e Telegram lo accetta…
    const primo = await giro(m, CHIAVE, vaBene);
    expect(primo.stato).toBe(200);
    expect(primo.corpo.ok).toBe(true);
    // …ma la risposta non torna mai a chi manda, che quindi non sa niente.

    // Il giro riprova con LA STESSA CHIAVE — ed è l'unica cosa che rende
    // sicuro riprovare.
    const secondo = await giro(m, CHIAVE, vaBene);
    expect(secondo.stato).toBe(200);
    expect(secondo.corpo.ok).toBe(true);
    // ⚠️ E LO DICE: chi legge distingue una consegna da un riconoscimento.
    expect(secondo.corpo.gia_consegnato).toBe(true);

    // 🔴 IL NUMERO CHE CONTA.
    expect(m.partiti, "sono partiti due Telegram per lo stesso avviso").toBe(1);
  });

  it("e restando ripetuta all'infinito resta un messaggio solo", async () => {
    const m = magazzino();
    for (let i = 0; i < 5; i += 1) await giro(m, CHIAVE, vaBene);
    expect(m.partiti).toBe(1);
  });
});

describe("🔴 due giri sovrapposti non mandano due Telegram", () => {
  it("il secondo arriva mentre il primo non ha ancora finito: non manda, e lo dice", async () => {
    const m = magazzino();
    let sblocca;
    const telegramLento = () =>
      new Promise((r) => {
        sblocca = () => r({ riuscito: true });
      });

    // Il primo prende in carico e resta appeso dentro l'invio.
    const primo = giro(m, CHIAVE, telegramLento);
    // ⚠️ Si aspetta un giro del ciclo degli eventi, così la presa in carico
    //    del primo è avvenuta davvero: senza, questa prova misurerebbe
    //    l'ordine in cui le due chiamate sono state scritte, non la regola.
    await Promise.resolve();

    // Il secondo arriva adesso.
    const secondo = await giro(m, CHIAVE, vaBene);
    expect(secondo.stato).toBe(409);
    expect(secondo.corpo.esito).toBe("in_corso");
    expect(secondo.corpo.ok).toBe(false);

    sblocca();
    expect((await primo).stato).toBe(200);

    expect(m.partiti, "due giri sovrapposti hanno mandato due Telegram").toBe(1);
  });
});

describe("🔴 quando Telegram RIFIUTA, il messaggio non è partito: si riprova", () => {
  it("la chiave torna libera, e il tentativo dopo manda davvero", async () => {
    const m = magazzino();
    const rifiuta = () => ({ riuscito: false, dettaglio: "chat not found" });

    const primo = await giro(m, CHIAVE, rifiuta);
    expect(primo.stato).toBe(502);
    expect(primo.corpo.ok).toBe(false);

    const secondo = await giro(m, CHIAVE, vaBene);
    expect(secondo.stato).toBe(200);
    expect(secondo.corpo.gia_consegnato).toBeUndefined();

    // ⚠️ DUE TENTATIVI E UN SOLO MESSAGGIO RICEVUTO: il primo Telegram non è
    //    mai arrivato — l'ha detto Telegram — quindi il secondo non è un
    //    doppione, è la prima consegna.
    expect(m.partiti).toBe(2);
  });
});

describe("🔴 e quando non si può sapere, non si manda più", () => {
  it("l'invio si interrompe a metà: la chiave NON torna libera", async () => {
    const m = magazzino();
    const cadeLaRete = () => {
      throw new Error("connection reset");
    };

    const primo = await giro(m, CHIAVE, cadeLaRete);
    expect(primo.stato).toBe(502);
    expect(primo.corpo.esito).toBe("ignoto");

    // ⚠️ RILASCIARE QUI SAREBBE COSTRUIRE IL DOPPIONE A MANO: Telegram può
    //    aver ricevuto, e nessuno lo sa. Subito dopo, la presa è ancora
    //    recente.
    const subito = await giro(m, CHIAVE, vaBene);
    expect(subito.corpo.esito).toBe("in_corso");

    // E passato il tempo, diventa un esito dichiarato ignoto — non si torna
    // MAI a mandare.
    m.avanza(SCADUTA + 1000);
    const dopo = await giro(m, CHIAVE, vaBene);
    expect(dopo.stato).toBe(409);
    expect(dopo.corpo.esito).toBe("ignoto");

    // 🔴 IL COMPROMESSO, MISURATO: un solo invio tentato in tutto, e da lì in
    //    avanti nessuno. Si preferisce un avviso che forse manca — scritto e
    //    allarmato — a uno che forse è doppio e non lo dice nessuno.
    expect(m.partiti).toBe(1);
  });

  it("⚠️ e l'esito ignoto NON si confonde con un successo", async () => {
    const m = magazzino();
    const primo = await giro(m, CHIAVE, () => {
      throw new Error("connection reset");
    });
    expect(primo.corpo.ok).toBe(false);
    expect(primo.corpo.ok).not.toBe(true);
  });
});
