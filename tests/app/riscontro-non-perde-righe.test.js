import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio } from "./aiuto";

// IL RISCONTRO SUBITO DOPO AVER PARLATO — contro il database vero.
//
// 🔴 IL FATTO CHE HA PRODOTTO QUESTE PROVE, misurato l'08/09/2026 sulle
//    dettature vere fatte da Alessio col telefono. Ha detto «segna come
//    fatto il rinnovo della firma digitale» e ha letto **«Non ho capito
//    niente di quello che hai detto»**. L'assistente aveva capito benissimo:
//    la riga era in `azioni_dettate`, col tipo giusto e il suo motivo.
//    A perderla era `azioni_della_dettatura`, che legava ogni riga al
//    catalogo con una congiunzione INTERNA — quindi una destinazione che il
//    gestionale non sa ancora eseguire **spariva senza nessun errore**.
//
// 🔴 E LE PROVE DI QUEL GIORNO ERANO TUTTE VERDI, ed è la ragione per cui
//    questo file esiste. Leggevano la riga **dalla tabella**, con una porta
//    di servizio: la riga c'era, quindi passavano. Nessuna chiedeva quello
//    che chiede la schermata. È la lezione già pagata tre volte in questo
//    progetto — le mance (16/08), i coperti (18/08), la traduzione dei
//    rifiuti (25/08): *una prova che entra da una porta sua non prova il
//    tratto fra schermata e database.*
//
// ⚠️ QUINDI QUI SI ENTRA DALLA PORTA DELLA SCHERMATA: `azioni_della_dettatura`
//    è la funzione che `Detta.jsx` chiama subito dopo aver parlato, e il
//    numero che ne esce è quello su cui si decide se scrivere «non ho capito
//    niente». Si confronta con le righe davvero scritte.
//
// ⚠️ E NON SI PROVA CHE QUALCOSA DIVENTI APPROVABILE: se una cosa si possa
//    approvare lo dice `appunti_vocali.eseguibile`, per un'altra strada.
//    Qui si prova solo che la riga ARRIVI a chi guarda — e la prova lo
//    dichiara controllando che resti non approvabile.

const NOME = marchio("TEST-AUTO riscontro");

