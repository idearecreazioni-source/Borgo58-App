import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio } from "./aiuto";

// LA SPESA DALLA TASCA DETTATA — contro il database vero.
//
// 🔴 TRE SOGGETTI CONTABILI CHE SI SOMIGLIANO ABBASTANZA DA SCAMBIARSI: la
//    cassa dell'osteria, **la tasca** (soldi di Alessio che non tornano) e
//    le **anticipazioni** (soldi che la società gli pareggia). Fino a oggi
//    la voce ne conosceva uno solo: una spesa detta «di tasca mia» finiva
//    nella cassa dell'osteria, **senza nessun errore**.
//
// 🔴 QUELLO CHE QUESTE PROVE SORVEGLIANO: che quello che entra da una parte
//    non compaia dall'altra, e che **niente venga scritto prima che Alessio
//    approvi**. Non si guarda lo stato scritto sulla riga — si contano i
//    movimenti dei due soggetti, perché «l'appunto dice tasca» e «i soldi
//    sono usciti dalla tasca» sono due affermazioni diverse.
//
// ⚠️ SI ENTRA DAL CORRIDOIO per approvare: è la strada del gestionale
//    (Contratto B4), e un'operazione dimenticata nel suo elenco risponde
//    404 senza che nessuna prova SQL se ne accorga.

const NOME = marchio("TEST-AUTO tasca");

