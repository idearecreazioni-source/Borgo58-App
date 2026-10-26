import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REF_PRODUZIONE, REF_PROVA } from "../../scripts/comune.mjs";

// =====================================================================
// LE INTESTAZIONI DI SICUREZZA — 26/10/2026
// =====================================================================
// `public/_headers` dice al browser da dove il gestionale può caricare e a
// chi può parlare. Se un giorno il progetto Supabase cambia e questa riga
// no, il gestionale non riesce più a parlare col database: queste prove lo
// fanno vedere qui, prima che sul sito.

const righe = readFileSync("public/_headers", "utf8")
  .split(/\r?\n/)
  .filter((r) => r.trim() && !r.trim().startsWith("#"));

const valore = (nome) => {
  const riga = righe.find((r) => r.trim().toLowerCase().startsWith(nome.toLowerCase() + ":"));
  return riga ? riga.slice(riga.indexOf(":") + 1).trim() : null;
};

const csp = valore("Content-Security-Policy") ?? "";
const direttiva = (nome) =>
  csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(nome + " "))
    ?.split(/\s+/)
    .slice(1) ?? null;

describe("public/_headers", () => {
  it("vale per tutto il sito: una regola sola, su /*", () => {
    expect(righe[0]).toBe("/*");
  });

  it("🔴 il gestionale parla col progetto vero e con quello di prova, e con nessun altro Supabase", () => {
    const connect = direttiva("connect-src");
    expect(connect).toContain(`https://${REF_PRODUZIONE}.supabase.co`);
    expect(connect).toContain(`https://${REF_PROVA}.supabase.co`);
    expect(connect.filter((s) => s.includes("*"))).toEqual([]);
  });

  it("🔴 nessuno script scritto nella pagina e nessuno da fuori", () => {
    expect(direttiva("script-src")).toEqual(["'self'"]);
  });

  it("🔴 nessun altro sito può incorniciare il gestionale", () => {
    expect(direttiva("frame-ancestors")).toEqual(["'none'"]);
    expect(valore("X-Frame-Options")).toBe("DENY");
  });

  it("le altre intestazioni ci sono", () => {
    expect(valore("X-Content-Type-Options")).toBe("nosniff");
    expect(valore("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(valore("Permissions-Policy")).toContain("microphone=(self)");
  });

  it("index.html non contiene script scritti dentro la pagina, che la CSP bloccherebbe", () => {
    const html = readFileSync("index.html", "utf8");
    const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
    expect(script.length).toBeGreaterThan(0);
    for (const [intero, corpo] of script) {
      expect(corpo.trim(), intero).toBe("");
      expect(intero).toMatch(/\bsrc=/);
    }
  });
});
