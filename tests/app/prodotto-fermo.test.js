import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, primaEntita } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import {
  abbattiPartita,
  chiudiPartita,
  dichiaraTrasformazione,
  listPartiteInGiacenza,
  rimandaPartita,
} from "../../src/lib/api/scadenze";

// L'AVVISO SUL PRODOTTO FERMO (23/08/2026, blocco 3 del mandato).
//
// ⚠️ PERCHE' LA PROVA PASSA DAL CORRIDOIO e non chiama le funzioni del
// database: un'operazione che non è nell'elenco di `operazioni-atomiche`
// risponde **404**, e nessuna prova scritta in SQL se ne accorgerebbe —
// la funzione esiste, è solo irraggiungibile dall'app. È la ragione per
// cui `npm run funzione --prova` è nato il 15/08.
// ⚠️ IL MARCHIO E' DI QUESTO GIRO, dal 01/09/2026: le pulizie e i
//    conteggi qui sotto usano questo valore in un modello `like`, e con
//    un valore fisso due esecuzioni insieme sullo stesso progetto di
//    prova si cancellano e si contano le righe a vicenda. Vedi la nota
//    in cima a `aiuto.js`.
const NOME = marchio("TEST-AUTO prodotto fermo");

describe("il prodotto fermo: sei risposte, sei strade diverse", () => {
  let titolare;
  let ente;
  let ing;
  let lotto;

  const partitaMia = async () =>
    (await listPartiteInGiacenza(NOME)).find((p) => p.lotto_id === lotto);

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    ente = await primaEntita(titolare);
    // Le funzioni di api/ passano dal corridoio, che usa il collegamento
    // dell'APP: con un client proprio parlerebbe da anonima (18/08).
    await supabase.auth.signInWithPassword(credenziali().titolare);

    // 🔴 L'INGREDIENTE DI PROVA SI RIUSA, NON SI RICREA — e la ragione è
    // misurata, non stilistica: `stock_consumptions` ha **solo una policy
    // di lettura** (scelta del 16/08: aprirla in cancellazione avrebbe
    // aperto una porta che non c'era), quindi dal client i suoi movimenti
    // NON si possono togliere, e la cancellazione dell'ingrediente viene
    // respinta dalla chiave esterna.
    //
    // ⚠️ Trovato CONTANDO I RESIDUI, non leggendo: cinque «TEST-AUTO
    // prodotto fermo» erano rimasti sul progetto di prova, uno per ogni
    // esecuzione. La prima versione cancellava senza **controllare che la
    // cancellazione fosse riuscita** — e PostgREST non si lamenta quando
    // la RLS filtra via le righe: ne toglie zero e risponde di sì.
    //
    // È lo stesso patto di `allineamento-magazzino.test.js`: l'ingrediente
    // resta, i suoi lotti e il suo storico si azzerano a ogni giro.
    await pulisci();

    const gia = await titolare
      .from("ingredients").select("id").eq("name", NOME).limit(1).maybeSingle();

    if (gia.data) {
      ing = gia.data.id;
      await titolare
        .from("ingredients")
        .update({ tenuto_in_magazzino: true, active: true })
        .eq("id", ing);
    } else {
      const { data: i, error } = await titolare
        .from("ingredients")
        .insert({
          entity_id: ente, name: NOME, category: "secco_dispensa", unit: "kg",
          current_price: 5, tenuto_in_magazzino: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      ing = i.id;
    }

    // Ricevuta 40 giorni fa e mai toccata: ferma da 40 giorni.
    const quaranta = new Date();
    quaranta.setDate(quaranta.getDate() - 40);
    const { data: l } = await titolare.from("stock_lots").insert({
      ingredient_id: ing, quantity_received: 10, quantity_remaining: 10,
      unit_cost: 5, received_at: quaranta.toISOString(),
    }).select("id").single();
    lotto = l.id;
  });

  afterAll(async () => {
    await pulisci();
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  });

  // Azzera lotti, trasformazioni e storico prezzi del prodotto di prova.
  // ⚠️ NON tocca gli scarichi né l'ingrediente: quelli non si cancellano
  // dal client, e provarci lasciava un residuo a ogni giro.
  async function pulisci() {
    const { data } = await titolare
      .from("ingredients").select("id").like("name", `${NOME}%`);
    for (const i of data ?? []) {
      const { data: lotti } = await titolare
        .from("stock_lots").select("id").eq("ingredient_id", i.id);
      for (const l of lotti ?? []) {
        await titolare.from("trasformazioni_dichiarate").delete().eq("lotto_id", l.id);
      }
      await titolare.from("stock_lots").delete().eq("ingredient_id", i.id);
      await titolare.from("price_history").delete().eq("ingredient_id", i.id);
    }
  }

  it("una partita dice da quanto nessuno la tocca", async () => {
    // 🔴 QUI C'ERA IL GIUDIZIO, E NON C'È PIÙ (28/08/2026, decisione di
    // Alessio). La prova diceva «una partita ferma oltre la sua DURATA
    // compare», e controllava `durata_giorni` e la frase `perche`. La
    // durata dei prodotti comprati è stata tolta: quel confronto non lo
    // può fare più nessuno.
    //
    // ⚠️ Quello che resta è il FATTO, e si prova uguale: da quanti giorni
    // nessuno la tocca. È un numero che si conta dall'ultima mossa e non
    // ha bisogno di nessuna durata.
    const p = await partitaMia();
    expect(p, "la partita ferma da 40 giorni non compare").toBeDefined();
    expect(p.ferma_da).toBe(40);
    // ⚠️ E il giudizio NON deve essere tornato da un'altra porta: se
    // ricomparissero queste colonne, vorrebbe dire che qualcuno ha rimesso
    // una durata dedotta senza dirlo.
    expect(p.durata_giorni).toBeUndefined();
    expect(p.e_ferma).toBeUndefined();
  });

  it("🔴 «trasformato» NON scala il magazzino — la regola di Alessio", async () => {
    // *«Rispondere trasformato non scala quell'ingrediente dal magazzino,
    // perché verrà scalato alla registrazione della preparazione che lo
    // include, altrimenti rischiamo di scalare due volte.»*
    const prima = await titolare
      .from("stock_lots").select("quantity_remaining").eq("id", lotto).single();

    const r = await dichiaraTrasformazione({
      lottoId: lotto, quantita: 4, descrizione: "Salsa di prova",
    });

    const dopo = await titolare
      .from("stock_lots").select("quantity_remaining").eq("id", lotto).single();

    expect(
      Number(dopo.data.quantity_remaining),
      "dichiarare una trasformazione ha scalato il magazzino: si scalerebbe due volte"
    ).toBe(Number(prima.data.quantity_remaining));

    // E non ha scritto nessuno scarico.
    const { data: mov } = await titolare
      .from("stock_consumptions").select("id").eq("ingredient_id", ing);
    expect(mov ?? []).toHaveLength(0);

    // ⚠️ E lo DICE, invece di lasciarlo intuire: chi legge «trasformato»
    // si aspetta che la giacenza scenda, e non scende.
    expect(r.frase).toMatch(/giacenza non cambia/i);
  });

  it("la parte non trasformata resta sorvegliata", async () => {
    const p = await partitaMia();
    expect(Number(p.da_guardare), "10 meno 4 fa 6").toBe(6);
    expect(Number(p.trasformata)).toBe(4);
  });

  it("non si può dichiarare trasformata più merce di quanta ce n'è", async () => {
    await expect(
      dichiaraTrasformazione({ lottoId: lotto, quantita: 99, descrizione: "Troppa" })
    ).rejects.toThrow(/già trasformati/i);
  });

  it("e va detto IN COSA è finita, o la rintracciabilità si ferma lì", async () => {
    await expect(
      dichiaraTrasformazione({ lottoId: lotto, quantita: 1 })
    ).rejects.toThrow(/in cosa/i);
  });

  it("«ancora qui»: si rimanda, e il rinvio ha una fine", async () => {
    // 🔴 COSA SI PROVA È CAMBIATO IL 28/08, e vale la pena dirlo. Prima
    // l'elenco era quello degli ALLARMI — le partite ferme da troppo — e
    // rimandarne una la faceva SPARIRE. Adesso l'elenco è quello di ciò che
    // c'è in casa, e una partita rimandata resta lì: è ancora in cella.
    //
    // ⚠️ Quindi non si prova più la sparizione, si prova l'EFFETTO — la data
    // fino a cui è stata rimandata. È una prova migliore: la sparizione era
    // un effetto secondario, la data è la cosa che il gesto scrive.
    await rimandaPartita({ lottoId: lotto, giorni: 7 });
    const rimandata = await partitaMia();
    expect(rimandata, "la partita è sparita dall'elenco di ciò che c'è in casa").toBeDefined();
    expect(rimandata.ricordamelo_il, "il rinvio non ha scritto nessuna data").toBeTruthy();

    // ⚠️ Un rinvio senza fine sarebbe una cancellazione travestita: la data
    // dev'essere nel FUTURO, e scaduta deve tornare a non contare niente.
    const oggi = new Date().toISOString().slice(0, 10);
    expect(rimandata.ricordamelo_il > oggi, "il rinvio non guarda avanti").toBe(true);

    const ieri = new Date();
    ieri.setDate(ieri.getDate() - 1);
    await titolare.from("stock_lots")
      .update({ ricordamelo_il: ieri.toISOString().slice(0, 10) }).eq("id", lotto);
    expect(await partitaMia(), "un rinvio scaduto non fa tornare la partita").toBeDefined();

    await titolare.from("stock_lots").update({ ricordamelo_il: null }).eq("id", lotto);
  });

  it("«abbattuto»: l'orologio riparte, ma la scadenza è obbligatoria", async () => {
    // Senza data si spegnerebbe l'avviso invece di rimandarlo.
    await expect(
      abbattiPartita({ lottoId: lotto, nuovaScadenza: null })
    ).rejects.toThrow(/la durata la decidi tu/i);

    const fra30 = new Date();
    fra30.setDate(fra30.getDate() + 30);
    await abbattiPartita({ lottoId: lotto, nuovaScadenza: fra30.toISOString().slice(0, 10) });

    // 🔴 ANCHE QUI SI PROVA L'EFFETTO invece della sparizione (28/08).
    // «L'orologio riparte» vuol dire una cosa misurabile: la partita era
    // ferma da 40 giorni, e dopo l'abbattimento è ferma da ZERO — perché
    // l'abbattimento È una mossa. Prima lo si vedeva dal fatto che usciva
    // dall'elenco degli allarmi, che era un modo indiretto di dire lo stesso.
    const abbattuta = await partitaMia();
    expect(abbattuta, "la partita è sparita dall'elenco di ciò che c'è in casa").toBeDefined();
    expect(abbattuta.ferma_da, "dopo l'abbattimento l'orologio non è ripartito").toBe(0);
    expect(abbattuta.scadenza, "la scadenza nuova non è stata scritta")
      .toBe(fra30.toISOString().slice(0, 10));
  });

  it("🔴 «reso al fornitore» chiude il ciclo, ma NON è uno spreco", async () => {
    // 🔴 IL RESO SI FA SU UN PRODOTTO SUO, e la ragione è la ripetibilità:
    // chiudere una partita scrive uno **scarico**, e uno scarico è un
    // movimento — quindi al giro dopo `partite_ferme()` vedrebbe il
    // prodotto «toccato oggi» e non lo direbbe più fermo. Gli scarichi non
    // si cancellano dal client (policy di sola lettura), quindi il residuo
    // resterebbe per sempre.
    //
    // ⚠️ Misurato, non previsto: rigirando la prova una seconda volta le
    // prime tre diventavano rosse. *Una prova che passa solo la prima
    // volta è una prova che domani si dà la colpa da sola.*
    const { data: r } = await titolare
      .from("ingredients").select("id").eq("name", `${NOME} reso`).limit(1).maybeSingle();
    let ingReso = r?.id;
    if (!ingReso) {
      const { data: nuovo, error } = await titolare
        .from("ingredients")
        .insert({
          entity_id: ente, name: `${NOME} reso`, category: "secco_dispensa",
          unit: "kg", current_price: 5, tenuto_in_magazzino: true,
        })
        .select("id").single();
      if (error) throw error;
      ingReso = nuovo.id;
    }

    const { data: lr } = await titolare
      .from("stock_lots")
      .insert({ ingredient_id: ingReso, quantity_received: 3, quantity_remaining: 3, unit_cost: 5 })
      .select("id").single();

    const prima = (
      await titolare.from("stock_consumptions").select("id").eq("ingredient_id", ingReso)
    ).data?.length ?? 0;

    await chiudiPartita({ lottoId: lr.id, come: "reso_fornitore", note: "prova reso" });

    const { data: l } = await titolare
      .from("stock_lots").select("chiusura, quantity_remaining").eq("id", lr.id).single();
    expect(l.chiusura).toBe("reso_fornitore");
    expect(Number(l.quantity_remaining)).toBe(0);

    const { data: mov } = await titolare
      .from("stock_consumptions").select("reason").eq("ingredient_id", ingReso);
    expect(mov.length, "il reso non ha lasciato il suo movimento").toBe(prima + 1);
    expect(
      mov.filter((m) => m.reason === "spreco"),
      "il reso è stato contato fra gli sprechi"
    ).toHaveLength(0);
    expect(mov.filter((m) => m.reason === "reso_fornitore").length).toBe(prima + 1);

    // ⚠️ E non apre una non conformità: un reso non è un problema
    // d'igiene, e riempire di righe normali un registro che l'ispettore
    // legge è il modo in cui quel registro smette di essere letto.
    const { data: nc } = await titolare
      .from("haccp_non_conformities").select("id").ilike("description", `%${NOME}%`);
    expect(nc ?? []).toHaveLength(0);
  });

  it("🔴 la prova si ripulisce davvero, e lo controlla", async () => {
    // ⚠️ È il difetto che questa prova aveva addosso: puliva senza
    // guardare l'esito, e ne restava un prodotto per ogni esecuzione.
    // *Una pulizia che non si controlla è una pulizia che non è avvenuta.*
    await pulisci();

    const { data: lotti } = await titolare
      .from("stock_lots").select("id").eq("ingredient_id", ing);
    expect(lotti ?? [], "la prova ha lasciato dei lotti").toHaveLength(0);

    const { data: prodotti } = await titolare
      .from("ingredients").select("id").like("name", `${NOME}%`);
    // ⚠️ DUE prodotti e non uno, ed è voluto: il principale — che non viene
    // mai scaricato, così resta «fermo» a ogni giro — e quello del reso,
    // che uno scarico ce l'ha per forza, perché chiudere una partita ne
    // scrive uno. Se diventassero TRE vuol dire che la pulizia ha smesso
    // di funzionare e ne nasce uno per esecuzione: è esattamente il
    // difetto che questa prova aveva addosso.
    expect(
      prodotti ?? [],
      "i prodotti di prova devono restare DUE: se se ne accumulano, la pulizia non funziona"
    ).toHaveLength(2);
  });
});
