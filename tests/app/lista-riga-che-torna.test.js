import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";

// IL VINCOLO NUOVO NON DEVE CHIUDERE LA PORTA A UN CASO LEGITTIMO.
//
// Il 23/08 e' nato `uniq_lista_spesa_soglia_aperta`: un prodotto ha UNA
// sola riga automatica aperta nella lista della spesa, perche' il controllo
// del sotto-soglia parte all'apertura della pagina e due chiamate
// concorrenti non si vedono a vicenda (due righe nate a 160 microsecondi
// di distanza).
//
// ⚠️ MA UN VINCOLO CHE PREVIENE UN DIFETTO PUO' IMPEDIRE UN GESTO VERO, e
// il gesto vero qui e' il piu' normale che ci sia: **si compra, e la
// settimana dopo il prodotto scende di nuovo sotto soglia**. Se il vincolo
// lo bloccasse, la lista smetterebbe di riempirsi — e non darebbe nessun
// errore: direbbe semplicemente che non c'e' niente da comprare. E' la
// famiglia del §8, la risposta piu' corta che ha l'aria di essere intera.
//
// ⚠️ SI PROVA COL CLIENT, non dentro una migrazione: una migrazione gira
// come proprietaria del database e non esercita il tratto fra schermata e
// database (regola del 16/08). Queste chiamate sono le stesse che fa
// `src/lib/api/shoppingList.js`.
const NOME = "TEST-AUTO riga che torna";

