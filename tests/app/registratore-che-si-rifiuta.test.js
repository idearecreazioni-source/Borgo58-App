import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, primaEntita } from "./aiuto";
import { segnalaScontrinoNonUscito } from "../../src/lib/api/orders";
import { scontrinoEmesso } from "../../src/lib/registratore";
import { GUASTI, creaRegistratoreSimulato } from "../../src/lib/registratoreSimulato";
import { supabase } from "../../src/lib/supabase";

// IL REGISTRATORE CHE SI RIFIUTA — blocco 2 del mandato del 20/08.
//
// 🔴 QUESTE PROVE GUARDANO IL TRATTO FRA IL SIMULATORE E IL GESTIONALE, che
// è l'unica cosa che il blocco 1 non copriva: là la segnalazione dello staff
// e la traccia sono già provate, qui si prova che **ai guasti del
// registratore corrisponda lo stato giusto sul conto**.
//
// ⚠️ La prova che conta è quella del guasto, non quella del giorno buono: se
// girasse solo sul caso in cui la stampa riesce non misurerebbe niente — è
// la trappola del caso vuoto del 17/08.
//
// ⚠️ Date nel 1995: il locale apre nel 2027, e una serata passata e lontana
// non incrocia nessun dato vero.
// ⚠️ IL MARCHIO E' DI QUESTO GIRO, dal 01/09/2026: le pulizie e i
//    conteggi qui sotto usano questo valore in un modello `like`, e con
//    un valore fisso due esecuzioni insieme sullo stesso progetto di
//    prova si cancellano e si contano le righe a vicenda. Vedi la nota
//    in cima a `aiuto.js`.
const MARCA = marchio("TEST-AUTO sim");
const SERATA = "1995-09-12";

describe("i guasti del registratore, sul gestionale vero", () => {
  let titolare;
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
        closed_at: `${SERATA}T21:30:00+02:00`,
        coperti: 2,
        coperto_unit_price: 5,
      })
      .select()
      .single();
    expect(error).toBeNull();
    return data.id;
  }

  const documentoDi = async (id) =>
    (await titolare.from("orders").select("documento_fiscale,documento_numero").eq("id", id).single()).data;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
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
  });

  it("🔴 il simulatore PRENDE IL POSTO del punto di contatto", async () => {
    // ⚠️ Che `registratore.js` sia «sostituibile» era un'affermazione: fino
    // a oggi non era mai stato sostituito da niente. Questa prova la rende
    // una misura — stessa forma, stessa firma, stessi esiti.
    const reg = creaRegistratoreSimulato();
    const r = await reg.emettiScontrino({ id: "qualunque" });
    expect(Object.keys(r).sort()).toEqual(["esito", "messaggio", "numero"]);
    // e `scontrinoEmesso`, che è la funzione VERA del gestionale, sa
    // giudicare la risposta del finto senza sapere che è finto
    expect(scontrinoEmesso(r)).toBe(true);
  });

  it.each([[GUASTI.MUTO], [GUASTI.A_META], [GUASTI.ERRORE], [GUASTI.NON_COLLEGATO]])(
    "col guasto «%s» il conto resta chiuso e SENZA documento",
    async (guasto) => {
      const conto = await contoChiuso(guasto);
      const reg = creaRegistratoreSimulato({ guasto });
      const risposta = await reg.emettiScontrino({ id: conto });

      // Il gestionale non scrive niente, perché non è uscito niente.
      expect(scontrinoEmesso(risposta)).toBe(false);
      const doc = await documentoDi(conto);
      expect(doc.documento_fiscale).toBeNull();

      // ⚠️ E il conto NON si è bloccato: la sala non si ferma mai davanti
      // al cliente. L'incasso esiste, il documento no.
      const { data: o } = await titolare.from("orders").select("status").eq("id", conto).single();
      expect(o.status).toBe("chiuso");
    }
  );

  it("🔴 PAGINA BIANCA: il gestionale lo segna emesso, e ha ragione a farlo", async () => {
    const conto = await contoChiuso("bianca");
    const reg = creaRegistratoreSimulato({ guasto: GUASTI.PAGINA_BIANCA });
    const risposta = await reg.emettiScontrino({ id: conto });

    // ⚠️ La risposta è REGOLARE: il gestionale non ha nessun modo di sapere
    // che la carta è bianca, e segnarlo emesso è il comportamento giusto.
    expect(scontrinoEmesso(risposta)).toBe(true);
    await titolare
      .from("orders")
      .update({ documento_fiscale: "scontrino", documento_numero: risposta.numero, documento_emesso_il: SERATA })
      .eq("id", conto);

    // 🔴 E il conto ora risulta a posto MENTRE fiscalmente non esiste
    // niente: nessuna rete automatica può prenderlo.
    const doc = await documentoDi(conto);
    expect(doc.documento_fiscale).toBe("scontrino");
    expect(reg.cartaUscitaPer(conto)).toBe(0);

    // L'unica difesa è un occhio in sala — e funziona.
    const r = await segnalaScontrinoNonUscito(conto, "risposta positiva, carta bianca");
    expect(r.stato_prima).toBe("scontrino");
    const dopo = await documentoDi(conto);
    expect(dopo.documento_fiscale).toBeNull();
    expect(dopo.documento_numero).toBeNull();
  });

  it("DOPPIA STAMPA: due fogli sulla carta, un conto solo", async () => {
    const conto = await contoChiuso("doppia");
    const reg = creaRegistratoreSimulato({ guasto: GUASTI.DOPPIA_STAMPA });
    const risposta = await reg.emettiScontrino({ id: conto });
    await titolare
      .from("orders")
      .update({ documento_fiscale: "scontrino", documento_numero: risposta.numero, documento_emesso_il: SERATA })
      .eq("id", conto);

    expect(reg.cartaUscitaPer(conto)).toBe(2);

    // ⚠️ L'incasso del gestionale viene dai CONTI CHIUSI, non dalla carta:
    // per questo due fogli non fanno due incassi. È la regola del 15/08 —
    // «i conti chiusi sono l'unica fonte dei ricavi» — guardata dal lato in
    // cui potrebbe rompersi.
    const { count } = await titolare
      .from("orders").select("*", { count: "exact", head: true }).eq("id", conto);
    expect(count).toBe(1);
    const doc = await documentoDi(conto);
    expect(doc.documento_numero).toBe(risposta.numero);
  });
});
