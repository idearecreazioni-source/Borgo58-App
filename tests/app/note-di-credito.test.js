import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, corridoioInstallato, credenziali, primaEntita } from "./aiuto";
// ⚠️ La STESSA stringa che usa la schermata, non una copia: se domani
// `da_pagare` cadesse da lì, questa prova diventerebbe rossa. Con una copia
// resterebbe verde mentre la schermata mostra il lordo.
import { SELECT_FATTURA } from "../../src/lib/calcoli/selectFatture";

// Le note di credito (n. 8 del collaudo, 17/08/2026).
//
// ⚠️ COSA PROVA QUESTO FILE, E PERCHÉ NON POTREBBE PROVARLO LA MIGRAZIONE.
// Il giro completo — nota prima, nota dopo, credito usato, rifiuti — sta
// dentro `20260817000002`, che gira come proprietaria e si ripulisce per
// intero. Qui si prova solo ciò che da dentro una migrazione è invisibile:
//
//  1. che `da_pagare`, `note_scalate` e `credito_residuo` arrivino davvero
//     al browser. Sono colonne CALCOLATE: nel database funzionano sempre,
//     ma se PostgREST non le espone la schermata mostra il lordo — cioè un
//     «da pagare» che mente, esattamente il difetto che il n. 8 chiude;
//  2. che il corridoio conosca le due operazioni nuove. Un nome fuori
//     dall'elenco risponde 404, e nessuna prova sul database se ne accorge;
//  3. che lo staff non veda le note di credito, **con righe vere dentro**
//     (§5 punto 2: mai dichiarare verificata una RLS su una tabella vuota).
//
// ⚠️ E NON CREA NÉ CANCELLA NIENTE nelle tabelle sorvegliate dal registro
// delle cancellazioni (tests/app/LEGGIMI.md): le righe su cui lavora sono
// quelle dello scenario di collaudo, che si demolisce da SQL coi trigger
// spenti. Per questo il file PRETENDE lo scenario invece di saltare quando
// manca: una prova che diventa verde perché non ha trovato dati è la stessa
// trappola ricomparsa cinque volte in questo progetto, al contrario.
const COMANDO = "npm run prova:base -- --rifai --scenario";

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);

