import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, righeDaTogliere } from "./aiuto";

// SPEC-0012 — le due liste, contro il database vero.
//
// 🔴 IL FATTO DA CUI NASCE: il gestionale ha due liste dal 23/08/2026 — la
//    **Lista della spesa**, che nasce dalle soglie e finisce in un ordine al
//    fornitore, e la **Spesa spicciola**, quella che Alessio compra di
//    persona al supermercato. Il 06/09, dettando «segna il pesce spada nella
//    spesa spicciola», la roba finiva proposta nella lista dei fornitori.
//
// 🔴 QUELLO CHE QUESTE PROVE SORVEGLIANO È UNA PROPRIETÀ SOLA, e si dice in
//    una riga: **quello che entra in una non compare nell'altra**. Non si
//    guarda lo stato scritto sulla riga — si va a contare le righe delle due
//    tabelle, perché «l'appunto dice spesa spicciola» e «la roba è finita
//    nella spesa spicciola» sono due affermazioni diverse.
//
// ⚠️ SI ENTRA DAL CORRIDOIO per approvare, non chiamando la funzione del
//    database: è la strada che usa il gestionale (Contratto B4), e
//    un'operazione dimenticata nell'elenco risponde 404 senza che nessuna
//    prova SQL se ne accorga.

const BASE = "TEST-AUTO due liste";
const NOME = marchio(BASE);

// ⚠️ NIENTE SENTINELLA DEL CORRIDOIO, e la rete lo pretende: quella
//    serve a chi SALTA delle prove quando il corridoio non c'è. Qui non
//    se ne salta nessuna — se il corridoio mancasse, l'approvazione
//    fallirebbe e la prova diventerebbe rossa, che è la cosa giusta.
//    Un guardiano che non ha niente da sorvegliare è rumore, e c'è una
//    prova pura che lo dice (`tests/unita/prove-saltate.test.js`).

