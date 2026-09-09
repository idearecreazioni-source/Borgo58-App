import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio } from "./aiuto";
import {
  TIPO_FATTO,
  TIPO_QUALE,
  TIPO_SPOSTA,
  destinazioneAgenda,
} from "../../supabase/functions/ascolta-voce/agenda.ts";

// =====================================================================
// RICONOSCERE L'IMPEGNO SENZA RIPETERNE IL TITOLO — contro il database vero
// =====================================================================
// 🔴 IL DIFETTO CHE SI CHIUDE, misurato col telefono in mano il 09/09/2026:
//    in Agenda c'è «Rinnovo firma digitale», e la frase che viene da sé —
//    «segna come fatto il rinnovo DELLA firma digitale» — non lo trovava.
//    Nessun errore: una frase sicura di sé che diceva «non l'ho trovato fra
//    quelli aperti in Agenda» su una cosa che c'era.
//
// 🔴 E QUELLO CHE QUESTE PROVE SORVEGLIANO NON È CHE TROVI: è che non trovi
//    TROPPO. Allargare il confronto e basta sarebbe pericoloso quanto non
//    trovare niente — su un gesto che CHIUDE l'impegno di qualcun altro o
//    sposta una scadenza che nessuno voleva toccare, e sbagliando non dà
//    nessun segnale.
//
// ⚠️ SI ATTRAVERSA LA STESSA PORTA DEL TELEFONO: si detta come detta la
//    funzione online (`registra_dettatura`), si legge come legge la
//    schermata (`azioni_della_dettatura`), si approva come approva il
//    pulsante (il corridoio), e poi si va a GUARDARE in Agenda.
//
// ⚠️ NESSUNA DI QUESTE PROVE CHIAMA IL MODELLO: la classificazione della
//    frase la fa `destinazioneAgenda`, che è codice nostro e deterministico,
//    e il resto è database. Questo giro non costa un centesimo.

const NOME = marchio("TEST-AUTO agenda3");

