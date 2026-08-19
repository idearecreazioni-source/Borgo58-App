import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clientAutenticato, corridoioInstallato, credenziali, primaEntita } from "./aiuto";

// I TRE ESITI di una riga della lista chiusa a mano — blocco 2 del mandato
// «la lista non scrive mai un'uscita».
//
// ⚠️ SI ENTRA DAL CORRIDOIO, non chiamando la funzione del database: è la
// strada che usa il gestionale (Contratto B4), e un'operazione dimenticata
// nell'elenco del corridoio risponde 404 senza che nessuna prova SQL se ne
// accorga. Provare la funzione e non la porta vorrebbe dire non provare il
// tratto che si rompe.
//
// ⚠️ E IL CASO DA PROVARE È QUELLO CHE HA QUALCOSA DA FARE (regola del
// 17/08): ogni prova qui sotto guarda una differenza che si produce — un
// movimento che nasce, un lotto che entra, un prezzo che NON si muove.
const NOME = "TEST-AUTO tre esiti";

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);

describe("i tre esiti di una riga chiusa a mano", () => {
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
    await titolare.from("cash_movements").delete().like("business_purpose", `Spesa: ${NOME}%`);
  }

  async function nuovoIngrediente(prezzo = 4) {
    const r = await titolare
      .from("ingredients")
      .insert({ entity_id: ente, name: NOME, unit: "kg", category: "altro", current_price: prezzo })
      .select("id")
      .single();
    expect(r.error).toBeNull();
    ingrediente = r.data.id;
    return ingrediente;
  }

  async function nuovaRiga(quantita) {
    const r = await titolare
      .from("shopping_list_items")
      .insert({ ingredient_id: ingrediente, quantity_needed: quantita, unit: "kg", source: "manuale" })
      .select("id")
      .single();
    expect(r.error).toBeNull();
    return r.data.id;
  }

  async function chiudi(corpo) {
    const r = await titolare.functions.invoke("operazioni-atomiche", {
      body: { operazione: "chiudi_riga_lista", parametri: corpo },
    });
    return r;
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    ente = await primaEntita(titolare);
    await pulisci();
  });

  // ⚠️ OGNI PROVA PARTE PULITA, e non e' pignoleria: le prove contano i
  // movimenti nati da questa spesa, e il residuo della precedente le
  // farebbe fallire per il residuo invece che per un difetto (lezione del
  // 18/08: chi conta i rossi conta i difetti solo se le prove sono
  // indipendenti).
  beforeEach(async () => {
    await pulisci();
  });

  afterAll(async () => {
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
  });

  it.skipIf(!CORRIDOIO)("comprata e pagata: la merce entra E i soldi escono davvero", async () => {
    // 🔴 È IL BUCO CHE IL BLOCCO CHIUDE: 40 € in contanti al contadino, riga
    // chiusa senza scrivere niente, e la sera il cassetto accusa un ammanco
    // che non esiste.
    await nuovoIngrediente();
    const riga = await nuovaRiga(10);

    const r = await chiudi({
      p_item_id: riga,
      p_esito: "comprata",
      p_importo: 40,
      p_metodo_pagamento: "contante",
      p_quantita_ricevuta: 10,
    });
    expect(r.error).toBeNull();

    const dopo = await titolare.from("cash_movements").select("*").like("business_purpose", `Spesa: ${NOME}%`);
    expect(dopo.data).toHaveLength(1);
    expect(Number(dopo.data[0].amount)).toBe(40);
    expect(dopo.data[0].direction).toBe("uscita");
    expect(dopo.data[0].mezzo).toBe("cassa");

    const lotti = await titolare.from("stock_lots").select("*").eq("ingredient_id", ingrediente);
    expect(lotti.data).toHaveLength(1);
    expect(Number(lotti.data[0].unit_cost)).toBe(4);
  });

  it.skipIf(!CORRIDOIO)("avuta gratis: la merce entra, ma non esce un euro", async () => {
    await nuovoIngrediente();
    const riga = await nuovaRiga(5);

    const r = await chiudi({
      p_item_id: riga,
      p_esito: "gratis",
      p_quantita_ricevuta: 5,
    });
    expect(r.error).toBeNull();

    const lotti = await titolare.from("stock_lots").select("*").eq("ingredient_id", ingrediente);
    expect(lotti.data).toHaveLength(1);
    expect(Number(lotti.data[0].unit_cost)).toBe(0);

    const mov = await titolare.from("cash_movements").select("id").like("business_purpose", `Spesa: ${NOME}%`);
    expect(mov.data).toHaveLength(0);
  });

  it.skipIf(!CORRIDOIO)("...e il regalo NON abbassa il prezzo di listino", async () => {
    // ⚠️ Da `current_price` nasce il food cost su cui Alessio decide i prezzi
    // del menu: un regalo che abbassa il listino li abbassa tutti. *Il regalo
    // vale zero per quella volta, non per sempre.*
    await nuovoIngrediente(4);
    const riga = await nuovaRiga(5);
    await chiudi({ p_item_id: riga, p_esito: "gratis", p_quantita_ricevuta: 5 });

    const ing = await titolare.from("ingredients").select("current_price").eq("id", ingrediente).single();
    expect(Number(ing.data.current_price)).toBe(4);
    const storico = await titolare.from("price_history").select("id").eq("ingredient_id", ingrediente);
    expect(storico.data).toHaveLength(0);
  });

  it.skipIf(!CORRIDOIO)("non presa: la riga sparisce e NIENTE entra in magazzino", async () => {
    // ⚠️ È il terzo esito, e confonderlo col secondo mette in magazzino merce
    // mai arrivata.
    await nuovoIngrediente();
    const riga = await nuovaRiga(7);

    const r = await chiudi({ p_item_id: riga, p_esito: "non_presa" });
    expect(r.error).toBeNull();

    const righe = await titolare.from("shopping_list_items").select("id").eq("id", riga);
    expect(righe.data).toHaveLength(0);
    const lotti = await titolare.from("stock_lots").select("id").eq("ingredient_id", ingrediente);
    expect(lotti.data).toHaveLength(0);
  });

  it.skipIf(!CORRIDOIO)("l'assegno adesso è ammesso — il vocabolario è tornato uno", async () => {
    // 🔴 Il 17/08 questa schermata OFFRIVA l'assegno e il database lo
    // rifiutava. Adesso l'elenco è uno solo, e il pagamento con assegno esce
    // dalla banca, non dalla cassa.
    await nuovoIngrediente();
    const riga = await nuovaRiga(2);

    const r = await chiudi({
      p_item_id: riga,
      p_esito: "comprata",
      p_importo: 12,
      p_metodo_pagamento: "assegno",
      p_quantita_ricevuta: 2,
    });
    expect(r.error).toBeNull();

    const mov = await titolare.from("cash_movements").select("*").like("business_purpose", `Spesa: ${NOME}%`);
    expect(mov.data).toHaveLength(1);
    expect(mov.data[0].mezzo).toBe("banca");
  });

  it.skipIf(!CORRIDOIO)("comprata senza importo viene respinta, e non lascia niente dietro", async () => {
    await nuovoIngrediente();
    const riga = await nuovaRiga(3);

    const r = await chiudi({
      p_item_id: riga,
      p_esito: "comprata",
      p_metodo_pagamento: "contante",
      p_quantita_ricevuta: 3,
    });
    expect(r.error).not.toBeNull();

    const dopo = await titolare.from("shopping_list_items").select("status").eq("id", riga).single();
    expect(dopo.data.status).not.toBe("acquistato");
    const lotti = await titolare.from("stock_lots").select("id").eq("ingredient_id", ingrediente);
    expect(lotti.data).toHaveLength(0);
  });

  it("la vecchia porta non c'è più: chiuderla alla vecchia maniera fallisce", async () => {
    // ⚠️ Due modi di chiudere una riga, uno dei quali senza uscita in prima
    // nota, sarebbe il difetto del mandato ancora raggiungibile.
    const r = await titolare.rpc("close_shopping_list_item", {
      p_item_id: "00000000-0000-0000-0000-000000000000",
      p_purchased_amount: 1,
      p_payment_method: "contante",
    });
    expect(r.error).not.toBeNull();
  });
});
