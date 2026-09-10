import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MINUTI_DI_SCADENZA,
  chiLoTiene,
  frasePerChiAspetta,
  lascia,
  prendi,
  processoVivo,
} from "../../scripts/un-giro-per-volta.mjs";

// =====================================================================
// DUE GIRI DI PROVE NON SI PESTANO I PIEDI — 10/09/2026
// =====================================================================
// 🔴 Non è una precauzione: è un incidente già successo. Il 27/08 un giro
//    lanciato mentre un altro girava ha prodotto 41 file falliti e 223
//    prove saltate — un disastro apparente del codice, verde al rilancio.

const casette = [];
function dovePosso() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "b58-lucchetto-"));
  casette.push(d);
  return path.join(d, "prove.lock");
}

afterEach(() => {
  while (casette.length) fs.rmSync(casette.pop(), { recursive: true, force: true });
});

describe("il lucchetto di un giro di prove", () => {
  it("il primo lo prende, il secondo no", () => {
    const dove = dovePosso();
    const ora = Date.now();
    expect(prendi(process.pid, ora, dove).preso).toBe(true);
    const secondo = prendi(process.pid, ora, dove);
    expect(secondo.preso).toBe(false);
    expect(secondo.altrui.pid).toBe(process.pid);
  });

  it("🔴 e chi aspetta legge PERCHÉ, non solo che non può", () => {
    // Un rifiuto che non spiega manda a cercare un difetto che non c'è.
    const dove = dovePosso();
    prendi(4242, Date.now() - 3 * 60_000, dove);
    const frase = frasePerChiAspetta(chiLoTiene(Date.now(), dove) ?? { pid: 4242, minuti: 3 });
    expect(frase).toMatch(/gia' un giro di prove in corso/i);
    expect(frase).toMatch(/database di prova e' uno solo/i);
    expect(frase).toMatch(/27\/08/);
  });

  it("🔴 un lucchetto SCADUTO non blocca per sempre", () => {
    // Un giro ucciso a metà lascerebbe il file lì, e da domani nessuno
    // potrebbe più lanciare le prove.
    const dove = dovePosso();
    const vecchio = Date.now() - (MINUTI_DI_SCADENZA + 1) * 60_000;
    prendi(process.pid, vecchio, dove);
    expect(chiLoTiene(Date.now(), dove)).toBeNull();
    expect(prendi(process.pid, Date.now(), dove).preso).toBe(true);
  });

  it("🔴 e nemmeno un lucchetto di un processo che non c'è più", () => {
    // Succede a ogni Ctrl+C: senza questo, il primo giro interrotto
    // bloccherebbe tutti gli altri fino alla scadenza.
    const dove = dovePosso();
    const morto = 999_999_999;
    expect(processoVivo(morto)).toBe(false);
    fs.writeFileSync(dove, JSON.stringify({ pid: morto, quando: Date.now() }), "utf8");
    expect(chiLoTiene(Date.now(), dove)).toBeNull();
  });

  it("un lucchetto illeggibile è un lucchetto abbandonato", () => {
    // Non si eredita un divieto da un file che non si riesce a leggere.
    const dove = dovePosso();
    fs.writeFileSync(dove, "non sono json", "utf8");
    expect(chiLoTiene(Date.now(), dove)).toBeNull();
  });

  it("si lascia solo il proprio, mai quello di un altro", () => {
    const dove = dovePosso();
    prendi(4242, Date.now(), dove);
    expect(lascia(process.pid, dove)).toBe(false);
    expect(fs.existsSync(dove)).toBe(true);
    expect(lascia(4242, dove)).toBe(true);
    expect(fs.existsSync(dove)).toBe(false);
  });

  it("⚠️ la scadenza è più lunga del tetto di un giro", () => {
    // Altrimenti un giro lento si vedrebbe rubare il posto da se stesso.
    expect(MINUTI_DI_SCADENZA).toBeGreaterThan(40);
  });
});
