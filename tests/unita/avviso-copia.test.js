import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  ORE_AVVISO_COPIA,
  daRipetere,
  oreAvviso,
  avvisoCopiaFallita,
  avvisoCopiaVecchia,
  etaAParole,
  mandaTelegram,
  ultimeRighe,
} from "../../scripts/avviso-copia.mjs";

// 🔴 SE LA COPIA DELLA SERA FALLIVA, NESSUNO LO SAPEVA (revisione dell'11/11,
//    punto 10): il 10/11 alle 21:30 non e' partita, e nessun avviso. Qui si
//    provano le parti che decidono e scrivono l'avviso: la copia vera e
//    Telegram vero non si chiamano nelle prove.

// ⚠️ «Adesso» FISSO, come nel freno delle migrazioni: una prova che dipende
//    dal giorno in cui gira prova il calendario, non l'avviso.
const ADESSO = new Date(2026, 10, 12, 21, 35, 0, 0);
const copia = (oreFa, nome = "2026-11-10_2130") => ({ nome, quando: new Date(ADESSO.getTime() - oreFa * 3_600_000) });

describe("l'eta' a parole", () => {
  it("ore, giorni, e tutte e due", () => {
    expect(etaAParole(0.5)).toBe("0 ore");
    expect(etaAParole(1)).toBe("1 ora");
    expect(etaAParole(5)).toBe("5 ore");
    expect(etaAParole(24)).toBe("1 giorno");
    expect(etaAParole(49)).toBe("2 giorni e 1 ora");
    expect(etaAParole(75)).toBe("3 giorni e 3 ore");
  });
});

describe("la copia della sera non riesce", () => {
  it("lo dice, con l'ultima copia buona e le ultime righe dell'errore", () => {
    const t = avvisoCopiaFallita({
      uscita: "── Forma del database\n\n  Non sono riuscito a salvare 01_schema.sql.\n  FATAL: password authentication failed",
      ultima: copia(48),
      adesso: ADESSO,
    });
    expect(t).toMatch(/^💾 COPIA DI SICUREZZA/);
    expect(t).toContain("La copia di stasera NON e' riuscita.");
    expect(t).toContain("L'ultima copia completa e' 2026-11-10_2130 (2 giorni fa).");
    expect(t).toContain("FATAL: password authentication failed");
    expect(t).toContain("npm run backup");
  });

  it("senza nessuna copia completa e senza uscita lo dice lo stesso", () => {
    const t = avvisoCopiaFallita({ uscita: "", ultima: null, adesso: ADESSO });
    expect(t).toContain("Sul PC non c'e' nessuna copia completa.");
    expect(t).toContain("forse non e' nemmeno partita");
  });

  it("🔴 su Telegram non va mai la stringa del database, ne' una password", () => {
    const uscita =
      "errore: could not connect to postgresql://postgres.abc:SEGRETA@aws-0.pooler.supabase.com:5432/postgres\n" +
      "password=SEGRETA2 token: SEGRETO3";
    const t = ultimeRighe(uscita);
    expect(t).not.toMatch(/SEGRET/);
    expect(t).toContain("[indirizzo del database]");
    expect(avvisoCopiaFallita({ uscita, ultima: null, adesso: ADESSO })).not.toMatch(/SEGRET/);
  });

  it("tiene solo le ultime righe, e un testo che Telegram accetta", () => {
    const tante = Array.from({ length: 50 }, (_, i) => `riga ${i}`).join("\n");
    expect(ultimeRighe(tante).split("\n")).toEqual(Array.from({ length: 8 }, (_, i) => `riga ${42 + i}`));
    expect(ultimeRighe("x".repeat(5000)).length).toBeLessThanOrEqual(1500);
  });
});

describe("l'ultima copia completa e' troppo vecchia", () => {
  it("fresca: nessun avviso", () => {
    expect(avvisoCopiaVecchia(copia(2), ADESSO)).toBeNull();
    expect(avvisoCopiaVecchia(copia(47.9), ADESSO, 48)).toBeNull();
  });

  it("oltre due giorni: avvisa, e dice quale e quanti giorni", () => {
    const t = avvisoCopiaVecchia(copia(50), ADESSO, 48);
    expect(t).toMatch(/^💾 COPIA DI SICUREZZA/);
    expect(t).toContain("Da piu' di 2 giorni non c'e' una copia nuova.");
    expect(t).toContain("2026-11-10_2130 (2 giorni e 2 ore fa)");
  });

  it("nessuna copia: avvisa con un'altra frase", () => {
    expect(avvisoCopiaVecchia(null, ADESSO, 48)).toContain("Sul PC non c'e' nessuna copia completa.");
  });

  it("una copia «del futuro» non passa per fresca", () => {
    expect(avvisoCopiaVecchia(copia(-5), ADESSO, 48)).toContain("risulta fatta nel futuro");
  });

  it("il limite predefinito e' due giorni", () => {
    expect(ORE_AVVISO_COPIA).toBe(48);
  });
});

