import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TASK_LUOGHI } from "../../src/lib/constants";
import { campiImpegno } from "../../src/lib/calcoli/agenda";
import { datiInChiaro } from "../../src/lib/calcoli/appunti";
import {
  LUOGHI,
  RIGHE_MASSIME,
  testoNotifica,
} from "../../supabase/functions/promemoria-luogo/testo";

// I PROMEMORIA PER LUOGO — 28/10/2026, chiesto da Alessio: «quando arrivo a
// casa ricordami di pesare la mamma».

const leggi = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const MIGRAZIONE = "supabase/migrations/20261028000001_un_promemoria_aspetta_che_arrivo_a_casa.sql";

describe("il testo della notifica", () => {
  it("🔴 niente da fare = testo vuoto, cioè nessuna notifica (scelta di Alessio)", () => {
    expect(testoNotifica("casa", [], 0)).toBe("");
  });

  it("una cosa sola, al singolare", () => {
    expect(testoNotifica("casa", [{ titolo: "Pesare la mamma" }], 1)).toBe(
      "Casa: 1 cosa da fare\n• Pesare la mamma",
    );
  });

  it("oltre le prime otto dice quante altre, invece di tagliare in silenzio", () => {
    const tante = Array.from({ length: 12 }, (_, i) => ({ titolo: `cosa ${i + 1}` }));
    const righe = testoNotifica("ristorante", tante, 15).split("\n");
    expect(righe[0]).toBe("Ristorante: 15 cose da fare");
    expect(righe).toHaveLength(1 + RIGHE_MASSIME + 1);
    expect(righe.at(-1)).toBe("…e altre 7");
  });

  it("un titolo lungo si accorcia con i puntini", () => {
    const [, riga] = testoNotifica("casa", [{ titolo: "x".repeat(200) }], 1).split("\n");
    expect(riga.length).toBeLessThanOrEqual(62);
    expect(riga.endsWith("…")).toBe(true);
  });
});

describe("i luoghi sono lo stesso elenco ovunque", () => {
  const valori = TASK_LUOGHI.map((l) => l.value).sort();

  it("la funzione online conosce gli stessi luoghi della schermata", () => {
    expect(Object.keys(LUOGHI).sort()).toEqual(valori);
  });

  it("il vincolo del database ammette gli stessi luoghi", () => {
    const vincolo = leggi(MIGRAZIONE).match(/luogo in \(([^)]*)\)/)[1];
    expect(vincolo.match(/'([a-z]+)'/g).map((v) => v.slice(1, -1)).sort()).toEqual(valori);
  });

  it("le due istruzioni della voce chiedono il luogo con gli stessi valori", () => {
    for (const f of ["supabase/functions/ascolta-voce/index.ts", "supabase/functions/ascolta-voce/agenda.ts"]) {
      expect(leggi(f)).toContain(`"luogo": ${valori.map((v) => `"${v}"`).join("|")}|null`);
    }
  });

  it("la funzione online è installata senza verifica del token, con la ragione scritta", () => {
    expect(leggi("scripts/funzione.mjs")).toMatch(/"promemoria-luogo":\s*\n\s*"la chiama l'automazione/);
  });
});

describe("come si legge un promemoria per luogo", () => {
  it("in Agenda il quadrotto dice dove", () => {
    const campo = campiImpegno({ luogo: "casa", due_date: null, giorni_in_lista: 1 }).find((c) => c.chiave === "luogo");
    expect(campo).toMatchObject({ etichetta: "Quando arrivo", valore: "Casa" });
    expect(campiImpegno({ due_date: null, giorni_in_lista: 1 }).some((c) => c.chiave === "luogo")).toBe(false);
  });

  it("sull'appunto da approvare il luogo si legge in italiano", () => {
    expect(datiInChiaro({ titolo: "Pesare la mamma", luogo: "casa" })).toContain(
      "ricordamelo quando arrivo a: casa",
    );
  });
});
