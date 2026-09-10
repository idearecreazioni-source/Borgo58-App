import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio } from "./aiuto";
import { TIPO_FATTO, TIPO_QUALE, TIPO_SPOSTA, destinazioneAgenda } from "../../supabase/functions/ascolta-voce/agenda.ts";

// =====================================================================
// SCEGLIERE COL DITO QUALE IMPEGNO — contro il database vero
// =====================================================================
// 🔴 QUELLO CHE QUESTE PROVE SORVEGLIANO NON E' CHE SI POSSA SCEGLIERE: e'
//    che il TOCCO NON SCRIVA. Fra il dito e l'Agenda ci deve essere sempre
//    un «Approva», e sbagliare qui vuol dire chiudere l'impegno di qualcun
//    altro senza che nessuno abbia firmato niente.
//
// ⚠️ SI ATTRAVERSA LA STESSA PORTA DEL TELEFONO, tutta: si detta come detta
//    la funzione online, si legge come legge la schermata
//    (`azioni_della_dettatura`), si sceglie e si approva come fa il dito
//    (il corridoio), e poi si va a GUARDARE in Agenda.
//
// ⚠️ NESSUNA DI QUESTE PROVE CHIAMA IL MODELLO: la classificazione della
//    frase la fa `destinazioneAgenda`, che e' codice nostro e deterministico.

const NOME = marchio("TEST-AUTO scelta");