describe("il riscontro subito dopo aver parlato", () => {
  let titolare;
  const miei = { dettature: [], appunti: [], azioni: [] };

  /** Una destinazione che il catalogo non conosce e non conoscerà mai. */
  const tipoInventato = () => `${NOME.replace(/[^a-z0-9]+/gi, "_")}_${crypto.randomUUID().slice(0, 8)}`;

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
      .select("id, appunto_id")
      .eq("dettatura_id", data.dettatura_id);
    for (const r of righe ?? []) {
      miei.azioni.push(r.id);
      if (!miei.appunti.includes(r.appunto_id)) miei.appunti.push(r.appunto_id);
    }
    return data.dettatura_id;
  }

  /** Quante righe sono scritte, e quante ne riceve la schermata. */
  async function scritteERicevute(dettaturaId) {
    const { count } = await titolare
      .from("azioni_dettate")
      .select("*", { count: "exact", head: true })
      .eq("dettatura_id", dettaturaId);
    const { data, error } = await titolare.rpc("azioni_della_dettatura", { p_id: dettaturaId });
    if (error) throw error;
    return { scritte: count, ricevute: (data ?? []).length, righe: data ?? [] };
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
  });

  afterAll(async () => {
    // ⚠️ Solo ciò che questa prova ha creato, per identificativo (23/08).
    if (miei.azioni.length) await titolare.from("azioni_dettate").delete().in("id", miei.azioni);
    if (miei.appunti.length) await titolare.from("appunti_vocali").delete().in("id", miei.appunti);
    if (miei.dettature.length) await titolare.from("dettature").delete().in("id", miei.dettature);
  });

  // -------------------------------------------------------------------
  it("🔴 una destinazione che il gestionale non sa eseguire ARRIVA lo stesso", async () => {
    const tipo = tipoInventato();
    const id = await detta("fuori catalogo", [
      {
        tipo,
        sicuro: true,
        destinazione: "Da fare a mano in Agenda",
        motivo: "Il gestionale non sa ancora farlo da una frase detta.",
        frase: `${NOME} riga fuori catalogo`,
        dati: { titolo: `${NOME} una cosa` },
      },
    ]);

    const { scritte, ricevute, righe } = await scritteERicevute(id);
    // 🔴 È il confronto che il difetto faceva fallire: 1 scritta, 0 ricevute,
    //    e la schermata scriveva «non ho capito niente».
    expect(scritte, "la riga non è stata nemmeno scritta").toBe(1);
    expect(ricevute, "la schermata non riceve la riga: dirà «non ho capito niente»").toBe(scritte);

    // ⚠️ E arriva col nome che si è dichiarata, non col tipo tecnico: è
    //    quello che Alessio legge.
    expect(righe[0].titolo).toBe("Da fare a mano in Agenda");
    expect(righe[0].natura).toBe("libera");
    expect(righe[0].motivo).toMatch(/non sa ancora/i);
  });

  it("🔴 ...e resta NON approvabile: qui non si è aperta nessuna porta", async () => {
    // ⚠️ La metà che questa correzione non deve toccare. Se mostrare una
    //    riga la rendesse anche approvabile, si sarebbe scambiata una cosa
    //    invisibile con una cosa firmabile per sbaglio.
    const tipo = tipoInventato();
    const id = await detta("fuori catalogo non approvabile", [
      {
        tipo,
        sicuro: true,
        destinazione: "Da fare a mano",
        frase: `${NOME} non approvabile`,
        dati: {},
      },
    ]);
    const { data: az } = await titolare
      .from("azioni_dettate")
      .select("appunto_id")
      .eq("dettatura_id", id)
      .single();
    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("titolo, eseguibile")
      .eq("id", az.appunto_id)
      .single();
    expect(appunto.eseguibile).toBe(false);
    expect(appunto.titolo).toBe("Da fare a mano");
  });

  // -------------------------------------------------------------------
  it("🔴 LA METÀ CHE DISCRIMINA: una destinazione conosciuta legge ancora il catalogo", async () => {
    // 🔴 Una cura che mostrasse la destinazione dichiarata per TUTTE le
    //    righe passerebbe la prova qui sopra e cambierebbe il nome delle
    //    quattordici destinazioni normali. Nella stessa dettatura ci sono
    //    tutt'e due, così il confronto è diretto.
    const tipo = tipoInventato();
    const id = await detta("le due insieme", [
      {
        tipo,
        sicuro: true,
        destinazione: "Da fare a mano",
        frase: `${NOME} fuori catalogo`,
        dati: {},
      },
      {
        tipo: "promemoria",
        sicuro: true,
        frase: `${NOME} promemoria`,
        dati: { titolo: `${NOME} promemoria` },
      },
    ]);

    const { scritte, ricevute, righe } = await scritteERicevute(id);
    expect(scritte).toBe(2);
    expect(ricevute).toBe(2);

    const fuori = righe.find((r) => r.tipo === tipo);
    const dentro = righe.find((r) => r.tipo === "promemoria");
    expect(fuori.titolo).toBe("Da fare a mano");
    expect(fuori.natura).toBe("libera");
    expect(dentro.titolo, "il promemoria ha smesso di prendere il nome dal catalogo").toBe(
      "Annota in Agenda",
    );
    expect(dentro.natura).toBe("misura");
  });

  it("e i due elenchi dicono la stessa cosa della stessa riga", async () => {
    // 🔴 Il difetto era proprio questo: `azioni_dettate_in_attesa` mostrava
    //    la riga (corretto il 06/09) e `azioni_della_dettatura` la faceva
    //    sparire (rimasto indietro). Due letture della stessa cosa che si
    //    contraddicono sono un difetto anche quando una delle due è giusta.
    const tipo = tipoInventato();
    const id = await detta("i due elenchi", [
      { tipo, sicuro: true, destinazione: "Da fare a mano", frase: `${NOME} due elenchi`, dati: {} },
    ]);
    const { righe } = await scritteERicevute(id);
    const { data: attesa, error } = await titolare.rpc("azioni_dettate_in_attesa");
    expect(error).toBeNull();
    const nellAltro = (attesa ?? []).filter((a) => a.dettatura_id === id);
    expect(nellAltro).toHaveLength(righe.length);
    expect(nellAltro[0].titolo).toBe(righe[0].titolo);
    expect(nellAltro[0].natura).toBe(righe[0].natura);
  });

  // -------------------------------------------------------------------
  it("🔴 e nessuna dettatura già scritta perde righe: è una PROPRIETÀ, non un elenco", async () => {
    // ⚠️ Non si controllano i sei tipi trovati l'08/09 uno per nome: un
    //    elenco scritto a mano invecchia al primo tipo nuovo. Si chiede al
    //    database quali destinazioni fuori catalogo hanno righe scritte, e
    //    per ognuna si confronta scritte con ricevute.
    const { data: cat } = await titolare.from("tipi_azione_vocale").select("tipo");
    const noti = new Set((cat ?? []).map((t) => t.tipo));

    // ⚠️ SI CHIEDE ANCHE QUANTE CE N'ERANO, e non solo le righe: senza il
    //    confronto, il tetto delle mille righe accorcerebbe la lettura in
    //    silenzio e questa prova direbbe «nessuna riga persa» avendone
    //    guardate meno di quelle che ci sono. È la famiglia del 19/08.
    const TETTO = 2000;
    const { data: az, count: quante } = await titolare
      .from("azioni_dettate")
      .select("dettatura_id, tipo", { count: "exact" })
      .limit(TETTO);
    expect(
      quante,
      `le righe dettate sono ${quante}: questa prova ne guarda al massimo ${TETTO}`,
    ).toBeLessThanOrEqual(TETTO);

    const daGuardare = new Map();
    for (const a of az ?? []) {
      if (noti.has(a.tipo) || daGuardare.has(a.tipo)) continue;
      daGuardare.set(a.tipo, a.dettatura_id);
    }

    const perse = [];
    for (const [tipo, dettatura] of daGuardare) {
      const { scritte, ricevute } = await scritteERicevute(dettatura);
      if (ricevute !== scritte) perse.push(`${tipo}: scritte ${scritte}, ricevute ${ricevute}`);
    }
    expect(perse, `il riscontro perde ancora delle righe — ${perse.join(" · ")}`).toEqual([]);
  }, 60000);
});
