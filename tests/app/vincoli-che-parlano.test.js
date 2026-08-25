import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";
import { supabase } from "../../src/lib/supabase";

// I VINCOLI PARLANO ITALIANO — prove sui dati veri, 25/08/2026.
//
// 🔴 NASCE DA UNA MISURA DEL COLLAUDO, non da un sospetto: provando i
// rifiuti da una schermata, **quattordici vincoli nati nelle ultime
// sessioni su cinquantuno** davano il messaggio di ripiego — «il
// gestionale non ha accettato questo valore: c'è una regola che lo
// impedisce (nome_del_vincolo)» — che dice CHE c'è una regola, non
// QUALE.
//
// 🔴 E IL GUARDIANO CHE DOVEVA IMPEDIRLO ERA UN ELENCO SCRITTO A MANO: la
// verifica della `20260824000012` controllava quattordici nomi elencati
// uno per uno, quindi tutto ciò che è nato dopo di lei non era coperto.
// È la trappola già scritta in CLAUDE.md — *un guardiano deve esprimere
// una PROPRIETÀ, non una quantità*.
//
// ⚠️ QUESTA PROVA DIVENTA ROSSA DA SOLA quando qualcuno aggiunge un
// vincolo senza la sua frase, senza che nessuno si ricordi di aggiornare
// niente: l'elenco se lo costruisce il database dal catalogo, e lo stato
// di partenza (156 vincoli storici muti) è congelato in
// `vincoli_muti_noti`. È la stessa forma di `funzioni_senza_portiere()`.
describe("i vincoli nuovi parlano italiano", () => {
  let titolare;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    // Il collegamento dell'app: serve alla prova del rifiuto tradotto.
    const { error } = await supabase.auth.signInWithPassword(credenziali().titolare);
    if (error) throw new Error(`Non riesco a entrare come titolare: ${error.message}`);
  });

  afterAll(async () => {
    // ⚠️ `scope: "local"`, mai globale: butterebbe fuori gli altri file di
    // prova a metà corsa (trappola nota).
    await supabase.auth.signOut({ scope: "local" });
    await titolare?.auth.signOut({ scope: "local" });
  });

  it("nessun vincolo nato dopo il 25/08/2026 è muto", async () => {
    const { data, error } = await titolare.rpc("vincoli_senza_frase");
    expect(error).toBeNull();
    const muti = (data ?? []).map((r) => `${r.tabella}.${r.conname}`);
    // Il messaggio dell'asserzione porta i nomi: un «attesi 0, trovati 3»
    // manda a cercare quali, e quello che si cerca a mano si sbaglia.
    expect(muti, `vincoli senza spiegazione italiana: ${muti.join(", ")}`).toEqual([]);
  });

  it("lo stato di partenza è congelato e non è vuoto", async () => {
    // ⚠️ Se fosse vuoto, la prova qui sopra sarebbe verde per il motivo
    // sbagliato: non «nessuno è muto», ma «tutti sono perdonati».
    const { count, error } = await titolare
      .from("vincoli_muti_noti")
      .select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBeGreaterThan(0);
  });

  it("la spiegazione arriva dalla porta vera, quella che usa la schermata", async () => {
    // ⚠️ Guardare il commento del vincolo e guardare cosa risponde
    // `spiega_vincolo` sono due cose diverse: la schermata passa di qui,
    // e un difetto che vivesse solo in questa funzione sarebbe invisibile
    // a un controllo fatto sul catalogo.
    const { data, error } = await titolare.rpc("spiega_vincolo", {
      p_nome: "ricevimento_temperatura_sensata",
    });
    expect(error).toBeNull();
    expect(String(data ?? "")).toMatch(/temperatura/i);
  });

  it("un rifiuto vero arriva in italiano, non in inglese", async () => {
    // 🔴 LA PROVA CHE VALE: non si guarda un catalogo, si prende un
    // rifiuto vero e si legge cosa arriva a chi sta lavorando.
    //
    // 🔴 E SI ENTRA DAL COLLEGAMENTO DELL'APP, non da un client a parte —
    // scoperto facendo fallire questa prova, non rileggendo: la
    // traduzione vive dentro `src/lib/supabase.js`, quindi un client
    // proprio riceve **«violates check constraint»** in inglese mentre la
    // schermata riceve la frase italiana. È la stessa lezione del 18/08
    // sui coperti: una prova con un collegamento suo esercita il
    // database, non il tratto fra schermata e database — che qui è
    // esattamente il pezzo da provare.
    //
    // ⚠️ Si passa da una riga ESISTENTE con un `update`, non da un
    // `insert`: un inserimento nuovo cade prima su un `not null` e la
    // prova finirebbe per misurare un altro vincolo (trappola del 24/08 —
    // *prima di scegliere il valore si guarda quali altri vincoli
    // esistono già su quella riga*).
    const { data: righe } = await supabase.from("stock_lots").select("id, unit_cost").limit(1);
    if (!righe?.length) return; // niente partite: non c'è niente da provare
    const { error } = await supabase
      .from("stock_lots")
      .update({ unit_cost: -2 })
      .eq("id", righe[0].id);

    expect(error, "un costo negativo dev'essere respinto").not.toBeNull();
    expect(error.code).toBe("23514");
    expect(error.message).not.toMatch(/violates check constraint/i);
    expect(error.message).toMatch(/costo unitario/i);
  });
});
