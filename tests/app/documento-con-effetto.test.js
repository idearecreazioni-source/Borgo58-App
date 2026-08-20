import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, corridoioInstallato, credenziali, denunciaSaltiCorridoio, primaEntita } from "./aiuto";

// Blocco 1 del mandato di correzione: un documento che ha generato un
// effetto altrove o è respinto, o storna anche l'effetto. Non esiste il
// terzo caso — il documento sparisce e l'effetto resta.
//
// Questo file tiene fermo il giro come lo fa il browser: attraverso il
// CORRIDOIO, non chiamando la funzione del database. La migrazione prova
// le funzioni; qui si prova che siano davvero raggiungibili da dove le
// chiama la schermata — un'operazione non ammessa nell'elenco del
// corridoio risponde 404 e nessuna prova sul database se ne accorge.
//
// ⚠️ COSA NON C'È QUI, e perché: i due esemplari su fattura fornitore e
// cessione intercompany stanno solo dentro la migrazione. Provarli da qui
// vorrebbe dire creare e poi cancellare fatture e cessioni, cioè lasciare
// lapidi di prova in `deleted_records`, che è la cosa che le prove non
// devono fare (tests/app/LEGGIMI.md). La migrazione gira come proprietaria
// e si ripulisce anche quel registro.
const MARCA = "TEST-AUTO effetto";
const ANNO = 2094;

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);
// ⚠️ La sentinella sta in OGNI file che salta prove, non in uno solo: chi
// lancia solo questo file deve vedere che ci sono prove che non sono partite.
await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);

describe("un documento che ha generato un effetto non si cancella e basta", () => {
  let titolare;
  let ente;
  let tagId;

  const corridoio = (operazione, parametri) =>
    titolare.functions.invoke("operazioni-atomiche", { body: { operazione, parametri } });

  async function pulisci() {
    // ⚠️ Prima le note, poi i movimenti: finché una nota punta a un
    // movimento, il movimento non si cancella — è la regola che questo
    // file verifica, e vale anche per la pulizia della prova.
    await titolare
      .from("anticipazioni_socio")
      .delete()
      .gte("pagata_il", `${ANNO}-01-01`)
      .lte("pagata_il", `${ANNO}-12-31`);
    await titolare
      .from("cash_movements")
      .delete()
      .gte("movement_date", `${ANNO}-01-01`)
      .lte("movement_date", `${ANNO}-12-31`);
    await titolare.from("tag_anticipazioni").delete().eq("etichetta", MARCA);
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    ente = await primaEntita(titolare);
    await pulisci();
    const { data } = await titolare
      .from("tag_anticipazioni")
      .insert({ etichetta: MARCA })
      .select()
      .single();
    tagId = data.id;
    // Serve contante nel cassetto: il rimborso non può superarlo.
    await titolare.from("cash_movements").insert({
      entity_id: ente,
      direction: "entrata",
      amount: 900,
      movement_date: `${ANNO}-01-05`,
      mezzo: "cassa",
      business_purpose: `${MARCA} fondo`,
    });
  });

  afterAll(async () => {
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
    await sonda.auth.signOut({ scope: "local" });
  });

  async function notaRimborsata(importo, giorno) {
    const { data: nota } = await titolare
      .from("anticipazioni_socio")
      .insert({
        entity_id: ente,
        importo,
        pagata_il: `${ANNO}-02-${giorno}`,
        tag_id: tagId,
        nota: MARCA,
      })
      .select()
      .single();
    const { error } = await corridoio("pareggia_anticipazione", {
      p_anticipazione_id: nota.id,
      p_data: `${ANNO}-02-${giorno}`,
    });
    expect(error).toBeNull();
    return nota.id;
  }

  it.skipIf(!CORRIDOIO)("una nota già rimborsata non si cancella, e il rifiuto dice perché", async () => {
    const id = await notaRimborsata(30, "10");

    const { error } = await corridoio("delete_anticipazione", { p_anticipazione_id: id });
    expect(error, "una nota rimborsata si è lasciata cancellare").toBeTruthy();

    // La nota è ancora lì, e l'uscita del rimborso pure: un rifiuto non
    // deve fare mezzo lavoro.
    const { data: nota } = await titolare
      .from("anticipazioni_socio")
      .select("pareggiata_il, movimento_id")
      .eq("id", id)
      .single();
    expect(nota.pareggiata_il).toBeTruthy();
    const { data: mov } = await titolare
      .from("cash_movements")
      .select("id")
      .eq("id", nota.movimento_id)
      .maybeSingle();
    expect(mov).toBeTruthy();
  });

  it.skipIf(!CORRIDOIO)("nemmeno il rimborso si cancella da Prima Nota, ed è la stessa regola allo specchio", async () => {
    const { data: nota } = await titolare
      .from("anticipazioni_socio")
      .select("movimento_id")
      .eq("nota", MARCA)
      .not("movimento_id", "is", null)
      .limit(1)
      .single();

    const { error } = await titolare
      .from("cash_movements")
      .delete()
      .eq("id", nota.movimento_id);
    expect(error, "il rimborso si è lasciato togliere lasciando la nota pareggiata").toBeTruthy();

    const { data: ancora } = await titolare
      .from("cash_movements")
      .select("id")
      .eq("id", nota.movimento_id)
      .maybeSingle();
    expect(ancora).toBeTruthy();
  });

  it.skipIf(!CORRIDOIO)("annullando il rimborso l'uscita sparisce, la nota torna aperta, e allora si cancella", async () => {
    const id = await notaRimborsata(25, "11");
    const { data: prima } = await titolare
      .from("anticipazioni_socio")
      .select("movimento_id")
      .eq("id", id)
      .single();

    const { error: err1 } = await corridoio("annulla_pareggio_anticipazione", {
      p_anticipazione_id: id,
    });
    expect(err1).toBeNull();

    const { data: dopo } = await titolare
      .from("anticipazioni_socio")
      .select("pareggiata_il, movimento_id")
      .eq("id", id)
      .single();
    expect(dopo.pareggiata_il).toBeNull();
    expect(dopo.movimento_id).toBeNull();

    const { data: mov } = await titolare
      .from("cash_movements")
      .select("id")
      .eq("id", prima.movimento_id)
      .maybeSingle();
    expect(mov, "l'uscita del rimborso è rimasta in prima nota").toBeFalsy();

    // Ora la nota è tornata un documento senza effetti: si cancella.
    const { error: err2 } = await corridoio("delete_anticipazione", { p_anticipazione_id: id });
    expect(err2).toBeNull();
    const { data: sparita } = await titolare
      .from("anticipazioni_socio")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    expect(sparita).toBeFalsy();
  });
});
