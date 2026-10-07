import { readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, righeMie } from "./aiuto";

// LE BOZZE DI RICETTA, DAL CLIENT, COL TOKEN DI UN UTENTE VERO (Fase 1A).
//
// ⚠️ PERCHÉ QUI E NON SOLO NELLA MIGRAZIONE: la verifica della migrazione
//    gira come proprietaria e scavalca la RLS (§8, 16/08). Che lo staff non
//    veda le bozze e non le confermi si prova solo da qui.
//
// 🔴 OGGI QUESTE PROVE SONO SPENTE, E LO DICONO: la migrazione 20261006000001
//    non è applicata da nessuna parte e il corridoio installato non conosce
//    ancora `promuovi_bozza_ricetta`. Si riaccendono da sole quando la
//    migrazione entra nel progetto di prova — e da quel momento, se il
//    corridoio non è stato reinstallato, la prima prova diventa rossa e dice
//    perché, invece di saltare in silenzio.
const VERSIONE = "20261006000001";

const MIGRAZIONI = readdirSync("supabase/migrations").filter((f) => f.startsWith(`${VERSIONE}_`));
if (MIGRAZIONI.length !== 1) {
  throw new Error(
    `Non trovo UNA migrazione ${VERSIONE} (ne ho trovate ${MIGRAZIONI.length}): le prove ` +
      `delle bozze resterebbero saltate per sempre senza che nessuno lo sappia.`
  );
}

const sonda = await clientAutenticato(credenziali().titolare);
const registro = await sonda.from("applied_migrations").select("version");
await sonda.auth.signOut({ scope: "local" });
if (registro.error) {
  throw new Error(
    `Non riesco a leggere il registro delle migrazioni: ${registro.error.message}. ` +
      `Non tiro a indovinare se le bozze esistono.`
  );
}
// Vuoto non è zero (19/08): un registro vuoto è una lettura che non ha
// funzionato, non «nessuna migrazione».
if ((registro.data ?? []).length === 0) {
  throw new Error("Il registro delle migrazioni è tornato VUOTO: mi fermo invece di saltare.");
}
const APPLICATA = registro.data.some((r) => r.version === VERSIONE);
if (!APPLICATA) {
  console.warn(
    `⚠️  bozze-ricetta: la migrazione ${VERSIONE} non è applicata su questo database, le ` +
      `prove sono SALTATE. Non è un difetto: le tabelle delle bozze non esistono ancora.`
  );
}

const MARCA = marchio("TEST-AUTO bozza");

/** La promozione, dal corridoio vero, come la chiama il gestionale. */
async function promuovi(client, bozzaId, esito, gesto) {
  const r = await client.functions.invoke("operazioni-atomiche", {
    body: {
      operazione: "promuovi_bozza_ricetta",
      parametri: { p_bozza_id: bozzaId, p_esito: esito, p_gesto: gesto },
    },
  });
  if (!r.error) return { dati: r.data?.risultato ?? null, errore: null };
  const corpo = await r.error.context?.json?.().catch(() => null);
  return { dati: null, errore: corpo?.errore ?? { messaggio: r.error.message } };
}

