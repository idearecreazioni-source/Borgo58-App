import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, spiega } from "./aiuto";

// =====================================================================
// LA FRASE MISTA E IL CASO DA CHIARIRE — contro il database vero
// =====================================================================
// 11/09/2026, mandato «MEMO affidabile», decisione di Alessio: *«Non deve
// mai accadere che un impegno esistente venga spostato al posto di un nuovo
// appuntamento.»*
//
// 🔴 COSA SI PROVA QUI, e cosa no. La SEPARAZIONE della frase la fa la
//    funzione online (`agenda.ts`, provata in `tests/unita/agenda-a-voce`).
//    Qui si prova la metà del database: dati i tipi che la funzione online
//    consegna, **approvare un appuntamento nuovo crea un impegno nuovo e
//    non tocca l'omonimo che c'è già**, lo spostamento sposta solo il suo,
//    e «da chiarire» non si approva e non muove niente.
//
// ⚠️ Il caso peggiore misurato prima della cura era proprio questo: un
//    impegno «riunione» in Agenda, un appuntamento nuovo «riunione» detto
//    insieme a uno spostamento, e approvando si spostava il vecchio.
//
// ⚠️ NESSUNA CHIAMATA AL MODELLO, NESSUN TELEGRAM (nessun avviso chiesto).

const NOME = marchio("TEST-AUTO frase mista");

const MOTIVO =
  "In questa frase c'erano insieme cose nuove da segnare e un impegno da spostare o da chiudere, " +
  "e non sono riuscito a capire con certezza quale parte va con quale.";

