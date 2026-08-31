import { describe, expect, it } from "vitest";
import {
  VARIABILI_TEST_APP,
  verificaAmbienteTestApp,
} from "../../scripts/verifica-ambiente-test-app.mjs";

const ambienteValido = Object.fromEntries(VARIABILI_TEST_APP.map((nome) => [nome, "prova"]));

describe("preavvio delle prove contro l'app", () => {
  it("rifiuta un giro senza credenziali invece di lasciarlo verde con tutte le prove saltate", () => {
    expect(() => verificaAmbienteTestApp({})).toThrow(/mancano VITE_SUPABASE_URL/);
  });

  it("elenca tutte le variabili mancanti, non soltanto la prima", () => {
    expect(() =>
      verificaAmbienteTestApp({ VITE_SUPABASE_URL: "https://prova.supabase.co" })
    ).toThrow(/TEST_STAFF_PASSWORD/);
  });

  it("rifiuta esplicitamente il riferimento del database di produzione", () => {
    expect(() =>
      verificaAmbienteTestApp({
        ...ambienteValido,
        VITE_SUPABASE_URL: "https://oudjuqbqszisdtwzbxdo.supabase.co",
      })
    ).toThrow(/database di produzione/);
  });

  it("accetta un ambiente completo diretto al progetto di prova", () => {
    expect(() =>
      verificaAmbienteTestApp({
        ...ambienteValido,
        VITE_SUPABASE_URL: "https://progetto-di-prova.supabase.co",
      })
    ).not.toThrow();
  });
});
