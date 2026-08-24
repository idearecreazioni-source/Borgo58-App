import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";

// IN UN MENU CI VANNO SOLO I PIATTI — decisione di Alessio del 20/08/2026.
//
// ⚠️ Queste prove entrano col token di un utente vero, che è l'unico modo di
// sapere che la regola vale anche **dall'app**: la verifica dentro la
// migrazione gira come proprietaria del database, dove la RLS non esiste
// (buco strutturale dichiarato il 16/08).
//
// 🔴 E LA PREPARAZIONE E IL BOCCONCINO NASCONO ENTRAMBI «PRONTI PER LA
// CARTA»: se fossero respinti solo perché quel segno è spento, questo file
// non starebbe misurando il criterio giusto.
const MARCA = "TEST-AUTO menu";

describe("una preparazione e un finger non entrano in un menu", () => {
  let titolare;
  let prep;
  let finger;
  let piatto;
  let menu;
  let giorno;

  async function pulisci() {
    const { data: menus } = await titolare.from("menus").select("id").like("name", `${MARCA}%`);
    for (const m of menus ?? []) {
      await titolare.from("menu_items").delete().eq("menu_id", m.id);
      await titolare.from("menus").delete().eq("id", m.id);
    }
    const { data: gg } = await titolare.from("daily_menus").select("id").like("title", `${MARCA}%`);
    for (const g of gg ?? []) {
      await titolare.from("daily_menu_items").delete().eq("daily_menu_id", g.id);
      await titolare.from("daily_menus").delete().eq("id", g.id);
    }
    await titolare.from("recipes").delete().like("name", `${MARCA}%`);
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    await pulisci();

    const { data: creati, error } = await titolare
      .from("recipes")
      .insert([
        {
          name: `${MARCA} prep`,
          category: "antipasto",
          portions_yield: 1,
          recipe_type: "preparazione",
          yield_quantity: 1,
          yield_unit: "kg",
          pronta_per_carta: true,
        },
        {
          name: `${MARCA} finger`,
          category: "antipasto",
          portions_yield: 1,
          recipe_type: "finger",
          yield_quantity: 1,
          yield_unit: "pz",
          pronta_per_carta: true,
        },
        {
          name: `${MARCA} piatto`,
          category: "antipasto",
          portions_yield: 2,
          recipe_type: "piatto_finito",
          pronta_per_carta: true,
        },
      ])
      .select();
    expect(error, "non sono riuscito a creare le tre ricette").toBeNull();
    prep = creati.find((r) => r.name.endsWith("prep")).id;
    finger = creati.find((r) => r.name.endsWith("finger")).id;
    piatto = creati.find((r) => r.name.endsWith("piatto")).id;

    // ⚠️ Spento: `uniq_single_active_menu` ammette un solo menu attivo, e
    // accenderne uno qui spegnerebbe la carta vera.
    const { data: m } = await titolare
      .from("menus")
      .insert({ name: `${MARCA} carta`, structure: "alla_carta", is_active: false })
      .select()
      .single();
    menu = m.id;

    const { data: g } = await titolare
      .from("daily_menus")
      .insert({ service_date: "1995-03-02", title: `${MARCA} giorno` })
      .select()
      .single();
    giorno = g.id;
  });

  afterAll(async () => {
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
  });

  it("una preparazione segnata PRONTA viene comunque respinta", async () => {
    const { error } = await titolare
      .from("menu_items")
      .insert({ menu_id: menu, recipe_id: prep, category: "antipasto", selling_price: 9 });
    expect(error, "una preparazione è entrata in carta").not.toBeNull();
    expect(error.message).toContain("una preparazione");
  });

  it("un finger segnato PRONTO viene comunque respinto, e chiamato col suo nome", async () => {
    const { error } = await titolare
      .from("menu_items")
      .insert({ menu_id: menu, recipe_id: finger, category: "antipasto", selling_price: 3 });
    expect(error, "un finger è entrato in carta").not.toBeNull();
    expect(error.message).toContain("un finger");
  });

  it("un piatto pronto entra: il vincolo non ha chiuso la porta a tutti", async () => {
    // ⚠️ Senza questo, un trigger che rifiutasse SEMPRE farebbe passare le
    // due prove sopra senza distinguere niente.
    const { error } = await titolare
      .from("menu_items")
      .insert({ menu_id: menu, recipe_id: piatto, category: "antipasto", selling_price: 12 });
    expect(error, "un piatto pronto non è entrato in carta").toBeNull();
  });

  it("la stessa regola vale sui piatti del giorno, che sono un'altra porta", async () => {
    const { error } = await titolare
      .from("daily_menu_items")
      .insert({ daily_menu_id: giorno, recipe_id: finger, category: "antipasto", price: 3 });
    expect(error, "un finger è entrato nei piatti del giorno").not.toBeNull();
  });

  it("una voce libera nei piatti del giorno resta ammessa", async () => {
    const { error } = await titolare
      .from("daily_menu_items")
      .insert({ daily_menu_id: giorno, custom_name: `${MARCA} voce`, category: "antipasto", price: 5 });
    expect(error, "la voce libera è stata respinta").toBeNull();
  });
});
