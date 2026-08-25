import { describe, expect, it } from "vitest";
import { formaDelDatabase } from "../../scripts/comune.mjs";

// 🔴 LA PROVA CHE SERVE E' QUELLA AL CONTRARIO (25/08/2026). Questa
// funzione decide se la ricostruzione da zero ha prodotto lo stesso
// schema del database vero, e sbaglia in due modi opposti:
//   · troppo severa → tre differenze false a ogni giro, e un controllo
//     che grida sempre si impara a spegnere (e' il motivo per cui esiste);
//   · troppo indulgente → dice «zero differenze» su uno schema diverso,
//     che e' la risposta piu' corta con l'aria di essere intera.
// Il secondo verso e' quello che nessuno andrebbe a controllare, quindi
// e' quello con piu' prove.
describe("la forma di un database si confronta ignorando le parentesi", () => {
  it("lo stesso vincolo con parentesi diverse e' lo stesso vincolo", () => {
    // I due testi veri, presi dal confronto del 25/08.
    const ricostruito =
      "vincolo: service_settings_passo_check CHECK ((((passo_prenotazioni_minuti >= 5) AND (passo_prenotazioni_minuti <= 120)) AND ((60 % passo_prenotazioni_minuti) = 0)))";
    const prova =
      "vincolo: service_settings_passo_check CHECK (((passo_prenotazioni_minuti >= 5) AND (passo_prenotazioni_minuti <= 120) AND ((60 % passo_prenotazioni_minuti) = 0)))";
    const a = formaDelDatabase(ricostruito);
    const b = formaDelDatabase(prova);
    expect([...a]).toEqual([...b]);
  });

  it("un numero diverso resta una differenza", () => {
    const a = formaDelDatabase("vincolo: x CHECK ((mese >= 1) AND (mese <= 12))");
    const b = formaDelDatabase("vincolo: x CHECK ((mese >= 1) AND (mese <= 13))");
    expect([...a]).not.toEqual([...b]);
  });

  it("un operatore diverso resta una differenza", () => {
    const a = formaDelDatabase("vincolo: x CHECK (giorni >= 1)");
    const b = formaDelDatabase("vincolo: x CHECK (giorni > 1)");
    expect([...a]).not.toEqual([...b]);
  });

  it("una colonna diversa resta una differenza", () => {
    const a = formaDelDatabase("vincolo: x CHECK (prima_scadenza_mese >= 1)");
    const b = formaDelDatabase("vincolo: x CHECK (seconda_scadenza_mese >= 1)");
    expect([...a]).not.toEqual([...b]);
  });

  it("una colonna che manca da una parte resta una differenza", () => {
    const a = formaDelDatabase("tabella: orders.conto_id uuid\ntabella: orders.id uuid");
    const b = formaDelDatabase("tabella: orders.id uuid");
    expect(a.size).toBe(2);
    expect(b.size).toBe(1);
  });

  it("un AND diventato OR resta una differenza", () => {
    const a = formaDelDatabase("vincolo: x CHECK ((a > 1) AND (b > 1))");
    const b = formaDelDatabase("vincolo: x CHECK ((a > 1) OR (b > 1))");
    expect([...a]).not.toEqual([...b]);
  });

  it("le righe vuote non contano come elementi", () => {
    expect(formaDelDatabase("\n\n  \n").size).toBe(0);
  });
});
