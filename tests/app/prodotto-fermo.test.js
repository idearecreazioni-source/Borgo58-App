import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";
import { supabase } from "../../src/lib/supabase";
import {
  abbattiPartita,
  chiudiPartita,
  dichiaraTrasformazione,
  listPartiteFerme,
  rimandaPartita,
} from "../../src/lib/api/scadenze";

// L'AVVISO SUL PRODOTTO FERMO (23/08/2026, blocco 3 del mandato).
//
// ⚠️ PERCHE' LA PROVA PASSA DAL CORRIDOIO e non chiama le funzioni del
// database: un'operazione che non è nell'elenco di `operazioni-atomiche`
// risponde **404**, e nessuna prova scritta in SQL se ne accorgerebbe —
// la funzione esiste, è solo irraggiungibile dall'app. È la ragione per
// cui `npm run funzione --prova` è nato il 15/08.
const NOME = "TEST-AUTO prodotto fermo";

describe("il prodotto fermo: sei risposte, sei strade diverse", () => {
  let titolare;
  let ente;
  let ing;
  let lotto;

  const partitaMia = async () =>
    (await listPartiteFerme()).find((p) => p.lotto_id === lotto);

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    ente = await primaEntita(titolare);
    // Le funzioni di api/ passano dal corridoio, che usa il collegamento
    // dell'APP: con un client proprio parlerebbe da anonima (18/08).
    await supabase.auth.signInWithPassword(credenziali().titolare);

    const { data: vecchi } = await titolare
      .from("ingredients").select("id").like("name", `${NOME}%`);
    for (const v of vecchi ?? []) {
      await titolare.from("stock_consumptions").delete().eq("ingredient_id", v.id);
      await titolare.from("stock_lots").delete().eq("ingredient_id", v.id);
      await titolare.from("price_history").delete().eq("ingredient_id", v.id);
      await titolare.from("ingredients").delete().eq("id", v.id);
    }

    // ⚠️ Il perimetro è fatto di roba che la prova ha creato — mai un
    // prodotto vero (lezione del 16/08).
    const { data: i } = await titolare.from("ingredients").insert({
      entity_id: ente, name: NOME, category: "secco_dispensa", unit: "kg",
      current_price: 5, shelf_life_days: 10, tenuto_in_magazzino: true,
    }).select("id").single();
    ing = i.id;

    // Ricevuta 40 giorni fa, mai toccata: ferma da 40, dura 10.
    const quaranta = new Date();
    quaranta.setDate(quaranta.getDate() - 40);
    const { data: l } = await titolare.from("stock_lots").insert({
      ingredient_id: ing, quantity_received: 10, quantity_remaining: 10,
      unit_cost: 5, received_at: quaranta.toISOString(),
    }).select("id").single();
    lotto = l.id;
  });

  afterAll(async () => {
    if (ing) {
      await titolare.from("trasformazioni_dichiarate").delete().eq("lotto_id", lotto);
      await titolare.from("stock_consumptions").delete().eq("ingredient_id", ing);
      await titolare.from("stock_lots").delete().eq("ingredient_id", ing);
      await titolare.from("price_history").delete().eq("ingredient_id", ing);
      await titolare.from("ingredients").delete().eq("id", ing);
    }
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
  });

  it("una partita ferma oltre la sua durata compare, e dice da quanto", async () => {
    const p = await partitaMia();
    expect(p, "la partita ferma da 40 giorni non compare").toBeDefined();
    expect(p.ferma_da).toBe(40);
    expect(p.durata_giorni).toBe(10);
    expect(p.perche).toMatch(/ferma da 40 giorni/i);
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
    await rimandaPartita({ lottoId: lotto, giorni: 7 });
    expect(await partitaMia(), "una partita rimandata compare ancora").toBeUndefined();

    // ⚠️ Un rinvio senza fine sarebbe una cancellazione travestita.
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

    expect(await partitaMia(), "dopo l'abbattimento l'orologio non è ripartito").toBeUndefined();
  });

  it("🔴 «reso al fornitore» chiude il ciclo, ma NON è uno spreco", async () => {
    await titolare.from("trasformazioni_dichiarate").delete().eq("lotto_id", lotto);
    await chiudiPartita({ lottoId: lotto, come: "reso_fornitore", note: "prova reso" });

    const { data: l } = await titolare
      .from("stock_lots").select("chiusura, quantity_remaining").eq("id", lotto).single();
    expect(l.chiusura).toBe("reso_fornitore");
    expect(Number(l.quantity_remaining)).toBe(0);

    const { data: mov } = await titolare
      .from("stock_consumptions").select("reason").eq("ingredient_id", ing);
    expect(mov.map((m) => m.reason)).toEqual(["reso_fornitore"]);

    // ⚠️ E non apre una non conformità: un reso non è un problema
    // d'igiene, e riempire di righe normali un registro che l'ispettore
    // legge è il modo in cui quel registro smette di essere letto.
    const { data: nc } = await titolare
      .from("haccp_non_conformities").select("id").ilike("description", `%${NOME}%`);
    expect(nc ?? []).toHaveLength(0);
  });
});
