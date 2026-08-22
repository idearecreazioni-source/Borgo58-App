import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bigliettiCucina } from "../../src/lib/calcoli/turni";
import { clientAutenticato, credenziali, sagomeDiProva } from "./aiuto";

// I TURNI DEI PASTI, sui dati veri.
//
// 🔴 QUESTA PROVA ESISTE PER IL TRATTO FRA DATABASE E REGOLA, che le prove
// pure non possono vedere: quelle si inventano righe **della forma che il
// codice si aspetta**, quindi non saprebbero mai che il `turno` non arriva
// o che l'incorporamento del tavolo è cambiato nome. È la lezione del giro
// D2 (18/08), dove una prova pura passava mentre la schermata parlava la
// lingua sbagliata.
//
// ⚠️ E le righe si leggono con LA STESSA select della Cucina, non con una
// scritta qui: se quella smettesse di riportare il turno, la cucina
// stamperebbe tutto come «1° turno» **senza nessun errore**.
describe("i turni dei pasti", () => {
  let staff;
  let titolare;
  let prova = { ids: [], sagome: [], pulisci: async () => {} };
  let ordine;

  const SELECT_CUCINA = "*, recipe:recipe_id(name), order:order_id!inner(table_label, status, note)";

  async function pulisciConti() {
    const { data: vecchi } = await titolare
      .from("orders")
      .select("id")
      .like("table_label", "__PROVA__%");
    for (const o of vecchi ?? []) {
      await titolare.from("chiamate_turno").delete().eq("order_id", o.id);
      await titolare.from("order_items").delete().eq("order_id", o.id);
      await titolare.from("orders").delete().eq("id", o.id);
    }
  }

  async function segna(nome, turno, opzioni = {}) {
    const riga = {
      order_id: ordine,
      free_text_name: nome,
      destination: "cucina",
      quantity: 1,
      unit_price: 1.0,
      ...opzioni,
    };
    // ⚠️ `turno` si passa solo quando la prova lo vuole esplicito: uno dei
    // casi da provare è proprio la riga che NON lo nomina.
    if (turno !== undefined) riga.turno = turno;
    const { data, error } = await staff.from("order_items").insert(riga).select().single();
    expect(error).toBeNull();
    return data;
  }

  beforeAll(async () => {
    const cred = credenziali();
    staff = await clientAutenticato(cred.staff);
    titolare = await clientAutenticato(cred.titolare);
    await pulisciConti();
    prova = await sagomeDiProva(titolare, 1);

    const { data, error } = await staff.rpc("apri_conto", {
      p_tavoli: prova.ids,
      p_device_id: null,
      p_note: null,
    });
    expect(error).toBeNull();
    ordine = data.order_id;
  });

  afterAll(async () => {
    await pulisciConti();
    await prova.pulisci();
  });

  it("una riga che non nomina il turno è del primo", async () => {
    // È il comportamento di tutte le righe scritte prima del 21/08 e di
    // qualunque schermata che non sia stata aggiornata.
    const riga = await segna("Prova senza turno", undefined);
    expect(riga.turno).toBe(1);
  });

  it("il turno zero è respinto dal database, non dalla schermata", async () => {
    const { error } = await staff.from("order_items").insert({
      order_id: ordine,
      free_text_name: "Prova turno zero",
      destination: "cucina",
      quantity: 1,
      unit_price: 1.0,
      turno: 0,
    });
    expect(error).not.toBeNull();
  });

  it("una comanda a tre turni mandata TUTTA INSIEME esce in tre fogli", async () => {
    // 🔴 La prova che discrimina, sui dati veri: un solo `sent_at` per sei
    // righe. Con la regola vecchia (raggruppo per invio) qui usciva un
    // foglio solo.
    await staff.from("order_items").delete().eq("order_id", ordine);

    for (const [nome, turno] of [
      ["Antipasto A", 1],
      ["Antipasto B", 1],
      ["Pasta", 1],
      ["Secondo A", 2],
      ["Secondo B", 2],
      ["Dolce", 3],
    ]) {
      await segna(nome, turno);
    }

    const adesso = new Date().toISOString();
    const invio = await staff
      .from("order_items")
      .update({ sent_at: adesso })
      .eq("order_id", ordine)
      .is("sent_at", null);
    expect(invio.error).toBeNull();

    const { data: righe, error } = await staff
      .from("order_items")
      .select(SELECT_CUCINA)
      .eq("destination", "cucina")
      .eq("order.status", "aperto")
      .not("sent_at", "is", null)
      .is("voided_at", null)
      .eq("order_id", ordine)
      .order("sent_at", { ascending: true });
    expect(error).toBeNull();
    expect(righe).toHaveLength(6);

    // ⚠️ Il turno arriva davvero: se la select smettesse di riportarlo,
    // tutto risulterebbe «1° turno» senza errori.
    expect(righe.every((r) => typeof r.turno === "number")).toBe(true);
    expect(righe[0].order.table_label).toContain("__PROVA__");

    const fogli = bigliettiCucina(righe, []);
    expect(fogli.map((f) => f.turno)).toEqual([1, 2, 3]);
    expect(fogli.map((f) => f.items.length)).toEqual([3, 2, 1]);
    expect(fogli.every((f) => f.tavolo.includes("__PROVA__"))).toBe(true);
  });

  it("lo staff chiama il prossimo turno, e il biglietto compare in coda col tavolo", async () => {
    const { error } = await staff.from("chiamate_turno").insert({ order_id: ordine });
    expect(error).toBeNull();

    const { data: chiamate, error: erroreLettura } = await staff
      .from("chiamate_turno")
      .select("*, order:order_id!inner(table_label, status)")
      .eq("order.status", "aperto")
      .eq("order_id", ordine);
    expect(erroreLettura).toBeNull();
    expect(chiamate).toHaveLength(1);
    expect(chiamate[0].stampata_il).toBeNull();

    const fogli = bigliettiCucina([], chiamate);
    expect(fogli[0].tipo).toBe("chiamata");
    expect(fogli[0].tavolo).toContain("__PROVA__");
  });

  it("si può chiamare due volte di fila: il biglietto è generico e senza limiti", async () => {
    // Decisione di Alessio del 21/08: non conta i turni, non si spegne,
    // non impedisce di premerlo di nuovo. Se un giorno qualcuno mettesse
    // un vincolo «uno per conto», questa prova diventerebbe rossa.
    const { error } = await staff.from("chiamate_turno").insert({ order_id: ordine });
    expect(error).toBeNull();

    const { data } = await staff.from("chiamate_turno").select("id").eq("order_id", ordine);
    expect(data.length).toBeGreaterThanOrEqual(2);
  });

  it("la stampa si segna, e si può togliere", async () => {
    const { data: uno } = await staff
      .from("chiamate_turno")
      .select("id")
      .eq("order_id", ordine)
      .limit(1)
      .single();

    const quando = new Date().toISOString();
    const su = await staff.from("chiamate_turno").update({ stampata_il: quando }).eq("id", uno.id).select().single();
    expect(su.error).toBeNull();
    expect(su.data.stampata_il).not.toBeNull();

    const giu = await staff.from("chiamate_turno").update({ stampata_il: null }).eq("id", uno.id).select().single();
    expect(giu.error).toBeNull();
    expect(giu.data.stampata_il).toBeNull();
  });

  it("un conto che non è aperto non accetta biglietti", async () => {
    // ⚠️ Il rifiuto sta nel database, non nella schermata: un biglietto
    // per un tavolo che ha già pagato è carta sprecata in cucina, e la
    // schermata non è l'unica porta.
    const { data: chiuso, error: erroreConto } = await titolare
      .from("orders")
      .insert({ table_label: "__PROVA__chiuso", status: "annullato" })
      .select()
      .single();
    expect(erroreConto).toBeNull();

    const { error } = await staff.from("chiamate_turno").insert({ order_id: chiuso.id });
    expect(error).not.toBeNull();

    await titolare.from("orders").delete().eq("id", chiuso.id);
  });
});
