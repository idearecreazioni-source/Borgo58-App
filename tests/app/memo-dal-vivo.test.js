import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";

// =====================================================================
// MEMO DAL VIVO, COL MODELLO VERO — 11/09/2026
// =====================================================================
// 🔴 QUESTA PROVA SI PAGA, E PER QUESTO NON GIRA DA SOLA: invoca
//    `ascolta-voce`, e `scripts/prove-che-costano.mjs` la toglie dal giro
//    di ogni proposta senza che nessuno debba ricordarselo. Si lancia
//    apposta: `npm run test:app -- --col-modello tests/app/memo-dal-vivo.test.js`.
//
// ⚠️ È L'UNICA CHE PROVA CIÒ CHE NESSUN'ALTRA PUÒ PROVARE: che il modello,
//    sentendo la frase, restituisca davvero un'azione per appuntamento con
//    la sua ora, e il PEZZO di frase che permette di separare una frase
//    mista. Le altre prove partono dalle azioni già scritte.
//
// ⚠️ NIENTE VIENE APPROVATO: in Agenda non entra niente. Si toglie tutto
//    per identificativo della dettatura.

describe("🔴 MEMO col modello vero", () => {
  let titolare;
  const dettature = [];

  async function parla(testo) {
    const { data, error } = await titolare.functions.invoke("ascolta-voce", { body: { testo } });
    if (error) throw new Error(`ascolta-voce: ${error.message}`);
    if (data?.dettatura_id) dettature.push(data.dettatura_id);
    const { data: azioni, error: e2 } = await titolare.rpc("azioni_della_dettatura", {
      p_id: data.dettatura_id,
    });
    if (e2) throw e2;
    return azioni ?? [];
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
  });

  afterAll(async () => {
    if (dettature.length) {
      const { data: az } = await titolare
        .from("azioni_dettate")
        .select("id, appunto_id")
        .in("dettatura_id", dettature);
      const idAz = (az ?? []).map((r) => r.id);
      const idAp = [...new Set((az ?? []).map((r) => r.appunto_id))];
      if (idAz.length) await titolare.from("azioni_dettate").delete().in("id", idAz);
      if (idAp.length) await titolare.from("appunti_vocali").delete().in("id", idAp);
      await titolare.from("dettature").delete().in("id", dettature);
    }
    await titolare.auth.signOut({ scope: "local" });
  });

  it("tre appuntamenti con ore diverse: tre promemoria, ognuno con la SUA ora nel campo ora", async () => {
    const azioni = await parla(
      "Lunedì prossimo alle 10 ho il dentista. Martedì alle 15 e 30 c'è la riunione col " +
        "commercialista. Mercoledì mattina devo ritirare le tovaglie in lavanderia.",
    );
    expect(azioni.map((a) => a.tipo)).toEqual(["promemoria", "promemoria", "promemoria"]);
    const ore = azioni.map((a) => a.dati?.ora ?? null);
    expect(ore[0]).toBe("10:00");
    expect(ore[1]).toBe("15:30");
    // «mattina» non è un'ora: non si inventa.
    expect(ore[2]).toBeNull();
  });

  it("frase mista: gli appuntamenti nuovi restano NUOVI, lo spostamento no", async () => {
    const azioni = await parla(
      "Ricordami il dentista lunedì alle 10, la riunione col commercialista martedì alle 15, " +
        "e sposta a venerdì l'ordine delle verdure.",
    );
    const nuovi = azioni.filter((a) => a.tipo === "promemoria");
    expect(nuovi.map((a) => a.dati?.ora)).toEqual(["10:00", "15:00"]);
    // Lo spostamento c'è, e non è diventato un impegno nuovo. In Agenda
    // l'ordine delle verdure non esiste, quindi il database lo segna «quale
    // impegno?» — oppure resta da spostare, se un giorno ci fosse.
    const altri = azioni.filter((a) => a.tipo !== "promemoria");
    expect(altri).toHaveLength(1);
    expect(["agenda_da_spostare", "agenda_quale_impegno"]).toContain(altri[0].tipo);
  });
});
