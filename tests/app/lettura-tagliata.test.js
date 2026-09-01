import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { credenziali, marchio } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import { dimenticaLettureTagliate, elencoLettureTagliate, letturaTagliata } from "../../src/lib/lettureTagliate";

// IL TAGLIO A MILLE RIGHE — provato SOPRA le mille, che è l'unico posto
// dove si può provare.
//
// 🔴 Chiedendo un elenco senza dire quante righe si vogliono, il database ne
// consegna al massimo mille e **non lo dice**. Provarlo sotto le mille non
// proverebbe niente: qualunque codice, anche uno che non guarda proprio,
// passerebbe. Per questo la prova **si costruisce le sue milleduecento
// righe** e le toglie alla fine.
//
// ⚠️ E LA PROVA ENTRA DAL COLLEGAMENTO DELL'APP, non da uno suo. È la
// lezione del 18/08 (le funzioni della sala usavano il collegamento
// dell'app e la prova ne aveva aperto un altro, quindi parlava da anonima):
// qui il riconoscimento vive DENTRO quel collegamento, e una prova con un
// client proprio non lo eserciterebbe affatto — passerebbe verde su un
// difetto intatto.
// ⚠️ IL MARCHIO E' DI QUESTO GIRO, dal 01/09/2026: le pulizie e i
//    conteggi qui sotto usano questo valore in un modello `like`, e con
//    un valore fisso due esecuzioni insieme sullo stesso progetto di
//    prova si cancellano e si contano le righe a vicenda. Vedi la nota
//    in cima a `aiuto.js`.
const MARCA = marchio("TEST-AUTO taglio");
const QUANTE = 1200;

describe("una lettura tagliata si denuncia", () => {
  beforeAll(async () => {
    const cred = credenziali();
    const { error } = await supabase.auth.signInWithPassword({
      email: cred.titolare.email,
      password: cred.titolare.password,
    });
    expect(error, "il collegamento dell'app non è riuscito ad entrare").toBeNull();

    await supabase.from("tasks").delete().like("title", `${MARCA}%`);
    // Una scrittura sola: milleduecento righe in una richiesta.
    const righe = Array.from({ length: QUANTE }, (_, i) => ({
      title: `${MARCA} ${i}`,
      status: "da_fare",
      visibile_staff: false,
    }));
    const { error: eIns } = await supabase.from("tasks").insert(righe);
    expect(eIns, "non sono riuscito a creare le righe della prova").toBeNull();
  });

  afterAll(async () => {
    await supabase.from("tasks").delete().like("title", `${MARCA}%`);
    dimenticaLettureTagliate();
    // `scope: "local"`, mai globale: una disconnessione globale butterebbe
    // fuori gli altri file di prova a metà corsa (§8).
    await supabase.auth.signOut({ scope: "local" });
  });

  it("legge meno righe di quelle che ci sono, e lo dichiara", async () => {
    dimenticaLettureTagliate();
    const { data, error } = await supabase.from("tasks").select("id");
    expect(error).toBeNull();

    // Il taglio c'è davvero: meno righe di quelle create.
    expect(data.length, "il database ha consegnato tutto: la prova non discrimina").toBeLessThan(QUANTE);

    // E il gestionale se n'è accorto.
    const tagliate = elencoLettureTagliate();
    const suTasks = tagliate.find((t) => t.dove === "tasks");
    expect(suTasks, `nessuna lettura denunciata (viste: ${JSON.stringify(tagliate)})`).toBeTruthy();
    expect(suTasks.ricevute).toBe(data.length);
    expect(suTasks.totali).toBeGreaterThanOrEqual(QUANTE);
    expect(letturaTagliata("tasks")).toBe(true);
  });

  it("...e NON si lamenta quando chi legge ha detto quante righe vuole", async () => {
    // ⚠️ La seconda metà, senza la quale la prima non prova niente: un
    // codice che gridasse sempre passerebbe la prova qui sopra. Chi scrive
    // `.limit()` sa già di volerne una parte, e un allarme lì sarebbe un
    // allarme falso permanente — cioè un allarme che si impara a spegnere.
    dimenticaLettureTagliate();
    const { error } = await supabase.from("tasks").select("id").limit(10);
    expect(error).toBeNull();
    expect(elencoLettureTagliate(), "ha gridato su una lettura limitata apposta").toEqual([]);
  });

  it("...e nemmeno su un elenco che ci sta tutto", async () => {
    dimenticaLettureTagliate();
    const { error } = await supabase.from("entities").select("id");
    expect(error).toBeNull();
    expect(elencoLettureTagliate(), "ha gridato su un elenco completo").toEqual([]);
  });
});
