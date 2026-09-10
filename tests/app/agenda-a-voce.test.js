import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio } from "./aiuto";
import {
  TIPO_FATTO,
  TIPO_PROMEMORIA,
  TIPO_QUALE,
  TIPO_SPOSTA,
  destinazioneAgenda,
} from "../../supabase/functions/ascolta-voce/agenda.ts";

// L'AGENDA DETTATA A VOCE — contro il database vero.
//
// 🔴 IL DIFETTO CHE QUESTE PROVE TENGONO CHIUSO: «segna come fatto il
//    rinnovo della firma digitale» non è una cosa nuova da ricordare, ed è
//    la cosa più vicina che il modello conosce. Senza la regola nasceva un
//    impegno NUOVO con quel titolo, **approvabile**, accanto a quello vero
//    che restava aperto: due righe per lo stesso fatto e nessun errore da
//    nessuna parte.
//
// 🔴 E LA COSA CHE SI MISURA QUI È CHE NON SI POSSA APPROVARE, guardando
//    l'Agenda invece di fidarsi dello stato scritto sulla riga: «in attesa»
//    e «non ha prodotto niente» sono due affermazioni diverse.
//
// ⚠️ LE AZIONI SI COSTRUISCONO CON LA REGOLA VERA (`destinazioneAgenda`),
//    non a mano: se un giorno il modulo smettesse di dirottare le due frasi,
//    queste prove diventerebbero rosse invece di continuare a provare una
//    forma che il gestionale non produce più.
//
// ⚠️ IL CONFINE, MISURATO E DICHIARATO: la catena vocale non sa risolvere
//    un impegno che esiste — `voce_catalogo` non contiene gli impegni — e
//    non c'è nessun ramo che li chiuda o li sposti. Aggiungerli vuole una
//    migrazione, e questo lavoro non ne fa nessuna. Quindi la seconda e la
//    terza frase si fermano a un appunto che dichiara il gesto mancante.

const NOME = marchio("TEST-AUTO agenda");

