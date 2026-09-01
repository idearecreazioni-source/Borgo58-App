import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { orderTotals } from "../../src/lib/api/orders";
import { clientAutenticato, credenziali, righeDaTogliere, sagomeDiProva, soloMiei } from "./aiuto";

// Il giro comanda completo, come lo fa un tablet — ma automatico.
//
// Dal 14/08/2026 il conto non sta più su una STRINGA ma su un insieme di
// tavoli veri: tre sagome accostate sono una comanda sola, non tre. Le
// prove usano sagome dedicate create all'inizio ed eliminate alla fine,
// così non compaiono mai nella pianta della sala fra un giro di prove e
// l'altro. Le comande di prova vengono cancellate del tutto.
//
// 🔴 QUI C'ERA UNA FRASE DIVENTATA FALSA, e lo era due volte. Diceva:
// «orders / order_items non sono fra le tabelle sorvegliate da
// deleted_records: la pulizia non lascia lapidi». `order_items` è
// sorvegliata dall'08/08/2026 — misurato sul progetto di prova il
// 26/08: 1035 lapidi — quindi la frase era già falsa quando è stata
// scritta. E dal 26/08 lo è anche l'altra metà: `orders` è entrata nel
// perimetro per decisione di Alessio.
//
// ⚠️ Conseguenza misurata, non dedotta: un giro completo di `npm run
// test:app` lascia sul progetto di prova ~97 lapidi, di cui 36 di
// `orders`. Sul gestionale vero non cambia niente (le prove non ci
// girano), ma la regola di `LEGGIMI.md` — «mai creare-e-cancellare
// righe nelle tabelle sorvegliate» — qui è violata, e va sanata
// facendo ripulire alle prove le proprie lapidi per identificativo.
//
// Le funzioni si chiamano qui per RPC diretta e non attraverso il
// corridoio: la regola B4 vincola l'APP, e ciò che si vuole provare qui è
// il comportamento del database. Che il client passi dal corridoio lo
// verifica permessi.test.js.
describe("comande: tre tavoli accostati, un conto solo", () => {
  let staff;
  let titolare;
  let prova = { ids: [], sagome: [], pulisci: async () => {} };
  let ordine;

  // ⚠️ TOGLIE I CONTI DI QUESTO GIRO, non tutti quelli che somigliano a una
  //    prova (01/09/2026). Prima cancellava per `like("__PROVA__%")`: con
  //    due giri insieme sullo stesso progetto di prova, il `beforeAll` del
  //    secondo portava via i conti che il primo aveva appena aperto. Vedi
  //    la nota in cima a `aiuto.js`.
  async function pulisciConti() {
    for (const id of await righeDaTogliere(titolare, "orders", "table_label", "__PROVA__")) {
      await titolare.from("order_items").delete().eq("order_id", id);
      await titolare.from("orders").delete().eq("id", id);
    }
  }

  beforeAll(async () => {
    const cred = credenziali();
    staff = await clientAutenticato(cred.staff);
    titolare = await clientAutenticato(cred.titolare);

    await pulisciConti();
    // Le sagome le crea il titolare: la RLS lo impone.
    prova = await sagomeDiProva(titolare, 3);
  });

  afterAll(async () => {
    await pulisciConti();
    await prova.pulisci();
  });

  it("lo staff apre TRE tavoli insieme e nasce UN conto solo", async () => {
    const { data, error } = await staff.rpc("apri_conto", {
      p_tavoli: prova.ids,
      p_device_id: null,
      p_note: null,
    });
    expect(error).toBeNull();
    ordine = data.order_id;

    const { data: righe } = await staff
      .from("order_tables")
      .select("dining_table_id, conto_aperto")
      .eq("order_id", ordine);
    expect(righe).toHaveLength(3);
    expect(righe.every((r) => r.conto_aperto)).toBe(true);

    // L'etichetta stampata sul ticket e sul preconto è la fotografia dei
    // nomi di adesso, non l'aggancio: quello sono le righe qui sopra.
    const { data: conto } = await staff.from("orders").select("table_label").eq("id", ordine).single();
    expect(conto.table_label).toBe(prova.sagome.map((s) => s.label).join(" · "));

    // E in tutto è nato un conto solo, non tre.
    const { data: aperti } = await staff
      .from("orders")
      .select("id")
      // ⚠️ Il conteggio guarda SOLO i conti di questo giro: con il modello
      //    condiviso, un conto aperto da un'altra esecuzione faceva
      //    fallire l'asserzione senza che niente fosse rotto.
      .like("table_label", soloMiei("__PROVA__"))
      .eq("status", "aperto");
    expect(aperti).toHaveLength(1);
  });

  it("uno di quei tavoli non può finire su un secondo conto aperto", async () => {
    const { error } = await staff.rpc("apri_conto", {
      p_tavoli: [prova.ids[0]],
      p_device_id: null,
      p_note: null,
    });
    expect(error).not.toBeNull();
    expect(error.message).toMatch(/conto aperto/i);
  });

  it("lo staff aggiunge due piatti in bozza e ne invia UNO solo: l'altro resta in bozza", async () => {
    const a = await staff
      .from("order_items")
      .insert({ order_id: ordine, free_text_name: "Prova A", destination: "bar", quantity: 1, unit_price: 1.0 })
      .select()
      .single();
    const b = await staff
      .from("order_items")
      .insert({ order_id: ordine, free_text_name: "Prova B", destination: "bar", quantity: 2, unit_price: 2.0 })
      .select()
      .single();
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();

    // Invio SELETTIVO: solo la riga A (è la regola dei due tablet — non si
    // spedisce la comanda che il collega sta ancora scrivendo).
    const invio = await staff
      .from("order_items")
      .update({ sent_at: new Date().toISOString() })
      .eq("order_id", ordine)
      .in("id", [a.data.id])
      .is("sent_at", null);
    expect(invio.error).toBeNull();

    const righe = await staff.from("order_items").select("id, free_text_name, sent_at").eq("order_id", ordine);
    const inviate = righe.data.filter((r) => r.sent_at);
    expect(inviate).toHaveLength(1);
    expect(inviate[0].free_text_name).toBe("Prova A");
  });

  it("i coperti si aggiornano a tavolo aperto e il conto torna col calcolo unico", async () => {
    const agg = await staff.from("orders").update({ coperti: 3 }).eq("id", ordine).select().single();
    expect(agg.error).toBeNull();

    // ⚠️ Prova B era rimasta in bozza dalla prova precedente, e dal
    // 16/08/2026 una bozza NON entra nel conto: prima di guardare il
    // totale si manda in cucina, che è ciò che succede in sala prima di
    // chiudere un tavolo.
    const invio = await staff
      .from("order_items")
      .update({ sent_at: new Date().toISOString() })
      .eq("order_id", ordine)
      .is("sent_at", null);
    expect(invio.error).toBeNull();

    const prezzo = await staff.from("service_settings").select("coperto_price").eq("id", 1).single();
    // ⚠️ `sent_at` va chiesto: dal 16/08/2026 il conto non addebita le
    // righe mai mandate in cucina, quindi una select che lo dimentica fa
    // sembrare tutto in bozza e il totale crolla ai soli coperti. Questa
    // riga è la prova che quella dimenticanza è facile — è successo qui.
    const righe = await staff
      .from("order_items")
      .select("quantity, unit_price, voided_at, sent_at")
      .eq("order_id", ordine);

    const conto = orderTotals({ ...agg.data, items: righe.data }, Number(prezzo.data.coperto_price));
    // Prova A: 1×1,00 + Prova B: 2×2,00 = 5,00; coperti 3 × prezzo corrente.
    expect(conto.itemsTotal).toBe(5);
    expect(conto.total).toBe(5 + 3 * Number(prezzo.data.coperto_price));
  });

  it("il conto si sposta su un tavolo solo, e gli altri due si liberano", async () => {
    const { error } = await staff.rpc("sposta_conto", {
      p_order_id: ordine,
      p_tavoli: [prova.ids[2]],
    });
    expect(error).toBeNull();

    const { data: righe } = await staff
      .from("order_tables")
      .select("dining_table_id")
      .eq("order_id", ordine);
    expect(righe).toHaveLength(1);
    expect(righe[0].dining_table_id).toBe(prova.ids[2]);

    // I due lasciati liberi si riaprono davvero: la libertà non è solo
    // sulla carta.
    const { data: nuovo, error: e2 } = await staff.rpc("apri_conto", {
      p_tavoli: [prova.ids[0], prova.ids[1]],
      p_device_id: null,
      p_note: null,
    });
    expect(e2).toBeNull();
    await staff
      .from("orders")
      .update({ status: "annullato", cancel_reason: "prova automatica", closed_at: new Date().toISOString() })
      .eq("id", nuovo.order_id);
  });

  it("chiuso il conto, quel tavolo torna disponibile subito", async () => {
    const chiusura = await staff
      .from("orders")
      .update({ status: "annullato", cancel_reason: "prova automatica", closed_at: new Date().toISOString() })
      .eq("id", ordine)
      .select()
      .single();
    expect(chiusura.error).toBeNull();
    expect(chiusura.data.status).toBe("annullato");

    // Nessuno ha dovuto ricordarsi di liberare i tavoli: lo fa il database
    // guardando lo stato del conto, chiunque l'abbia cambiato.
    const { data: righe } = await staff
      .from("order_tables")
      .select("conto_aperto")
      .eq("order_id", ordine);
    expect(righe.every((r) => r.conto_aperto === false)).toBe(true);

    const { data: riaperto, error } = await staff.rpc("apri_conto", {
      p_tavoli: [prova.ids[2]],
      p_device_id: null,
      p_note: null,
    });
    expect(error).toBeNull();
    await staff
      .from("orders")
      .update({ status: "annullato", cancel_reason: "prova automatica", closed_at: new Date().toISOString() })
      .eq("id", riaperto.order_id);
  });
});
