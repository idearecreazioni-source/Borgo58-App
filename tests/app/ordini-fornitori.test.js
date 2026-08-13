import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";

// Fase B: l'ordine parte nella lingua del fornitore.
//
// Le due cose che una prova tiene ferme e la lettura del codice no:
//
// 1. **La dicitura nel messaggio è la sua**, non il nome interno. Se un
//    giorno la bozza tornasse al nome del Ricettario, l'ordine
//    continuerebbe a partire — e arriverebbe la merce sbagliata.
// 2. **Le confezioni sono intere e per eccesso.** Servono 10 kg, la
//    cassa è da 6: due casse. Un `fattore` che smettesse di essere
//    applicato produrrebbe un ordine dieci volte più piccolo, e nessun
//    errore lo direbbe.
//
// La chiamata è alla funzione del database: il corridoio è una riga
// nell'elenco delle operazioni, e sul progetto di prova la funzione
// online è più vecchia di questa consegna.
const FORNITORE = "TEST-AUTO ordini fornitore";
const INGREDIENTE = "TEST-AUTO ordini pomodoro";

describe("ordini ai fornitori: la dicitura è la sua, le casse sono intere", () => {
  let titolare;
  let staff;
  let ente;
  let fornitore;
  let ingrediente;
  let rigaLista;
  let ordine;
  let bozza;

  async function pulisci() {
    const { data: forn } = await titolare.from("suppliers").select("id").eq("name", FORNITORE);
    for (const f of forn ?? []) {
      const { data: ord } = await titolare.from("ordini_fornitore").select("id").eq("supplier_id", f.id);
      for (const o of ord ?? []) {
        await titolare.from("ordini_fornitore_righe").delete().eq("ordine_id", o.id);
        await titolare.from("ordini_fornitore").delete().eq("id", o.id);
      }
    }
    const { data: ing } = await titolare.from("ingredients").select("id").eq("name", INGREDIENTE);
    for (const i of ing ?? []) {
      await titolare.from("shopping_list_items").delete().eq("ingredient_id", i.id);
      await titolare.from("price_history").delete().eq("ingredient_id", i.id);
      await titolare.from("articoli_fornitore").delete().eq("ingredient_id", i.id);
      await titolare.from("stock_lots").delete().eq("ingredient_id", i.id);
      await titolare.from("ingredients").delete().eq("id", i.id);
    }
    for (const f of forn ?? []) {
      await titolare.from("suppliers").delete().eq("id", f.id);
    }
  }

  beforeAll(async () => {
    const cred = credenziali();
    titolare = await clientAutenticato(cred.titolare);
    staff = await clientAutenticato(cred.staff);
    ente = await primaEntita(titolare);
    await pulisci();

    const f = await titolare
      .from("suppliers")
      .insert({ entity_id: ente, name: FORNITORE, category: "ortofrutta", contact_phone: "0932 123456" })
      .select()
      .single();
    expect(f.error).toBeNull();
    fornitore = f.data.id;

    const i = await titolare.rpc("create_ingredient", {
      p_entity_id: ente,
      p_name: INGREDIENTE,
      p_category: "verdura",
      p_unit: "kg",
      p_current_price: 3.9,
    });
    expect(i.error).toBeNull();
    ingrediente = i.data.id;

    // Come lo chiama LUI, e in che confezione lo vende.
    const a = await titolare
      .from("articoli_fornitore")
      .insert({
        supplier_id: fornitore,
        descrizione: "Pomodori ciliegini di Pachino IGP, cassa da 6 kg",
        chiave: "test-auto-ordini-pachino-cassa-6",
        ingredient_id: ingrediente,
        unita_fattura: "casse",
        fattore: 6,
      })
      .select()
      .single();
    expect(a.error).toBeNull();

    await titolare.from("price_history").insert({
      ingredient_id: ingrediente,
      price: 3.9,
      supplier_id: fornitore,
      source: "manuale",
      articolo_id: a.data.id,
    });

    const r = await titolare.rpc("add_shopping_list_item", {
      p_ingredient_id: ingrediente,
      p_supplier_id: fornitore,
      p_quantity_needed: 10,
      p_unit: "kg",
    });
    expect(r.error).toBeNull();
    rigaLista = r.data;
  });

  afterAll(async () => {
    await pulisci();
  });

  it("la bozza usa la dicitura del fornitore e chiede confezioni intere", async () => {
    const b = await titolare.rpc("bozza_ordine", { p_supplier_id: fornitore });
    expect(b.error).toBeNull();
    bozza = b.data;

    const riga = bozza.righe[0];
    expect(riga.descrizione).toBe("Pomodori ciliegini di Pachino IGP, cassa da 6 kg");
    expect(riga.dicitura_sua).toBe(true);
    // 10 kg / cassa da 6 = 1,67 → 2 casse. Mai 1, mai 1,67.
    expect(Number(riga.quantita)).toBe(2);
    // ...e resta scritto quanto serviva davvero, così un fattore
    // sbagliato si vede prima della consegna.
    expect(Number(riga.quantita_base)).toBe(10);
    expect(Number(riga.prezzo_atteso)).toBe(3.9);
    expect(bozza.testo).toContain("cassa da 6 kg");
    // Lo zero del prefisso urbano NON si toglie: in Italia fa parte del
    // numero anche in forma internazionale.
    expect(bozza.telefono).toBe("390932123456");
  });

  it("registrando l'ordine la riga passa a «ordinata» e non sparisce dalla lista", async () => {
    const r = await titolare.rpc("registra_ordine", {
      p_supplier_id: fornitore,
      p_testo: bozza.testo,
      p_righe: bozza.righe,
      p_canale: "whatsapp",
    });
    expect(r.error).toBeNull();
    ordine = r.data;

    const riga = await titolare
      .from("shopping_list_items")
      .select("status")
      .eq("id", rigaLista)
      .single();
    expect(riga.data.status).toBe("ordinata");

    const righe = await titolare
      .from("ordini_fornitore_righe")
      .select("descrizione, quantita")
      .eq("ordine_id", ordine);
    expect(righe.data).toHaveLength(1);
    expect(Number(righe.data[0].quantita)).toBe(2);
  });

  it("annullando l'ordine la riga torna da comprare", async () => {
    const r = await titolare.rpc("annulla_ordine", { p_ordine_id: ordine });
    expect(r.error).toBeNull();

    const riga = await titolare
      .from("shopping_list_items")
      .select("status")
      .eq("id", rigaLista)
      .single();
    expect(riga.data.status).toBe("da_comprare");
  });

  it("lo staff non prepara e non registra ordini: qui ci sono fornitori e prezzi", async () => {
    const b = await staff.rpc("bozza_ordine", { p_supplier_id: fornitore });
    expect(b.error).not.toBeNull();

    const e = await staff.rpc("ordini_fatti", { p_dal: null, p_al: null });
    expect(e.error).not.toBeNull();

    const reg = await staff.rpc("registra_ordine", {
      p_supplier_id: fornitore,
      p_testo: "x",
      p_righe: [{ descrizione: "x", quantita: 1 }],
      p_canale: "whatsapp",
    });
    expect(reg.error).not.toBeNull();
  });
});
