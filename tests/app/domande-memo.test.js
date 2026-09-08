import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { supabase } from "../../src/lib/supabase";
import { clientAutenticato, credenziali, marchio, primaEntita, righeMie } from "./aiuto";
import { letturePerDomanda, rispondiA } from "../../src/lib/api/domandeMemo";
import { DOMANDE_CHE_SO, componiRisposta } from "../../src/lib/calcoli/domande";
import { eDiOggi } from "../../src/lib/calcoli/agenda";
import { NON_LETTO } from "../../src/lib/calcoli/letture";
import { oggiLocale } from "../../src/lib/constants";

// =====================================================================
// MEMO CONSULTIVO — tutte le domande contro il database vero
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
// 🔴 L'ELENCO DELLE DOMANDE NON SI SCRIVE QUI: si costruisce dal
//    catalogo. Fino al 07/09 era una filza di nove righe a mano, e alla
//    prima domanda nuova avrebbe continuato a provarne nove dichiarando
//    di provarle tutte — un guardiano che copre il passato.
// ⚠️ Il soggetto invece è roba di questa prova, e per ogni domanda che ne
//    vuole uno **dev'esserci**: senza, si eserciterebbe il ramo «di che
//    cosa?» credendo di provare la lettura. La riga sotto lo pretende.
const SOGGETTI = {
  ricetta_esiste: `${MARCA} carbonara di prova`,
  allergeni: `${MARCA} carbonara di prova`,
  ingredienti_ricetta: `${MARCA} carbonara di prova`,
  quanto_ho: `${MARCA} olio di prova`,
  quando_scade: `${MARCA} portare i corrispettivi`,
};

const TUTTE = Object.keys(DOMANDE_CHE_SO).map((chiede) => ({
  chiede,
  soggetto: SOGGETTI[chiede] ?? null,
  testo: `${DOMANDE_CHE_SO[chiede].esempio}`,
}));

