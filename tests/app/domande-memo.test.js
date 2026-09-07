import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { supabase } from "../../src/lib/supabase";
import { clientAutenticato, credenziali, marchio, primaEntita, righeMie } from "./aiuto";
import { letturePerDomanda, rispondiA } from "../../src/lib/api/domandeMemo";
import { componiRisposta } from "../../src/lib/calcoli/domande";
import { eDiOggi } from "../../src/lib/calcoli/agenda";
import { oggiLocale } from "../../src/lib/constants";

// =====================================================================
// MEMO CONSULTIVO — le nove domande contro il database vero
// =====================================================================
// 🔴 PERCHÉ NON BASTANO LE PROVE PURE: quelle sanno che la regola compone
//    la frase giusta a partire dai dati. Non sanno se i dati ARRIVANO —
//    e in questo progetto un permesso mancante non dà un errore rosso: dà
//    una risposta più corta, o un rifiuto travestito. È la lezione del
//    16/08 (per due settimane nessuno poteva marcare una ricetta «pronta»
//    e ogni verifica passava verde) e quella del 26/08 sul modulo voce.
//
// 🔴 E SI ENTRA DAL COLLEGAMENTO DELL'APP, non da un client proprio: le
//    funzioni di `api/` usano quello, ed è l'unico modo di esercitare il
//    tratto **fra schermata e database**. Con un client suo la prova
//    parlerebbe da anonima — è successo il 18/08 sui coperti.
//
// ⚠️ Le righe si cancellano SOLO per identificativo (regola del 23/08):
//    `righeMie` se li segna mentre nascono.

const MARCA = marchio("PROVA-domande");
const titolare = await clientAutenticato(credenziali().titolare);
const staff = await clientAutenticato(credenziali().staff);
const mie = righeMie(titolare);

let ingrediente = null;
let ricetta = null;
let impegnoDiOggi = null;
let impegnoSenzaData = null;
let entrato = false;

beforeAll(async () => {
  const { error } = await supabase.auth.signInWithPassword(credenziali().titolare);
  if (error) throw new Error(`Non riesco a entrare come titolare: ${error.message}`);
  entrato = true;

  const entita = await primaEntita(titolare);

  // Un prodotto mio, sotto la scorta minima: senza lotti la giacenza è 0 e
  // la soglia è 5, quindi «cosa mi manca» deve nominarlo.
  const { data: ing, error: eIng } = await titolare
    .from("ingredients")
    .insert({
      entity_id: entita,
      name: `${MARCA} olio di prova`,
      category: "verdura",
      unit: "l",
      alimentare: true,
      stock_minimum_threshold: 5,
    })
    .select("id")
    .single();
  expect(eIng, "non sono riuscito a creare il prodotto di prova").toBeNull();
  ingrediente = mie.segna("ingredients", ing.id);

  const { data: ric, error: eRic } = await titolare
    .from("recipes")
    .insert({
      name: `${MARCA} carbonara di prova`,
      category: "primo",
      recipe_type: "piatto_finito",
      portions_yield: 1,
    })
    .select("id")
    .single();
  expect(eRic, "non sono riuscito a creare la ricetta di prova").toBeNull();
  ricetta = mie.segna("recipes", ric.id);

  const { data: tsk, error: eTsk } = await titolare
    .from("tasks")
    .insert({
      title: `${MARCA} portare i corrispettivi`,
      status: "da_fare",
      due_date: oggiLocale(),
      // ⚠️ NON visibile alla sala, apposta: è la riga su cui si misura che
      //    MEMO non consegna a chi non deve vedere.
      visibile_staff: false,
    })
    .select("id")
    .single();
  expect(eTsk, "non sono riuscito a creare l'impegno di prova").toBeNull();
  impegnoDiOggi = mie.segna("tasks", tsk.id);

  // 🔴 UN IMPEGNO SENZA SCADENZA, ed è la riga su cui si misura il difetto
  //    del 07/09: MEMO contava fra le cose di oggi tutta la corsia
  //    «quando capita», perché `Number(null)` vale zero. Sul progetto di
  //    prova erano quindici, e l'Agenda ne mostrava zero.
  const { data: quando, error: eQuando } = await titolare
    .from("tasks")
    .insert({
      title: `${MARCA} valutare il secondo forno`,
      status: "da_fare",
      due_date: null,
    })
    .select("id")
    .single();
  expect(eQuando, "non sono riuscito a creare l'impegno senza scadenza").toBeNull();
  impegnoSenzaData = mie.segna("tasks", quando.id);
});