describe("la nota di credito: se arriva prima riduce, se arriva dopo resta credito", () => {
  let titolare;
  let staff;
  let ente;
  let scalata; // BASE-058: 195,69 con una nota da 25,69 → 170,00
  let scaduta; // BASE-101: 74,90 senza note, del fornitore che ha il credito

  const SELECT = SELECT_FATTURA;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    ente = await primaEntita(titolare);

    const { data, error } = await titolare
      .from("supplier_invoices")
      .select(SELECT)
      .in("invoice_number", ["BASE-058", "BASE-101"]);
    if (error) {
      throw new Error(
        `Le colonne calcolate non arrivano dal database: ${error.message}. ` +
          "È il difetto che questo file esiste per prendere."
      );
    }
    scalata = data.find((r) => r.invoice_number === "BASE-058");
    scaduta = data.find((r) => r.invoice_number === "BASE-101");
    if (!scalata || !scaduta) {
      throw new Error(`Manca lo scenario di collaudo sul progetto di prova. Rifallo con: ${COMANDO}`);
    }
  });

  afterAll(async () => {
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
    await sonda.auth.signOut({ scope: "local" });
  });

  it("«fattura 195,69 · nota −25,69 · da pagare 170,00» arriva tutto al browser", () => {
    // I tre numeri che la schermata deve dire. Il terzo è quello che
    // conta: se `da_pagare` non arrivasse, la schermata mostrerebbe 195,69
    // e sembrerebbe che manchino 25,69 euro.
    expect(Number(scalata.amount)).toBe(195.69);
    expect(Number(scalata.note_scalate)).toBe(25.69);
    expect(Number(scalata.da_pagare)).toBe(170);

    // E l'etichetta di QUALE nota, altrimenti il −25,69 è un numero senza
    // spiegazione: arriva dall'aggancio, non da una seconda interrogazione.
    expect(scalata.utilizzi).toHaveLength(1);
    expect(scalata.utilizzi[0].nota.numero).toBe("NC-2027/14");
    expect(Number(scalata.utilizzi[0].importo)).toBe(25.69);
  });

  it("senza note, «da pagare» è l'importo: la colonna non inventa sconti", () => {
    // La metà che rende discriminante quella sopra. Se `da_pagare`
    // restituisse sempre zero, o sempre l'importo, una delle due prove
    // sarebbe rossa.
    expect(Number(scaduta.note_scalate)).toBe(0);
    expect(Number(scaduta.da_pagare)).toBe(Number(scaduta.amount));
  });

  it("il credito arrivato DOPO il pagamento resta intero, e si vede per fornitore", async () => {
    const { data: note, error } = await titolare
      .from("note_credito")
      .select("numero, importo, credito_residuo, fattura:fattura_id(invoice_number, status)")
      .eq("entity_id", ente);
    expect(error).toBeFalsy();

    const dopo = note.find((n) => n.numero === "NC-2027/21");
    expect(dopo, "manca la nota arrivata dopo il pagamento").toBeTruthy();
    // La fattura che corregge era già pagata: la nota non ha riscritto
    // quel pagamento, è diventata credito.
    expect(dopo.fattura.status).toBe("pagata");
    expect(Number(dopo.credito_residuo)).toBe(30);

    const prima = note.find((n) => n.numero === "NC-2027/14");
    expect(Number(prima.credito_residuo)).toBe(0);

    const { data: crediti } = await titolare.rpc("crediti_fornitore", { p_entity_id: ente });
    const riga = crediti.find((r) => r.supplier_id === scaduta.supplier.id);
    expect(riga, "il credito non compare fra quelli del fornitore").toBeTruthy();
    expect(Number(riga.residuo)).toBe(30);
  });

  it("pagando la fattura dopo, il credito viene proposto e l'anteprima dice il netto", async () => {
    const { data: proposte, error } = await titolare.rpc("crediti_per_fattura", {
      p_invoice_id: scaduta.id,
    });
    expect(error).toBeFalsy();
    const p = proposte.find((r) => r.numero === "NC-2027/21");
    expect(p, "il credito non viene proposto sulla fattura successiva").toBeTruthy();
    expect(Number(p.usabile)).toBe(30);

    // ⚠️ La prova misura una DIFFERENZA prodotta: senza il credito uscono
    // 74,90, con il credito 44,90. Due numeri che devono divergere di una
    // cifra nota, non due che devono coincidere.
    const { data: senza } = await titolare.rpc("anteprima_pagamento", {
      p_invoice_id: scaduta.id,
      p_note: null,
    });
    const { data: con } = await titolare.rpc("anteprima_pagamento", {
      p_invoice_id: scaduta.id,
      p_note: [p.nota_id],
    });
    expect(Number(senza[0].netto)).toBe(74.9);
    expect(Number(con[0].netto)).toBe(44.9);
    expect(Number(con[0].scalato_ora)).toBe(30);
  });

  it("il documento collegato viaggia insieme alla fattura", () => {
    // Il DDT: un collegamento e basta, nessun conto ci passa dentro. Se
    // l'aggancio non funzionasse, la schermata non avrebbe come mostrarlo.
    expect(scaduta.documenti.length).toBeGreaterThan(0);
    expect(scaduta.documenti[0].title).toContain("DDT");
  });

  it("lo staff non vede nessuna nota di credito — e ce ne sono di vere", async () => {
    const { data: viste } = await titolare.from("note_credito").select("id");
    expect(viste.length, "senza righe vere questa prova non dimostra niente").toBeGreaterThan(0);

    const { data: nascoste } = await staff.from("note_credito").select("id");
    expect(nascoste ?? []).toHaveLength(0);
    const { data: nascosti } = await staff.from("note_credito_utilizzi").select("id");
    expect(nascosti ?? []).toHaveLength(0);

    for (const [fn, args] of [
      ["crediti_fornitore", { p_entity_id: ente }],
      ["crediti_per_fattura", { p_invoice_id: scaduta.id }],
      ["anteprima_pagamento", { p_invoice_id: scaduta.id, p_note: null }],
      ["crediti_da_applicare", { p_invoice_id: scaduta.id, p_note: null }],
    ]) {
      const { error } = await staff.rpc(fn, args);
      expect(error, `${fn} avrebbe dovuto rifiutare lo staff`).toBeTruthy();
    }
  });

  it.skipIf(!CORRIDOIO)("il corridoio conosce le due operazioni nuove", async () => {
    // ⚠️ Non si registra niente: si chiama con parametri che la FUNZIONE
    // deve rifiutare, e si guarda da dove arriva il rifiuto. Se il nome
    // non fosse nell'elenco del corridoio la risposta sarebbe
    // `codice: "operazione"`, e nessuna prova sul database lo vedrebbe.
    const r = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "registra_nota_credito",
        parametri: {
          p_entity_id: ente,
          p_supplier_id: scaduta.supplier.id,
          p_data: "1991-01-01",
          p_importo: 0,
        },
      },
    });
    const corpo = await r.error.context.json();
    expect(corpo.errore.codice).not.toBe("operazione");
    expect(corpo.errore.messaggio).toContain("maggiore di zero");

    // `elimina_nota_credito` su un identificativo inesistente non cancella
    // niente e non lascia lapidi: serve solo a dire che il nome esiste.
    const e = await titolare.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "elimina_nota_credito",
        parametri: { p_id: "00000000-0000-0000-0000-000000000000" },
      },
    });
    if (e.error) {
      const c = await e.error.context.json();
      expect(c.errore.codice).not.toBe("operazione");
    }
  });

  it("una fattura con una nota addosso non si cancella: e il rifiuto dice cosa fare", async () => {
    // ⚠️ Si chiama la cancellazione di una riga dello SCENARIO, che deve
    // essere respinta: quindi non cancella niente e non lascia lapidi. È
    // il rifiuto stesso a essere la prova.
    const r = await titolare.functions.invoke("operazioni-atomiche", {
      body: { operazione: "delete_supplier_invoice", parametri: { p_invoice_id: scalata.id } },
    });
    expect(r.error, "ha cancellato una fattura con una nota di credito collegata").toBeTruthy();
    const corpo = await r.error.context.json();
    expect(corpo.errore.messaggio).toContain("note di credito");
    // Un rifiuto senza gesto d'uscita è un vicolo cieco (difetto n. 8 del
    // mandato di correzione): il messaggio deve nominare la via.
    expect(corpo.errore.messaggio).toContain("Togli prima");

    // E la fattura è ancora lì.
    const { data } = await titolare
      .from("supplier_invoices")
      .select("id")
      .eq("id", scalata.id)
      .maybeSingle();
    expect(data).toBeTruthy();
  });

  it("pagare una fattura non conta il costo due volte", async () => {
    // 🔴 Il difetto trovato scrivendo il n. 8: le rettifiche sommavano le
    // uscite di prima nota E le fatture, ma pagare una fattura scrive
    // un'uscita — quindi il costo compariva due volte e la deduzione
    // risultava più alta del dovuto.
    //
    // BASE-098 è pagata nello scenario, quindi ha la sua uscita in prima
    // nota: se il difetto tornasse, `costi_totali` conterebbe 128,44 due
    // volte. Si misura senza scrivere niente.
    const { data: pagata } = await titolare
      .from("supplier_invoices")
      .select("id, amount, invoice_date")
      .eq("invoice_number", "BASE-098")
      .maybeSingle();
    expect(pagata, `manca la fattura pagata dello scenario. Rifallo con: ${COMANDO}`).toBeTruthy();

    const { count } = await titolare
      .from("cash_movements")
      .select("id", { count: "exact", head: true })
      .eq("supplier_invoice_id", pagata.id);
    expect(count, "la fattura pagata non ha l'uscita in prima nota").toBe(1);

    const anno = Number(pagata.invoice_date.slice(0, 4));
    const dal = `${anno}-01-01`;
    const al = `${anno}-12-31`;
    const { data: r } = await titolare.rpc("rettifiche_fiscali", {
      p_entity_id: ente,
      p_anno: anno,
    });

    // ⚠️ Non si confronta con un totale scritto a mano — sarebbe un
    // fossile (lezione del 16/08). Si ricompone la DEFINIZIONE dei costi
    // dell'anno dalle sue quattro fonti, e si pretende l'uguaglianza
    // esatta: le fatture una volta sola, le note sottratte, le uscite di
    // prima nota che NON pagano una fattura, e le note «di tasca mia»
    // senza fattura. Se una fattura pagata tornasse a contare due volte,
    // la differenza sarebbe esattamente il suo importo.
    const somma = (righe, campo) => righe.reduce((t, x) => t + Number(x[campo]), 0);

    const { data: movimenti } = await titolare
      .from("cash_movements")
      .select("amount, supplier_invoice_id, causale:causale_id(di_sistema)")
      .eq("entity_id", ente)
      .eq("direction", "uscita")
      .gte("movement_date", dal)
      .lte("movement_date", al);
    const { data: fatture } = await titolare
      .from("supplier_invoices")
      .select("amount")
      .eq("entity_id", ente)
      .gte("invoice_date", dal)
      .lte("invoice_date", al);
    const { data: note } = await titolare
      .from("note_credito")
      .select("importo")
      .eq("entity_id", ente)
      .gte("data", dal)
      .lte("data", al);
    const { data: tasca } = await titolare
      .from("anticipazioni_socio")
      .select("importo, supplier_invoice_id")
      .eq("entity_id", ente)
      .gte("pagata_il", dal)
      .lte("pagata_il", al);

    const atteso =
      somma(
        movimenti.filter((m) => !m.supplier_invoice_id && !m.causale?.di_sistema),
        "amount"
      ) +
      somma(fatture, "amount") -
      somma(note, "importo") +
      somma(
        tasca.filter((a) => !a.supplier_invoice_id),
        "importo"
      );

    expect(fatture.length).toBeGreaterThan(0);
    expect(Number(r[0].costi_totali)).toBeCloseTo(atteso, 2);
    // E l'avvertenza lo dichiara, così il numero non viaggia senza il suo
    // limite (stessa regola di `calcola_imposte()`).
    expect(r[0].avvertenza).toContain("non e' un secondo costo");
  });
});