describe("la spesa dalla tasca, detta a voce", () => {
  let titolare;
  let tasca;
  let osteria;
  const miei = { dettature: [], appunti: [], azioni: [], movimenti: [] };

  async function detta(testo, azioni) {
    const { data, error } = await titolare.rpc("registra_dettatura", {
      p_testo: `${NOME} — ${testo}`,
      p_azioni: azioni,
      p_esito: "capita",
      p_modello: null,
      p_token_domanda: 0,
      p_token_risposta: 0,
      p_messaggio: null,
    });
    if (error) throw error;
    miei.dettature.push(data.dettatura_id);
    const { data: righe } = await titolare
      .from("azioni_dettate")
      .select("id, appunto_id, tipo, stato, dati")
      .eq("dettatura_id", data.dettatura_id);
    for (const r of righe ?? []) {
      miei.azioni.push(r.id);
      if (!miei.appunti.includes(r.appunto_id)) miei.appunti.push(r.appunto_id);
    }
    return righe ?? [];
  }

  const spesa = (tipo, dati) => ({
    tipo,
    sicuro: true,
    frase: `${NOME} spesa`,
    dati,
  });

  const approva = (id) =>
    titolare.functions.invoke("operazioni-atomiche", {
      body: { operazione: "approva_appunto", parametri: { p_id: id } },
    });

  /** Quanti movimenti hanno i due soggetti, adesso. */
  async function conta() {
    const t = await titolare
      .from("cash_movements")
      .select("*", { count: "exact", head: true })
      .eq("entity_id", tasca);
    const o = await titolare
      .from("cash_movements")
      .select("*", { count: "exact", head: true })
      .eq("entity_id", osteria);
    return { tasca: t.count, osteria: o.count };
  }

  /** I movimenti scritti da questa prova, segnati per la pulizia. */
  async function miei_movimenti() {
    const { data } = await titolare
      .from("cash_movements")
      .select("id, entity_id, direction, amount, business_purpose, regola_deducibilita_id")
      .like("business_purpose", `${NOME}%`);
    for (const r of data ?? []) if (!miei.movimenti.includes(r.id)) miei.movimenti.push(r.id);
    return data ?? [];
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    const { data: ent } = await titolare.from("entities").select("id, entity_type");
    tasca = (ent ?? []).find((e) => e.entity_type === "tasca")?.id;
    osteria = (ent ?? []).find((e) => e.entity_type === "srls")?.id;
    // ⚠️ Condizione dichiarata: senza i due soggetti queste prove
    //    passerebbero senza aver provato niente.
    expect(tasca, "sul progetto di prova non c'è il soggetto «tasca»").toBeTruthy();
    expect(osteria, "sul progetto di prova non c'è il soggetto «Borgo 58»").toBeTruthy();
  });

  afterAll(async () => {
    // ⚠️ Solo ciò che questa prova ha creato, per identificativo (23/08).
    if (miei.movimenti.length)
      await titolare.from("cash_movements").delete().in("id", miei.movimenti);
    if (miei.azioni.length) await titolare.from("azioni_dettate").delete().in("id", miei.azioni);
    if (miei.appunti.length) await titolare.from("appunti_vocali").delete().in("id", miei.appunti);
    if (miei.dettature.length) await titolare.from("dettature").delete().in("id", miei.dettature);
  });

  // -------------------------------------------------------------------
  it("🔴 dettare non tocca la Cassa: prima di approvare non è cambiato niente", async () => {
    const prima = await conta();

    const righe = await detta("tasca", [
      spesa("spesa_tasca", { importo: 12, descrizione: `${NOME} detersivo` }),
    ]);
    expect(righe[0].tipo).toBe("spesa_tasca");
    expect(righe[0].stato).toBe("in_attesa");

    // Si guarda contando, non fidandosi dello stato scritto sulla riga.
    expect(await conta()).toEqual(prima);
    expect(await miei_movimenti()).toHaveLength(0);
  });

  it("🔴 ...e approvare scrive SULLA TASCA, non nella cassa dell'osteria", async () => {
    const prima = await conta();
    const righe = await detta("tasca due", [
      spesa("spesa_tasca", { importo: 12.5, descrizione: `${NOME} sapone` }),
    ]);

    const { error } = await approva(righe[0].appunto_id);
    expect(error).toBeNull();

    const dopo = await conta();
    expect(dopo.tasca, "la spesa non è finita nella tasca").toBe(prima.tasca + 1);
    expect(dopo.osteria, "una spesa della tasca ha toccato la cassa dell'osteria").toBe(
      prima.osteria,
    );

    const scritto = (await miei_movimenti()).find((m) => m.business_purpose === `${NOME} sapone`);
    expect(scritto).toBeTruthy();
    expect(scritto.entity_id).toBe(tasca);
    expect(scritto.direction).toBe("uscita");
    expect(Number(scritto.amount)).toBe(12.5);
    // ⚠️ La regola di deducibilità la mette il trigger del 30/08: qui si
    //    controlla che ci sia, non la si riscrive.
    expect(scritto.regola_deducibilita_id).toBeTruthy();
  });

  it("🔴 e allo specchio: un movimento dell'osteria non finisce nella tasca", async () => {
    // ⚠️ È la metà che discrimina: una cura che mandasse tutto sulla tasca
    //    passerebbe la prova qui sopra e romperebbe il gesto più frequente.
    const prima = await conta();
    const righe = await detta("osteria", [
      spesa("movimento_cassa", {
        verso: "uscita",
        importo: 7,
        descrizione: `${NOME} pane osteria`,
      }),
    ]);
    const { error } = await approva(righe[0].appunto_id);
    expect(error).toBeNull();

    const dopo = await conta();
    expect(dopo.osteria).toBe(prima.osteria + 1);
    expect(dopo.tasca, "un movimento dell'osteria ha toccato la tasca").toBe(prima.tasca);

    const scritto = (await miei_movimenti()).find(
      (m) => m.business_purpose === `${NOME} pane osteria`,
    );
    expect(scritto.entity_id).toBe(osteria);
  });

  // -------------------------------------------------------------------
  it("🔴 due approvazioni insieme scrivono UN movimento solo", async () => {
    // ⚠️ La concorrenza si prova facendo partire le due chiamate insieme:
    //    una alla volta proverebbe soltanto che un appunto chiuso non si
    //    riapre. E qui in gioco ci sono soldi: la stessa spesa due volte è
    //    il difetto peggiore di tutto il modulo.
    const prima = await conta();
    const righe = await detta("due mani", [
      spesa("spesa_tasca", { importo: 9, descrizione: `${NOME} spugne` }),
    ]);

    const [a, b] = await Promise.all([
      approva(righe[0].appunto_id),
      approva(righe[0].appunto_id),
    ]);
    const esiti = [a, b].map((r) => (r.error || r.data?.errore ? "rifiutata" : "passata"));
    expect(esiti.filter((e) => e === "passata"), `esiti: ${esiti}`).toHaveLength(1);
    expect(esiti.filter((e) => e === "rifiutata"), `esiti: ${esiti}`).toHaveLength(1);

    const dopo = await conta();
    expect(dopo.tasca, "la stessa spesa è entrata due volte").toBe(prima.tasca + 1);
  });

  it("🔴 e riapprovare lo stesso appunto una seconda volta viene rifiutato", async () => {
    const righe = await detta("due volte", [
      spesa("spesa_tasca", { importo: 4, descrizione: `${NOME} scotch` }),
    ]);
    const prima = await approva(righe[0].appunto_id);
    expect(prima.error).toBeNull();

    const dopo = await conta();
    const seconda = await approva(righe[0].appunto_id);
    expect(seconda.error, "un appunto già approvato si è lasciato riapprovare").not.toBeNull();
    const corpo = await seconda.error.context.json();
    expect(corpo?.errore?.messaggio ?? "").toMatch(/gia|già/i);

    expect(await conta()).toEqual(dopo);
  });

  // -------------------------------------------------------------------
  it("🔴 quello che manca non si inventa: senza importo l'appunto non si approva", async () => {
    const prima = await conta();
    const righe = await detta("senza importo", [
      {
        tipo: "soldi_di_chi",
        sicuro: true,
        destinazione: "Manca qualcosa per scriverla",
        motivo: "Della spesa dalla tua tasca mi manca quanto hai speso.",
        frase: `${NOME} spesa senza importo`,
        dati: { descrizione: `${NOME} detersivo` },
      },
    ]);

    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("titolo, eseguibile")
      .eq("id", righe[0].appunto_id)
      .single();
    expect(appunto.eseguibile, "un appunto senza importo è approvabile").toBe(false);

    // 🔴 E provando ad approvarlo lo stesso, il database RIFIUTA: senza,
    //    «non approvabile» sarebbe una scritta sulla schermata.
    const r = await approva(righe[0].appunto_id);
    expect(r.error).not.toBeNull();
    const corpo = await r.error.context.json();
    expect(corpo?.errore?.messaggio ?? "").toMatch(/non si pu/i);

    expect(await conta()).toEqual(prima);
  });

  it("una spesa da rimborsare non si scrive nella tasca", async () => {
    const prima = await conta();
    const righe = await detta("da rimborsare", [
      {
        tipo: "anticipazione_da_registrare",
        sicuro: true,
        destinazione: "Anticipo io, poi mi rimborso",
        motivo: "Hai detto che questi soldi devono tornarti.",
        frase: `${NOME} anticipo`,
        dati: { importo: 30, descrizione: `${NOME} pane anticipato` },
      },
    ]);
    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("titolo, eseguibile")
      .eq("id", righe[0].appunto_id)
      .single();
    expect(appunto.eseguibile).toBe(false);
    expect(appunto.titolo).toBe("Anticipo io, poi mi rimborso");
    expect(await conta()).toEqual(prima);
  });

  // -------------------------------------------------------------------
  it("🔴 nella tasca non si può far entrare denaro, nemmeno dal database", async () => {
    // ⚠️ La protezione è del 30/08 e non è stata riscritta: qui si controlla
    //    che ci sia ancora, perché è quella su cui questo lavoro poggia.
    const { error } = await titolare.from("cash_movements").insert({
      entity_id: tasca,
      direction: "entrata",
      amount: 5,
      movement_date: new Date().toISOString().slice(0, 10),
      mezzo: "cassa",
      business_purpose: `${NOME} entrata vietata`,
    });
    expect(error, "la tasca ha accettato un'entrata").not.toBeNull();
    expect(error.message).toMatch(/escono soldi|anticipazioni/i);
  });

  it("l'uscita a mano della tasca porta sulla tasca, non su Borgo 58", async () => {
    const { data: percorso } = await titolare.rpc("azione_percorso", { p_tipo: "spesa_tasca" });
    expect(percorso).toBe("/cassa/prima-nota?soggetto=tasca");
    const { data: altro } = await titolare.rpc("azione_percorso", { p_tipo: "movimento_cassa" });
    expect(altro).toBe("/cassa/prima-nota");
  });

  it("🔴 annullare una spesa della tasca la toglie, e non tocca l'osteria", async () => {
    const prima = await conta();
    const righe = await detta("da annullare", [
      spesa("spesa_tasca", { importo: 3, descrizione: `${NOME} da annullare` }),
    ]);
    await approva(righe[0].appunto_id);

    const scritto = (await miei_movimenti()).find(
      (m) => m.business_purpose === `${NOME} da annullare`,
    );
    expect(scritto).toBeTruthy();

    // Si annulla come si annulla un movimento qualunque: non c'è un gesto
    // nuovo da imparare, ed è il senso di «riusare i gesti esistenti».
    const { error } = await titolare.from("cash_movements").delete().eq("id", scritto.id);
    expect(error).toBeNull();

    const dopo = await conta();
    expect(dopo.tasca).toBe(prima.tasca);
    expect(dopo.osteria).toBe(prima.osteria);
  });
});
