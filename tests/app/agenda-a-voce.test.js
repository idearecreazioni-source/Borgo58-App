import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio } from "./aiuto";
import {
  TIPO_FATTO,
  TIPO_PROMEMORIA,
  TIPO_QUALE,
  TIPO_SPOSTA,
  destinazioneAgenda,
} from "../../supabase/functions/ascolta-voce/agenda.ts";

// L'AGENDA DETTATA A VOCE, FASE 2 — contro il database vero.
//
// 🔴 SI ATTRAVERSA LA STESSA PORTA DEL TELEFONO, tutta: si detta come detta
//    la funzione online (`registra_dettatura`), si legge l'appunto come lo
//    legge la schermata (`azioni_della_dettatura`, non la tabella), si
//    approva come approva il pulsante (il corridoio), e poi si va a
//    GUARDARE in Agenda se è cambiato quello che doveva.
//
//    ⚠️ Non è pignoleria: l'08/09 tutte le prove di questo percorso erano
//    verdi mentre il telefono rispondeva «non ho capito niente», perché
//    leggevano la riga dalla tabella invece che dalla porta della schermata.
//
// 🔴 E LA COSA CHE QUESTE PROVE SORVEGLIANO NON È CHE FUNZIONI: è che NON
//    SCELGA. Chiudere l'impegno sbagliato o spostare la scadenza di un
//    altro sono due errori che nessuno noterebbe subito, e che nessun
//    messaggio d'errore annuncerebbe.

const NOME = marchio("TEST-AUTO agenda2");

