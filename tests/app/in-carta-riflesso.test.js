import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";

// «In carta» e' un riflesso del menu attivo (decisione di Alessio del
// 16/08/2026): due posti che dicono la stessa cosa e possono
// contraddirsi sono un difetto, non una comodita'.
//
// ⚠️ Perche' serve una prova QUI e non basta quella dentro la migrazione:
// la migrazione gira come proprietaria del database, dove la RLS non
// esiste. Il calcolo del riflesso legge `menus` e `menu_items`, che sono
// titolare-only — se le funzioni non fossero `security definer`, la
// migrazione passerebbe verde e dal gestionale la casella si
// spegnerebbe da sola. E' esattamente il modo in cui questo difetto
// sarebbe arrivato in sala senza che nessuno lo vedesse.
const PIATTO = "TEST-AUTO riflesso in carta";
const ACERBO = "TEST-AUTO riflesso non pronto";
const MENU = "TEST-AUTO menu del riflesso";

describe("«in carta» lo dice il menu, non una casella", () => {
  let titolare;
  let piatto;
  let acerbo;
  let menu;
  // ⚠️ Il menu attivo può essere UNO SOLO (`uniq_single_active_menu`), e
  // dal 16/08/2026 il progetto di prova ha uno stato di partenza che ne
  // tiene uno acceso. Questa prova ne accende uno suo, quindi deve
  // spegnere quello che trova — e **rimetterlo com'era alla fine**: una
  // prova che si ripulisce cancellando invece che rimettendo lascia il
  // mondo diverso da come l'ha trovato (lezione del 14/08).
  let menuAttivoDiPrima = null;

  async function pulisci() {
    const { data: menus } = await titolare.from("menus").select("id").eq("name", MENU);
    for (const m of menus ?? []) {
      await titolare.from("menu_items").delete().eq("menu_id", m.id);
      await titolare.from("menus").update({ is_active: false }).eq("id", m.id);
      await titolare.from("menus").delete().eq("id", m.id);
    }
    const { data: ric } = await titolare.from("recipes").select("id").in("name", [PIATTO, ACERBO]);
    for (const r of ric ?? []) {
      await titolare.from("menu_items").delete().eq("recipe_id", r.id);
      await titolare.from("recipe_status_history").delete().eq("recipe_id", r.id);
      await titolare.from("recipes").delete().eq("id", r.id);
    }
  }

  const leggiInCarta = async (id) => {
    const { data } = await titolare.from("recipes").select("in_carta").eq("id", id).single();
    return data.in_carta;
  };

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    await pulisci();

    const nuove = await titolare
      .from("recipes")
      .insert([
        { name: PIATTO, category: "primo", portions_yield: 4, pronta_per_carta: true },
        { name: ACERBO, category: "primo", portions_yield: 4, pronta_per_carta: false },
      ])
      .select("id, name");
    if (nuove.error) throw new Error(`Non riesco a creare le ricette di prova: ${nuove.error.message}`);
    piatto = nuove.data.find((r) => r.name === PIATTO).id;
    acerbo = nuove.data.find((r) => r.name === ACERBO).id;

    const m = await titolare.from("menus").insert({ name: MENU, is_active: false }).select("id").single();
    if (m.error) throw new Error(`Non riesco a creare il menu di prova: ${m.error.message}`);
    menu = m.data.id;

    const attivo = await titolare.from("menus").select("id").eq("is_active", true).maybeSingle();
    menuAttivoDiPrima = attivo.data?.id ?? null;
    if (menuAttivoDiPrima) {
      await titolare.from("menus").update({ is_active: false }).eq("id", menuAttivoDiPrima);
    }
  });

  afterAll(async () => {
    await pulisci();
    if (menuAttivoDiPrima) {
      await titolare.from("menus").update({ is_active: true }).eq("id", menuAttivoDiPrima);
    }
    await titolare.auth.signOut({ scope: "local" });
  });

  it("una ricetta nuova non e' in carta", async () => {
    expect(await leggiInCarta(piatto)).toBe(false);
  });

  it("in un menu NON attivo non conta: e' la carta della prossima stagione", async () => {
    const r = await titolare
      .from("menu_items")
      .insert({ menu_id: menu, recipe_id: piatto, category: "primo", selling_price: 14 });
    expect(r.error).toBeNull();
    expect(await leggiInCarta(piatto)).toBe(false);
  });

  it("accendendo il menu la casella si accende da sola", async () => {
    const r = await titolare.from("menus").update({ is_active: true }).eq("id", menu);
    expect(r.error).toBeNull();
    expect(await leggiInCarta(piatto)).toBe(true);
  });

  // Il controllo che la migrazione da sola non puo' fare: qui si scrive
  // col token di un utente vero, quindi con la RLS accesa.
  it("la casella non si accende ne' si spegne a mano", async () => {
    const r = await titolare.from("recipes").update({ in_carta: false }).eq("id", piatto);
    expect(r.error).toBeNull(); // non e' un errore: e' che non viene ubbidita
    expect(await leggiInCarta(piatto)).toBe(true);
  });

  it("un piatto non pronto non entra in un menu attivo, e il rifiuto lo dice", async () => {
    const r = await titolare
      .from("menu_items")
      .insert({ menu_id: menu, recipe_id: acerbo, category: "primo", selling_price: 9 });
    expect(r.error).not.toBeNull();
    // Il messaggio nomina il piatto e dice cosa fare: un rifiuto che non
    // spiega e' un vicolo cieco (difetto n. 8 del mandato).
    expect(r.error.message).toContain(ACERBO);
    expect(r.error.message).toContain("pronta per carta");
  });

  it("non si toglie «pronta per carta» a un piatto che e' in carta", async () => {
    const r = await titolare.from("recipes").update({ pronta_per_carta: false }).eq("id", piatto);
    expect(r.error).not.toBeNull();
    expect(r.error.message).toContain(MENU);
  });

  // 🔴 Il difetto trovato costruendo lo stato di partenza col gesto vero
  // (16/08/2026): `log_recipe_status_change` era `security invoker`, e su
  // `recipe_status_history` un utente ha la sola lettura — quindi
  // marcare una ricetta «pronta per carta» rispondeva 42501 e non
  // riusciva. Nessuna verifica dentro le migrazioni poteva vederlo: là si
  // gira come proprietari, e i proprietari scavalcano la RLS.
  it("marcare «pronta per carta» riesce, e lo storico si scrive", async () => {
    const r = await titolare.from("recipes").update({ pronta_per_carta: true }).eq("id", acerbo);
    expect(r.error).toBeNull();

    const storico = await titolare
      .from("recipe_status_history")
      .select("pronta_per_carta")
      .eq("recipe_id", acerbo);
    expect(storico.error).toBeNull();
    expect(storico.data.length).toBeGreaterThan(0);
    expect(storico.data.at(-1).pronta_per_carta).toBe(true);
  });

  // …e lo storico resta scrivibile SOLO dal trigger: la cura non doveva
  // aprire quella tabella a nessuno.
  it("nello storico non ci si scrive a mano", async () => {
    const r = await titolare
      .from("recipe_status_history")
      .insert({ recipe_id: acerbo, pronta_per_carta: true, in_carta: false });
    expect(r.error).not.toBeNull();
  });

  it("togliendolo dal menu la casella si spegne", async () => {
    const r = await titolare.from("menu_items").delete().eq("menu_id", menu).eq("recipe_id", piatto);
    expect(r.error).toBeNull();
    expect(await leggiInCarta(piatto)).toBe(false);
  });
});
