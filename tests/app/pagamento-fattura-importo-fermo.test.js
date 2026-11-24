import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, primaEntita } from "./aiuto";

// REVISIONE DELL'11/11/2026, punto 19: l'importo di un movimento che paga una fattura non si cambia. Su Prova, col token del
// titolare (la barriera sta nel database, non nella schermata). Righe INVENTATE (il repo è pubblico), ripulite alla fine.

const MARCA = marchio("TEST-AUTO pagamento fattura");

describe("un pagamento di fattura non cambia importo", () => {
  let titolare;
  let ente;
  let fornitore;
  let fattura;
  let movimentoDiFattura;
  let movimentoLibero;

  async function pulisci() {
    await titolare.from("cash_movements").delete().like("note", `${MARCA}%`);
    await titolare.from("supplier_invoices").delete().like("invoice_number", `${MARCA}%`);
    await titolare.from("suppliers").delete().like("name", `${MARCA}%`);
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    ente = await primaEntita(titolare);
    await pulisci();
    const f = await titolare.from("suppliers").insert({ entity_id: ente, name: `${MARCA} fornitore` }).select("id").single();
    expect(f.error).toBeNull();
    fornitore = f.data.id;
    const fa = await titolare
      .from("supplier_invoices")
      .insert({ entity_id: ente, supplier_id: fornitore, invoice_number: `${MARCA}-1`, invoice_date: "1991-10-01", due_date: "1991-10-31", amount: 1000 })
      .select("id")
      .single();
    expect(fa.error).toBeNull();
    fattura = fa.data.id;
    const m1 = await titolare
      .from("cash_movements")
      .insert({ entity_id: ente, direction: "uscita", amount: 1000, movement_date: "1991-11-01", mezzo: "cassa", tipo_documento: "fattura", note: `${MARCA} paga la fattura`, supplier_invoice_id: fattura })
      .select("id")
      .single();
    expect(m1.error).toBeNull();
    movimentoDiFattura = m1.data.id;
    const m2 = await titolare
      .from("cash_movements")
      .insert({ entity_id: ente, direction: "uscita", amount: 50, movement_date: "1991-11-01", mezzo: "cassa", tipo_documento: "non_documentato", note: `${MARCA} libero` })
      .select("id")
      .single();
    expect(m2.error).toBeNull();
    movimentoLibero = m2.data.id;
  });

  afterAll(async () => {
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
  });

  it("🔴 correggere da 1.000 a 100 il movimento che paga una fattura viene RIFIUTATO, con un messaggio che dice cosa fare", async () => {
    const r = await titolare.from("cash_movements").update({ amount: 100 }).eq("id", movimentoDiFattura).select("amount");
    expect(r.error).not.toBeNull();
    expect(r.error.message).toMatch(/paga una fattura/i);
    expect(r.error.message).toMatch(/annulla il pagamento della fattura/i);
    const { data } = await titolare.from("cash_movements").select("amount").eq("id", movimentoDiFattura).single();
    expect(Number(data.amount)).toBe(1000);
  });

  it("nota, data e riferimento dello stesso movimento si correggono ancora", async () => {
    const r = await titolare
      .from("cash_movements")
      .update({ note: `${MARCA} nota corretta`, movement_date: "1991-11-02" })
      .eq("id", movimentoDiFattura)
      .select("note, movement_date")
      .single();
    expect(r.error).toBeNull();
    expect(r.data.note).toBe(`${MARCA} nota corretta`);
    expect(r.data.movement_date).toBe("1991-11-02");
  });

  it("un movimento senza fattura cambia importo come sempre", async () => {
    const r = await titolare.from("cash_movements").update({ amount: 60 }).eq("id", movimentoLibero).select("amount").single();
    expect(r.error).toBeNull();
    expect(Number(r.data.amount)).toBe(60);
  });
});
