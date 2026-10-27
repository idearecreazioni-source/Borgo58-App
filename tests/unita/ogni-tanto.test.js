import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ogniTantoSeVisibile } from "../../src/lib/ogniTanto";

// Bar e Cucina rileggono ogni pochi secondi SOLO se la pagina si vede, e
// rileggono subito quando torna visibile (27/10/2026).

function documentoFinto(stato = "visible") {
  const ascolti = new Set();
  return {
    visibilityState: stato,
    addEventListener: (nome, fn) => nome === "visibilitychange" && ascolti.add(fn),
    removeEventListener: (nome, fn) => ascolti.delete(fn),
    cambia(nuovo) {
      this.visibilityState = nuovo;
      for (const fn of ascolti) fn();
    },
    ascolti,
  };
}

describe("ogniTantoSeVisibile", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("rilegge a ogni giro mentre la pagina si vede", () => {
    const leggi = vi.fn();
    const smetti = ogniTantoSeVisibile(leggi, 10000, documentoFinto());
    vi.advanceTimersByTime(30000);
    expect(leggi).toHaveBeenCalledTimes(3);
    smetti();
  });

  it("🔴 con la pagina nascosta non rilegge, e al ritorno rilegge subito", () => {
    const doc = documentoFinto("hidden");
    const leggi = vi.fn();
    const smetti = ogniTantoSeVisibile(leggi, 10000, doc);
    vi.advanceTimersByTime(60000);
    expect(leggi).not.toHaveBeenCalled();
    doc.cambia("visible");
    expect(leggi).toHaveBeenCalledTimes(1);
    smetti();
  });

  it("smettendo, niente più giri e niente più ascolti", () => {
    const doc = documentoFinto();
    const leggi = vi.fn();
    const smetti = ogniTantoSeVisibile(leggi, 10000, doc);
    smetti();
    vi.advanceTimersByTime(30000);
    doc.cambia("visible");
    expect(leggi).not.toHaveBeenCalled();
    expect(doc.ascolti.size).toBe(0);
  });
});
