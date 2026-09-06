import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  clientAutenticato,
  corridoioInstallato,
  credenziali,
  denunciaSaltiCorridoio,
  marchio,
} from "./aiuto";

// SPEC-0013 — gli appunti vocali, contro il database vero.
//
// 🔴 QUESTE PROVE ESISTONO PER UNA COSA SOLA: che **niente venga scritto nel
//    gestionale prima che Alessio approvi**. Fino al 06/09 non era cosi' —
//    una temperatura o una giacenza dette con sicurezza entravano
//    nell'istante in cui venivano dette — e quella porta si e' chiusa
//    togliendo la funzione che la apriva. Una prova che si limitasse a
//    leggere il codice non se ne accorgerebbe: qui si detta davvero e si
//    guarda se in magazzino e' cambiato qualcosa.
//
// ⚠️ SI ENTRA DAL CORRIDOIO per approvare e scartare, non chiamando la
//    funzione del database: e' la strada che usa il gestionale (Contratto
//    B4), e un'operazione dimenticata nell'elenco del corridoio risponde 404
//    senza che nessuna prova SQL se ne accorga.
//
// ⚠️ E OGNI PROVA GUARDA UNA DIFFERENZA CHE SI PRODUCE (regola del 17/08):
//    una giacenza che NON si muove, tre righe che diventano un appunto solo,
//    due pagamenti che restano due. Su uno stato di partenza vuoto non
//    proverebbero niente.

const NOME = marchio("TEST-AUTO appunti");

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);
await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);