describe("riconoscere l'impegno quando il titolo non si ripete uguale", () => {
  let titolare;
  const miei = { dettature: [], appunti: [], azioni: [], tasks: [] };

  async function impegno(coda, dueDate = null) {
    const { data, error } = await titolare
      .from("tasks")
      .insert({ title: `${NOME} ${coda}`, status: "da_fare", due_date: dueDate, category: "altro" })
      .select("id, title, due_date, status")
      .single();
    if (error) throw error;
    miei.tasks.push(data.id);
    return data;
  }

  /** Detta come detta la funzione online, passando dalla REGOLA VERA. */
  async function detta(dettato, azione) {
    const a = destinazioneAgenda({ sicuro: true, frase: `${NOME} riga`, ...azione }, dettato);
    const { data, error } = await titolare.rpc("registra_dettatura", {
      p_testo: `${NOME} — ${dettato}`,
      p_azioni: [a],
      p_esito: "capita",
      p_modello: null,
      p_token_domanda: 0,
      p_token_risposta: 0,
      p_messaggio: null,
    });
    if (error) throw error;
    miei.dettature.push(data.dettatura_id);

    const { data: righe, error: e2 } = await titolare.rpc("azioni_della_dettatura", {
      p_id: data.dettatura_id,
    });
    if (e2) throw e2;

    const { data: grezze } = await titolare
      .from("azioni_dettate")
      .select("id, appunto_id")
      .eq("dettatura_id", data.dettatura_id);
    for (const r of grezze ?? []) {
      miei.azioni.push(r.id);
      if (!miei.appunti.includes(r.appunto_id)) miei.appunti.push(r.appunto_id);
    }

    const appuntoId = (grezze ?? [])[0]?.appunto_id;
    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("id, titolo, eseguibile")
      .eq("id", appuntoId)
      .single();

    return { riga: (righe ?? [])[0], appunto };
  }

  const approva = (id) =>
    titolare.functions.invoke("operazioni-atomiche", {
      body: { operazione: "approva_appunto", parametri: { p_id: id } },
    });

  const leggi = async (id) => {
    const { data } = await titolare
      .from("tasks")
      .select("id, title, status, due_date")
      .eq("id", id)
      .single();
    return data;
  };

  // 🔴 SI CONTANO SOLO GLI IMPEGNI DI QUESTA PROVA — 09/09/2026.
  //    Prima si contava TUTTA la tabella, e in mezzo c'è Alessio: se dal
  //    telefono approva un appunto mentre il giro sta girando, nasce un
  //    impegno che questa prova non ha creato e il confronto «prima ==
  //    dopo» diventa rosso **per un fatto che non è un difetto**.
  //    ⚠️ E non si perde niente: un impegno creato per sbaglio da questa
  //    frase porterebbe il marchio della prova, perché il titolo nasce da
  //    quello che le si è fatto dire.
  const quantiImpegni = async () => {
    const { count } = await titolare
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .like("title", `${NOME}%`);
    return count;
  };

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
  });

  afterAll(async () => {
    // ⚠️ Solo ciò che questa prova ha creato, per identificativo (23/08).
    const { data: nati } = await titolare.from("tasks").select("id").like("title", `${NOME}%`);
    for (const t of nati ?? []) if (!miei.tasks.includes(t.id)) miei.tasks.push(t.id);
    if (miei.tasks.length) await titolare.from("tasks").delete().in("id", miei.tasks);
    if (miei.azioni.length) await titolare.from("azioni_dettate").delete().in("id", miei.azioni);
    if (miei.appunti.length) await titolare.from("appunti_vocali").delete().in("id", miei.appunti);
    if (miei.dettature.length) await titolare.from("dettature").delete().in("id", miei.dettature);
  });

  // -------------------------------------------------------------------
  it("🔴 «il rinnovo DELLA firma digitale» trova «Rinnovo firma digitale»", async () => {
    // È il caso vero, quello che il telefono ha trovato rotto.
    const t = await impegno("Rinnovo firmax digitalex", "2027-03-01");
    const altro = await impegno("Comprare la cartax fornox");

    const { riga, appunto } = await detta(
      "Segna come fatto il rinnovo della firma digitale",
      { tipo: TIPO_FATTO, dati: { impegno: `${NOME} rinnovo della firmax digitalex` } },
    );

    expect(riga.tipo).toBe(TIPO_FATTO);
    expect(riga.dati.task_id).toBe(t.id);
    // ⚠️ Il titolo mostrato è quello SCRITTO IN AGENDA: chi firma deve
    //    vedere il nome della riga che verrà toccata.
    expect(riga.dati.titolo).toBe(t.title);
    expect(appunto.eseguibile).toBe(true);
    // Risolto: nessun elenco di candidati da mostrare.
    expect(riga.dati.impegni_possibili).toBeUndefined();

    // Prima di approvare non è cambiato niente: SPEC-0013.
    expect((await leggi(t.id)).status).toBe("da_fare");

    const { error } = await approva(appunto.id);
    expect(error).toBeNull();
    expect((await leggi(t.id)).status).toBe("completato");
    expect((await leggi(altro.id)).status).toBe("da_fare");
  });

  // -------------------------------------------------------------------
  it("maiuscole, punteggiatura, spazi doppi e accenti non cambiano il risultato", async () => {
    const t = await impegno("Verifica caffè zorbax", "2027-03-02");

    const { riga, appunto } = await detta("Segna come fatto la verifica del caffe", {
      tipo: TIPO_FATTO,
      // 🔴 L'accento NEL VERSO IN CUI SBAGLIA IL TELEFONO: in Agenda c'è
      //    «caffè», la dettatura scrive «caffe». Più maiuscole, virgole e
      //    spazi doppi tutti insieme.
      dati: { impegno: `${NOME.toUpperCase()},  VERIFICA   del CAFFE!! zorbax.` },
    });

    expect(riga.tipo).toBe(TIPO_FATTO);
    expect(riga.dati.task_id).toBe(t.id);
    expect(appunto.eseguibile).toBe(true);
  });

  // -------------------------------------------------------------------
  it("🔴 due candidati pari: non sceglie, non si approva, e DICE quali sono", async () => {
    const a = await impegno("Ordinex verdurax", "2027-03-03");
    const b = await impegno("Ordinex delle verdurax", "2027-03-04");

    const { riga, appunto } = await detta("Segna come fatto l'ordine di verdure", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} ordinex di verdurax` },
    });

    expect(riga.tipo).toBe(TIPO_QUALE);
    expect(appunto.eseguibile).toBe(false);
    expect(riga.motivo).toMatch(/quale dei 2/);

    // 🔴 LA META' NUOVA: prima diceva «quale dei 2» e basta, e chi lo
    //    leggeva doveva andarli a cercare in Agenda.
    const candidati = riga.dati.impegni_possibili;
    expect(Array.isArray(candidati)).toBe(true);
    expect(candidati).toHaveLength(2);
    const titoli = candidati.map((c) => c.titolo).sort();
    expect(titoli).toEqual([a.title, b.title].sort());
    // ⚠️ Col GIORNO: è quello che li distingue davvero.
    expect(candidati.map((c) => c.data).sort()).toEqual(["2027-03-03", "2027-03-04"]);

    // E provando lo stesso, il database RIFIUTA e in Agenda non cambia niente.
    const r = await approva(appunto.id);
    expect(r.error).not.toBeNull();
    expect((await leggi(a.id)).status).toBe("da_fare");
    expect((await leggi(b.id)).status).toBe("da_fare");
  });

  // -------------------------------------------------------------------
  it("un candidato senza scadenza porta il giorno vuoto, non una data inventata", async () => {
    const a = await impegno("Sistemarex tendex", null);
    const b = await impegno("Sistemarex le tendex", "2027-03-06");

    const { riga } = await detta("Segna come fatto sistemare le tende", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} sistemarex di tendex` },
    });

    expect(riga.tipo).toBe(TIPO_QUALE);
    const candidati = riga.dati.impegni_possibili ?? [];
    expect(candidati).toHaveLength(2);
    const senzaData = candidati.find((c) => c.titolo === a.title);
    expect(senzaData).toBeTruthy();
    expect(senzaData.data ?? null).toBeNull();
    expect(candidati.find((c) => c.titolo === b.title).data).toBe("2027-03-06");
  });

  // -------------------------------------------------------------------
  it("🔴 il titolo esatto VINCE su chi lo contiene: allargare non toglie risposte", async () => {
    // È la proprietà che rende sicuro l'allargamento del confronto: un
    // gradino largo non può togliere una risposta che un gradino stretto
    // aveva già dato.
    const preciso = await impegno("Panex kalox", "2027-03-05");
    const piuLungo = await impegno("Panex kalox e lattex", "2027-03-07");

    const { riga, appunto } = await detta("Segna come fatto il pane", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} Panex kalox` },
    });

    expect(riga.tipo).toBe(TIPO_FATTO);
    expect(riga.dati.task_id).toBe(preciso.id);
    expect(appunto.eseguibile).toBe(true);

    const { error } = await approva(appunto.id);
    expect(error).toBeNull();
    expect((await leggi(preciso.id)).status).toBe("completato");
    expect((await leggi(piuLungo.id)).status).toBe("da_fare");
  });

  // -------------------------------------------------------------------
  it("nessun impegno compatibile: lo dice, non mostra candidati, e non crea niente", async () => {
    const prima = await quantiImpegni();
    const { riga, appunto } = await detta("Segna come fatto la revisione del forno", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} xilofonox marmellatox` },
    });

    expect(riga.tipo).toBe(TIPO_QUALE);
    expect(appunto.eseguibile).toBe(false);
    expect(riga.motivo).toMatch(/non l'ho trovato|non l’ho trovato/i);
    expect(riga.dati.impegni_possibili).toBeUndefined();
    // 🔴 Una frase che CHIUDE non deve creare.
    expect(await quantiImpegni()).toBe(prima);
  });

  // -------------------------------------------------------------------
  it("🔴 spostare con la variante naturale: identificativo, giorno di prima e giorno nuovo", async () => {
    const t = await impegno("Consegnax vimox", "2027-04-10");
    const altro = await impegno("Consegnax panex", "2027-04-10");

    const { riga, appunto } = await detta("Sposta a venerdì la consegna di vimo", {
      tipo: TIPO_SPOSTA,
      dati: { impegno: `${NOME} la consegnax di vimox`, data_nuova: "2027-05-20" },
    });

    expect(riga.tipo).toBe(TIPO_SPOSTA);
    expect(riga.dati.task_id).toBe(t.id);
    expect(riga.dati.titolo).toBe(t.title);
    expect(riga.dati.data_precedente).toBe("2027-04-10");
    expect(riga.dati.data_nuova).toBe("2027-05-20");
    expect(appunto.eseguibile).toBe(true);

    const { error } = await approva(appunto.id);
    expect(error).toBeNull();
    expect((await leggi(t.id)).due_date).toBe("2027-05-20");
    // 🔴 E l'altro non si è mosso.
    expect((await leggi(altro.id)).due_date).toBe("2027-04-10");
  });

  // -------------------------------------------------------------------
  it("🔴 chiuso fra la proposta e il sì: rifiuta, e NON ne pesca uno che gli somiglia", async () => {
    // 🔴 È il rischio che il confronto più largo introduce: se l'impegno
    //    proposto sparisce e in Agenda ce n'è un altro somigliante,
    //    ripescarlo vorrebbe dire chiudere una riga che nessuno ha mai
    //    visto sull'appunto firmato.
    const proposto = await impegno("Revisionex cappax", "2027-06-01");
    const somigliante = await impegno("Revisionex della cappax", "2027-06-02");

    const { riga, appunto } = await detta("Segna come fatto la revisione della cappa", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} Revisionex cappax` },
    });
    expect(riga.dati.task_id).toBe(proposto.id);
    expect(appunto.eseguibile).toBe(true);

    // Fra la proposta e il sì, l'impegno viene chiuso a mano.
    await titolare.from("tasks").update({ status: "completato" }).eq("id", proposto.id);

    const r = await approva(appunto.id);
    expect(r.error).not.toBeNull();
    // 🔴 E il somigliante è rimasto aperto: non è stato preso al suo posto.
    expect((await leggi(somigliante.id)).status).toBe("da_fare");
  });
});
