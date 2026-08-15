import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";

// L'attributo di deducibilità (§9 del mandato «personale e tesoreria»).
//
// Quattro cose che solo una prova col token vero può tenere ferme, e che il
// blocco di verifica dentro la migrazione NON può garantire:
//
// 1. **«Solo del titolare» è la RLS, non un menu nascosto.** Dentro una
//    migrazione si gira come proprietari delle tabelle, e il proprietario
//    la RLS la scavalca: un controllo là dentro darebbe un verde che non
//    vuol dire niente (§5 punto 2 del protocollo). Qui si passa da
//    PostgREST col token dello staff — e c'è **una riga vera** che lui non
//    deve vedere.
// 2. **L'eredità dalla causale funziona attraverso PostgREST**, che è la
//    strada da cui ci arriva davvero il browser.
// 3. **Il terzo stato regge**: ciò che nessuno ha classificato non finisce
//    né fra i deducibili né nella rettifica. Uno zero al posto suo si
//    leggerebbe «tutto a posto», ed è la forma di errore che questo
//    progetto continua a incontrare.
// 4. **«Senza documento non si deduce» vale anche scrivendo dritto in
//    tabella**, scavalcando la schermata: se valesse solo nel form, prima o
//    poi una riga entrerebbe da un'altra porta.
const MARCA = "TEST-AUTO deducibilita";
const ANNO = 2097;

