import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, righeMie } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import { azioneAMano, chiudiAMano, confermaAzione } from "../../src/lib/api/voce";
import { indirizzoAMano } from "../../src/lib/calcoli/aMano";

// =====================================================================
// LA VIA D'USCITA A MANO — il giro intero, dal client vero
// =====================================================================
// 🔴 Decisione di Alessio del 27/08, sue parole: *«se ti dico segna trenta
//    euro pagati al fornitore, mi aspetto che un collegamento mi porti dove
//    si segnano le spese, coi campi noti già compilati, e io aggiungo solo
//    il nome del fornitore che ho omesso»*.
//
// 🔴 IL DIFETTO PEGGIORE DEL BLOCCO, e questa prova esiste per lui: se la
//    riga NON si chiudesse dopo essere stata fatta a mano, resterebbe in
//    sospeso — e la volta dopo Alessio la ridice a voce o preme «Sì, fallo».
//    **La stessa spesa in cassa due volte**, e non se ne accorge nessuno
//    finché il saldo non torna.
//
// ⚠️ PASSA DAL COLLEGAMENTO DELL'APP (`supabase`), non da un client
//    proprio: è la lezione del 18/08 — le funzioni di `api/` usano quel
//    collegamento, e con uno suo la prova parlerebbe da anonima e
//    misurerebbe un'altra cosa.

const TESTO = "TEST-AUTO ho pagato trenta euro al fornitore";

describe("ogni riga in sospeso ha la sua via d'uscita a mano", () => {
  let titolare;
  let mie;
  let azione;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    // ⚠️ Le funzioni di `api/voce.js` passano dal collegamento dell'app.
    await supabase.auth.signInWithPassword(credenziali().titolare);
    mie = righeMie(titolare);

    const { data: dett, error: e1 } = await titolare
      .from("dettature")
      .insert({ testo: TESTO, provenienza: "app", esito: "capita" })
      .select("id")
      .single();
    if (e1) throw e1;
    mie.segna("dettature", dett.id);

    // Il caso di Alessio parola per parola: importo e verso ci sono, il
    // fornitore no.
    const { data: az, error: e2 } = await titolare
      .from("azioni_dettate")
      .insert({
        dettatura_id: dett.id,
        progressivo: 1,
        tipo: "movimento_cassa",
        dati: { verso: "uscita", importo: "30", mezzo: "cassa" },
        sicuro: true,
        frase: "Uscita di 30,00 € dalla cassa",
        motivo: "Questa la guardi sempre tu.",
        stato: "in_attesa",
      })
      .select("id")
      .single();
    if (e2) throw e2;
    mie.segna("azioni_dettate", az.id);
    azione = az.id;
  });

  afterAll(async () => {
    // ⚠️ Solo le righe che questa prova ha creato, per identificativo e in
    //    ordine inverso (regola del 23/08, nata da uno sconto vero
    //    cancellato da uno script che pescava «la più recente»).
    await mie?.pulisci();
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  });

  it("porta alla prima nota, coi campi già capiti e senza inventare il resto", async () => {
    const a = await azioneAMano(azione);
    expect(a.percorso).toBe("/cassa/prima-nota");
    expect(a.campi.importo).toBe("30");
    expect(a.campi.verso).toBe("uscita");
    // 🔴 Quello che NON è stato detto resta VUOTO: è il pezzo che Alessio
    //    va ad aggiungere, ed è il motivo per cui ci sta andando.
    expect(a.campi.causale).toBeUndefined();
    expect(a.campi.descrizione).toBeUndefined();
    expect(a.da_finire).toBe(true);
    // E l'indirizzo non porta in giro l'importo.
    expect(indirizzoAMano(a.percorso, azione)).not.toMatch(/30/);
  });

  it("finita a mano, smette di aspettare", async () => {
    await chiudiAMano(azione);
    const { data } = await titolare
      .from("azioni_dettate")
      .select("stato, eseguita_il")
      .eq("id", azione)
      .single();
    expect(data.stato).toBe("fatta_a_mano");
    // Una cosa fatta ha l'ora in cui è stata fatta, come le eseguite.
    expect(data.eseguita_il).not.toBeNull();
  });

  it("e sparisce dall'elenco di quelle che aspettano", async () => {
    const { data } = await titolare.rpc("azioni_dettate_in_attesa");
    expect((data ?? []).some((r) => r.id === azione)).toBe(false);
    const { data: quante } = await titolare.rpc("voce_da_guardare");
    const r = Array.isArray(quante) ? quante[0] : quante;
    expect(r).toBeDefined();
  });

  // 🔴 LA PROVA CHE VALE PIÙ DI TUTTE. Senza questo rifiuto la stessa spesa
  //    entrerebbe in cassa DUE VOLTE: una scritta da Alessio nella
  //    schermata, una dal gestionale premendo «Sì, fallo» su una riga
  //    rimasta aperta in un'altra scheda del browser.
  it("NON si può più eseguire: la stessa spesa non entra due volte", async () => {
    await expect(confermaAzione(azione)).rejects.toThrow(/due volte/i);
  });

  it("e nemmeno richiudere una seconda volta", async () => {
    // ⚠️ `gi[àa]'?` e non «già»: i messaggi SQL di questo progetto scrivono
    //    gli accenti con l'apostrofo (`gia'`), ed è la convenzione che
    //    evita la trappola del 18/08 sulla codifica. La prova si adegua al
    //    codice, non il contrario.
    await expect(chiudiAMano(azione)).rejects.toThrow(/gi[àa]'? finita a mano/i);
  });
});
