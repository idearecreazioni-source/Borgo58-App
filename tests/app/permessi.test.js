import { beforeAll, describe, expect, it } from "vitest";
import { clientAnonimo, clientAutenticato, credenziali } from "./aiuto";

// La matrice dei permessi, riprovabile in venti secondi.
//
// È il protocollo §7 punto 1-2 trasformato in automazione: ogni verifica
// che finora richiedeva due login manuali e occhi attenti. Tutte le prove
// di questo file sono di sola lettura o scritture RESPINTE: non lasciano
// nulla nel database.
describe("permessi: la barriera è nel database, non nella schermata", () => {
  let staff;
  let titolare;
  let anonimo;

  beforeAll(async () => {
    const cred = credenziali();
    staff = await clientAutenticato(cred.staff);
    titolare = await clientAutenticato(cred.titolare);
    anonimo = clientAnonimo();
  });

  it("lo staff NON vede gli ingredienti (lì vivono i prezzi d'acquisto)", async () => {
    const [perStaff, perTitolare] = await Promise.all([
      staff.from("ingredients").select("id"),
      titolare.from("ingredients").select("id"),
    ]);
    expect(perStaff.error).toBeNull();
    expect(perStaff.data).toHaveLength(0); // la RLS filtra: zero righe, non un errore
    expect(perTitolare.data.length).toBeGreaterThan(0);
  });

  it("lo staff NON vede i fornitori (anagrafica riservata)", async () => {
    const [perStaff, perTitolare] = await Promise.all([
      staff.from("suppliers").select("id"),
      titolare.from("suppliers").select("id"),
    ]);
    expect(perStaff.data).toHaveLength(0);
    expect(perTitolare.data.length).toBeGreaterThan(0);
  });

  it("gli adempimenti riservati in Agenda restano invisibili allo staff", async () => {
    const [perStaff, perTitolare] = await Promise.all([
      staff.from("tasks").select("id"),
      titolare.from("tasks").select("id"),
    ]);
    expect(perStaff.error).toBeNull();
    // Il titolare vede tutto; lo staff strettamente di meno (i 7 adempimenti
    // societari con importi e codici F24 sono riservati).
    expect(perTitolare.data.length).toBeGreaterThan(perStaff.data.length);
  });

  it("lo staff legge le causali (gli servono per chiudere un conto) ma non può modificarle", async () => {
    const lettura = await staff.from("cash_causali").select("id, label");
    expect(lettura.error).toBeNull();
    expect(lettura.data.length).toBeGreaterThan(0);

    const scrittura = await staff.from("cash_causali").insert({ label: "__PROVA__", kind: "entrata" });
    expect(scrittura.error).not.toBeNull(); // respinta dalla RLS
  });

  it("lo staff vede il menu di sala e la carta bevande, senza colonne economiche riservate", async () => {
    const menu = await staff.from("menu_items_display").select("*");
    expect(menu.error).toBeNull();
    if (menu.data.length > 0) {
      // Il prezzo di VENDITA deve esserci; food cost e margini non esistono
      // proprio come colonne: il dato riservato è strutturalmente assente.
      const colonne = Object.keys(menu.data[0]);
      expect(colonne).toContain("selling_price");
      expect(colonne).not.toContain("food_cost");
      expect(colonne).not.toContain("margin");
    }
    const carta = await staff.from("bar_items").select("id");
    expect(carta.error).toBeNull();
  });

  it("lo staff legge il prezzo del coperto ma non può cambiarlo", async () => {
    const lettura = await staff.from("service_settings").select("coperto_price").eq("id", 1).single();
    expect(lettura.error).toBeNull();
    expect(Number(lettura.data.coperto_price)).toBeGreaterThanOrEqual(0);

    const scrittura = await staff.from("service_settings").update({ coperto_price: 999 }).eq("id", 1).select();
    // Update respinto dalla RLS: nessuna riga toccata (o errore esplicito).
    expect(scrittura.error ? true : scrittura.data.length === 0).toBe(true);
  });

  it("senza login non si legge niente, nemmeno l'elenco dei tavoli", async () => {
    const r = await anonimo.from("dining_tables").select("id");
    expect(r.error ? true : r.data.length === 0).toBe(true);
  });

  it("il form pubblico valida anche per chi non è loggato (funzione raggiungibile, dati respinti)", async () => {
    // Data nel passato: la funzione deve rispondere col SUO messaggio.
    const r = await anonimo.rpc("submit_public_reservation", {
      p_reservation_date: "2020-01-01",
      p_reservation_time: "20:00",
      p_party_size: 2,
      p_customer_name: "Prova",
      p_customer_phone: "000",
    });
    expect(r.error).not.toBeNull();
    expect(r.error.message).toContain("Data non valida");
  });

  it("il corridoio respinge chi non è autenticato", async () => {
    const r = await anonimo.functions.invoke("operazioni-atomiche", {
      body: { operazione: "close_order_as_discount_gift", parametri: {} },
    });
    expect(r.error).not.toBeNull();
  });

  it("il corridoio respinge le operazioni fuori elenco anche da autenticati", async () => {
    const r = await staff.functions.invoke("operazioni-atomiche", {
      body: { operazione: "operazione_inventata", parametri: {} },
    });
    expect(r.error).not.toBeNull();
  });

  it("il corridoio arriva fino al database con un utente vero (conto inesistente → messaggio del database)", async () => {
    const r = await staff.functions.invoke("operazioni-atomiche", {
      body: {
        operazione: "close_order_as_discount_gift",
        parametri: { p_order_id: crypto.randomUUID(), p_is_gift: true },
      },
    });
    expect(r.error).not.toBeNull();
    const corpo = await r.error.context?.json().catch(() => null);
    expect(corpo?.errore?.messaggio).toContain("Conto non trovato");
  });
});