describe("tutte le domande leggono davvero", () => {
  it("🔴 ogni domanda che vuole un soggetto ne ha uno in questa prova", () => {
    // ⚠️ La metà che discrimina: senza questa riga, una domanda nuova che
    //    vuole un soggetto entrerebbe nel giro qui sotto e risponderebbe
    //    «di che cosa?» — cioè passerebbe senza aver letto niente.
    const senza = Object.entries(DOMANDE_CHE_SO)
      .filter(([chiede, d]) => d.chiarimento && !SOGGETTI[chiede])
      .map(([chiede]) => chiede);
    expect(senza, "a queste domande manca il soggetto di prova").toEqual([]);
  });

  it("🔴 nessuna risponde «non lo so»: le fonti si leggono tutte", async () => {
    // 🔴 È la prova dei permessi, e funziona proprio perché la regola pura
    //    non finge: un rifiuto del database arriva qui come «non lo so»,
    //    non come un elenco vuoto. Se domani una `grant` cadesse, questa
    //    riga diventa rossa da sola invece di far comparire uno zero.
    const storte = [];
    for (const domanda of TUTTE) {
      const { risposta } = await rispondiA(domanda);
      if (risposta.stato === "non_lo_so") storte.push(`${domanda.chiede}: ${risposta.frase}`);
    }
    expect(storte, "queste fonti non si sono lasciate leggere:\n  " + storte.join("\n  ")).toEqual(
      [],
    );
  });

  it("...e ognuna porta da qualche parte", async () => {
    for (const domanda of TUTTE) {
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

  it("CASSA — «quanti soldi ci sono in cassa?» arriva ai saldi veri", async () => {
    // 🔴 È L'AREA NUOVA CHE COSTA DI PIÙ SE SBAGLIA: qui la domanda passa
    //    dal modello, e quello che deve NON succedere è che una frase sui
    //    soldi diventi un movimento da approvare.
    const giro = await dettaEPulisci("Quanti soldi ci sono in cassa?");
    expect(giro.nati.map((a) => a.titolo), "una domanda ha fatto nascere un appunto").toEqual([]);
    if (!haRisposto(giro)) return;

    expect(giro.data.domanda.chiede).toBe("saldo_cassa");
    const { risposta } = await rispondiA({ ...giro.data.domanda, testo: giro.data.testo });
    expect(risposta.stato).toBe("risposta");
    expect(risposta.a).toBe("/cassa");
    // ⚠️ E il numero arriva col suo limite attaccato, come lo scrive il
    //    database: senza, un contante teorico si legge come contato.
    expect(risposta.limite).toBeTruthy();
  });

  it("LA SPESA — «cosa devo comprare?» finisce nella lista giusta", async () => {
    const giro = await dettaEPulisci("Cosa devo comprare?");
    expect(giro.nati.map((a) => a.titolo), "una domanda ha fatto nascere un appunto").toEqual([]);
    if (!haRisposto(giro)) return;

    expect(giro.data.domanda.chiede).toBe("cosa_comprare");
    const { risposta } = await rispondiA({ ...giro.data.domanda, testo: giro.data.testo });
    expect(risposta.a).toBe("/magazzino/lista-spesa");
    expect(risposta.a).not.toBe("/magazzino/spesa-spicciola");
  });

  it("HACCP — «cosa devo pulire oggi?» legge il registro e non ci scrive", async () => {
    const giro = await dettaEPulisci("Cosa devo pulire oggi?");
    expect(giro.nati.map((a) => a.titolo), "una domanda ha fatto nascere un appunto").toEqual([]);
    if (!haRisposto(giro)) return;

    expect(giro.data.domanda.chiede).toBe("pulizie_oggi");
    const { risposta } = await rispondiA({ ...giro.data.domanda, testo: giro.data.testo });
    expect(risposta.stato).toBe("risposta");
    expect(risposta.a).toBe("/haccp/pulizia");
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
describe("🔴 NESSUNA domanda scrive, e non solo quella che si guarda", () => {
  // 🔴 PERCHE' TUTTE E NON UNA: fino al 07/09 la prova che nessun appunto
  //    nasce da una domanda guardava «quanto olio ho». Una scrittura di
  //    troppo, il giorno che ci fosse, nascerebbe nella lettura di
  //    un'altra domanda — e sarebbe muta, perché in lettura un effetto
  //    collaterale non dà nessun errore.
  //
  // ⚠️ E NON GUARDA SOLO GLI APPUNTI: conta le righe delle tabelle che il
  //    modulo voce tocca **e** di quelle che MEMO legge. È la forma del
  //    guardiano dei residui del 26/08 — le lapidi non bastano, perché le
  //    tabelle sorvegliate sono 21 su tutte quelle del gestionale.
  // ⚠️ L'ELENCO SEGUE LE DOMANDE: con la fase 2 MEMO legge anche Cassa,
  //    le due liste della spesa, le preparazioni e i due registri HACCP —
  //    e sono proprio le tabelle dove una scrittura di troppo farebbe più
  //    danno (un movimento di cassa, una riga in un registro esibibile).
  const TABELLE = [
    "dettature",
    "azioni_dettate",
    "appunti_vocali",
    "tasks",
    "ingredients",
    "recipes",
    "stock_lots",
    "recipe_ingredients",
    // --- fase 2 ---
    "cash_movements",
    "shopping_list_items",
    "spesa_spicciola",
    "preparazioni_da_fare",
    "haccp_cleaning_logs",
    "haccp_temperature_logs",
    // --- fase 3: sono soldi che qualcuno deve avere ---
    "supplier_invoices",
    "note_credito",
    "note_credito_utilizzi",
    "scadenze_previste",
    "ordini_fornitore",
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

  it("tutte le domande, una dietro l'altra, non muovono una riga", async () => {
    const prima = await contaTutte();

    // ⚠️ TUTTE, prese dal catalogo, con un soggetto plausibile: quello che
    //    si prova è che LEGGERE non scriva, quindi le risposte qui non
    //    contano — contano i conteggi di prima e di dopo.
    for (const domanda of TUTTE) {
      const { risposta } = await rispondiA({ ...domanda, soggetto: domanda.soggetto ?? "astice" });
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
    // ⚠️ Alle domande del Magazzino il denaro non serve, e non chiederlo è
    //    più forte che chiederlo e non mostrarlo. Dalla fase 2 i soldi
    //    entrano, ma da una porta sola — la Cassa — e con davanti il
    //    portiere del database, che la prova qui sotto esercita.
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
// ---------------------------------------------------------------------
describe("🔴 i soldi entrano da una porta sola, e la porta ha un portiere", () => {
  it("🔴 alla sala i saldi della Cassa NON escono", async () => {
    // 🔴 LA DOMANDA CHE CONTA NON È «MEMO NASCONDE?» MA «IL DATABASE
    //    RIFIUTA?»: MEMO legge col permesso di chi guarda, quindi la
    //    risposta la dà il portiere di «saldo_tesoreria». Qui si prova
    //    quello, sulla funzione vera.
    const entita = await primaEntita(titolare);
    const { error } = await staff.rpc("saldo_tesoreria", { p_entity_id: entita });
    expect(error, "la sala si è letta i saldi della Cassa").not.toBeNull();
  });

  it("...e un rifiuto arriva a MEMO come «non lo so», mai come uno zero", () => {
    // ⚠️ È il pezzo che chiude il giro: il rifiuto del database diventa
    //    NON_LETTO in «leggi()», e la regola pura lo mostra come «non lo
    //    so». Uno zero a schermo sarebbe un saldo inventato.
    const r = componiRisposta({ chiede: "saldo_cassa" }, { saldo: NON_LETTO });
    expect(r.stato).toBe("non_lo_so");
    expect(r.frase).not.toMatch(/\d/);
  });

  it("la metà che discrimina: al titolare i saldi arrivano", async () => {
    const { risposta } = await rispondiA({ chiede: "saldo_cassa" });
    expect(risposta.stato).toBe("risposta");
    expect(risposta.frase).toMatch(/€/);
    // ⚠️ E l'avvertenza è quella che scrive il database, non una riscritta
    //    da MEMO: il numero e il suo limite viaggiano insieme (15/08).
    expect(risposta.limite, "il saldo è arrivato senza la sua avvertenza").toBeTruthy();
  });

  it("🔴 e i movimenti letti sono quelli dell'OSTERIA, non quelli della tasca", async () => {
    // 🔴 Dal 30/08 «la mia tasca» è un soggetto contabile a sé. Se la
    //    lettura non scegliesse il soggetto, MEMO elencherebbe fra le
    //    uscite del locale le spese personali di Alessio — righe
    //    plausibili, e nessun errore.
    const { data: soggetti } = await titolare.from("entities").select("id, entity_type");
    const tasca = (soggetti ?? []).find((e) => e.entity_type === "tasca");
    expect(tasca, "sul progetto di prova non c'è il soggetto «tasca»").toBeTruthy();

    const letture = await letturePerDomanda({ chiede: "ultimi_movimenti" });
    const suTasca = (letture.movimenti ?? []).filter((m) => m.entity_id === tasca.id);
    expect(suTasca, "fra i movimenti letti ce n'è qualcuno della tasca").toEqual([]);
  });

  it("gli ingredienti di una ricetta arrivano SENZA prezzi", async () => {
    // ⚠️ La vista «_display» esiste dal primo giorno per far vedere alla
    //    sala le colonne sicure. Qui si controlla che sia ancora così: una
    //    colonna di denaro aggiunta lì domani uscirebbe da MEMO senza che
    //    nessuno l'abbia chiesta.
    const { data, error } = await titolare
      .from("recipe_ingredients_display")
      .select("*")
      .limit(1);
    expect(error).toBeNull();
    const riga = (data ?? [])[0];
    expect(riga, "sul progetto di prova nessuna ricetta ha ingredienti").toBeTruthy();
    const soldi = Object.keys(riga).filter((c) => /cost|price|prezzo|costo|euro|importo/i.test(c));
    expect(soldi, "la vista degli ingredienti ha acquistato una colonna di denaro").toEqual([]);
  });
});

// ---------------------------------------------------------------------
describe("🔴 le due liste restano due, anche contro i dati veri", () => {
  it("quello che è nella spesa spicciola non compare fra le cose da comprare", async () => {
    // 🔴 È la decisione della #36 (SPEC-0012) provata dal lato delle
    //    domande: due tabelle, due letture, nessun travaso.
    const comprare = await letturePerDomanda({ chiede: "cosa_comprare" });
    const spicciola = await letturePerDomanda({ chiede: "cosa_spicciola" });
    expect(Object.keys(comprare)).toEqual(["lista"]);
    expect(Object.keys(spicciola)).toEqual(["spicciola"]);

    const nomi = new Set((comprare.lista ?? []).map((r) => r.nome));
    const articoli = (spicciola.spicciola ?? []).map((r) => r.articolo);
    expect(articoli.filter((a) => nomi.has(a)), "un articolo compare in tutt'e due").toEqual([]);
  });

  it("...e ognuna risponde con la SUA destinazione", async () => {
    const a = await rispondiA({ chiede: "cosa_comprare" });
    const b = await rispondiA({ chiede: "cosa_spicciola" });
    expect(a.risposta.a).toBe("/magazzino/lista-spesa");
    expect(b.risposta.a).toBe("/magazzino/spesa-spicciola");
  });
});

// ---------------------------------------------------------------------
describe("🔴 i numeri di MEMO sono quelli delle schermate", () => {
  // 🔴 È LA PROMESSA SU CUI POGGIA TUTTA LA FASE CONSULTIVA: quello che
  //    MEMO dice si può andare a controllare, e se non combacia si vede.
  //    Qui si confronta la risposta con la STESSA funzione che disegna la
  //    schermata, non con un conteggio rifatto a mano.

  it("«cosa devo comprare?» conta quello che conta la lista della spesa", async () => {
    const { data: lista } = await titolare.rpc("lista_spesa");
    const attese = (lista ?? []).filter((r) => r.stato === "da_comprare").length;
    const { risposta } = await rispondiA({ chiede: "cosa_comprare" });
    expect(risposta.righe.length + risposta.troppe).toBe(attese);
  });

  it("«cosa devo pulire oggi?» conta quello che conta il registro HACCP", async () => {
    const { data: pulizie } = await titolare.rpc("pulizie_di_oggi");
    const dovute = (pulizie ?? []).filter((p) => p.dovuta).length;
    const { risposta } = await rispondiA({ chiede: "pulizie_oggi" });
    expect(risposta.righe.length + risposta.troppe).toBe(dovute);
  });

  it("«cosa devo preparare?» conta quello che conta Produzioni", async () => {
    const { data: cose } = await titolare.rpc("cose_da_fare");
    const { risposta } = await rispondiA({ chiede: "preparazioni_da_fare" });
    expect(risposta.righe.length + risposta.troppe).toBe((cose ?? []).length);
  });

  it("«quali fatture devo pagare?» conta quelle che conta la schermata", async () => {
    const { data } = await titolare
      .from("supplier_invoices")
      .select("id")
      .eq("status", "da_pagare");
    const { risposta } = await rispondiA({ chiede: "fatture_da_pagare" });
    expect(risposta.righe.length + risposta.troppe).toBe((data ?? []).length);
  });

  it("«cosa ho ordinato?» conta gli ordini che aspettano", async () => {
    const { data: ordini } = await titolare.rpc("ordini_fatti", { p_dal: null, p_al: null });
    const attesi = (ordini ?? []).filter((o) => o.stato === "inviato").length;
    const { risposta } = await rispondiA({ chiede: "ordini_in_corso" });
    expect(risposta.righe.length + risposta.troppe).toBe(attesi);
  });

  it("«ci sono note di credito da usare?» legge il residuo del database", async () => {
    const entita = await primaEntita(titolare);
    const { data: crediti } = await titolare.rpc("crediti_fornitore", { p_entity_id: entita });
    const { risposta } = await rispondiA({ chiede: "crediti_fornitore" });
    expect(risposta.righe.length + risposta.troppe).toBe((crediti ?? []).length);
  });

  it("«questa settimana» prende la corsia dell'Agenda, e non ci mette dentro oggi", async () => {
    const { data: corsie } = await titolare.rpc("agenda_corsie");
    const attesi = (corsie ?? []).filter((t) => t.corsia === "questa_settimana" && !eDiOggi(t));
    const { risposta } = await rispondiA({ chiede: "agenda_prossime" });
    expect(risposta.righe.length + risposta.troppe).toBe(attesi.length);
    expect(risposta.righe.some((r) => r.chiave === impegnoDiOggi)).toBe(false);
  });
});

// ---------------------------------------------------------------------
describe("🔴 i soldi che devono uscire: la porta e il suo portiere", () => {
  it("🔴 alla sala le fatture dei fornitori NON escono", async () => {
    // 🔴 LA DOMANDA CHE CONTA NON È «MEMO NASCONDE?» MA «IL DATABASE
    //    NASCONDE?»: MEMO legge col permesso di chi guarda, quindi la
    //    risposta la dà la RLS sulla tabella vera.
    const { data, error } = await staff.from("supplier_invoices").select("id").limit(1);
    const visto = error ? 0 : (data ?? []).length;
    expect(visto, "la sala si è letta le fatture dei fornitori").toBe(0);
  });

  it("...e un rifiuto arriva a MEMO come «non lo so», mai come uno zero", () => {
    const r = componiRisposta({ chiede: "fatture_da_pagare" }, { fatture: NON_LETTO });
    expect(r.stato).toBe("non_lo_so");
    expect(r.frase).not.toMatch(/\d/);
  });

  it("🔴 il «da pagare» che MEMO dice è quello CALCOLATO dal database", async () => {
    // 🔴 Non è una formalità: «da_pagare» è una colonna calcolata (importo
    //    meno le note di credito scalate). Se cadesse dalla stringa della
    //    lettura, la schermata e MEMO mostrerebbero il LORDO senza nessun
    //    errore. Qui si confronta la risposta con la colonna vera.
    const letture = await letturePerDomanda({ chiede: "fatture_da_pagare" });
    const aperte = letture.fatture ?? [];
    expect(Array.isArray(aperte), "le fatture non si sono lasciate leggere").toBe(true);
    for (const x of aperte.slice(0, 5)) {
      expect(x.da_pagare, "da_pagare non è arrivata dal database").not.toBeUndefined();
      expect(Number(x.da_pagare)).toBeCloseTo(Number(x.amount) - Number(x.note_scalate ?? 0), 2);
    }
  });

  it("...e nessuna fattura già pagata entra nell'elenco", async () => {
    // ⚠️ Il filtro è nel database: leggerle tutte per scartarle nel browser
    //    vuol dire una lettura che prima o poi torna tagliata senza dirlo.
    const letture = await letturePerDomanda({ chiede: "fatture_da_pagare" });
    const pagate = (letture.fatture ?? []).filter((x) => x.status === "pagata");
    expect(pagate, "fra le fatture da pagare ce n'è una già pagata").toEqual([]);
  });

  it("🔴 le scadenze previste sono quelle dell'OSTERIA, non della tasca", async () => {
    // 🔴 Dal 30/08 «la mia tasca» è un soggetto contabile a sé: senza
    //    scegliere il soggetto, MEMO metterebbe fra le uscite del locale le
    //    cose personali di Alessio.
    const { data: soggetti } = await titolare.from("entities").select("id, entity_type");
    const srls = (soggetti ?? []).find((e) => e.entity_type === "srls");
    const letture = await letturePerDomanda({ chiede: "scadenze_previste" });
    const fuori = (letture.scadenze ?? []).filter((s) => s.entity_id !== srls?.id);
    expect(fuori, "fra le scadenze lette ce n'è qualcuna di un altro soggetto").toEqual([]);
  });

  it("le scadenze già chiuse non compaiono", async () => {
    const letture = await letturePerDomanda({ chiede: "scadenze_previste" });
    const chiuse = (letture.scadenze ?? []).filter((s) => s.chiusa_il !== null);
    expect(chiuse, "una scadenza già chiusa è finita nell'elenco").toEqual([]);
  });
});

describe("solo le letture che servono", () => {
  it("una domanda del Magazzino non apre il Ricettario, e viceversa", async () => {
    // ⚠️ Ogni lettura è un giro di rete in cella. Se domani qualcuno
    //    leggesse tutto «così è pronto», qui si vedrebbe.
    const magazzino = await letturePerDomanda({ chiede: "cosa_manca" });
    expect(Object.keys(magazzino)).toEqual(["giacenze"]);

    const agenda = await letturePerDomanda({ chiede: "agenda_oggi" });
    expect(Object.keys(agenda)).toEqual(["impegni"]);

    // ⚠️ E una domanda della Cassa non apre il Magazzino: la finestra dei
    //    movimenti viaggia insieme ai movimenti, perché senza di lei la
    //    risposta non si può dare (il numero e il suo limite, 15/08).
    const soldi = await letturePerDomanda({ chiede: "ultimi_movimenti" });
    expect(Object.keys(soldi).sort()).toEqual(["giorni", "movimenti"]);
    expect(soldi.giorni).toBeGreaterThan(0);

    const saldo = await letturePerDomanda({ chiede: "saldo_cassa" });
    expect(Object.keys(saldo)).toEqual(["saldo"]);

    // ⚠️ E la giornata viaggia insieme alle fatture: senza di lei «scaduta
    //    da 4 giorni» tornerebbe «entro il …» su una data passata.
    const fatture = await letturePerDomanda({ chiede: "fatture_da_pagare" });
    expect(Object.keys(fatture).sort()).toEqual(["fatture", "oggi"]);
    expect(fatture.oggi).toBe(oggiLocale());

    const crediti = await letturePerDomanda({ chiede: "crediti_fornitore" });
    expect(Object.keys(crediti)).toEqual(["crediti"]);
  });
});
