import { describe, expect, it } from "vitest";
import { campiPrenotazione } from "../../src/lib/calcoli/prenotazioni";

// I CAMPI DELL'ELENCO PRENOTAZIONI — la riga che le due forme condividono.
//
// ⚠️ COSA PROVA DAVVERO QUESTO FILE. Non che una tabella sia disegnata bene:
// prova che **esiste un elenco solo** e che ci sta dentro il tavolo. Il
// difetto che tiene lontano è quello di due elenchi paralleli — la tabella del
// computer e i blocchetti del telefono — che divergono in silenzio quando
// qualcuno aggiunge un dato a uno solo dei due.

const PRENOTAZIONE = {
  reservation_date: "2026-08-18",
  reservation_time: "20:30:00",
  customer_name: "Mario",
  party_size: 4,
  type: "cena",
  tavoli: [{ etichetta_al_momento: "T7" }, { etichetta_al_momento: "T8" }],
};

describe("I campi di una prenotazione nell'elenco", () => {
  it("il TAVOLO è fra i campi — prima non c'era affatto", () => {
    const tavolo = campiPrenotazione(PRENOTAZIONE).find((c) => c.chiave === "tavolo");
    expect(tavolo).toBeTruthy();
    expect(tavolo.valore).toBe("T7 · T8");
  });

  it("senza tavolo il campo resta VUOTO, e ha una parola sua invece di un trattino", () => {
    // ⚠️ La gemella al contrario: «da assegnare» è un fatto — nessuno gliel'ha
    // ancora dato — e va detto, non nascosto dietro un segno che si legge
    // «questo dato non esiste».
    const tavolo = campiPrenotazione({ ...PRENOTAZIONE, tavoli: [] }).find(
      (c) => c.chiave === "tavolo"
    );
    expect(tavolo.valore).toBe("");
    expect(tavolo.vuoto).toBe("da assegnare");
  });

  it("la riga è UNA: le chiavi sono quelle, e in quest'ordine", () => {
    // ⚠️ Congela l'elenco: il giorno che qualcuno aggiunge un campo pensando
    // alla sola tabella, questa diventa rossa e chiede di guardare anche il
    // telefono — che è la strada maestra per le prenotazioni.
    expect(campiPrenotazione(PRENOTAZIONE).map((c) => c.chiave)).toEqual([
      "data",
      "ora",
      "cliente",
      "coperti",
      "tavolo",
      "tipo",
    ]);
  });

  it("su una prenotazione che non c'è non esplode e non inventa righe", () => {
    expect(campiPrenotazione(null)).toEqual([]);
  });

  it("i campi senza tavoli non si rompono se la chiave manca del tutto", () => {
    // Succede a chiunque legga le prenotazioni con una `select` che non
    // incorpora i tavoli: meglio vuoto che un errore in mezzo a un elenco.
    const senza = { ...PRENOTAZIONE };
    delete senza.tavoli;
    expect(campiPrenotazione(senza).find((c) => c.chiave === "tavolo").valore).toBe("");
  });
});