describe("l'Agenda dettata a voce", () => {
  let titolare;
  const miei = { dettature: [], appunti: [], azioni: [], tasks: [] };

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

  /** L'azione come esce dalla regola vera, a partire dalla frase detta. */
  const daVoce = (azione, dettato) => ({
    ...destinazioneAgenda({ sicuro: true, frase: `${NOME} riga`, ...azione }, dettato),
  });

  const approva = (id) =>
    titolare.functions.invoke("operazioni-atomiche", {
      body: { operazione: "approva_appunto", parametri: { p_id: id } },
    });

  /** Quanti impegni ci sono adesso in Agenda. */
  async function quantiImpegni() {
    const { count } = await titolare.from("tasks").select("*", { count: "exact", head: true });
    return count;
  }

  /** Gli impegni nati da questa prova, segnati per la pulizia. */
  async function mieiImpegni() {
    const { data } = await titolare.from("tasks").select("id, title, due_date, status").like(
      "title",
      `%${NOME}%`,
    );
    for (const t of data ?? []) if (!miei.tasks.includes(t.id)) miei.tasks.push(t.id);
    return data ?? [];
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
  });

  afterAll(async () => {
    // ⚠️ Solo ciò che questa prova ha creato, per identificativo (23/08).
    if (miei.tasks.length) await titolare.from("tasks").delete().in("id", miei.tasks);
    if (miei.azioni.length) await titolare.from("azioni_dettate").delete().in("id", miei.azioni);
    if (miei.appunti.length) await titolare.from("appunti_vocali").delete().in("id", miei.appunti);
    if (miei.dettature.length) await titolare.from("dettature").delete().in("id", miei.dettature);
  });

  // -------------------------------------------------------------------
  it("🔴 il catalogo non sa chiudere né spostare un impegno, e per questo non si approva", async () => {
    // 🔴 È LA MISURA SU CUI POGGIA TUTTO IL LAVORO, e non è un'opinione:
    //    `siPuoApprovare()` guarda `eseguibile`, che il database ricava dal
    //    catalogo. Un tipo che lì non c'è nasce non approvabile **per
    //    costruzione** — nessun controllo da ricordare.
    const { data: catalogo, error } = await titolare
      .from("tipi_azione_vocale")
      .select("tipo, attivo, eseguibile");
    expect(error).toBeNull();

    const tipi = (catalogo ?? []).map((r) => r.tipo);
    const promemoria = (catalogo ?? []).find((r) => r.tipo === TIPO_PROMEMORIA);
    expect(promemoria, "il promemoria è sparito dal catalogo").toBeTruthy();
    expect(promemoria.attivo).toBe(true);
    expect(promemoria.eseguibile).toBe(true);

    // ⚠️ Se un giorno uno dei tre entrasse nel catalogo col suo ramo,
    //    questa prova diventerebbe rossa — ed è il momento in cui va
    //    riscritta, perché da lì in avanti l'appunto si approverebbe.
    for (const t of [TIPO_FATTO, TIPO_SPOSTA, TIPO_QUALE]) {
      expect(tipi, `${t} è entrato nel catalogo: ora si approva`).not.toContain(t);
    }

    // E la rete che sorveglia i tipi accesi senza esecuzione resta vuota:
    // questi non sono accesi, quindi non promettono niente.
    const { data: scoperti } = await titolare.rpc("tipi_vocali_senza_ramo");
    expect(scoperti).toEqual([]);
  });

  // -------------------------------------------------------------------
  it("🔴 «segna come fatto…» NON fa nascere un impegno nuovo", async () => {
    const prima = await quantiImpegni();
    const titolo = `${NOME} rinnovo della firma ${crypto.randomUUID().slice(0, 8)}`;

    const azione = daVoce(
      { tipo: TIPO_FATTO, dati: { impegno: titolo } },
      `segna come fatto il ${titolo}`,
    );
    expect(azione.tipo, "la regola non ha dirottato la frase").toBe(TIPO_FATTO);

    const righe = await detta("segna fatto", [azione]);
    expect(righe[0].tipo).toBe(TIPO_FATTO);
    expect(righe[0].stato).toBe("in_attesa");

    // 🔴 Si va a GUARDARE in Agenda: senza la regola, qui ci sarebbe un
    //    impegno in più intitolato «segna come fatto il rinnovo…».
    expect(await quantiImpegni()).toBe(prima);
    expect(await mieiImpegni()).toHaveLength(0);
  });

  it("🔴 ...e l'appunto non si approva: il database RIFIUTA", async () => {
    const prima = await quantiImpegni();
    const titolo = `${NOME} firma da chiudere ${crypto.randomUUID().slice(0, 8)}`;
    const righe = await detta("segna fatto due", [
      daVoce({ tipo: TIPO_FATTO, dati: { impegno: titolo } }, `segna come fatto il ${titolo}`),
    ]);

    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("titolo, eseguibile")
      .eq("id", righe[0].appunto_id)
      .single();
    expect(appunto.eseguibile, "un gesto che non esiste è approvabile").toBe(false);
    expect(appunto.titolo).toBe("Da segnare fatto in Agenda");

    // 🔴 E provandolo lo stesso: senza questo, «non approvabile» sarebbe
    //    una scritta sulla schermata invece di una regola.
    const r = await approva(righe[0].appunto_id);
    expect(r.error).not.toBeNull();
    const corpo = await r.error.context.json();
    expect(corpo?.errore?.messaggio ?? "").toMatch(/non si pu/i);

    expect(await quantiImpegni()).toBe(prima);
  });

  // -------------------------------------------------------------------
  it("🔴 «sposta a venerdì…» non tocca nessuna scadenza, e dice il giorno nuovo", async () => {
    const prima = await quantiImpegni();
    const titolo = `${NOME} ordine verdure ${crypto.randomUUID().slice(0, 8)}`;

    const righe = await detta("sposta", [
      daVoce(
        { tipo: TIPO_SPOSTA, dati: { impegno: titolo, data_nuova: "2026-09-11" } },
        `sposta a venerdì l'${titolo}`,
      ),
    ]);

    expect(righe[0].tipo).toBe(TIPO_SPOSTA);
    // ⚠️ Il giorno nuovo è dentro l'appunto, perché è quello che si legge
    //    prima di firmare — e il giorno PRECEDENTE non c'è, perché il
    //    gestionale non sa quale impegno sia: dichiararlo sarebbe inventarlo.
    expect(righe[0].dati.data_nuova).toBe("2026-09-11");
    expect(righe[0].dati.titolo).toBe(titolo);

    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("titolo, eseguibile")
      .eq("id", righe[0].appunto_id)
      .single();
    expect(appunto.eseguibile).toBe(false);
    expect(appunto.titolo).toBe("Da spostare in Agenda");

    expect(await quantiImpegni()).toBe(prima);
    expect(await mieiImpegni()).toHaveLength(0);
  });

  it("🔴 e senza il giorno non se ne inventa uno: chiede quale e a quando", async () => {
    const prima = await quantiImpegni();
    const righe = await detta("sposta senza giorno", [
      daVoce({ tipo: TIPO_SPOSTA, dati: { impegno: `${NOME} verdure` } }, "sposta le verdure"),
    ]);

    expect(righe[0].tipo).toBe(TIPO_QUALE);
    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("titolo, eseguibile")
      .eq("id", righe[0].appunto_id)
      .single();
    expect(appunto.titolo).toBe("Quale impegno?");
    expect(appunto.eseguibile).toBe(false);
    expect(await quantiImpegni()).toBe(prima);
  });

  // -------------------------------------------------------------------
  it("🔴 LA METÀ CHE DISCRIMINA: «ricordami di…» crea l'impegno, come sempre", async () => {
    // 🔴 Una regola che dirottasse tutto passerebbe tutte le prove qui
    //    sopra e romperebbe il gesto più frequente dell'Agenda. È il caso
    //    che rende queste prove una misura invece di una conferma.
    const prima = await quantiImpegni();
    const titolo = `${NOME} chiamare Tiziana ${crypto.randomUUID().slice(0, 8)}`;

    const azione = daVoce(
      { tipo: TIPO_PROMEMORIA, dati: { titolo, data: "2026-09-09" } },
      `ricordami di ${titolo} domani`,
    );
    expect(azione.tipo).toBe(TIPO_PROMEMORIA);
    expect(azione.motivo, "un promemoria ha preso il motivo di un gesto mancante").toBeUndefined();

    const righe = await detta("promemoria", [azione]);
    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("titolo, eseguibile")
      .eq("id", righe[0].appunto_id)
      .single();
    expect(appunto.eseguibile, "il promemoria ha smesso di essere approvabile").toBe(true);
    expect(appunto.titolo).toBe("Annota in Agenda");

    // Prima di approvare, in Agenda non è cambiato niente (SPEC-0013).
    expect(await quantiImpegni()).toBe(prima);

    const { error } = await approva(righe[0].appunto_id);
    expect(error).toBeNull();

    const nati = await mieiImpegni();
    const nato = nati.find((t) => t.title === titolo);
    expect(nato, "approvare un promemoria non ha creato l'impegno").toBeTruthy();
    expect(nato.due_date).toBe("2026-09-09");
    expect(await quantiImpegni()).toBe(prima + 1);
  });

  // -------------------------------------------------------------------
  it("l'uscita a mano dei due gesti mancanti porta in Agenda", async () => {
    // 🔴 UN RIFIUTO SENZA VIA D'USCITA È UN VICOLO CIECO (16/08). Qui il
    //    rifiuto è per costruzione, quindi la via d'uscita non è un di più.
    // ⚠️ Il collegamento viaggia DENTRO l'appunto e non in una mappa scritta
    //    nel browser: `azione_percorso` — che è la strada normale — per un
    //    tipo fuori catalogo risponde niente, e aggiungercelo vorrebbe dire
    //    una migrazione.
    const righe = await detta("uscita a mano", [
      daVoce(
        { tipo: TIPO_FATTO, dati: { impegno: `${NOME} firma` } },
        `segna come fatto la ${NOME} firma`,
      ),
    ]);
    expect(righe[0].dati.dove?.a).toBe("/agenda");

    const { data: percorso } = await titolare.rpc("azione_percorso", { p_tipo: TIPO_FATTO });
    expect(percorso, "il tipo è entrato in azione_percorso: la migrazione c'è stata").toBeNull();

    // ⚠️ E quello del promemoria NON è cambiato: è la strada che funziona.
    const { data: nuovo } = await titolare.rpc("azione_percorso", { p_tipo: TIPO_PROMEMORIA });
    expect(nuovo).toBe("/agenda/nuovo");
  });
});
