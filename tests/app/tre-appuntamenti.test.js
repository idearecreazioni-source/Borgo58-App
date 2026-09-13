import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, spiega } from "./aiuto";

// =====================================================================
// TRE APPUNTAMENTI NELLA STESSA DETTATURA — contro il database vero
// =====================================================================
// 11/09/2026, mandato «MEMO affidabile».
//
// 🔴 SI ATTRAVERSA LA STESSA PORTA DEL TELEFONO: si detta come detta la
//    funzione online (`registra_dettatura`, con TRE azioni in una volta),
//    si approva come approva il pulsante (il corridoio), si corregge come
//    fa «Fallo a mano» (`azione_a_mano` → il modulo salva → `chiudi_azione_a_mano`),
//    si butta come butta il pulsante. E dopo ogni gesto si va a GUARDARE
//    che cosa è cambiato — e soprattutto che cosa NON è cambiato.
//
// ⚠️ NESSUNA CHIAMATA AL MODELLO. Qui si scrivono a mano le tre azioni che
//    il modello dovrebbe restituire; se il modello le restituisce davvero
//    si è misurato a parte, contro il progetto di prova, ed è nel riepilogo.
//
// ⚠️ NESSUN TELEGRAM PARTE: l'unico avviso chiesto è fra più di un mese, e
//    quell'appunto non viene approvato (si chiude a mano).

const NOME = marchio("TEST-AUTO tre appuntamenti");

