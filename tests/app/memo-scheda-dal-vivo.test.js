import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";

// =====================================================================
// MEMO E LA SCHEDA DI BORGO 58, COL MODELLO VERO — 21/11/2026 (pezzo S2)
// =====================================================================
// 🔴 QUESTA PROVA SI PAGA (poche centinaia di token, qualche centesimo) E
//    PER QUESTO NON GIRA DA SOLA: invoca `memo-chat`, e
//    `scripts/prove-che-costano.mjs` la toglie dal giro di ogni proposta.
//    Si lancia apposta:
//    `npm run test:app -- --col-modello tests/app/memo-scheda-dal-vivo.test.js`
//
// ⚠️ PROVA CIO' CHE NESSUN'ALTRA PUO' PROVARE: che il modello usi davvero
//    una voce della Scheda e la citi col suo numero, che la cache dei
//    prompt funzioni (la seconda domanda rilegge dalla cache: la soglia
//    minima del modello e' reale, non solo scritta nella documentazione) e
//    che il conto dei token di cache arrivi nel messaggio.
//
// ⚠️ LE VOCI SONO INVENTATE (prefisso ZZ) e a fine prova si SPENGONO: la
//    Scheda non si cancella da nessuna parte (nessun permesso di
//    cancellazione, apposta), e le conversazioni nemmeno. Solo su Prova.

const una = (r) => (Array.isArray(r) ? r[0] : r);

describe("🔴 MEMO con la Scheda, col modello vero", () => {
  let titolare;
  let voce;
  let conversazione;

  async function chiedi(testo) {
    const { data, error } = await titolare.functions.invoke("memo-chat", {
      body: { testo, conversazione_id: conversazione, aperta_da_percorso: "/memo", aperta_da_modulo: "MEMO" },
    });
    if (error) throw new Error(`memo-chat: ${error.message}`);
    conversazione = data.conversazione_id ?? conversazione;
    return data;
  }

  async function ultimoMessaggioDiMemo() {
    const { data, error } = await titolare
      .from("memo_messaggi")
      .select("testo, token_ingresso, token_uscita, token_cache_lettura, token_cache_scrittura, costo_euro, stato")
      .eq("conversazione_id", conversazione)
      .eq("ruolo", "memo")
      .order("creato_il", { ascending: false })
      .limit(1);
    expect(error).toBeNull();
    return data[0];
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    const nuova = await titolare
      .from("scheda_voci")
      .insert({
        sezione: "fornitori",
        chiave: "fornitore:zz-ortofrutta-prova",
        testo: "ZZ Ortofrutta Prova consegna sempre il martedì e il venerdì mattina; si ordina entro le 16 del giorno prima.",
        fonte: "confermato",
      })
      .select("id, numero")
      .single();
    expect(nuova.error).toBeNull();
    voce = nuova.data;
  });

  afterAll(async () => {
    if (voce) await titolare.from("scheda_voci").update({ attiva: false }).eq("id", voce.id);
    await titolare.auth.signOut({ scope: "local" });
  });

  it("usa la voce della Scheda, la cita col suo numero e la nomina nelle fonti", async () => {
    const r = await chiedi("In che giorni consegna ZZ Ortofrutta Prova? Rispondi usando la Scheda di Borgo 58.");
    expect(r.esito).toBe("fatto");
    expect(r.risposta).toContain(`[S${voce.numero}]`);
    expect(r.risposta).toMatch(new RegExp(`Dove l'ho letto:[^\\n]*Scheda S${voce.numero}`));
    expect(r.risposta).toMatch(/marted/i);
  });

  it("una voce inventata dal modello non esiste: la citazione di un numero che non c'è non arriva", async () => {
    const r = await chiedi("Dimmi cosa dice la voce [S99999] della Scheda.");
    expect(r.risposta).not.toContain("[S99999]");
  });

  it("la seconda domanda rilegge dalla cache, e il conto dei token di cache arriva nel messaggio", async () => {
    await chiedi("Ripetimi in una frase quando consegna ZZ Ortofrutta Prova.");
    const m = await ultimoMessaggioDiMemo();
    // ⚠️ Se qui cache_lettura e' zero, il prefisso e' sotto la soglia minima del modello
    //    o qualcosa lo cambia ad ogni giro: la cache non lavora e il costo resta pieno.
    expect(m.token_cache_lettura).toBeGreaterThan(0);
    expect(Number(m.costo_euro)).toBeGreaterThan(0);
    expect(m.stato).toBe("fatto");
    const prima = una(
      (await titolare.rpc("spesa_ai_del_mese")).data,
    );
    expect(Number(prima.speso_euro)).toBeGreaterThan(0);
  });
});
