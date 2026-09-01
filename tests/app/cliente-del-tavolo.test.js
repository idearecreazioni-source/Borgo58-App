import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, corridoioInstallato, credenziali, denunciaSaltiCorridoio, marchio } from "./aiuto";

// IL CLIENTE PAGANTE DEL TAVOLO — 23/08/2026, blocco 5 del mandato.
//
// 🔴 La regola di Alessio: **il tavolo si associa al cliente PAGANTE, che
// sia quello della prenotazione o no**. Prenota Tizio, paga Caio: il tavolo
// va a Caio e la prenotazione resta quello che era.
//
// ⚠️ SI ENTRA DAL CORRIDOIO, non chiamando la funzione del database: è la
// strada che usa il gestionale (Contratto B4). Un'operazione dimenticata
// nell'elenco del corridoio risponde 404, e **nessuna prova SQL se ne
// accorge** — la verifica dentro la migrazione chiama la funzione, non la
// porta.
// ⚠️ IL MARCHIO E' DI QUESTO GIRO, dal 01/09/2026: le pulizie e i
//    conteggi qui sotto usano questo valore in un modello `like`, e con
//    un valore fisso due esecuzioni insieme sullo stesso progetto di
//    prova si cancellano e si contano le righe a vicenda. Vedi la nota
//    in cima a `aiuto.js`.
const NOME = marchio("TEST-AUTO pagante");
const TEL = "+399991234501";
const TEL2 = "+399991234502";

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);
await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);

describe.skipIf(!CORRIDOIO)("chi paga questo tavolo", () => {
  let titolare;
  let tavolo;
  let conto;
  let cliente;

  const op = (operazione, parametri) =>
    titolare.functions.invoke("operazioni-atomiche", { body: { operazione, parametri } });

  async function pulisci() {
    const { data: conti } = await titolare.from("orders").select("id").like("note", `${NOME}%`);
    for (const o of conti ?? []) {
      await titolare.from("orders").update({ customer_id: null }).eq("id", o.id);
      await titolare.from("order_tables").delete().eq("order_id", o.id);
      await titolare.from("orders").delete().eq("id", o.id);
    }
    await titolare.from("customers").delete().like("name", `${NOME}%`);
    await titolare.from("customers").delete().in("phone", [TEL, TEL2]);
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    await pulisci();

    // Un tavolo che non è in uso adesso.
    const { data: sagome } = await titolare.from("dining_tables").select("id, label").eq("tipo", "tavolo");
    const { data: occupati } = await titolare
      .from("order_tables")
      .select("dining_table_id")
      .eq("conto_aperto", true);
    const presi = new Set((occupati ?? []).map((r) => r.dining_table_id));
    tavolo = (sagome ?? []).find((t) => !presi.has(t.id));
    expect(tavolo, "serve un tavolo libero").toBeTruthy();

    const r = await op("apri_conto", {
      p_tavoli: [tavolo.id],
      p_device_id: null,
      p_note: `${NOME} conto`,
      p_serata: null,
    });
    expect(r.error).toBeNull();
    conto = r.data?.risultato?.order_id ?? r.data?.order_id;
    expect(conto).toBeTruthy();
  });

  afterAll(async () => {
    // I dati di prova si cancellano subito dopo la prova (§5 punto 8).
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
  });

  it("registrare un cliente al momento lo attacca al conto", async () => {
    const r = await op("assegna_cliente_conto", {
      p_order_id: conto,
      p_customer_id: null,
      p_nome: `${NOME} Rossi`,
      p_telefono: TEL,
    });
    expect(r.error).toBeNull();
    const esito = r.data?.risultato ?? r.data;
    expect(esito.creato).toBe(true);
    cliente = esito.customer_id;

    const { data } = await titolare.from("orders").select("customer_id").eq("id", conto).single();
    expect(data.customer_id).toBe(cliente);
  });

  it("lo stesso numero NON crea una seconda scheda", async () => {
    // ⚠️ È il difetto che si paga mesi dopo: due «Rossi» perché due
    // camerieri hanno scritto lo stesso nome. Il numero è l'identità.
    const r = await op("assegna_cliente_conto", {
      p_order_id: conto,
      p_customer_id: null,
      p_nome: "scritto di fretta",
      p_telefono: "+39 999 1234 501",
    });
    expect(r.error).toBeNull();
    const esito = r.data?.risultato ?? r.data;
    expect(esito.creato).toBe(false);
    expect(esito.customer_id).toBe(cliente);
  });

  it("e il nome che c'era non viene sovrascritto da quello di fretta", async () => {
    const { data } = await titolare.from("customers").select("name").eq("id", cliente).single();
    expect(data.name).toBe(`${NOME} Rossi`);
  });

  it("il pagante si cambia, e la prenotazione non si tocca", async () => {
    const { data: prima } = await titolare
      .from("orders")
      .select("reservation_id")
      .eq("id", conto)
      .single();

    const nuovo = await titolare
      .from("customers")
      .insert({ name: `${NOME} Bianchi`, phone: TEL2 })
      .select("id")
      .single();
    expect(nuovo.error).toBeNull();

    const r = await op("assegna_cliente_conto", { p_order_id: conto, p_customer_id: nuovo.data.id });
    expect(r.error).toBeNull();

    const { data: dopo } = await titolare
      .from("orders")
      .select("customer_id, reservation_id")
      .eq("id", conto)
      .single();
    expect(dopo.customer_id).toBe(nuovo.data.id);
    // La prenotazione è rimasta quella che era: è tutta la regola.
    expect(dopo.reservation_id).toBe(prima.reservation_id);
  });

  it("si può staccare: un gesto senza via d'uscita è un vicolo cieco", async () => {
    const r = await op("assegna_cliente_conto", { p_order_id: conto });
    expect(r.error).toBeNull();
    const { data } = await titolare.from("orders").select("customer_id").eq("id", conto).single();
    expect(data.customer_id).toBeNull();
  });

  it("un cliente con un conto sopra non si lascia cancellare", async () => {
    // 🔴 È il caso che avrebbe fatto fallire INTERA la pulizia notturna
    // della privacy: la chiave esterna è `restrict`, e senza la riga
    // aggiunta a `pulisci_richieste_scadute` il lavoro delle 4:30 si
    // sarebbe portato via anche le cancellazioni legittime.
    await op("assegna_cliente_conto", { p_order_id: conto, p_customer_id: cliente });
    const { error } = await titolare.from("customers").delete().eq("id", cliente);
    expect(error).not.toBeNull();
    expect(error.code).toBe("23503");
  });
});