describe.skipIf(!APPLICATA)("le bozze di ricetta, coi permessi veri", () => {
  let titolare;
  let staff;
  let mie;
  let bozza;
  let ingrediente;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    mie = righeMie(titolare);

    // Un ingrediente alimentare GIÀ esistente, solo letto: la prova non ne crea.
    const ing = await titolare.from("ingredients").select("id, unit").eq("alimentare", true).limit(1).single();
    if (ing.error) throw ing.error;
    ingrediente = ing.data;

    const b = await titolare.from("bozze_ricetta").insert({ titolo: MARCA }).select("id").single();
    if (b.error) throw b.error;
    bozza = mie.segna("bozze_ricetta", b.data.id);
    const r = await titolare
      .from("bozze_ricetta_ingredienti")
      .insert({ bozza_id: bozza, posizione: 1, nome: `${MARCA} mai visto`, unita: "cucchiaio" })
      .select("id")
      .single();
    if (r.error) throw r.error;
  });

  afterAll(async () => {
    await mie?.pulisci();
  });

  it("🔴 il corridoio installato conosce l'operazione (altrimenti va reinstallato)", async () => {
    const r = await promuovi(titolare, bozza, "nessuno", crypto.randomUUID());
    expect(
      r.errore?.codice,
      "Il corridoio risponde «operazione sconosciuta»: la migrazione c'è ma la funzione " +
        "online non è stata reinstallata con la riga nuova."
    ).not.toBe("operazione");
  });

  it("🔴 lo staff non vede le bozze, e non le conferma", async () => {
    const letta = await staff.from("bozze_ricetta").select("id").eq("id", bozza);
    expect(letta.error).toBeNull();
    expect(letta.data).toEqual([]);

    const r = await promuovi(staff, bozza, "ispirazione", crypto.randomUUID());
    expect(r.errore).not.toBeNull();
    const ancora = await titolare.from("bozze_ricetta").select("stato").eq("id", bozza).single();
    expect(ancora.data.stato).toBe("in_revisione");
  });

  it("dal browser non si dichiara una bozza promossa", async () => {
    const r = await titolare
      .from("bozze_ricetta")
      .update({ promossa_il: new Date().toISOString() })
      .eq("id", bozza);
    expect(r.error).not.toBeNull();
  });

  it("🔴 coi buchi la conferma si rifiuta, li nomina, e non crea niente", async () => {
    const r = await promuovi(titolare, bozza, "ricetta", crypto.randomUUID());
    expect(r.errore?.messaggio ?? "").toMatch(/manca la categoria/);
    expect(r.errore?.messaggio ?? "").toMatch(/non collegato/);
    expect(r.errore?.messaggio ?? "").toMatch(/quantita' mancante/);

    const ricette = await titolare.from("recipes").select("id").eq("name", MARCA);
    expect(ricette.data).toEqual([]);
    const nati = await titolare.from("ingredients").select("id").eq("name", `${MARCA} mai visto`);
    expect(nati.data).toEqual([]);
    const riga = await titolare.from("bozze_ricetta_ingredienti").select("quantita").eq("bozza_id", bozza).single();
    expect(riga.data.quantita).toBeNull();
  });

  it("🔴 chiusi i buchi: tutto insieme, e il doppio tocco non duplica", async () => {
    await titolare.from("bozze_ricetta").update({ categoria: "primo", porzioni: 2 }).eq("id", bozza);
    await titolare
      .from("bozze_ricetta_ingredienti")
      .update({ ingredient_id: ingrediente.id, quantita: 1, unita: ingrediente.unit })
      .eq("bozza_id", bozza);
    await titolare
      .from("bozze_ricetta_passaggi")
      .insert({ bozza_id: bozza, posizione: 1, fase: "cottura", descrizione: "prova" });

    const gesto = crypto.randomUUID();
    const [uno, due] = await Promise.all([
      promuovi(titolare, bozza, "ricetta", gesto),
      promuovi(titolare, bozza, "ricetta", gesto),
    ]);
    expect(uno.errore).toBeNull();
    expect(due.errore).toBeNull();
    expect(uno.dati.ricetta_id).toBeTruthy();
    expect(due.dati.ricetta_id).toBe(uno.dati.ricetta_id);
    mie.segna("recipes", uno.dati.ricetta_id);

    const ricette = await titolare.from("recipes").select("id").eq("name", MARCA);
    expect(ricette.data).toHaveLength(1);
    const righe = await titolare.from("recipe_ingredients").select("id").eq("recipe_id", uno.dati.ricetta_id);
    expect(righe.data).toHaveLength(1);
    const passi = await titolare.from("recipe_steps").select("id").eq("recipe_id", uno.dati.ricetta_id);
    expect(passi.data).toHaveLength(1);
  });

  it("🔴 un gesto nuovo su una bozza già promossa è rifiutato", async () => {
    const r = await promuovi(titolare, bozza, "ricetta", crypto.randomUUID());
    expect(r.errore?.messaggio ?? "").toMatch(/gia' diventata ricetta/);
    const ricette = await titolare.from("recipes").select("id").eq("name", MARCA);
    expect(ricette.data).toHaveLength(1);
  });

  it("una bozza scartata non si conferma", async () => {
    const b = await titolare.from("bozze_ricetta").insert({ titolo: `${MARCA} scartata` }).select("id").single();
    const id = mie.segna("bozze_ricetta", b.data.id);
    await titolare.from("bozze_ricetta").update({ stato: "scartata" }).eq("id", id);
    const r = await promuovi(titolare, id, "ispirazione", crypto.randomUUID());
    expect(r.errore?.messaggio ?? "").toMatch(/scartata/);
  });
});
