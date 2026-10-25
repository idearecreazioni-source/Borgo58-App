import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, righeMie } from "./aiuto";

// Il quaderno dei difetti (25/10/2026, tappa 1 del piano «MEMO che controlla»).
//
// Le tre cose che la verifica dentro la migrazione NON può dimostrare,
// perché lì si gira come proprietari e la RLS non esiste (CLAUDE.md §8):
//
// 1. il titolare scrive e rilegge la propria segnalazione;
// 2. lo staff non la legge e non la scrive (decisione di Alessio: lo staff
//    non segnala, e il testo di una schermata della Cassa ha dentro soldi);
// 3. dopo la nascita si cambiano solo stato ed esito — testo e contesto
//    sono la testimonianza del momento, e il database non li fa toccare.
const MARCA = marchio("TEST-AUTO segnalazione");

describe("il quaderno dei difetti", () => {
  let titolare;
  let staff;
  let mie;
  let id;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    mie = righeMie(titolare);
  });

  afterAll(async () => {
    await mie?.pulisci();
    await titolare?.auth.signOut({ scope: "local" });
    await staff?.auth.signOut({ scope: "local" });
  });

  it("il titolare scrive e rilegge", async () => {
    const { data, error } = await titolare
      .from("segnalazioni")
      .insert({ testo: MARCA, provenienza: "pulsante", schermata: "/cassa", contesto: { larghezza: 390 } })
      .select("id, stato, creata_da")
      .single();
    expect(error).toBeNull();
    id = mie.segna("segnalazioni", data.id);
    expect(data.stato).toBe("nuova");
    expect(data.creata_da).not.toBeNull();

    const { data: letta } = await titolare.from("segnalazioni").select("testo").eq("id", id).single();
    expect(letta.testo).toBe(MARCA);
  });

  it("lo staff non la vede", async () => {
    const { data, error } = await staff.from("segnalazioni").select("id").eq("id", id);
    // Respinto o vuoto: in tutti e due i casi lo staff non legge niente.
    if (!error) expect(data).toEqual([]);
  });

  it("lo staff non la scrive", async () => {
    const { error } = await staff
      .from("segnalazioni")
      .insert({ testo: `${MARCA} staff`, provenienza: "pulsante" });
    expect(error).not.toBeNull();
  });

  it("stato ed esito si cambiano, il testo no", async () => {
    const cambio = await titolare
      .from("segnalazioni")
      .update({ stato: "corretta", esito: "fatto" })
      .eq("id", id);
    expect(cambio.error).toBeNull();

    const testo = await titolare.from("segnalazioni").update({ testo: "riscritto" }).eq("id", id);
    expect(testo.error).not.toBeNull();

    const { data } = await titolare
      .from("segnalazioni")
      .select("testo, stato, esito, aggiornata_il")
      .eq("id", id)
      .single();
    expect(data).toMatchObject({ testo: MARCA, stato: "corretta", esito: "fatto" });
    expect(data.aggiornata_il).not.toBeNull();
  });
});