describe("chiudere e spostare un impegno a voce", () => {
  let titolare;
  const miei = { dettature: [], appunti: [], azioni: [], tasks: [] };

  /** Un impegno di questa prova, riconoscibile e mio. */
  async function impegno(coda, dueDate = null) {
    const titolo = `${NOME} ${coda}`;
    const { data, error } = await titolare
      .from("tasks")
      .insert({ title: titolo, status: "da_fare", due_date: dueDate, category: "altro" })
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

    // 🔴 DALLA PORTA DELLA SCHERMATA, non dalla tabella.
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

    // ⚠️ Quello che è stato scritto e quello che la schermata riceve devono
    //    coincidere sempre, anche quando la destinazione non si esegue.
    expect(
      (righe ?? []).length,
      "la schermata non riceve tutte le righe: dirà «non ho capito niente»",
    ).toBe((grezze ?? []).length);

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

  const quantiImpegni = async () => {
    const { count } = await titolare.from("tasks").select("*", { count: "exact", head: true });
    return count;
  };

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
  });

  afterAll(async () => {
    // ⚠️ Solo ciò che questa prova ha creato, per identificativo (23/08).
    //    ⚠️ Anche gli impegni nati da un'approvazione: un promemoria
    //    approvato crea una riga che non è passata da `impegno()`.
    const { data: nati } = await titolare.from("tasks").select("id").like("title", `${NOME}%`);
    for (const t of nati ?? []) if (!miei.tasks.includes(t.id)) miei.tasks.push(t.id);
    if (miei.tasks.length) await titolare.from("tasks").delete().in("id", miei.tasks);
    if (miei.azioni.length) await titolare.from("azioni_dettate").delete().in("id", miei.azioni);
    if (miei.appunti.length) await titolare.from("appunti_vocali").delete().in("id", miei.appunti);
    if (miei.dettature.length) await titolare.from("dettature").delete().in("id", miei.dettature);
  });

  // -------------------------------------------------------------------
  it("il catalogo conosce i due gesti, e ognuno ha la sua esecuzione", async () => {
    const { data: cat } = await titolare
      .from("tipi_azione_vocale")
      .select("tipo, attivo, eseguibile");
    const perTipo = new Map((cat ?? []).map((t) => [t.tipo, t]));
    for (const t of [TIPO_FATTO, TIPO_SPOSTA]) {
      expect(perTipo.get(t), `${t} non è nel catalogo`).toBeTruthy();
      expect(perTipo.get(t).attivo).toBe(true);
      expect(perTipo.get(t).eseguibile).toBe(true);
    }
    // 🔴 `agenda_quale_impegno` resta FUORI, ed è così che non si approva.
    expect([...perTipo.keys()]).not.toContain(TIPO_QUALE);

    // ⚠️ La rete del 27/08: un tipo acceso senza il ramo che lo esegue è
    //    una cosa che il gestionale propone e poi non sa fare.
    const { data: scoperti } = await titolare.rpc("tipi_vocali_senza_ramo");
    expect(scoperti).toEqual([]);
  });

  // -------------------------------------------------------------------
  it("🔴 un solo impegno compatibile: si approva, e chiude QUELLO", async () => {
    const t = await impegno("rinnovo della firma digitale", "2026-09-30");
    const altro = await impegno("comprare la carta forno");

    const { riga, appunto } = await detta("Segna come fatto il rinnovo della firma digitale", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} rinnovo della firma digitale` },
    });

    expect(riga.tipo).toBe(TIPO_FATTO);
    expect(riga.dati.task_id).toBe(t.id);
    // ⚠️ Il titolo mostrato è quello SCRITTO IN AGENDA, non le parole dette.
    expect(riga.dati.titolo).toBe(t.title);
    expect(riga.dati.gesto).toBe("segna fatto");
    expect(riga.percorso).toBe("/agenda");
    expect(appunto.eseguibile).toBe(true);
    expect(appunto.titolo).toBe("Da segnare fatto in Agenda");

    // Prima di approvare non è cambiato niente: SPEC-0013.
    expect((await leggi(t.id)).status).toBe("da_fare");

    const { error } = await approva(appunto.id);
    expect(error).toBeNull();

    expect((await leggi(t.id)).status).toBe("completato");
    // 🔴 E l'altro impegno non si è mosso: si chiude UNO SOLO.
    expect((await leggi(altro.id)).status).toBe("da_fare");
  });

  // -------------------------------------------------------------------
  it("🔴 due impegni compatibili: non sceglie, e non si può approvare", async () => {
    const a = await impegno("ordine delle verdure di lunedì");
    const b = await impegno("ordine delle verdure di giovedì");

    const { riga, appunto } = await detta("Segna come fatto l'ordine delle verdure", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} ordine delle verdure` },
    });

    expect(riga.tipo).toBe(TIPO_QUALE);
    expect(appunto.eseguibile).toBe(false);
    expect(appunto.titolo).toBe("Quale impegno?");
    // 🔴 IL NUMERO NON SI FISSA — corretto il 09/09/2026, misurando.
    //    Questa riga diceva `/quale dei 2/`, ed è diventata rossa quando sul
    //    progetto di prova è comparso un impegno VERO («Ordine delle
    //    verdure») che combacia con la frase di questa prova: i candidati
    //    sono diventati tre.
    //    ⚠️ Misurato che NON dipende dal confronto nuovo: con la regola di
    //    prima quei tre titoli combaciavano tutti e tre lo stesso. È il
    //    conteggio globale a essere fragile — dipende da tutto ciò che c'è in
    //    Agenda in quel momento, comprese le righe di Alessio.
    //    *Un numero letto dal mondo e scritto dentro una prova è un fossile*
    //    (regola del 16/08: un guardiano dice come DEVE essere fatto il
    //    mondo, non com'era quando l'ho guardato).
    expect(riga.motivo).toMatch(/quale dei \d+ impegni aperti/);
    // La proprietà che conta: i DUE di questa prova sono fra i candidati.
    const possibili = (riga.dati.impegni_possibili ?? []).map((c) => c.titolo);
    expect(possibili).toContain(a.title);
    expect(possibili).toContain(b.title);
    // ⚠️ E la via d'uscita c'è comunque: un rifiuto senza gesto d'uscita è
    //    un vicolo cieco (16/08).
    expect(riga.percorso).toBe("/agenda");

    // 🔴 E provando lo stesso, il database RIFIUTA.
    const r = await approva(appunto.id);
    expect(r.error).not.toBeNull();
    const corpo = await r.error.context.json();
    expect(corpo?.errore?.messaggio ?? "").toMatch(/non si pu/i);

    expect((await leggi(a.id)).status).toBe("da_fare");
    expect((await leggi(b.id)).status).toBe("da_fare");
  });

  it("🔴 nessun impegno compatibile: lo dice, e non crea niente in Agenda", async () => {
    const prima = await quantiImpegni();
    const { riga, appunto } = await detta("Segna come fatto la revisione del forno", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} una cosa che non esiste` },
    });

    expect(riga.tipo).toBe(TIPO_QUALE);
    expect(appunto.eseguibile).toBe(false);
    expect(riga.motivo).toMatch(/non l'ho trovato|non l’ho trovato/i);
    // 🔴 È il difetto della fase 1, che qui potrebbe tornare da un'altra
    //    porta: una frase che chiude non deve creare.
    expect(await quantiImpegni()).toBe(prima);
  });

  // -------------------------------------------------------------------
  it("🔴 spostare: mostra i due giorni, e sposta SOLO quello", async () => {
    const t = await impegno("ordine del pesce", "2026-09-07");
    const altro = await impegno("ordine del pane", "2026-09-07");

    const { riga, appunto } = await detta("Sposta a venerdì l'ordine del pesce", {
      tipo: TIPO_SPOSTA,
      dati: { impegno: `${NOME} ordine del pesce`, data_nuova: "2026-09-11" },
    });

    expect(riga.tipo).toBe(TIPO_SPOSTA);
    expect(riga.dati.task_id).toBe(t.id);
    // 🔴 TUTTI E TRE i pezzi che il mandato chiede: titolo, giorno di
    //    partenza e giorno nuovo.
    expect(riga.dati.titolo).toBe(t.title);
    expect(riga.dati.data_precedente).toBe("2026-09-07");
    expect(riga.dati.data_nuova).toBe("2026-09-11");
    expect(appunto.eseguibile).toBe(true);

    expect((await leggi(t.id)).due_date).toBe("2026-09-07");
    const { error } = await approva(appunto.id);
    expect(error).toBeNull();

    const dopo = await leggi(t.id);
    expect(dopo.due_date).toBe("2026-09-11");
    expect(dopo.status, "spostare un impegno lo ha anche chiuso").toBe("da_fare");
    expect((await leggi(altro.id)).due_date).toBe("2026-09-07");
  });

  it("🔴 spostare senza dire a quando: chiede, non inventa", async () => {
    const t = await impegno("ordine del vino", "2026-09-07");
    const { riga, appunto } = await detta("Sposta l'ordine del vino", {
      tipo: TIPO_SPOSTA,
      dati: { impegno: `${NOME} ordine del vino` },
    });
    expect(riga.tipo).toBe(TIPO_QUALE);
    expect(appunto.eseguibile).toBe(false);
    // ⚠️ QUI IL DATABASE NON VIENE NEMMENO INTERROGATO, e la frase lo mostra:
    //    che manchi il giorno si vede dalle PAROLE, quindi a fermarsi è già
    //    il modulo della voce — e `agenda_quale_impegno` non è nel catalogo,
    //    quindi nessuno lo ritraduce. Le strade che portano a «Quale
    //    impegno?» sono due, e questa è quella che non ha bisogno di
    //    guardare in Agenda.
    expect(riga.motivo).toMatch(/a quando/);
    expect((await leggi(t.id)).due_date).toBe("2026-09-07");
  });

  it("una data che non ha la forma di una data non è una data", async () => {
    // ⚠️ Il modello può scrivere «venerdì» invece di una data: entra come
    //    testo e non come giorno, e il gestionale chiede invece di
    //    infilarlo in un campo data.
    const t = await impegno("ordine dei formaggi", "2026-09-07");
    const { riga, appunto } = await detta("Sposta a venerdì l'ordine dei formaggi", {
      tipo: TIPO_SPOSTA,
      dati: { impegno: `${NOME} ordine dei formaggi`, data_nuova: "venerdì" },
    });
    expect(riga.tipo).toBe(TIPO_QUALE);
    expect(appunto.eseguibile).toBe(false);
    expect((await leggi(t.id)).due_date).toBe("2026-09-07");
  });

  // -------------------------------------------------------------------
  it("🔴 l'impegno viene chiuso FRA la proposta e il sì: l'approvazione si ferma", async () => {
    const t = await impegno("controllo dell'estintore");
    // ⚠️ Uno che gli somiglia, apposta: se dopo aver perso il suo l'appunto
    //    ricercasse, chiuderebbe QUESTO — una riga mai vista da chi firma.
    const somigliante = await impegno("controllo dell'estintore grande");

    const { appunto } = await detta("Segna come fatto il controllo dell'estintore", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} controllo dell'estintore` },
    });
    expect(appunto.eseguibile).toBe(true);

    // Qualcun altro lo chiude dall'Agenda.
    await titolare.from("tasks").update({ status: "completato" }).eq("id", t.id);

    const r = await approva(appunto.id);
    expect(r.error, "un impegno già chiuso si è lasciato chiudere di nuovo").not.toBeNull();
    const corpo = await r.error.context.json();
    expect(corpo?.errore?.messaggio ?? "").toMatch(/non è più aperto|non e' piu' aperto|già fatto/i);

    // 🔴 E non ha ripescato quello somigliante.
    expect(
      (await leggi(somigliante.id)).status,
      "approvando si è chiuso un impegno DIVERSO da quello proposto",
    ).toBe("da_fare");
  });

  it("🔴 l'impegno viene SPOSTATO fra la proposta e il sì: non si sovrascrive", async () => {
    const t = await impegno("taratura del termometro", "2026-09-07");
    const { appunto } = await detta("Sposta a venerdì la taratura del termometro", {
      tipo: TIPO_SPOSTA,
      dati: { impegno: `${NOME} taratura del termometro`, data_nuova: "2026-09-11" },
    });
    expect(appunto.eseguibile).toBe(true);

    // Qualcun altro lo porta a un'altra data.
    await titolare.from("tasks").update({ due_date: "2026-09-25" }).eq("id", t.id);

    const r = await approva(appunto.id);
    expect(r.error, "una scadenza cambiata si è lasciata riscrivere").not.toBeNull();
    const corpo = await r.error.context.json();
    expect(corpo?.errore?.messaggio ?? "").toMatch(/25\/09\/2026/);

    // 🔴 E la data non è stata toccata: fermarsi vuol dire non scrivere.
    expect((await leggi(t.id)).due_date).toBe("2026-09-25");
  });

  it("un impegno tolto dall'Agenda: l'approvazione si ferma e lo dice", async () => {
    const t = await impegno("pulizia della cappa");
    const { appunto } = await detta("Segna come fatta la pulizia della cappa", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} pulizia della cappa` },
    });
    expect(appunto.eseguibile).toBe(true);

    await titolare.from("tasks").delete().eq("id", t.id);
    miei.tasks = miei.tasks.filter((x) => x !== t.id);

    const r = await approva(appunto.id);
    expect(r.error).not.toBeNull();
  });

  // -------------------------------------------------------------------
  it("🔴 LA METÀ CHE DISCRIMINA: «ricordami di…» crea l'impegno, come sempre", async () => {
    // 🔴 Una regola che dirottasse tutto passerebbe tutte le prove qui
    //    sopra e romperebbe il gesto più frequente dell'Agenda.
    const prima = await quantiImpegni();
    const titolo = `${NOME} chiamare Tiziana ${crypto.randomUUID().slice(0, 8)}`;

    const { riga, appunto } = await detta(`Ricordami di ${titolo} domani`, {
      tipo: TIPO_PROMEMORIA,
      dati: { titolo, data: "2026-09-10" },
    });
    expect(riga.tipo).toBe(TIPO_PROMEMORIA);
    expect(appunto.eseguibile).toBe(true);
    expect(appunto.titolo).toBe("Annota in Agenda");
    expect(riga.percorso).toBe("/agenda/nuovo");
    expect(await quantiImpegni()).toBe(prima);

    const { error } = await approva(appunto.id);
    expect(error).toBeNull();

    const { data: nato } = await titolare
      .from("tasks")
      .select("id, due_date, status")
      .eq("title", titolo)
      .single();
    expect(nato).toBeTruthy();
    expect(nato.due_date).toBe("2026-09-10");
    expect(nato.status).toBe("da_fare");
    miei.tasks.push(nato.id);
  });

  // -------------------------------------------------------------------
  it("gli accenti non fanno perdere l'impegno", async () => {
    // ⚠️ La dettatura del telefono gli accenti a volte li mette e a volte
    //    no, e i due lati del confronto arrivano da due strade diverse: il
    //    titolo l'ha scritto Alessio in Agenda, le parole le ha trascritte
    //    il telefono. «venerdì» e «venerdi» devono essere la stessa parola,
    //    altrimenti un impegno che c'è non si trova.
    const t = await impegno("ordinare il caffè lunedì");
    const { riga, appunto } = await detta("Segna come fatto ordinare il caffe lunedi", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} ordinare il caffe lunedi` },
    });
    expect(riga.tipo).toBe(TIPO_FATTO);
    expect(riga.dati.task_id).toBe(t.id);
    expect(appunto.eseguibile).toBe(true);
  });

  it("un impegno «in corso» è un impegno vivo, e resta fra i candidati", async () => {
    // ⚠️ Gli stati sono tre — da fare, in corso, completato — e solo l'ultimo
    //    è chiuso. Escludere «in corso» vorrebbe dire che una cosa cominciata
    //    non si può più segnare fatta a voce, che è il momento in cui serve.
    const t = await impegno("scongelare il brodo");
    await titolare.from("tasks").update({ status: "in_corso" }).eq("id", t.id);

    const { riga, appunto } = await detta("Segna come fatto scongelare il brodo", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} scongelare il brodo` },
    });
    expect(riga.tipo).toBe(TIPO_FATTO);
    expect(riga.dati.task_id).toBe(t.id);
    expect(appunto.eseguibile).toBe(true);

    const { error } = await approva(appunto.id);
    expect(error).toBeNull();
    expect((await leggi(t.id)).status).toBe("completato");
  });

  it("🔴 due parole non bastano a prendere mezza Agenda", async () => {
    // 🔴 Il confronto «contiene» con un testo cortissimo prenderebbe quasi
    //    tutto, e mezza Agenda è la stessa cosa di nessun risultato — con
    //    l'aggravante di sembrare una ricerca. Sotto le tre lettere non si
    //    cerca affatto, e lo si dice.
    await impegno("ordinare la carta forno");
    await impegno("ordinare i tovaglioli");
    const { riga, appunto } = await detta("Segna come fatto o", {
      tipo: TIPO_FATTO,
      dati: { impegno: "o" },
    });
    expect(riga.tipo).toBe(TIPO_QUALE);
    expect(appunto.eseguibile).toBe(false);
  });

  it("e un impegno già chiuso non torna fra i candidati", async () => {
    // ⚠️ Uno fatto non si richiude e non si sposta: comparire fra i
    //    candidati lo renderebbe ambiguo per niente.
    const chiuso = await impegno("inventario della cantina");
    await titolare.from("tasks").update({ status: "completato" }).eq("id", chiuso.id);
    const aperto = await impegno("inventario della cantina di settembre");

    const { riga, appunto } = await detta("Segna come fatto l'inventario della cantina", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} inventario della cantina` },
    });
    // Ne resta uno solo aperto, quindi si può fare.
    expect(riga.tipo).toBe(TIPO_FATTO);
    expect(riga.dati.task_id).toBe(aperto.id);
    expect(appunto.eseguibile).toBe(true);
  });
});
