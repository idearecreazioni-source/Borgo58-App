import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";

// «ARRIVATI N DI M» — blocco 1 del mandato «la lista non scrive mai
// un'uscita».
//
// ⚠️ PERCHE' QUESTA PROVA GIRA SUI DATI VERI E NON PUO' ESSERE PURA: quello
// che tiene ferma è il giro **attraverso il database** — la merce che entra
// da `register_stock_delivery` spegne la voce della lista. Una prova pura
// non saprebbe se le due cose si parlano: si inventerebbe i dati della
// forma che il codice si aspetta, che è esattamente il modo in cui il 18/08
// si era persa una colonna che si chiamava con un altro nome.
//
// ⚠️ IL PERIMETRO E' FATTO DI ROBA CHE LA PROVA HA CREATO (lezione del
// 16/08): un ingrediente vero ha altri lotti, e uno scarico FEFO non
// prenderebbe quello di prova — si finisce per lasciare storta una giacenza
// che nessuno ha toccato.
// ⚠️ UN INGREDIENTE PER PROVA, e non è pignoleria: la regola dice che
// l'arrivo va alla riga **più vecchia ancora aperta** di quell'ingrediente.
// Condividendone uno solo, la riga lasciata aperta dalla prima prova si
// prenderebbe gli arrivi di tutte le successive — e i rossi che ne escono
// raccontano il residuo, non il difetto (lezione del 18/08).
const NOME = "TEST-AUTO arrivi in lista";

describe("la merce che entra spegne la voce della lista", () => {
  let titolare;
  let ente;
  let ingrediente; // quello della prova in corso

  async function pulisci() {
    const { data } = await titolare.from("ingredients").select("id").eq("name", NOME);
    for (const i of data ?? []) {
      await titolare.from("shopping_list_items").delete().eq("ingredient_id", i.id);
      await titolare.from("stock_lots").delete().eq("ingredient_id", i.id);
      await titolare.from("price_history").delete().eq("ingredient_id", i.id);
      await titolare.from("ingredients").delete().eq("id", i.id);
    }
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

  async function riga(id) {
    const r = await titolare.from("shopping_list_items").select("*").eq("id", id).single();
    expect(r.error).toBeNull();
    return r.data;
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    ente = await primaEntita(titolare);
    await pulisci();
  });

  async function nuovoIngrediente() {
    const r = await titolare
      .from("ingredients")
      .insert({ entity_id: ente, name: NOME, unit: "kg", category: "altro" })
      .select("id")
      .single();
    expect(r.error).toBeNull();
    ingrediente = r.data.id;
    return ingrediente;
  }

  afterAll(async () => {
    await pulisci();
  });

  it("arrivo parziale: la riga resta aperta, conta, e il fabbisogno NON si riscrive", async () => {
    await nuovoIngrediente();
    const id = await nuovaRiga(20);
    const r = await titolare.rpc("register_stock_delivery", {
      p_ingredient_id: ingrediente,
      p_quantity: 5,
      p_note: "TEST-AUTO",
    });
    expect(r.error).toBeNull();

    const dopo = await riga(id);
    expect(Number(dopo.quantita_arrivata)).toBe(5);
    expect(dopo.status).not.toBe("acquistato");
    // ⚠️ «20 in lista, 5 in fattura» non diventa una riga da 15: la riga
    // dice «arrivati 5 di 20», e quanto ne serva lo decide Alessio.
    expect(Number(dopo.quantity_needed)).toBe(20);

    // e la schermata lo legge dalla stessa funzione che usa la lista
    const lista = await titolare.rpc("lista_spesa");
    const inLista = lista.data.find((x) => x.id === id);
    expect(Number(inLista.quantita_arrivata)).toBe(5);
    expect(inLista.arrivo_parziale).toBe(true);
  });

  it("il secondo arrivo si somma, completa, e chiude la riga SENZA scrivere un costo", async () => {
    await nuovoIngrediente();
    const id = await nuovaRiga(10);
    await titolare.rpc("register_stock_delivery", {
      p_ingredient_id: ingrediente,
      p_quantity: 4,
      p_note: "TEST-AUTO",
    });
    await titolare.rpc("register_stock_delivery", {
      p_ingredient_id: ingrediente,
      p_quantity: 6,
      p_note: "TEST-AUTO",
    });

    const dopo = await riga(id);
    expect(Number(dopo.quantita_arrivata)).toBe(10);
    expect(dopo.status).toBe("acquistato");
    // ⚠️ IL PRINCIPIO DEL MANDATO, provato dove si romperebbe: la lista non
    // scrive mai un'uscita. Il costo di questa merce sta nel documento che
    // l'ha portata.
    expect(dopo.purchased_amount).toBeNull();
    expect(dopo.payment_method).toBeNull();
  });

  it("una riga già chiusa non ruba gli arrivi alla successiva", async () => {
    await nuovoIngrediente();
    const chiusa = await nuovaRiga(2);
    await titolare.rpc("register_stock_delivery", {
      p_ingredient_id: ingrediente,
      p_quantity: 2,
      p_note: "TEST-AUTO",
    });
    expect((await riga(chiusa)).status).toBe("acquistato");

    const aperta = await nuovaRiga(5);
    await titolare.rpc("register_stock_delivery", {
      p_ingredient_id: ingrediente,
      p_quantity: 1,
      p_note: "TEST-AUTO",
    });
    expect(Number((await riga(chiusa)).quantita_arrivata)).toBe(2);
    expect(Number((await riga(aperta)).quantita_arrivata)).toBe(1);
  });

  it("«mi bastano»: si può chiudere ciò che è arrivato in parte", async () => {
    await nuovoIngrediente();
    const id = await nuovaRiga(20);
    await titolare.rpc("register_stock_delivery", {
      p_ingredient_id: ingrediente,
      p_quantity: 3,
      p_note: "TEST-AUTO",
    });
    const r = await titolare.rpc("chiudi_riga_arrivata", { p_item_id: id });
    expect(r.error).toBeNull();
    const dopo = await riga(id);
    expect(dopo.status).toBe("acquistato");
    expect(dopo.purchased_amount).toBeNull();
  });

  it("ma una riga senza nessun arrivo viene RESPINTA, e il messaggio dice cosa fare", async () => {
    // ⚠️ Il caso che ha qualcosa da fare, non quello vuoto (regola del
    // 17/08): qui il rifiuto è il comportamento, non l'assenza di effetto.
    await nuovoIngrediente();
    const id = await nuovaRiga(4);
    const r = await titolare.rpc("chiudi_riga_arrivata", { p_item_id: id });
    expect(r.error).not.toBeNull();
    expect(r.error.message).toMatch(/non è ancora arrivato niente/i);
    expect((await riga(id)).status).not.toBe("acquistato");
  });
});
