import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAnonimo, clientAutenticato, credenziali, marchio, soloMiei } from "./aiuto";

// Il piano dell'investimento (07/11/2026) è solo del titolare.
//
// 🔴 LA RLS SI PROVA SOLO COL TOKEN VERO: dentro la migrazione si gira
//    come proprietari. E si prova con una riga che lo staff NON deve
//    vedere: su una tabella vuota la prova passerebbe identica anche a RLS
//    spenta (protocollo §7 punto 2).
const MARCA = marchio("TEST-AUTO piano");

describe("piano dell'investimento: solo il titolare", () => {
  let titolare;
  let staff;
  let anonimo;
  let voce;

  async function pulisci() {
    const { data } = await titolare.from("piano_voci").select("id").like("descrizione", soloMiei("TEST-AUTO piano"));
    for (const v of data ?? []) {
      await titolare.from("piano_rate").delete().eq("voce_id", v.id);
      await titolare.from("piano_voci").delete().eq("id", v.id);
    }
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    anonimo = clientAnonimo();
    await pulisci();
    const { data, error } = await titolare
      .from("piano_voci")
      .insert({ gruppo: "B", descrizione: `${MARCA} cappa`, importo_ivato: 1220, aliquota_iva: 22, stato: "preventivato" })
      .select("id, netto")
      .single();
    if (error) throw error;
    voce = data;
    const { error: e2 } = await titolare.from("piano_rate").insert([
      { voce_id: voce.id, mese_rel: 0, importo: 610 },
      { voce_id: voce.id, mese_rel: 1, importo: 610 },
    ]);
    if (e2) throw e2;
  });

  afterAll(async () => {
    await pulisci();
  });

  it("il titolare scrive una voce, e il netto lo calcola il database", () => {
    expect(Number(voce.netto)).toBe(1000);
  });

  it("il titolare legge la data di apertura", async () => {
    const { data, error } = await titolare.from("piano_impostazioni").select("mese_apertura").single();
    expect(error).toBeNull();
    expect(data.mese_apertura).toMatch(/^\d{4}-\d{2}-01$/);
  });

  it("lo staff non vede né la voce né le sue rate", async () => {
    const { data: v } = await staff.from("piano_voci").select("id").eq("id", voce.id);
    const { data: r } = await staff.from("piano_rate").select("id").eq("voce_id", voce.id);
    const { data: i } = await staff.from("piano_impostazioni").select("id");
    expect(v ?? []).toEqual([]);
    expect(r ?? []).toEqual([]);
    expect(i ?? []).toEqual([]);
  });

  it("lo staff non scrive una voce", async () => {
    const { error } = await staff
      .from("piano_voci")
      .insert({ gruppo: "A", descrizione: `${MARCA} dello staff`, importo_ivato: 1 });
    // 42501: rifiutato dalla RLS, non da un altro errore qualsiasi.
    expect(error?.code).toBe("42501");
  });

  it("chi non è entrato non vede niente", async () => {
    const { data } = await anonimo.from("piano_voci").select("id").eq("id", voce.id);
    expect(data ?? []).toEqual([]);
  });

  it("un'IVA inventata si rifiuta, dal suo vincolo", async () => {
    const { error } = await titolare.from("piano_voci").update({ aliquota_iva: 7 }).eq("id", voce.id);
    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("piano_voce_aliquota_nota");
  });
});
