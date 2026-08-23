import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catene, fileDaSetacciare, pulizieACaso } from "../../scripts/pulizie.mjs";

// 🔴 UNA PULIZIA CANCELLA SOLO LE RIGHE CHE HA CREATO LEI (23/08/2026).
//
// Regola di Alessio, nata da un danno vero: uno script di prova ha
// cancellato «l'ultima riga» invece della propria, e se n'è andato uno
// sconto vero dello scenario. Il perché e la forma del controllo stanno in
// `scripts/pulizie.mjs`.
//
// ⚠️ Queste prove sono scritte AL CONTRARIO dove conta: non basta che il
// setaccio taccia sul codice buono — deve gridare su quello cattivo,
// altrimenti tacerebbe anche un setaccio che non guarda niente.

const DANNOSO = `
const { data: dg } = await c
  .from("discounts_gifts")
  .select("id, type")
  .order("created_at", { ascending: false })
  .limit(1);
if (dg?.[0]) await c.from("discounts_gifts").delete().eq("id", dg[0].id);
`;

const LEGITTIMO = `
const { data } = await titolare
  .from("preventivo_fogli")
  .select("contenuto")
  .eq("preventivo_id", prev)
  .order("prodotto_il", { ascending: false })
  .limit(1)
  .single();
await titolare.from("preventivi").delete().eq("id", prev);
`;

describe("il setaccio delle pulizie", () => {
  it("prende lo script che ha fatto il danno del 23/08", () => {
    // È il caso vero, ricopiato: «la più recente fra TUTTE», e poi la
    // cancella. L'identificativo c'era — ma non era suo.
    const trovati = pulizieACaso(DANNOSO);
    expect(trovati.length).toBeGreaterThan(0);
    expect(trovati[0].perche).toContain("piu' recente fra tutte");
  });

  it("lascia stare «la più recente fra le MIE»", () => {
    // ⚠️ È l'unico caso che la misura del 23/08 ha trovato nel codice
    // esistente, ed è legittimo: la lettura è già ristretta alla riga che
    // la prova ha creato. Un guardiano che grida qui si impara a spegnere.
    expect(pulizieACaso(LEGITTIMO)).toEqual([]);
  });

  it("prende una cancellazione senza nessun filtro", () => {
    const trovati = pulizieACaso(`await c.from("orders").delete();`);
    expect(trovati[0].perche).toContain("senza nessun filtro");
  });

  it("prende una cancellazione scelta per numero", () => {
    const trovati = pulizieACaso(
      `await c.from("orders").delete().limit(1);`
    );
    expect(trovati.length).toBeGreaterThan(0);
  });

  it("non dice niente su una cancellazione per identificativo", () => {
    expect(pulizieACaso(`await c.from("orders").delete().eq("id", mio);`)).toEqual([]);
  });

  it("non dice niente su una cancellazione per marcatore di prova", () => {
    expect(
      pulizieACaso(`await c.from("ingredients").delete().like("name", "TEST-AUTO%");`)
    ).toEqual([]);
  });

  it("una lettura per recenza in un file che NON cancella non è un problema", () => {
    // Senza cancellazioni intorno, «la più recente» è solo una lettura.
    expect(
      pulizieACaso(`const { data } = await c.from("orders").select("id").limit(1);`)
    ).toEqual([]);
  });

  it("le catene si leggono fino al punto e virgola", () => {
    expect(catene(DANNOSO)).toHaveLength(2);
  });
});

describe("nessuna pulizia sceglie a caso", () => {
  it("né nelle prove, né negli strumenti, né negli script usa-e-getta", () => {
    // ⚠️ GLI SCRIPT USA-E-GETTA SONO DENTRO IL SETACCIO, ed è il punto:
    // stanno fuori dal repository, non passano da lint né da build, e **è
    // lì che il danno del 23/08 è successo**. Un controllo che guardasse
    // solo il codice committato avrebbe detto zero, e avrebbe avuto
    // ragione sul posto sbagliato.
    const colpevoli = [];
    for (const f of fileDaSetacciare(".")) {
      // Questo file contiene gli esempi cattivi apposta: si salta da sé.
      if (f.endsWith("tests/unita/pulizie.test.js")) continue;
      for (const p of pulizieACaso(readFileSync(f, "utf8"))) {
        colpevoli.push(`${f}:${p.riga} — ${p.perche}`);
      }
    }
    expect(
      colpevoli,
      "Queste pulizie scelgono cosa cancellare con un criterio che potrebbe\n" +
        "pescare un dato vero. Una pulizia cancella SOLO righe di cui conosce\n" +
        "l'identificativo, perché le ha create lei e se l'è segnato:\n  " +
        colpevoli.join("\n  ")
    ).toEqual([]);
  });
});
