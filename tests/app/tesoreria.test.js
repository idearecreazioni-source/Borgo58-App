import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, corridoioInstallato, credenziali, denunciaSaltiCorridoio, primaEntita } from "./aiuto";

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
// ⚠️ UN ANNO NEL PASSATO, e dal 17/08/2026 non e' indifferente: i saldi
// contano solo i movimenti FINO A OGGI (un assegno che uscira' fra un mese
// non e' ancora uscito). Con l'anno di prova nel FUTURO — com'era fino a
// ieri — i movimenti di questa prova sparivano dai saldi e le sue
// asserzioni diventavano rosse. L'anno serve solo a non incrociare i dati
// veri, e per quello un anno passato va bene uguale: il locale apre nel
// 2027.
const ANNO = 1995;

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);
// ⚠️ La sentinella sta in OGNI file che salta prove, non in uno solo: chi
// lancia solo questo file deve vedere che ci sono prove che non sono partite.
await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);

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
    // ⚠️ `toBeCloseTo` e non `toBe` (23/08/2026): questo confronto passava
    // finché i saldi erano numeri tondi, e con due mesi di movimenti veri è
    // diventato rosso su 1893,49 contro 1893,4899999999998 — la virgola
    // mobile di JavaScript, non un euro fuori posto. *Una prova che passa
    // perché i numeri erano fortunati non stava misurando la regola.*
    expect(Number(dopo[0].contante_atteso)).toBeCloseTo(cassaPrima - 400, 2);
    expect(Number(dopo[0].saldo_banca)).toBeCloseTo(bancaPrima + 400, 2);
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


  it("le causali di sistema non compaiono quando si registra un movimento a mano", async () => {
    // ⚠️ Segnalato da Alessio guardando il menu della prima nota. Sceglierne
    // una per una spesa vera la farebbe sparire dai costi IN SILENZIO,
    // perche' quelle causali sono trattate come spostamenti di denaro.
    const { data: elenco } = await titolare
      .from("cash_causali")
      .select("label, di_sistema")
      .eq("active", true)
      .eq("di_sistema", false)
      .eq("kind", "uscita");
    expect(elenco.some((c) => c.di_sistema)).toBe(false);
    expect(elenco.some((c) => c.label === "Versamento in banca")).toBe(false);
    expect(elenco.some((c) => c.label === "Rimborso al titolare")).toBe(false);

    // Ma esistono ancora, e si vedono dove servono.
    //
    // 🔴 QUI C'ERA UN NUMERO — `expect(tutte.length).toBe(5)` — ed è caduto
    // il 26/08 quando è nata «Caparra ricevuta». Non era rotto il gestionale:
    // era una QUANTITÀ scritta a mano, che invecchia al primo lavoro nuovo.
    // Al suo posto c'è l'elenco per nome: se ne nasce una sesta senza che
    // nessuno la dichiari qui, questa prova diventa rossa **dicendo quale**,
    // che è l'informazione che il numero non dava.
    const DI_SISTEMA = [
      "Caparra ricevuta",
      "Differenza di cassa in meno",
      "Differenza di cassa in più",
      "Rimborso al titolare",
      "Versamento dalla cassa",
      "Versamento in banca",
    ];
    const { data: tutte } = await titolare.from("cash_causali").select("label").eq("di_sistema", true);
    expect(tutte.map((c) => c.label).sort()).toEqual(DI_SISTEMA);
  });

  it("una causale di sistema non si puo' spegnere ne' contare fra i costi fissi", async () => {
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

// «Ce la faccio al 16?» — Blocco 6b.
//
// ⚠️ Il pezzo che una migrazione non può provare da sola: le tre funzioni
// nuove passano da PostgREST col token dello staff, che è come ci arriva
// un tablet. E la riconciliazione senza estratto conto — una fattura che
// sparisce dalle attese quando la si paga — si prova qui perché tocca due
// moduli diversi.
describe("previsione di cassa: cosa deve ancora uscire", () => {
  let titolare;
  let staff;
  let ente;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    ente = await primaEntita(titolare);
    await titolare.from("scadenze_previste").delete().eq("nota", MARCA);
  });

  afterAll(async () => {
    await titolare.from("scadenze_previste").delete().eq("nota", MARCA);
    await titolare.from("impostazioni_tesoreria").delete().eq("entity_id", ente);
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
  });

  it("lo staff è respinto su previsione, scadenze e POS", async () => {
    for (const [fn, args] of [
      ["previsione_cassa", { p_entity_id: ente, p_fino_al: null }],
      ["movimenti_attesi", { p_entity_id: ente, p_fino_al: null }],
      ["pos_in_transito", { p_entity_id: ente }],
    ]) {
      const { error } = await staff.rpc(fn, args);
      expect(error, `${fn} avrebbe dovuto rifiutare lo staff`).toBeTruthy();
    }
  });

  it("i parametri del POS nascono vuoti e la schermata lo dichiara", async () => {
    const { data } = await titolare.rpc("pos_in_transito", { p_entity_id: ente });
    // ⚠️ Niente commissione inventata: senza risposta della banca il netto
    // non è calcolabile, e va detto invece di mostrare il lordo come netto.
    expect(data[0].netto_atteso).toBeNull();
    expect(data[0].avvertenza).toContain("LORDO");
  });

  it("una scadenza scritta a mano entra nella previsione, e oltre l'orizzonte no", async () => {
    const fra10 = new Date();
    fra10.setDate(fra10.getDate() + 10);
    const data10 = fra10.toLocaleDateString("sv-SE"); // AAAA-MM-GG in ora locale

    await titolare.from("scadenze_previste").insert({
      entity_id: ente,
      descrizione: `${MARCA} affitto`,
      importo: 900,
      scade_il: data10,
      mezzo: "banca",
      nota: MARCA,
    });

    const fra20 = new Date();
    fra20.setDate(fra20.getDate() + 20);
    const { data: dentro } = await titolare.rpc("movimenti_attesi", {
      p_entity_id: ente,
      p_fino_al: fra20.toLocaleDateString("sv-SE"),
    });
    expect(dentro.some((m) => m.descrizione === `${MARCA} affitto`)).toBe(true);

    const fra5 = new Date();
    fra5.setDate(fra5.getDate() + 5);
    const { data: fuori } = await titolare.rpc("movimenti_attesi", {
      p_entity_id: ente,
      p_fino_al: fra5.toLocaleDateString("sv-SE"),
    });
    expect(fuori.some((m) => m.descrizione === `${MARCA} affitto`)).toBe(false);
  });

  it("la previsione somma quello che dice di sommare, e dichiara che mancano gli stipendi", async () => {
    const { data } = await titolare.rpc("previsione_cassa", {
      p_entity_id: ente,
      p_fino_al: null,
    });
    const p = data[0];
    // 🔴 `toBeCloseTo` AL CENTESIMO, e non `toBe` (22/08/2026). Questa prova
    // è diventata rossa quando il progetto di prova ha preso due mesi di
    // dati veri: `expected 1288.86 to be 1288.8600000000001`.
    //
    // ⚠️ **A sbagliare non era il gestionale, era la prova.** Il database
    // somma in `numeric`, che è aritmetica esatta; qui si risomma in
    // JavaScript, dove 0,1 + 0,2 non fa 0,3. Con numeri tondi le due strade
    // coincidevano e nessuno se n'era accorto — è la stessa forma del caso
    // vuoto: *finché i dati non hanno niente da far emergere, una prova
    // fragile passa.*
    //
    // ⚠️ E la tolleranza è **due decimali** perché quelli sono euro: un
    // confronto più largo lascerebbe passare uno scarto vero.
    expect(Number(p.saldo_previsto)).toBeCloseTo(
      Number(p.oggi_cassa) + Number(p.oggi_banca) + Number(p.pos_in_arrivo) - Number(p.uscite_attese),
      2
    );
    // Il buco più grosso è dichiarato: senza, un saldo previsto ottimista
    // sembrerebbe una promessa.
    expect(p.avvertenza).toContain("NON comprende gli stipendi");
  });
});