describe("gli appunti vocali", () => {
  let titolare;
  const miei = { dettature: [], appunti: [], azioni: [], tasks: [], lista: [] };

  /** Detta come farebbe la funzione online, e segna cio' che nasce. */
  async function detta(testo, azioni) {
    // ⚠️ Si entra da `registra_dettatura`, la porta che usa la funzione
    //    online: `scrivi_dettatura` non e' concessa a chi ha un token di
    //    utente, ed e' giusto cosi'. Provare la funzione interna invece
    //    della porta vorrebbe dire non provare il tratto che si rompe.
    const { data, error } = await titolare.rpc("registra_dettatura", {
      p_testo: `${NOME} — ${testo}`,
      p_azioni: azioni,
      p_esito: "capita",
      p_modello: null,
      p_token_domanda: 0,
      p_token_risposta: 0,
      p_messaggio: null,
    });
    if (error) throw error;
    const dettaturaId = data.dettatura_id;
    miei.dettature.push(dettaturaId);

    const { data: righe } = await titolare
      .from("azioni_dettate")
      .select("id, appunto_id, tipo, stato, sicuro, dati")
      .eq("dettatura_id", dettaturaId);
    for (const r of righe ?? []) {
      miei.azioni.push(r.id);
      if (!miei.appunti.includes(r.appunto_id)) miei.appunti.push(r.appunto_id);
    }
    return righe ?? [];
  }

  const elemento = (tipo, extra = {}) => ({
    tipo,
    sicuro: true,
    frase: `${NOME} riga`,
    dati: {},
    ...extra,
  });

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
  });

  afterAll(async () => {
    // ⚠️ Si cancella SOLO cio' che questa prova ha creato, per identificativo
    //    (regola del 23/08). Prima le figlie, poi le madri: al contrario le
    //    chiavi esterne respingono.
    if (miei.lista.length) await titolare.from("shopping_list_items").delete().in("id", miei.lista);
    if (miei.tasks.length) await titolare.from("tasks").delete().in("id", miei.tasks);
    if (miei.azioni.length) await titolare.from("azioni_dettate").delete().in("id", miei.azioni);
    if (miei.appunti.length) await titolare.from("appunti_vocali").delete().in("id", miei.appunti);
    if (miei.dettature.length) await titolare.from("dettature").delete().in("id", miei.dettature);
  });

  it("🔴 una misura detta con sicurezza NON scrive niente prima dell'approvazione", async () => {
    // 🔴 IL CASO DEVE ESSERE QUELLO CHE PRIMA SI SAREBBE ESEGUITO DA SÉ,
    //    altrimenti la prova non discrimina. La prima stesura usava una
    //    temperatura senza il frigo: quella non e' mai «sicura» — il
    //    traduttore la marca incerta — quindi non si sarebbe eseguita
    //    nemmeno col criterio vecchio. Misurato rimettendo apposta
    //    l'esecuzione automatica: la prova restava VERDE.
    //    ⚠️ `promemoria` invece e' natura «misura», eseguibile e sicuro:
    //    col criterio vecchio nasceva un impegno in Agenda all'istante.
    const titolo = `${NOME} promemoria ${crypto.randomUUID().slice(0, 8)}`;

    const righe = await detta("promemoria", [
      elemento("promemoria", { dati: { titolo } }),
    ]);

    expect(righe).toHaveLength(1);
    expect(righe[0].stato).toBe("in_attesa");

    // ⚠️ E si va a GUARDARE in Agenda invece di fidarsi dello stato scritto
    //    sulla riga: «in attesa» e «non ha prodotto niente» sono due
    //    affermazioni diverse, ed e' la seconda che SPEC-0013 pretende.
    const { data: nati } = await titolare.from("tasks").select("id").eq("title", titolo);
    for (const t of nati ?? []) miei.tasks.push(t.id);
    expect(nati).toHaveLength(0);
  });
  it("🔴 una destinazione che il gestionale non conosce NON viene ricondotta ad altro", async () => {
    const righe = await detta("preventivo", [
      elemento("chiedi_preventivo_fabbro", {
        destinazione: "Chiedere un preventivo al fabbro",
        dati: { chi: "fabbro" },
      }),
    ]);

    // Non e' diventata «nota_non_capita» ne' l'azione piu' vicina.
    expect(righe[0].tipo).toBe("chiedi_preventivo_fabbro");

    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("titolo, eseguibile")
      .eq("id", righe[0].appunto_id)
      .single();

    // ⚠️ Il titolo e' quello che MEMO ha scritto in parole: senza, resterebbe
    //    una sigla e l'appunto sarebbe illeggibile.
    expect(appunto.titolo).toBe("Chiedere un preventivo al fabbro");
    // ⚠️ E DICHIARA di non avere un gesto, invece di far finta di averlo.
    expect(appunto.eseguibile).toBe(false);
  });

  it.skipIf(!CORRIDOIO)("...e approvarla viene rifiutato, spiegando perche'", async () => {
    const righe = await detta("preventivo due", [
      elemento("chiedi_preventivo_idraulico", {
        destinazione: "Chiamare l'idraulico",
        dati: { chi: "idraulico" },
      }),
    ]);

    const { error } = await titolare.functions.invoke("operazioni-atomiche", {
      body: { operazione: "approva_appunto", parametri: { p_id: righe[0].appunto_id } },
    });
    expect(error).toBeTruthy();

    // La riga resta in attesa: il rifiuto non butta via quello che ha detto.
    const { data: dopo } = await titolare
      .from("azioni_dettate")
      .select("stato")
      .eq("id", righe[0].id)
      .single();
    expect(dopo.stato).toBe("in_attesa");
  });

  it("🔴 tre righe della stessa lista, dette in tre momenti, fanno UN appunto solo", async () => {
    const uno = await detta("lista 1", [
      elemento("lista_spesa", { dati: { nome_libero: `${NOME} parmigiano` } }),
    ]);
    const due = await detta("lista 2", [
      elemento("lista_spesa", { dati: { nome_libero: `${NOME} shampoo` } }),
    ]);
    const tre = await detta("lista 3", [
      elemento("lista_spesa", { dati: { nome_libero: `${NOME} carta forno` } }),
    ]);

    expect(due[0].appunto_id).toBe(uno[0].appunto_id);
    expect(tre[0].appunto_id).toBe(uno[0].appunto_id);

    const { data: elenco } = await titolare.rpc("appunti_da_approvare");
    const mio = elenco.find((a) => a.id === uno[0].appunto_id);
    expect(mio.quanti).toBe(3);
    // Tutte e tre sicure: l'appunto non risulta incerto.
    expect(mio.incerto).toBe(false);
    expect(mio.elementi).toHaveLength(3);
  });

  it("🔴 due movimenti di cassa restano DUE appunti, approvabili uno per uno", async () => {
    const primo = await detta("pagamento 1", [
      elemento("movimento_cassa", {
        sicuro: false,
        dati: { verso: "uscita", importo: 30, descrizione: NOME },
      }),
    ]);
    const secondo = await detta("pagamento 2", [
      elemento("movimento_cassa", {
        sicuro: false,
        dati: { verso: "uscita", importo: 40, descrizione: NOME },
      }),
    ]);

    // ⚠️ Stessa destinazione, momenti diversi: se il raggruppamento guardasse
    //    solo la destinazione, questi due si fonderebbero — e approvarne uno
    //    scriverebbe anche l'altro.
    expect(secondo[0].appunto_id).not.toBe(primo[0].appunto_id);

    const { data: elenco } = await titolare.rpc("appunti_da_approvare");
    const uno = elenco.find((a) => a.id === primo[0].appunto_id);
    expect(uno.quanti).toBe(1);
    // Detti come incerti: l'appunto lo dichiara.
    expect(uno.incerto).toBe(true);
  });

  it("un appunto porta i dati concreti, l'eta' e le alternative considerate", async () => {
    const righe = await detta("con alternative", [
      elemento("chiedi_preventivo_muratore", {
        destinazione: "Chiamare il muratore",
        sicuro: false,
        alternative: [{ destinazione: "Annota in Agenda", perche: "poteva essere un promemoria" }],
        dati: { chi: "muratore", quando: "lunedì" },
      }),
    ]);

    const { data: elenco } = await titolare.rpc("appunti_da_approvare");
    const mio = elenco.find((a) => a.id === righe[0].appunto_id);

    expect(mio.elementi[0].dati.chi).toBe("muratore");
    expect(mio.elementi[0].alternative).toHaveLength(1);
    expect(mio.elementi[0].alternative[0].destinazione).toBe("Annota in Agenda");
    // Appena creato: eta' zero, ma il campo c'e' e si legge.
    expect(mio.aperto_da_giorni).toBe(0);
    expect(typeof mio.aperto_da_ore).toBe("number");
  });

  it("🔴 niente si chiude da se': un appunto resta aperto finche' non lo chiude Alessio", async () => {
    const righe = await detta("resta aperto", [
      elemento("lista_spesa", { dati: { nome_libero: `${NOME} sale` } }),
    ]);

    // ⚠️ La persistenza si prova sulla PROPRIETA', non aspettando: nessun
    //    lavoro pianificato tocca questa tabella, e nessuna scadenza esiste
    //    nello schema. Se un domani qualcuno ne aggiungesse una, questa prova
    //    non se ne accorgerebbe — quindi si guarda anche che la colonna di
    //    chiusura resti vuota finche' nessuno la scrive.
    const { data: prima } = await titolare
      .from("appunti_vocali")
      .select("stato, chiuso_il")
      .eq("id", righe[0].appunto_id)
      .single();
    expect(prima.stato).toBe("aperto");
    expect(prima.chiuso_il).toBeNull();

    // Si rilegge dopo altre dettature e altri gesti: resta dov'era.
    await detta("altra cosa", [elemento("nota_non_capita", { dati: { sentito: NOME } })]);

    const { data: dopo } = await titolare
      .from("appunti_vocali")
      .select("stato, chiuso_il")
      .eq("id", righe[0].appunto_id)
      .single();
    expect(dopo.stato).toBe("aperto");
    expect(dopo.chiuso_il).toBeNull();
  });

  it.skipIf(!CORRIDOIO)("scartare dal corridoio chiude l'appunto senza scrivere niente", async () => {
    const { count: prima } = await titolare
      .from("cash_movements")
      .select("id", { count: "exact", head: true });

    const righe = await detta("da scartare", [
      elemento("movimento_cassa", {
        dati: { verso: "uscita", importo: 99, descrizione: NOME },
      }),
    ]);

    const { error } = await titolare.functions.invoke("operazioni-atomiche", {
      body: { operazione: "scarta_appunto", parametri: { p_id: righe[0].appunto_id } },
    });
    expect(error).toBeNull();

    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("stato, chiuso_il")
      .eq("id", righe[0].appunto_id)
      .single();
    expect(appunto.stato).toBe("scartato");
    expect(appunto.chiuso_il).not.toBeNull();

    const { count: dopo } = await titolare
      .from("cash_movements")
      .select("id", { count: "exact", head: true });
    expect(dopo).toBe(prima);
  });

  it.skipIf(!CORRIDOIO)("correggere un elemento lascia l'appunto aperto e non scrive niente", async () => {
    const righe = await detta("da correggere", [
      elemento("movimento_cassa", {
        sicuro: false,
        dati: { verso: "uscita", importo: 10, descrizione: NOME },
      }),
    ]);

    const { error } = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "correggi_elemento_appunto",
        parametri: {
          p_id: righe[0].id,
          p_dati: { verso: "uscita", importo: 25, descrizione: NOME },
        },
      },
    });
    expect(error).toBeNull();

    const { data: riga } = await titolare
      .from("azioni_dettate")
      .select("dati, stato")
      .eq("id", righe[0].id)
      .single();
    expect(Number(riga.dati.importo)).toBe(25);
    // 🔴 Correggere non e' approvare: la riga resta da guardare.
    expect(riga.stato).toBe("in_attesa");

    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("stato")
      .eq("id", righe[0].appunto_id)
      .single();
    expect(appunto.stato).toBe("aperto");
  });

  it("🔴 la vecchia porta per singola riga è CHIUSA a chi ha un token", async () => {
    // 🔴 Trovato dalla revisione del 06/09: `esegui_azione_dettata` esegue UNA
    //    riga e non tocca l'appunto. Restava concessa, quindi su una lista da
    //    tre articoli si poteva scrivere il primo lasciando gli altri due
    //    dentro un appunto a metà — e «l'unità che si approva è l'appunto»
    //    smette di essere vera nel momento in cui esiste una seconda porta.
    const righe = await detta("porta vecchia", [
      elemento("lista_spesa", { dati: { nome_libero: `${NOME} porta vecchia` } }),
    ]);

    const { error } = await titolare.rpc("esegui_azione_dettata", { p_id: righe[0].id });

    // ⚠️ SI GUARDA CHE RIFIUTO E', non che ci sia «un errore»: un
    //    identificativo storto, una riga sparita o una funzione rinominata
    //    darebbero anche loro un errore, e la prova passerebbe senza aver
    //    provato che la porta e' chiusa. 42501 e' il permesso negato.
    expect(error).toBeTruthy();
    expect(`${error.code} ${error.message}`).toMatch(/42501|permission denied/i);

    // La riga non è stata toccata: il rifiuto non lascia mezze scritture.
    const { data: dopo } = await titolare
      .from("azioni_dettate").select("stato").eq("id", righe[0].id).single();
    expect(dopo.stato).toBe("in_attesa");
  });

  it.skipIf(!CORRIDOIO)("🔴 approvare è tutto o niente: se un elemento fallisce, non entra nessuno", async () => {
    // Due articoli della stessa lista, quindi UN appunto solo. Il secondo ha
    // un'unità che il vocabolario chiuso del database non ammette, quindi
    // l'esecuzione morirà a metà.
    // ⚠️ IL GRUPPO E' SOLO DI QUESTA PROVA: senza, le due righe finirebbero
    //    nel gruppo condiviso della lista della spesa e potrebbero
    //    trascinarsi dietro righe di altre prove — e allora «nessun
    //    articolo e' entrato» direbbe qualcosa su roba non mia.
    const gruppo = crypto.randomUUID();
    const buono = `${NOME} buono ${crypto.randomUUID().slice(0, 8)}`;
    const uno = await detta("tutto o niente 1", [
      elemento("lista_spesa", { dati: { nome_libero: buono, quantita: 2, unita: "kg", lista: gruppo } }),
    ]);
    const due = await detta("tutto o niente 2", [
      elemento("lista_spesa", {
        dati: { nome_libero: `${NOME} rotto`, quantita: 1, unita: "zzz-non-esiste", lista: gruppo },
      }),
    ]);
    expect(due[0].appunto_id).toBe(uno[0].appunto_id);

    const { error } = await titolare.functions.invoke("operazioni-atomiche", {
      body: { operazione: "approva_appunto", parametri: { p_id: uno[0].appunto_id } },
    });
    expect(error).toBeTruthy();

    // 🔴 IL PUNTO: il primo articolo, che era buonissimo, NON è entrato.
    //    Se fosse entrato, l'appunto sarebbe rimasto aperto con dentro una
    //    riga già scritta — e riapprovarlo la scriverebbe due volte.
    const { data: righe } = await titolare
      .from("azioni_dettate").select("stato").eq("appunto_id", uno[0].appunto_id);
    for (const r of righe ?? []) expect(r.stato).toBe("in_attesa");

    const { data: inLista } = await titolare
      .from("shopping_list_items").select("id").eq("custom_name", buono);
    for (const r of inLista ?? []) miei.lista.push(r.id);
    expect(inLista).toHaveLength(0);

    const { data: appunto } = await titolare
      .from("appunti_vocali").select("stato").eq("id", uno[0].appunto_id).single();
    expect(appunto.stato).toBe("aperto");
  });

  // -------------------------------------------------------------------
  // LE DUE GARE — SPEC-0013, dalla revisione del 06/09
  // -------------------------------------------------------------------
  // 🔴 QUESTE DUE PROVE **NON DISCRIMINANO**, ED È MISURATO. Rimesse le
  //    versioni di prima delle due funzioni corrette — quelle con la gara
  //    dentro — queste prove restano VERDI, anche portandole a sedici
  //    chiamate simultanee. Non è che la gara non esista: è che **da qui
  //    non si riesce a produrla**, perché il collegamento del gestionale
  //    mette in fila le chiamate.
  //
  // ⚠️ CHE LA GARA SIA REALE È MISURATO ALTROVE, con due sessioni SQL vere
  //    che si sovrappongono davvero:
  //      · versione di prima  → una delle due muore con
  //        «duplicate key value violates unique constraint
  //        un_appunto_aperto_per_gruppo» — cioè una dettatura PERSA;
  //      · versione corretta  → tutt'e due riuscite.
  //    Quella misura non è automatizzabile qui: le prove contro il
  //    database parlano col collegamento del gestionale, non con due
  //    sessioni Postgres, e portarcele dentro vorrebbe dire chiedere
  //    `psql` a chi lancia le prove — che su GitHub non c'è.
  //
  // ⚠️ QUINDI COSA SONO. Non prove della gara: **guardie sull'esito**. Se
  //    un domani qualcuno rompesse il raggruppamento o la chiusura in modo
  //    non sottile — non con una gara, ma sbagliando la regola — queste
  //    diventerebbero rosse. È meno di quanto sembrerebbe dal titolo, ed è
  //    scritto qui perché nessuno creda che coprano di più.

  it("sei dettature sulla stessa lista arrivano tutte, in un appunto solo", async () => {
    // Prima della correzione: l'indice unico respingeva le perdenti e la
    // funzione sollevava un'eccezione — cioè **le dettature si perdevano**,
    // che è la cosa che questo modulo esiste per non far succedere.
    //
    // ⚠️ La lista è NUOVA a ogni giro (`lista` è un identificativo a caso):
    //    senza, si aggancerebbero al gruppo condiviso `lista_spesa:` e la
    //    prova direbbe «uno» anche senza aver provato niente.
    const laMiaLista = crypto.randomUUID();

    const insieme = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((n) =>
        titolare.rpc("registra_dettatura", {
          p_testo: `${NOME} — gara ${n} ${laMiaLista.slice(0, 8)}`,
          p_azioni: [
            {
              tipo: "lista_spesa",
              sicuro: true,
              frase: `${NOME} gara ${n}`,
              dati: { nome_libero: `${NOME} gara ${n}`, lista: laMiaLista },
            },
          ],
          p_esito: "capita",
          p_modello: null,
          p_token_domanda: 0,
          p_token_risposta: 0,
          p_messaggio: null,
        }),
      ),
    );

    // 🔴 NESSUNA E' ANDATA PERSA. È l'affermazione che conta: prima, alcune
    //    di queste sei tornavano con un errore di chiave duplicata.
    for (const r of insieme) expect(r.error).toBeNull();
    for (const r of insieme) miei.dettature.push(r.data.dettatura_id);

    const { data: righe } = await titolare
      .from("azioni_dettate")
      .select("id, appunto_id")
      .in("dettatura_id", insieme.map((r) => r.data.dettatura_id));
    for (const r of righe ?? []) {
      miei.azioni.push(r.id);
      if (!miei.appunti.includes(r.appunto_id)) miei.appunti.push(r.appunto_id);
    }

    expect(righe).toHaveLength(6);
    // ...e stanno tutte nello stesso appunto: la gara non ha nemmeno
    // prodotto due appunti mezzi pieni.
    expect(new Set(righe.map((r) => r.appunto_id)).size).toBe(1);
  });

  it.skipIf(!CORRIDOIO)("due «l'ho fatta io a mano» lasciano l'appunto chiuso, non aperto e vuoto", async () => {
    // Prima della correzione ognuna delle due bloccava solo la propria riga,
    // vedeva l'altra ancora in attesa nel proprio istantaneo, e nessuna
    // chiudeva l'appunto: restava nell'elenco delle cose da approvare senza
    // niente dentro, per sempre.
    const laMiaLista = crypto.randomUUID();
    const righe = [];
    for (const n of [1, 2]) {
      const r = await detta(`a mano ${n} ${laMiaLista.slice(0, 8)}`, [
        elemento("lista_spesa", {
          dati: { nome_libero: `${NOME} a mano ${n}`, lista: laMiaLista },
        }),
      ]);
      righe.push(r[0]);
    }
    expect(righe[1].appunto_id).toBe(righe[0].appunto_id);

    // Le due chiusure partono insieme.
    const esiti = await Promise.all(
      righe.map((r) =>
        titolare.functions.invoke("operazioni-atomiche", {
          body: { operazione: "chiudi_azione_a_mano", parametri: { p_id: r.id } },
        }),
      ),
    );
    for (const e of esiti) expect(e.error).toBeNull();

    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("stato")
      .eq("id", righe[0].appunto_id)
      .single();

    // 🔴 L'APPUNTO NON E' RIMASTO APERTO E VUOTO.
    expect(appunto.stato).toBe("approvato");

    const { data: dentro } = await titolare
      .from("azioni_dettate")
      .select("stato")
      .eq("appunto_id", righe[0].appunto_id);
    for (const r of dentro ?? []) expect(r.stato).toBe("fatta_a_mano");
  });

  it("il numero della Dashboard conta gli APPUNTI, non le righe dette", async () => {
    const { data } = await titolare.rpc("voce_da_guardare");
    const r = Array.isArray(data) ? data[0] : data;

    const { data: elenco } = await titolare.rpc("appunti_da_approvare");

    // 🔴 IL NUMERO DEL SEGNO E L'ELENCO CHE SI APRE SONO LO STESSO NUMERO,
    //    e si prova cosi' invece che con un «almeno uno»: un segno che dice
    //    5 e una schermata che ne mostra 3 è peggio di nessun segno.
    expect(r.quante).toBe(elenco.length);

    // ⚠️ E le righe sono DI PIU' degli appunti: se il conteggio guardasse
    //    le righe manderebbe a cercare tre cose dove ce n'e' una. Questa
    //    riga vale perché sopra è stata dettata una lista da tre.
    const righeInAttesa = elenco.reduce((somma, a) => somma + a.quanti, 0);
    expect(righeInAttesa).toBeGreaterThan(elenco.length);
  });
});
