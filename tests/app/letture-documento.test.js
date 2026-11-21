import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAnonimo, clientAutenticato, credenziali, righeMie } from "./aiuto";

// Le letture dei documenti dentro al tetto di spesa (pezzo C0, 21/11/2026),
// provate sui dati veri del progetto di prova.
//
// ⚠️ ENTRA DAL COLLEGAMENTO DELL'APP, col token di un utente vero: le
//    migrazioni girano come proprietarie e scavalcano la RLS, quindi solo da
//    qui si vede se la sala può leggere il registro e se il tetto conta la
//    nuova fonte.

const una = (r) => (Array.isArray(r) ? r[0] : r);

describe("le letture dei documenti dentro al tetto", () => {
  let titolare;
  let staff;
  let anonimo;
  let mie;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    anonimo = clientAnonimo();
    mie = righeMie(titolare);
  });

  afterAll(async () => {
    await mie.pulisci();
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
  });

  const spesa = async () => {
    const r = await titolare.rpc("spesa_ai_del_mese");
    expect(r.error).toBeNull();
    return una(r.data);
  };

  it("una lettura di documento entra nella spesa del mese, calcolata dal listino", async () => {
    // ⚠️ I numeri hanno un solo risultato giusto: 1000 token in e 500 out con
    //    Opus 5 (4,60 / 23,00 € per milione) = 0,0046 + 0,0115 = 0,0161.
    //    Solo la domanda darebbe 0,0046, solo la risposta 0,0115.
    const prima = await spesa();
    const { data, error } = await titolare
      .from("letture_documento")
      .insert({ gesto: "trascrizione", modello: "claude-opus-5", token_domanda: 1000, token_risposta: 500 })
      .select("id")
      .single();
    expect(error).toBeNull();
    mie.segna("letture_documento", data.id);

    const dopo = await spesa();
    expect(Number(dopo.speso_euro) - Number(prima.speso_euro)).toBeCloseTo(0.0161, 5);
    expect(dopo.letture - prima.letture).toBe(1);
    expect(dopo.non_calcolabili).toBe(prima.non_calcolabili);
  });

  it("un modello fuori listino non costa zero in silenzio: lo dichiara", async () => {
    const prima = await spesa();
    const { data, error } = await titolare
      .from("letture_documento")
      .insert({ gesto: "proposta", modello: "modello-che-non-esiste", token_domanda: 10, token_risposta: 10 })
      .select("id")
      .single();
    expect(error).toBeNull();
    mie.segna("letture_documento", data.id);

    const dopo = await spesa();
    expect(dopo.non_calcolabili - prima.non_calcolabili).toBe(1);
    expect(Number(dopo.speso_euro)).toBeCloseTo(Number(prima.speso_euro), 5);
  });

  it("un gesto inventato o dei token negativi sono respinti dal database", async () => {
    const gesto = await titolare
      .from("letture_documento")
      .insert({ gesto: "riassunto", modello: "claude-opus-5", token_domanda: 1, token_risposta: 1 });
    expect(gesto.error).not.toBeNull();

    const negativi = await titolare
      .from("letture_documento")
      .insert({ gesto: "trascrizione", modello: "claude-opus-5", token_domanda: -1, token_risposta: 1 });
    expect(negativi.error).not.toBeNull();
  });

  it("il registro delle letture non lo leggono né la sala né chi non è entrato", async () => {
    const dellaSala = await staff.from("letture_documento").select("id").limit(1);
    expect(dellaSala.data ?? []).toHaveLength(0);

    const scrive = await staff
      .from("letture_documento")
      .insert({ gesto: "trascrizione", modello: "claude-opus-5", token_domanda: 1, token_risposta: 1 });
    expect(scrive.error).not.toBeNull();

    const fuori = await anonimo.from("letture_documento").select("id").limit(1);
    expect(fuori.data ?? []).toHaveLength(0);
  });

  it("il conto della spesa resta chiuso da fuori (le due porte del 29/08)", async () => {
    const r = await titolare.rpc("consumi_ai");
    expect(r.error).not.toBeNull();
  });

  it("la chat ricorda i token della cache", async () => {
    // ⚠️ Solo la lettura delle colonne: lo storico della chat non si cancella
    //    (nessuna policy di cancellazione), quindi una prova non puo' scriverci
    //    senza lasciare righe di prova per sempre. Il rifiuto dei numeri
    //    negativi e il blocco delle modifiche li verifica la migrazione.
    const colonne = await titolare.from("memo_messaggi").select("token_cache_lettura, token_cache_scrittura").limit(1);
    expect(colonne.error).toBeNull();
  });
});
