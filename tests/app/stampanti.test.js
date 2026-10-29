import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAnonimo, clientAutenticato, credenziali, marchio, righeMie } from "./aiuto";

// Le stampanti e la coda (28/10/2026, migrazione 20261028000005).
//
// Quello che la verifica dentro la migrazione NON può dimostrare, perché lì
// si gira come proprietari e la RLS non esiste (CLAUDE.md §8):
//
// 1. il titolare scrive un apparecchio, lo staff non lo vede e non lo scrive;
// 2. lo stato dell'apparecchio non si scrive dal gestionale (lo scrive il
//    ponte), e la coda non si scrive a mano;
// 3. il giro intero come lo fara' il ponte, dalla chiave pubblica: battito,
//    presa del lavoro, esito — e la pagina rilegge «Fatto».
const NOME = marchio("TEST-AUTO stampante");

describe("le stampanti e la coda di stampa", () => {
  let titolare;
  let staff;
  let anonimo;
  let mie;
  let disp;
  let chiave;
  let lavoro;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    anonimo = clientAnonimo();
    mie = righeMie(titolare);
  });

  afterAll(async () => {
    // Togliere l'apparecchio si porta via anche le sue prove.
    await mie?.pulisci();
    await titolare?.auth.signOut({ scope: "local" });
    await staff?.auth.signOut({ scope: "local" });
  });

  it("il titolare scrive un apparecchio della rete del locale", async () => {
    const { data, error } = await titolare
      .from("dispositivi")
      .insert({ nome: NOME, tipo: "stampante_comande", protocollo: "simulatore", indirizzo: "127.0.0.1", porta: 19101, reparto: "bar" })
      .select("id, ultimo_stato")
      .single();
    expect(error).toBeNull();
    disp = mie.segna("dispositivi", data.id);
    expect(data.ultimo_stato).toBe("sconosciuto");
  });

  // ⚠️ La frase in italiano la mette il browser (`src/lib/supabase.js`), non
  //    il database: qui si controlla che a rifiutare sia la regola giusta.
  //    Che abbia la sua frase lo pretende la verifica della migrazione.
  it("un indirizzo di internet si rifiuta, dalla regola della rete del locale", async () => {
    const { error } = await titolare
      .from("dispositivi")
      .insert({ nome: `${NOME} fuori`, tipo: "stampante_comande", protocollo: "escpos_tcp", indirizzo: "8.8.8.8", porta: 9100, reparto: "cucina" });
    expect(error).not.toBeNull();
    expect(error.message).toMatch(/dispositivo_nella_rete_del_locale/);
  });

  it("lo staff non vede gli apparecchi e non li scrive", async () => {
    const { data, error } = await staff.from("dispositivi").select("id").eq("id", disp);
    if (!error) expect(data).toEqual([]);
    const scritto = await staff
      .from("dispositivi")
      .insert({ nome: `${NOME} staff`, tipo: "stampante_comande", protocollo: "escpos_tcp", indirizzo: "192.168.1.251", porta: 9100, reparto: "cucina" });
    expect(scritto.error).not.toBeNull();
  });

  it("lo stato lo scrive il ponte, non il gestionale; la coda non si scrive a mano", async () => {
    const stato = await titolare.from("dispositivi").update({ ultimo_stato: "pronto" }).eq("id", disp);
    expect(stato.error).not.toBeNull();
    const coda = await titolare.from("lavori_stampa").insert({ dispositivo_id: disp, tipo: "prova" });
    expect(coda.error).not.toBeNull();
  });

  it("«Prova di stampa» accoda un lavoro, una volta sola", async () => {
    const r = await titolare.rpc("chiedi_lavoro_dispositivo", { p_dispositivo_id: disp, p_tipo: "prova" });
    expect(r.error).toBeNull();
    lavoro = r.data;
    const doppio = await titolare.rpc("chiedi_lavoro_dispositivo", { p_dispositivo_id: disp, p_tipo: "prova" });
    expect(doppio.error?.message).toMatch(/c'è già una prova/);
    const scontrino = await titolare.rpc("chiedi_lavoro_dispositivo", { p_dispositivo_id: disp, p_tipo: "scontrino" });
    expect(scontrino.error).not.toBeNull();
  });

  it("lo staff non chiede prove e non crea la chiave del ponte", async () => {
    const prova = await staff.rpc("chiedi_lavoro_dispositivo", { p_dispositivo_id: disp, p_tipo: "stato" });
    expect(prova.error).not.toBeNull();
    const k = await staff.rpc("crea_chiave_ponte", { p_nome: `${NOME} staff` });
    expect(k.error).not.toBeNull();
  });

  it("il ponte, con la sola chiave pubblica e la sua chiave, fa il giro intero", async () => {
    const k = await titolare.rpc("crea_chiave_ponte", { p_nome: NOME });
    expect(k.error).toBeNull();
    mie.segna("chiavi_ponte", k.data.id);
    chiave = k.data.chiave;

    const battito = await anonimo.rpc("ponte_battito", { p_chiave: chiave, p_versione: "prova", p_host: "vitest" });
    expect(battito.error).toBeNull();
    expect(battito.data.dispositivi.map((d) => d.id)).toContain(disp);

    // ⚠️ Il ponte prende tutto quello che c'e' in coda su Prova, non solo il
    //    nostro: se qualcuno avesse lasciato una prova in coda, finirebbe in
    //    corso e dopo due minuti «incerta». Su Prova e' un prezzo accettato.
    const presi = await anonimo.rpc("ponte_prendi_lavori", { p_chiave: chiave, p_limite: 10 });
    expect(presi.error).toBeNull();
    const nostro = presi.data.find((l) => l.id === lavoro);
    expect(nostro?.dispositivo.indirizzo).toBe("127.0.0.1");
    expect(nostro?.contenuto.righe).toContain("Documento non fiscale");

    const esito = await anonimo.rpc("ponte_esito_lavoro", {
      p_chiave: chiave,
      p_id: lavoro,
      p_stato: "stampato",
      p_errore_codice: null,
      p_errore_testo: null,
      p_stato_dispositivo: "pronto",
      p_esito: { prova: true },
    });
    expect(esito.error).toBeNull();

    const { data: letto } = await titolare.from("lavori_stampa").select("stato").eq("id", lavoro).single();
    expect(letto.stato).toBe("stampato");
    const { data: app } = await titolare.from("dispositivi").select("ultimo_stato").eq("id", disp).single();
    expect(app.ultimo_stato).toBe("pronto");

    const elenco = await titolare.rpc("chiavi_ponte_elenco");
    expect(elenco.data.find((c) => c.id === k.data.id)?.acceso).toBe(true);
  });

  it("senza chiave il ponte non entra", async () => {
    const r = await anonimo.rpc("ponte_battito", { p_chiave: "sbagliata", p_versione: "x", p_host: "x" });
    expect(r.error?.message).toMatch(/non vale/);
  });
});
