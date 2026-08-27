import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";
import {
  allineaGiacenza,
  daAllineare,
  foodCostReale,
  scostamentiPerProdotto,
} from "../../src/lib/api/stock";
import { supabase } from "../../src/lib/supabase";
import { oggiLocale } from "../../src/lib/constants";

// L'ALLINEAMENTO DEL MAGAZZINO — 20/08/2026.
//
// 🔴 I NUMERI SONO SCELTI PERCHÉ DISTINGUANO, ed è la parte che decide se
// questa prova misura qualcosa. Due partite dello stesso prodotto a prezzi
// DIVERSI — 2 kg a 2,00 € che scadono prima, 10 kg a 5,00 € dopo — perché
// `stock_lots.unit_cost` è **per partita**, quindi da quale si toglie cambia
// il valore dello scostamento. Togliendone 3:
//   ✅ FEFO (che scade prima):  2×2 + 1×5 = **9,00**
//   ✗ dalla più cara:          3×5       = 15,00
//   ✗ a un prezzo medio:       3×4,50    = 13,50
// Con una partita sola, «la più vecchia» e «l'unica» sarebbero lo stesso
// lotto e la regola non verrebbe misurata affatto.
//
// ⚠️ E il prezzo di listino è **7,00**, che non è nessuno dei due costi delle
// partite: così la correzione in aumento distingue «ultimo prezzo pagato» da
// «costo di una partita scelta da un ordinamento».
const MARCA = "TEST-AUTO allineamento";
const LISTINO = 7;