describe("le due liste della spesa", () => {
  let titolare;
  const miei = { dettature: [], appunti: [], azioni: [], lista: [], spicciola: [] };

  /** Detta come farebbe la funzione online, e segna ciò che nasce. */
  async function detta(testo, azioni) {
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
    miei.dettature.push(data.dettatura_id);

    const { data: righe } = await titolare
      .from("azioni_dettate")
      .select("id, appunto_id, tipo, stato, dati")
      .eq("dettatura_id", data.dettatura_id);
    for (const r of righe ?? []) {
      miei.azioni.push(r.id);
      if (!miei.appunti.includes(r.appunto_id)) miei.appunti.push(r.appunto_id);
    }
    return righe ?? [];
  }

  const riga = (tipo, nome, extra = {}) => ({
    tipo,
    sicuro: true,
    frase: `${NOME} ${nome}`,
    dati: { nome_libero: `${NOME} ${nome}`, ...extra },
  });

  const approva = (id) =>
    titolare.functions.invoke("operazioni-atomiche", {
      body: { operazione: "approva_appunto", parametri: { p_id: id } },
    });

  /**
   * Quanti elementi DI QUESTA PROVA aspettano ancora dentro un appunto.
   *
   * 🔴 SOLO I SUOI — 09/09/2026. La spesa spicciola è additiva: un appunto
   * può raccogliere anche righe che Alessio ha dettato dal telefono e non
   * ha ancora approvato. Contandole tutte, il conto «+ attese» qui sotto
   * misurerebbe roba di un altro e diventerebbe rosso senza che niente
   * sia rotto.
   */
  async function quantiDentro(appuntoId) {
    const { count } = await titolare
      .from("azioni_dettate")
      .select("*", { count: "exact", head: true })
      .eq("appunto_id", appuntoId)
      .in("dettatura_id", miei.dettature)
      .in("stato", ["in_attesa", "fallita"]);
    return count;
  }

  /**
   * Quante righe DI QUESTA PROVA ci sono nelle due liste, adesso.
   *
   * 🔴 SOLO LE SUE — 09/09/2026. Contando tutta la tabella, una riga che
   * Alessio aggiunge dal telefono mentre il giro gira fa fallire il
   * confronto «prima == dopo». La separazione fra le due liste — che è
   * quello che questa prova sorveglia — si vede benissimo sulle sole
   * righe della prova.
   */
  async function conta() {
    const a = await titolare
      .from("shopping_list_items")
      .select("*", { count: "exact", head: true })
      .like("custom_name", `${NOME}%`);
    const b = await titolare
      .from("spesa_spicciola")
      .select("*", { count: "exact", head: true })
      .like("articolo", `${NOME}%`);
    return { lista: a.count, spicciola: b.count };
  }

  /** Le righe mie, per nome, dalle due tabelle — e le segna per la pulizia. */
  async function mie() {
    const { data: l } = await titolare
      .from("shopping_list_items")
      .select("id, custom_name")
      .like("custom_name", `${NOME}%`);
    const { data: s } = await titolare
      .from("spesa_spicciola")
      .select("id, articolo, categoria, nota")
      .like("articolo", `${NOME}%`);
    for (const r of l ?? []) if (!miei.lista.includes(r.id)) miei.lista.push(r.id);
    for (const r of s ?? []) if (!miei.spicciola.includes(r.id)) miei.spicciola.push(r.id);
    return { lista: l ?? [], spicciola: s ?? [] };
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
  });

  /**
   * Toglie le righe di questo giro dalle due liste, comprese quelle nate da
   * un'approvazione. È la stessa funzione che usa la pulizia finale, e
   * l'ultima prova qui sotto la mette alla prova.
   */
  async function pulisciLeListe() {
    // 🔴 E ANCHE LE RIGHE NATE DA UN'APPROVAZIONE — 10/09/2026, dal
    //    collaudo. Approvare un appunto crea una riga nella lista che
    //    nessuno si segna: la pulizia di prima cancellava solo gli
    //    identificativi raccolti a mano, e quelle restavano. Misurato sul
    //    progetto di prova: **136 righe** di questa famiglia nella spesa
    //    spicciola di Alessio, due per ogni giro, e il riquadro della
    //    schermata iniziale diceva «137 cose da comprare» dove ce n'era una.
    //    ⚠️ Si cerca col MARCHIO DI QUESTO GIRO (`righeDaTogliere`), che
    //    prende le righe di questo giro e quelle dei giri abbandonati più
    //    vecchie della grazia — mai quelle di un giro vivo, e mai un dato
    //    vero, che il marchio non ce l'ha.
    const lista = await righeDaTogliere(titolare, "shopping_list_items", "custom_name", BASE);
    const spicciola = await righeDaTogliere(titolare, "spesa_spicciola", "articolo", BASE);
    for (const id of lista) if (!miei.lista.includes(id)) miei.lista.push(id);
    for (const id of spicciola) if (!miei.spicciola.includes(id)) miei.spicciola.push(id);
    if (miei.lista.length) await titolare.from("shopping_list_items").delete().in("id", miei.lista);
    if (miei.spicciola.length) await titolare.from("spesa_spicciola").delete().in("id", miei.spicciola);
    miei.lista.length = 0;
    miei.spicciola.length = 0;
  }

  afterAll(async () => {
    // ⚠️ Solo ciò che questa prova ha creato (regola del 23/08). Prima le
    //    figlie, poi le madri: al contrario le chiavi esterne respingono.
    await pulisciLeListe();
    if (miei.azioni.length) await titolare.from("azioni_dettate").delete().in("id", miei.azioni);
    if (miei.appunti.length) await titolare.from("appunti_vocali").delete().in("id", miei.appunti);
    if (miei.dettature.length) await titolare.from("dettature").delete().in("id", miei.dettature);
  });

  // -------------------------------------------------------------------
  it("🔴 approvare una riga della SPESA SPICCIOLA non tocca la lista della spesa", async () => {
    const prima = await conta();

    const righe = await detta("spicciola", [
      riga("spesa_spicciola", "shampoo", { categoria: "pulizia", note: "quello grande" }),
    ]);
    expect(righe[0].tipo).toBe("spesa_spicciola");
    expect(righe[0].stato).toBe("in_attesa");

    // ⚠️ Prima dell'approvazione non deve essere cambiato NIENTE: è la
    //    regola di SPEC-0013, e qui si guarda contando, non fidandosi dello
    //    stato scritto sulla riga.
    expect(await conta()).toEqual(prima);

    // ⚠️ Quante righe entreranno lo dice l'APPUNTO: la spesa spicciola è
    //    additiva, quindi può raccogliere anche roba detta prima e ancora
    //    aperta. Scrivere «+1» misurerebbe il raggruppamento invece della
    //    separazione.
    const attese = await quantiDentro(righe[0].appunto_id);
    const { error } = await approva(righe[0].appunto_id);
    expect(error).toBeNull();

    const dopo = await conta();
    expect(dopo.spicciola, "la riga non è finita nella spesa spicciola").toBe(
      prima.spicciola + attese,
    );
    expect(dopo.lista, "approvare la spesa spicciola ha toccato la lista della spesa").toBe(
      prima.lista,
    );

    const { spicciola, lista } = await mie();
    expect(spicciola.map((r) => r.articolo)).toContain(`${NOME} shampoo`);
    expect(lista.map((r) => r.custom_name)).not.toContain(`${NOME} shampoo`);
    // La categoria e la nota dette arrivano fino alla riga.
    const scritta = spicciola.find((r) => r.articolo === `${NOME} shampoo`);
    expect(scritta.categoria).toBe("pulizia");
    expect(scritta.nota).toBe("quello grande");
  });

  it("🔴 ...e allo specchio: la LISTA DELLA SPESA non finisce nella spicciola", async () => {
    // ⚠️ È la metà che discrimina: una cura che mandasse tutto nella
    //    spicciola passerebbe la prova qui sopra e romperebbe il gesto che
    //    finisce in un ordine al fornitore.
    const prima = await conta();

    const righe = await detta("lista", [
      riga("lista_spesa", "parmigiano", { quantita: 2, unita: "kg" }),
    ]);
    const attese = await quantiDentro(righe[0].appunto_id);
    const { error } = await approva(righe[0].appunto_id);
    expect(error).toBeNull();

    const dopo = await conta();
    expect(dopo.lista).toBe(prima.lista + attese);
    expect(dopo.spicciola, "la lista della spesa ha scritto nella spicciola").toBe(prima.spicciola);

    const { spicciola, lista } = await mie();
    expect(lista.map((r) => r.custom_name)).toContain(`${NOME} parmigiano`);
    expect(spicciola.map((r) => r.articolo)).not.toContain(`${NOME} parmigiano`);
  });

  it("due articoli detti per liste diverse restano due appunti, uno per lista", async () => {
    // SPEC-0013: le righe additive si raggruppano per tipo. Due liste
    // diverse sono due tipi diversi, quindi due appunti — che è ciò che
    // SPEC-0012 vuole ottenere.
    const righe = await detta("tutte e due", [
      riga("lista_spesa", "farina"),
      riga("spesa_spicciola", "detersivo"),
    ]);
    expect(righe).toHaveLength(2);
    const appunti = new Set(righe.map((r) => r.appunto_id));
    expect(appunti.size, "le due liste sono finite nello stesso appunto").toBe(2);

    const { data: titoli } = await titolare
      .from("appunti_vocali")
      .select("titolo, eseguibile")
      .in("id", [...appunti]);
    expect(titoli.map((t) => t.titolo).sort()).toEqual(
      ["Aggiungi alla spesa", "Aggiungi alla spesa spicciola"].sort(),
    );
    for (const t of titoli) expect(t.eseguibile).toBe(true);
  });

  // -------------------------------------------------------------------
  it("🔴 se la lista non è stata detta, l'appunto NON si può approvare", async () => {
    const prima = await conta();

    const righe = await detta("senza dire quale", [
      {
        tipo: "lista_non_detta",
        sicuro: true,
        destinazione: "Quale delle due liste?",
        motivo:
          "Non hai detto in quale lista: dimmelo e la scrivo — «alla lista della spesa» oppure «alla spesa spicciola».",
        frase: `${NOME} pane`,
        dati: { nome_libero: `${NOME} pane` },
      },
    ]);

    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("titolo, eseguibile")
      .eq("id", righe[0].appunto_id)
      .single();
    expect(appunto.eseguibile, "un appunto senza lista è approvabile").toBe(false);
    expect(appunto.titolo).toBe("Quale delle due liste?");

    // 🔴 E provando ad approvarlo lo stesso, il database RIFIUTA: senza
    //    questo, «non approvabile» sarebbe una scritta sulla schermata e la
    //    riga entrerebbe passando da un'altra porta.
    // ⚠️ Il corridoio risponde con uno stato non-2xx e `functions.invoke`
    //    non solleva: la frase sta nel CORPO della risposta. Fermarsi a
    //    «c'è stato un errore» proverebbe solo che qualcosa è andato storto,
    //    non che il gestionale ha detto la cosa giusta.
    const r = await approva(righe[0].appunto_id);
    expect(r.error, "un appunto senza lista è stato approvato").not.toBeNull();
    const corpo = await r.error.context.json();
    expect(corpo?.errore?.messaggio ?? "").toMatch(/non si pu/i);

    // E niente è entrato in nessuna delle due.
    expect(await conta()).toEqual(prima);
  });

  it("una lista che non è nessuna delle due resta un appunto col suo nome", async () => {
    const righe = await detta("lista del bar", [
      {
        tipo: "lista_nominata_bar",
        sicuro: true,
        destinazione: "Aggiungi a «bar»",
        frase: `${NOME} sale`,
        dati: { nome_libero: `${NOME} sale`, lista: "bar" },
      },
    ]);
    const { data: appunto } = await titolare
      .from("appunti_vocali")
      .select("titolo, eseguibile")
      .eq("id", righe[0].appunto_id)
      .single();
    expect(appunto.eseguibile).toBe(false);
    expect(appunto.titolo).toBe("Aggiungi a «bar»");
  });

  // -------------------------------------------------------------------
  it("🔴 due mani che approvano lo stesso appunto lo scrivono UNA volta sola", async () => {
    // ⚠️ La concorrenza si prova facendo partire le due chiamate insieme:
    //    una alla volta proverebbe soltanto che un appunto chiuso non si
    //    riapre.
    const prima = await conta();
    const righe = await detta("due mani", [riga("spesa_spicciola", "spugne")]);

    // 🔴 QUANTE RIGHE ASPETTARSI LO DICE L'APPUNTO, NON LA DETTATURA, ed è
    //    la lezione che questa prova ha imparato diventando rossa: la spesa
    //    spicciola è **additiva**, quindi «spugne» può raccogliersi in un
    //    appunto ancora aperto insieme a quello che è stato detto prima —
    //    ed è il comportamento voluto (SPEC-0013). Contando «prima + 1» si
    //    misurava il raggruppamento e lo si chiamava doppia scrittura.
    const quantiElementi = await quantiDentro(righe[0].appunto_id);

    const [a, b] = await Promise.all([
      approva(righe[0].appunto_id),
      approva(righe[0].appunto_id),
    ]);
    const esiti = [a, b].map((r) => (r.error ? "rifiutata" : r.data?.errore ? "rifiutata" : "passata"));
    expect(esiti.filter((e) => e === "passata"), `esiti: ${esiti}`).toHaveLength(1);
    expect(esiti.filter((e) => e === "rifiutata"), `esiti: ${esiti}`).toHaveLength(1);

    const dopo = await conta();
    expect(dopo.spicciola, "l'appunto è stato scritto due volte").toBe(
      prima.spicciola + quantiElementi,
    );
    expect(dopo.lista, "la doppia approvazione ha toccato l'altra lista").toBe(prima.lista);
  });

  // -------------------------------------------------------------------
  it("la spesa spicciola si aggiunge, si segna presa e si toglie — e la lista non se ne accorge", async () => {
    // Le operazioni normali della lista nuova, e la regressione dell'altra:
    // il mandato le chiede tutte e due nella stessa riga.
    const prima = await conta();

    const { data: nata, error: eNata } = await titolare
      .from("spesa_spicciola")
      .insert({ articolo: `${NOME} carta forno`, categoria: "cucina" })
      .select()
      .single();
    expect(eNata).toBeNull();
    miei.spicciola.push(nata.id);
    expect(nata.nel_carrello).toBe(false);

    // «sparisce dall'elenco» non vuol dire cancellata: passa fra le prese,
    // e la data la scrive il database insieme allo stato.
    await titolare.from("spesa_spicciola").update({ nel_carrello: true }).eq("id", nata.id);
    const { data: presa } = await titolare
      .from("spesa_spicciola")
      .select("nel_carrello, preso_il")
      .eq("id", nata.id)
      .single();
    expect(presa.nel_carrello).toBe(true);
    expect(presa.preso_il, "la data di quando è stata presa non è stata scritta").not.toBeNull();

    // e si torna indietro con un tocco
    await titolare.from("spesa_spicciola").update({ nel_carrello: false }).eq("id", nata.id);
    const { data: rimessa } = await titolare
      .from("spesa_spicciola")
      .select("nel_carrello, preso_il")
      .eq("id", nata.id)
      .single();
    expect(rimessa.nel_carrello).toBe(false);
    expect(rimessa.preso_il, "la data è rimasta di una cosa che non è più presa").toBeNull();

    // in tutto questo la lista della spesa non si è mossa
    expect((await conta()).lista).toBe(prima.lista);

    await titolare.from("spesa_spicciola").delete().eq("id", nata.id);
    expect(await conta()).toEqual(prima);
  });

  it("🔴 la spesa spicciola non entra in nessuna bozza d'ordine", async () => {
    // ⚠️ È il fuori-scope di SPEC-0012 messo alla prova: la spicciola non
    //    finisce da un fornitore. La lista degli ordini nasce dalle righe
    //    della lista della spesa, e quelle della spicciola non ci sono
    //    proprio — non hanno né fornitore né prodotto.
    const { data: nata } = await titolare
      .from("spesa_spicciola")
      .insert({ articolo: `${NOME} sacchetti` })
      .select()
      .single();
    miei.spicciola.push(nata.id);

    const { data: righeLista } = await titolare.rpc("lista_spesa");
    const nomi = (righeLista ?? []).map((r) => r.custom_name ?? r.ingredient_name ?? "");
    expect(nomi).not.toContain(`${NOME} sacchetti`);
  });

  // ⚠️ ULTIMA DI PROPOSITO: porta via le righe di questo giro, comprese
  //    quelle delle prove sopra.
  it("🔴 la pulizia porta via anche le righe nate da un'approvazione", async () => {
    // Il caso preciso che lasciava i residui: si approva un appunto, la
    // riga nasce dentro il database, e la prova NON la va a leggere — quindi
    // non se la segna. Prima di questa correzione restava lì per sempre.
    const righe = await detta("approvata e mai letta", [
      riga("spesa_spicciola", "spicciola mai letta"),
      riga("lista_spesa", "lista mai letta"),
    ]);
    for (const appunto of new Set(righe.map((r) => r.appunto_id))) {
      const { error } = await approva(appunto);
      expect(error, "l'approvazione non è riuscita").toBeNull();
    }
    const nate = await conta();
    expect(nate.spicciola + nate.lista, "l'approvazione non ha creato nessuna riga").toBeGreaterThan(0);

    await pulisciLeListe();

    // Dopo la pulizia, di questo giro non resta niente in nessuna delle due.
    expect(await conta()).toEqual({ lista: 0, spicciola: 0 });
  });
});
