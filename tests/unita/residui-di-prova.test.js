// =====================================================================
// UN PROGRAMMA CHE CANCELLA RIGHE DEVE SBAGLIARE DATABASE MAI
// =====================================================================
//
// 🔴 E' l'unica prova che conta davvero su `residui-di-prova.mjs`: il resto
//    e' una `delete` su nomi dichiarati. Il rischio sta tutto nel bersaglio.

import { describe, it, expect } from "vitest";
import { problemaDelBersaglio, RESIDUI_NOTI } from "../../scripts/residui-di-prova.mjs";
import { REF_PROVA, REF_PRODUZIONE } from "../../scripts/comune.mjs";

describe("su quale database sto per cancellare", () => {
  it("il progetto di prova va bene", () => {
    expect(problemaDelBersaglio(`https://${REF_PROVA}.supabase.co`)).toBeNull();
  });

  it("🔴 il gestionale vero e' respinto, e il messaggio non offre scappatoie", () => {
    const p = problemaDelBersaglio(`https://${REF_PRODUZIONE}.supabase.co`);
    expect(p).toMatch(/gestionale VERO/);
    expect(p).toMatch(/non e' un errore da correggere con un'opzione/);
  });

  it("🔴 un terzo progetto sconosciuto e' respinto quanto la produzione", () => {
    // «non e' la produzione» non basta: sarebbe vero anche del database di
    // qualcun altro.
    expect(problemaDelBersaglio("https://unprogettochenonconosco.supabase.co")).toMatch(
      /non riconosco/,
    );
  });

  it("senza indirizzo non si parte", () => {
    expect(problemaDelBersaglio("")).toMatch(/manca l'indirizzo/);
    expect(problemaDelBersaglio(null)).toMatch(/manca l'indirizzo/);
  });
});

describe("che cosa si cancella", () => {
  it("⚠️ soltanto nomi esatti, dichiarati: nessun jolly", () => {
    expect(RESIDUI_NOTI.length).toBeGreaterThan(0);
    for (const r of RESIDUI_NOTI) {
      expect(r.tabella).toBeTruthy();
      expect(r.colonna).toBeTruthy();
      expect(r.valore).toBeTruthy();
      expect(r.valore).not.toMatch(/[%*]/);
    }
  });
});
