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

// L'immagine della pagina (28/10/2026, 20261028000004): la strada che fa
// «Segnala» — prima il file nel deposito, poi la riga che lo nomina.
// ⚠️ La regola restrittiva si prova su un file CHE C'È: lo staff non lo
//    scarica, e la colonna dell'immagine non si riscrive dopo.
describe("la segnalazione con l'immagine della pagina", () => {
  const CASSETTO = "documents";
  const DOVE = `segnalazioni/${crypto.randomUUID()}.jpg`;
  const IMMAGINE = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });
  let titolare;
  let staff;
  let mie;
  let caricata = false;
  let idConImmagine;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    mie = righeMie(titolare);
  });

  afterAll(async () => {
    await mie?.pulisci();
    if (caricata) await titolare?.storage.from(CASSETTO).remove([DOVE]);
    await titolare?.auth.signOut({ scope: "local" });
    await staff?.auth.signOut({ scope: "local" });
  });

  it("🔴 il titolare carica l'immagine e la segnalazione la nomina", async () => {
    const su = await titolare.storage
      .from(CASSETTO)
      .upload(DOVE, IMMAGINE, { upsert: false, contentType: "image/jpeg" });
    expect(su.error?.message ?? null, "il deposito ha respinto l'immagine").toBeNull();
    caricata = true;

    const { data, error } = await titolare
      .from("segnalazioni")
      .insert({ testo: `${MARCA} con immagine`, provenienza: "pulsante", immagine_path: DOVE })
      .select("id, immagine_path")
      .single();
    expect(error).toBeNull();
    idConImmagine = mie.segna("segnalazioni", data.id);
    expect(data.immagine_path).toBe(DOVE);

    const firmato = await titolare.storage.from(CASSETTO).createSignedUrl(DOVE, 60);
    expect(firmato.error).toBeNull();
  });

  it("🔴 lo staff non scarica l'immagine", async () => {
    expect(caricata, "manca l'immagine: la prova sopra non è passata").toBe(true);
    const { data, error } = await staff.storage.from(CASSETTO).download(DOVE);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("l'immagine non si riscrive dopo, e fuori dalla sua cartella non entra", async () => {
    expect(idConImmagine, "manca la segnalazione con l'immagine").toBeTruthy();
    const riscritta = await titolare
      .from("segnalazioni")
      .update({ immagine_path: `segnalazioni/${crypto.randomUUID()}.jpg` })
      .eq("id", idConImmagine);
    expect(riscritta.error).not.toBeNull();
    const fuori = await titolare
      .from("segnalazioni")
      .insert({ testo: `${MARCA} fuori posto`, provenienza: "pulsante", immagine_path: "da-collocare/x.jpg" })
      .select("id")
      .single();
    if (fuori.data) mie.segna("segnalazioni", fuori.data.id);
    expect(fuori.error).not.toBeNull();
  });
});