describe("deducibilità: una regola sola, il terzo stato, e la RLS vera", () => {
  let titolare;
  let staff;
  let ente;
  let causale;
  let regola75;

  async function pulisci() {
    await titolare.from("cash_movements").delete().like("note", `${MARCA}%`);
    await titolare.from("deductible_expenses").delete().like("description", `${MARCA}%`);
    await titolare.from("cash_causali").delete().like("label", `${MARCA}%`);
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    ente = await primaEntita(titolare);
    await pulisci();

    const { data: regole } = await titolare
      .from("regole_deducibilita")
      .select("id, etichetta, percentuale_deducibile")
      .eq("etichetta", "Trasferte (vitto/alloggio/trasporto)")
      .single();
    regola75 = regole;

    const { data: c, error } = await titolare
      .from("cash_causali")
      .insert({ label: `${MARCA} causale`, kind: "uscita", regola_deducibilita_id: regola75.id })
      .select()
      .single();
    if (error) throw error;
    causale = c;
  });

  afterAll(async () => {
    await pulisci();
    // Globale butterebbe fuori l'altro file di prova a metà corsa.
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
  });

  it("le regole spostate dal codice sono arrivate con le loro percentuali", () => {
    expect(Number(regola75.percentuale_deducibile)).toBe(75);
  });

  it("lo staff non vede le regole — e c'è una riga vera che non deve vedere", async () => {
    const { data: viste } = await titolare.from("regole_deducibilita").select("id");
    expect(viste.length).toBeGreaterThan(0); // altrimenti il controllo non varrebbe niente

    const { data } = await staff.from("regole_deducibilita").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  it("lo staff è respinto sui numeri, non riceve un elenco vuoto", async () => {
    // Una schermata vuota è una rassicurazione falsa: chi non deve vedere
    // riceve un rifiuto (rilievo del validatore del 13/08).
    for (const [fn, args] of [
      ["rettifiche_fiscali", { p_entity_id: ente, p_anno: ANNO }],
      ["costi_da_classificare", { p_entity_id: ente, p_anno: ANNO }],
      ["spese_deducibili_valorizzate", { p_entity_id: ente, p_anno: ANNO }],
    ]) {
      const { error } = await staff.rpc(fn, args);
      expect(error, `${fn} avrebbe dovuto rifiutare lo staff`).toBeTruthy();
    }
  });

  it("una uscita eredita la regola dalla causale, e la scelta sulla riga vince", async () => {
    const { error } = await titolare.from("cash_movements").insert({
      entity_id: ente,
      direction: "uscita",
      amount: 200,
      movement_date: `${ANNO}-06-01`,
      causale_id: causale.id,
      tipo_documento: "fattura",
      mezzo: "banca",
      note: `${MARCA} ereditata`,
    });
    expect(error).toBeNull();

    const { data: a } = await titolare.rpc("rettifiche_fiscali", {
      p_entity_id: ente,
      p_anno: ANNO,
    });
    expect(Number(a[0].quota_deducibile)).toBe(150); // 75% di 200
    expect(Number(a[0].righe_non_classificate)).toBe(0);

    const { data: piena } = await titolare
      .from("regole_deducibilita")
      .select("id")
      .eq("etichetta", "Altro (spesa aziendale documentata)")
      .single();
    await titolare
      .from("cash_movements")
      .update({ regola_deducibilita_id: piena.id })
      .eq("note", `${MARCA} ereditata`);

    const { data: b } = await titolare.rpc("rettifiche_fiscali", {
      p_entity_id: ente,
      p_anno: ANNO,
    });
    expect(Number(b[0].quota_deducibile)).toBe(200);
  });

  it("ciò che nessuno ha classificato resta fuori da entrambi i totali", async () => {
    await titolare.from("cash_movements").insert({
      entity_id: ente,
      direction: "uscita",
      amount: 500,
      movement_date: `${ANNO}-07-01`,
      tipo_documento: "fattura",
      mezzo: "banca",
      note: `${MARCA} senza regola`,
    });

    const { data } = await titolare.rpc("rettifiche_fiscali", {
      p_entity_id: ente,
      p_anno: ANNO,
    });
    const r = data[0];

    expect(Number(r.non_classificato)).toBe(500);
    expect(Number(r.righe_non_classificate)).toBe(1);
    // Il punto: NON è finito né fra i deducibili né fra gli indeducibili.
    expect(Number(r.quota_deducibile)).toBe(200);
    expect(Number(r.rettifica_in_aumento)).toBe(0);
    expect(Number(r.costi_totali)).toBe(700);
    // E l'avvertenza viaggia col numero, non col testo di una schermata.
    expect(r.avvertenza).toContain("non sono ancora classificate");

    const { data: elenco } = await titolare.rpc("costi_da_classificare", {
      p_entity_id: ente,
      p_anno: ANNO,
    });
    expect(elenco).toHaveLength(1);
    expect(Number(elenco[0].importo)).toBe(500);
  });

  it("senza documento non si deduce, anche scrivendo dritto in tabella", async () => {
    await titolare.from("cash_movements").insert({
      entity_id: ente,
      direction: "uscita",
      amount: 300,
      movement_date: `${ANNO}-08-01`,
      causale_id: causale.id, // la causale direbbe «75% deducibile»
      tipo_documento: "non_documentato",
      mezzo: "cassa",
      note: `${MARCA} senza documento`,
    });

    const { data } = await titolare.rpc("rettifiche_fiscali", {
      p_entity_id: ente,
      p_anno: ANNO,
    });
    // La regola c'è ed è al 75%, ma il documento no: la quota non sale.
    expect(Number(data[0].quota_deducibile)).toBe(200);
    expect(Number(data[0].rettifica_in_aumento)).toBe(300);
  });

  it("una spesa del modulo Deduzioni la valorizza il database, non la schermata", async () => {
    await titolare.from("deductible_expenses").insert([
      {
        entity_id: ente,
        description: `${MARCA} con documento`,
        amount: 100,
        expense_date: `${ANNO}-03-01`,
        payment_method: "carta",
        regola_deducibilita_id: regola75.id,
        document_reference: "RIC-1",
      },
      {
        entity_id: ente,
        description: `${MARCA} in contanti`,
        amount: 100,
        expense_date: `${ANNO}-03-02`,
        payment_method: "contante",
        regola_deducibilita_id: regola75.id,
        document_reference: "RIC-2",
      },
    ]);

    const { data } = await titolare.rpc("spese_deducibili_valorizzate", {
      p_entity_id: ente,
      p_anno: ANNO,
    });
    const conDoc = data.find((e) => e.description.endsWith("con documento"));
    const contanti = data.find((e) => e.description.endsWith("in contanti"));

    expect(Number(conDoc.quota)).toBe(75);
    expect(conDoc.motivo).toContain("Trasferte");
    // Il contante azzera la quota, e il motivo lo dice invece di lasciarlo
    // indovinare da un numero che non torna.
    expect(Number(contanti.quota)).toBe(0);
    expect(contanti.stato).toBe("indeducibile");
    expect(contanti.motivo).toContain("contanti");
  });

  it("le spese del modulo Deduzioni non entrano nelle rettifiche (sarebbero contate due volte)", async () => {
    const { data } = await titolare.rpc("rettifiche_fiscali", {
      p_entity_id: ente,
      p_anno: ANNO,
    });
    // In prima nota ci sono 200 + 500 + 300 = 1000. Le due spese del modulo
    // Deduzioni ne valgono altri 200: se il perimetro le prendesse, i costi
    // totali direbbero 1200. Finché non generano il loro movimento di cassa
    // (§4a del mandato, blocco tesoreria), restano fuori — sommarle
    // conterebbe due volte la stessa spesa.
    expect(Number(data[0].costi_totali)).toBe(1000);
  });
});
