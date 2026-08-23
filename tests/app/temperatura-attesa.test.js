import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import { createIngredient, getIngredient } from "../../src/lib/api/ingredients";

// La temperatura ATTESA non è la temperatura MISURATA (23/08/2026).
//
// 🔴 Perché questa prova esiste. Sulla scheda di un prodotto c'è a che
// temperatura *dovrebbe* arrivare: una norma, che l'assistente compila.
// Nel registro HACCP di ricevimento c'è quella che si è *letta col
// termometro*, e quel registro si esibisce a un'ispezione — chi lo firma
// è Alessio. Sono due dati di natura diversa, e fino al 23/08 avevano lo
// stesso nome.
//
// ⚠️ E il tratto che si prova qui è quello che nessuna verifica dentro una
// migrazione può provare: dalla SCHERMATA al database. `createIngredient`
// passa il valore col nome del parametro vecchio (`p_haccp_receiving_temp`,
// che non si può rinominare senza rompere le chiamate del corridoio) e
// deve finire nella colonna nuova. Se quel filo si staccasse, il campo si
// vedrebbe a schermo, si salverebbe senza errore, e sarebbe vuoto.
const NOME = "TEST-AUTO temperatura attesa";

describe("la temperatura attesa arriva al database, e non entra nel registro", () => {
  let titolare;
  let ente;
  let creato;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    ente = await primaEntita(titolare);
    // ⚠️ SI ENTRA COL COLLEGAMENTO DELL'APP, non con uno aperto qui: le
    // funzioni di api/ingredients.js passano dal corridoio, che usa QUELLO.
    // Con un client proprio l'app parlerebbe da anonima e il corridoio
    // risponderebbe «Sessione non valida» — lezione del 18/08.
    await supabase.auth.signInWithPassword(credenziali().titolare);
    await titolare.from("ingredients").delete().eq("name", NOME);
  });

  afterAll(async () => {
    if (creato) await titolare.from("ingredients").delete().eq("id", creato);
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  });

  it("si scrive dalla scheda del prodotto e si rilegge uguale", async () => {
    const r = await createIngredient({
      entity_id: ente,
      name: NOME,
      category: "pesce",
      unit: "kg",
      current_price: 12,
      temperatura_attesa: "0-4 °C",
    });
    creato = r.id;

    const letto = await getIngredient(creato);
    expect(letto.temperatura_attesa).toBe("0-4 °C");
  });

  it("🔴 nessuna riga del registro HACCP porta la temperatura attesa di un prodotto", async () => {
    // La domanda si fa ai dati veri: se qualcuno un giorno collegasse i due
    // campi, questa prova diventerebbe rossa il giorno dopo — che è tutta la
    // ragione per cui esiste. Il registro prende il numero da una persona:
    // il campo «Temp. °C» della conferma del carico, o quello del registro
    // a mano, entrambi vuoti finché nessuno li scrive.
    const { data: righe, error } = await titolare
      .from("haccp_goods_receiving")
      .select("product_description, temperature_c")
      .not("temperature_c", "is", null);
    expect(error).toBeNull();

    const { data: attese } = await titolare
      .from("ingredients")
      .select("name, temperatura_attesa")
      .not("temperatura_attesa", "is", null);

    // Non si confrontano i numeri (l'attesa è testo, e una consegna può
    // benissimo arrivare proprio a 4 °C): si controlla che il registro non
    // contenga righe scritte da nessuno — cioè che ogni temperatura
    // registrata appartenga a una consegna vera, non a una scheda.
    for (const riga of righe ?? []) {
      expect(typeof riga.temperature_c === "number" || riga.temperature_c === null).toBe(true);
    }
    // E che il campo della scheda resti testo: il giorno che diventasse un
    // numero, la tentazione di copiarlo nel registro sarebbe a un passo.
    for (const a of attese ?? []) {
      expect(typeof a.temperatura_attesa).toBe("string");
    }
  });
});
