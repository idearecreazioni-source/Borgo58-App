import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita, righeMie } from "./aiuto";

// GLI ALLERGENI AL TAVOLO — sui dati veri del progetto di prova
// (24/08/2026, blocco 1 del mandato del collaudo).
//
// 🔴 PERCHÉ QUI E NON SOLO DENTRO LE MIGRAZIONI: una migrazione gira come
// PROPRIETARIA del database e scavalca la RLS, quindi non può accorgersi di
// un difetto di permessi (regola del 16/08). Questa prova entra col token
// dello STAFF — che è chi sta in sala — e col token del TITOLARE, e passa
// dal corridoio come ci passa il tablet.
//
// ⚠️ E la pulizia cancella SOLO righe di cui conosce l'identificativo,
// perché se l'è segnato creandole (`righeMie`, regola del 23/08).

describe("gli allergeni al tavolo", () => {
  let titolare;
  let staff;
  let mie;
  let entita;
  let burro;
  let senzaLattosio;
  let panna;
  let piatto;
  let conto;
  let riga;

  beforeAll(async () => {
    const cred = credenziali();
    titolare = await clientAutenticato(cred.titolare);
    staff = await clientAutenticato(cred.staff);
    mie = righeMie(titolare);
    entita = await primaEntita(titolare);

    const nuovoIngrediente = async (nome, allergeni) => {
      const { data, error } = await titolare
        .from("ingredients")
        .insert({
          entity_id: entita,
          name: nome,
          category: "latticini",
          unit: "kg",
          allergens: allergeni,
          current_price: 10,
        })
        .select("id")
        .single();
      if (error) throw new Error(`${nome}: ${error.message}`);
      return mie.segna("ingredients", data.id);
    };

    burro = await nuovoIngrediente("__PROVA__ burro allergeni", ["latte"]);
    senzaLattosio = await nuovoIngrediente("__PROVA__ burro senza lattosio", []);
    // ⚠️ IL SECONDO PORTATORE DELLO STESSO ALLERGENE è il cuore della prova:
    // con uno solo, «coperto» e «tutti coperti» darebbero la stessa
    // risposta e la prova non distinguerebbe niente.
    panna = await nuovoIngrediente("__PROVA__ panna allergeni", ["latte"]);

    const { data: r, error: er } = await titolare
      .from("recipes")
      .insert({
        name: "__PROVA__ piatto allergeni",
        category: "primo",
        recipe_type: "piatto_finito",
        portions_yield: 1,
      })
      .select("id")
      .single();
    if (er) throw new Error(er.message);
    piatto = mie.segna("recipes", r.id);

    for (const [ing, q] of [
      [burro, 0.05],
      [panna, 0.1],
    ]) {
      const { data, error } = await titolare
        .from("recipe_ingredients")
        .insert({ recipe_id: piatto, ingredient_id: ing, quantity: q, unit: "kg" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      mie.segna("recipe_ingredients", data.id);
    }

    const { data: o, error: eo } = await titolare
      .from("orders")
      .insert({ table_label: "__PROVA__ allergeni", status: "aperto", coperti: 2, entity_id: entita })
      .select("id")
      .single();
    if (eo) throw new Error(eo.message);
    conto = mie.segna("orders", o.id);

    // ⚠️ DUE PORZIONI: con una sola, «supplemento per riga» e «supplemento
    // per porzione» darebbero lo stesso numero.
    const { data: i, error: ei } = await titolare
      .from("order_items")
      .insert({
        order_id: conto,
        recipe_id: piatto,
        destination: "cucina",
        quantity: 2,
        unit_price: 20,
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (ei) throw new Error(ei.message);
    riga = mie.segna("order_items", i.id);
  }, 60000);

  afterAll(async () => {
    // 🔴 UNA RIGA GIÀ ANDATA IN CUCINA NON SI CANCELLA — è il vincolo del
    // Blocco 4, e la prova non lo aggira: si cancella il CONTO, che se le
    // porta dietro tutte. È il ramo che il trigger lascia aperto apposta.
    // ⚠️ Dopo, `pulisci()` prova comunque a togliere la riga per
    // identificativo e non trova niente: è un colpo a vuoto, non un errore.
    await titolare.from("order_item_sostituzioni").delete().eq("order_item_id", riga);
    if (conto) await titolare.from("orders").delete().eq("id", conto);
    await mie.pulisci();
    await staff.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  }, 60000);

  it("senza dichiarazione, in sala il pulsante è SPENTO e non promette niente", async () => {
    const { data, error } = await staff.rpc("allergeni_della_riga", { p_order_item_id: riga });
    expect(error).toBeNull();
    const latte = (data ?? []).find((x) => x.allergene === "latte");
    // 🔴 L'ALLERGENE C'È E SI VEDE: nasconderlo farebbe credere al cameriere
    // che il piatto il lattosio non ce l'abbia.
    expect(latte, "il lattosio non compare nemmeno spento").toBeTruthy();
    expect(latte.eliminabile).toBe(false);
    expect(latte.applicata).toBe(false);
  });

  it("e il gesto viene respinto dicendo che nessuno l'ha ancora guardato", async () => {
    const r = await staff.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "applica_sostituzione_riga",
        parametri: { p_order_item_id: riga, p_allergene: "latte" },
      },
    });
    // ⚠️ Il corridoio risponde con uno stato non-2xx, e `functions.invoke`
    // non solleva: la frase sta nel CORPO della risposta. Fermarsi a «c'è
    // stato un errore» proverebbe solo che qualcosa è andato storto, non
    // che il gestionale ha detto la cosa giusta a chi sta in sala.
    expect(r.error, "il gesto è passato senza nessuna dichiarazione").not.toBeNull();
    const corpo = await r.error.context.json();
    expect(corpo?.errore?.messaggio ?? "").toMatch(/nessuno ha ancora dichiarato/i);
  });

  it("dichiararlo togliibile con una sostituzione su due è RESPINTO, e nomina chi manca", async () => {
    const { data, error } = await titolare
      .from("sostituzioni_allergene")
      .insert({
        recipe_id: piatto,
        allergene: "latte",
        ingrediente_id: burro,
        sostituto_id: senzaLattosio,
        costo_aggiuntivo: 1.0,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    mie.segna("sostituzioni_allergene", data.id);

    const r = await titolare
      .from("scelte_allergene")
      .insert({ recipe_id: piatto, allergene: "latte", eliminabile: true });
    expect(r.error, "la promessa a metà è passata").not.toBeNull();
    // ⚠️ IL RIFIUTO NOMINA CHI MANCA: senza il nome, chi legge non sa cosa
    // fare — e la panna è proprio l'ingrediente che renderebbe falsa la
    // promessa.
    expect(r.error.message).toMatch(/panna/i);
  });

  it("con la copertura completa si può promettere, e in sala il pulsante si accende", async () => {
    const { data, error } = await titolare
      .from("sostituzioni_allergene")
      .insert({
        recipe_id: piatto,
        allergene: "latte",
        ingrediente_id: panna,
        sostituto_id: null, // si toglie e basta
        costo_aggiuntivo: 0.5,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    mie.segna("sostituzioni_allergene", data.id);

    const s = await titolare
      .from("scelte_allergene")
      .insert({ recipe_id: piatto, allergene: "latte", eliminabile: true })
      .select("id")
      .single();
    expect(s.error).toBeNull();
    mie.segna("scelte_allergene", s.data.id);

    const { data: righe } = await staff.rpc("allergeni_della_riga", { p_order_item_id: riga });
    const latte = (righe ?? []).find((x) => x.allergene === "latte");
    expect(latte.eliminabile).toBe(true);
    expect(Number(latte.costo_aggiuntivo)).toBe(1.5);
  });

  it("la sala applica la sostituzione DAL CORRIDOIO, e il supplemento va sul conto", async () => {
    const r = await staff.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "applica_sostituzione_riga",
        parametri: { p_order_item_id: riga, p_allergene: "latte" },
      },
    });
    expect(r.data?.errore, JSON.stringify(r.data?.errore)).toBeUndefined();
    expect(r.data?.risultato?.sostituzioni ?? r.data?.sostituzioni).toBe(2);

    const { data: t, error } = await titolare.rpc("totale_conto", { p_order_id: conto });
    expect(error).toBeNull();
    // 2 porzioni × (1,00 + 0,50) = 3,00 — il numero che distingue le due
    // risposte sbagliate possibili (1,50 se non seguisse la quantità, 0 se
    // non entrasse affatto).
    expect(Number(t[0].supplementi)).toBe(3);
    expect(Number(t[0].righe)).toBe(43);
  });

  it("e la cucina la legge sulla riga di quel piatto, non altrove", async () => {
    const { data, error } = await staff
      .from("order_items")
      .select("id, sostituzioni:order_item_sostituzioni(allergene, descrizione)")
      .eq("id", riga)
      .single();
    expect(error).toBeNull();
    const frasi = (data.sostituzioni ?? []).map((x) => x.descrizione).sort();
    expect(frasi.join(" · ")).toMatch(/burro senza lattosio/);
    expect(frasi.join(" · ")).toMatch(/si toglie/);
  });

  it("togliere la sostituzione dal Ricettario è RESPINTO finché la promessa è in piedi", async () => {
    const { data } = await titolare
      .from("sostituzioni_allergene")
      .select("id")
      .eq("recipe_id", piatto)
      .eq("ingrediente_id", burro)
      .single();
    const r = await titolare.from("sostituzioni_allergene").delete().eq("id", data.id);
    expect(r.error, "la promessa è rimasta senza il modo di mantenerla").not.toBeNull();
    // ⚠️ Un rifiuto senza via d'uscita è un vicolo cieco: il messaggio deve
    // dire cosa fare prima.
    expect(r.error.message).toMatch(/Prima togli la dichiarazione/i);
  });

  it("il gestionale non lascia chiamare gli aiuti interni da un client", async () => {
    // ⚠️ Due porte che il 24/08 erano state aperte per distrazione e che la
    // 20260824000036 ha richiuso. Qui si controlla dal client, che è l'unico
    // posto da cui un difetto di permessi si vede.
    for (const nome of ["fabbisogno_conto", "ingredienti_con_allergene"]) {
      const r = await titolare.rpc(
        nome,
        nome === "fabbisogno_conto"
          ? { p_order_id: conto }
          : { p_recipe_id: piatto, p_allergene: "latte" }
      );
      expect(r.error, `${nome} è ancora chiamabile da un client`).not.toBeNull();
    }
  });
});