describe("🔴 tre appuntamenti detti insieme, contro il database vero", () => {
  let titolare;
  const miei = { dettature: [], appunti: [], azioni: [], tasks: [] };
  let righe = [];
  let giorni = [];
  const titoli = [
    `${NOME} dentista`,
    `${NOME} riunione col commercialista`,
    `${NOME} ritirare le tovaglie`,
  ];
  const iso = (d) => d.toISOString().slice(0, 10);

  const corridoio = (operazione, parametri) =>
    titolare.functions.invoke("operazioni-atomiche", { body: { operazione, parametri } });

  /** Lo stato delle tre azioni (in ordine) e dei loro appunti. */
  async function stato() {
    const { data: az, error } = await titolare
      .from("azioni_dettate")
      .select("id, appunto_id, stato, dati, progressivo")
      .in(
        "id",
        righe.map((r) => r.id),
      )
      .order("progressivo");
    if (error) throw error;
    const { data: ap, error: e2 } = await titolare
      .from("appunti_vocali")
      .select("id, stato")
      .in(
        "id",
        righe.map((r) => r.appunto_id),
      );
    if (e2) throw e2;
    return { az, ap: Object.fromEntries((ap ?? []).map((a) => [a.id, a.stato])) };
  }

  async function impegniMiei() {
    const { data, error } = await titolare
      .from("tasks")
      .select("id, title, due_date, due_time")
      .like("title", `${NOME}%`);
    if (error) throw error;
    for (const t of data ?? []) if (!miei.tasks.includes(t.id)) miei.tasks.push(t.id);
    return data ?? [];
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    // ⚠️ Date RELATIVE a oggi e lontane: una data scritta a mano diventa
    //    passata, e un avviso passato viene rifiutato per il calendario.
    const base = Date.now() + 40 * 86400000;
    giorni = [0, 1, 2].map((i) => iso(new Date(base + i * 86400000)));

    const azioni = [
      {
        tipo: "promemoria",
        sicuro: true,
        frase: `${NOME} — dentista`,
        dati: {
          titolo: titoli[0],
          data: giorni[0],
          // ⚠️ «10» e non «10:00»: come la scrive a volte il modello. Il
          //    database la normalizza, e si controlla che lo faccia.
          ora: "10:00",
          avviso_data: iso(new Date(base - 86400000)),
          avviso_ora: "18:00",
          avviso_chiesto: true,
        },
      },
      {
        tipo: "promemoria",
        sicuro: true,
        frase: `${NOME} — riunione`,
        dati: { titolo: titoli[1], data: giorni[1], ora: "15:30", avviso_chiesto: false },
      },
      {
        tipo: "promemoria",
        sicuro: true,
        frase: `${NOME} — tovaglie`,
        dati: { titolo: titoli[2], data: giorni[2], avviso_chiesto: false },
      },
    ];
    const { data, error } = await titolare.rpc("registra_dettatura", {
      p_testo:
        `${NOME} — Ricordami il dentista e avvisami il giorno prima alle 18, ` +
        "poi la riunione col commercialista e ritirare le tovaglie",
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
      .select("id, appunto_id, tipo, stato, dati, progressivo")
      .eq("dettatura_id", data.dettatura_id)
      .order("progressivo");
    if (e2) throw e2;
    righe = az ?? [];
    for (const r of righe) {
      miei.azioni.push(r.id);
      if (!miei.appunti.includes(r.appunto_id)) miei.appunti.push(r.appunto_id);
    }
  });

  afterAll(async () => {
    await impegniMiei();
    if (miei.tasks.length) await titolare.from("tasks").delete().in("id", miei.tasks);
    if (miei.azioni.length) await titolare.from("azioni_dettate").delete().in("id", miei.azioni);
    if (miei.appunti.length) await titolare.from("appunti_vocali").delete().in("id", miei.appunti);
    if (miei.dettature.length) await titolare.from("dettature").delete().in("id", miei.dettature);
    await titolare.auth.signOut({ scope: "local" });
  });

  // -------------------------------------------------------------------
  it("una dettatura, TRE azioni e TRE appunti distinti, ognuno coi SUOI dati", async () => {
    expect(righe).toHaveLength(3);
    expect(righe.map((r) => r.tipo)).toEqual(["promemoria", "promemoria", "promemoria"]);
    // 🔴 Nessuna fusione: un promemoria non si raggruppa con un altro.
    expect(new Set(righe.map((r) => r.appunto_id)).size).toBe(3);
    expect(righe.map((r) => r.dati.titolo)).toEqual(titoli);
    expect(righe.map((r) => r.dati.data)).toEqual(giorni);
    // ⚠️ L'avviso è di UNO solo, e resta suo.
    expect(String(righe[0].dati.avviso_ora)).toMatch(/^18:00/);
    expect(righe[1].dati.avviso_ora ?? null).toBeNull();
    expect(righe[2].dati.avviso_ora ?? null).toBeNull();
    // 🔴 E ognuno la SUA ora (11/09/2026): due diverse e una che non c'è.
    expect(righe.map((r) => r.dati.ora ?? null)).toEqual(["10:00", "15:30", null]);

    // Come li vede la schermata (MEMO e Dashboard leggono da qui).
    const { data: aperti, error } = await titolare.rpc("appunti_da_approvare");
    expect(error).toBeNull();
    const nostri = (aperti ?? []).filter((a) => miei.appunti.includes(a.id));
    expect(nostri).toHaveLength(3);
    for (const a of nostri) {
      expect(a.eseguibile, `«${a.titolo}» non è approvabile`).toBe(true);
      expect(a.elementi).toHaveLength(1);
    }
  });

  it("🔴 e prima di approvare in Agenda non c'è niente", async () => {
    expect(await impegniMiei()).toHaveLength(0);
  });

  it("🔴 approvarne UNO scrive SOLO quello, e gli altri due restano identici", async () => {
    const prima = await stato();
    const r = await corridoio("approva_appunto", { p_id: righe[1].appunto_id });
    expect(r.error, `l'approvazione è fallita — ${spiega(r)}`).toBeNull();

    const nati = await impegniMiei();
    expect(nati.map((t) => t.title)).toEqual([titoli[1]]);
    expect(nati[0].due_date).toBe(giorni[1]);
    // 🔴 L'ora finisce nel VERO campo Ora dell'Agenda, non nella descrizione.
    expect(String(nati[0].due_time)).toMatch(/^15:30/);

    const dopo = await stato();
    expect(dopo.ap[righe[1].appunto_id]).toBe("approvato");
    for (const i of [0, 2]) {
      expect(dopo.ap[righe[i].appunto_id], `l'appunto ${i + 1} è cambiato`).toBe("aperto");
      expect(dopo.az[i].stato).toBe("in_attesa");
      expect(dopo.az[i].dati).toEqual(prima.az[i].dati);
    }
  });

  it("correggerne uno A MANO chiude SOLO quello, e non scrive un doppione", async () => {
    // Quello che fa «Fallo a mano →»: il modulo si apre coi campi capiti…
    const { data: aMano, error } = await titolare.rpc("azione_a_mano", { p_id: righe[0].id });
    expect(error).toBeNull();
    expect(aMano.percorso).toBe("/agenda/nuovo");
    expect(aMano.campi?.titolo).toBe(titoli[0]);
    // ⚠️ Dall'11/09 l'ora arriva anche al modulo: non va riscritta a mano.
    expect(aMano.campi?.ora).toBe("10:00");

    // …si corregge (qui si sposta l'ora di mezz'ora) e si salva…
    const { data: t, error: e2 } = await titolare
      .from("tasks")
      .insert({
        title: titoli[0],
        due_date: giorni[0],
        due_time: "10:30",
        priority: "media",
        status: "da_fare",
        category: "altro",
      })
      .select("id")
      .single();
    expect(e2).toBeNull();
    miei.tasks.push(t.id);

    // …e la riga smette di aspettare.
    const prima = await stato();
    const r = await corridoio("chiudi_azione_a_mano", { p_id: righe[0].id });
    expect(r.error, `la chiusura a mano è fallita — ${spiega(r)}`).toBeNull();

    const dopo = await stato();
    expect(dopo.az[0].stato).not.toBe("in_attesa");
    expect(dopo.ap[righe[0].appunto_id]).not.toBe("aperto");
    // 🔴 Il terzo non si è mosso.
    expect(dopo.ap[righe[2].appunto_id]).toBe("aperto");
    expect(dopo.az[2].stato).toBe("in_attesa");
    expect(dopo.az[2].dati).toEqual(prima.az[2].dati);
    // ⚠️ E chiudere a mano non ha scritto un secondo impegno.
    const nati = await impegniMiei();
    expect(nati.filter((x) => x.title === titoli[0])).toHaveLength(1);
  });

  it("buttarne uno butta SOLO quello: in Agenda restano i due voluti", async () => {
    const r = await corridoio("scarta_appunto", { p_id: righe[2].appunto_id });
    expect(r.error, `lo scarto è fallito — ${spiega(r)}`).toBeNull();

    const dopo = await stato();
    expect(dopo.ap[righe[2].appunto_id]).toBe("scartato");
    const nati = await impegniMiei();
    expect(nati.map((t) => t.title).sort()).toEqual([titoli[0], titoli[1]].sort());
  });
});
