import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";
// Si usa la funzione VERA, non una stringa ricopiata: una prova che
// riscrive il filtro a mano proverebbe la stringa della prova, non quella
// che il gestionale manda davvero.
import { filtroRicerca } from "../../src/lib/calcoli/ricerca";

// Le ricerche che si rompevano con una virgola (piccolezze del mandato di
// correzione).
//
// ⚠️ Perché serve una prova contro un database VERO e non basta quella
// pura: la regola di scrittura del filtro si può congelare in una prova
// pura — e lo è, in tests/unita/ricerca.test.js — ma **che PostgREST
// accetti davvero quella forma** non si legge nel codice: si scopre solo
// chiedendoglielo. La prova pura direbbe verde anche se le virgolette
// fossero il modo sbagliato di racchiudere un valore.
//
// Si cerca su due tabelle NON sorvegliate da deleted_records (clienti e
// prenotazioni): una riga di prova cancellata da una tabella sorvegliata
// lascerebbe una lapide di prova nel registro delle cancellazioni.
const NOME = "TEST-AUTO Rossi, Mario (il \"Circolo\")";
const TELEFONO = "+390000000199";

describe("una virgola nella ricerca non rompe piu' niente", () => {
  let titolare;
  let clienteId;

  async function pulisci() {
    const { data } = await titolare.from("customers").select("id").eq("phone", TELEFONO);
    for (const c of data ?? []) await titolare.from("customers").delete().eq("id", c.id);
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    await pulisci();
    const { data, error } = await titolare
      .from("customers")
      .insert({ name: NOME, phone: TELEFONO })
      .select("id")
      .single();
    if (error) throw new Error(`Non riesco a creare il cliente di prova: ${error.message}`);
    clienteId = data.id;
  });

  afterAll(async () => {
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
  });

  // Il caso che rompeva: la virgola separa le condizioni di un filtro
  // «o questo o quello», quindi finiva nel filtro come se fosse sintassi.
  it("trova un nome che contiene una virgola, invece di dare errore", async () => {
    const { data, error } = await titolare
      .from("customers")
      .select("id")
      .eq("active", true)
      .or(filtroRicerca(["name", "phone"], "Rossi, Mario"));
    expect(error).toBeNull();
    expect(data.map((r) => r.id)).toContain(clienteId);
  });

  it("regge anche virgolette e parentesi dentro il termine", async () => {
    const { data, error } = await titolare
      .from("customers")
      .select("id")
      .or(filtroRicerca(["name"], '(il "Circolo")'));
    expect(error).toBeNull();
    expect(data.map((r) => r.id)).toContain(clienteId);
  });

  // Al contrario: senza virgolette la stessa ricerca deve fallire. Se un
  // giorno PostgREST cominciasse ad accettarla, questa prova diventa
  // rossa e ci si chiede se l'escape serve ancora — invece di lasciare in
  // giro una cura senza piu' malattia.
  it("senza virgolette lo stesso termine rompe ancora il filtro", async () => {
    const { error } = await titolare
      .from("customers")
      .select("id")
      .or("name.ilike.%Rossi, Mario%,phone.ilike.%Rossi, Mario%");
    expect(error).not.toBeNull();
  });

  it("le prenotazioni si cercano con la stessa regola", async () => {
    const { error } = await titolare
      .from("reservations")
      .select("id")
      .or(filtroRicerca(["customer_name", "customer_phone", "customer_email"], "Rossi, Mario"));
    expect(error).toBeNull();
  });
});
