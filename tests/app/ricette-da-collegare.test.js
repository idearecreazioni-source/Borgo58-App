import { readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, righeMie } from "./aiuto";

// GLI INGREDIENTI «DA COLLEGARE», DAL CLIENT, COI PERMESSI VERI — 25/10/2026.
//
// ⚠️ La verifica della migrazione 20261025000020 gira come proprietaria e
//    scavalca la RLS (§8, 16/08): che lo staff legga ma non scriva, e che
//    collegare passi davvero dal corridoio, si prova solo da qui.
//
// ⚠️ SPENTE FINCHÉ LA MIGRAZIONE NON È SUL PROGETTO DI PROVA, e lo dicono.
const VERSIONE = "20261025000020";

const MIGRAZIONI = readdirSync("supabase/migrations").filter((f) => f.startsWith(`${VERSIONE}_`));
if (MIGRAZIONI.length !== 1) {
  throw new Error(`Non trovo UNA migrazione ${VERSIONE} (ne ho trovate ${MIGRAZIONI.length}).`);
}

const sonda = await clientAutenticato(credenziali().titolare);
const registro = await sonda.from("applied_migrations").select("version");
await sonda.auth.signOut({ scope: "local" });
if (registro.error) throw new Error(`Non riesco a leggere il registro delle migrazioni: ${registro.error.message}`);
if ((registro.data ?? []).length === 0) {
  throw new Error("Il registro delle migrazioni è tornato VUOTO: mi fermo invece di saltare.");
}
const APPLICATA = registro.data.some((r) => r.version === VERSIONE);
if (!APPLICATA) {
  console.warn(`⚠️  ricette-da-collegare: la migrazione ${VERSIONE} non è applicata qui, prove SALTATE.`);
}

const MARCA = marchio("TEST-AUTO da collegare");

async function collega(client, riga, ingrediente) {
  const r = await client.functions.invoke("operazioni-atomiche", {
    body: { operazione: "collega_ingrediente_ricetta", parametri: { p_riga: riga, p_ingredient_id: ingrediente } },
  });
  if (!r.error) return { dati: r.data?.risultato ?? null, errore: null };
  const corpo = await r.error.context?.json?.().catch(() => null);
  return { dati: null, errore: corpo?.errore ?? { messaggio: r.error.message } };
}

describe.skipIf(!APPLICATA)("le ricette con ingredienti da collegare, coi permessi veri", () => {
  let titolare;
  let staff;
  let mie;
  let ricetta;
  let riga;
  let ingrediente;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    mie = righeMie(titolare);

    // Un ingrediente alimentare GIÀ esistente, solo letto: la prova non ne crea.
    const ing = await titolare.from("ingredients").select("id, unit").eq("alimentare", true).limit(1).single();
    if (ing.error) throw ing.error;
    ingrediente = ing.data;

    const r = await titolare
      .from("recipes")
      .insert({ name: MARCA, category: "primo", portions_yield: 2 })
      .select("id")
      .single();
    if (r.error) throw r.error;
    ricetta = mie.segna("recipes", r.data.id);

    // Le righe se ne vanno con la ricetta (cascata): non serve segnarle.
    const d = await titolare
      .from("ricetta_ingredienti_da_collegare")
      .insert({ recipe_id: ricetta, posizione: 1, nome: `${MARCA} farina` })
      .select("id")
      .single();
    if (d.error) throw d.error;
    riga = d.data.id;
  });

  afterAll(async () => {
    await mie?.pulisci();
  });

  it("🔴 il corridoio installato conosce l'operazione (altrimenti va reinstallato)", async () => {
    const r = await collega(titolare, crypto.randomUUID(), ingrediente.id);
    expect(r.errore?.codice).not.toBe("operazione");
  });

  it("🔴 lo staff le legge ma non le scrive, e non le collega", async () => {
    const letta = await staff.from("ricetta_ingredienti_da_collegare").select("nome").eq("id", riga);
    expect(letta.error).toBeNull();
    expect(letta.data).toHaveLength(1);

    const ins = await staff
      .from("ricetta_ingredienti_da_collegare")
      .insert({ recipe_id: ricetta, posizione: 2, nome: `${MARCA} dello staff` });
    expect(ins.error).not.toBeNull();

    await staff.from("ricetta_ingredienti_da_collegare").update({ nome: "cambiato" }).eq("id", riga);
    await staff.from("ricetta_ingredienti_da_collegare").delete().eq("id", riga);
    const r = await collega(staff, riga, ingrediente.id);
    expect(r.errore).not.toBeNull();

    const dopo = await titolare.from("ricetta_ingredienti_da_collegare").select("nome").eq("id", riga).single();
    expect(dopo.data?.nome).toBe(`${MARCA} farina`);
  });

  it("🔴 non si segna pronta per la carta, e il rifiuto nomina l'ingrediente", async () => {
    const r = await titolare.from("recipes").update({ pronta_per_carta: true }).eq("id", ricetta);
    expect(r.error?.message ?? "").toMatch(/farina/);
    const ancora = await titolare.from("recipes").select("pronta_per_carta").eq("id", ricetta).single();
    expect(ancora.data.pronta_per_carta).toBe(false);
  });

  it("🔴 senza quantità non si collega, e la riga resta", async () => {
    const r = await collega(titolare, riga, ingrediente.id);
    expect(r.errore?.messaggio ?? "").toMatch(/quantita'/);
    const resta = await titolare.from("ricetta_ingredienti_da_collegare").select("id").eq("id", riga);
    expect(resta.data).toHaveLength(1);
  });

  it("🔴 con quantità e unità si collega: la riga passa fra gli ingredienti veri", async () => {
    const u = await titolare
      .from("ricetta_ingredienti_da_collegare")
      .update({ quantita: 0.25, unita: ingrediente.unit })
      .eq("id", riga);
    expect(u.error).toBeNull();

    const r = await collega(titolare, riga, ingrediente.id);
    expect(r.errore).toBeNull();
    expect(r.dati?.ancora_da_collegare).toBe(0);

    const via = await titolare.from("ricetta_ingredienti_da_collegare").select("id").eq("id", riga);
    expect(via.data).toEqual([]);
    const vere = await titolare
      .from("recipe_ingredients")
      .select("ingredient_id, quantity")
      .eq("recipe_id", ricetta);
    expect(vere.data).toEqual([{ ingredient_id: ingrediente.id, quantity: 0.25 }]);
  });
});
