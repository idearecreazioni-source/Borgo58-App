import { describe, expect, it } from "vitest";
import { payloadMancia } from "../../src/lib/api/personale";

// La riga che va al database quando si registra una mancia.
//
// 🔴 Questa prova nasce da un difetto vero (validazione del 16/08): il
// menu «contanti / carta» sulla schermata c'era, si vedeva e si
// conservava, ma il campo NON arrivava al database — che applicava il
// predefinito «contanti». Ogni mancia incassata con carta finiva nel
// contante atteso del cassetto senza esserci fisicamente, e al primo
// conteggio sarebbe risultato un ammanco pari alle mance su carta.
//
// ⚠️ Le prove sul database non potevano prenderlo, perché esercitano il
// database e non il tratto fra schermata e database. È il motivo per cui
// l'elenco dei campi è stato spostato in una funzione pura: un confine
// che nessuno controlla è un confine dove si perdono le cose.
describe("la riga di una mancia", () => {
  it("porta al database la forma scelta, non quella predefinita", () => {
    const r = payloadMancia({
      entityId: "e1",
      amount: "60",
      collectedDate: "2026-08-16",
      mezzo: "carta",
      note: " con la carta ",
    });
    expect(r.mezzo).toBe("carta");
    expect(r.amount).toBe(60);
    expect(r.note).toBe("con la carta");
  });

  it("in contanti resta contanti", () => {
    expect(payloadMancia({ entityId: "e1", amount: 40, collectedDate: "2026-08-16", mezzo: "contanti" }).mezzo)
      .toBe("contanti");
  });

  // ⚠️ Se un domani qualcuno aggiunge un campo e si dimentica di passarlo,
  // questo controllo diventa rosso: l'elenco è scritto una volta sola e
  // confrontato per intero, invece di guardare un campo per volta.
  it("non perde nessun campo per strada", () => {
    const r = payloadMancia({
      entityId: "e1",
      amount: 10,
      collectedDate: "2026-08-16",
      mezzo: "carta",
      note: null,
    });
    expect(Object.keys(r).sort()).toEqual(
      ["amount", "collected_date", "entity_id", "mezzo", "note"]
    );
  });

  it("senza forma indicata sceglie contanti, e lo fa in un posto solo", () => {
    // Il predefinito esiste anche nel database: qui si controlla che i due
    // dicano la stessa cosa, invece di scoprirlo da una giacenza sbagliata.
    expect(payloadMancia({ entityId: "e1", amount: 5, collectedDate: "2026-08-16" }).mezzo)
      .toBe("contanti");
  });
});
