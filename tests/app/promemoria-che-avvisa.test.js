import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, spiega } from "./aiuto";

// =====================================================================
// «RICORDAMELO IL GIORNO PRIMA ALLE 15» — contro il database vero
// =====================================================================
// 10/09/2026, Blocco 3 del mandato notturno.
//
// 🔴 SI ATTRAVERSA LA STESSA PORTA DEL TELEFONO, tutta: si detta come detta
//    la funzione online (`registra_dettatura`), si legge l'appunto come lo
//    legge la schermata (`azioni_della_dettatura`), si approva come approva
//    il pulsante (il corridoio), e poi si va a GUARDARE in Agenda che cosa
//    è stato scritto davvero.
//
//    ⚠️ Non è pignoleria: l'08/09 tutte le prove di questo percorso erano
//    verdi mentre il telefono rispondeva «non ho capito niente», perché
//    leggevano la riga dalla tabella invece che dalla porta della schermata.
//
// 🔴 E NESSUNA CHIAMATA AL MODELLO. Quello che il modello dovrebbe capire
//    — «sabato 13» e «il giorno prima alle 15» — qui si scrive a mano nei
//    dati dell'azione, perché ciò che questa prova sorveglia è quello che
//    il DATABASE fa di quei due campi: se li scrive, con che fuso, e se si
//    rifiuta quando sono a metà o passati.
//
// ⚠️ E NESSUN TELEGRAM PARTE. Il lavoro che manda le notifiche gira per
//    conto suo ogni cinque minuti e guarda `remind_at <= now()`: qui gli
//    avvisi sono tutti nel futuro (o rifiutati), quindi non ha niente da
//    mandare — ed è una proprietà, non una speranza: la prova la controlla.

const NOME = marchio("TEST-AUTO avviso");

