import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  clientAutenticato,
  credenziali,
  righeMie,
  corridoioInstallato,
  denunciaSaltiCorridoio,
} from "./aiuto";
import { registraProdottoLetto } from "../../src/lib/api/assistenteFoto";
import { andamentoPrezzo } from "../../src/lib/api/ingredients";
import { supabase } from "../../src/lib/supabase";

// ============================================================================
// LA SEPARAZIONE FRA PRODOTTO E INGREDIENTE, dal browser
// ============================================================================
//
// ⚠️ QUESTE PROVE ENTRANO DAL COLLEGAMENTO DELL'APP, non da uno loro, ed è
//    l'unico modo di esercitare due cose che le migrazioni non possono
//    vedere:
//      1. che `registra_prodotto_letto` sia nell'elenco del CORRIDOIO — una
//         operazione fuori elenco risponde 404, e nessuna prova SQL se ne
//         accorge (lezione del 16/08);
//      2. che le funzioni rispondano coi permessi di un utente vero, non
//         del proprietario del database (lezione del 16/08 su
//         `log_recipe_status_change`, rimasta invisibile dal 02/08).
//
// ⚠️ E il numero degli elementi non è di comodo: due marche dello stesso
//    ingrediente sono il MINIMO che distingue «un ingrediente con due
//    versioni» da «due ingredienti» — con una sola marca le due risposte
//    coincidono e la prova non proverebbe niente.

const MARCA = "PRV-PRODING";

const sonda = await clientAutenticato(credenziali().titolare);
const CORRIDOIO = await corridoioInstallato(sonda);
// La sentinella sta in OGNI file che salta prove: chi lancia solo questo
// file deve vedere che ci sono prove che non sono partite.
await denunciaSaltiCorridoio(CORRIDOIO, import.meta.url);