// Incassato contro scontrinato (16/08/2026, chiesto da Alessio).
//
// ⚠️ Il punto: la colonna nasce VUOTA e vuoto vuol dire «nessuno l'ha
// ancora detto», non «niente è stato emesso». Se il valore predefinito
// fosse «scontrino», la quadratura tornerebbe sempre per costruzione —
// proprio nel caso in cui serve che non torni.
describe("incassato e scontrinato: due totali e la differenza in elenco", () => {
  let titolare;
  let staff;
  let ente;
  const GIORNO = "2091-09-01";

  async function pulisci() {
    const { data } = await titolare.from("orders").select("id").like("note", "TEST-AUTO fisc%");
    for (const o of data ?? []) {
      await titolare.from("order_items").delete().eq("order_id", o.id);
      await titolare.from("orders").delete().eq("id", o.id);
    }
  }

  async function conto(etichetta, prezzo, documento) {
    const { data, error } = await titolare
      .from("orders")
      .insert({
        entity_id: ente,
        table_label: etichetta,
        // 🔴 NASCE APERTO, E SI CHIUDE DOPO LE RIGHE (dal 22/08).
        //
        // Prima nasceva già chiuso e le righe si aggiungevano sopra: dal
        // vincolo del 22/08 quell'inserimento è **respinto**, perché in sala
        // aggiungere un piatto a un conto chiuso è il gesto che si vuole
        // impedire. ⚠️ La prova non stava provando quel gesto — stava
        // *apparecchiando* uno stato storico — ma lo faceva in un ordine che
        // la realtà non consente, e il vincolo ha ragione: **si apparecchia
        // come farebbe una sala**, aprendo, servendo e poi chiudendo.
        status: "aperto",
        payment_method: "contante",
        coperti: 0,
        coperto_unit_price: 5,
        opened_at: GIORNO,
        // 🔴 UN'ORA DI SERVIZIO VERA, non la mezzanotte (19/08). Scrivendo
        // solo la data, il conto nasce a mezzanotte di Greenwich — le 02:00
        // italiane — e dal 19/08 quel conto appartiene alla SERATA PRIMA,
        // che è esattamente la regola voluta. La prova sbagliava a datare,
        // non il codice: un conto chiuso alle 02:00 è la sera prima.
        closed_at: `${GIORNO}T21:00:00+02:00`,
        note: "TEST-AUTO fisc",
        documento_fiscale: documento ?? null,
        documento_emesso_il: documento === "fattura" ? GIORNO : null,
      })
      .select()
      .single();
    if (error) throw error;
    const { error: eRighe } = await titolare.from("order_items").insert({
      order_id: data.id,
      free_text_name: "Piatto",
      destination: "cucina",
      quantity: 1,
      sent_at: new Date().toISOString(),
      unit_price: prezzo,
    });
    if (eRighe) throw eRighe;

    // Solo adesso il conto si chiude: è l'ordine dei gesti veri.
    const { error: eChiusura } = await titolare
      .from("orders")
      .update({ status: "chiuso" })
      .eq("id", data.id);
    if (eChiusura) throw eChiusura;
    return data.id;
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
  });

  it("un conto senza documento non risulta scontrinato", async () => {
    await conto("TEST-AUTO fisc A", 40, "scontrino");
    await conto("TEST-AUTO fisc B", 60, null);

    const { data } = await titolare.rpc("quadratura_fiscale", {
      p_entity_id: ente,
      p_dal: GIORNO,
      p_al: GIORNO,
    });
    expect(Number(data[0].incassato)).toBe(100);
    expect(Number(data[0].fiscalizzato)).toBe(40);
    expect(Number(data[0].da_fiscalizzare)).toBe(60);
    expect(Number(data[0].quanti_da_fare)).toBe(1);
    // La differenza non è un numero muto: dice che resta in elenco.
    //
    // ⚠️ Si guarda la PROMESSA, non la sua forma grammaticale: dal
    // 23/08/2026 la frase ha il singolare quando il conto è uno («non
    // sparisce da solo»), perché «1 conti» in una schermata di soldi fa
    // dubitare anche del numero accanto. Qui il conto è uno.
    expect(data[0].avvertenza).toMatch(/non spariscono da soli|non sparisce da solo/);
  });

  it("segnandolo dopo, il conto esce dall'elenco", async () => {
    const { data: prima } = await titolare.rpc("conti_da_fiscalizzare", {
      p_entity_id: ente,
      p_dal: GIORNO,
      p_al: GIORNO,
    });
    expect(prima).toHaveLength(1);

    await titolare
      .from("orders")
      .update({ documento_fiscale: "scontrino" })
      .eq("id", prima[0].order_id);

    const { data: dopo } = await titolare.rpc("conti_da_fiscalizzare", {
      p_entity_id: ente,
      p_dal: GIORNO,
      p_al: GIORNO,
    });
    expect(dopo).toHaveLength(0);

    const { data: q } = await titolare.rpc("quadratura_fiscale", {
      p_entity_id: ente,
      p_dal: GIORNO,
      p_al: GIORNO,
    });
    expect(Number(q[0].fiscalizzato)).toBe(100);
  });

  it("una fattura non si dichiara emessa senza dire quando", async () => {
    const id = await conto("TEST-AUTO fisc C", 25, null);
    // ⚠️ Il rifiuto arriva dal vincolo del database: quella data è la sola
    // cosa che distingue «fatta» da «promessa».
    const { error } = await titolare
      .from("orders")
      .update({ documento_fiscale: "fattura", documento_emesso_il: null })
      .eq("id", id);
    expect(error).toBeTruthy();
  });

  it("lo staff non legge la quadratura fiscale", async () => {
    for (const fn of ["quadratura_fiscale", "conti_da_fiscalizzare"]) {
      const { error } = await staff.rpc(fn, { p_entity_id: ente, p_dal: GIORNO, p_al: GIORNO });
      expect(error, `${fn} avrebbe dovuto rifiutare lo staff`).toBeTruthy();
    }
  });
});

