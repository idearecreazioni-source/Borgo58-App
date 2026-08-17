import { describe, expect, it } from "vitest";
import { esitoRicevimento } from "../../src/lib/calcoli/haccp";

// L'esito di un ricevimento merci finisce sul MANUALE HACCP, cioè sul
// documento che si mostra a un ispettore. Il 17/08 quel documento si
// contraddiceva da solo: «conforme» nella sezione dei ricevimenti, la
// stessa consegna fra le non conformità due sezioni più sotto.
//
// Queste prove congelano la regola, e la regola non è «guarda anche
// l'imballaggio»: è che il verdetto deve coincidere con la condizione con
// cui il DATABASE apre la non conformità, né più né meno.
describe("l'esito di un ricevimento merci", () => {
  it("tutto a posto: conforme", () => {
    const e = esitoRicevimento({ conformity: true, packaging_ok: true });
    expect(e.conforme).toBe(true);
    expect(e.etichetta).toBe("conforme");
  });

  // 🔴 Il caso del difetto: la merce va bene, l'imballaggio no. Prima
  // usciva «conforme» sul manuale, mentre il database aveva già aperto la
  // non conformità.
  it("imballaggio non integro: NON conforme, e lo dice", () => {
    const e = esitoRicevimento({ conformity: true, packaging_ok: false });
    expect(e.conforme).toBe(false);
    expect(e.etichetta).toBe("imballaggio non integro");
  });

  it("merce non conforme: NON conforme", () => {
    expect(esitoRicevimento({ conformity: false, packaging_ok: true }).conforme).toBe(false);
  });

  it("entrambe le cose: le nomina tutte e due", () => {
    const e = esitoRicevimento({ conformity: false, packaging_ok: false });
    expect(e.etichetta).toBe("prodotto non conforme, imballaggio non integro");
  });

  // ⚠️ Il verso opposto della stessa contraddizione, e il motivo per cui
  // questa prova esiste: la temperatura il database la REGISTRA ma non la
  // usa per aprire niente. Se il verdetto la considerasse, il manuale
  // direbbe «non conforme» su consegne senza nessuna non conformità —
  // la stessa contraddizione girata.
  it("una temperatura alta da sola NON rende non conforme", () => {
    expect(esitoRicevimento({ conformity: true, packaging_ok: true, temperature_c: 12 }).conforme).toBe(true);
  });

  // Un dato vecchio con le colonne a null non deve produrre una non
  // conformità inventata: su un registro sanitario è un difetto quanto
  // una taciuta.
  it("colonne mancanti: non si inventa una non conformità", () => {
    expect(esitoRicevimento({}).conforme).toBe(true);
    expect(esitoRicevimento(null).conforme).toBe(true);
    expect(esitoRicevimento({ conformity: null, packaging_ok: null }).conforme).toBe(true);
  });
});
