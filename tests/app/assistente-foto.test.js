import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAnonimo, clientAutenticato, credenziali, primaEntita, righeMie } from "./aiuto";

// L'assistente che legge le foto, provato sui dati veri del progetto di
// prova.
//
// ⚠️ ENTRA DAL COLLEGAMENTO DELL'APP, col token di un utente vero: è
//    l'unico modo di esercitare il tratto fra schermata e database, dove
//    vivono i difetti che nessuna verifica dentro una migrazione può
//    vedere — le migrazioni girano come proprietarie e scavalcano la RLS
//    (lezione del 16/08, pagata con un anno di ricette che nessuno poteva
//    marcare «pronte per la carta»).

describe("l'assistente che legge le foto", () => {
  let titolare;
  let staff;
  let anonimo;
  let entita;
  let mie;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    anonimo = clientAnonimo();
    entita = await primaEntita(titolare);
    mie = righeMie(titolare);
  });

  afterAll(async () => {
    await mie.pulisci();
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
  });

  // -----------------------------------------------------------------
  // Chi può usarlo
  // -----------------------------------------------------------------
  it("la spesa dell'assistente la vede solo il titolare", async () => {
    const suo = await titolare.rpc("spesa_ai_del_mese");
    expect(suo.error).toBeNull();

    // ⚠️ Un rifiuto, non un elenco vuoto: una risposta vuota è una
    //    rassicurazione falsa (regola del 13/08).
    const dellaSala = await staff.rpc("spesa_ai_del_mese");
    expect(dellaSala.error).not.toBeNull();
  });

  it("il tetto di spesa non lo cambia la sala", async () => {
    const r = await staff.rpc("imposta_tetto_ai", { p_euro: 999 });
    expect(r.error).not.toBeNull();
  });

  it("il registro delle letture non si legge con la chiave pubblica", async () => {
    const { data } = await anonimo.from("letture_foto").select("id").limit(1);
    expect(data ?? []).toHaveLength(0);
  });

  // -----------------------------------------------------------------
  // Il tetto
  // -----------------------------------------------------------------
  it("senza tetto non blocca, e lo dichiara invece di tacere", async () => {
    // ⚠️ È lo stato in cui nasce la produzione: se questo caso rispondesse
    //    «blocca», l'assistente nascerebbe spento.
    // 🔴 SI SALVA LA RIGA INTERA, non il solo numero. Fino al 26/08 questa
    //    prova rimetteva `tetto_euro` chiamando `imposta_tetto_ai`, e
    //    andava bene finché la riga era fatta di quel numero e basta.
    //    Quel giorno la riga ha acquistato `tetto_da` e `tetto_il` — chi
    //    ha toccato il tetto e quando — e da quel momento «rimettere com'era»
    //    è diventato falso in silenzio: la prova lasciava il tetto
    //    attribuito a sé stessa, e a scoprirlo è stata la verifica di una
    //    migrazione scritta tre ore dopo, non questa prova.
    //    ⚠️ È la lezione del 14/08 (si salva la RIGA, non le colonne che
    //    ci si ricorda) e insieme il limite dichiarato del guardiano dei
    //    residui: quello conta le righe, e una riga MODIFICATA e lasciata
    //    modificata non cambia nessun conteggio.
    const { data: rigaPrima } = await titolare
      .from("impostazioni_ai")
      .select("*")
      .maybeSingle();

    await titolare.rpc("imposta_tetto_ai", { p_euro: null });
    const { data } = await titolare.rpc("spesa_ai_del_mese");
    expect(data[0].blocca).toBe(false);
    expect(data[0].tetto_euro).toBeNull();
    expect(data[0].frase).toMatch(/nessun tetto/i);

    const { error: erroreRimessa } = await titolare
      .from("impostazioni_ai")
      .update(rigaPrima)
      .eq("id", rigaPrima.id);
    expect(erroreRimessa).toBeNull();

    const { data: rigaDopo } = await titolare.from("impostazioni_ai").select("*").maybeSingle();
    expect(rigaDopo).toEqual(rigaPrima);
  });

  it("un tetto a zero è respinto dal database, non dalla schermata", async () => {
    // ⚠️ Un tetto a zero spegnerebbe l'assistente senza dirlo. Per
    //    spegnerlo c'è un modo più chiaro: non usarlo.
    const r = await titolare.rpc("imposta_tetto_ai", { p_euro: 0 });
    expect(r.error).not.toBeNull();
  });

  // -----------------------------------------------------------------
  // Le origini degli allergeni
  // -----------------------------------------------------------------
  it("tre origini diverse danno tre frasi diverse alla sala", async () => {
    const { data: prodotto, error } = await titolare
      .from("ingredients")
      .insert({
        entity_id: entita,
        name: "ZZ prova origini allergeni",
        category: "secco_dispensa",
        unit: "kg",
        current_price: 1,
        allergens: ["glutine", "latte", "soia"],
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    mie.segna("ingredients", prodotto.id);

    const applicata = await titolare.rpc("applica_lettura_etichetta", {
      p_ingredient_id: prodotto.id,
      p_campi: {
        allergeni: [
          { codice: "glutine", origine: "etichetta" },
          { codice: "latte", origine: "fonte", fonte: "scheda tecnica del produttore" },
          { codice: "soia", origine: "dedotto" },
        ],
      },
    });
    expect(applicata.error).toBeNull();

    const { data: elenco, error: erroreElenco } = await titolare.rpc("allergeni_con_origine", {
      p_ingredient_id: prodotto.id,
    });
    expect(erroreElenco).toBeNull();
    expect(elenco).toHaveLength(3);

    // 🔴 IL PUNTO DEL MANDATO: in sala le tre origini NON si dicono uguale.
    //    Se le frasi coincidessero, un allergene dedotto si comporterebbe
    //    come una garanzia.
    const frasi = new Set(elenco.map((r) => r.frase));
    expect(frasi.size).toBe(3);

    const dedotto = elenco.find((r) => r.allergene === "soia");
    expect(dedotto.origine).toBe("dedotto");
    expect(dedotto.frase).toMatch(/invece di garantire/i);

    const daFonte = elenco.find((r) => r.allergene === "latte");
    expect(daFonte.fonte).toMatch(/scheda tecnica/i);
  });

  it("la lettura di un'etichetta passa DAL CORRIDOIO, non dritta dal browser", async () => {
    // 🔴 E' la regola B4 del Contratto: una scrittura che tocca due
    //    tabelle passa dal corridoio. Questo giro NON lo vede nessuna
    //    prova SQL — un'operazione fuori elenco risponde 404 e il
    //    database non se ne accorge nemmeno.
    //    ⚠️ Il difetto c'era davvero: fino al 25/08 il gestionale la
    //    chiamava dritta, e l'ha trovato `scritture-dal-corridoio`.
    const { data: prodotto } = await titolare
      .from("ingredients")
      .insert({
        entity_id: entita,
        name: "ZZ prova corridoio etichetta",
        category: "secco_dispensa",
        unit: "kg",
        current_price: 1,
        allergens: ["arachidi"],
      })
      .select("id")
      .single();
    mie.segna("ingredients", prodotto.id);

    const r = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "applica_lettura_etichetta",
        parametri: {
          p_ingredient_id: prodotto.id,
          p_campi: { allergeni: [{ codice: "arachidi", origine: "etichetta" }] },
        },
      },
    });
    expect(r.error, "il corridoio ha respinto l'operazione").toBeNull();
    expect(r.data?.errore, JSON.stringify(r.data)).toBeUndefined();

    // E l'effetto c'è davvero: non basta che il corridoio risponda.
    const { data: origini } = await titolare
      .from("allergeni_prodotto")
      .select("origine")
      .eq("ingredient_id", prodotto.id);
    expect(origini).toHaveLength(1);
    expect(origini[0].origine).toBe("etichetta");
  });

  it("la sala può leggere le origini: serve al cameriere davanti al cliente", async () => {
    // ⚠️ Se lo staff non potesse leggerle, tutta questa costruzione
    //    servirebbe soltanto al titolare — cioè a chi non è al tavolo
    //    quando il cliente chiede.
    const { error } = await staff.from("allergeni_prodotto").select("allergene").limit(1);
    expect(error).toBeNull();
  });

  it("la sala non può scrivere l'origine di un allergene", async () => {
    const { data: prodotto } = await titolare
      .from("ingredients")
      .insert({
        entity_id: entita,
        name: "ZZ prova scrittura origini",
        category: "secco_dispensa",
        unit: "kg",
        current_price: 1,
        allergens: ["uova"],
      })
      .select("id")
      .single();
    mie.segna("ingredients", prodotto.id);

    const r = await staff
      .from("allergeni_prodotto")
      .insert({ ingredient_id: prodotto.id, allergene: "uova", origine: "etichetta" });
    expect(r.error).not.toBeNull();
  });

  it("una fonte senza nome è respinta", async () => {
    const { data: prodotto } = await titolare
      .from("ingredients")
      .insert({
        entity_id: entita,
        name: "ZZ prova fonte senza nome",
        category: "secco_dispensa",
        unit: "kg",
        current_price: 1,
        allergens: ["sedano"],
      })
      .select("id")
      .single();
    mie.segna("ingredients", prodotto.id);

    const r = await titolare
      .from("allergeni_prodotto")
      .insert({ ingredient_id: prodotto.id, allergene: "sedano", origine: "fonte", fonte: "  " });
    expect(r.error).not.toBeNull();
  });

  it("un allergene messo a mano non sparisce dalla sala", async () => {
    // 🔴 Se sparisse, il gestionale direbbe che un piatto non contiene una
    //    cosa che contiene. È il modo peggiore in cui questa funzione
    //    potrebbe sbagliare.
    const { data: prodotto } = await titolare
      .from("ingredients")
      .insert({
        entity_id: entita,
        name: "ZZ prova allergene a mano",
        category: "secco_dispensa",
        unit: "kg",
        current_price: 1,
        allergens: ["pesce"],
      })
      .select("id")
      .single();
    mie.segna("ingredients", prodotto.id);

    const { data: elenco } = await titolare.rpc("allergeni_con_origine", {
      p_ingredient_id: prodotto.id,
    });
    expect(elenco).toHaveLength(1);
    expect(elenco[0].origine).toBe("alessio");
    expect(elenco[0].frase).toMatch(/verificato da alessio/i);
  });

  it("un'origine non sopravvive al suo allergene", async () => {
    const { data: prodotto } = await titolare
      .from("ingredients")
      .insert({
        entity_id: entita,
        name: "ZZ prova origine orfana",
        category: "secco_dispensa",
        unit: "kg",
        current_price: 1,
        allergens: ["senape"],
      })
      .select("id")
      .single();
    mie.segna("ingredients", prodotto.id);

    await titolare.rpc("applica_lettura_etichetta", {
      p_ingredient_id: prodotto.id,
      p_campi: { allergeni: [{ codice: "senape", origine: "etichetta" }] },
    });

    await titolare.from("ingredients").update({ allergens: [] }).eq("id", prodotto.id);

    const { data: rimaste } = await titolare
      .from("allergeni_prodotto")
      .select("allergene")
      .eq("ingredient_id", prodotto.id);
    expect(rimaste ?? []).toHaveLength(0);
  });

  // -----------------------------------------------------------------
  // La marcatura dei campi
  // -----------------------------------------------------------------
  it("la marcatura cade quando Alessio corregge quel campo, e resta se lo riscrive uguale", async () => {
    const { data: prodotto } = await titolare
      .from("ingredients")
      .insert({
        entity_id: entita,
        name: "ZZ prova marcatura campi",
        category: "secco_dispensa",
        unit: "kg",
        current_price: 1,
        storage_type: "dispensa",
        shelf_life_days: 200,
      })
      .select("id")
      .single();
    mie.segna("ingredients", prodotto.id);

    await titolare.rpc("marca_campi_dall_assistente", {
      p_ingredient_id: prodotto.id,
      p_campi: ["conservazione", "durata"],
    });

    // Riscrivere lo STESSO valore non è una correzione.
    await titolare.from("ingredients").update({ storage_type: "dispensa" }).eq("id", prodotto.id);
    // Cambiarlo sì.
    await titolare.from("ingredients").update({ shelf_life_days: 90 }).eq("id", prodotto.id);

    const { data } = await titolare
      .from("ingredients")
      .select("campi_dall_assistente")
      .eq("id", prodotto.id)
      .single();

    expect(data.campi_dall_assistente).toContain("conservazione");
    expect(data.campi_dall_assistente).not.toContain("durata");
  });

  // -----------------------------------------------------------------
  // Il vocabolario
  // -----------------------------------------------------------------
  it("un genere di foto inventato è respinto dal database", async () => {
    // ⚠️ Serve perché la schermata e il conto della spesa restino
    //    d'accordo su quali generi esistono.
    const r = await titolare.rpc("registra_lettura_foto", {
      p_genere: "scontrino",
      p_esito: "letta",
    });
    expect(r.error).not.toBeNull();
  });

  it("il costo di una lettura si calcola dal listino, non a occhio", async () => {
    // ⚠️ I numeri sono quelli di una foto vera, e le tre risposte sbagliate
    //    possibili danno tre risultati DIVERSI: solo la domanda 0,00413,
    //    solo la risposta 0,00550, i token sommati a un prezzo solo
    //    0,00523. Un conto che sbaglia non può azzeccare per caso.
    const { data, error } = await titolare.rpc("registra_lettura_foto", {
      p_genere: "etichetta",
      p_esito: "letta",
      p_modello: "claude-sonnet-5",
      p_token_domanda: 1500,
      p_token_risposta: 400,
      p_messaggio: "ZZ prova costo",
    });
    expect(error).toBeNull();
    expect(Number(data.costo_euro)).toBeCloseTo(0.00963, 5);
    expect(data.nel_listino).toBe(true);
    mie.segna("letture_foto", data.id);
  });

  it("un modello fuori listino non costa zero in silenzio: lo dichiara", async () => {
    // ⚠️ È il caso che arriverà davvero, il giorno che si cambia modello e
    //    nessuno aggiorna il listino. Uno zero muto si legge «gratis».
    const { data } = await titolare.rpc("registra_lettura_foto", {
      p_genere: "etichetta",
      p_esito: "letta",
      p_modello: "un-modello-che-non-esiste",
      p_token_domanda: 1000,
      p_token_risposta: 100,
    });
    mie.segna("letture_foto", data.id);
    expect(data.nel_listino).toBe(false);

    const { data: riga } = await titolare
      .from("letture_foto")
      .select("messaggio, costo_euro")
      .eq("id", data.id)
      .single();
    expect(Number(riga.costo_euro)).toBe(0);
    expect(riga.messaggio).toMatch(/non e' nel listino|non è nel listino/i);
  });
});
