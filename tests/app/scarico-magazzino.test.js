import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";

// Il magazzino scende quando un conto si chiude (13/08/2026).
//
// Perché questa prova esiste: fino a ieri chiudere un conto non toccava
// la giacenza in nessun modo, e il difetto era invisibile — nessun
// errore, nessun avviso, solo una giacenza che non scendeva mai. Un
// difetto così non si ripresenta con un messaggio: si ripresenta in
// silenzio, quindi serve qualcosa che diventi rosso da solo.
//
// La chiamata è alla funzione del database col ruolo VERO dello staff —
// è la sala che chiude i conti, e il permesso è la metà della prova. Il
// passaggio dal corridoio (regola B4) è una riga nell'elenco delle
// operazioni ed è coperto dalla sonda del corridoio: qui interessa che
// la giacenza scenda davvero, e che scenda dai lotti giusti.
const TAVOLO = "TEST-AUTO-SCAR";
const NOME = "TEST-AUTO scarico";

describe("il magazzino scende chiudendo un conto", () => {
  let staff;
  let titolare;
  let ente;
  let ingrediente;
  let lottoVecchio;
  let lottoNuovo;
  let ricetta;
  let conto;

  async function pulisci() {
    const { data: conti } = await titolare.from("orders").select("id").eq("table_label", TAVOLO);
    for (const o of conti ?? []) {
      await titolare.from("anomalie_scarico").delete().eq("order_id", o.id);
      await titolare.from("stock_consumptions").delete().eq("order_id", o.id);
      await titolare.from("order_items").delete().eq("order_id", o.id);
      await titolare.from("orders").delete().eq("id", o.id);
    }
    const { data: ric } = await titolare.from("recipes").select("id").eq("name", NOME);
    for (const r of ric ?? []) {
      await titolare.from("recipe_ingredients").delete().eq("recipe_id", r.id);
      await titolare.from("recipe_status_history").delete().eq("recipe_id", r.id);
      await titolare.from("recipes").delete().eq("id", r.id);
    }
    const { data: ing } = await titolare.from("ingredients").select("id").eq("name", NOME);
    for (const i of ing ?? []) {
      await titolare.from("stock_consumptions").delete().eq("ingredient_id", i.id);
      await titolare.from("stock_lots").delete().eq("ingredient_id", i.id);
      await titolare.from("price_history").delete().eq("ingredient_id", i.id);
      await titolare.from("ingredients").delete().eq("id", i.id);
    }
  }

  const fraGiorni = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    const cred = credenziali();
    staff = await clientAutenticato(cred.staff);
    titolare = await clientAutenticato(cred.titolare);
    ente = await primaEntita(titolare);

    await pulisci();
    const esistente = await titolare.from("dining_tables").select("id").eq("label", TAVOLO).maybeSingle();
    if (!esistente.data) {
      await titolare.from("dining_tables").insert({ label: TAVOLO, position: 998 });
    }

    const i = await titolare
      .from("ingredients")
      .insert({ entity_id: ente, name: NOME, category: "verdura", unit: "kg", waste_percentage_default: 0 })
      .select()
      .single();
    expect(i.error).toBeNull();
    ingrediente = i.data.id;

    // Mezzo chilo che scade domani a 2,00 €/kg, cinque chili fra un mese
    // a 4,00: se lo scarico non partisse dal primo, il costo non tornerebbe.
    const v = await titolare
      .from("stock_lots")
      .insert({
        ingredient_id: ingrediente,
        quantity_received: 0.5,
        quantity_remaining: 0.5,
        unit_cost: 2.0,
        expiry_date: fraGiorni(1),
      })
      .select()
      .single();
    const n = await titolare
      .from("stock_lots")
      .insert({
        ingredient_id: ingrediente,
        quantity_received: 5,
        quantity_remaining: 5,
        unit_cost: 4.0,
        expiry_date: fraGiorni(30),
      })
      .select()
      .single();
    expect(v.error).toBeNull();
    expect(n.error).toBeNull();
    lottoVecchio = v.data.id;
    lottoNuovo = n.data.id;

    const r = await titolare
      .from("recipes")
      .insert({ name: NOME, category: "primo", recipe_type: "piatto_finito", portions_yield: 1 })
      .select()
      .single();
    expect(r.error).toBeNull();
    ricetta = r.data.id;
    const ri = await titolare
      .from("recipe_ingredients")
      .insert({ recipe_id: ricetta, ingredient_id: ingrediente, quantity: 0.75, unit: "kg" });
    expect(ri.error).toBeNull();
  });

  afterAll(async () => {
    await pulisci();
    await titolare.from("dining_tables").delete().eq("label", TAVOLO);
  });

  it("lo staff apre il conto, ordina un piatto a ricetta e una voce libera", async () => {
    const o = await staff.from("orders").insert({ table_label: TAVOLO, coperti: 1 }).select().single();
    expect(o.error).toBeNull();
    conto = o.data.id;

    const piatto = await staff
      .from("order_items")
      .insert({ order_id: conto, recipe_id: ricetta, destination: "cucina", quantity: 1, unit_price: 10, sent_at: new Date().toISOString() });
    const caffe = await staff
      .from("order_items")
      .insert({ order_id: conto, free_text_name: "TEST-AUTO caffè", destination: "bar", quantity: 1, unit_price: 1.5, sent_at: new Date().toISOString() });
    expect(piatto.error).toBeNull();
    expect(caffe.error).toBeNull();
  });

  it("chiudendo il conto la giacenza scende, e scende dal lotto che scade prima", async () => {
    const chiusura = await staff.rpc("close_order_paid", {
      p_order_id: conto,
      p_payment_method: "contante",
      p_coperto_unit_price: 5,
    });
    expect(chiusura.error).toBeNull();

    const o = await titolare.from("orders").select("status, magazzino_scaricato_il").eq("id", conto).single();
    expect(o.data.status).toBe("chiuso");
    expect(o.data.magazzino_scaricato_il).not.toBeNull();

    const vecchio = await titolare.from("stock_lots").select("quantity_remaining").eq("id", lottoVecchio).single();
    const nuovo = await titolare.from("stock_lots").select("quantity_remaining").eq("id", lottoNuovo).single();
    // FEFO: prima i 0,5 kg in scadenza, poi 0,25 dal lotto lungo.
    expect(Number(vecchio.data.quantity_remaining)).toBe(0);
    expect(Number(nuovo.data.quantity_remaining)).toBeCloseTo(4.75, 4);
  });

  it("il costo della merce uscita è quello dei lotti toccati, non un prezzo medio", async () => {
    const m = await titolare
      .from("stock_consumptions")
      .select("quantity, quantita_richiesta, costo")
      .eq("order_id", conto)
      .eq("ingredient_id", ingrediente)
      .single();
    expect(m.error).toBeNull();
    expect(Number(m.data.quantity)).toBeCloseTo(0.75, 4);
    // 0,5 × 2,00 + 0,25 × 4,00 = 2,00 €
    expect(Number(m.data.costo)).toBeCloseTo(2.0, 2);
  });

  it("la voce libera non viene indovinata: si dichiara e si conta", async () => {
    const a = await titolare
      .from("anomalie_scarico")
      .select("tipo, descrizione")
      .eq("order_id", conto);
    expect(a.error).toBeNull();
    const libere = a.data.filter((r) => r.tipo === "voce_libera");
    expect(libere).toHaveLength(1);
    expect(libere[0].descrizione).toContain("caffè");
  });

  it("lo staff non vede l'elenco di ciò che non è sceso: riceve un rifiuto, non un elenco vuoto", async () => {
    const r = await staff.rpc("scarichi_non_riusciti", { p_dal: null, p_al: null });
    expect(r.error).not.toBeNull();
    // Un elenco vuoto direbbe «è andato tutto bene», che qui sarebbe falso.
    expect(r.data ?? []).toHaveLength(0);
  });

  it("chiudere due volte lo stesso conto non scarica due volte", async () => {
    const secondo = await staff.rpc("close_order_paid", {
      p_order_id: conto,
      p_payment_method: "contante",
      p_coperto_unit_price: 5,
    });
    expect(secondo.error).not.toBeNull();

    const nuovo = await titolare.from("stock_lots").select("quantity_remaining").eq("id", lottoNuovo).single();
    expect(Number(nuovo.data.quantity_remaining)).toBeCloseTo(4.75, 4);
  });
});
