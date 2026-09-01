import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, primaEntita } from "./aiuto";
import { fiscalizzaConto } from "../../src/lib/fiscalizzazione";
import { segnalaScontrinoNonUscito } from "../../src/lib/api/orders";
import { GUASTI, creaRegistratoreSimulato } from "../../src/lib/registratoreSimulato";
import { supabase } from "../../src/lib/supabase";

// LO SCONTRINO CHE ESCE DA SOLO — 22/08/2026, blocco 2 del mandato.
//
// 🔴 LA REGOLA DI ALESSIO: *«lo scontrino viene considerato emesso fino a
// prova contraria, non viceversa. Il sistema deve essere automatico e la
// rettifica è solo una via d'uscita per le rare volte che servirà.»*
//
// ⚠️ Quindi la prova che conta è quella in cui la stampa **fallisce** o
// **mente**: se girasse solo sul giorno buono non misurerebbe niente.
// ⚠️ IL MARCHIO E' DI QUESTO GIRO, dal 01/09/2026: le pulizie e i
//    conteggi qui sotto usano questo valore in un modello `like`, e con
//    un valore fisso due esecuzioni insieme sullo stesso progetto di
//    prova si cancellano e si contano le righe a vicenda. Vedi la nota
//    in cima a `aiuto.js`.
const MARCA = marchio("TEST-AUTO auto");
const SERATA = "1995-11-08";