describe("una riga comprata deve poter tornare in lista", () => {
  let titolare;
  let ente;
  let ingrediente;

  async function pulisci() {
    const { data } = await titolare.from("ingredients").select("id").eq("name", NOME);
    for (const i of data ?? []) {
      await titolare.from("shopping_list_items").delete().eq("ingredient_id", i.id);
      await titolare.from("stock_lots").delete().eq("ingredient_id", i.id);
      await titolare.from("price_history").delete().eq("ingredient_id", i.id);
      await titolare.from("ingredients").delete().eq("id", i.id);
    }
  }

  /** Le righe automatiche ancora aperte per il nostro prodotto. */
  async function righeAperte() {
    const { data, error } = await titolare
      .from("shopping_list_items")
      .select("id, status, source")
      .eq("ingredient_id", ingrediente)
      .eq("source", "soglia_minima")
      .neq("status", "acquistato");
    expect(error).toBeNull();
    return data ?? [];
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    ente = await primaEntita(titolare);
    await pulisci();

    // Soglia 10 kg e nessun lotto: il prodotto nasce sotto soglia.
    const r = await titolare
      .from("ingredients")
      .insert({
        entity_id: ente,
        name: NOME,
        unit: "kg",
        category: "altro",
        current_price: 4,
        stock_minimum_threshold: 10,
      })
      .select("id")
      .single();
    expect(r.error).toBeNull();
    ingrediente = r.data.id;
  });

  afterAll(async () => {
    // I dati di prova si cancellano subito dopo la prova (§5 punto 8).
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
  });

  it("il prodotto sotto soglia entra in lista da solo", async () => {
    const { error } = await titolare.rpc("add_below_threshold_items");
    expect(error).toBeNull();
    expect(await righeAperte()).toHaveLength(1);
  });

  it("una seconda chiamata non ne aggiunge una seconda, e non da' errore", async () => {
    // ⚠️ Il caso che ha prodotto i doppioni: la pagina lancia il controllo
    // due volte. Non deve nascere niente, e soprattutto non deve comparire
    // un guasto ad Alessio che non ha toccato nulla.
    const { error } = await titolare.rpc("add_below_threshold_items");
    expect(error).toBeNull();
    expect(await righeAperte()).toHaveLength(1);
  });

  it("il doppione automatico e' RESPINTO dal database, non evitato per fortuna", async () => {
    // 🔴 LA CONTROPROVA CHIESTA DAL MANDATO, e la prima versione NON
    // DISCRIMINAVA: lanciavo tre chiamate insieme con Promise.all e
    // contavo le righe. Tolto il vincolo dal database di prova, la prova
    // restava **verde** — le tre chiamate non si erano davvero pestate i
    // piedi, e il `not exists` era bastato. Una prova che passa anche
    // senza la cosa che deve provare non prova niente (18/08).
    //
    // Qui si scrive la seconda riga a mano, esattamente come farebbero due
    // transazioni in corsa, e si pretende il rifiuto del database.
    await titolare.from("shopping_list_items").delete().eq("ingredient_id", ingrediente);

    const riga = {
      ingredient_id: ingrediente,
      quantity_needed: 10,
      unit: "kg",
      source: "soglia_minima",
    };
    const prima = await titolare.from("shopping_list_items").insert(riga);
    expect(prima.error).toBeNull();

    const seconda = await titolare.from("shopping_list_items").insert(riga);
    expect(seconda.error).not.toBeNull();
    expect(seconda.error.code).toBe("23505");
    expect(await righeAperte()).toHaveLength(1);
  });

  it("due chiamate di fila non ne aggiungono una seconda", async () => {
    // ⚠️ Questa guarda il gesto vero — la pagina che lancia il controllo
    // due volte — e passa per il `not exists`, non per il vincolo. Le due
    // prove servono tutt'e due: una copre la corsa, l'altra il caso
    // normale, e sono difese diverse.
    await titolare.from("shopping_list_items").delete().eq("ingredient_id", ingrediente);
    const esiti = await Promise.all([
      titolare.rpc("add_below_threshold_items"),
      titolare.rpc("add_below_threshold_items"),
      titolare.rpc("add_below_threshold_items"),
    ]);
    for (const e of esiti) expect(e.error).toBeNull();
    expect(await righeAperte()).toHaveLength(1);
  });

  it("comprata e ancora sotto soglia, il prodotto TORNA in lista", async () => {
    // ⚠️ E' il caso legittimo che il vincolo non deve chiudere. Si compra 3
    // kg su una soglia di 10: la merce entra, e il prodotto resta sotto.
    const [riga] = await righeAperte();
    expect(riga).toBeTruthy();

    const chiusa = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "chiudi_riga_lista",
        parametri: {
          p_item_id: riga.id,
          p_esito: "gratis",
          p_quantita_ricevuta: 3,
          p_importo: null,
          p_metodo_pagamento: null,
          p_scadenza: null,
          p_riferimento_documento: null,
          p_causale_id: null,
        },
      },
    });
    expect(chiusa.error).toBeNull();

    // La riga chiusa non e' piu' aperta...
    expect(await righeAperte()).toHaveLength(0);
    const { data: chiuse } = await titolare
      .from("shopping_list_items")
      .select("id, status")
      .eq("ingredient_id", ingrediente)
      .eq("status", "acquistato");
    expect(chiuse).toHaveLength(1);

    // ...e il prodotto puo' rientrare, perche' 3 kg non bastano a coprire
    // una soglia di 10.
    const { error } = await titolare.rpc("add_below_threshold_items");
    expect(error).toBeNull();
    expect(await righeAperte()).toHaveLength(1);
  });

  it("e a mano si puo' riaggiungere anche mentre la riga automatica e' aperta", async () => {
    // ⚠️ Il vincolo vale solo su cio' che mette il gestionale: se Alessio
    // scrive lo stesso prodotto a mano e' una sua scelta, e un vincolo che
    // gliela vieta e' una regola scritta sulle sue cose.
    expect(await righeAperte()).toHaveLength(1);

    const uno = await titolare.rpc("add_shopping_list_item", {
      p_ingredient_id: ingrediente,
      p_custom_name: null,
      p_supplier_id: null,
      p_quantity_needed: 2,
      p_unit: "kg",
      p_note: null,
    });
    expect(uno.error).toBeNull();

    const due = await titolare.rpc("add_shopping_list_item", {
      p_ingredient_id: ingrediente,
      p_custom_name: null,
      p_supplier_id: null,
      p_quantity_needed: 5,
      p_unit: "kg",
      p_note: null,
    });
    expect(due.error).toBeNull();

    const { data } = await titolare
      .from("shopping_list_items")
      .select("id")
      .eq("ingredient_id", ingrediente)
      .eq("source", "manuale");
    expect(data).toHaveLength(2);
  });

  it("finche' una riga a mano e' aperta, quella automatica non ricompare", async () => {
    // ⚠️ TROVATO PROVANDO, e non e' il vincolo nuovo: e' la regola del
    // 13/08 — `add_below_threshold_items` non aggiunge niente se il
    // prodotto e' gia' in lista **in qualunque forma**. Sta scritto qui
    // perche' i due comportamenti si somigliano e chi indaghera' un giorno
    // sulla lista che non si riempie deve sapere quali sono le due porte.
    const [automatica] = await righeAperte();
    const tolta = await titolare.rpc("remove_shopping_list_item", { p_item_id: automatica.id });
    expect(tolta.error).toBeNull();
    expect(await righeAperte()).toHaveLength(0);

    // Le due righe a mano sono ancora li': il prodotto NON rientra.
    const conMano = await titolare.rpc("add_below_threshold_items");
    expect(conMano.error).toBeNull();
    expect(await righeAperte()).toHaveLength(0);
  });

  it("tolte anche quelle, il prodotto rientra", async () => {
    await titolare
      .from("shopping_list_items")
      .delete()
      .eq("ingredient_id", ingrediente)
      .eq("source", "manuale");

    const rientro = await titolare.rpc("add_below_threshold_items");
    expect(rientro.error).toBeNull();
    expect(await righeAperte()).toHaveLength(1);
  });
});
