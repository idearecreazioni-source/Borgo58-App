import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali, primaEntita } from "./aiuto";

// LE PAROLE DEI MATERIALI DI CONSUMO — provate su dati veri.
//
// 🔴 QUESTA PROVA ESISTE PER UNA COSA CHE LA MIGRAZIONE NON POTEVA FARE.
// `ingredients.unit` è un vocabolario chiuso del database (un `enum`), e un
// valore aggiunto a un enum **non è usabile nella stessa transazione** in
// cui viene aggiunto — e le migrazioni di questo progetto girano tutte in
// una transazione sola. Là dentro si è potuto controllare che «rotolo»
// ESISTA; che si possa davvero SALVARE su un prodotto si prova solo dopo,
// ed è quello che si fa qui.
//
// ⚠️ La differenza non è formale: fra «il valore c'è nel tipo» e «il
// gestionale riesce a scriverlo» c'è la stessa distanza che passa fra «la
// funzione è stata riscritta» e «la funzione risponde» (17/08). Il caso in
// cui si romperebbe è il peggiore possibile — l'elenco propone «rotolo»,
// Alessio lo sceglie, e il salvataggio lo rifiuta.
const NOME = "TEST-AUTO unita materiali";

describe("le parole dei materiali di consumo", () => {
  let titolare;
  let ente;

  async function pulisci() {
    const { data } = await titolare.from("ingredients").select("id").like("name", `${NOME}%`);
    for (const i of data ?? []) await titolare.from("ingredients").delete().eq("id", i.id);
  }

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    ente = await primaEntita(titolare);
    await pulisci();
  });

  afterAll(async () => {
    await pulisci();
    await titolare.auth.signOut({ scope: "local" });
  });

  it("i due cataloghi rispondono, e non si mescolano", async () => {
    const { data: catAli, error: e1 } = await titolare.rpc("categorie_proponibili", { p_ambito: "alimenti" });
    const { data: catMat, error: e2 } = await titolare.rpc("categorie_proponibili", { p_ambito: "materiali" });
    expect(e1).toBeNull();
    expect(e2).toBeNull();
    const codiciMat = (catMat ?? []).map((c) => c.codice);
    // Il difetto che Alessio ha visto: sulla scheda della carta forno gli
    // venivano offerte verdura, pesce e latticini.
    expect(codiciMat).not.toContain("verdura");
    expect(codiciMat).not.toContain("pesce");
    expect(codiciMat).toContain("pulizia");
    // 🔴 «ALTRO» NON STA PIÙ FRA I MATERIALI — decisione di Alessio del
    //    30/08: «Varie ed eventuali» e «Altro» sono la stessa idea in due
    //    posti, e fra i materiali ne resta uno solo, il suo.
    //    ⚠️ Questa riga diceva il contrario, ed era giusta fino al 30/08:
    //    si CAMBIA, non si toglie — una prova cancellata non si distingue
    //    da una dimenticata.
    expect(codiciMat).not.toContain("altro");
    expect(codiciMat).toContain("varie_materiali");
    // ⚠️ E dalla parte degli alimenti «Altro» C'È ANCORA: togliere il
    //    doppione non deve portarsi via il generico che serviva. Senza
    //    questa riga la prova passerebbe anche cancellando la categoria.
    expect((catAli ?? []).map((c) => c.codice)).toContain("altro");
    expect((catAli ?? []).map((c) => c.codice)).toContain("verdura");
  });

  it("le unità dei materiali non offrono kg né mazzo, e il pezzo sta in tutti e due", async () => {
    const { data: uAli } = await titolare.rpc("unita_proponibili", { p_ambito: "alimenti" });
    const { data: uMat } = await titolare.rpc("unita_proponibili", { p_ambito: "materiali" });
    const mat = (uMat ?? []).map((u) => u.codice);
    expect(mat).not.toContain("kg");
    expect(mat).not.toContain("mazzo");
    expect(mat).toContain("rotolo");
    expect(mat).toContain("pz");
    expect((uAli ?? []).map((u) => u.codice)).toContain("pz");
    expect((uAli ?? []).map((u) => u.codice)).toContain("kg");
  });

  it("🔴 un materiale si SALVA DAVVERO con un'unità dei materiali", async () => {
    // È la prova che la migrazione non poteva fare: il valore dell'enum
    // aggiunto là dentro non era usabile nella stessa transazione.
    const { data, error } = await titolare
      .from("ingredients")
      .insert({
        entity_id: ente,
        name: `${NOME} rotolo`,
        unit: "rotolo",
        category: "carta_monouso",
        alimentare: false,
        current_price: 3,
      })
      .select("id, unit, category, alimentare")
      .single();
    expect(error).toBeNull();
    expect(data.unit).toBe("rotolo");
    expect(data.category).toBe("carta_monouso");
    expect(data.alimentare).toBe(false);
  });

  it("e il catalogo non propone niente che il database rifiuterebbe", async () => {
    // Un elenco che offre una scelta impossibile è peggio di un elenco
    // corto: si sceglie, si salva, e il salvataggio non riesce.
    const { data: tutte } = await titolare.from("unita_misura").select("codice").eq("attiva", true);
    for (const u of tutte ?? []) {
      const { data, error } = await titolare
        .from("ingredients")
        .insert({
          entity_id: ente,
          name: `${NOME} ${u.codice}`,
          unit: u.codice,
          // ⚠️ Dal 30/08 un materiale non sta più in «Altro»: quella
          // categoria è rimasta ai soli alimenti.
          category: "varie_materiali",
          alimentare: false,
          current_price: 1,
        })
        .select("id")
        .single();
      expect(error, `l'unità «${u.codice}» è nel catalogo ma il database la rifiuta`).toBeNull();
      if (data) await titolare.from("ingredients").delete().eq("id", data.id);
    }
  });
});
