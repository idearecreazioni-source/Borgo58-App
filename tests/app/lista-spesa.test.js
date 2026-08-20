import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, corridoioInstallato, credenziali, denunciaSaltiCorridoio, primaEntita } from "./aiuto";

// La lista della spesa (Fase A del mandato «filiera della spesa»).
//
// Due cose che una prova può tenere ferme e la lettura del codice no:
//
// 1. **Un ingrediente senza scorta minima non deve MAI entrare in lista
//    da solo.** È la regola che protegge dal difetto peggiore di questo
//    modulo — una soglia inventata dal sistema produce una riga
//    credibile e sbagliata, e da lì un ordine vero.
// 2. **La creazione di un ingrediente passa dal corridoio**, e la
//    funzione è stata cancellata e ricreata per aggiungere la scorta
//    minima. Due funzioni sovrapposte renderebbero ambigua ogni chiamata
//    per nome (42725, a tempo di esecuzione): qui si crea davvero un
//    ingrediente attraverso il corridoio, che è il modo in cui il difetto
//    si vedrebbe.
const NOME_CON = "TEST-AUTO spesa con soglia";
const NOME_SENZA = "TEST-AUTO spesa senza soglia";

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);
// ⚠️ La sentinella sta in OGNI file che salta prove, non in uno solo: chi
// lancia solo questo file deve vedere che ci sono prove che non sono partite.
await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);

describe("lista della spesa: la soglia decide, e nessuna viene inventata", () => {
  let titolare;
  let staff;
  let ente;
  let conSoglia;
  let senzaSoglia;

  async function pulisci() {
    for (const nome of [NOME_CON, NOME_SENZA]) {
      const { data } = await titolare.from("ingredients").select("id").eq("name", nome);
      for (const i of data ?? []) {
        await titolare.from("shopping_list_items").delete().eq("ingredient_id", i.id);
        await titolare.from("stock_lots").delete().eq("ingredient_id", i.id);
        await titolare.from("price_history").delete().eq("ingredient_id", i.id);
        await titolare.from("ingredients").delete().eq("id", i.id);
      }
    }
  }

  beforeAll(async () => {
    const cred = credenziali();
    titolare = await clientAutenticato(cred.titolare);
    staff = await clientAutenticato(cred.staff);
    ente = await primaEntita(titolare);
    await pulisci();
  });

  afterAll(async () => {
    await pulisci();
  });

  it.skipIf(!CORRIDOIO)(
    "l'ingrediente nasce dal corridoio con la sua scorta minima, senza ambiguità",
    async () => {
      const r = await titolare.functions.invoke("operazioni-atomiche", {
        body: {
          operazione: "create_ingredient",
          parametri: {
            p_entity_id: ente,
            p_name: NOME_CON,
            p_category: "verdura",
            p_unit: "kg",
            p_current_price: 3,
            p_stock_minimum_threshold: 5,
          },
        },
      });
      expect(r.error).toBeNull();
      conSoglia = r.data.risultato.id;
      expect(Number(r.data.risultato.stock_minimum_threshold)).toBe(5);
    }
  );

  it("un ingrediente senza scorta minima si crea, e resta fuori dalla lista per sempre", async () => {
    const r = await titolare.rpc("create_ingredient", {
      p_entity_id: ente,
      p_name: NOME_SENZA,
      p_category: "verdura",
      p_unit: "kg",
      p_current_price: 2,
    });
    expect(r.error).toBeNull();
    senzaSoglia = r.data.id;
    expect(r.data.stock_minimum_threshold).toBeNull();

    await titolare.rpc("add_below_threshold_items");
    const righe = await titolare.from("shopping_list_items").select("id").eq("ingredient_id", senzaSoglia);
    expect(righe.data).toHaveLength(0);
  });

  it("zero non è «nessuna soglia»: sarebbe una soglia che non scatta mai", async () => {
    const r = await titolare.rpc("create_ingredient", {
      p_entity_id: ente,
      p_name: "TEST-AUTO spesa zero",
      p_category: "verdura",
      p_unit: "kg",
      p_current_price: 1,
      p_stock_minimum_threshold: 0,
    });
    expect(r.error).not.toBeNull();
  });

  it("chi è sotto soglia entra in lista coi numeri veri, non con quelli di ieri", async () => {
    if (!conSoglia) {
      // Il corridoio non è installato su questo progetto: l'ingrediente
      // si crea comunque, altrimenti il resto della prova non direbbe nulla.
      const r = await titolare.rpc("create_ingredient", {
        p_entity_id: ente,
        p_name: NOME_CON,
        p_category: "verdura",
        p_unit: "kg",
        p_current_price: 3,
        p_stock_minimum_threshold: 5,
      });
      expect(r.error).toBeNull();
      conSoglia = r.data.id;
    }

    await titolare.rpc("add_below_threshold_items");
    const lista = await titolare.rpc("lista_spesa");
    expect(lista.error).toBeNull();
    const riga = lista.data.find((r) => r.ingredient_id === conSoglia);
    expect(riga).toBeTruthy();
    expect(riga.origine).toBe("soglia_minima");
    expect(Number(riga.giacenza)).toBe(0);
    expect(Number(riga.soglia)).toBe(5);
    expect(Number(riga.mancante)).toBe(5);
    expect(riga.rientrata).toBe(false);
  });

  it("arriva la merce: i numeri si aggiornano da soli e la riga dice che ormai basta", async () => {
    const lotto = await titolare
      .from("stock_lots")
      .insert({ ingredient_id: conSoglia, quantity_received: 8, quantity_remaining: 8, unit_cost: 3 });
    expect(lotto.error).toBeNull();

    const lista = await titolare.rpc("lista_spesa");
    const riga = lista.data.find((r) => r.ingredient_id === conSoglia);
    expect(Number(riga.giacenza)).toBe(8);
    expect(Number(riga.mancante)).toBe(0);
    expect(riga.rientrata).toBe(true);

    // ...e non è sparita da sola: la lista è di Alessio.
    const righe = await titolare.from("shopping_list_items").select("id").eq("ingredient_id", conSoglia);
    expect(righe.data).toHaveLength(1);
  });

  it("lo staff non vede la lista completa: riceve un rifiuto, non un elenco vuoto", async () => {
    const r = await staff.rpc("lista_spesa");
    expect(r.error).not.toBeNull();
    expect(r.data ?? []).toHaveLength(0);
  });
});