describe("la fiscalizzazione automatica alla chiusura del conto", () => {
  let titolare;
  let staff;
  let ente;

  async function pulisci() {
    const { data: conti } = await titolare.from("orders").select("id").like("table_label", `${MARCA}%`);
    for (const c of conti ?? []) {
      await titolare.from("segnalazioni_fiscali").delete().eq("order_id", c.id);
      await titolare.from("orders").delete().eq("id", c.id);
    }
  }

  async function contoChiuso(etichetta) {
    const { data, error } = await titolare
      .from("orders")
      .insert({
        entity_id: ente,
        table_label: `${MARCA} ${etichetta}`,
        status: "chiuso",
        closed_at: `${SERATA}T21:30:00+01:00`,
        coperti: 2,
        coperto_unit_price: 5,
      })
      .select()
      .single();
    expect(error).toBeNull();
    return data;
  }

  const documentoDi = async (id) =>
    (await titolare.from("orders").select("documento_fiscale,documento_numero,documento_emesso_il").eq("id", id).single())
      .data;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    await supabase.auth.signInWithPassword({
      email: credenziali().titolare.email,
      password: credenziali().titolare.password,
    });
    ente = await primaEntita(titolare);
    await pulisci();
  });

  afterAll(async () => {
    await pulisci();
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
  });

  it("il giorno buono: lo scontrino esce e il conto è fiscalizzato, senza chiedere niente", async () => {
    const conto = await contoChiuso("buono");
    const reg = creaRegistratoreSimulato();
    const esito = await fiscalizzaConto(conto, { serata: SERATA, registratore: reg });

    expect(esito.emesso).toBe(true);
    const doc = await documentoDi(conto.id);
    expect(doc.documento_fiscale).toBe("scontrino");
    expect(doc.documento_numero).toBe(esito.numero);
    // ⚠️ LA DATA È LA SERATA DEL CONTO, non «oggi»: un conto e il suo
    // documento devono stare sulla stessa giornata, o la quadratura fra
    // incassato e scontrinato accusa una differenza che non esiste.
    expect(doc.documento_emesso_il).toBe(SERATA);
  });

  it.each([[GUASTI.MUTO], [GUASTI.A_META], [GUASTI.ERRORE], [GUASTI.NON_COLLEGATO]])(
    "🔴 col guasto «%s» il conto resta senza documento — e la chiusura NON si rompe",
    async (guasto) => {
      const conto = await contoChiuso(guasto);
      const reg = creaRegistratoreSimulato({ guasto });

      // ⚠️ Non lancia: la sala non si blocca davanti al cliente.
      const esito = await fiscalizzaConto(conto, { serata: SERATA, registratore: reg });
      expect(esito.emesso).toBe(false);

      const doc = await documentoDi(conto.id);
      expect(doc.documento_fiscale).toBeNull();

      // …e il conto è nell'elenco che si fa notare a fine giornata.
      const { data: elenco } = await titolare.rpc("conti_da_fiscalizzare", {
        p_entity_id: ente,
        p_dal: SERATA,
        p_al: SERATA,
      });
      expect(elenco.some((x) => (x.order_id ?? x.id) === conto.id)).toBe(true);
    }
  );

  it("🔴 PAGINA BIANCA: il conto risulta a posto, e la quadratura non se ne accorge", async () => {
    const conto = await contoChiuso("bianca");
    const reg = creaRegistratoreSimulato({ guasto: GUASTI.PAGINA_BIANCA });
    const esito = await fiscalizzaConto(conto, { serata: SERATA, registratore: reg });

    // ⚠️ Il gestionale lo segna emesso, ed è il comportamento GIUSTO: la
    // risposta è indistinguibile da una riuscita.
    expect(esito.emesso).toBe(true);
    expect(reg.cartaUscitaPer(conto.id)).toBe(0);

    const { data: elenco } = await titolare.rpc("conti_da_fiscalizzare", {
      p_entity_id: ente,
      p_dal: SERATA,
      p_al: SERATA,
    });
    // 🔴 SPARITO DALL'ELENCO mentre fiscalmente non esiste niente: è
    // esattamente la situazione da cui la rettifica deve tirare fuori.
    expect(elenco.some((x) => (x.order_id ?? x.id) === conto.id)).toBe(false);

    // --- e la rettifica lo rimette in QUELL'elenco, non in un altro ---
    const r = await segnalaScontrinoNonUscito(conto.id, "risposta positiva, carta bianca");
    expect(r.stato_prima).toBe("scontrino");

    const doc = await documentoDi(conto.id);
    expect(doc.documento_fiscale).toBeNull();
    expect(doc.documento_numero).toBeNull();
    expect(doc.documento_emesso_il).toBeNull();

    const { data: dopo } = await titolare.rpc("conti_da_fiscalizzare", {
      p_entity_id: ente,
      p_dal: SERATA,
      p_al: SERATA,
    });
    expect(dopo.some((x) => (x.order_id ?? x.id) === conto.id)).toBe(true);

    // ⚠️ E lascia la traccia: chi, quando, e il documento che era assegnato.
    const { data: tracce } = await titolare
      .from("segnalazioni_fiscali")
      .select("segnalato_da,segnalato_il,stato_prima,nota")
      .eq("order_id", conto.id);
    expect(tracce).toHaveLength(1);
    expect(tracce[0].stato_prima).toBe("scontrino");
    expect(tracce[0].segnalato_da).toBeTruthy();
    expect(tracce[0].segnalato_il).toBeTruthy();
  });

  it("🔴 LA RETTIFICA È DI ALESSIO: lo staff viene rifiutato, e il messaggio dice cosa fare", async () => {
    const conto = await contoChiuso("permessi");
    const reg = creaRegistratoreSimulato({ guasto: GUASTI.PAGINA_BIANCA });
    await fiscalizzaConto(conto, { serata: SERATA, registratore: reg });

    // ⚠️ Col token dello STAFF, non del titolare: è il rovesciamento n. 30,
    // e senza questa prova resterebbe un'affermazione.
    await supabase.auth.signOut({ scope: "local" });
    await supabase.auth.signInWithPassword({
      email: credenziali().staff.email,
      password: credenziali().staff.password,
    });

    await expect(segnalaScontrinoNonUscito(conto.id, "provo da staff")).rejects.toThrow(/Alessio/);

    // …e il rifiuto non ha lasciato niente dietro di sé.
    const { data: tracce } = await staff
      .from("segnalazioni_fiscali").select("id").eq("order_id", conto.id);
    expect(tracce ?? []).toHaveLength(0);

    await supabase.auth.signOut({ scope: "local" });
    await supabase.auth.signInWithPassword({
      email: credenziali().titolare.email,
      password: credenziali().titolare.password,
    });
    // Il documento è rimasto: lo staff non l'ha toccato.
    const doc = await documentoDi(conto.id);
    expect(doc.documento_fiscale).toBe("scontrino");
  });

  it("un OMAGGIO non chiede nessuno scontrino", async () => {
    // ⚠️ Non incassa niente, quindi non c'è corrispettivo da emettere. Qui
    // si prova la regola del chiamante: `CloseOrderModal` passa
    // `fiscalizza: false`, e questa prova tiene ferma la ragione.
    const conto = await contoChiuso("omaggio");
    const reg = creaRegistratoreSimulato();
    // nessuna chiamata a fiscalizzaConto: è ciò che fa il modale
    expect(reg.risposte).toHaveLength(0);
    const doc = await documentoDi(conto.id);
    expect(doc.documento_fiscale).toBeNull();
  });
});