describe("scegliere quale impegno, col dito", () => {
  let titolare;
  const miei = { dettature: [], appunti: [], azioni: [], tasks: [] };

  async function impegno(coda, dueDate = null, categoria = "altro") {
    const { data, error } = await titolare
      .from("tasks")
      .insert({ title: `${NOME} ${coda}`, status: "da_fare", due_date: dueDate, category: categoria })
      .select("id, title, due_date, status")
      .single();
    if (error) throw error;
    miei.tasks.push(data.id);
    return data;
  }

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
    const { data: grezze } = await titolare
      .from("azioni_dettate")
      .select("id, appunto_id")
      .eq("dettatura_id", data.dettatura_id);
    for (const r of grezze ?? []) {
      miei.azioni.push(r.id);
      if (!miei.appunti.includes(r.appunto_id)) miei.appunti.push(r.appunto_id);
    }
    return { dettaturaId: data.dettatura_id, appuntoId: (grezze ?? [])[0]?.appunto_id };
  }

  /** Quello che la schermata riceve, adesso. */
  const rileggi = async (dettaturaId) => {
    const { data, error } = await titolare.rpc("azioni_della_dettatura", { p_id: dettaturaId });
    if (error) throw error;
    return (data ?? [])[0];
  };

  const appunto = async (id) => {
    const { data } = await titolare
      .from("appunti_vocali")
      .select("id, titolo, destinazione, eseguibile")
      .eq("id", id)
      .single();
    return data;
  };

  const scegli = (azioneId, sceltaId) =>
    titolare.functions.invoke("operazioni-atomiche", {
      body: { operazione: "scegli_per_azione_dettata", parametri: { p_id: azioneId, p_scelta: sceltaId } },
    });

  const approva = (id) =>
    titolare.functions.invoke("operazioni-atomiche", {
      body: { operazione: "approva_appunto", parametri: { p_id: id } },
    });

  const leggi = async (id) => {
    const { data } = await titolare.from("tasks").select("id, title, status, due_date").eq("id", id).single();
    return data;
  };

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
  });

  afterAll(async () => {
    const { data: nati } = await titolare.from("tasks").select("id").like("title", `${NOME}%`);
    for (const t of nati ?? []) if (!miei.tasks.includes(t.id)) miei.tasks.push(t.id);
    if (miei.tasks.length) await titolare.from("tasks").delete().in("id", miei.tasks);
    if (miei.azioni.length) await titolare.from("azioni_dettate").delete().in("id", miei.azioni);
    if (miei.appunti.length) await titolare.from("appunti_vocali").delete().in("id", miei.appunti);
    if (miei.dettature.length) await titolare.from("dettature").delete().in("id", miei.dettature);
  });

  // -------------------------------------------------------------------
  it("🔴 IL CASO DEL MANDATO: due candidati, tocco uno, approvo, e l'altro resta aperto", async () => {
    const a = await impegno("commercialistax andarex", "2027-03-01");
    const b = await impegno("commercialistax passarex", "2027-03-02");

    const { dettaturaId, appuntoId } = await detta("Segna come fatto il commercialista", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} commercialistax` },
    });

    // 1. Nasce ambiguo: due pulsanti, e NIENTE da approvare.
    let riga = await rileggi(dettaturaId);
    expect(riga.tipo).toBe(TIPO_QUALE);
    expect(riga.domanda).toBe("scegli");
    expect(riga.scelte).toHaveLength(2);
    expect((await appunto(appuntoId)).eseguibile).toBe(false);

    // ⚠️ I nomi dei pulsanti portano titolo E giorno: e' quello che distingue.
    const nomi = riga.scelte.map((s) => s.nome);
    expect(nomi.some((n) => n.includes(a.title) && n.includes("01/03/2027"))).toBe(true);
    expect(nomi.some((n) => n.includes(b.title) && n.includes("02/03/2027"))).toBe(true);

    // 2. Provando ad approvare adesso, il database RIFIUTA.
    const rifiuto = await approva(appuntoId);
    expect(rifiuto.error).not.toBeNull();

    // 3. Tocco quello giusto. 🔴 E IL TOCCO NON DEVE SCRIVERE NIENTE.
    const sceltaA = riga.scelte.find((s) => s.id === a.id);
    expect(sceltaA).toBeTruthy();
    const r = await scegli(riga.id, sceltaA.id);
    expect(r.error).toBeNull();
    expect((await leggi(a.id)).status).toBe("da_fare");
    expect((await leggi(b.id)).status).toBe("da_fare");

    // 4. Adesso la riga e' tornata il gesto che era, e si puo' approvare.
    riga = await rileggi(dettaturaId);
    expect(riga.tipo).toBe(TIPO_FATTO);
    expect(riga.dati.task_id).toBe(a.id);
    // ⚠️ Il titolo fotografato e' quello di AGENDA, non le parole dette:
    //    senza, l'esecuzione respingerebbe dicendo «adesso si chiama…».
    expect(riga.dati.titolo).toBe(a.title);
    expect(riga.dati.scelto_a_mano).toBe(true);
    expect(riga.scelte).toHaveLength(0);
    expect((await appunto(appuntoId)).eseguibile).toBe(true);

    // 5. Solo adesso, e solo quello scelto.
    const ok = await approva(appuntoId);
    expect(ok.error).toBeNull();
    expect((await leggi(a.id)).status).toBe("completato");
    expect((await leggi(b.id)).status).toBe("da_fare");
  });

  // -------------------------------------------------------------------
  it("🔴 senza scegliere non si approva, e in Agenda non cambia niente", async () => {
    const a = await impegno("vestitix ritirarex", "2027-03-05");
    const b = await impegno("vestitix portarex", "2027-03-06");

    const { dettaturaId, appuntoId } = await detta("Segna come fatto ritirare i vestiti", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} vestitix` },
    });

    const riga = await rileggi(dettaturaId);
    expect(riga.scelte).toHaveLength(2);
    expect((await appunto(appuntoId)).eseguibile).toBe(false);

    const r = await approva(appuntoId);
    expect(r.error).not.toBeNull();
    expect((await leggi(a.id)).status).toBe("da_fare");
    expect((await leggi(b.id)).status).toBe("da_fare");
  });

  // -------------------------------------------------------------------
  it("🔴 non si puo' far scegliere un impegno che non era stato proposto", async () => {
    // Senza questo controllo si potrebbe chiudere QUALSIASI impegno passando
    // il suo identificativo dal browser, saltando del tutto la ricerca.
    await impegno("vetrix lucidarex", "2027-03-08");
    await impegno("vetrix pulirex", "2027-03-09");
    const estraneo = await impegno("Estraneox intoccabilex", "2027-03-10");

    const { dettaturaId } = await detta("Segna come fatto lucidare i vetri", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} vetrix` },
    });
    const riga = await rileggi(dettaturaId);
    expect(riga.scelte).toHaveLength(2);

    const r = await scegli(riga.id, estraneo.id);
    expect(r.error).not.toBeNull();
    expect((await leggi(estraneo.id)).status).toBe("da_fare");
    // E la riga non si e' mossa.
    expect((await rileggi(dettaturaId)).tipo).toBe(TIPO_QUALE);
  });

  // -------------------------------------------------------------------
  it("🔴 chiuso fra la scelta e il sì: rifiuta senza scrivere", async () => {
    const a = await impegno("filtrix cambiarex", "2027-03-12");
    const b = await impegno("filtrix pulirex", "2027-03-13");

    const { dettaturaId, appuntoId } = await detta("Segna come fatto cambiare i filtri", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} filtrix` },
    });
    let riga = await rileggi(dettaturaId);
    await scegli(riga.id, riga.scelte.find((s) => s.id === a.id).id);
    expect((await appunto(appuntoId)).eseguibile).toBe(true);

    // Fra il dito e il sì, qualcuno lo chiude a mano.
    await titolare.from("tasks").update({ status: "completato" }).eq("id", a.id);

    const r = await approva(appuntoId);
    expect(r.error).not.toBeNull();
    // 🔴 E l'altro non e' stato preso al suo posto.
    expect((await leggi(b.id)).status).toBe("da_fare");
  });

  it("🔴 rinominato fra la scelta e il sì: rifiuta senza scrivere", async () => {
    const a = await impegno("bilanciax tararex", "2027-03-15");
    await impegno("bilanciax pulirex", "2027-03-16");

    const { dettaturaId, appuntoId } = await detta("Segna come fatto tarare la bilancia", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} bilanciax` },
    });
    const riga = await rileggi(dettaturaId);
    await scegli(riga.id, riga.scelte.find((s) => s.id === a.id).id);

    await titolare.from("tasks").update({ title: `${NOME} bilanciax tararex NUOVO` }).eq("id", a.id);

    const r = await approva(appuntoId);
    expect(r.error).not.toBeNull();
    expect((await leggi(a.id)).status).toBe("da_fare");
  });

  // -------------------------------------------------------------------
  it("🔴 due gemelli: si dichiara che non si distinguono, e non si sceglie da soli", async () => {
    const a = await impegno("Gemellox in tuttox", "2027-03-20");
    const b = await impegno("Gemellox in tuttox", "2027-03-20");
    // Anche la data in cui sono stati scritti deve coincidere: e' l'ultimo
    // campo che li distinguerebbe.
    await titolare.from("tasks").update({ created_at: "2027-01-01T09:00:00+01:00" }).in("id", [a.id, b.id]);

    const { dettaturaId, appuntoId } = await detta("Segna come fatto il gemello", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} gemellox in tuttox` },
    });
    const riga = await rileggi(dettaturaId);
    expect(riga.dati.indistinguibili).toBe(true);
    // ⚠️ I pulsanti restano: lui puo' saperlo. Quello che non si fa e'
    //    scegliere al posto suo.
    expect(riga.scelte).toHaveLength(2);
    expect((await appunto(appuntoId)).eseguibile).toBe(false);
    expect((await leggi(a.id)).status).toBe("da_fare");
    expect((await leggi(b.id)).status).toBe("da_fare");
  });

  // -------------------------------------------------------------------
  it("un candidato unico resta come nella #45: nessun pulsante, e si approva", async () => {
    const t = await impegno("unicox suox", "2027-03-25");

    const { dettaturaId, appuntoId } = await detta("Segna come fatto l'unico della prova", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} unicox` },
    });
    const riga = await rileggi(dettaturaId);
    expect(riga.tipo).toBe(TIPO_FATTO);
    expect(riga.scelte).toHaveLength(0);
    expect(riga.dati.task_id).toBe(t.id);
    // ⚠️ E NIENTE segno di scelta: nessuno ha scelto, e la schermata non deve
    //    dire il contrario.
    expect(riga.dati.scelto_a_mano).toBeUndefined();
    expect((await appunto(appuntoId)).eseguibile).toBe(true);

    const ok = await approva(appuntoId);
    expect(ok.error).toBeNull();
    expect((await leggi(t.id)).status).toBe("completato");
  });

  it("nessun candidato resta come nella #45: nessun pulsante, niente da approvare", async () => {
    const { dettaturaId, appuntoId } = await detta("Segna come fatto il flauto di vetro", {
      tipo: TIPO_FATTO,
      dati: { impegno: `${NOME} xilofonox marmellatox` },
    });
    const riga = await rileggi(dettaturaId);
    expect(riga.tipo).toBe(TIPO_QUALE);
    expect(riga.scelte).toHaveLength(0);
    expect(riga.dati.impegni_possibili).toBeUndefined();
    expect((await appunto(appuntoId)).eseguibile).toBe(false);
  });

  // -------------------------------------------------------------------
  it("🔴 spostare: la data nuova arriva solo dopo il sì, e solo a quello scelto", async () => {
    const a = await impegno("vinox ordinarex", "2027-04-01");
    const b = await impegno("vinox comprarex", "2027-04-02");

    const { dettaturaId, appuntoId } = await detta("Sposta a venerdì l'ordine del vino", {
      tipo: TIPO_SPOSTA,
      dati: { impegno: `${NOME} vinox`, data_nuova: "2027-05-20" },
    });
    let riga = await rileggi(dettaturaId);
    expect(riga.tipo).toBe(TIPO_QUALE);
    expect(riga.scelte).toHaveLength(2);

    await scegli(riga.id, riga.scelte.find((s) => s.id === a.id).id);
    // 🔴 Il tocco non ha spostato niente.
    expect((await leggi(a.id)).due_date).toBe("2027-04-01");

    riga = await rileggi(dettaturaId);
    expect(riga.tipo).toBe(TIPO_SPOSTA);
    expect(riga.dati.data_precedente).toBe("2027-04-01");
    expect(riga.dati.data_nuova).toBe("2027-05-20");
    expect((await appunto(appuntoId)).eseguibile).toBe(true);

    const ok = await approva(appuntoId);
    expect(ok.error).toBeNull();
    expect((await leggi(a.id)).due_date).toBe("2027-05-20");
    // 🔴 E l'altro non si e' mosso.
    expect((await leggi(b.id)).due_date).toBe("2027-04-02");
  });
});
