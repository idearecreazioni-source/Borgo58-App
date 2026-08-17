import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, corridoioInstallato, credenziali, primaEntita } from "./aiuto";

// La sezione personale del titolare (Blocco 7).
//
// Il punto che questo file esiste per tenere fermo: **una spesa pagata di
// tasca propria si conta UNA VOLTA SOLA.** Nascono due fatti — una spesa e
// un debito — e il rimborso chiude il secondo senza essere una seconda
// spesa. Sbagliarlo non produce nessun errore: produce costi doppi e
// imposte stimate più basse del vero.
const MARCA = "TEST-AUTO anticipazioni";
// ⚠️ UN ANNO NEL PASSATO, e dal 17/08/2026 non e' indifferente: i saldi
// contano solo i movimenti FINO A OGGI (un assegno che uscira' fra un mese
// non e' ancora uscito). Con l'anno di prova nel FUTURO — com'era fino a
// ieri — i movimenti di questa prova sparivano dai saldi e le sue
// asserzioni diventavano rosse. L'anno serve solo a non incrociare i dati
// veri, e per quello un anno passato va bene uguale: il locale apre nel
// 2027.
const ANNO = 1993;

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);

describe("ho messo di tasca mia: il debito, la spesa, e il rimborso", () => {
  let titolare;
  let staff;
  let ente;
  let tagId;

  async function pulisci() {
    await titolare
      .from("anticipazioni_socio")
      .delete()
      .gte("pagata_il", `${ANNO}-01-01`)
      .lte("pagata_il", `${ANNO}-12-31`);
    await titolare
      .from("cash_movements")
      .delete()
      .gte("movement_date", `${ANNO}-01-01`)
      .lte("movement_date", `${ANNO}-12-31`);
    await titolare.from("tag_anticipazioni").delete().eq("etichetta", MARCA);
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    ente = await primaEntita(titolare);
    await pulisci();
    const { data } = await titolare
      .from("tag_anticipazioni")
      .insert({ etichetta: MARCA })
      .select()
      .single();
    tagId = data.id;
  });

  afterAll(async () => {
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
    await sonda.auth.signOut({ scope: "local" });
  });

  it("lo staff non vede niente della sezione personale — e c'è una riga vera", async () => {
    await titolare.from("anticipazioni_socio").insert({
      entity_id: ente,
      importo: 40,
      pagata_il: `${ANNO}-02-01`,
      tag_id: tagId,
      documento_riferimento: "RIC-93",
      nota: MARCA,
    });

    const { data: viste } = await titolare.from("anticipazioni_socio").select("id");
    expect(viste.length).toBeGreaterThan(0);

    const { data: nascoste } = await staff.from("anticipazioni_socio").select("id");
    expect(nascoste ?? []).toHaveLength(0);

    const { data: tagStaff } = await staff.from("tag_anticipazioni").select("id");
    expect(tagStaff ?? []).toHaveLength(0);

    for (const [fn, args] of [
      ["saldo_anticipazioni", { p_entity_id: ente }],
      ["anticipazioni_per_tag", { p_entity_id: ente, p_anno: ANNO }],
      ["anticipazioni_da_comunicare", { p_entity_id: ente, p_anno: ANNO, p_mese: 2 }],
    ]) {
      const { error } = await staff.rpc(fn, args);
      expect(error, `${fn} avrebbe dovuto rifiutare lo staff`).toBeTruthy();
    }
  });

  it("il motivo è obbligatorio, e il rifiuto arriva dal database", async () => {
    // Vale anche scrivendo dritto in tabella: i totali per motivo sono la
    // diagnosi, non un'etichetta decorativa.
    const { error } = await titolare.from("anticipazioni_socio").insert({
      entity_id: ente,
      importo: 10,
      pagata_il: `${ANNO}-02-02`,
      tag_id: null,
    });
    expect(error).toBeTruthy();
  });

  it("la società ti deve quello che hai anticipato", async () => {
    const { data } = await titolare.rpc("saldo_anticipazioni", { p_entity_id: ente });
    expect(Number(data[0].ti_deve)).toBe(40);
    expect(Number(data[0].note_aperte)).toBe(1);
    // ⚠️ E dichiara di restare fuori dalla previsione di cassa: una nota
    // aperta non ha una scadenza, il rimborso lo decide lui.
    expect(data[0].avvertenza).toContain("uscite previste");
  });

  it("una nota SENZA fattura è una spesa; con la fattura è solo un debito", async () => {
    const { data: prima } = await titolare.rpc("rettifiche_fiscali", {
      p_entity_id: ente,
      p_anno: ANNO,
    });
    // La nota da 40 senza fattura è l'unica spesa dell'anno.
    expect(Number(prima[0].costi_totali)).toBe(40);

    // Ora una collegata a una fattura: la fattura è il costo, la nota no.
    const { data: fatture } = await titolare
      .from("supplier_invoices")
      .select("id")
      .eq("status", "da_pagare")
      .limit(1);

    if (fatture?.length) {
      await titolare.from("anticipazioni_socio").insert({
        entity_id: ente,
        importo: 70,
        pagata_il: `${ANNO}-02-03`,
        tag_id: tagId,
        supplier_invoice_id: fatture[0].id,
        nota: MARCA,
      });
      const { data: dopo } = await titolare.rpc("rettifiche_fiscali", {
        p_entity_id: ente,
        p_anno: ANNO,
      });
      // ⚠️ Il totale NON è salito di 70: quella spesa è già contata sulla
      // fattura, e contarla due volte è il difetto che questo blocco evita.
      expect(Number(dopo[0].costi_totali)).toBe(40);
    }
  });

  it.skipIf(!CORRIDOIO)("il rimborso chiude la nota e fa uscire i soldi, insieme", async () => {
    await titolare.from("cash_movements").insert({
      entity_id: ente,
      direction: "entrata",
      amount: 300,
      movement_date: `${ANNO}-02-01`,
      mezzo: "cassa",
      tipo_documento: "non_documentato",
      note: `${MARCA} fondo`,
    });

    const { data: nota } = await titolare
      .from("anticipazioni_socio")
      .select("id")
      .eq("importo", 40)
      .is("pareggiata_il", null)
      .single();

    const { data: prima } = await titolare.rpc("saldo_tesoreria", { p_entity_id: ente });
    const cassaPrima = Number(prima[0].contante_atteso);
    // ⚠️ Si legge lo stato PRIMA invece di scrivere un numero atteso: la
    // prova precedente crea una seconda nota solo se sul database di copia
    // esiste una fattura da pagare, e su un database ricostruito da zero
    // non ce n'è nessuna. Un valore fisso qui renderebbe la prova rossa
    // per come è apparecchiato il database, non per un difetto.
    const { data: debitoPrima } = await titolare.rpc("saldo_anticipazioni", {
      p_entity_id: ente,
    });
    const devePrima = Number(debitoPrima[0].ti_deve);

    const { error } = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "pareggia_anticipazione",
        parametri: { p_anticipazione_id: nota.id, p_data: `${ANNO}-02-10` },
      },
    });
    expect(error).toBeNull();

    const { data: chiusa } = await titolare
      .from("anticipazioni_socio")
      .select("pareggiata_il, movimento_id")
      .eq("id", nota.id)
      .single();
    expect(chiusa.pareggiata_il).toBeTruthy();
    expect(chiusa.movimento_id).toBeTruthy();

    const { data: dopo } = await titolare.rpc("saldo_tesoreria", { p_entity_id: ente });
    expect(Number(dopo[0].contante_atteso)).toBe(cassaPrima - 40);

    // ⚠️ E il rimborso NON è una seconda spesa: i costi non si muovono.
    const { data: costi } = await titolare.rpc("rettifiche_fiscali", {
      p_entity_id: ente,
      p_anno: ANNO,
    });
    expect(Number(costi[0].costi_totali)).toBe(40);

    // Il debito cala esattamente di quella nota, e non di più.
    const { data: saldo } = await titolare.rpc("saldo_anticipazioni", { p_entity_id: ente });
    expect(Number(saldo[0].ti_deve)).toBe(devePrima - 40);
  });
});
