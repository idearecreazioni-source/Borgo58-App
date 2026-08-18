import { describe, expect, it } from "vitest";
import {
  CONTATTO_MINIMO_CM,
  GRIGLIA_CM,
  TOLLERANZA_CONTATTO_CM,
  sagomeFuoriGriglia,
  tolleranzaCoerenteCollaGriglia,
} from "../../src/lib/calcoli/sala";

// Le tre misure con cui si decide che due tavoli sono accostati devono
// **accordarsi fra loro**. Fino al 18/08/2026 stavano in due file che non
// si nominavano — il passo della griglia nella pianta, la tolleranza dentro
// una funzione del database — ed è la forma in cui un giorno qualcuno ne
// cambia uno solo.

describe("Le misure dell'accostamento", () => {
  it("la tolleranza sta strettamente sotto il passo della griglia", () => {
    // Se fosse ≥ del passo, due tavoli distanti un passo intero
    // risulterebbero accostati e la sala direbbe meno coperti di quelli
    // che ha — sul numero con cui si accettano le prenotazioni.
    expect(tolleranzaCoerenteCollaGriglia()).toBe(true);
    expect(TOLLERANZA_CONTATTO_CM).toBeLessThan(GRIGLIA_CM);
    expect(TOLLERANZA_CONTATTO_CM).toBeGreaterThanOrEqual(0);
  });

  it("e il controllo si accorge davvero quando il rapporto si rompe", () => {
    // ⚠️ La prova al contrario: senza questa, `tolleranzaCoerente...`
    // potrebbe restituire `true` sempre e la prova sopra passerebbe.
    expect(tolleranzaCoerenteCollaGriglia(10, 10)).toBe(false);
    expect(tolleranzaCoerenteCollaGriglia(11, 10)).toBe(false);
    expect(tolleranzaCoerenteCollaGriglia(9, 10)).toBe(true);
  });

  it("una misura non multipla del passo viene riconosciuta", () => {
    // È l'ipotesi che rende la tolleranza equivalente al contatto esatto.
    expect(sagomeFuoriGriglia([{ label: "T1", larghezza_cm: 90, profondita_cm: 90 }])).toEqual([]);
    expect(
      sagomeFuoriGriglia([{ label: "Strano", larghezza_cm: 95, profondita_cm: 90 }])
    ).toEqual(["Strano (95×90)"]);
  });

  it("il contatto minimo è una soglia scritta, e vale meno del tavolo più piccolo", () => {
    // Non è geometria misurata: è la soglia sotto la quale due tavoli che
    // si toccano non fanno un piano su cui apparecchiare. Se fosse ≥ del
    // lato più corto (90 cm), nessun accostamento verrebbe mai contato.
    expect(CONTATTO_MINIMO_CM).toBeGreaterThan(0);
    expect(CONTATTO_MINIMO_CM).toBeLessThan(90);
  });
});
