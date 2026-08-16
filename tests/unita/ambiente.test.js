import { describe, expect, it } from "vitest";
import { RIFERIMENTO_PRODUZIONE, RIFERIMENTO_PROVA, ambienteDa } from "../../src/lib/ambiente";

// Da quando il gestionale si può puntare al progetto di prova, esiste un
// modo di sbagliare che prima non c'era: scrivere dati finti nel locale
// vero, o credere finto un dato che è vero. La schermata è la stessa.
//
// Questa funzione è tutto ciò che separa i due casi, e la sua risposta
// finisce dentro l'unico segno che l'utente vede. Vale la pena tenerla
// ferma qui, dove si prova senza browser e senza database.
describe("a quale database sono collegato", () => {
  it("riconosce il locale vero", () => {
    const a = ambienteDa(`https://${RIFERIMENTO_PRODUZIONE}.supabase.co`);
    expect(a.produzione).toBe(true);
    expect(a.genere).toBe("produzione");
  });

  it("riconosce il progetto di prova", () => {
    const a = ambienteDa(`https://${RIFERIMENTO_PROVA}.supabase.co`);
    expect(a.produzione).toBe(false);
    expect(a.genere).toBe("prova");
  });

  // ⚠️ Il caso che decide la forma della risposta: un terzo database non è
  // «probabilmente la prova». È un database che nessuno ha dichiarato, e
  // trattarlo come la prova vorrebbe dire chiamare finti dei dati che
  // nessuno sa cosa siano.
  it("un terzo database e' SCONOSCIUTO, non «probabilmente la prova»", () => {
    const a = ambienteDa("https://qualcosaltro.supabase.co");
    expect(a.produzione).toBe(false);
    expect(a.genere).toBe("sconosciuto");
    expect(a.riferimento).toBe("qualcosaltro");
  });

  // ⚠️ E soprattutto: senza indirizzo NON si risponde «produzione». Un
  // valore mancante che si legge come «sei sul vero» farebbe comparire la
  // targhetta «dati veri» su un gestionale scollegato — cioè una
  // rassicurazione falsa, che è peggio di nessun segno.
  it("senza indirizzo non dice che sei sul vero", () => {
    for (const vuoto of ["", null, undefined, "   "]) {
      const a = ambienteDa(vuoto);
      expect(a.produzione).toBe(false);
      expect(a.genere).toBe("sconosciuto");
    }
  });

  it("regge un indirizzo con sottodominio diverso", () => {
    expect(ambienteDa(`https://${RIFERIMENTO_PROVA}.supabase.in/`).genere).toBe("prova");
  });
});