afterAll(async () => {
  await mie.pulisci();
  if (entrato) await supabase.auth.signOut({ scope: "local" });
});

/**
 * UNA FRASE DETTA DAVVERO, dalla bocca alla risposta.
 *
 * 🔴 PERCHE' NON BASTA `rispondiA()`: quella parte da una domanda già
 * classificata. Qui si esercita anche il tratto che sta su Internet — il
 * modello che capisce, la funzione online che decide, il registro che
 * scrive — ed è il tratto dove vivono i difetti che nessuna prova pura
 * può vedere (il 06/09 il corridoio installato solo sulla prova, il 07/09
 * l'astice cercato fra gli impegni).
 *
 * ⚠️ COSTA UNA CHIAMATA AL MODELLO PER GIRO (~0,08 € sul progetto di
 * prova, misurato il 07/09). Col credito finito o col tetto raggiunto non
 * costa niente e la prova resta valida per la parte che pretende sempre:
 * **zero appunti**.
 *
 * ⚠️ SI RIPULISCE SEMPRE, anche quando la prova sta per diventare rossa:
 * se un appunto è nato è roba di questa prova, e si cancella per
 * identificativo (regola del 23/08).
 */
async function dettaEPulisci(frase) {
  const { data: prima } = await titolare.rpc("appunti_da_approvare");
  const { data, error } = await titolare.functions.invoke("ascolta-voce", {
    body: { testo: frase },
  });
  const { data: dopo } = await titolare.rpc("appunti_da_approvare");
  const nati = (dopo ?? []).filter((a) => !(prima ?? []).some((b) => b.id === a.id));
  for (const a of nati) await titolare.from("appunti_vocali").delete().eq("id", a.id);
  const id = data?.dettatura_id ?? data?.dettatura?.dettatura_id;
  if (id) await titolare.from("dettature").delete().eq("id", id);
  return { data, error, nati, quantiPrima: (prima ?? []).length, quantiDopo: (dopo ?? []).length };
}