// Le due cifre delle imposte (16/08/2026, decisione di Alessio).
//
// ⚠️ Il punto: i RICAVI restano interi — se si riducessero, scontrino
// medio, food cost in percentuale e scostamento direbbero il falso — e la
// distinzione fra incassato e fiscalizzato vive sulle IMPOSTE, dove è
// pertinente. E il motore fiscale resta uno solo: le due cifre escono da
// due chiamate alla stessa funzione, non da due calcoli.
describe("imposte: due cifre, e la vera sta in mezzo", () => {
  let titolare;
  let staff;
  let ente;
  const GIORNO = "2089-04-01";

  async function pulisci() {
    const { data } = await titolare.from("orders").select("id").like("note", "TEST-AUTO imp%");
    for (const o of data ?? []) {
      await titolare.from("order_items").delete().eq("order_id", o.id);
      await titolare.from("orders").delete().eq("id", o.id);
    }
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
  });

  it("i ricavi non fiscalizzati si leggono dai conti chiusi", async () => {
    const { data: o } = await titolare
      .from("orders")
      .insert({
        entity_id: ente,
        table_label: "TEST-AUTO imp",
        // Come sopra: si apre, si serve, si chiude (vincolo del 22/08).
        status: "aperto",
        payment_method: "contante",
        coperti: 0,
        coperto_unit_price: 5,
        opened_at: GIORNO,
        // 🔴 UN'ORA DI SERVIZIO VERA, non la mezzanotte (19/08). Scrivendo
        // solo la data, il conto nasce a mezzanotte di Greenwich — le 02:00
        // italiane — e dal 19/08 quel conto appartiene alla SERATA PRIMA,
        // che è esattamente la regola voluta. La prova sbagliava a datare,
        // non il codice: un conto chiuso alle 02:00 è la sera prima.
        closed_at: `${GIORNO}T21:00:00+02:00`,
        note: "TEST-AUTO imp",
      })
      .select()
      .single();
    const { error: eRighe } = await titolare.from("order_items").insert({
      order_id: o.id,
      free_text_name: "Piatto",
      destination: "cucina",
      quantity: 1,
      sent_at: new Date().toISOString(),
      unit_price: 250,
    });
    expect(eRighe).toBeNull();
    await titolare.from("orders").update({ status: "chiuso" }).eq("id", o.id);

    const { data } = await titolare.rpc("ricavi_non_fiscalizzati", {
      p_entity_id: ente,
      p_anno: 2089,
    });
    expect(Number(data[0].importo)).toBe(250);
    expect(Number(data[0].conti)).toBe(1);
  });

  it("lo staff non legge né i ricavi non fiscalizzati né le due stime", async () => {
    const a = await staff.rpc("ricavi_non_fiscalizzati", { p_entity_id: ente, p_anno: 2089 });
    expect(a.error).toBeTruthy();
    const b = await staff.rpc("imposte_e_fiscalizzato", {
      p_entity_id: ente,
      p_anno: 2089,
      p_imponibile: 1000,
      p_costo_lavoro: 0,
    });
    expect(b.error).toBeTruthy();
  });
});
