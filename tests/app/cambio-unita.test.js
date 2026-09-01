import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, marchio, primaEntita } from "./aiuto";

// 🔴 L'UNITA' DI UN PRODOTTO NON SI CAMBIA DI NASCOSTO (23/08/2026).
//
// Il difetto, misurato prima di correggerlo: cambiare l'unita' di un
// prodotto non era sorvegliato da niente, e i lotti non hanno un'unita'
// propria — la leggono dall'ingrediente. Quindi 993,3333 g diventavano
// 993,3333 kg **senza che nessun numero cambiasse**.
//
// ⚠️ PERCHE' LA PROVA STA QUI E NON SOLO NELLA MIGRAZIONE. La verifica
// dentro la migrazione gira **come proprietaria del database**, dove la RLS
// non esiste: e' la lezione del 16/08 (`log_recipe_status_change` era
// rotta dal 02/08 e nessuna migrazione poteva accorgersene). Il portiere
// nuovo e' `security definer` e legge dodici tabelle — se una di quelle
// letture fosse fatta coi permessi del chiamante, dalla sala fallirebbe.
// Solo una prova col token di un utente vero lo dice.
// ⚠️ IL MARCHIO E' DI QUESTO GIRO, dal 01/09/2026: le pulizie e i
//    conteggi qui sotto usano questo valore in un modello `like`, e con
//    un valore fisso due esecuzioni insieme sullo stesso progetto di
//    prova si cancellano e si contano le righe a vicenda. Vedi la nota
//    in cima a `aiuto.js`.
const NOME = marchio("TEST-AUTO cambio unita");

describe("l'unita' di un prodotto non si cambia se i numeri non la seguono", () => {
  let titolare;
  let ente;
  let conRoba;
  let vuoto;
  let lotto;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    ente = await primaEntita(titolare);

    // ⚠️ Il perimetro e' fatto di roba che la prova ha creato — mai un
    // prodotto vero (lezione del 16/08: FEFO aveva pescato dal lotto
    // sbagliato e la giacenza vera era rimasta corta di 2).
    const { data: vecchi } = await titolare
      .from("ingredients").select("id").like("name", `${NOME}%`);
    for (const v of vecchi ?? []) {
      await titolare.from("stock_lots").delete().eq("ingredient_id", v.id);
      await titolare.from("price_history").delete().eq("ingredient_id", v.id);
      await titolare.from("ingredients").delete().eq("id", v.id);
    }

    const { data: a } = await titolare.from("ingredients").insert({
      entity_id: ente, name: `${NOME} pieno`, category: "altro",
      unit: "kg", current_price: 12.5,
    }).select("id").single();
    conRoba = a.id;

    const { data: l } = await titolare.from("stock_lots").insert({
      ingredient_id: conRoba, quantity_received: 2, quantity_remaining: 2,
      unit_cost: 12.5,
    }).select("id").single();
    lotto = l.id;

    const { data: b } = await titolare.from("ingredients").insert({
      entity_id: ente, name: `${NOME} vuoto`, category: "altro",
      unit: "kg", current_price: 0,
    }).select("id").single();
    vuoto = b.id;
  });

  afterAll(async () => {
    if (lotto) await titolare.from("stock_lots").delete().eq("id", lotto);
    for (const id of [conRoba, vuoto].filter(Boolean)) {
      await titolare.from("price_history").delete().eq("ingredient_id", id);
      await titolare.from("ingredients").delete().eq("id", id);
    }
    await titolare.auth.signOut({ scope: "local" });
  });

  it("un prodotto con lotti non passa da chili a litri, e il rifiuto lo spiega", async () => {
    const { error } = await titolare
      .from("ingredients").update({ unit: "l" }).eq("id", conRoba);

    expect(error).not.toBeNull();
    // ⚠️ Non basta che rifiuti: il messaggio deve dire cosa fare. Un
    // rifiuto senza via d'uscita e' un vicolo cieco (regola del 16/08).
    expect(error.message).toMatch(/nessuna conversione/i);
    expect(error.message).toMatch(/crea un prodotto nuovo/i);
  });

  it("🔴 e i numeri restano quelli: e' questo il difetto che chiude", async () => {
    const { data } = await titolare
      .from("stock_lots").select("quantity_remaining, unit_cost").eq("id", lotto).single();

    expect(Number(data.quantity_remaining)).toBe(2);
    expect(Number(data.unit_cost)).toBe(12.5);

    const { data: ing } = await titolare
      .from("ingredients").select("unit").eq("id", conRoba).single();
    expect(ing.unit).toBe("kg");
  });

  it("un prodotto senza niente attaccato cambia unita' liberamente", async () => {
    // ⚠️ La meta' che si dimentica: se rifiutasse SEMPRE, questa prova
    // sarebbe l'unica ad accorgersene — e il gestionale diventerebbe
    // scomodo proprio nel caso normale, cioe' il prodotto appena creato
    // a cui si e' sbagliata l'unita'.
    const { error } = await titolare
      .from("ingredients").update({ unit: "l" }).eq("id", vuoto);
    expect(error).toBeNull();

    const { data } = await titolare
      .from("ingredients").select("unit").eq("id", vuoto).single();
    expect(data.unit).toBe("l");
  });

  it("🔴 dalla sala il motivo del rifiuto NON si puo' chiedere: dentro c'e' un prezzo", async () => {
    // Il messaggio nomina il numero che si perderebbe — e quando quel
    // numero e' il prezzo d'acquisto, chiederlo sarebbe un modo obliquo di
    // leggerlo. E' il difetto chiuso il 13/08 su varianti_ingrediente() e
    // variazione_prezzo(), che stava per rientrare da questa porta.
    //
    // ⚠️ Trovato dalla rete del 19/08, non rileggendo: `permessi.test.js`
    // e' diventata rossa da sola nominando `cambio_unita_impedito` fra le
    // funzioni che scavalcano la RLS senza chiedere chi sei.
    const staff = await clientAutenticato(credenziali().staff);

    const { error } = await staff.rpc("cambio_unita_impedito", {
      p_ingredient_id: conRoba, p_da: "kg", p_a: "g",
    });
    expect(error).not.toBeNull();
    expect(error.message).toMatch(/riservati al titolare/i);

    // ⚠️ E l'unita' resta quella. Qui l'update non da' errore — la RLS
    // filtra la riga e PostgREST non si lamenta di zero righe toccate: e'
    // il motivo per cui questa prova guarda il FATTO e non l'errore.
    //
    // ⚠️ E il fatto lo rilegge il TITOLARE: `ingredients` e' titolare-only
    // anche in lettura, quindi allo staff quella riga torna vuota — e una
    // riga vuota non dimostra niente sul valore che c'e' dentro.
    await staff.from("ingredients").update({ unit: "l" }).eq("id", conRoba);
    const { data } = await titolare
      .from("ingredients").select("unit").eq("id", conRoba).single();
    expect(data.unit).toBe("kg");

    await staff.auth.signOut({ scope: "local" });
  });

  it("nessuna colonna numerica legata a un ingrediente resta non classificata", async () => {
    // La rete: quando qualcuno aggiungera' una colonna nuova che tiene una
    // quantita' o un prezzo per unita', questa prova diventa rossa da sola
    // — invece di lasciare un numero che cambia significato in silenzio.
    const { data, error } = await titolare.rpc("colonne_unita_non_classificate");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
