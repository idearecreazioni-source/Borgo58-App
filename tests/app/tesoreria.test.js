import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, corridoioInstallato, credenziali, primaEntita } from "./aiuto";

// La tesoreria (Blocco 6a del mandato «personale e tesoreria»).
//
// Quattro cose che solo una prova col token vero può tenere ferme:
//
// 1. **I saldi sono del titolare**, e non perché la voce non compaia nel
//    menu: dentro una migrazione si gira come proprietari e la RLS si
//    scavalca, quindi là un controllo darebbe un verde che non vuol dire
//    niente (§5 punto 2 del protocollo).
// 2. **Il versamento passa dal corridoio vero**, non dalla funzione
//    chiamata a mano: è la strada da cui ci arriva il browser, ed è dove
//    il Contratto vuole che stiano le scritture su due tabelle.
// 3. **Un versamento non è un costo.** È la trappola che questo blocco
//    apre — da oggi non tutte le uscite di prima nota sono spese — e va
//    verificata da fuori, non solo dentro la migrazione che l'ha chiusa.
// 4. **Il cassetto contato produce una differenza dichiarata**, mai un
//    aggiustamento silenzioso.
const MARCA = "TEST-AUTO tesoreria";
const ANNO = 2095;

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);

describe("tesoreria: il denaro che cambia posto, e il cassetto che si conta", () => {
  let titolare;
  let staff;
  let ente;

  async function pulisci() {
    await titolare
      .from("conteggi_cassa")
      .delete()
      .gte("contato_il", `${ANNO}-01-01`)
      .lte("contato_il", `${ANNO}-12-31`);
    await titolare
      .from("cash_movements")
      .delete()
      .gte("movement_date", `${ANNO}-01-01`)
      .lte("movement_date", `${ANNO}-12-31`);
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    ente = await primaEntita(titolare);
    await pulisci();
  });

  afterAll(async () => {
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
    await sonda.auth.signOut({ scope: "local" });
  });

  it("lo staff non legge i saldi, e riceve un rifiuto invece di zero", async () => {
    const { error } = await staff.rpc("saldo_tesoreria", { p_entity_id: ente });
    expect(error).toBeTruthy();
  });

  it("lo staff non vede i conteggi del cassetto", async () => {
    // ⚠️ Prima si crea una riga vera che non deve vedere: una tabella
    // vuota non dimostra niente (§5 punto 2).
    const { error } = await titolare.from("conteggi_cassa").insert({
      entity_id: ente,
      contato_il: `${ANNO}-02-01`,
      teorico: 100,
      contato: 100,
      differenza: 0,
      nota: MARCA,
    });
    expect(error).toBeNull();

    const { data: viste } = await titolare.from("conteggi_cassa").select("id");
    expect(viste.length).toBeGreaterThan(0);

    const { data } = await staff.from("conteggi_cassa").select("id");
    expect(data ?? []).toHaveLength(0);

    await titolare.from("conteggi_cassa").delete().eq("nota", MARCA);
  });

  it.skipIf(!CORRIDOIO)("il versamento sposta il denaro senza spenderlo", async () => {
    await titolare.from("cash_movements").insert({
      entity_id: ente,
      direction: "entrata",
      amount: 1000,
      movement_date: `${ANNO}-03-01`,
      mezzo: "cassa",
      tipo_documento: "non_documentato",
      note: `${MARCA} fondo`,
    });

    const { data: prima } = await titolare.rpc("saldo_tesoreria", { p_entity_id: ente });
    const cassaPrima = Number(prima[0].contante_atteso);
    const bancaPrima = Number(prima[0].saldo_banca);

    const { error } = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "versa_in_banca",
        parametri: {
          p_entity_id: ente,
          p_importo: 400,
          p_data: `${ANNO}-03-02`,
          p_nota: `${MARCA} versamento`,
        },
      },
    });
    expect(error).toBeNull();

    const { data: dopo } = await titolare.rpc("saldo_tesoreria", { p_entity_id: ente });
    // Il patrimonio non cambia: cambia dove sta.
    expect(Number(dopo[0].contante_atteso)).toBe(cassaPrima - 400);
    expect(Number(dopo[0].saldo_banca)).toBe(bancaPrima + 400);
  });

  it("un versamento non risulta fra i costi", async () => {
    const { data } = await titolare.rpc("rettifiche_fiscali", {
      p_entity_id: ente,
      p_anno: ANNO,
    });
    // ⚠️ È la trappola aperta da questo blocco: prima di oggi ogni uscita
    // di prima nota era un costo. Un versamento non lo è.
    expect(Number(data[0].costi_totali)).toBe(0);

    const { data: elenco } = await titolare.rpc("costi_da_classificare", {
      p_entity_id: ente,
      p_anno: ANNO,
    });
    expect(elenco).toHaveLength(0);
  });

  it.skipIf(!CORRIDOIO)("contare il cassetto dichiara la differenza e la registra", async () => {
    const { data: prima } = await titolare.rpc("saldo_tesoreria", { p_entity_id: ente });
    const teorico = Number(prima[0].contante_atteso);

    const { error } = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "registra_conteggio_cassa",
        parametri: {
          p_entity_id: ente,
          p_contato: teorico - 15,
          p_data: `${ANNO}-03-03`,
          p_nota: `${MARCA} conteggio`,
        },
      },
    });
    expect(error).toBeNull();

    const { data: conteggi } = await titolare
      .from("conteggi_cassa")
      .select("*")
      .eq("contato_il", `${ANNO}-03-03`);
    expect(conteggi).toHaveLength(1);
    expect(Number(conteggi[0].differenza)).toBe(-15);
    expect(Number(conteggi[0].teorico)).toBe(teorico);
    // La differenza non resta una nota: genera un movimento vero, altrimenti
    // il saldo continuerebbe a dire un numero che il cassetto ha smentito.
    expect(conteggi[0].movimento_id).toBeTruthy();

    const { data: dopo } = await titolare.rpc("saldo_tesoreria", { p_entity_id: ente });
    expect(Number(dopo[0].contante_atteso)).toBe(teorico - 15);
  });

  it("una causale di sistema non si può spegnere né contare fra i costi fissi", async () => {
    const { data: causale } = await titolare
      .from("cash_causali")
      .select("id")
      .eq("di_sistema", true)
      .eq("label", "Versamento in banca")
      .single();

    // Il rifiuto arriva dal vincolo del database, non dalla schermata:
    // vale anche scrivendo dritto in tabella dal browser.
    const spenta = await titolare.from("cash_causali").update({ active: false }).eq("id", causale.id);
    expect(spenta.error).toBeTruthy();

    const fissa = await titolare
      .from("cash_causali")
      .update({ conta_nei_fissi: true })
      .eq("id", causale.id);
    expect(fissa.error).toBeTruthy();
  });

  it.skipIf(!CORRIDOIO)("lo staff non può versare né contare il cassetto", async () => {
    for (const operazione of ["versa_in_banca", "registra_conteggio_cassa"]) {
      const { data, error } = await staff.functions.invoke("operazioni-atomiche", {
        body: {
          operazione,
          parametri: {
            p_entity_id: ente,
            ...(operazione === "versa_in_banca" ? { p_importo: 10 } : { p_contato: 10 }),
            p_data: `${ANNO}-03-04`,
            p_nota: null,
          },
        },
      });
      // Il corridoio riporta il rifiuto del database: o come errore della
      // chiamata, o nel corpo della risposta.
      const rifiutato = Boolean(error) || Boolean(data?.errore) || data?.ok === false;
      expect(rifiutato, `${operazione} avrebbe dovuto rifiutare lo staff`).toBe(true);
    }
  });
});
