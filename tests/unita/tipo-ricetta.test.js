import { describe, expect, it } from "vitest";
import {
  doveFinisce,
  eFingerSingolo,
  ePreparazione,
  eSelezione,
  parolaTipo,
  portaDi,
} from "../../src/lib/calcoli/tipoRicetta";
import {
  perchePuoNonAndareInCarta,
  senzaFoodCost,
  senzaFoodCostInBreve,
} from "../../src/lib/calcoli/inCarta";

// CHE COS'È QUESTA RICETTA — le due domande che il 29/08 erano più larghe
// del vero, provate sul caso che le ha smentite.
//
// ⚠️ IL CASO CHE CONTA È UNO SOLO e ha un nome: `finger` + `finger_food`.
// È la ricetta della schermata di Alessio, quella in cui un finger si
// cercava da sé. Ogni prova qui sotto che non lo comprende sta misurando
// una coincidenza.

const piatto = { recipe_type: "piatto_finito", category: "primo" };
const selezione = { recipe_type: "piatto_finito", category: "finger_food" };
const finger = { recipe_type: "finger", category: "antipasto" };
// 🔴 IL CASO CHE HA PRODOTTO I DUE DIFETTI.
const fingerInCategoriaFingerFood = { recipe_type: "finger", category: "finger_food" };
const preparazione = { recipe_type: "preparazione", category: "primo" };

describe("che cos'è questa ricetta", () => {
  it("una selezione è un piatto finito di categoria finger food", () => {
    expect(eSelezione(selezione)).toBe(true);
  });

  it("🔴 un FINGER in categoria finger food NON è una selezione", () => {
    // La vecchia regola guardava la sola categoria e qui rispondeva sì:
    // da lì il pannello «Cerca un finger…» dentro un finger.
    expect(eSelezione(fingerInCategoriaFingerFood)).toBe(false);
    expect(eFingerSingolo(fingerInCategoriaFingerFood)).toBe(true);
  });

  it("un piatto normale e una preparazione non sono selezioni", () => {
    expect(eSelezione(piatto)).toBe(false);
    expect(eSelezione(preparazione)).toBe(false);
  });

  it("senza ricetta non risponde di sì a niente", () => {
    // Sulla scheda la domanda si fa anche mentre la ricetta si sta ancora
    // caricando: un «sì» lì dentro disegnerebbe la schermata sbagliata per
    // un istante.
    expect(eSelezione(null)).toBe(false);
    expect(eSelezione(undefined)).toBe(false);
    expect(eFingerSingolo(null)).toBe(false);
    expect(ePreparazione(null)).toBe(false);
  });
});

describe("le parole seguono il tipo", () => {
  it("un finger non si chiama «preparazione»", () => {
    expect(parolaTipo(finger, "questo")).toBe("questo finger");
    expect(parolaTipo(fingerInCategoriaFingerFood, "questo")).toBe("questo finger");
  });

  it("una preparazione sì", () => {
    expect(parolaTipo(preparazione, "questo")).toBe("questa preparazione");
  });

  it("una selezione ha parole sue, un piatto normale no", () => {
    expect(parolaTipo(selezione, "questo")).toBe("questa selezione");
    expect(parolaTipo(piatto, "questo")).toBe("questo piatto");
  });

  it("il riquadro «dove finisce» concorda con sé stesso", () => {
    // ⚠️ Titolo e frase del caso vuoto escono insieme apposta: cambiare il
    // titolo e lasciare il vuoto al femminile rifarebbe lo stesso difetto
    // un rigo più sotto.
    const suFinger = doveFinisce(finger);
    expect(suFinger.titolo).toContain("finger");
    expect(suFinger.vuoto).not.toContain("usata");

    const suPrep = doveFinisce(preparazione);
    expect(suPrep.titolo).toContain("preparazione");
    expect(suPrep.vuoto).toContain("usata");
  });
});

describe("da quale porta si rientra", () => {
  it("i finger e le selezioni rientrano fra i finger", () => {
    expect(portaDi(finger)).toBe("finger");
    expect(portaDi(selezione)).toBe("finger");
    expect(portaDi(fingerInCategoriaFingerFood)).toBe("finger");
  });
  it("gli altri due alle porte loro", () => {
    expect(portaDi(preparazione)).toBe("preparazione");
    expect(portaDi(piatto)).toBe("piatto_finito");
  });
  it("senza ricetta si rientra fra i piatti, non da nessuna parte", () => {
    expect(portaDi(null)).toBe("piatto_finito");
  });
});

describe("cosa impedisce di andare in carta", () => {
  it("uno zero è «non ce l'ha», non «costa zero»", () => {
    expect(senzaFoodCost(null)).toBe(true);
    expect(senzaFoodCost(undefined)).toBe(true);
    expect(senzaFoodCost({})).toBe(true);
    expect(senzaFoodCost({ food_cost_portion: 0 })).toBe(true);
    expect(senzaFoodCost({ food_cost_portion: "0.00" })).toBe(true);
  });

  it("un costo vero non impedisce niente", () => {
    expect(senzaFoodCost({ food_cost_portion: 2.5 })).toBe(false);
    expect(perchePuoNonAndareInCarta(piatto, { food_cost_portion: 2.5 })).toBeNull();
    expect(senzaFoodCostInBreve({ food_cost_portion: 2.5 })).toBe("");
  });

  it("il rifiuto dice CHE COSA fare prima, e non è un vicolo cieco", () => {
    const frase = perchePuoNonAndareInCarta(piatto, null);
    expect(frase).toContain("food cost");
    // ⚠️ Un rifiuto senza via d'uscita è un difetto a sé (16/08): la frase
    // deve nominare tutt'e due le strade.
    expect(frase).toContain("Aggiungi gli ingredienti");
    expect(frase).toContain("menu non in servizio");
  });

  it("e chiama la cosa col suo nome", () => {
    expect(perchePuoNonAndareInCarta(finger, null)).toMatch(/^Questo finger/);
    expect(perchePuoNonAndareInCarta(preparazione, null)).toMatch(/^Questa preparazione/);
    expect(perchePuoNonAndareInCarta(selezione, null)).toMatch(/^Questa selezione/);
    expect(perchePuoNonAndareInCarta(piatto, null)).toMatch(/^Questo piatto/);
  });
});
