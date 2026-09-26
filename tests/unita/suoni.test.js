import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// ⚠️ IL MODULO SI RICARICA A OGNI PROVA, e non e una raffinatezza: il
//    contesto audio e uno solo per pagina — aprirne uno per ogni suono
//    esaurisce una risorsa che il browser conta. Quello stato vive nel
//    modulo, quindi due prove nello stesso modulo si passerebbero il
//    contesto e la penultima renderebbe verde l ultima senza provarla.
let suoni;
async function ricarica() {
  vi.resetModules();
  suoni = await import("../../src/lib/suoni");
}

// =====================================================================
// I DUE SUONI DI MEMO, PROVATI AL CONTRARIO
// =====================================================================
// 10/09/2026, Blocco 5 del mandato notturno.
//
// 🔴 QUELLO CHE QUESTE PROVE SORVEGLIANO NON È CHE IL SUONO ESCA — quello
//    lo sente un orecchio, e nessuna prova di questo progetto ha orecchie.
//    È che **non esca quando non deve**: se il microfono non si apre, un
//    suono direbbe «sto registrando» a chi sta per parlare a vuoto.

/** Un finto contesto audio che conta cosa gli si chiede di suonare. */
function finto() {
  const suonati = [];
  const nodo = () => ({ connect: (d) => d });
  return {
    suonati,
    contesto: {
      state: "running",
      currentTime: 0,
      resume: vi.fn(),
      createOscillator: () => {
        const o = {
          type: "",
          frequency: {
            setValueAtTime: (v) => suonati.push({ da: v }),
            exponentialRampToValueAtTime: (v) => {
              if (suonati.length) suonati[suonati.length - 1].a = v;
            },
          },
          connect: () => ({ connect: () => {} }),
          start: () => {},
          stop: () => {},
        };
        return o;
      },
      createGain: () => ({
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        ...nodo(),
      }),
      destination: {},
    },
  };
}

let magazzino;

beforeEach(async () => {
  await ricarica();
  magazzino = {};
  vi.stubGlobal("localStorage", {
    getItem: (k) => magazzino[k] ?? null,
    setItem: (k, v) => {
      magazzino[k] = v;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("la preferenza dei suoni", () => {
  it("🔴 nasce ACCESA, ed è una scelta", () => {
    // Il suono esiste per dire una cosa che senza di lui non si sa — il
    // microfono è aperto davvero — e una funzione che nasce spenta non la
    // scopre nessuno.
    expect(suoni.suoniAccesi()).toBe(true);
  });

  it("si spegne, e resta spenta", () => {
    suoni.accendiSuoni(false);
    expect(suoni.suoniAccesi()).toBe(false);
    suoni.accendiSuoni(true);
    expect(suoni.suoniAccesi()).toBe(true);
  });

  it("⚠️ e in una finestra dove non si può ricordare niente, non si rompe", () => {
    // In una finestra anonima, o coi dati dei siti bloccati, `localStorage`
    // non risponde vuoto: solleva. Una schermata che non si apre per una
    // preferenza è peggio di una preferenza dimenticata.
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloccato");
      },
      setItem: () => {
        throw new Error("bloccato");
      },
    });
    expect(() => suoni.suoniAccesi()).not.toThrow();
    expect(suoni.suoniAccesi()).toBe(true);
    expect(() => suoni.accendiSuoni(false)).not.toThrow();
  });
});

describe("i due suoni", () => {
  it("🔴 sono DIVERSI: uno sale, l'altro scende", () => {
    // Aperto e chiuso sono due fatti opposti: lo stesso «bip» due volte non
    // dice quale dei due è appena successo, e chi detta non sta guardando
    // lo schermo.
    const f = finto();
    vi.stubGlobal("AudioContext", function () {
      return f.contesto;
    });
    suoni.preparaSuoni();
    suoni.suonoMicrofonoAperto();
    suoni.suonoMicrofonoChiuso();
    expect(f.suonati).toHaveLength(2);
    expect(f.suonati[0].a).toBeGreaterThan(f.suonati[0].da);
    expect(f.suonati[1].a).toBeLessThan(f.suonati[1].da);
  });

  it("🔴 con la preferenza spenta non esce niente", () => {
    const f = finto();
    vi.stubGlobal("AudioContext", function () {
      return f.contesto;
    });
    suoni.preparaSuoni();
    suoni.accendiSuoni(false);
    suoni.suonoMicrofonoAperto();
    suoni.suonoMicrofonoChiuso();
    expect(f.suonati).toHaveLength(0);
  });

  it("⚠️ e senza audio nel browser non si rompe niente", () => {
    // Un suono che non esce non deve fermare una dettatura.
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    expect(() => suoni.preparaSuoni()).not.toThrow();
    expect(() => suoni.suonoMicrofonoAperto()).not.toThrow();
  });

  it("🔴 e senza aver preparato l'audio non suona: non c'è niente da suonare", () => {
    // `suoni.preparaSuoni()` vive dentro il tocco che accende il microfono,
    // perché i browser aprono l'audio solo dentro un gesto di chi guarda.
    // Se un suono partisse senza, sul telefono resterebbe muto — e a
    // schermo non si vedrebbe niente.
    const f = finto();
    vi.stubGlobal("AudioContext", function () {
      return f.contesto;
    });
    suoni.suonoMicrofonoAperto();
    expect(f.suonati).toHaveLength(0);
  });
});
