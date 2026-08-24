import { describe, expect, it } from "vitest";
import { puoAndareInCarta } from "../../src/lib/calcoli/carta";

// CHI PUÒ ANDARE IN UN MENU — decisione di Alessio del 20/08/2026.
//
// 🔴 OGNI CASO QUI DENTRO HA `pronta_per_carta: true`, ed è la condizione
// che rende queste prove capaci di distinguere: se una preparazione fosse
// esclusa solo perché quel segno è spento, non si starebbe misurando il
// criterio giusto — si starebbe misurando una coincidenza. È la trappola del
// caso vuoto del 17/08, letta sulla condizione invece che sui dati.
describe("in un menu ci vanno solo i piatti pronti per la carta", () => {
  const pronta = { pronta_per_carta: true };

  it("un piatto pronto ci va", () => {
    expect(puoAndareInCarta({ ...pronta, recipe_type: "piatto_finito" })).toBe(true);
  });

  it("una preparazione NON ci va, nemmeno segnata pronta", () => {
    expect(puoAndareInCarta({ ...pronta, recipe_type: "preparazione" })).toBe(false);
  });

  it("un finger NON ci va, nemmeno segnato pronto", () => {
    // ⚠️ Alessio, 20/08: «semmai un finger dovesse diventare un piatto a
    // sé, creerò una ricetta nuova con un nome diverso». Quindi il prezzo a
    // pezzo resta l'unico prezzo di un finger.
    expect(puoAndareInCarta({ ...pronta, recipe_type: "finger" })).toBe(false);
  });

  it("un piatto NON ancora pronto non ci va", () => {
    expect(puoAndareInCarta({ recipe_type: "piatto_finito", pronta_per_carta: false })).toBe(false);
  });

  it("il vuoto non è un sì", () => {
    // Una ricetta non ancora caricata non deve comparire fra i candidati.
    expect(puoAndareInCarta(null)).toBe(false);
    expect(puoAndareInCarta({ recipe_type: "piatto_finito" })).toBe(false);
  });

  it("un tipo che oggi non esiste non entra da solo", () => {
    // ⚠️ È la ragione per cui il criterio chiede una proprietà invece di
    // elencare i tipi da escludere: con un elenco, un tipo nuovo domani
    // comparirebbe in carta finché qualcuno non si ricorda di aggiungerlo.
    expect(puoAndareInCarta({ ...pronta, recipe_type: "cocktail" })).toBe(false);
  });
});
