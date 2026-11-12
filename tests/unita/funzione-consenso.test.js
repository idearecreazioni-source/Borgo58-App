import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 12/11/2026 — la CLI di Supabase in modalita' agente pretende `--yes` per
// cambiare un progetto ospitato. Gli script lo passano, ma SOLO dopo
// `--conferma`: senza conferma restano in sola lettura e non arrivano mai
// al deploy.
const leggi = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const quante = (testo, cosa) => testo.split(cosa).length - 1;

describe("scripts/funzione.mjs: il consenso alla CLI", () => {
  const script = leggi("scripts/funzione.mjs");

  it("c'e' un solo --yes, ed e' dentro `if (conferma)`", () => {
    expect(quante(script, '"--yes"')).toBe(1);
    expect(script).toMatch(/if \(conferma\) argomenti\.push\("--yes"\);/);
  });

  it("senza --conferma esce prima di costruire il comando di deploy", () => {
    const uscita = script.indexOf("if (!conferma) {");
    const deploy = script.indexOf('"functions", "deploy"');
    expect(uscita).toBeGreaterThan(-1);
    expect(deploy).toBeGreaterThan(uscita);
    expect(script.slice(uscita, deploy)).toMatch(/process\.exit\(0\)/);
  });
});

describe("scripts/funzioni-allinea.mjs: il consenso alla CLI", () => {
  const script = leggi("scripts/funzioni-allinea.mjs");

  it("un solo --yes, nel deploy su Prova, dopo l'uscita in sola lettura", () => {
    expect(quante(script, '"--yes"')).toBe(1);
    const uscita = script.indexOf("if (!letti.conferma) {");
    const yes = script.indexOf('"--yes"');
    expect(uscita).toBeGreaterThan(-1);
    expect(yes).toBeGreaterThan(uscita);
    expect(script.slice(script.lastIndexOf("[", yes), yes)).toMatch(/"deploy", e\.nome, "--project-ref", REF_PROVA/);
  });
});