describe("il messaggio parte su Telegram", () => {
  it("con token e chat manda il testo alla chat giusta", async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 200 }));
    const esito = await mandaTelegram({ token: "T0K", chatId: "42", testo: "ciao", fetch });
    expect(esito.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opzioni] = fetch.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/botT0K/sendMessage");
    expect(JSON.parse(opzioni.body)).toEqual({ chat_id: "42", text: "ciao" });
  });

  it("senza chiavi non parte, e lo dice", async () => {
    const fetch = vi.fn();
    const esito = await mandaTelegram({ token: "", chatId: "42", testo: "x", fetch });
    expect(esito.ok).toBe(false);
    expect(esito.dettaglio).toMatch(/TELEGRAM_BOT_TOKEN/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("un rifiuto o una rete giu' sono un esito, non un'eccezione, e il token non esce", async () => {
    const rifiuto = await mandaTelegram({ token: "T0K", chatId: "42", testo: "x", fetch: async () => ({ ok: false, status: 401 }) });
    expect(rifiuto).toEqual({ ok: false, dettaglio: "Telegram ha risposto 401" });
    const giu = await mandaTelegram({
      token: "T0K",
      chatId: "42",
      testo: "x",
      fetch: async () => {
        throw Object.assign(new Error("getaddrinfo ENOTFOUND api.telegram.org/botT0K"), { code: "ENOTFOUND" });
      },
    });
    expect(giu.ok).toBe(false);
    expect(giu.dettaglio).toContain("ENOTFOUND");
    expect(giu.dettaglio).not.toContain("T0K");
  });
});

describe("la copia della sera e il controllo, nel codice", () => {
  const sera = readFileSync("scripts/backup-sera.mjs", "utf8");
  const pacchetto = JSON.parse(readFileSync("package.json", "utf8"));

  it("i due comandi esistono", () => {
    expect(pacchetto.scripts["backup:sera"]).toBe("node scripts/backup-sera.mjs");
    expect(pacchetto.scripts["backup:controlla"]).toBe("node scripts/backup-sera.mjs --solo-controllo");
  });

  it("la copia la fa backup.mjs, e un fallimento esce con errore anche verso Windows", () => {
    expect(sera).toMatch(/"backup\.mjs"/);
    expect(sera).toMatch(/if \(copia\.ok\) process\.exit\(0\);/);
    expect(sera).toMatch(/const partito = await avvisa\(testo\);\s*process\.exit\(partito \? 1 : 2\);\s*$/);
    // Parte sempre dalla cartella del progetto: `.env` si trova anche se Windows parte da un'altra.
    expect(sera).toMatch(/process\.chdir\(progetto\);/);
  });

  it("le chiavi di Telegram sono nel modello di .env", () => {
    const modello = readFileSync(".env.example", "utf8");
    expect(modello).toMatch(/^TELEGRAM_BOT_TOKEN=$/m);
    expect(modello).toMatch(/^TELEGRAM_CHAT_ID=$/m);
  });
});

describe("i dettagli che contano", () => {
  const ADESSO2 = new Date(2026, 10, 12, 21, 35, 0, 0);

  it("il limite da .env: un numero vero, altrimenti due giorni (mai «avvisa sempre»)", () => {
    expect(oreAvviso("72")).toBe(72);
    expect(oreAvviso(undefined)).toBe(48);
    expect(oreAvviso("")).toBe(48);
    expect(oreAvviso("due giorni")).toBe(48);
    expect(oreAvviso("-5")).toBe(48);
  });

  it("lo stesso avviso non si ripete prima di 12 ore", () => {
    const ore = (n) => new Date(ADESSO2.getTime() - n * 3_600_000);
    expect(daRipetere(null, ADESSO2)).toBe(true);
    expect(daRipetere(new Date("non una data"), ADESSO2)).toBe(true);
    expect(daRipetere(ore(3), ADESSO2)).toBe(false);
    expect(daRipetere(ore(12), ADESSO2)).toBe(true);
    expect(daRipetere(ore(-1), ADESSO2)).toBe(true);
  });

  it("copia fatta ma senza zip: lo dice cosi', non «NON riuscita»", () => {
    const t = avvisoCopiaFallita({
      uscita: "COPIA FATTA, MA SENZA LO ZIP.",
      ultima: { nome: "2026-11-12_2130", quando: new Date(2026, 10, 12, 21, 30) },
      adesso: ADESSO2,
      fattaOra: true,
    });
    expect(t).toContain("La copia di stasera (2026-11-12_2130) e' fatta e controllata, ma senza lo zip.");
    expect(t).not.toContain("NON e' riuscita");
  });

  it("🔴 nessun segreto in nessuna forma", () => {
    const uscita = [
      'password="due parole" e poi',
      "Authorization: Bearer abc.def.ghi",
      "chiave eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.firmafirmafirma",
      "nuova chiave sb_secret_AbCdEf123456",
      "bot 1234567890:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0",
      'FATAL: password authentication failed for user "postgres.abcdefghijklmnop"',
      "valore esatto: QUESTO-E-IL-SEGRETO-DI-ENV",
    ].join("\n");
    const t = ultimeRighe(uscita, 20, ["QUESTO-E-IL-SEGRETO-DI-ENV"]);
    for (const segreto of ["parole", "abc.def", "eyJhbGci", "sb_secret_AbCd", "AAHdqTcv", "abcdefghijklmnop", "QUESTO-E-IL"]) {
      expect(t, segreto).not.toContain(segreto);
    }
    // Il senso dell'errore resta leggibile.
    expect(t).toContain("password authentication failed");
  });
});
