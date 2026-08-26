import { describe, expect, it } from "vitest";
import { statoDettatura } from "../../src/lib/calcoli/voce";

// 🔴 IL DIFETTO CHE QUESTE PROVE CONGELANO, visto da Alessio sull'iPhone il
// 27/08/2026 alle 00:29: la schermata diceva «Su iPhone serve Safari» mentre
// lui era su Safari. Aveva aperto dall'icona della schermata Home, e da lì il
// riconoscimento vocale non c'è — la diagnosi era falsa e il consiglio era un
// vicolo cieco.
//
// ⚠️ Le tre risposte devono essere DIVERSE FRA LORO: se due casi dicessero la
// stessa cosa, la distinzione esisterebbe nel codice e non per chi legge.
const conIcona = (capacita) => ({
  SpeechRecognition: capacita ? function () {} : undefined,
  navigator: { standalone: true },
  matchMedia: () => ({ matches: true }),
});

const nelBrowser = (capacita) => ({
  SpeechRecognition: capacita ? function () {} : undefined,
  navigator: {},
  matchMedia: () => ({ matches: false }),
});

describe("perché il microfono non c'è: tre casi, tre frasi", () => {
  it("Safari normale col microfono: non si dice niente", () => {
    const s = statoDettatura(nelBrowser(true));
    expect(s.caso).toBe("c_e");
    expect(s.frase).toBeNull();
  });

  it("pagina aperta dall'icona: dice CHE È L'ICONA, non che il browser è sbagliato", () => {
    const s = statoDettatura(conIcona(false));
    expect(s.caso).toBe("da_icona");
    expect(s.frase).toMatch(/icona/i);
    // 🔴 Il difetto vero: non deve accusare il browser.
    expect(s.frase).not.toMatch(/browser/i);
    expect(s.cosaFare).toMatch(/nel browser/i);
  });

  it("browser che davvero non sa trascrivere: dice quello", () => {
    const s = statoDettatura(nelBrowser(false));
    expect(s.caso).toBe("browser");
    expect(s.frase).toMatch(/non sa trascrivere/i);
    expect(s.cosaFare).toMatch(/Safari/);
  });

  it("le tre frasi sono diverse fra loro", () => {
    const frasi = [conIcona(false), nelBrowser(false)].map((f) => statoDettatura(f).frase);
    expect(new Set(frasi).size).toBe(2);
  });

  it("in tutti e due i casi senza microfono si dice che la Scorciatoia funziona lo stesso", () => {
    // ⚠️ È la parte che toglie l'ansia: chi legge «non sa trascrivere la voce»
    // smette di provare anche la strada che funziona.
    for (const f of [conIcona(false), nelBrowser(false)]) {
      expect(statoDettatura(f).cosaFare).toMatch(/Scorciatoia/);
    }
  });

  it("una pagina installata CHE HA il microfono non finisce fra i casi da spiegare", () => {
    // Android installata: la capacità c'è, quindi «da icona» non deve scattare.
    expect(statoDettatura(conIcona(true)).caso).toBe("c_e");
  });

  it("nessuna frase deduce il sistema operativo dal nome", () => {
    // ⚠️ Il difetto di oggi nasce dall'aver dedotto invece di guardare: la
    // regola non deve nominare iPhone né iOS in nessun ramo.
    for (const f of [conIcona(false), nelBrowser(false), nelBrowser(true)]) {
      const s = statoDettatura(f);
      expect(`${s.frase ?? ""} ${s.cosaFare ?? ""}`).not.toMatch(/iphone|ios|ipad/i);
    }
  });
});