describe("🔴 frase mista: il nuovo resta nuovo, lo spostamento sposta solo il suo", () => {
  let titolare;
  const miei = { dettature: [], appunti: [], azioni: [], tasks: [] };
  const iso = (d) => d.toISOString().slice(0, 10);
  const giorno = (n) => iso(new Date(Date.now() + n * 86400000));
  let vecchioRiunione;
  let verdure;
  const T_RIUNIONE = `${NOME} riunione col commercialista`;
  const T_VERDURE = `${NOME} ordine delle verdure`;

  const corridoio = (operazione, parametri) =>
    titolare.functions.invoke("operazioni-atomiche", { body: { operazione, parametri } });

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
    if (error) throw new Error(`la dettatura non entra: ${error.message}`);
    miei.dettature.push(data.dettatura_id);
    const { data: az, error: e2 } = await titolare
      .from("azioni_dettate")
      .select("id, appunto_id, tipo, stato, dati, motivo, progressivo")
      .eq("dettatura_id", data.dettatura_id)
      .order("progressivo");
    if (e2) throw e2;
    for (const r of az ?? []) {
      miei.azioni.push(r.id);
      if (!miei.appunti.includes(r.appunto_id)) miei.appunti.push(r.appunto_id);
    }
    return az ?? [];
  }

  async function impegno(id) {
    const { data, error } = await titolare.from("tasks").select("id, title, due_date, due_time, status").eq("id", id).single();
    if (error) throw error;
    return data;
  }

  async function conTitolo(titolo) {
    const { data, error } = await titolare.from("tasks").select("id, due_date, due_time").eq("title", titolo);
    if (error) throw error;
    for (const t of data ?? []) if (!miei.tasks.includes(t.id)) miei.tasks.push(t.id);
    return data ?? [];
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    // In Agenda ci sono già: una riunione (omonima dell'appuntamento nuovo)
    // e l'ordine delle verdure (quello da spostare davvero).
    const { data: a, error: e1 } = await titolare
      .from("tasks")
      .insert({ title: T_RIUNIONE, due_date: giorno(40), priority: "media", status: "da_fare", category: "altro" })
      .select("id")
      .single();
    if (e1) throw e1;
    vecchioRiunione = a.id;
    miei.tasks.push(a.id);
    const { data: b, error: e2 } = await titolare
      .from("tasks")
      .insert({ title: T_VERDURE, due_date: giorno(41), priority: "media", status: "da_fare", category: "altro" })
      .select("id")
      .single();
    if (e2) throw e2;
    verdure = b.id;
    miei.tasks.push(b.id);
  });

  afterAll(async () => {
    await conTitolo(T_RIUNIONE);
    if (miei.tasks.length) await titolare.from("tasks").delete().in("id", miei.tasks);
    if (miei.azioni.length) await titolare.from("azioni_dettate").delete().in("id", miei.azioni);
    if (miei.appunti.length) await titolare.from("appunti_vocali").delete().in("id", miei.appunti);
    if (miei.dettature.length) await titolare.from("dettature").delete().in("id", miei.dettature);
    await titolare.auth.signOut({ scope: "local" });
  });

  it("separata con certezza: approvare l'appuntamento NUOVO crea un impegno nuovo e non sposta l'omonimo", async () => {
    // Quello che la funzione online consegna per «ricordami la riunione col
    // commercialista … alle 15 e 30, e sposta a venerdì l'ordine delle
    // verdure», coi pezzi di frase separati.
    const righe = await detta("ricordami la riunione alle 15 e 30, e sposta le verdure", [
      {
        tipo: "promemoria",
        sicuro: true,
        frase: `Promemoria: ${T_RIUNIONE}`,
        dati: { titolo: T_RIUNIONE, data: giorno(47), ora: "15:30", avviso_chiesto: false },
      },
      {
        tipo: "agenda_da_spostare",
        sicuro: true,
        destinazione: "Da spostare in Agenda",
        frase: `Sposta: ${T_VERDURE}`,
        dati: { titolo: T_VERDURE, data_nuova: giorno(48), gesto: "sposta" },
      },
    ]);
    expect(righe.map((r) => r.tipo)).toEqual(["promemoria", "agenda_da_spostare"]);
    expect(new Set(righe.map((r) => r.appunto_id)).size).toBe(2);

    const prima = await impegno(vecchioRiunione);
    const r = await corridoio("approva_appunto", { p_id: righe[0].appunto_id });
    expect(r.error, `l'approvazione è fallita — ${spiega(r)}`).toBeNull();

    // 🔴 Il vecchio non si è mosso…
    const dopo = await impegno(vecchioRiunione);
    expect(dopo.due_date).toBe(prima.due_date);
    // …ed è nato un impegno NUOVO, col suo giorno e la sua ora.
    const riunioni = await conTitolo(T_RIUNIONE);
    expect(riunioni).toHaveLength(2);
    const nuovo = riunioni.find((t) => t.id !== vecchioRiunione);
    expect(nuovo.due_date).toBe(giorno(47));
    expect(String(nuovo.due_time)).toMatch(/^15:30/);

    // Lo spostamento sposta SOLO il suo impegno.
    const r2 = await corridoio("approva_appunto", { p_id: righe[1].appunto_id });
    expect(r2.error, `lo spostamento è fallito — ${spiega(r2)}`).toBeNull();
    expect((await impegno(verdure)).due_date).toBe(giorno(48));
    expect((await impegno(vecchioRiunione)).due_date).toBe(prima.due_date);
  });

  it("🔴 DA CHIARIRE: non si approva, e l'impegno omonimo che c'è già NON si muove", async () => {
    const [riga] = await detta("una frase che non si separa", [
      {
        tipo: "agenda_da_chiarire",
        sicuro: true,
        destinazione: "Da chiarire in Agenda",
        frase: `Promemoria: ${T_RIUNIONE}`,
        motivo: MOTIVO,
        dati: { titolo: T_RIUNIONE, data: giorno(49), ora: "10:00" },
      },
    ]);

    // Come lo vede la schermata: non approvabile, col suo perché e la sua uscita.
    const { data: aperti } = await titolare.rpc("appunti_da_approvare");
    const suo = (aperti ?? []).find((a) => a.id === riga.appunto_id);
    expect(suo, "l'appunto da chiarire non compare fra quelli da guardare").toBeTruthy();
    expect(suo.eseguibile).toBe(false);
    expect(suo.titolo).toBe("Da chiarire in Agenda");
    expect(suo.elementi[0].motivo).toMatch(/non sono riuscito a capire con certezza/);
    expect(suo.elementi[0].percorso).toBe("/agenda");

    const prima = await impegno(vecchioRiunione);
    const quanti = (await conTitolo(T_RIUNIONE)).length;
    const r = await corridoio("approva_appunto", { p_id: riga.appunto_id });
    // ⚠️ Il rifiuto può arrivare come errore del corridoio o nel corpo: conta
    //    che niente sia stato scritto e che l'appunto aspetti ancora.
    expect(r.error, "un appunto da chiarire è stato approvato").not.toBeNull();
    expect((await impegno(vecchioRiunione)).due_date).toBe(prima.due_date);
    expect(await conTitolo(T_RIUNIONE)).toHaveLength(quanti);
    const { data: ap } = await titolare.from("appunti_vocali").select("stato").eq("id", riga.appunto_id).single();
    expect(ap.stato).toBe("aperto");
  });
});
