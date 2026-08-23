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
// 🔴 L'ingrediente da PIZZICO (23/08/2026). Esiste perché il 23/08 un
// ingrediente che valeva trentasette milligrammi fermava lo scarico di
// **tutto** il conto: la colonna del magazzino ha quattro decimali, il
// numero si scriveva 0,0000 e il vincolo lo respingeva. Un difetto che
// bloccava 148 conti su 346 senza nessun errore a schermo.
const PIZZICO = "TEST-AUTO pizzico";

describe("il magazzino scende chiudendo un conto", () => {
  let staff;
  let titolare;
  let ente;
  let ingrediente;
  let pizzico;
  let lottoVecchio;
  let lottoNuovo;
  let ricetta;
  let conto;

  // 🔴 QUESTA PULIZIA NON PUÒ TOGLIERE TUTTO, ed è un fatto misurato il
  // 20/08: `stock_consumptions` ha **una sola policy, quella di lettura**
  // (decisione del 16/08: «ricrearla `for all` per uniformità avrebbe
  // aperto una porta che non c'era»). Quindi da qui un `delete` su quella
  // tabella **non cancella niente e non dà errore** — e l'ingrediente
  // resta, perché lo trattiene con un vincolo `restrict`.
  //
  // ⚠️ Per dieci giorni ogni esecuzione ne ha lasciato uno: misurati **74**
  // ingredienti `TEST-AUTO scarico` sul progetto di prova, e la pulizia che
  // ci ciclava sopra ha cominciato a sforare i 30 secondi dell'hook —
  // facendo SALTARE tutte e sei le prove di questo file, in silenzio.
  // *La stessa famiglia del blocco A, vista dal lato delle prove.*
  //
  // ⚠️ E LA CURA NON È APRIRE LA POLICY: una prova che allarga un permesso
  // per potersi ripulire è il primo passo verso una che lo lascia aperto.
  // Ci si gira attorno — l'ingrediente si RIUSA invece di crearne uno nuovo
  // ogni volta, come questo stesso file fa già col tavolo — così il residuo
  // resta uno e non cresce.
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
    // ⚠️ NON si cicla più su tutti quelli che esistono: l'ingrediente è uno
    // e resta, e i suoi lotti si tolgono quando la prova riparte.
    const { data: ing } = await titolare
      .from("ingredients")
      .select("id")
      .in("name", [NOME, PIZZICO]);
    for (const i of ing ?? []) {
      await titolare.from("stock_lots").delete().eq("ingredient_id", i.id);
      await titolare.from("price_history").delete().eq("ingredient_id", i.id);
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

    // ⚠️ Si riusa quello di ieri se c'è: vedi il commento su `pulisci()`.
    const gia = await titolare.from("ingredients").select("id").eq("name", NOME).limit(1).maybeSingle();
    if (gia.data) {
      ingrediente = gia.data.id;
      // I lotti di ieri sì che si tolgono: quelli non hanno vincoli addosso,
      // e senza, il FEFO partirebbe da una giacenza che non è quella scritta
      // in questa prova.
      await titolare.from("stock_lots").delete().eq("ingredient_id", ingrediente);
      // ⚠️ E IL PREZZO SI RIMETTE ANCHE QUI. Metterlo solo alla creazione
      // non basta: l'ingrediente esiste gia' da giorni, quindi quel ramo
      // non viene mai percorso e il prezzo resta quello di prima — cioe'
      // zero. E' la trappola del 12/08 («seminare senza aggiornare non fa
      // nulla sulla riga che c'e' gia'»), vista da questa parte.
      await titolare.from("ingredients").update({ current_price: 8.4 }).eq("id", ingrediente);
    } else {
      const i = await titolare
        .from("ingredients")
        // 🔴 UN PREZZO VERO, e non e' un dettaglio (22/08, reperto di
        // Alessio dal collaudo). Questo ingrediente **resta nella dispensa**
        // dopo la prova — e' voluto, cancellarlo cambierebbe il suo
        // identificativo a ogni giro — ma senza prezzo restava a
        // **0,00 €/kg** in mezzo ai cento prodotti veri: un ingrediente che
        // costa zero fa un food cost sbagliato **senza dire niente**.
        //
        // ⚠️ Il costo dello scarico si prende dai LOTTI, non da qui: questo
        // valore non cambia cosa misura la prova, cambia solo che non
        // lascia un numero falso nel collaudo.
        .insert({ entity_id: ente, name: NOME, category: "verdura", unit: "kg", current_price: 8.4, waste_percentage_default: 0 })
        .select()
        .single();
      expect(i.error).toBeNull();
      ingrediente = i.data.id;
    }

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

    // 🔴 L'INGREDIENTE DA PIZZICO, con un lotto suo. Si riusa come l'altro:
    // `stock_consumptions` non si cancella da qui (una sola policy, di
    // lettura), quindi crearne uno nuovo a ogni giro lascerebbe un residuo.
    const giaP = await titolare.from("ingredients").select("id").eq("name", PIZZICO).limit(1).maybeSingle();
    if (giaP.data) {
      pizzico = giaP.data.id;
      await titolare.from("stock_lots").delete().eq("ingredient_id", pizzico);
    } else {
      const ip = await titolare
        .from("ingredients")
        .insert({ entity_id: ente, name: PIZZICO, category: "spezie_aromi", unit: "kg", current_price: 40, waste_percentage_default: 0 })
        .select()
        .single();
      expect(ip.error).toBeNull();
      pizzico = ip.data.id;
    }
    const lp = await titolare
      .from("stock_lots")
      .insert({ ingredient_id: pizzico, quantity_received: 1, quantity_remaining: 1, unit_cost: 40 });
    expect(lp.error).toBeNull();

    const r = await titolare
      .from("recipes")
      .insert({ name: NOME, category: "primo", recipe_type: "piatto_finito", portions_yield: 1 })
      .select()
      .single();
    expect(r.error).toBeNull();
    ricetta = r.data.id;
    const ri = await titolare
      .from("recipe_ingredients")
      .insert([
        { recipe_id: ricetta, ingredient_id: ingrediente, quantity: 0.75, unit: "kg" },
        // 0,00002 kg = venti milligrammi: sotto il decimo di grammo che la
        // colonna del magazzino sa tenere.
        { recipe_id: ricetta, ingredient_id: pizzico, quantity: 0.00002, unit: "kg" },
      ]);
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
    // ⚠️ E una voce libera in CUCINA: senza, la prova non distinguerebbe
    // «le bevande non si dichiarano» da «le voci libere non si dichiarano
    // più», e passerebbe verde anche se il filtro tagliasse troppo.
    const fuoriMenu = await staff
      .from("order_items")
      .insert({ order_id: conto, free_text_name: "TEST-AUTO fuori menu", destination: "cucina", quantity: 1, unit_price: 9, sent_at: new Date().toISOString() });
    expect(piatto.error).toBeNull();
    expect(caffe.error).toBeNull();
    expect(fuoriMenu.error).toBeNull();
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

  it("un pizzico che la colonna non sa scrivere non ferma lo scarico del conto", async () => {
    // 🔴 IL DIFETTO CHE QUESTA PROVA SORVEGLIA (23/08/2026): prima di oggi
    // l'ingrediente qui sopra sarebbe sceso — e invece **niente** scendeva,
    // perché il rifiuto sui venti milligrammi del pizzico si portava via lo
    // scarico dell'intero conto. Nessun errore in sala: solo un magazzino
    // fermo. Rompendo la cura, questa prova diventa rossa in tre punti.
    const a = await titolare
      .from("anomalie_scarico")
      .select("tipo")
      .eq("order_id", conto)
      .eq("tipo", "errore");
    expect(a.error).toBeNull();
    expect(a.data).toHaveLength(0);

    // Niente riga di consumo per il pizzico: non è una scrittura persa, è
    // una scrittura impossibile — il lotto non si muoveva comunque.
    const c = await titolare
      .from("stock_consumptions")
      .select("id")
      .eq("order_id", conto)
      .eq("ingredient_id", pizzico);
    expect(c.data ?? []).toHaveLength(0);

    const l = await titolare
      .from("stock_lots")
      .select("quantity_remaining")
      .eq("ingredient_id", pizzico)
      .single();
    expect(Number(l.data.quantity_remaining)).toBe(1);
  });

  // 🔴 DAL 23/08/2026 LE DUE VOCI LIBERE NON SONO LA STESSA COSA, e questa
  // prova è diventata rossa da sola quando il comportamento è cambiato —
  // che è il lavoro per cui esiste. Una riga senza ricetta destinata al
  // BAR è una bevanda: il magazzino non la segue e dichiararla riempiva
  // l'elenco di 1.840 righe tutte uguali. Una riga senza ricetta in
  // CUCINA è un piatto scritto a mano, ed è un buco vero.
  it("la bevanda non si dichiara, il piatto scritto a mano sì", async () => {
    const a = await titolare
      .from("anomalie_scarico")
      .select("tipo, descrizione")
      .eq("order_id", conto);
    expect(a.error).toBeNull();
    const libere = a.data.filter((r) => r.tipo === "voce_libera");
    // Il caffè va al bar: fuori.
    expect(libere.some((r) => r.descrizione?.includes("caffè"))).toBe(false);
    // Il piatto fuori menu va in cucina: dentro, col suo nome.
    expect(libere.filter((r) => r.descrizione?.includes("fuori menu"))).toHaveLength(1);
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