describe("si dichiara quanto c'è, e la differenza la calcola il gestionale", () => {
  let titolare;
  let staff;
  let ente;
  let ing;

  // 🔴 QUESTA PULIZIA NON PUÒ TOGLIERE TUTTO, e l'ho scoperto scrivendola —
  // riproducendo, un'ora dopo averlo chiuso altrove, lo stesso difetto:
  // `rettifiche_giacenza` ha **solo le policy di lettura e scrittura**, non
  // quella di cancellazione. È voluto (*una correzione è un fatto avvenuto*),
  // e ha un prezzo: da qui quelle righe non si tolgono, e con un vincolo
  // `restrict` trattengono l'ingrediente.
  //
  // ⚠️ E LA CURA NON È APRIRE LA POLICY — sarebbe indebolire una regola per
  // comodità di una prova. Ci si gira attorno: l'ingrediente si **riusa**, e
  // i suoi LOTTI (che si cancellano) si rifanno da zero a ogni esecuzione,
  // così la giacenza di partenza è sempre la stessa e i numeri di sotto
  // restano quelli che distinguono.
  async function pulisci() {
    const { data } = await titolare.from("ingredients").select("id").like("name", `${MARCA}%`);
    for (const i of data ?? []) {
      await titolare.from("stock_lots").delete().eq("ingredient_id", i.id);
      await titolare.from("price_history").delete().eq("ingredient_id", i.id);
    }
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    await supabase.auth.signInWithPassword({
      email: credenziali().titolare.email,
      password: credenziali().titolare.password,
    });
    ente = await primaEntita(titolare);
    await pulisci();

    const gia = await titolare
      .from("ingredients")
      .select("id")
      .eq("name", `${MARCA} farina`)
      .limit(1)
      .maybeSingle();
    if (gia.data) {
      ing = gia.data.id;
    } else {
      const { data: i, error } = await titolare
        .from("ingredients")
        .insert({
          entity_id: ente,
          name: `${MARCA} farina`,
          category: "verdura",
          unit: "kg",
          current_price: LISTINO,
          waste_percentage_default: 0,
        })
        .select()
        .single();
      expect(error).toBeNull();
      ing = i.id;
    }

    const oggi = oggiLocale();
    const fra = (n) => {
      const d = new Date(oggi);
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };
    await titolare.from("stock_lots").insert([
      { ingredient_id: ing, quantity_received: 2, quantity_remaining: 2, unit_cost: 2, expiry_date: fra(1) },
      { ingredient_id: ing, quantity_received: 10, quantity_remaining: 10, unit_cost: 5, expiry_date: fra(60) },
    ]);

    // ⚠️ IL LISTINO SI SCRIVE DOPO LE PARTITE, e l'ordine è diventato
    // obbligatorio il 27/08/2026: da quel giorno `current_price` è un
    // RIFLESSO dell'ultima partita entrata, quindi scriverlo prima lo
    // faceva sovrascrivere dal costo dell'ultimo lotto (5,00) e questa
    // prova non poteva più distinguere le tre risposte che separa.
    // Il caso resta vero e legittimo: è un prezzo scritto a mano.
    await titolare.from("ingredients").update({ current_price: LISTINO }).eq("id", ing);
  });

  afterAll(async () => {
    await pulisci();
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
  });

  it("🔴 ne mancano 3: si tolgono dalla partita che scade prima, e il valore lo dimostra", async () => {
    const r = await allineaGiacenza(ing, 9);
    expect(Number(r.atteso)).toBe(12);
    expect(Number(r.differenza)).toBe(-3);
    // 🔴 IL NUMERO CHE DISTINGUE: 9,00 e non 15,00 né 13,50.
    expect(Number(r.valore), "non si è tolto dalla partita che scade prima").toBe(-9);

    const { data: lotti } = await titolare
      .from("stock_lots")
      .select("unit_cost, quantity_remaining")
      .eq("ingredient_id", ing);
    const vecchio = lotti.find((l) => Number(l.unit_cost) === 2);
    const nuovo = lotti.find((l) => Number(l.unit_cost) === 5);
    expect(Number(vecchio.quantity_remaining), "la partita in scadenza non è stata svuotata").toBe(0);
    expect(Number(nuovo.quantity_remaining)).toBe(9);
  });

  it("scrivere lo stesso numero NON produce nessuno scostamento", async () => {
    // ⚠️ Distingue «registro le differenze» da «registro i salvataggi»: con
    // la seconda il trend si riempirebbe di zeri e la media direbbe che va
    // tutto bene.
    const prima = await titolare
      .from("rettifiche_giacenza")
      .select("id")
      .eq("ingredient_id", ing);
    const r = await allineaGiacenza(ing, 9);
    expect(r.registrata).toBe(false);
    expect(Number(r.differenza)).toBe(0);
    const dopo = await titolare.from("rettifiche_giacenza").select("id").eq("ingredient_id", ing);
    expect(dopo.data.length, "è rimasta una riga per un salvataggio senza differenza").toBe(
      prima.data.length
    );
  });

  it("🔴 ne trovo 2 in più — è il caso che si dimentica sempre", async () => {
    const r = await allineaGiacenza(ing, 11);
    expect(Number(r.differenza)).toBe(2);
    // ⚠️ Entra all'ULTIMO PREZZO PAGATO (7,00), non al costo di una partita:
    // 2 × 7 = 14. Se tornasse a leggere le partite darebbe 10 (5,00) o 4
    // (2,00) — tre risposte diverse, e questa riga le separa.
    expect(Number(r.valore), "la merce in più non è entrata all'ultimo prezzo pagato").toBe(
      2 * LISTINO
    );
    const { data: lotti } = await titolare
      .from("stock_lots")
      .select("quantity_remaining")
      .eq("ingredient_id", ing);
    expect(lotti.reduce((s, l) => s + Number(l.quantity_remaining), 0)).toBe(11);
  });

  it("🔴 il food cost REALE si muove, e lo stimato resta fermo", async () => {
    const oggi = oggiLocale();
    const prima = await foodCostReale(oggi, oggi);
    // Ne mancano 4 sulla partita da 5,00 → il costo vero sale di 20,00.
    const r = await allineaGiacenza(ing, 7);
    expect(Number(r.valore)).toBe(-20);
    const dopo = await foodCostReale(oggi, oggi);

    // ⚠️ `toBeCloseTo` e non `toBe`, e non e' una tolleranza inventata: la
    // sottrazione avviene in JavaScript, dove 19,999999999999986 e 20 sono
    // due numeri diversi. Il database il conto lo fa giusto — a sbagliare
    // era la prova, che confrontava due decimali in virgola mobile con
    // l'uguaglianza esatta. Trovato il 23/08 girando la suite intera: era
    // gia' rossa prima del blocco 1, e una rossa che nessuno guarda copre
    // le rosse vere.
    expect(
      Number(dopo.scostamento) - Number(prima.scostamento),
      "la correzione non è entrata nel food cost reale"
    ).toBeCloseTo(20, 6);
    // ⚠️ E lo stimato NON si muove: è il numero con cui Alessio decide i
    // prezzi del menu, e se si muovesse da sé li deciderebbe su una cosa viva.
    expect(Number(dopo.stimato), "lo stimato si è mosso per una correzione in dispensa").toBe(
      Number(prima.stimato)
    );
    // I due numeri devono essere DIVERSI: fusi, tutto il mandato non esiste.
    expect(Number(dopo.reale)).not.toBe(Number(dopo.stimato));
    // ⚠️ E l'avvertenza viaggia coi numeri.
    expect(dopo.avvertenza).toBeTruthy();
  });

  it("il dettaglio dice QUALE prodotto scappa", async () => {
    const oggi = oggiLocale();
    const righe = await scostamentiPerProdotto(oggi, oggi);
    const mia = righe.find((r) => r.ingredient_id === ing);
    expect(mia, "il prodotto corretto non compare fra gli scostamenti").toBeTruthy();
    expect(mia.nome).toContain(MARCA);
    expect(Number(mia.quante)).toBeGreaterThanOrEqual(3);
  });

  it("🔴 in sala si corregge, ma il food cost NON si vede", async () => {
    // ⚠️ Due cose insieme, e sono la stessa decisione vista dai due lati:
    // chi si accorge che manca qualcosa è chi guarda lo scaffale, ma
    // **quanto è costato** è un dato economico e resta del titolare (§3.5).
    // Si prova solo dal client: dentro una migrazione tutto gira come
    // proprietario (lezione del 16/08).
    const oggi = oggiLocale();
    const r = await staff.rpc("food_cost_reale", { p_dal: oggi, p_al: oggi });
    // ⚠️ Un RIFIUTO, non un elenco vuoto: una schermata vuota è una
    // rassicurazione falsa (regola del 13/08).
    expect(r.error, "chi è in sala ha ottenuto il food cost").not.toBeNull();
    const d = await staff.rpc("scostamenti_per_prodotto", { p_dal: oggi, p_al: oggi });
    expect(d.error, "chi è in sala ha ottenuto gli scostamenti in euro").not.toBeNull();
  });

  it("🔴 la correzione la può fare anche la sala", async () => {
    // ⚠️ Decisione di Alessio, e si prova SOLO dal client: dentro una
    // migrazione tutto gira come proprietario e un difetto di permessi non
    // si vedrebbe mai (lezione del 16/08).
    const r = await staff.rpc("allinea_giacenza", { p_ingredient_id: ing, p_quanto_ce: 6 });
    expect(r.error, "chi è in sala non è riuscito a correggere una giacenza").toBeNull();
    expect(r.data.registrata).toBe(true);
  });

  it("il prodotto compare fra le cose da allineare, con quanto dovrebbe esserci", async () => {
    const righe = await daAllineare();
    const mia = righe.find((r) => r.ingredient_id === ing);
    expect(mia, "il prodotto non compare fra le cose da allineare").toBeTruthy();
    expect(Number(mia.atteso)).toBe(6);
    // ⚠️ Ha appena avuto un allineamento: il campo lo deve dire.
    expect(mia.ultimo_allineamento).toBeTruthy();
  });
});
