import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  consegnaUnaVoltaSola,
  stradaDellaConsegna,
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

/** Un promemoria come lo manda il database NUOVO: con la chiave scritta. */
const daNuovo = {
  type: "task_reminder",
  chiave_consegna: CHIAVE,
  task: { id: "00000000-0000-0000-0000-0000000000ff", remind_at: "2026-09-20T15:00:00Z" },
};

/** Lo stesso promemoria come lo manda il database VECCHIO: senza chiave. */
const daVecchio = {
  type: "task_reminder",
  task: { id: "00000000-0000-0000-0000-0000000000ff", remind_at: "2026-09-20T15:00:00Z" },
};

describe("🔴 le due strade: si deduplica SOLO se la chiave arriva scritta", () => {
  it("col database nuovo la chiave c'è, e si passa dalla deduplicazione", () => {
    const s = stradaDellaConsegna(daNuovo);
    expect(s.dedup).toBe(true);
    expect(s.chiave).toBe(CHIAVE);
  });

  // 🔴 QUESTA È LA PROVA CHE LA CHIAVE NON SI RICOMPONE, ed è il cuore della
  //    correzione. Il payload qui sotto porta TUTTO quello che servirebbe a
  //    fabbricarla — l'impegno e il momento dell'avviso — e la risposta deve
  //    essere lo stesso «strada diretta». Se un giorno qualcuno rimettesse la
  //    ricomposizione «per non lasciare scoperto niente», questa riga è
  //    l'unica cosa che se ne accorgerebbe.
  it("🔴 col database vecchio NON si ricompone da id e remind_at: strada diretta", () => {
    const s = stradaDellaConsegna(daVecchio);
    expect(s.dedup).toBe(false);
    expect(s.chiave).toBeUndefined();
  });

  it("una chiave vuota, di soli spazi o che non è testo non è una chiave", () => {
    expect(stradaDellaConsegna({ ...daVecchio, chiave_consegna: "" }).dedup).toBe(false);
    expect(stradaDellaConsegna({ ...daVecchio, chiave_consegna: "   " }).dedup).toBe(false);
    expect(stradaDellaConsegna({ ...daVecchio, chiave_consegna: 42 }).dedup).toBe(false);
    expect(stradaDellaConsegna({ ...daVecchio, chiave_consegna: null }).dedup).toBe(false);
  });

  it("gli spazi intorno si tolgono: la chiave è quella, non la sua battitura", () => {
    expect(stradaDellaConsegna({ ...daVecchio, chiave_consegna: ` ${CHIAVE}\n` }).chiave).toBe(CHIAVE);
  });

  it("⚠️ prenotazioni e allarmi non hanno chiave, e restano sulla strada di sempre", () => {
    // Nascono da un fatto che avviene una volta sola e che nessuno ritenta:
    // per loro la deduplicazione non servirebbe a niente.
    expect(stradaDellaConsegna({ record: { source: "form_pubblico" } }).dedup).toBe(false);
    expect(stradaDellaConsegna({ type: "allarme", allarme: { tipo: "x" } }).dedup).toBe(false);
    expect(stradaDellaConsegna(null).dedup).toBe(false);
    expect(stradaDellaConsegna(undefined).dedup).toBe(false);
  });
});

