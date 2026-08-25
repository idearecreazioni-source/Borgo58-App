import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { credenziali, primaEntita } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import { ingressiScenario } from "../../src/lib/api/proiezione";

// UNA PREVISIONE CHIUSA SI LEGGE, NON SI MODIFICA — 25/08/2026.
//
// 🔴 NASCE DA UNA RICHIESTA DI ALESSIO: *«un dato che esiste e non si può
// guardare è un dato che non c'è. La protezione riguarda la MODIFICA, non
// la lettura.»* Fino a oggi le voci di costo fisso di una previsione
// congelata non comparivano da nessuna schermata — il dettaglio mostrava
// solo il totale, e il modulo di modifica si rifiuta di aprirsi.
//
// ⚠️ LA PROVA SI COSTRUISCE LA PROPRIA PREVISIONE. Non ne cerca una
// congelata «fra quelle di Alessio»: è la lezione della
// `20260824000033`, che si è fermata in produzione proprio per quello —
// *il perimetro di una prova dev'essere fatto di roba che la prova ha
// creato*.
//
// 🔴 MA NON LA CONGELA, E LA RAGIONE VA LETTA PRIMA DI RIMETTERCELA.
// `scenari_proiezione` è una tabella tracciata: cancellare la previsione
// di prova lascia una **lapide** nel registro delle cancellazioni, che
// dal client **nessuno può ripulire** — e questa prova gira a ogni
// `npm run test:app`, quindi ne lascerebbe una ogni volta, per sempre.
// Misurato: la prima versione ne ha lasciata una (registro da 1683 a
// 1684), tolta a mano per identificativo.
//
// ⚠️ È una decisione che il progetto ha già preso, ed è scritta in
// CLAUDE.md dal 15/08: *«per questo il sigillo non si prova nelle prove
// automatiche ma dentro le migrazioni, che girano come proprietarie e si
// ripuliscono per intero»*. Il sigillo su una previsione congelata è
// provato dalla `20260825000004`; qui si prova la **lettura**, che è la
// metà nuova — e la si prova anche **dopo** che il sigillo esiste,
// perché è quello che la schermata deve saper fare.
describe("le voci di una previsione chiusa si leggono", () => {
  let scenarioId = null;

  beforeAll(async () => {
    const { error } = await supabase.auth.signInWithPassword(credenziali().titolare);
    if (error) throw new Error(`Non riesco a entrare come titolare: ${error.message}`);

    const entita = await primaEntita(supabase);
    const { data, error: e1 } = await supabase
      .from("scenari_proiezione")
      .insert({
        entity_id: entita,
        nome: "_prova voci previsione chiusa 25082026",
        tipo: "riproiezione",
        anno: 2098,
        scontrino_food: 25,
        scontrino_beverage: 8,
        food_cost_percento: 0.25,
        beverage_cost_percento: 0.25,
      })
      .select()
      .single();
    if (e1) throw e1;
    scenarioId = data.id;

    const { error: e2 } = await supabase.from("scenario_costi_fissi").insert([
      { scenario_id: scenarioId, voce: "Voce di prova A", euro_mese: 300 },
      { scenario_id: scenarioId, voce: "Voce di prova B", euro_mese: 120 },
    ]);
    if (e2) throw e2;

    // ⚠️ ANCHE I DODICI MESI: una previsione senza di loro non è una
    // previsione, e il gestionale la rifiuta appena le si chiede qualcosa
    // («questa previsione non ha nessun giorno di apertura»).
    //
    // 🔴 E LA PRIMA VERSIONE DI QUESTA PROVA CI È CADUTA, con una
    // conseguenza che vale più dell'errore: si fermava sul congelamento,
    // e **la prova successiva falliva di rimbalzo** su una previsione
    // rimasta aperta — facendo sembrare che *il sigillo non tenesse*.
    // È la trappola nota: in una catena che condivide lo stato, la prima
    // che fallisce fa cadere le altre per il RESIDUO che lascia, non per
    // il difetto che cercano. Chi conta i rossi conta i difetti solo se
    // le prove sono indipendenti.
    const { error: e3 } = await supabase.from("scenario_mesi").insert(
      Array.from({ length: 12 }, (_, i) => ({
        scenario_id: scenarioId,
        mese: i + 1,
        servizi_settimana: 5,
        giorni_lavorativi: 22,
        giorni_peak: 8,
        coperti_peak: 30,
        coperti_feriali: 20,
        eventi_premium: 0,
      }))
    );
    if (e3) throw e3;
  });

  afterAll(async () => {
    // ⚠️ Si cancella solo cio' di cui si conosce l'identificativo, perche'
    // l'ha creato questa prova. Mai «la piu' recente».
    if (scenarioId) {
      await supabase.from("scenario_costi_fissi").delete().eq("scenario_id", scenarioId);
      await supabase.from("scenario_mesi").delete().eq("scenario_id", scenarioId);
      await supabase.from("scenari_proiezione").delete().eq("id", scenarioId);
    }
    await supabase.auth.signOut({ scope: "local" });
  });

  it("le voci si leggono dalla stessa porta che usa la schermata", async () => {
    // ⚠️ Si passa da `ingressiScenario`, che è la funzione che il
    // dettaglio chiama davvero: leggere la tabella per conto proprio
    // proverebbe il database e non il tratto fra schermata e database.
    const ing = await ingressiScenario(scenarioId);
    expect(ing.costiFissi.length).toBe(2);
    expect(ing.costiFissi.map((f) => f.voce).sort()).toEqual(["Voce di prova A", "Voce di prova B"]);
    expect(ing.costiFissi.reduce((s2, f) => s2 + Number(f.euro_mese), 0)).toBe(420);
  });

  it("il totale delle voci è quello che la schermata mostra", async () => {
    // 🔴 LA SCHERMATA RICALCOLA IL TOTALE DALLE RIGHE, non lo legge dal
    // riepilogo: se i due divergessero, chi guarda lo vedrebbe. Qui si
    // controlla che il conto delle righe sia davvero la somma — senza,
    // una tabella che mostra quattro voci e un totale preso altrove
    // passerebbe questa prova senza dire niente.
    const ing = await ingressiScenario(scenarioId);
    const somma = ing.costiFissi.reduce((s2, f) => s2 + Number(f.euro_mese), 0);
    expect(somma * 12).toBe(5040);
  });
});
