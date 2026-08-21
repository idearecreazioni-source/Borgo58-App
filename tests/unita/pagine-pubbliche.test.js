import { describe, it, expect } from "vitest";
import { PAGINE_DEI_CLIENTI, paginaDeiClienti } from "../../src/lib/ambiente.js";

// 🔴 Il segnale del database stava sopra TUTTE le rotte, e chi prenotava dal
// sito leggeva «DATI VERI — quello che scrivi qui conta davvero». Trovato il
// 21/08 aprendo borgo58.it/prenota.

describe("il segnale del database non compare sulle pagine dei clienti", () => {
  it("il modulo di prenotazione è una pagina dei clienti", () => {
    expect(paginaDeiClienti("/prenota")).toBe(true);
  });

  it("...e l'informativa privacy pure: ci si arriva dal modulo", () => {
    expect(paginaDeiClienti("/privacy")).toBe(true);
  });

  it("🔴 la pagina di ACCESSO no, ed è voluto", () => {
    // Chi digita il PIN sta per scrivere nel gestionale: è il momento in cui
    // sapere su quale database si entra conta di più.
    expect(paginaDeiClienti("/")).toBe(false);
  });

  it("le schermate del gestionale non lo sono", () => {
    for (const p of ["/comande", "/magazzino", "/cassa", "/dashboard"]) {
      expect(paginaDeiClienti(p)).toBe(false);
    }
  });

  it("una pagina che COMINCIA come una pubblica ma è un'altra non passa", () => {
    // ⚠️ «/prenotazioni» non è «/prenota»: senza il confine, una schermata
    // interna erediterebbe il silenzio di una pubblica.
    expect(paginaDeiClienti("/prenotazioni")).toBe(false);
    expect(paginaDeiClienti("/privacy-interna")).toBe(false);
  });

  it("...ma una sotto-pagina di una pubblica sì", () => {
    expect(paginaDeiClienti("/prenota/conferma")).toBe(true);
  });

  it("l'elenco è dichiarato e sono due", () => {
    // Se ne nascesse una terza senza entrare nell'elenco, questa diventerebbe
    // rossa e chiederebbe di dichiararla.
    expect(PAGINE_DEI_CLIENTI).toEqual(["/prenota", "/privacy"]);
  });
});