describe("un promemoria dettato può portarsi dietro un avviso", () => {
  let titolare;
  const miei = { dettature: [], appunti: [], azioni: [], tasks: [] };
  let domani;
  let ieri;

  const iso = (d) => d.toISOString().slice(0, 10);

  /** Detta come detta la funzione online, e legge come legge la schermata. */
  async function detta(dettato, dati) {
    const azione = {
      tipo: "promemoria",
      sicuro: true,
      frase: `${NOME} — ${dati.titolo}`,
      dati,
    };
    const { data, error } = await titolare.rpc("registra_dettatura", {
      p_testo: `${NOME} — ${dettato}`,
      p_azioni: [azione],
      p_esito: "capita",
      p_modello: null,
      p_token_domanda: 0,
      p_token_risposta: 0,
      p_messaggio: null,
    });
    if (error) throw new Error(`la dettatura non entra: ${error.message}`);
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

    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("id, titolo, eseguibile")
      .eq("id", (grezze ?? [])[0]?.appunto_id)
      .single();

    return { riga: (righe ?? [])[0], appunto };
  }

  const approva = (id) =>
    titolare.functions.invoke("operazioni-atomiche", {
      body: { operazione: "approva_appunto", parametri: { p_id: id } },
    });

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    // ⚠️ Date RELATIVE a oggi: una prova che dice «il 13/09/2026 è nel
    //    futuro» diventa falsa il 14, e da lì fallirebbe per il calendario
    //    invece che per un difetto.
    const oggi = new Date();
    domani = new Date(oggi.getTime() + 30 * 86400000);
    ieri = new Date(oggi.getTime() - 86400000);
  });

  afterAll(async () => {
    const { data: nati } = await titolare.from("tasks").select("id").like("title", `${NOME}%`);
    for (const t of nati ?? []) if (!miei.tasks.includes(t.id)) miei.tasks.push(t.id);
    if (miei.tasks.length) await titolare.from("tasks").delete().in("id", miei.tasks);
    if (miei.azioni.length) await titolare.from("azioni_dettate").delete().in("id", miei.azioni);
    if (miei.appunti.length) await titolare.from("appunti_vocali").delete().in("id", miei.appunti);
    if (miei.dettature.length) await titolare.from("dettature").delete().in("id", miei.dettature);
    await titolare.auth.signOut({ scope: "local" });
  });

  // -------------------------------------------------------------------
  it("🔴 il tipo che chiede quando avvisare NON è nel catalogo", async () => {
    // È la proprietà su cui poggia tutto: `eseguibile` lo decide il
    // catalogo, non i dati, quindi un tipo che lì non c'è nasce non
    // approvabile **per costruzione**. Se qualcuno lo aggiungesse, chi
    // preme «Approva» riceverebbe un rifiuto per una cosa che la schermata
    // gli aveva offerto.
    const { data } = await titolare
      .from("tipi_azione_vocale")
      .select("tipo, eseguibile")
      .eq("tipo", "promemoria_quando_avvisare");
    expect(data ?? []).toHaveLength(0);
  });

  it("giorno e ora detti: l'avviso entra in Agenda, in ora italiana", async () => {
    const { riga, appunto } = await detta(
      "Segna che ho appuntamento in banca e ricordamelo il giorno prima alle 15",
      {
        titolo: `${NOME} appuntamento in banca`,
        data: iso(new Date(domani.getTime() + 86400000)),
        avviso_data: iso(domani),
        avviso_ora: "15:00",
        avviso_chiesto: true,
      }
    );
    expect(riga.tipo).toBe("promemoria");
    expect(appunto.eseguibile, "un avviso completo e futuro non si può approvare").toBe(true);
    // ⚠️ `avviso_chiesto` ha fatto il suo lavoro e non resta fra i dati: è
    //    una dichiarazione su cosa ha chiesto, non una cosa da scrivere.
    expect(riga.dati.avviso_chiesto).toBeUndefined();

    const r = await approva(appunto.id);
    expect(r.error, `l'approvazione è fallita — ${spiega(r)}`).toBeNull();

    const { data: nato } = await titolare
      .from("tasks")
      .select("id, title, due_date, remind_at, reminder_sent_at")
      .like("title", `${NOME} appuntamento in banca%`)
      .single();
    miei.tasks.push(nato.id);

    expect(nato.remind_at, "l'avviso non è stato scritto").toBeTruthy();
    // 🔴 L'ORA È ITALIANA. Senza il fuso, «alle 15» sarebbero le 15 di
    //    Greenwich — cioè le 17 di qui in estate: l'avviso arriverebbe due
    //    ore dopo, plausibile e sbagliato.
    const aRoma = new Date(nato.remind_at).toLocaleString("sv-SE", { timeZone: "Europe/Rome" });
    expect(aRoma.slice(0, 10)).toBe(iso(domani));
    expect(aRoma.slice(11, 16)).toBe("15:00");
    // Le due date restano due cose diverse.
    expect(nato.due_date).toBe(iso(new Date(domani.getTime() + 86400000)));
    // E non nasce già segnato come mandato, o non partirebbe.
    expect(nato.reminder_sent_at).toBeNull();
  });

  it("senza avviso l'impegno nasce lo stesso, e non promette niente", async () => {
    const { riga, appunto } = await detta("Ricordami di chiamare Tiziana", {
      titolo: `${NOME} chiamare Tiziana`,
      data: iso(domani),
      avviso_chiesto: false,
    });
    expect(riga.tipo).toBe("promemoria");
    expect(appunto.eseguibile).toBe(true);

    const r = await approva(appunto.id);
    expect(r.error, `l'approvazione è fallita — ${spiega(r)}`).toBeNull();

    const { data: nato } = await titolare
      .from("tasks")
      .select("id, remind_at")
      .like("title", `${NOME} chiamare Tiziana%`)
      .single();
    miei.tasks.push(nato.id);
    expect(nato.remind_at, "è nato un avviso che nessuno aveva chiesto").toBeNull();
  });

  it("🔴 mezzo avviso non si approva, e l'appunto dice cosa manca", async () => {
    const { riga, appunto } = await detta("Ricordamelo sabato", {
      titolo: `${NOME} solo il giorno`,
      avviso_data: iso(domani),
      avviso_chiesto: true,
    });
    expect(riga.tipo).toBe("promemoria_quando_avvisare");
    expect(appunto.eseguibile, "mezzo avviso resta approvabile").toBe(false);
    expect(riga.motivo ?? "").toMatch(/a che ora/i);
    // ⚠️ E non è nato niente in Agenda: l'appunto aspetta, non scrive.
    const { count } = await titolare
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .like("title", `${NOME} solo il giorno%`);
    expect(count).toBe(0);
  });

  it("🔴 «ricordamelo» senza dire quando: si chiede invece di lasciar cadere", async () => {
    // Senza `avviso_chiesto` questo caso sarebbe indistinguibile da «non
    // voleva nessun avviso», e la sua richiesta cadrebbe in silenzio.
    const { riga, appunto } = await detta("Segnami la revisione e ricordamelo", {
      titolo: `${NOME} revisione`,
      data: iso(domani),
      avviso_chiesto: true,
    });
    expect(riga.tipo).toBe("promemoria_quando_avvisare");
    expect(appunto.eseguibile).toBe(false);
  });

  it("🔴 un avviso già passato si rifiuta prima di scrivere", async () => {
    const { riga, appunto } = await detta("Ricordamelo ieri alle 15", {
      titolo: `${NOME} nel passato`,
      avviso_data: iso(ieri),
      avviso_ora: "15:00",
      avviso_chiesto: true,
    });
    expect(riga.tipo).toBe("promemoria_quando_avvisare");
    expect(appunto.eseguibile).toBe(false);
    expect(riga.motivo ?? "").toMatch(/già passato/i);
  });

  it("🔴 un avviso diventato passato NON si scrive, nemmeno approvando ore dopo", async () => {
    // È il caso vero: l'appunto è nato ieri sera quando l'avviso era
    // futuro, e si approva stamattina. Qui si costringe quel caso
    // scrivendo i dati direttamente nella riga, come se ci fossero
    // arrivati quando erano ancora buoni.
    //
    // ⚠️ QUELLO CHE QUESTA PROVA MISURA È L'ESITO, non quale rete lo
    //    produce — e le reti sono due. **Misurato rompendo**: spegnendo
    //    solo quella dentro `fai_azione_dettata`, questa prova resta verde,
    //    perché `approva_appunto` rigira `voce_risolvi_dati` al momento
    //    della firma e si ferma prima. A tenere in piedi la strada vera è
    //    quella; l'altra esiste perché chi scrive non si fidi di chi
    //    chiama, e la sola prova che la raggiunge è dentro la migrazione.
    //    Rompendole tutt'e due, questa diventa rossa.
    const { appunto } = await detta("Ricordamelo domani alle 15", {
      titolo: `${NOME} approvato tardi`,
      avviso_data: iso(domani),
      avviso_ora: "15:00",
      avviso_chiesto: true,
    });
    expect(appunto.eseguibile).toBe(true);

    const { data: azioni } = await titolare
      .from("azioni_dettate")
      .select("id, dati")
      .eq("appunto_id", appunto.id);
    for (const a of azioni ?? []) {
      await titolare
        .from("azioni_dettate")
        .update({ dati: { ...a.dati, avviso_data: iso(ieri) } })
        .eq("id", a.id);
    }

    const r = await approva(appunto.id);
    // ⚠️ Il rifiuto può arrivare come errore del corridoio o dentro la
    //    risposta: quello che conta è che l'impegno NON sia nato.
    const { count } = await titolare
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .like("title", `${NOME} approvato tardi%`);
    expect(count, `approvando più tardi, un avviso passato è stato scritto — ${spiega(r)}`).toBe(0);
  });

  it("⚠️ e nessuno di questi avvisi è già scaduto: nessun Telegram parte", async () => {
    // È la proprietà che tiene questa prova fuori dai messaggi veri: il
    // lavoro delle notifiche guarda `remind_at <= now()`, e se una di
    // queste righe fosse nel passato manderebbe un Telegram vero al
    // telefono di Alessio.
    const { data } = await titolare
      .from("tasks")
      .select("title, remind_at")
      .like("title", `${NOME}%`)
      .not("remind_at", "is", null);
    for (const t of data ?? []) {
      expect(new Date(t.remind_at).getTime(), `«${t.title}» ha un avviso già scaduto`).toBeGreaterThan(
        Date.now()
      );
    }
  });
});
