import { describe, expect, it } from "vitest";
import { fraseDiAdesso, riferimentoTemporale } from "../../supabase/functions/ascolta-voce/adesso";

// =====================================================================
// CHE ORA È ADESSO, PER MEMO — 16/09/2026
// =====================================================================
// 🔴 COSA SI PROVA, e perché è provabile: «mandami una notifica fra cinque
//    minuti» non funzionava perché al modello si diceva **solo il giorno**,
//    mai l'ora. Il conto lo fa lui, ma il riferimento glielo dà il
//    gestionale — e questo è il riferimento.
//
// ⚠️ OGNI CASO PARTE DA UN ISTANTE FISSATO, mai da `new Date()`: una prova
//    che chiede l'ora all'orologio darebbe un risultato diverso a ogni
//    esecuzione, e non proverebbe niente.
//
// ⚠️ I DUE CASI CHE SI SBAGLIANO IN SILENZIO sono qui: l'ora legale (il
//    server gira a Greenwich, e d'estate l'Italia è DUE ore avanti) e la
//    mezzanotte (dove cambia anche il giorno, e un avviso datato oggi
//    sarebbe già passato).

describe("🔴 il riferimento temporale di MEMO", () => {
  it("d'estate l'Italia è due ore avanti sul server: 12:20 a Greenwich sono le 14:20", () => {
    const r = riferimentoTemporale(new Date("2026-07-15T12:20:00Z"));
    expect(r.ora).toBe("14:20");
    expect(r.iso).toBe("2026-07-15");
    // Se qui uscisse «12:20», «fra cinque minuti» diventerebbe un avviso di
    // due ore fa: il database lo rifiuta e la notifica non arriva mai.
  });

  it("d'inverno è un'ora avanti: 12:20 a Greenwich sono le 13:20", () => {
    const r = riferimentoTemporale(new Date("2026-01-15T12:20:00Z"));
    expect(r.ora).toBe("13:20");
    expect(r.iso).toBe("2026-01-15");
  });

  it("🔴 oltre la mezzanotte cambia anche il GIORNO, non solo l'ora", () => {
    // 21:58 a Greenwich d'estate = 23:58 in Italia, ancora il 15.
    const prima = riferimentoTemporale(new Date("2026-07-15T21:58:00Z"));
    expect(prima.ora).toBe("23:58");
    expect(prima.iso).toBe("2026-07-15");

    // Cinque minuti dopo si è già nel giorno dopo: 00:03 del 16.
    const dopo = riferimentoTemporale(new Date("2026-07-15T22:03:00Z"));
    expect(dopo.ora).toBe("00:03");
    expect(dopo.iso).toBe("2026-07-16");
  });

  it("⚠️ mezzanotte esatta si scrive 00:00, mai 24:00", () => {
    // Un «24:00» non è un'ora: il database lo butterebbe via, e l'avviso
    // sparirebbe proprio nel caso che questo riferimento esiste per salvare.
    const r = riferimentoTemporale(new Date("2026-07-15T22:00:00Z"));
    expect(r.ora).toBe("00:00");
    expect(r.iso).toBe("2026-07-16");
  });

  it("la frase per il modello dice il giorno E l'ora, in italiano", () => {
    const f = fraseDiAdesso(new Date("2026-07-15T12:20:00Z"));
    expect(f).toMatch(/2026-07-15/);
    expect(f).toMatch(/le 14:20/);
    expect(f).toMatch(/mercoledì/i);
    // 🔴 La cosa che mancava: prima la frase conteneva solo il giorno.
    expect(f).toMatch(/in questo momento/i);
  });

  it("⚠️ il fuso è quello del locale, non quello di chi esegue la prova", () => {
    // Stesso istante, stessa risposta: se leggesse l'orologio della macchina,
    // questa prova cambierebbe risultato da un computer all'altro.
    const a = riferimentoTemporale(new Date("2026-03-29T00:30:00Z"));
    const b = riferimentoTemporale(new Date("2026-03-29T00:30:00Z"));
    expect(a).toEqual(b);
    // Il 29 marzo 2026 l'ora legale entra alle 02:00 italiane: 00:30 a
    // Greenwich sono ancora le 01:30, solari.
    expect(a.ora).toBe("01:30");
  });
});
