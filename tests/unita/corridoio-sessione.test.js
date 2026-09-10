import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ACCESSO_NON_RAGGIUNGIBILE,
  SESSIONE_NON_VALIDA,
  esitoVerificaUtente,
} from "../../supabase/functions/operazioni-atomiche/sessione.ts";

// «SESSIONE NON VALIDA» SOLO SE LO È — 10/09/2026
//
// 🔴 Il corridoio diceva «rifare l'accesso» per qualunque errore della
//    verifica, anche per un servizio che non rispondeva: è successo su una
//    sessione valida (vedi `sessione.ts`). Qui la regola si prova senza
//    rete, con errori finti della stessa forma di quelli della libreria.

const utente = { id: "u" };

describe("cosa risponde il corridoio quando la verifica dell'utente non riesce", () => {
  it("verifica riuscita: nessun rifiuto", () => {
    expect(esitoVerificaUtente(null, utente)).toBeNull();
  });

  it("🔴 gettone respinto dal servizio di accesso → sessione non valida (401)", () => {
    for (const errore of [
      { name: "AuthApiError", status: 401 },
      { name: "AuthApiError", status: 403 },
      { name: "AuthApiError", status: 400 },
      { name: "AuthApiError", status: 404 },
      { name: "AuthSessionMissingError", status: 400 },
      { name: "AuthInvalidJwtError" },
    ]) {
      expect(esitoVerificaUtente(errore, null), JSON.stringify(errore)).toEqual(SESSIONE_NON_VALIDA);
    }
  });

  it("⚠️ nessun errore ma nessun utente → sessione non valida", () => {
    expect(esitoVerificaUtente(null, null)).toEqual(SESSIONE_NON_VALIDA);
  });

  it("🔴 servizio che non risponde → NON è la sessione (503), e lo dice", () => {
    for (const errore of [
      { name: "AuthRetryableFetchError", status: 0 },
      { name: "AuthRetryableFetchError", status: 502 },
      { name: "AuthApiError", status: 500 },
      { name: "AuthApiError", status: 429 },
      { name: "AuthUnknownError" },
      { name: "TypeError" },
    ]) {
      expect(esitoVerificaUtente(errore, null), JSON.stringify(errore)).toEqual(ACCESSO_NON_RAGGIUNGIBILE);
    }
    expect(ACCESSO_NON_RAGGIUNGIBILE.stato).toBe(503);
    expect(ACCESSO_NON_RAGGIUNGIBILE.messaggio).toMatch(/NON è stato scritto niente/);
    expect(ACCESSO_NON_RAGGIUNGIBILE.messaggio).not.toMatch(/rifare l'accesso/);
  });

  it("🔴 e il corridoio usa davvero questa regola, non più il 401 per tutto", () => {
    // Una regola giusta in un file che il corridoio non chiama non cura
    // niente: si guarda il corpo del corridoio.
    const corridoio = readFileSync(
      new URL("../../supabase/functions/operazioni-atomiche/index.ts", import.meta.url),
      "utf8"
    );
    expect(corridoio).toMatch(/import \{ esitoVerificaUtente \} from "\.\/sessione\.ts"/);
    expect(corridoio).toMatch(/esitoVerificaUtente\(authError, utente\?\.user\)/);
    expect(corridoio, "c'è ancora il 401 per qualunque errore").not.toMatch(
      /if \(authError \|\| !utente\?\.user\)/
    );
  });
});
