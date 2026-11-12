import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 12/11/2026 — la CLI di Supabase in modalita' agente pretende `--yes` per
// cambiare un progetto ospitato. Lo script lo passa, ma SOLO dopo `--conferma`:
// senza conferma deve restare in sola lettura e non arrivare mai al deploy.
const script = readFileSync("scripts/funzione.mjs", "utf8").replace(/\r\n/g, "\n");

describe("scripts/funzione.mjs: il consenso alla CLI", () => {
  it("passa --yes al deploy solo quando c'e' --conferma", () => {
    expect(script).toMatch(/if \(conferma\) argomenti\.push\("--yes"\);/);
  });

  it("senza --conferma esce prima di costruire il comando di deploy", () => {
    const uscita = script.indexOf("if (!conferma) {");
    const deploy = script.indexOf('"functions", "deploy"');
    expect(uscita).toBeGreaterThan(-1);
    expect(deploy).toBeGreaterThan(uscita);
    expect(script.slice(uscita, deploy)).toMatch(/process\.exit\(0\)/);
  });

  it("--yes non e' mai fisso negli argomenti di base", () => {
    expect(script).not.toMatch(/\["supabase", "functions", "deploy"[^\]]*"--yes"/);
  });
});
