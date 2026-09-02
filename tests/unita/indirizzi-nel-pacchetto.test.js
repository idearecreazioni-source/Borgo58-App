import { existsSync, rmSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { build } from "vite";
import {
  INDIRIZZI_PREDEFINITI,
  problemaDegliIndirizzi,
} from "../../scripts/indirizzi-accesso.mjs";

// 🔴 CHE COSTRUZIONE E VALIDAZIONE USINO LA STESSA SORGENTE — 02/09/2026.
//
// ⚠️ NON una prova strutturale sul testo di `vite.config.js`: la forma non è
// il comportamento. Qui si **compila davvero**, tre volte, e si legge cosa è
// finito nel pacchetto.
//
// Il difetto che questo disegno chiude era proprio una doppia lettura:
// `vite.config.js` gira in Node e vede `process.env`, l'app vede
// `import.meta.env`. Due letture che *dovrebbero* coincidere — e
// «dovrebbero» è la parola che questo progetto insegue da settimane.
//
// ⚠️ LA PROVA (b) È QUELLA CHE DISCRIMINA. Senza di lei, una costruzione che
// ignorasse del tutto le variabili e scrivesse sempre i predefiniti
// passerebbe la (a) tutte le volte in cui il valore configurato coincide col
// predefinito — cioè quasi sempre.

const CARTELLE = ["dist-prova-a", "dist-prova-b", "dist-prova-c"];

afterAll(() => {
  // I dati di prova si cancellano subito dopo la prova, anche quando sono
  // cartelle. E si cancella **solo ciò che ha creato questa prova**.
  for (const c of CARTELLE) rmSync(c, { recursive: true, force: true });
});

// Compila con l'ambiente dato, e rimette `process.env` **com'era**.
// ⚠️ Si salva e si riscrive il valore intero, compreso «non c'era»: mettere
//    una stringa vuota al posto di un'assenza non è rimettere a posto.
async function compilaCon(variabili, outDir) {
  const prima = new Map();
  for (const [nome, valore] of Object.entries(variabili)) {
    prima.set(nome, process.env[nome]);
    if (valore === undefined) delete process.env[nome];
    else process.env[nome] = valore;
  }
  try {
    await build({ build: { outDir }, logLevel: "silent" });
  } finally {
    for (const [nome, valore] of prima) {
      if (valore === undefined) delete process.env[nome];
      else process.env[nome] = valore;
    }
  }
}

const NESSUNA = { VITE_EMAIL_TITOLARE: undefined, VITE_EMAIL_STAFF: undefined };

describe("il pacchetto compilato porta dentro gli indirizzi decisi", () => {
  it("(a) senza variabili, nel pacchetto ci sono i due indirizzi di oggi", async () => {
    await compilaCon(NESSUNA, "dist-prova-a");
    // 🔴 È anche la misura che mancava al disegno: che il marcatore
    //    SOPRAVVIVA ALLA MINIFICAZIONE non era mai stato verificato. Se non
    //    sopravvivesse, il controllo direbbe «marcatore assente» e
    //    fermerebbe: fallisce chiuso anche sbagliando.
    expect(problemaDegliIndirizzi("dist-prova-a", INDIRIZZI_PREDEFINITI)).toBeNull();
  }, 120_000);

  it("(b) con indirizzi diversi, il pacchetto cambia di conseguenza", async () => {
    const configurati = { titolare: "capo@prova.it", staff: "sala@prova.it" };
    await compilaCon(
      { VITE_EMAIL_TITOLARE: configurati.titolare, VITE_EMAIL_STAFF: configurati.staff },
      "dist-prova-b",
    );

    // I nuovi ci sono…
    expect(problemaDegliIndirizzi("dist-prova-b", configurati)).toBeNull();

    // …e i vecchi NON ci sono più. ⚠️ Senza questa seconda metà, una
    // costruzione che scrivesse **tutti e due** i marcatori passerebbe.
    expect(problemaDegliIndirizzi("dist-prova-b", INDIRIZZI_PREDEFINITI)).not.toBeNull();
  }, 120_000);

  it("(c) con un indirizzo storto la costruzione FALLISCE, e il pacchetto non nasce", async () => {
    // ⚠️ È il punto di tutto il disegno: il rifiuto avviene **a tempo di
    //    costruzione**. A tempo di esecuzione vorrebbe dire scoprirlo davanti
    //    alla schermata di accesso, cioè **chiusi fuori dal gestionale**.
    await expect(
      compilaCon({ VITE_EMAIL_TITOLARE: "a|b@x.it" }, "dist-prova-c"),
    ).rejects.toThrow(/VITE_EMAIL_TITOLARE/);

    expect(existsSync("dist-prova-c")).toBe(false);
  }, 120_000);
});