describe("prodotto e ingrediente sono due cose diverse", () => {
  let titolare;
  let staff;
  let mie;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    staff = await clientAutenticato(credenziali().staff);
    await supabase.auth.signInWithPassword({
      email: credenziali().titolare.email,
      password: credenziali().titolare.password,
    });
    mie = righeMie(titolare);
  });

  afterAll(async () => {
    await mie.pulisci();
    await supabase.auth.signOut({ scope: "local" });
    await titolare.auth.signOut({ scope: "local" });
    await staff.auth.signOut({ scope: "local" });
  });

  it.skipIf(!CORRIDOIO)(
    "due marche dello stesso ingrediente restano UN ingrediente con DUE versioni",
    async () => {
      const primo = await registraProdottoLetto({
        ingrediente: `${MARCA} maionese`,
        prodotto: `${MARCA} maionese Marca A flacone 500`,
        marca: "Marca A",
        formato: "flacone da 500 ml",
        unita: "kg",
        categoria: "olio_condimenti",
      });
      mie.segna("ingredients", primo.ingredient_id);
      mie.segna("articoli_fornitore", primo.articolo_id);
      expect(primo.ingrediente_nuovo).toBe(true);

      const secondo = await registraProdottoLetto({
        // ⚠️ Stesso ingrediente, grafia diversa: il confronto passa da
        //    `nome_ingrediente_chiave`, non dal testo esatto.
        ingrediente: `${MARCA} MAIONESE`,
        prodotto: `${MARCA} maionese Marca B vasetto 250`,
        marca: "Marca B",
        formato: "vasetto da 250 ml",
        unita: "kg",
        categoria: "olio_condimenti",
      });
      mie.segna("articoli_fornitore", secondo.articolo_id);

      expect(
        secondo.ingrediente_nuovo,
        "la seconda marca ha fatto nascere un SECONDO ingrediente"
      ).toBe(false);
      expect(secondo.ingredient_id).toBe(primo.ingredient_id);
      expect(secondo.prodotto_nuovo).toBe(true);

      const { data: versioni } = await titolare
        .from("articoli_fornitore")
        .select("id, marca, formato")
        .eq("ingredient_id", primo.ingredient_id);
      expect(versioni).toHaveLength(2);
      // Marca e formato arrivano davvero: il commento sopra la tabella delle
      // versioni li promette dal 12/08 e le colonne sono nate il 27/08.
      expect(versioni.map((v) => v.marca).sort()).toEqual(["Marca A", "Marca B"]);
      expect(versioni.every((v) => v.formato)).toBe(true);
    }
  );

  it.skipIf(!CORRIDOIO)("una lettura d'etichetta non inventa nessun prezzo", async () => {
    const r = await registraProdottoLetto({
      ingrediente: `${MARCA} aceto`,
      prodotto: `${MARCA} aceto Marca C bottiglia 500`,
      marca: "Marca C",
      unita: "l",
      categoria: "olio_condimenti",
    });
    mie.segna("ingredients", r.ingredient_id);
    mie.segna("articoli_fornitore", r.articolo_id);

    const { data: ing } = await titolare
      .from("ingredients")
      .select("current_price, prezzo_da")
      .eq("id", r.ingredient_id)
      .single();
    // ⚠️ Il prezzo resta quello che `create_ingredient` mette per un
    //    ingrediente nuovo, e la PROVENIENZA resta VUOTA: nessuno l'ha
    //    ancora misurato e nessuno l'ha scritto a mano. Un «prodotto» qui
    //    sarebbe una bugia che rassicura.
    expect(ing.prezzo_da, "un'etichetta si è spacciata per una misura").toBeNull();

    const { data: lotti } = await titolare
      .from("stock_lots")
      .select("id")
      .eq("ingredient_id", r.ingredient_id);
    expect(lotti, "una lettura d'etichetta ha creato dei lotti").toHaveLength(0);
  });

  it.skipIf(!CORRIDOIO)("il prezzo segue l'ultima versione entrata, non la media", async () => {
    const r = await registraProdottoLetto({
      ingrediente: `${MARCA} olio`,
      prodotto: `${MARCA} olio Marca D lattina 5`,
      marca: "Marca D",
      formato: "lattina da 5 L",
      unita: "l",
      categoria: "olio_condimenti",
    });
    mie.segna("ingredients", r.ingredient_id);
    mie.segna("articoli_fornitore", r.articolo_id);

    const ieri = new Date();
    ieri.setDate(ieri.getDate() - 1);

    const { data: l1 } = await titolare
      .from("stock_lots")
      .insert({
        ingredient_id: r.ingredient_id,
        articolo_id: r.articolo_id,
        quantity_received: 5,
        quantity_remaining: 5,
        unit_cost: 8.5,
        received_at: ieri.toISOString(),
      })
      .select("id")
      .single();
    mie.segna("stock_lots", l1.id);

    const { data: l2 } = await titolare
      .from("stock_lots")
      .insert({
        ingredient_id: r.ingredient_id,
        articolo_id: r.articolo_id,
        quantity_received: 1,
        quantity_remaining: 1,
        unit_cost: 12,
      })
      .select("id")
      .single();
    mie.segna("stock_lots", l2.id);

    const { data: ing } = await titolare
      .from("ingredients")
      .select("current_price, prezzo_da")
      .eq("id", r.ingredient_id)
      .single();
    // 12,00 e non 10,25 (la media) né 8,50 (la minima): tre risposte
    // diverse, e questa riga le separa.
    expect(Number(ing.current_price)).toBe(12);
    expect(ing.prezzo_da).toBe("prodotto");
  });

  it.skipIf(!CORRIDOIO)("un regalo non fa scendere a zero il prezzo dell'ingrediente", async () => {
    const r = await registraProdottoLetto({
      ingrediente: `${MARCA} verdura`,
      prodotto: `${MARCA} verdura Marca E cassa`,
      marca: "Marca E",
      unita: "kg",
      categoria: "verdura",
    });
    mie.segna("ingredients", r.ingredient_id);
    mie.segna("articoli_fornitore", r.articolo_id);

    const ieri = new Date();
    ieri.setDate(ieri.getDate() - 1);

    const { data: pagato } = await titolare
      .from("stock_lots")
      .insert({
        ingredient_id: r.ingredient_id,
        quantity_received: 10,
        quantity_remaining: 10,
        unit_cost: 4,
        received_at: ieri.toISOString(),
      })
      .select("id")
      .single();
    mie.segna("stock_lots", pagato.id);

    const { data: regalo } = await titolare
      .from("stock_lots")
      .insert({
        ingredient_id: r.ingredient_id,
        quantity_received: 6,
        quantity_remaining: 6,
        unit_cost: 0,
        note: "regalo del contadino",
      })
      .select("id")
      .single();
    mie.segna("stock_lots", regalo.id);

    const { data: ing } = await titolare
      .from("ingredients")
      .select("current_price")
      .eq("id", r.ingredient_id)
      .single();
    // ⚠️ Decisione del 17/08: il regalo vale zero per quella volta, non per
    //    sempre. A zero, il food cost di ogni piatto che usa questo
    //    ingrediente risulterebbe più basso del vero — ed è da lì che
    //    Alessio decide i prezzi del menu.
    expect(Number(ing.current_price), "un regalo ha fatto scendere il prezzo").toBe(4);
  });

  it.skipIf(!CORRIDOIO)(
    "lo staff non può chiedere l'andamento dei prezzi, e riceve un RIFIUTO",
    async () => {
      const r = await registraProdottoLetto({
        ingrediente: `${MARCA} farina`,
        prodotto: `${MARCA} farina Marca F sacco 25`,
        marca: "Marca F",
        unita: "kg",
        categoria: "farine_cereali",
      });
      mie.segna("ingredients", r.ingredient_id);
      mie.segna("articoli_fornitore", r.articolo_id);

      const dello = await staff.rpc("andamento_prezzo", {
        p_ingredient_id: r.ingredient_id,
        p_articolo_id: null,
      });
      // ⚠️ Un rifiuto, non un elenco vuoto: zero righe si leggerebbero
      //    «questo ingrediente non è mai rincarato» (regola del 13/08, e
      //    difetto trovato la mattina del 27/08 su `caparre_trattenute`).
      expect(dello.error, "lo staff ha ottenuto l'andamento dei prezzi").not.toBeNull();

      // ...e il titolare sì, altrimenti il portiere sarebbe un muro.
      // Senza storico non risponde ZERI: non risponde niente.
      expect(await andamentoPrezzo(r.ingredient_id)).toBeNull();
    }
  );
});
