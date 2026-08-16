import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";

// Blocco 4 del mandato di correzione.
//
// ⚠️ Queste prove entrano come entra un TABLET DI SALA — con l'utente
// staff, non col titolare — ed è il punto: le policy di `order_items` sono
// aperte a tutto lo staff, giustamente, e il difetto era proprio che da
// qualsiasi tablet si poteva far sparire una riga già in cottura. Provarlo
// col titolare direbbe poco.
const MARCA = "TEST-AUTO comande";

describe("una riga già mandata in cucina non sparisce", () => {
  let staff;
  let titolare;
  let contoId;

  async function pulisci() {
    // Il conto intero se ne va con le sue righe: è il ramo del trigger che
    // tiene cancellabile un conto anche quando ha righe inviate.
    const { data } = await titolare.from("orders").select("id").eq("table_label", MARCA);
    for (const o of data ?? []) await titolare.from("orders").delete().eq("id", o.id);
  }

  beforeAll(async () => {
    staff = await clientAutenticato(credenziali().staff);
    titolare = await clientAutenticato(credenziali().titolare);
    await pulisci();
    const { data, error } = await titolare
      .from("orders")
      .insert({ table_label: MARCA, status: "aperto", coperti: 2, coperto_unit_price: 5 })
      .select()
      .single();
    if (error) throw new Error(error.message);
    contoId = data.id;
  });

  afterAll(async () => {
    await pulisci();
    await staff.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  });

  const aggiungi = async (nome, prezzo, inviata) => {
    const { data, error } = await staff
      .from("order_items")
      .insert({
        order_id: contoId,
        free_text_name: nome,
        destination: "cucina",
        quantity: 1,
        unit_price: prezzo,
        sent_at: inviata ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  };

  it("la bozza si cambia e si cancella: è lavoro in corso", async () => {
    const id = await aggiungi(`${MARCA} bozza`, 7, false);

    const { error: e1 } = await staff.from("order_items").update({ quantity: 3 }).eq("id", id);
    expect(e1).toBeNull();

    const { error: e2 } = await staff.from("order_items").delete().eq("id", id);
    expect(e2).toBeNull();
  });

  it("la riga inviata non si cancella e non cambia i suoi numeri, nemmeno dal tablet di sala", async () => {
    const id = await aggiungi(`${MARCA} inviata`, 10, true);

    const { error: eDel } = await staff.from("order_items").delete().eq("id", id);
    expect(eDel, "una riga già in cottura si è lasciata cancellare").toBeTruthy();

    const { error: eQta } = await staff.from("order_items").update({ quantity: 9 }).eq("id", id);
    expect(eQta, "la quantità di una riga già in cottura si è lasciata cambiare").toBeTruthy();

    // …ma è ancora lì: un rifiuto non deve fare mezzo lavoro.
    const { data } = await titolare.from("order_items").select("quantity").eq("id", id).single();
    expect(Number(data.quantity)).toBe(1);
  });

  it("ma si storna, e la nota resta modificabile: la cura non impedisce di correggersi", async () => {
    const { data: riga } = await titolare
      .from("order_items")
      .select("id")
      .eq("order_id", contoId)
      .not("sent_at", "is", null)
      .limit(1)
      .single();

    const { error: eNota } = await staff
      .from("order_items")
      .update({ note: "senza glutine" })
      .eq("id", riga.id);
    expect(eNota).toBeNull();

    const { error: eStorno } = await staff
      .from("order_items")
      .update({ voided_at: new Date().toISOString(), void_reason: "prova" })
      .eq("id", riga.id);
    expect(eStorno, "lo storno è stato impedito: sarebbe rimasto solo il divieto").toBeNull();
  });

  it("il totale del database conta solo le righe mandate in cucina, e dichiara le altre", async () => {
    // Perimetro pulito: un conto nuovo per questa prova.
    const { data: conto } = await titolare
      .from("orders")
      .insert({ table_label: MARCA, status: "aperto", coperti: 2, coperto_unit_price: 5 })
      .select()
      .single();

    const inserisci = (nome, prezzo, inviata) =>
      staff.from("order_items").insert({
        order_id: conto.id,
        free_text_name: nome,
        destination: "cucina",
        quantity: 1,
        unit_price: prezzo,
        sent_at: inviata ? new Date().toISOString() : null,
      });

    await inserisci(`${MARCA} servita`, 10, true);
    await inserisci(`${MARCA} in bozza`, 7, false);

    const { data, error } = await titolare.rpc("totale_conto", { p_order_id: conto.id });
    expect(error).toBeNull();
    const t = data[0];
    // 10 della riga servita + 2 coperti da 5. I 7 della bozza restano fuori.
    expect(Number(t.totale)).toBe(20);
    expect(Number(t.righe_mai_inviate)).toBe(1);
    expect(Number(t.valore_mai_inviate)).toBe(7);
  });
});
