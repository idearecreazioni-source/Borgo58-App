import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { REF_PROVA } from "../../supabase/functions/notify-telegram-reservation/ambiente";
import { deveTacere, silenziabile } from "../../supabase/functions/notify-telegram-reservation/silenzio";

// Nessuna di queste prove manda un Telegram: si prova la regola pura.

const PROVA = `https://${REF_PROVA}.supabase.co`;
const PRODUZIONE = "https://oudjuqbqszisdtwzbxdo.supabase.co";
const ALLARME = { type: "allarme", allarme: { tipo: "x" } };
const PRENOTAZIONE = { record: { source: "form_pubblico" } };
const PROMEMORIA = { type: "task_reminder", task: {} };

describe("che cosa un silenzio di prova può tacere", () => {
  it("allarmi e prenotazioni dal form sì, promemoria mai", () => {
    expect(silenziabile(ALLARME)).toBe(true);
    expect(silenziabile(PRENOTAZIONE)).toBe(true);
    expect(silenziabile(PROMEMORIA)).toBe(false);
    expect(silenziabile({ record: { source: "interno" } })).toBe(false);
  });
});

describe("tacere o mandare", () => {
  it("su Prova, con un silenzio aperto, allarmi e prenotazioni tacciono", async () => {
    for (const payload of [ALLARME, PRENOTAZIONE]) {
      expect(await deveTacere({ payload, supabaseUrl: PROVA, zittite: async () => true })).toBe(true);
    }
  });

  it("su Prova, senza silenzio, si manda: i test a mano continuano a funzionare", async () => {
    expect(await deveTacere({ payload: ALLARME, supabaseUrl: PROVA, zittite: async () => false })).toBe(false);
  });

  it("un promemoria non tace mai, e non si chiede nemmeno", async () => {
    const zittite = vi.fn(async () => true);
    expect(await deveTacere({ payload: PROMEMORIA, supabaseUrl: PROVA, zittite })).toBe(false);
    expect(zittite).not.toHaveBeenCalled();
  });

  it("in produzione non si tace e non si chiede nemmeno", async () => {
    const zittite = vi.fn(async () => true);
    expect(await deveTacere({ payload: ALLARME, supabaseUrl: PRODUZIONE, zittite })).toBe(false);
    expect(await deveTacere({ payload: ALLARME, supabaseUrl: undefined, zittite })).toBe(false);
    expect(zittite).not.toHaveBeenCalled();
  });

  it("se la domanda fallisce si manda, come prima della correzione", async () => {
    const rotta = async () => {
      throw new Error("404");
    };
    expect(await deveTacere({ payload: ALLARME, supabaseUrl: PROVA, zittite: rotta })).toBe(false);
  });
});

describe("la funzione usa la regola prima di ogni invio", () => {
  const sorgente = readFileSync(
    new URL("../../supabase/functions/notify-telegram-reservation/index.ts", import.meta.url),
    "utf8",
  );

  it("chiede il silenzio al database, e tace PRIMA della strada dei promemoria e dell'invio", () => {
    const tace = sorgente.indexOf("await deveTacere(");
    expect(tace).toBeGreaterThan(0);
    expect(sorgente).toMatch(/rpc\("notifiche_zittite"/);
    expect(tace).toBeLessThan(sorgente.indexOf("stradaDellaConsegna(payload)"));
    expect(tace).toBeLessThan(sorgente.lastIndexOf("await sendTelegram(message)"));
  });
});
