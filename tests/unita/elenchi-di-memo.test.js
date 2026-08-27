import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// GLI ELENCHI DI MEMO NON TORNANO SCRITTI A MANO NEI PROMPT
// ============================================================================
//
// 🔴 PERCHE' QUESTA RETE ESISTE. Fino al 27/08/2026 le categorie dei prodotti
// stavano scritte a mano in **quattro posti dentro le funzioni online**, oltre
// al database:
//   1. `leggi-foto`   — nel prompt
//   2. `ascolta-voce` — nel prompt
//   3. `posta-leggi`  — nel prompt
//   4. `posta-leggi`  — in un insieme che VALIDAVA, sostituendo con «altro»
//
// Il quarto era il peggiore: gli altri tre *propongono*, quello
// **sostituiva** — e da quando Alessio puo' aggiungere una categoria mentre
// inserisce un prodotto, avrebbe scambiato con «altro» una categoria nuova
// letta correttamente su una fattura, senza nessun errore.
//
// ⚠️ RIMETTERLI NON DAREBBE NESSUN SEGNALE: il gestionale funzionerebbe, e
// MEMO proporrebbe le categorie di ieri. E' il caso silenzioso, quello per
// cui una rete serve piu' che per gli altri.
//
// ⚠️ LA RETE GUARDA IL TESTO DEI FILE, e il limite e' dichiarato: riconosce
// gli elenchi scritti nella forma che c'era (i codici uno dopo l'altro).
// Qualcuno potrebbe riscriverli in un'altra forma e passare. Copre la
// ricaduta piu' probabile — ricopiare l'elenco da un'altra funzione — che e'
// esattamente come i quattro posti erano nati.

const CARTELLA = "supabase/functions";

// Tre codici che stanno SEMPRE insieme in un elenco di categorie, e mai
// insieme in una frase italiana: se compaiono tutti e tre nella stessa riga,
// quella riga e' un elenco di categorie.
const SPIA = ["crostacei_molluschi", "farine_cereali", "olio_condimenti"];

function righeConUnElenco(testo) {
  return testo
    .split(/\r?\n/)
    .map((riga, i) => ({ riga, numero: i + 1 }))
    .filter(({ riga }) => SPIA.every((c) => riga.includes(c)));
}

describe("gli elenchi di MEMO si chiedono al database, non si scrivono nei prompt", () => {
  const funzioni = readdirSync(CARTELLA, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  it("nessuna funzione online contiene un elenco di categorie scritto a mano", () => {
    const colpevoli = [];
    for (const nome of funzioni) {
      let testo;
      try {
        testo = readFileSync(join(CARTELLA, nome, "index.ts"), "utf8");
      } catch {
        continue;
      }
      for (const { numero } of righeConUnElenco(testo)) {
        colpevoli.push(`${nome}/index.ts:${numero}`);
      }
    }
    expect(
      colpevoli,
      "le categorie sono tornate scritte a mano dentro una funzione online: " +
        "si chiedono con vocabolari_per_assistente(), e MEMO le riceve dal database.\n  " +
        colpevoli.join("\n  ")
    ).toEqual([]);
  });

  it("...e c'e' almeno una funzione che li CHIEDE, altrimenti la rete passerebbe su un gestionale muto", () => {
    // ⚠️ La controprova del verso opposto: una rete che pretende «nessun
    // elenco scritto» passerebbe anche se nessuno chiedesse gli elenchi al
    // database — cioe' se MEMO fosse rimasto senza. Qui si pretende che la
    // strada nuova esista davvero.
    const chiedono = funzioni.filter((nome) => {
      try {
        return readFileSync(join(CARTELLA, nome, "index.ts"), "utf8").includes(
          "vocabolari_per_assistente"
        );
      } catch {
        return false;
      }
    });
    expect(chiedono.length, "nessuna funzione online chiede gli elenchi al database").toBeGreaterThan(1);
  });

  it("la spia riconosce un elenco quando c'e' — e tace quando non c'e'", () => {
    // ⚠️ Un misuratore nuovo si prova su un caso di cui si conosce gia' la
    // risposta (regola del 26/08): qui i due casi sono costruiti.
    const conElenco =
      '  "categoria": una di: verdura, frutta, crostacei_molluschi, farine_cereali, olio_condimenti, altro,';
    expect(righeConUnElenco(conElenco)).toHaveLength(1);

    // Una frase che nomina UNA categoria non e' un elenco.
    expect(righeConUnElenco("- conservazione: dispensa per olio_condimenti")).toHaveLength(0);
    expect(righeConUnElenco("niente elenchi qui")).toHaveLength(0);
  });
});
