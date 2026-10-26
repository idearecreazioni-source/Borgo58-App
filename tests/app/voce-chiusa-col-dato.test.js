import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, righeMie } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import { createCashMovement } from "../../src/lib/api/cash";
import { aggiungiSpesaSpicciola } from "../../src/lib/api/spesaSpicciola";

// =====================================================================
// LA VOCE SI CHIUDE INSIEME AL DATO — il giro intero, dal client vero
// 26/10/2026 (20261026000002)
// =====================================================================
// 🔴 Il difetto che questa prova sorveglia: una cosa detta a MEMO e finita
//    a mano si salvava in due chiamate, e un errore fra le due lasciava il
//    movimento scritto e la cosa ancora «da fare». La volta dopo, lo stesso
//    movimento due volte in prima nota.
//
// Qui si prova dal client vero, attraverso il corridoio installato sul
// progetto di prova: il movimento e la chiusura stanno insieme, e la
// seconda volta viene rifiutata SENZA scrivere niente.
//
// ⚠️ PASSA DAL COLLEGAMENTO DELL'APP (`supabase`), come `uscita-a-mano`:
//    le funzioni di `api/` usano quello.

describe("la voce si chiude insieme al dato", () => {
  let titolare;
  let mie;
  let entita;

  const nuovaAzione = async (tipo, frase) => {
    const { data: dett, error: e1 } = await titolare
      .from("dettature")
      .insert({ testo: `TEST-AUTO ${frase}`, provenienza: "app", esito: "capita" })
      .select("id")
      .single();
    if (e1) throw e1;
    mie.segna("dettature", dett.id);
    const { data: az, error: e2 } = await titolare
      .from("azioni_dettate")
      .insert({
        dettatura_id: dett.id,
        progressivo: 1,
        tipo,
        dati: {},
        sicuro: true,
        frase: `TEST-AUTO ${frase}`,
        motivo: "prova",
        stato: "in_attesa",
      })
      .select("id")
      .single();
    if (e2) throw e2;
    mie.segna("azioni_dettate", az.id);
    return az.id;
  };

  const statoDi = async (id) => {
    const { data } = await titolare.from("azioni_dettate").select("stato").eq("id", id).single();
    return data?.stato;
  };

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    await supabase.auth.signInWithPassword(credenziali().titolare);
    mie = righeMie(titolare);
    const { data, error } = await titolare.from("entities").select("id").eq("entity_type", "srls").single();
    if (error) throw error;
    entita = data.id;
  });

  afterAll(async () => {
    await mie?.pulisci();
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  });

  it("🔴 il movimento e la chiusura insieme, e la seconda volta niente", async () => {
    const azione = await nuovaAzione("movimento_cassa", "uscita di 4,56 dalla voce");
    const movimento = {
      entity_id: entita,
      direction: "uscita",
      amount: 4.56,
      movement_date: new Date().toISOString().slice(0, 10),
      note: `TEST-AUTO voce ${azione}`,
    };

    const scritto = await createCashMovement(movimento, { azioneDettataId: azione });
    mie.segna("cash_movements", scritto.id);
    expect(Number(scritto.amount)).toBe(4.56);
    expect(await statoDi(azione)).toBe("fatta_a_mano");

    // La stessa cosa detta una seconda volta: rifiutata, e nessun movimento in più.
    await expect(createCashMovement(movimento, { azioneDettataId: azione })).rejects.toThrow();
    const { count } = await titolare
      .from("cash_movements")
      .select("id", { count: "exact", head: true })
      .eq("note", movimento.note);
    expect(count).toBe(1);
  });

  it("una spesa spicciola detta si scrive e si chiude insieme", async () => {
    const azione = await nuovaAzione("spesa_spicciola", "carta da forno dalla voce");
    const scritta = await aggiungiSpesaSpicciola(
      { articolo: `TEST-AUTO carta ${azione.slice(0, 8)}`, categoria: null },
      { azioneDettataId: azione },
    );
    mie.segna("spesa_spicciola", scritta.id);
    expect(scritta.articolo).toContain("TEST-AUTO carta");
    expect(await statoDi(azione)).toBe("fatta_a_mano");
  });

  it("una cosa detta di un altro tipo non si chiude con un movimento, e non scrive", async () => {
    const azione = await nuovaAzione("spesa_spicciola", "tipo sbagliato");
    const nota = `TEST-AUTO tipo sbagliato ${azione}`;
    await expect(
      createCashMovement(
        { entity_id: entita, direction: "uscita", amount: 1, movement_date: new Date().toISOString().slice(0, 10), note: nota },
        { azioneDettataId: azione },
      ),
    ).rejects.toThrow(/non si finisce da questa schermata/);
    expect(await statoDi(azione)).toBe("in_attesa");
    const { count } = await titolare
      .from("cash_movements")
      .select("id", { count: "exact", head: true })
      .eq("note", nota);
    expect(count).toBe(0);
  });
});
