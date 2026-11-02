import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, righeDaTogliere, righeMie, sagomeDiProva } from "./aiuto";

// LE COMANDE DAL PONTE, SUI DATI VERI — 29/10/2026.
//
// La migrazione 20261029000001 si prova da sé, dentro una transazione che
// annulla tutto. Questa prova guarda il tratto che quella non vede: lo
// STAFF, dal suo accesso, manda una comanda come la manda il tablet
// (`sendDraftItems`: un update di `sent_at`), e la coda la riceve; la
// pagina Cucina, dall'accesso dello staff, legge lo stato e rimanda un
// foglio.
//
// 🔴 LA STAMPANTE DELLA CUCINA È ACCESA SOLO PER UN ISTANTE. Le prove
//    contro Prova girano insieme: con una stampante attiva, gli invii delle
//    altre prove finirebbero in coda, e il giro del ponte di
//    `ponte-dal-vivo` prenderebbe i nostri lavori. Spenta, la stampante non
//    riceve lavori nuovi e il ponte non li prende (`ponte_prendi_lavori`
//    guarda solo gli apparecchi attivi).
const NOME = marchio("TEST-AUTO comande dal ponte");

describe("le comande dal ponte, su Prova", () => {
  let staff;
  let titolare;
  let mie;
  let prova = { ids: [], pulisci: async () => {} };
  let ordine;
  let disp;

  async function pulisciConti() {
    for (const id of await righeDaTogliere(titolare, "orders", "table_label", "__PROVA__")) {
      await titolare.from("chiamate_turno").delete().eq("order_id", id);
      await titolare.from("order_items").delete().eq("order_id", id);
      await titolare.from("orders").delete().eq("id", id);
    }
  }

  const accendi = async (attivo) => {
    const { error } = await titolare.from("dispositivi").update({ attivo }).eq("id", disp);
    expect(error).toBeNull();
  };

  async function riga(nome, turno) {
    const { data, error } = await staff
      .from("order_items")
      .insert({ order_id: ordine, free_text_name: nome, destination: "cucina", quantity: 1, unit_price: 1, turno })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data.id;
  }

  // Lo stesso update di `sendDraftItems`, dall'accesso dello staff.
  async function manda(ids) {
    const { error } = await staff
      .from("order_items")
      .update({ sent_at: new Date().toISOString() })
      .eq("order_id", ordine)
      .in("id", ids)
      .is("sent_at", null);
    expect(error).toBeNull();
  }

  const lavoriDelConto = async () =>
    (await titolare.from("lavori_stampa").select("id, tipo, stato, righe, contenuto").eq("order_id", ordine).order("creato_il")).data;

  beforeAll(async () => {
    const cred = credenziali();
    staff = await clientAutenticato(cred.staff);
    titolare = await clientAutenticato(cred.titolare);
    mie = righeMie(titolare);
    await pulisciConti();
    prova = await sagomeDiProva(titolare, 1);
    const { data, error } = await staff.rpc("apri_conto", { p_tavoli: prova.ids, p_device_id: null, p_note: null });
    expect(error).toBeNull();
    ordine = data.order_id;

    const d = await titolare
      .from("dispositivi")
      .insert({ nome: NOME, tipo: "stampante_comande", protocollo: "simulatore", indirizzo: "127.0.0.1", porta: 19277, reparto: "cucina", attivo: false })
      .select("id")
      .single();
    if (d.error) throw d.error;
    disp = mie.segna("dispositivi", d.data.id);
  });

  afterAll(async () => {
    // Prima la stampante (i suoi lavori se ne vanno con lei), poi il conto.
    await mie?.pulisci();
    await pulisciConti();
    await prova.pulisci();
    await staff?.auth.signOut({ scope: "local" });
    await titolare?.auth.signOut({ scope: "local" });
  });

  it("senza stampante attiva l'invio va come oggi, e non accoda niente", async () => {
    const a = await riga("Prova antipasto", 1);
    await manda([a]);
    expect(await lavoriDelConto()).toEqual([]);
    await titolare.from("order_items").update({ prepared_at: new Date().toISOString() }).eq("id", a);
  });

  it("l'invio dello staff accoda UN foglio, coi turni e le righe giuste", async () => {
    const a = await riga("Prova primo", 2);
    const b = await riga("Prova secondo", 3);
    await accendi(true);
    try {
      await manda([a, b]);
    } finally {
      await accendi(false);
    }
    const lavori = await lavoriDelConto();
    expect(lavori).toHaveLength(1);
    expect(lavori[0].tipo).toBe("comanda");
    expect([...lavori[0].righe].sort()).toEqual([a, b].sort());
    expect(lavori[0].contenuto.turni.map((t) => t.turno)).toEqual([2, 3]);
    expect(lavori[0].contenuto.turni[0].righe[0].nome).toBe("Prova primo");
  });

  it("la pagina Cucina, dall'accesso dello staff, vede il foglio e nessun indirizzo", async () => {
    await accendi(true);
    let r;
    try {
      r = await staff.rpc("stato_stampa_cucina");
    } finally {
      await accendi(false);
    }
    expect(r.error).toBeNull();
    expect(r.data.stampante.nome).toBe(NOME);
    const [lavoro] = await lavoriDelConto();
    expect(r.data.lavori.map((l) => l.id)).toContain(lavoro.id);
    expect(JSON.stringify(r.data)).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it("«Stampa da qui»: le righe segnate stampate tolgono il foglio dalla coda", async () => {
    const [lavoro] = await lavoriDelConto();
    const { error } = await staff
      .from("order_items")
      .update({ prepared_at: new Date().toISOString() })
      .in("id", lavoro.righe);
    expect(error).toBeNull();
    const [dopo] = await lavoriDelConto();
    expect(dopo.stato).toBe("annullato");
  });

  it("«Ristampa sulla stampante»: lo staff rimette il foglio in coda", async () => {
    const [lavoro] = await lavoriDelConto();
    await accendi(true);
    let r;
    try {
      r = await staff.rpc("manda_alla_stampante", { p_righe: lavoro.righe, p_chiamata: null, p_aggiunta: false });
    } finally {
      await accendi(false);
    }
    expect(r.error).toBeNull();
    const lavori = await lavoriDelConto();
    expect(lavori.filter((l) => l.stato === "in_coda").map((l) => l.id)).toEqual([r.data]);
  });

  it("e senza stampante attiva il tasto lo dice, invece di far finta", async () => {
    const [lavoro] = await lavoriDelConto();
    const r = await staff.rpc("manda_alla_stampante", { p_righe: lavoro.righe, p_chiamata: null, p_aggiunta: false });
    expect(r.error?.message).toMatch(/Non c'è una stampante attiva/);
  });
});