/** L'assistente ha risposto? Se no, la prova lo DICE invece di tacere. */
function haRisposto({ data, error }) {
  if (error || data?.esito !== "domanda") {
    expect(
      data?.messaggio ?? String(error),
      "l'assistente non ha risposto: la catena non è stata provata",
    ).toBeTruthy();
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------
describe("le nove domande leggono davvero", () => {
  const NOVE = [
    { chiede: "ricetta_esiste", soggetto: `${MARCA} carbonara di prova` },
    { chiede: "allergeni", soggetto: `${MARCA} carbonara di prova` },
    { chiede: "piatti_in_carta" },
    { chiede: "quanto_ho", soggetto: `${MARCA} olio di prova` },
    { chiede: "cosa_manca" },
    { chiede: "cosa_scade" },
    { chiede: "agenda_oggi" },
    { chiede: "agenda_in_ritardo" },
    { chiede: "quando_scade", soggetto: `${MARCA} portare i corrispettivi` },
  ];

  it("🔴 nessuna delle nove risponde «non lo so»: le fonti si leggono tutte", async () => {
    // 🔴 È la prova dei permessi, e funziona proprio perché la regola pura
    //    non finge: un rifiuto del database arriva qui come «non lo so»,
    //    non come un elenco vuoto. Se domani una `grant` cadesse, questa
    //    riga diventa rossa da sola invece di far comparire uno zero.
    const storte = [];
    for (const domanda of NOVE) {
      const { risposta } = await rispondiA(domanda);
      if (risposta.stato === "non_lo_so") storte.push(`${domanda.chiede}: ${risposta.frase}`);
    }
    expect(storte, "queste fonti non si sono lasciate leggere:\n  " + storte.join("\n  ")).toEqual(
      [],
    );
  });

  it("...e ognuna porta da qualche parte", async () => {
    for (const domanda of NOVE) {
      const { risposta } = await rispondiA(domanda);
      expect(risposta.a, domanda.chiede).toBeTruthy();
    }
  });
});

describe("le risposte dicono quello che c'è davvero", () => {
  it("«ho la ricetta di X?» trova la ricetta vera, col suo collegamento", async () => {
    const { risposta } = await rispondiA({
      chiede: "ricetta_esiste",
      soggetto: `${MARCA} carbonara di prova`,
    });
    expect(risposta.stato).toBe("risposta");
    expect(risposta.frase).toMatch(/^Sì/);
    expect(risposta.a).toBe(`/ricettario/ricette/${ricetta}`);
  });

  it("una ricetta che non c'è ottiene un NO, non un «non lo so»", async () => {
    const { risposta } = await rispondiA({
      chiede: "ricetta_esiste",
      soggetto: `${MARCA} piatto che non esiste`,
    });
    expect(risposta.stato).toBe("risposta");
    expect(risposta.frase).toMatch(/^No/);
  });

  it("«quanto X ho?» legge la giacenza vera, e la sua unità", async () => {
    const { risposta } = await rispondiA({
      chiede: "quanto_ho",
      soggetto: `${MARCA} olio di prova`,
    });
    expect(risposta.stato).toBe("risposta");
    expect(risposta.frase).toContain("olio di prova");
    // Nessun lotto: zero litri, ed è una risposta vera — il prodotto c'è.
    expect(risposta.frase).toContain("0 l");
  });

  it("un prodotto che non c'è NON vale zero", async () => {
    const { risposta } = await rispondiA({
      chiede: "quanto_ho",
      soggetto: `${MARCA} bottarga che non esiste`,
    });
    expect(risposta.frase).toContain("non ce l'ho in magazzino");
  });

  it("🔴 «cosa mi manca?» dice ESATTAMENTE quello che dice il Magazzino", async () => {
    // 🔴 QUESTA PROVA È NATA ROSSA, ed è stata la misura a raddrizzarla: sul
    //    progetto di prova i prodotti sotto la scorta minima sono più di
    //    cento, e l'elenco si taglia a sei righe dichiarando quante ne
    //    restano. Cercare il proprio prodotto fra le sei visibili
    //    dipendeva dall'ordine alfabetico — cioè era una prova che passava
    //    per caso.
    // ⚠️ La domanda giusta non è «c'è la mia riga?» ma **«la risposta
    //    combacia col database?»**, che è precisamente la promessa della
    //    fase 1: quello che MEMO dice si può andare a controllare.
    const { data: giacenze, error } = await titolare.from("v_stock_levels").select("*");
    expect(error).toBeNull();
    // ⚠️ Stesso criterio della schermata del Magazzino: un prodotto fuori
    //    magazzino non è mai «sotto soglia».
    const sotto = (giacenze ?? []).filter(
      (g) => g.below_threshold === true && g.tenuto_in_magazzino !== false,
    );

    // Il perimetro è roba mia: il prodotto creato qui è davvero sotto soglia.
    expect(sotto.some((g) => g.ingredient_id === ingrediente)).toBe(true);

    const { risposta } = await rispondiA({ chiede: "cosa_manca" });
    expect(risposta.stato).toBe("risposta");
    // Il conteggio è quello vero, anche quando l'elenco è tagliato.
    expect(risposta.frase).toContain(String(sotto.length));
    // ⚠️ E niente si perde in silenzio: quello che non si vede è contato.
    expect(risposta.righe.length + risposta.troppe).toBe(sotto.length);
  });

  it("«cosa devo fare oggi?» conta gli impegni di oggi come li conta l'Agenda", async () => {
    // ⚠️ Stessa ragione della prova qui sopra: con quindici impegni di oggi
    //    l'elenco si taglia, e cercare il proprio fra le sei righe visibili
    //    sarebbe una prova che passa per come sono ordinati.
    const { data: corsie, error } = await titolare.rpc("agenda_corsie");
    expect(error).toBeNull();
    // 🔴 IL CRITERIO NON SI RISCRIVE QUI, e fino al 07/09/2026 era scritto
    //    due volte: questa prova diceva `Number(giorni_alla_scadenza) === 0`
    //    come la regola che stava provando, quindi passava mentre MEMO
    //    annunciava di oggi quindici impegni che una scadenza non ce
    //    l'hanno. Una prova che ripete l'errore del codice non lo vede.
    const oggi = (corsie ?? []).filter(eDiOggi);
    expect(oggi.some((t) => t.id === impegnoDiOggi), "il mio impegno non risulta di oggi").toBe(
      true,
    );

    const { risposta } = await rispondiA({ chiede: "agenda_oggi" });
    expect(risposta.stato).toBe("risposta");
    // ⚠️ AL SINGOLARE LA FRASE NON PORTA LA CIFRA — «Oggi hai una cosa:» —
    //    e fino al 07/09/2026 questa riga non se n'era mai accorta perché
    //    di impegni «di oggi» ne contava sedici: quindici erano quelli
    //    senza scadenza, che di oggi non sono. Corretto il conteggio, la
    //    prova è diventata rossa: è la stessa cifra che nascondeva il
    //    difetto a nascondere il difetto della prova.
    expect(risposta.frase).toContain(oggi.length === 1 ? "una cosa" : String(oggi.length));
    expect(risposta.righe.length + risposta.troppe).toBe(oggi.length);
    // ⚠️ E ogni riga porta al suo impegno: senza il collegamento la risposta
    //    non si potrebbe controllare, che è la condizione della fase 1.
    for (const r of risposta.righe) expect(r.a).toBe(`/agenda/${r.chiave}`);
  });

  it("🔴 e un impegno SENZA scadenza non finisce fra quelli di oggi", async () => {
    // ⚠️ La prova sui dati veri della cura del 07/09: la riga esiste, è
    //    mia, e non deve comparire né fra le righe né nel conteggio.
    const { data: corsie } = await titolare.rpc("agenda_corsie");
    const mio = (corsie ?? []).find((t) => t.id === impegnoSenzaData);
    expect(mio, "l'impegno senza scadenza non è nell'Agenda").toBeTruthy();
    expect(mio.due_date).toBeNull();
    expect(mio.corsia, "una riga senza scadenza sta in «quando capita»").toBe("quando_capita");

    const { risposta } = await rispondiA({ chiede: "agenda_oggi" });
    expect(risposta.righe.some((r) => r.chiave === impegnoSenzaData)).toBe(false);
    expect(risposta.righe.length + risposta.troppe).toBe((corsie ?? []).filter(eDiOggi).length);
  });

  it("«quando scade X?» dice la data vera e che è oggi", async () => {
    const { risposta } = await rispondiA({
      chiede: "quando_scade",
      soggetto: `${MARCA} portare i corrispettivi`,
    });
    expect(risposta.stato).toBe("risposta");
    expect(risposta.frase).toContain("oggi");
    expect(risposta.a).toBe(`/agenda/${impegnoDiOggi}`);
  });

  it("gli allergeni di un piatto senza ingredienti non si spacciano per completi", async () => {
    // ⚠️ Una ricetta senza righe non ha allergeni e non ha niente da
    //    verificare: la risposta è «non ne contiene», ed è vera. Il caso
    //    opposto — ingredienti mai guardati — è provato sulla regola pura,
    //    dove si può costruire.
    const { risposta } = await rispondiA({
      chiede: "allergeni",
      soggetto: `${MARCA} carbonara di prova`,
    });
    expect(risposta.stato).toBe("risposta");
    expect(risposta.frase).toContain("carbonara di prova");
  });
});

// ---------------------------------------------------------------------
describe("🔴 una domanda non scrive niente", () => {
  it("la dettatura di una domanda non fa nascere nessun appunto e nessuna azione", async () => {
    // ⚠️ È la forma esatta in cui la funzione online registra una domanda:
    //    la filza VUOTA. Il registro delle dettature si scrive lo stesso —
    //    è il conto di quello che è costato, e senza, il tetto di spesa del
    //    mese si potrebbe superare facendo domande — ma zero azioni vuol
    //    dire zero appunti.
    const { data: prima } = await titolare.rpc("appunti_da_approvare");
    const quantiPrima = (prima ?? []).length;

    const { data, error } = await titolare.rpc("registra_dettatura", {
      p_testo: `${MARCA} quanto olio ho`,
      p_azioni: [],
      p_esito: "capita",
      p_messaggio: "Era una domanda: non ho scritto niente.",
    });
    expect(error).toBeNull();
    mie.segna("dettature", data.dettatura_id);

    expect(data.azioni).toBe(0);
    expect(data.eseguite).toBe(0);
    expect(data.da_guardare).toBe(0);

    const { data: azioni } = await titolare.rpc("azioni_della_dettatura", {
      p_id: data.dettatura_id,
    });
    expect(azioni ?? []).toEqual([]);

    const { data: dopo } = await titolare.rpc("appunti_da_approvare");
    expect((dopo ?? []).length, "una domanda ha fatto nascere un appunto").toBe(quantiPrima);
  });

  it("e rispondere non tocca nessuna delle righe che ha letto", async () => {
    // ⚠️ La controprova dal lato dei dati: si legge la giacenza, si
    //    risponde, e la giacenza è la stessa di prima. Un effetto
    //    collaterale in lettura non darebbe nessun errore.
    const prima = await titolare
      .from("v_stock_levels")
      .select("current_quantity")
      .eq("ingredient_id", ingrediente)
      .single();

    await rispondiA({ chiede: "quanto_ho", soggetto: `${MARCA} olio di prova` });
    await rispondiA({ chiede: "cosa_manca" });

    const dopo = await titolare
      .from("v_stock_levels")
      .select("current_quantity")
      .eq("ingredient_id", ingrediente)
      .single();
    expect(dopo.data.current_quantity).toBe(prima.data.current_quantity);
  });
});

// ---------------------------------------------------------------------
describe("🔴 «Quanto olio ho?» non fa nascere un appunto, qualunque cosa succeda", () => {
  // 🔴 IL CASO VERO, dal collaudo a mano del 07/09/2026. Alessio dice
  //    «Quanto olio ho?», il credito dell'account AI e' finito, la chiamata
  //    al modello viene rifiutata prima di partire — e da quella domanda
  //    nasce un appunto «Da riguardare» da approvare o buttare.
  //
  // ⚠️ QUESTA PROVA CHIAMA LA FUNZIONE ONLINE VERA, ed e' l'unico modo di
  //    esercitare il tratto fra la schermata e cio' che gira su Internet:
  //    la regola pura sa cosa decidere, non sa se quella decisione arriva
  //    fino al database. Il difetto del 06/09 — il corridoio installato
  //    solo sulla prova — viveva esattamente li' in mezzo.
  //
  // ⚠️ COSTA UNA CHIAMATA AL MODELLO PER GIRO, quando il credito c'e':
  //    misurato il 07/09 sul progetto di prova, ~0,08 € (il catalogo di
  //    prova ha 426 prodotti; in produzione e' quasi vuoto e costa una
  //    frazione). Col credito finito, o col tetto raggiunto, non costa
  //    niente — e la prova resta valida, perche' cio' che pretende e'
  //    **zero appunti**, che deve valere in tutti e tre i casi.
  it("zero appunti, e una risposta o un chiarimento", async () => {
    const { data: prima } = await titolare.rpc("appunti_da_approvare");
    const quantiPrima = (prima ?? []).length;

    const { data, error } = await titolare.functions.invoke("ascolta-voce", {
      body: { testo: "Quanto olio ho?" },
    });

    // ⚠️ Si ripulisce SEMPRE, anche quando la prova sta per diventare
    //    rossa: se un appunto e' nato, e' roba di questa prova e va tolta.
    const { data: dopo } = await titolare.rpc("appunti_da_approvare");
    const nati = (dopo ?? []).filter((a) => !(prima ?? []).some((b) => b.id === a.id));
    for (const a of nati) await titolare.from("appunti_vocali").delete().eq("id", a.id);
    const id = data?.dettatura_id ?? data?.dettatura?.dettatura_id;
    if (id) await titolare.from("dettature").delete().eq("id", id);

    // 🔴 LA COSA CHE SI PRETENDE: nessun appunto. Vale se il modello ha
    //    capito la domanda, se non ha risposto, e se il tetto di spesa ha
    //    fermato tutto prima di chiamarlo.
    expect(
      nati.map((a) => a.titolo),
      "una domanda ha fatto nascere un appunto: " + nati.map((a) => a.titolo).join(", "),
    ).toEqual([]);
    expect((dopo ?? []).length).toBe(quantiPrima);

    // ...e se l'assistente ha risposto, deve essere una domanda o un
    // chiarimento — mai un comando.
    if (!error && data?.esito === "domanda") {
      expect(data.domanda?.chiede ?? "quanto_ho").toBe("quanto_ho");
      expect(data.azioni ?? 0).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------
describe("🔴 «Quando scade l'astice?» risponde dal Magazzino, non dall'Agenda", () => {
  // 🔴 IL CASO VERO, dal collaudo a mano del 07/09/2026: la frase veniva
  //    classificata come scadenza dell'Agenda e cercava un IMPEGNO chiamato
  //    astice. L'astice sta in cella.
  //
  // ⚠️ COSTA UNA SECONDA CHIAMATA AL MODELLO PER GIRO (~0,08 € sul progetto
  //    di prova, dove il catalogo ha 426 prodotti). E' il prezzo per
  //    esercitare la catena intera — modello, funzione online, letture,
  //    frase — che nessuna prova pura puo' percorrere.
  it("la catena intera, dalla frase alla risposta", async () => {
    // ⚠️ Condizione dichiarata: senza un astice in cella questa prova
    //    passerebbe senza aver provato niente.
    const { data: partite } = await titolare.rpc("partite_in_giacenza", { p_cerca: "astice" });
    expect(
      (partite ?? []).length,
      "sul progetto di prova non c'è nessuna partita di astice: questa prova non proverebbe niente",
    ).toBeGreaterThan(0);

    const { data: prima } = await titolare.rpc("appunti_da_approvare");

    const { data, error } = await titolare.functions.invoke("ascolta-voce", {
      body: { testo: "Quando scade l'astice?" },
    });

    const { data: dopo } = await titolare.rpc("appunti_da_approvare");
    const nati = (dopo ?? []).filter((a) => !(prima ?? []).some((b) => b.id === a.id));
    for (const a of nati) await titolare.from("appunti_vocali").delete().eq("id", a.id);
    const id = data?.dettatura_id ?? data?.dettatura?.dettatura_id;
    if (id) await titolare.from("dettature").delete().eq("id", id);

    expect(nati.map((a) => a.titolo), "una domanda ha fatto nascere un appunto").toEqual([]);

    // ⚠️ Se l'assistente non ha risposto (credito finito, tetto raggiunto)
    //    la catena non si puo' provare, e la prova lo DICE invece di
    //    passare in silenzio fingendo di aver provato qualcosa.
    if (error || data?.esito !== "domanda") {
      expect(
        data?.messaggio ?? String(error),
        "l'assistente non ha risposto: la catena non e' stata provata",
      ).toBeTruthy();
      return;
    }

    expect(data.domanda.chiede).toBe("quando_scade");
    // Il soggetto e' il nome nudo della cosa: niente «impegno», niente «agenda».
    expect(data.domanda.soggetto.toLowerCase()).toContain("astice");

    const { risposta } = await rispondiA({ ...data.domanda, testo: data.testo });
    expect(risposta.stato).toBe("risposta");
    expect(risposta.frase.toLowerCase()).toContain("astice");
    // 🔴 La cosa che il collaudo ha trovato rotta: porta allo scadenziario,
    //    non all'Agenda, e non dice «non ne trovo nessuno».
    expect(risposta.a).toBe("/magazzino/scadenze");
    expect(risposta.frase).not.toContain("non ne trovo");
  });
});

// ---------------------------------------------------------------------
describe("🔴 due prodotti che si chiamano uno come la testa dell'altro", () => {
  // 🔴 MISURATO sul progetto di prova il 07/09/2026: **120 coppie**, fra cui
  //    «Sale» e «Sale marino di Trapani», «Coniglio» e «Coniglio in
  //    agrodolce». Prima della cura «quando scade il sale?» rispondeva col
  //    nome del primo e le date di tutt'e due.
  it("«quando scade il sale?» chiede QUALE, sui prodotti veri", async () => {
    const { data: prodotti } = await titolare
      .from("ingredients")
      .select("id,name")
      .ilike("name", "sale%");
    // ⚠️ Condizione dichiarata: con un prodotto solo questa prova
    //    passerebbe senza aver provato niente.
    expect(
      (prodotti ?? []).length,
      "sul progetto di prova non ci sono due prodotti che cominciano per «sale»",
    ).toBeGreaterThan(1);

    const { risposta } = await rispondiA({ chiede: "quando_scade", soggetto: "sale" });
    expect(["scegli", "risposta"]).toContain(risposta.stato);
    // ⚠️ Se le partite in giacenza sono di un prodotto solo la risposta è
    //    legittima: quello che NON deve succedere è una risposta sola che
    //    tiene dentro due prodotti diversi.
    if (risposta.stato === "risposta") {
      const { data: partite } = await titolare.rpc("partite_in_giacenza", { p_cerca: "sale" });
      const prodottiConPartite = new Set(
        (partite ?? [])
          .filter((x) => String(x.prodotto).toLowerCase().startsWith("sale"))
          .map((x) => x.ingrediente_id),
      );
      expect(
        prodottiConPartite.size,
        "ha risposto di uno solo mentre in cella ce ne sono due che si chiamano così",
      ).toBeLessThan(2);
    } else {
      expect(risposta.candidati.length).toBeGreaterThan(1);
      // ogni candidato porta il proprio identificativo, non il nome
      for (const c of risposta.candidati) expect(c.chiave).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------
describe("🔴 la catena intera, un'area per volta", () => {
  // ⚠️ Una per area, e non una per domanda: quello che questo giro
  //    esercita è il tratto fra la bocca e la risposta, che è lo stesso
  //    per tutte le domande di un'area. Nove chiamate al modello
  //    costerebbero nove volte tanto per provare la stessa cosa.

  it("RICETTARIO — «quali allergeni ha …?» arriva fino alla ricetta vera", async () => {
    // ⚠️ Condizione dichiarata: senza quella ricetta la prova passerebbe
    //    senza aver provato niente.
    const { data: ricette } = await titolare
      .from("recipes")
      .select("name")
      .ilike("name", "%astice%")
      .limit(1);
    const nome = (ricette ?? [])[0]?.name;
    expect(
      nome,
      "sul progetto di prova non c'è nessuna ricetta con l'astice: questa prova non proverebbe niente",
    ).toBeTruthy();

    const giro = await dettaEPulisci(`Quali allergeni ha ${nome}?`);
    expect(giro.nati.map((a) => a.titolo), "una domanda ha fatto nascere un appunto").toEqual([]);
    if (!haRisposto(giro)) return;

    expect(giro.data.domanda.chiede).toBe("allergeni");
    const { risposta } = await rispondiA({ ...giro.data.domanda, testo: giro.data.testo });
    expect(["risposta", "non_lo_so"]).toContain(risposta.stato);
    // ⚠️ «non lo so» qui è una risposta legittima e voluta: se di qualche
    //    ingrediente gli allergeni non li ha guardati nessuno, il «no» non
    //    si dà. Quello che NON deve succedere è un elenco vuoto spacciato
    //    per completo.
    if (risposta.stato === "risposta") expect(risposta.a).toContain("/ricettario/ricette");
  });

  it("AGENDA — «cosa devo fare oggi?» conta quello che conta l'Agenda", async () => {
    const giro = await dettaEPulisci("Cosa devo fare oggi?");
    expect(giro.nati.map((a) => a.titolo), "una domanda ha fatto nascere un appunto").toEqual([]);
    if (!haRisposto(giro)) return;

    expect(giro.data.domanda.chiede).toBe("agenda_oggi");
    const { risposta } = await rispondiA({ ...giro.data.domanda, testo: giro.data.testo });
    expect(risposta.stato).toBe("risposta");
    expect(risposta.a).toBe("/agenda");

    // 🔴 E il numero è quello dell'Agenda, non uno suo: è la cura del
    //    07/09 provata dall'inizio della catena invece che a metà.
    const { data: corsie } = await titolare.rpc("agenda_corsie");
    expect(risposta.righe.length + risposta.troppe).toBe((corsie ?? []).filter(eDiOggi).length);
    expect(risposta.righe.some((r) => r.chiave === impegnoSenzaData)).toBe(false);
  });
});

// ---------------------------------------------------------------------
describe("🔴 la giornata arriva fino alla regola", () => {
  it("«quanto ne ho?» porta con sé che giorno è, o la scadenza torna al futuro", async () => {
    // 🔴 È IL FILO CHE SI ROMPE IN SILENZIO: se la lettura smettesse di
    //    portare la giornata, «la prima partita è scaduta il …» tornerebbe
    //    "scade il …" su una data passata, e nessuna prova pura potrebbe
    //    accorgersene — quelle la giornata gliela passano a mano.
    const letture = await letturePerDomanda({ chiede: "quanto_ho", soggetto: "astice" });
    expect(letture.oggi).toBe(oggiLocale());
  });
});

// ---------------------------------------------------------------------
describe("🔴 NESSUNA delle nove scrive, e non solo quella che si guarda", () => {
  // 🔴 PERCHE' TUTTE E NOVE E NON UNA: fino al 07/09 la prova che nessun
  //    appunto nasce da una domanda guardava «quanto olio ho». Una
  //    scrittura di troppo, il giorno che ci fosse, nascerebbe nella
  //    lettura di un'altra domanda — e sarebbe muta, perché in lettura un
  //    effetto collaterale non dà nessun errore.
  //
  // ⚠️ E NON GUARDA SOLO GLI APPUNTI: conta le righe delle tabelle che il
  //    modulo voce tocca **e** di quelle che MEMO legge. È la forma del
  //    guardiano dei residui del 26/08 — le lapidi non bastano, perché le
  //    tabelle sorvegliate sono 21 su tutte quelle del gestionale.
  const TABELLE = [
    "dettature",
    "azioni_dettate",
    "appunti_vocali",
    "tasks",
    "ingredients",
    "recipes",
    "stock_lots",
    "recipe_ingredients",
  ];

  const contaTutte = async () => {
    const righe = {};
    for (const t of TABELLE) {
      const { count, error } = await titolare.from(t).select("*", { count: "exact", head: true });
      expect(error, `non riesco a contare ${t}`).toBeNull();
      righe[t] = count;
    }
    return righe;
  };

  it("le nove domande, una dietro l'altra, non muovono una riga", async () => {
    const prima = await contaTutte();

    // ⚠️ Tutte e nove con un soggetto plausibile: quello che si prova è
    //    che LEGGERE non scriva, quindi le risposte qui non contano —
    //    contano i conteggi di prima e di dopo.
    for (const domanda of [
      { chiede: "ricetta_esiste", soggetto: "astice" },
      { chiede: "allergeni", soggetto: "astice" },
      { chiede: "piatti_in_carta" },
      { chiede: "quanto_ho", soggetto: "astice" },
      { chiede: "cosa_manca" },
      { chiede: "cosa_scade" },
      { chiede: "agenda_oggi" },
      { chiede: "agenda_in_ritardo" },
      { chiede: "quando_scade", soggetto: "astice", testo: "quando scade l'astice" },
    ]) {
      const { risposta } = await rispondiA(domanda);
      expect(risposta.stato, `«${domanda.chiede}» non è riuscita a leggere`).not.toBe("non_lo_so");
    }

    const dopo = await contaTutte();
    // ⚠️ Si nominano TUTTE le tabelle che non tornano, non la prima:
    //    dirne una per volta fa scoprire la seconda dopo aver risolto la
    //    prima, e alla terza si smette di leggere.
    const cambiate = TABELLE.filter((t) => prima[t] !== dopo[t]).map(
      (t) => `${t}: ${prima[t]} → ${dopo[t]}`,
    );
    expect(cambiate, "rispondere a una domanda ha scritto qualcosa").toEqual([]);
  });
});

// ---------------------------------------------------------------------
describe("🔴 i permessi della sala", () => {
  it("dalla sala non si detta affatto: MEMO voce è del titolare", async () => {
    // ⚠️ È il fatto misurato, e va detto perché cambia il perimetro: oggi
    //    la sala non può fare nessuna domanda a MEMO, né dalla schermata
    //    (la rotta è chiusa) né dal database. Non è una scelta di questo
    //    blocco: è com'era già.
    const { error } = await staff.rpc("registra_dettatura", {
      p_testo: `${MARCA} quanto olio ho`,
      p_azioni: [],
    });
    expect(error).not.toBeNull();
  });

  it("🔴 e se un giorno ci arrivasse, l'Agenda non le consegnerebbe quello che non deve vedere", async () => {
    // 🔴 La domanda che conta non è «MEMO nasconde?» ma «il DATABASE
    //    nasconde?»: MEMO legge col permesso di chi guarda, quindi la
    //    risposta la dà la RLS. Qui si prova quella, sulla riga vera.
    const { data, error } = await staff.rpc("agenda_corsie");
    expect(error, "lo staff non è riuscito a leggere l'Agenda").toBeNull();
    expect((data ?? []).some((t) => t.id === impegnoDiOggi)).toBe(false);

    // ⚠️ E la regola pura, sugli stessi dati, non se lo inventa: quello
    //    che non arriva non compare.
    const risposta = componiRisposta({ chiede: "agenda_oggi" }, { impegni: data ?? [] });
    expect(risposta.righe.some((r) => r.chiave === impegnoDiOggi)).toBe(false);

    // La metà che discrimina: al titolare quella riga arriva.
    const { data: suoi } = await titolare.rpc("agenda_corsie");
    expect((suoi ?? []).some((t) => t.id === impegnoDiOggi)).toBe(true);
  });

  it("la giacenza che MEMO legge non porta NESSUN prezzo", async () => {
    // ⚠️ Alle nove domande della fase 1 il denaro non serve, e non
    //    chiederlo è più forte che chiederlo e non mostrarlo.
    const { data, error } = await titolare
      .from("v_stock_levels")
      .select("*")
      .eq("ingredient_id", ingrediente)
      .single();
    expect(error).toBeNull();
    const soldi = Object.keys(data).filter((c) =>
      /cost|price|prezzo|costo|euro|importo/i.test(c),
    );
    expect(soldi, "la vista della giacenza ha acquistato una colonna di denaro").toEqual([]);
  });
});

// ---------------------------------------------------------------------
describe("solo le letture che servono", () => {
  it("una domanda del Magazzino non apre il Ricettario, e viceversa", async () => {
    // ⚠️ Ogni lettura è un giro di rete in cella. Se domani qualcuno
    //    leggesse tutto «così è pronto», qui si vedrebbe.
    const magazzino = await letturePerDomanda({ chiede: "cosa_manca" });
    expect(Object.keys(magazzino)).toEqual(["giacenze"]);

    const agenda = await letturePerDomanda({ chiede: "agenda_oggi" });
    expect(Object.keys(agenda)).toEqual(["impegni"]);
  });
});
