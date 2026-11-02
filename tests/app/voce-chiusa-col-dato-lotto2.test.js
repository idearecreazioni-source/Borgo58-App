import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, righeMie } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import { addCleaningLog, addTemperatureLog } from "../../src/lib/api/haccp";
import { addShoppingListItem } from "../../src/lib/api/shoppingList";

// =====================================================================
// LA VOCE SI CHIUDE COL DATO — secondo lotto, dal client vero
// 27/10/2026 (20261027000001)
// =====================================================================
// Il primo lotto ha la sua prova (`voce-chiusa-col-dato.test.js`). Qui le
// tre gemelle «_da_voce» che non hanno bisogno di merce in magazzino:
// temperatura, pulizia, lista della spesa. Per ognuna: il dato c'è, la
// cosa detta è finita a mano, e la seconda volta viene rifiutata senza
// scrivere. Consumo, giacenza e carico usano lo stesso schema e la stessa
// funzione di chiusura, e la migrazione li prova sul rifiuto.
//
// ⚠️ PASSA DAL COLLEGAMENTO DELL'APP (`supabase`), come `uscita-a-mano`.

describe("la voce si chiude col dato: temperatura, pulizia, lista della spesa", () => {
  let titolare;
  let mie;

  const nuovaAzione = async (tipo, frase) => {
    const { data: dett, error: e1 } = await titolare
      .from("dettature")
      .insert({ testo: `TEST-AUTO ${frase}`, provenienza: "app", esito: "capita" })
      .select("id")
      .single();
    if (e1) throw e1;
    mie.segna("dettature", dett.id);
    const { data: az, error: e2 } = await titolare
      .from("azioni_dettate")
      .insert({
        dettatura_id: dett.id,
        progressivo: 1,
        tipo,
        dati: {},
        sicuro: true,
        frase: `TEST-AUTO ${frase}`,
        motivo: "prova",
        stato: "in_attesa",
      })
      .select("id")
      .single();
    if (e2) throw e2;
    mie.segna("azioni_dettate", az.id);
    return az.id;
  };

  const statoDi = async (id) => {
    const { data } = await titolare.from("azioni_dettate").select("stato").eq("id", id).single();
    return data?.stato;
  };

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    await supabase.auth.signInWithPassword(credenziali().titolare);
    mie = righeMie(titolare);
  });

  afterAll(async () => {
    await mie?.pulisci();
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  });

  it("🔴 una temperatura detta: lettura e chiusura insieme, e la seconda volta niente", async () => {
    const { data: frigo, error } = await titolare
      .from("haccp_equipment")
      .insert({ name: "TEST-AUTO frigo voce", storage_type: "frigo_0_4", target_min_c: 0, target_max_c: 4 })
      .select("id")
      .single();
    if (error) throw error;
    mie.segna("haccp_equipment", frigo.id);

    const azione = await nuovaAzione("temperatura", "frigo a due gradi");
    await addTemperatureLog({ equipmentId: frigo.id, recordedTempC: 2 }, { azioneDettataId: azione });
    const { data: letture } = await titolare.from("haccp_temperature_logs").select("id").eq("equipment_id", frigo.id);
    for (const l of letture ?? []) mie.segna("haccp_temperature_logs", l.id);
    expect(letture).toHaveLength(1);
    expect(await statoDi(azione)).toBe("fatta_a_mano");

    await expect(
      addTemperatureLog({ equipmentId: frigo.id, recordedTempC: 2 }, { azioneDettataId: azione }),
    ).rejects.toThrow(/non e' stata registrata|non è stata registrata/);
    const { count } = await titolare
      .from("haccp_temperature_logs")
      .select("id", { count: "exact", head: true })
      .eq("equipment_id", frigo.id);
    expect(count).toBe(1);
  });

  it("una pulizia detta si registra e si chiude insieme", async () => {
    const { data: compito, error } = await titolare
      .from("haccp_cleaning_tasks")
      .insert({ name: "TEST-AUTO piano di lavoro voce", frequency: "giornaliera" })
      .select("id")
      .single();
    if (error) throw error;
    mie.segna("haccp_cleaning_tasks", compito.id);

    const azione = await nuovaAzione("pulizia", "pulito il piano");
    await addCleaningLog({ taskId: compito.id, note: "TEST-AUTO" }, { azioneDettataId: azione });
    const { data: registrate } = await titolare.from("haccp_cleaning_logs").select("id").eq("task_id", compito.id);
    for (const r of registrate ?? []) mie.segna("haccp_cleaning_logs", r.id);
    expect(registrate).toHaveLength(1);
    expect(await statoDi(azione)).toBe("fatta_a_mano");
  });

  it("una riga della lista detta si aggiunge e si chiude insieme; di un altro tipo no", async () => {
    const azione = await nuovaAzione("lista_spesa", "serve carta assorbente");
    const nome = `TEST-AUTO carta assorbente ${azione.slice(0, 8)}`;
    const id = await addShoppingListItem({ customName: nome }, { azioneDettataId: azione });
    mie.segna("shopping_list_items", id);
    expect(await statoDi(azione)).toBe("fatta_a_mano");

    const sbagliata = await nuovaAzione("temperatura", "tipo sbagliato per la lista");
    await expect(
      addShoppingListItem({ customName: `${nome} bis` }, { azioneDettataId: sbagliata }),
    ).rejects.toThrow(/non si finisce da questa schermata/);
    expect(await statoDi(sbagliata)).toBe("in_attesa");
    const { count } = await titolare
      .from("shopping_list_items")
      .select("id", { count: "exact", head: true })
      .eq("custom_name", `${nome} bis`);
    expect(count).toBe(0);
  });
});
