import { beforeAll, describe, expect, it } from "vitest";
import {
  almenoUnaRiga,
  clientAnonimo,
  clientAutenticato,
  corridoioInstallato,
  credenziali,
  primaEntita,
} from "./aiuto";

// Il corridoio si cerca PRIMA di definire le prove: se la funzione online
// non è installata su questo progetto, le prove che la riguardano vengono
// saltate invece di passare per il motivo sbagliato (un 404 è un errore
// anche lui, e "mi aspetto un errore" sarebbe soddisfatto da quello).
const sonda = await clientAutenticato(credenziali().staff);
const CORRIDOIO = await corridoioInstallato(sonda);
await sonda.auth.signOut({ scope: "local" });

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
    const pulisci = await almenoUnaRiga(titolare, "ingredients", {
      entity_id: await primaEntita(titolare),
      name: "__PROVA__ ingrediente",
      category: "altro",
      unit: "kg",
      current_price: 1,
    });
    try {
      const [perStaff, perTitolare] = await Promise.all([
        staff.from("ingredients").select("id"),
        titolare.from("ingredients").select("id"),
      ]);
      expect(perStaff.error).toBeNull();
      expect(perStaff.data).toHaveLength(0); // la RLS filtra: zero righe, non un errore
      expect(perTitolare.data.length).toBeGreaterThan(0);
    } finally {
      await pulisci();
    }
  });

  it("lo staff NON vede i fornitori (anagrafica riservata)", async () => {
    const pulisci = await almenoUnaRiga(titolare, "suppliers", {
      entity_id: await primaEntita(titolare),
      name: "__PROVA__ fornitore",
    });
    try {
      const [perStaff, perTitolare] = await Promise.all([
        staff.from("suppliers").select("id"),
        titolare.from("suppliers").select("id"),
      ]);
      expect(perStaff.data).toHaveLength(0);
      expect(perTitolare.data.length).toBeGreaterThan(0);
    } finally {
      await pulisci();
    }
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

  // Il controllo anti-deriva che il validatore rifaceva a mano. L'11/08
  // erano 35 le funzioni aperte a chiunque avesse la chiave pubblica del
  // sito; chiuse tutte tranne quelle del form. Il 12/08 l'elenco è
  // ricresciuto da 12 a 14 senza che nessuno lo dicesse — ed è quello il
  // difetto, non il contenuto: due normalizzatori non facevano male, la
  // prossima funzione potrebbe. Qui l'elenco diventa una prova che
  // diventa rossa da sola.
  it("solo 12 funzioni si possono eseguire con la sola chiave pubblica", async () => {
    const attese = [
      "abbina_righe_carico",
      "check_recipe_component",
      "generate_foraged_lot",
      "is_titolare",
      "log_recipe_status_change",
      "normalize_phone",
      "public_reservation_options",
      "set_aggiornato_il",
      "set_task_visibility",
      "set_updated_at",
      "submit_public_reservation",
      "task_origin_visible_to_staff",
    ];

    const r = await titolare.rpc("funzioni_aperte_ad_anon");
    expect(r.error).toBeNull();

    const ora = (r.data ?? []).map((x) => x.nome ?? x).sort();
    // Il messaggio di errore deve dire QUALE è comparsa, non solo che il
    // numero non torna: chi legge una prova rossa deve poter decidere.
    expect(ora).toEqual(attese);
  });

  it.skipIf(!CORRIDOIO)("il corridoio respinge chi non è autenticato", async () => {
    const r = await anonimo.functions.invoke("operazioni-atomiche", {
      body: { operazione: "close_order_as_discount_gift", parametri: {} },
    });
    expect(r.error).not.toBeNull();
  });

  it.skipIf(!CORRIDOIO)("il corridoio respinge le operazioni fuori elenco anche da autenticati", async () => {
    const r = await staff.functions.invoke("operazioni-atomiche", {
      body: { operazione: "operazione_inventata", parametri: {} },
    });
    expect(r.error).not.toBeNull();
  });

  it.skipIf(!CORRIDOIO)("il corridoio arriva fino al database con un utente vero (conto inesistente → messaggio del database)", async () => {
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

  // Sentinella: una prova saltata in silenzio, dopo un mese, è una prova
  // che nessuno sa di non avere più. Finché il corridoio non è installato
  // qui, questa riga resta rossa e lo ricorda.
  it("il corridoio è installato anche su questo progetto", () => {
    expect(
      CORRIDOIO,
      "La funzione online 'operazioni-atomiche' non è installata sul progetto di prova: " +
        "le tre prove del corridoio sono state SALTATE (docs/AMBIENTE_PROVA.md §6)."
    ).toBe(true);
  });
});