describe("🔴 l'ordine del rilascio: prima la funzione online, poi la migrazione", () => {
  // 🔴 PERCHÉ QUESTO ORDINE E NON L'ALTRO.
  //    · Funzione prima: il database è ancora quello vecchio, non manda
  //      nessuna chiave, quindi la funzione nuova prende la strada diretta e
  //      si comporta esattamente come prima. Pubblicarla da sola non cambia
  //      niente.
  //    · Migrazione prima: il database manderebbe la chiave a una funzione
  //      che non sa leggerla — nessuna deduplicazione, nessun errore, e il
  //      doppione tornerebbe possibile IN SILENZIO.
  //
  // ⚠️ E LA FINESTRA FRA I DUE PASSI REGGE SOLO PERCHÉ IL REGISTRO DELLE
  //    CONSEGNE NON VIENE TOCCATO quando la chiave manca: in quella finestra
  //    quel registro **non esiste ancora**, e chiamarlo farebbe fallire ogni
  //    promemoria. È il pericolo che la prima stesura aveva introdotto
  //    ricomponendo la chiave.
  //
  // ⚠️ LA PROPRIETÀ SI PROVA IN DUE PEZZI, e non ricopiando qui la scelta
  //    della strada — due posti che dicono la stessa cosa divergono, ed è il
  //    difetto che questo progetto rifiuta per regola. Primo pezzo: la
  //    decisione, che è pura ed è provata qui sopra. Secondo pezzo: che il
  //    registro stia DENTRO quel ramo, che si legge dalla funzione stessa.
  const funzione = readFileSync(
    "supabase/functions/notify-telegram-reservation/index.ts",
    "utf8",
  );

  it("🔴 il registro delle consegne si tocca SOLO dentro il ramo della chiave", () => {
    const ramo = funzione.indexOf("if (strada.dedup)");
    expect(ramo, "il ramo della deduplicazione non c'è più con questo nome").toBeGreaterThan(-1);

    // Le tre chiamate al registro vivono tutte dopo l'inizio di quel ramo.
    for (const nome of ["prendi_consegna", "conferma_consegna", "rilascia_consegna"]) {
      const dove = funzione.indexOf(nome);
      expect(dove, `${nome} non è nominata nella funzione`).toBeGreaterThan(-1);
      expect(dove, `${nome} può essere chiamata fuori dal ramo della chiave`).toBeGreaterThan(ramo);
    }
  });

  it("⚠️ e quel controllo sa dire di NO: tarato su un caso di risposta nota", () => {
    // 🔴 SENZA QUESTA RIGA, IL CONTROLLO QUI SOPRA POTREBBE NON PROVARE
    //    NIENTE. È un confronto fra posizioni, e un confronto fra posizioni
    //    che non sappia riconoscere il caso storto dice «a posto» su
    //    qualunque file — in questo progetto è già costato due volte (22/08
    //    sui gesti pericolosi, 17/09 sull'ordine dei passi del workflow, dove
    //    la parola cercata stava dentro un commento).
    //    Qui si prova su una funzione FINTA in cui il registro viene toccato
    //    PRIMA del ramo, che è esattamente il difetto che deve prendere.
    const storta = 'await rpc("prendi_consegna", {});\nif (strada.dedup) {\n}\n';
    const ramo = storta.indexOf("if (strada.dedup)");
    expect(ramo).toBeGreaterThan(-1);
    expect(
      storta.indexOf("prendi_consegna"),
      "il controllo non si accorge di una chiamata al registro fuori dal ramo",
    ).toBeLessThan(ramo);
  });

  it("⚠️ e la funzione non sa più comporre una chiave: non può fabbricarne una", () => {
    // Se sapesse comporla, il ripiego potrebbe tornare senza che nessuno lo
    // decida — ed è precisamente come era tornato la prima volta.
    expect(funzione).not.toMatch(/chiaveDiConsegna/);
    expect(funzione).not.toMatch(/promemoria:\$\{/);
  });

  it("la strada diretta è ancora lì, e serve solo alla finestra del rilascio", () => {
    // Toglierla vorrebbe dire che pubblicare la funzione prima della
    // migrazione spegne tutti i promemoria: cioè nessun ordine sarebbe sicuro.
    expect(funzione).toMatch(/const telegramRes = await sendTelegram\(message\);/);
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

  it("🔴 un messaggio GIÀ PARTITO non diventa un errore se la conferma non si scrive", async () => {
    // Misurato su Prova il 20/09 alle 15:20: il promemoria è arrivato, la
    // conferma è stata scritta, e la funzione ha risposto lo stesso 500 —
    // l'errore nasceva DOPO l'invio, leggendo la risposta della conferma.
    // Chi manda l'ha letto come «non arrivato»: allarme falso alle 15:25 e
    // un tentativo dei tre buttato.
    const m = magazzino();
    const esito = await consegnaUnaVoltaSola({
      chiave: CHIAVE,
      prendi: m.prendi,
      conferma: async () => {
        throw new Error("Unexpected end of JSON input");
      },
      rilascia: m.rilascia,
      manda: async () => {
        m.partiti += 1;
        return { riuscito: true };
      },
    });
    expect(esito.stato).toBe(200);
    expect(esito.corpo.ok).toBe(true);
    // ⚠️ E lo DICE: la memoria di questa consegna è monca, e chi legge i
    //    registri deve poterlo sapere.
    expect(esito.corpo.conferma_non_scritta).toBe(true);
    expect(m.partiti).toBe(1);
  });

  it("⚠️ ma un rifiuto di Telegram resta un fallimento, anche se il rilascio inciampa", async () => {
    // Il verso opposto, e conta: se questa rete fosse troppo larga, un
    // messaggio MAI partito risulterebbe partito — cioè l'avviso sparirebbe
    // in silenzio, che è peggio dell'allarme falso che si sta togliendo.
    const m = magazzino();
    const esito = await consegnaUnaVoltaSola({
      chiave: CHIAVE,
      prendi: m.prendi,
      conferma: m.conferma,
      rilascia: async () => {
        throw new Error("Unexpected end of JSON input");
      },
      manda: async () => {
        m.partiti += 1;
        return { riuscito: false, dettaglio: "chat not found" };
      },
    });
    expect(esito.stato).toBe(502);
    expect(esito.corpo.ok).toBe(false);
  });

  it("🔴 nessuna delle due funzioni legge un contenuto che può non esserci", () => {
    // La causa vera del 20/09: le due scritture della consegna non
    // restituiscono niente, quindi il database risponde 204 SENZA CORPO, e
    // leggerlo come JSON solleva DOPO che il messaggio è partito.
    for (const percorso of [
      "../../supabase/functions/notify-telegram-reservation/index.ts",
      "../../supabase/functions/telegram-prova-test/index.ts",
    ]) {
      const sorgente = readFileSync(new URL(percorso, import.meta.url), "utf8");
      expect(sorgente, percorso).not.toMatch(/return await r\.json\(\)/);
      expect(sorgente, percorso).toMatch(/await r\.text\(\)/);
      expect(sorgente, percorso).toMatch(/testo\.trim\(\) === ""/);
    }
  });
});
