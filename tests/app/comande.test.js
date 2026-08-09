import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { orderTotals } from "../../src/lib/api/orders";
import { clientAutenticato, credenziali } from "./aiuto";

// Il giro comanda completo, come lo fa un tablet — ma automatico.
//
// Le prove usano un tavolo dedicato "TEST-AUTO" creato all'inizio ed
// eliminato alla fine, così non compare mai nella griglia della Sala fra
// un giro di prove e l'altro. Le comande di prova vengono cancellate del
// tutto (orders/order_items non sono fra le tabelle sorvegliate da
// deleted_records: la pulizia non lascia lapidi).
const TAVOLO = "TEST-AUTO";

describe("comande: il giro del tablet, automatico", () => {
  let staff;
  let titolare;
  let ordine;

  async function pulisciTavolo() {
    const { data: vecchi } = await titolare.from("orders").select("id").eq("table_label", TAVOLO);
    for (const o of vecchi ?? []) {
      await titolare.from("order_items").delete().eq("order_id", o.id);
      await titolare.from("orders").delete().eq("id", o.id);
    }
  }

  beforeAll(async () => {
    const cred = credenziali();
    staff = await clientAutenticato(cred.staff);
    titolare = await clientAutenticato(cred.titolare);

    // Tavolo di prova: lo crea il titolare (la RLS lo impone), riusandolo
    // se un giro precedente è morto a metà.
    const esistente = await titolare.from("dining_tables").select("id").eq("label", TAVOLO).maybeSingle();
    if (!esistente.data) {
      const creato = await titolare.from("dining_tables").insert({ label: TAVOLO, position: 999 }).select().single();
      expect(creato.error).toBeNull();
    }
    await pulisciTavolo();
  });

  afterAll(async () => {
    await pulisciTavolo();
    await titolare.from("dining_tables").delete().eq("label", TAVOLO);
  });

  it("lo staff apre il tavolo; il database rifiuta un secondo conto sullo stesso tavolo", async () => {
    const primo = await staff.from("orders").insert({ table_label: TAVOLO }).select().single();
    expect(primo.error).toBeNull();
    ordine = primo.data;

    const doppione = await staff.from("orders").insert({ table_label: TAVOLO }).select().single();
    expect(doppione.error).not.toBeNull();
    expect(doppione.error.code).toBe("23505"); // il vincolo, non un controllo di schermata
  });

  it("lo staff aggiunge due piatti in bozza e ne invia UNO solo: l'altro resta in bozza", async () => {
    const a = await staff
      .from("order_items")
      .insert({ order_id: ordine.id, free_text_name: "Prova A", destination: "bar", quantity: 1, unit_price: 1.0 })
      .select()
      .single();
    const b = await staff
      .from("order_items")
      .insert({ order_id: ordine.id, free_text_name: "Prova B", destination: "bar", quantity: 2, unit_price: 2.0 })
      .select()
      .single();
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();

    // Invio SELETTIVO: solo la riga A (è la regola dei due tablet — non si
    // spedisce la comanda che il collega sta ancora scrivendo).
    const invio = await staff
      .from("order_items")
      .update({ sent_at: new Date().toISOString() })
      .eq("order_id", ordine.id)
      .in("id", [a.data.id])
      .is("sent_at", null);
    expect(invio.error).toBeNull();

    const righe = await staff.from("order_items").select("id, free_text_name, sent_at").eq("order_id", ordine.id);
    const inviate = righe.data.filter((r) => r.sent_at);
    expect(inviate).toHaveLength(1);
    expect(inviate[0].free_text_name).toBe("Prova A");
  });

  it("i coperti si aggiornano a tavolo aperto e il conto torna col calcolo unico", async () => {
    const agg = await staff.from("orders").update({ coperti: 3 }).eq("id", ordine.id).select().single();
    expect(agg.error).toBeNull();

    const prezzo = await staff.from("service_settings").select("coperto_price").eq("id", 1).single();
    const righe = await staff.from("order_items").select("quantity, unit_price, voided_at").eq("order_id", ordine.id);

    const conto = orderTotals({ ...agg.data, items: righe.data }, Number(prezzo.data.coperto_price));
    // Prova A: 1×1,00 + Prova B: 2×2,00 = 5,00; coperti 3 × prezzo corrente.
    expect(conto.itemsTotal).toBe(5);
    expect(conto.total).toBe(5 + 3 * Number(prezzo.data.coperto_price));
  });

  it("il tavolo si chiude (annullato con motivo) e il giro si ripulisce", async () => {
    const chiusura = await staff
      .from("orders")
      .update({ status: "annullato", cancel_reason: "prova automatica", closed_at: new Date().toISOString() })
      .eq("id", ordine.id)
      .select()
      .single();
    expect(chiusura.error).toBeNull();
    expect(chiusura.data.status).toBe("annullato");
  });
});
