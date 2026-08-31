import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita, righeMie } from "./aiuto";

// I comandi vocali, provati sul database vero.
//
// 🔴 PERCHÉ NON BASTANO LE PROVE DENTRO LE MIGRAZIONI: quelle girano come
//    PROPRIETARIE del database e scavalcano la RLS. Un difetto che vive
//    nei permessi lì dentro è invisibile — è la lezione del 16/08, quando
//    per due settimane nessuno poteva marcare una ricetta «pronta per la
//    carta» e ogni verifica passava verde.
//
// 🔴 E IN QUESTO BLOCCO NON È UNA PRECAUZIONE TEORICA: il primo collaudo
//    con l'API vera ha trovato esattamente quello — le tre funzioni che
//    traducono un numero del catalogo erano rimaste senza permesso, e il
//    rifiuto si travestiva da «non ho trovato il prodotto».
//
// ⚠️ Le righe si cancellano SOLO per identificativo (regola del 23/08):
//    `righeMie` se li segna mentre nascono.

const titolare = await clientAutenticato(credenziali().titolare);
const staff = await clientAutenticato(credenziali().staff);

const mie = righeMie(titolare);
let ingrediente = null;
let numeroDelProdotto = null;

beforeAll(async () => {
  const entita = await primaEntita(titolare);
  // ⚠️ Il nome comincia per zeta apposta: il catalogo si ordina per nome,
  //    quindi questo prodotto è l'ultimo e il suo numero è il conto dei
  //    prodotti. Così la prova non dipende da quanti ce ne sono.
  const { data, error } = await titolare
    .from("ingredients")
    .insert({
      entity_id: entita,
      name: "ZZZ-PROVA-voce",
      category: "verdura",
      unit: "kg",
      alimentare: true,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  ingrediente = mie.segna("ingredients", data.id);

  // 🔴 IL NUMERO SI CERCA NEL CATALOGO, NON SI DEDUCE DAL CONTEGGIO.
  //    La prima versione faceva così — «il nome comincia per zeta, quindi
  //    è l'ultimo, quindi il suo numero è quanti prodotti ci sono» — e si
  //    è rotta alla seconda esecuzione: una corsa precedente aveva
  //    lasciato un omonimo, il numero puntava a quello, e la prova
  //    falliva su un difetto che non esisteva.
  // ⚠️ E se gli omonimi ci sono, questa prova LO DICE invece di scegliere
  //    a caso: un residuo va tolto, non aggirato.
  const { data: catalogo } = await titolare.rpc("voce_catalogo");
  const trovati = catalogo.prodotti.filter((p) => p.nome === "ZZZ-PROVA-voce");
  expect(
    trovati.length,
    "c'è più di un «ZZZ-PROVA-voce» in magazzino: una corsa precedente ha lasciato un residuo da togliere",
  ).toBe(1);
  numeroDelProdotto = trovati[0].n;
});

afterAll(async () => {
  // ⚠️ ALLINEARE UNA GIACENZA NE PRODUCE ALTRE: la rettifica nel suo
  //    registro e le partite in magazzino. Non le ho create io con una
  //    insert, quindi `righeMie` non le conosce — ma il filtro NON è «la
  //    più recente»: è **il mio prodotto**, che l'identificativo ce l'ha
  //    e me lo sono segnato. È la regola del 23/08 applicata alle righe
  //    figlie.
  // ⚠️ E l'ordine conta: le figlie prima della madre, o la chiave esterna
  //    respinge — che è esattamente quello che è successo la prima volta
  //    che questa prova ha girato, rumorosamente e non in silenzio.
  if (ingrediente) {
    for (const tabella of ["rettifiche_giacenza", "stock_consumptions", "stock_lots"]) {
      await titolare.from(tabella).delete().eq("ingredient_id", ingrediente);
    }
  }
  await mie.pulisci();
  await titolare.auth.signOut({ scope: "local" });
  await staff.auth.signOut({ scope: "local" });
});

describe("il criterio salva-da-sé", () => {
  // 🔴 I QUATTRO INCROCI, e servono tutti e quattro: una funzione che
  //    rispondesse sempre «sì» passerebbe il solo caso buono, e una che
  //    rispondesse sempre «no» passerebbe il solo caso cattivo.
  it("una misura sicura si salva da sé, una creazione sicura no", async () => {
    const chiedi = async (tipo, sicuro) => {
      const { data, error } = await titolare.rpc("azione_si_esegue_da_se", {
        p_tipo: tipo,
        p_sicuro: sicuro,
      });
      expect(error).toBeNull();
      return data;
    };

    expect(await chiedi("giacenza", true)).toBe(true);
    expect(await chiedi("giacenza", false)).toBe(false);
    // ⚠️ Questo è il controllo che vale di più: sicurissimo e comunque no.
    expect(await chiedi("movimento_cassa", true)).toBe(false);
    expect(await chiedi("movimento_cassa", false)).toBe(false);
  });

  it("un tipo che non esiste non si salva da sé", async () => {
    const { data } = await titolare.rpc("azione_si_esegue_da_se", {
      p_tipo: "questo-non-esiste",
      p_sicuro: true,
    });
    expect(data).toBe(false);
  });
});

describe("il catalogo e la traduzione dei numeri", () => {
  // 🔴 IL DIFETTO CHE QUESTA PROVA ESISTE PER PRENDERE: se le funzioni di
  //    traduzione perdessero il permesso, o se numerazione e traduzione
  //    divergessero, un prodotto verrebbe scambiato per un altro SENZA
  //    NESSUN ERRORE.
  it("il numero del catalogo torna al prodotto giusto, dal client vero", async () => {
    const { data: catalogo, error } = await titolare.rpc("voce_catalogo");
    expect(error).toBeNull();
    expect(catalogo.prodotti.length).toBeGreaterThan(0);

    const nostro = catalogo.prodotti.find((p) => p.n === numeroDelProdotto);
    expect(nostro.nome).toBe("ZZZ-PROVA-voce");
    expect(nostro.unita).toBe("kg");
  });

  it("il catalogo non porta prezzi né giacenze", async () => {
    const { data } = await titolare.rpc("voce_catalogo");
    const chiavi = Object.keys(data.prodotti[0]);
    // ⚠️ Quello che non serve a capire una frase non si manda a nessuno.
    expect(chiavi.sort()).toEqual(["n", "nome", "unita"]);
  });

  it("lo staff non vede il catalogo della voce", async () => {
    const { error } = await staff.rpc("voce_catalogo");
    expect(error).not.toBeNull();
  });
});

describe("una dettatura fa quello che ha capito", () => {
  // 🔴 IL TITOLO E DIVERSO A OGNI GIRO — 31/08/2026, dopo un rosso vero.
  //
  //    Prima era fisso («PROVA-voce una cosa») e la prova pretendeva di
  //    trovarne **una**. Il 31/08 un giro e' stato ucciso dal limite di tempo
  //    del lavoro **mentre girava**: la sua pulizia non e' mai partita, la
  //    riga e' rimasta, e il giro dopo ne ha trovate **due**.
  //
  // ⚠️ E il difetto si aggravava da solo: `mie.segna` veniva DOPO
  //    l'affermazione, quindi ogni fallimento lasciava dietro anche la riga
  //    appena creata. Due oggi, tre domani, per sempre.
  //
  // ⚠️ E' la regola del 23/08 applicata al nome invece che all'identificativo:
  //    *il perimetro di una prova dev'essere fatto di roba che la prova ha
  //    creato* — e un nome uguale a ogni giro non e' roba di questo giro.
  //    Con un nome diverso ogni volta, un residuo di ieri non puo' piu'
  //    confondersi con la riga di adesso.
  const titoloDelPromemoria = `PROVA-voce una cosa ${crypto.randomUUID().slice(0, 8)}`;

  it("le misure sicure si salvano, le creazioni aspettano — nella stessa filza", async () => {
    // ⚠️ Si portano via i residui dei giri uccisi a meta': stesso marcatore
    //    «PROVA-voce una cosa», sul database di PROVA, dove nessun impegno
    //    vero puo' chiamarsi cosi'. Senza, quelle righe resterebbero li' per
    //    sempre — e le prove girano una alla volta, quindi non c'e' nessun
    //    altro giro a cui possano appartenere.
    await titolare.from("tasks").delete().like("title", "PROVA-voce una cosa%");

    const { data, error } = await titolare.rpc("registra_dettatura", {
      p_testo: "PROVA-voce: ricordami una cosa e cinquanta euro di gasolio",
      p_azioni: [
        {
          tipo: "promemoria",
          sicuro: true,
          frase: `Promemoria: ${titoloDelPromemoria}`,
          dati: { titolo: titoloDelPromemoria },
        },
        {
          tipo: "movimento_cassa",
          sicuro: true,
          frase: "Cassa: 50 euro di gasolio",
          dati: { sentito: "cinquanta euro di gasolio" },
        },
      ],
    });
    expect(error).toBeNull();
    mie.segna("dettature", data.dettatura_id);

    expect(data.azioni).toBe(2);
    expect(data.eseguite).toBe(1);
    expect(data.da_guardare).toBe(1);

    const { data: azioni } = await titolare.rpc("azioni_della_dettatura", {
      p_id: data.dettatura_id,
    });
    expect(azioni[0].stato).toBe("eseguita");
    // ⚠️ Il promemoria è nato DAVVERO: si va a cercarlo in Agenda invece
    //    di fidarsi dello stato scritto sulla riga. «Eseguita» e «ha
    //    prodotto qualcosa» sono due affermazioni diverse.
    const { data: nato } = await titolare
      .from("tasks").select("id").eq("title", titoloDelPromemoria);
    // ⚠️ SI SEGNA PRIMA DI AFFERMARE, e non e' pignoleria: se
    //    l'affermazione qui sotto fallisce, la riga appena creata deve
    //    comunque essere ripulita. Segnandola dopo, ogni fallimento
    //    lasciava un residuo che rendeva rosso anche il giro successivo.
    for (const t of nato ?? []) mie.segna("tasks", t.id);
    expect(nato).toHaveLength(1);
    expect(azioni[1].stato).toBe("in_attesa");
    expect(azioni[1].natura).toBe("creazione");
  });

  // 🔴 CHE LA GIACENZA SCENDA DAVVERO NON SI PROVA QUI, ed è dichiarato
  //    invece che dimenticato: allineare una giacenza scrive in due
  //    REGISTRI che nessun client può cancellare — 
  //    e  non hanno nessuna policy di delete, ed è
  //    giusto così. Una prova dal client che li riempisse lascerebbe
  //    righe finte in mezzo a quelle vere, che è ciò che il §5 punto 8
  //    vieta.
  //    ⚠️ Quel controllo vive nella verifica della migrazione
  //    , che gira come proprietaria e si ripulisce per
  //    intero: là la giacenza va da 5 a 3 e lo scarico resta registrato
  //    come spreco.

  // 🔴 IL FRIGO NON SI INDOVINA MAI: quel registro va all'ASP.
  it("una temperatura senza il frigo resta in attesa e lo dice", async () => {
    const { data, error } = await titolare.rpc("registra_dettatura", {
      p_testo: "PROVA-voce: segna tre gradi",
      p_azioni: [
        { tipo: "temperatura", sicuro: true, frase: "3 gradi", dati: { gradi: 3 } },
      ],
    });
    expect(error).toBeNull();
    mie.segna("dettature", data.dettatura_id);
    expect(data.eseguite).toBe(0);

    const { data: azioni } = await titolare.rpc("azioni_della_dettatura", {
      p_id: data.dettatura_id,
    });
    expect(azioni[0].stato).toBe("in_attesa");
    expect(azioni[0].motivo).toMatch(/frigo/i);
  });

  // ⚠️ Il caso in cui l'assistente non capisce: non inventa, e non lascia
  //    cadere. La frase resta scritta.
  it("quello che non capisce diventa una nota, non un silenzio", async () => {
    const { data, error } = await titolare.rpc("registra_dettatura", {
      p_testo: "PROVA-voce: quella cosa là del coso",
      p_azioni: [
        {
          tipo: "nota_non_capita",
          sicuro: true,
          frase: "Da riguardare",
          dati: { sentito: "PROVA-voce quella cosa là del coso" },
        },
      ],
      p_esito: "non_capita",
    });
    expect(error).toBeNull();
    mie.segna("dettature", data.dettatura_id);
    expect(data.eseguite).toBe(1);

    const { data: task } = await titolare
      .from("tasks")
      .select("id, description")
      .eq("origine_modulo", "voce")
      .like("description", "%PROVA-voce quella cosa%");
    expect(task).toHaveLength(1);
    mie.segna("tasks", task[0].id);
  });
});

describe("le cose in attesa non scadono", () => {
  it("compaiono nell'elenco con da quanti giorni aspettano", async () => {
    const { data, error } = await titolare.rpc("azioni_dettate_in_attesa");
    expect(error).toBeNull();
    const nostre = data.filter((a) => a.testo_detto?.startsWith("PROVA-voce"));
    expect(nostre.length).toBeGreaterThanOrEqual(2);
    for (const a of nostre) {
      expect(a.giorni).toBe(0);
      // ⚠️ Un elenco di cose in attesa senza il perché è un elenco di
      //    cose di cui non si sa che fare.
      expect(a.motivo ?? a.errore).toBeTruthy();
    }
  });

  it("il contatore della Dashboard le vede", async () => {
    const { data, error } = await titolare.rpc("voce_da_guardare");
    expect(error).toBeNull();
    const r = Array.isArray(data) ? data[0] : data;
    expect(r.quante).toBeGreaterThanOrEqual(2);
  });

  // ⚠️ Non solleva un'eccezione allo staff ma risponde zero: è un
  //    contatore in cima a una schermata condivisa, e un rifiuto lì
  //    farebbe comparire un errore rosso a chi non c'entra niente.
  it("allo staff risponde zero invece di gridare", async () => {
    const { data, error } = await staff.rpc("voce_da_guardare");
    expect(error).toBeNull();
    const r = Array.isArray(data) ? data[0] : data;
    expect(r.quante).toBe(0);
  });
});

describe("le chiavi della Scorciatoia", () => {
  let chiave = null;
  let chiaveId = null;

  it("nasce, e la chiave in chiaro non resta nel database", async () => {
    const { data, error } = await titolare.rpc("crea_chiave_voce", {
      p_nome: "PROVA-voce scorciatoia",
    });
    expect(error).toBeNull();
    chiave = data.chiave;
    chiaveId = mie.segna("chiavi_voce", data.id);
    expect(chiave.length).toBeGreaterThan(20);

    const { data: riga } = await titolare
      .from("chiavi_voce")
      .select("impronta")
      .eq("id", chiaveId)
      .single();
    // 🔴 Da un'impronta non si risale alla chiave.
    expect(riga.impronta).not.toBe(chiave);
    expect(riga.impronta).toMatch(/^[0-9a-f]{64}$/);
  });

  it("una chiave inventata non apre niente", async () => {
    const { error } = await titolare.rpc("voce_apri_sessione", {
      p_chiave: "questa-chiave-non-esiste-proprio",
    });
    expect(error).not.toBeNull();
  });

  it("revocata, non apre più", async () => {
    const { error: e1 } = await titolare.rpc("revoca_chiave_voce", { p_id: chiaveId });
    expect(e1).toBeNull();
    const { error: e2 } = await titolare.rpc("voce_apri_sessione", { p_chiave: chiave });
    expect(e2).not.toBeNull();
  });
});

describe("chi non è il titolare non tocca niente", () => {
  it("lo staff non può dettare", async () => {
    const { error } = await staff.rpc("registra_dettatura", {
      p_testo: "PROVA-voce dallo staff",
      p_azioni: [],
    });
    expect(error).not.toBeNull();
  });

  it("lo staff non vede le cose dettate", async () => {
    const { error } = await staff.rpc("azioni_dettate_in_attesa");
    expect(error).not.toBeNull();
  });

  // ⚠️ E le tre traduttrici non sono di NESSUNO: ci si arriva solo da
  //    dentro il database. Se un giorno qualcuno le concedesse, questa
  //    prova diventa rossa da sola.
  it("le funzioni che traducono i numeri non sono chiamabili da fuori", async () => {
    for (const f of ["voce_prodotto_numero", "voce_frigorifero_numero", "voce_pulizia_numero"]) {
      const { error } = await titolare.rpc(f, { p_n: 1 });
      expect(error, `${f} è diventata chiamabile dal browser`).not.toBeNull();
    }
  });
});

// =====================================================================
// LA PROMESSA CHE IL GESTIONALE NON MANTIENE — 27/08/2026
// =====================================================================
// 🔴 Il 27/08 undici tipi di comando vocale erano accesi e SETTE avevano
//    un'esecuzione: i quattro scoperti erano esattamente quelli che
//    toccano i soldi e le cose nuove. Nessun errore, nessun avviso —
//    finché Alessio non premeva «Sì, fallo» e non succedeva niente.
//
// ⚠️ Questa prova guarda una PROPRIETÀ e non un conteggio: non «sono
//    undici», ma «nessuno di quelli accesi è scoperto». Un numero qui
//    sarebbe scaduto al primo tipo aggiunto.
describe("un tipo acceso deve saperlo fare davvero", () => {
  it("nessun tipo vocale acceso è senza esecuzione", async () => {
    const { data, error } = await titolare.rpc("tipi_vocali_senza_ramo");
    expect(error).toBeNull();
    expect(
      data,
      `Il gestionale propone a voce cose che poi non sa fare: ${(data ?? [])
        .map((r) => r.tipo)
        .join(", ")}`,
    ).toEqual([]);
  });

  // ⚠️ Le due traduttrici nuove seguono la regola delle altre tre: non
  //    sono di nessuno, ci si arriva solo da dentro il database.
  it("le traduttrici di causali e fornitori non sono chiamabili da fuori", async () => {
    for (const f of ["voce_causale_numero", "voce_fornitore_numero"]) {
      const { error } = await titolare.rpc(f, { p_n: 1 });
      expect(error, `${f} è diventata chiamabile dal browser`).not.toBeNull();
    }
  });
});

// =====================================================================
// LA PORTA CHE RESPINGEVA L'OROLOGIO — 27/08/2026
// =====================================================================
// 🔴 Alessio ha costruito la Scorciatoia esattamente come dicono le
//    istruzioni della schermata, e ha ricevuto
//    `{"message":"Missing authorization header","code":"UNAUTHORIZED_NO_AUTH_HEADER"}`
//    — un rifiuto del CANCELLO, prima che la funzione guardasse la chiave.
//
// ⚠️ La protezione tolta non proteggeva niente: il token che il cancello
//    pretendeva è la chiave anon, che è **pubblica** e sta nel pacchetto
//    del sito. Fermava la Scorciatoia di Alessio e nessun altro. La
//    guardia vera è la chiave, controllata dentro **prima** di spendere.
//
// ⚠️ QUESTA PROVA NON COSTA UNA CHIAMATA ALL'ASSISTENTE: senza credenziali
//    valide la funzione risponde 401 molto prima di parlare col modello.
//    È il motivo per cui si può tenere accesa.
describe("la Scorciatoia entra senza nessun accesso, e la chiave fa la guardia", () => {
  const indirizzo = `${process.env.VITE_SUPABASE_URL}/functions/v1/ascolta-voce`;

  // Come manda la Scorciatoia: solo corpo JSON, nessuna intestazione.
  const comeLOrologio = async (corpo) => {
    const r = await fetch(indirizzo, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    let letto;
    try {
      letto = JSON.parse(await r.text());
    } catch {
      letto = null;
    }
    return { stato: r.status, corpo: letto };
  };

  it("il cancello non respinge più prima della chiave", async () => {
    const r = await comeLOrologio({ testo: "PROVA-voce dal cancello", chiave: "non-vale" });
    // 🔴 Il rifiuto dev'essere NOSTRO e in italiano. Se torna
    //    «Missing authorization header», la verifica del token è stata
    //    riaccesa e la Scorciatoia è di nuovo muta.
    expect(
      r.corpo?.message,
      "Il cancello respinge di nuovo prima della chiave: reinstallare la funzione della voce",
    ).not.toBe("Missing authorization header");
    expect(r.corpo?.errore?.messaggio).toMatch(/chiave/i);
  });

  // ⚠️ «Non esiste» e «è stata tolta» devono rispondere UGUALE: sono due
  //    informazioni utili solo a chi sta provando a indovinarla.
  it("chiave sbagliata e chiave revocata dicono la stessa cosa", async () => {
    const { data: creata, error } = await titolare.rpc("crea_chiave_voce", {
      p_nome: `PROVA-voce ${Date.now()}`,
    });
    expect(error).toBeNull();
    try {
      await titolare.rpc("revoca_chiave_voce", { p_id: creata.id });
      const revocata = await comeLOrologio({ testo: "PROVA-voce", chiave: creata.chiave });
      const inesistente = await comeLOrologio({ testo: "PROVA-voce", chiave: "questa-non-esiste" });
      expect(revocata.stato).toBe(inesistente.stato);
      expect(revocata.corpo?.errore?.messaggio).toBe(inesistente.corpo?.errore?.messaggio);
    } finally {
      await titolare.from("chiavi_voce").delete().eq("id", creata.id);
    }
  });

  it("senza nessuna chiave la frase parla di chiave, non di accesso", async () => {
    // ⚠️ Chi arriva qui senza niente è quasi sempre una Scorciatoia a cui
    //    manca il campo: «autenticazione mancante» lo manderebbe a cercare
    //    un accesso che non deve avere.
    const r = await comeLOrologio({ testo: "PROVA-voce senza chiave" });
    expect(r.stato).toBe(401);
    expect(r.corpo?.errore?.messaggio).toMatch(/chiave/i);
  });

  // 🔴 QUESTA PROVA SI PROVA SU UN CASO DI CUI SI CONOSCE GIÀ LA RISPOSTA.
  //    Provare a riaccendere il cancello per vedere la prova diventare
  //    rossa **non si può**: il comando del CLI ha solo il flag che lo
  //    spegne, e il valore è appiccicoso — misurato, una reinstallazione
  //    senza flag l'ha lasciato spento. Quindi si dimostra l'altra metà:
  //    che il segnale cercato **esiste e si riconosce**, su due porte che
  //    il cancello lo tengono ancora chiuso davvero.
  //
  // ⚠️ Se un giorno anche queste due rispondessero in italiano, vorrebbe
  //    dire che il cancello è stato spento su TUTTO — e allora è questa
  //    prova a doverlo dire, non un riepilogo.
  it("il segnale del cancello esiste, e si riconosce", async () => {
    for (const f of ["leggi-foto", "operazioni-atomiche"]) {
      const r = await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/${f}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const letto = JSON.parse(await r.text());
      expect(r.status, `${f} non è più dietro il cancello`).toBe(401);
      expect(letto.message, `${f} non è più dietro il cancello`).toBe(
        "Missing authorization header",
      );
    }
  });
});

// =====================================================================
// LE TRE DOMANDE, E LA SCELTA CHE NON ERA STATA OFFERTA — 27/08/2026
// =====================================================================
// 🔴 La verifica dentro la migrazione prova il rifiuto con un
//    identificativo INESISTENTE — e quella rottura fa scattare il
//    guardiano sbagliato: la scelta viene accettata e poi fallisce più
//    sotto, perché quel prodotto non c'è. Misurato rompendo apposta.
//
// ⚠️ La rottura giusta è un prodotto che **esiste davvero** e che **non
//    era fra i candidati**: lì l'unico controllo che può scattare è
//    quello dei candidati. È la trappola del 26/08 letta al contrario —
//    prima di rompere, guardare quale guardiano scatta per primo.
describe("una scelta che non era stata offerta si rifiuta", () => {
  it("un prodotto vero, ma non proposto, viene respinto", async () => {
    const { data: prodotti } = await titolare
      .from("ingredients")
      .select("id,name")
      .order("name")
      .limit(3);
    expect(prodotti?.length, "servono tre prodotti per questa prova").toBe(3);

    // I candidati sono i primi due; il terzo esiste e non è fra loro.
    const { data: det, error: e1 } = await titolare
      .from("dettature")
      .insert({ testo: "PROVA-voce scelta non offerta", provenienza: "app", esito: "capita" })
      .select("id")
      .single();
    expect(e1).toBeNull();

    try {
      const { data: az, error: e2 } = await titolare
        .from("azioni_dettate")
        .insert({
          dettatura_id: det.id,
          progressivo: 1,
          tipo: "giacenza",
          dati: { quanto_ce: 1, candidati: [1, 2], nome_sentito: "PROVA-voce" },
          sicuro: false,
          frase: "PROVA-voce: quanto ce n'è",
          stato: "in_attesa",
        })
        .select("id")
        .single();
      expect(e2).toBeNull();

      const { error } = await titolare.rpc("scegli_per_azione_dettata", {
        p_id: az.id,
        p_scelta: prodotti[2].id,
      });
      expect(error, "una scelta mai proposta è stata accettata").not.toBeNull();
      expect(error.message).toMatch(/proposto/i);

      // ⚠️ E la riga non si è mossa: un rifiuto che lascia lo stato a metà
      //    sarebbe peggio del rifiuto mancante.
      const { data: dopo } = await titolare
        .from("azioni_dettate")
        .select("stato,dati")
        .eq("id", az.id)
        .single();
      expect(dopo.stato).toBe("in_attesa");
      expect(dopo.dati.ingredient_id).toBeUndefined();
    } finally {
      await titolare.from("azioni_dettate").delete().eq("dettatura_id", det.id);
      await titolare.from("dettature").delete().eq("id", det.id);
    }
  });
});
