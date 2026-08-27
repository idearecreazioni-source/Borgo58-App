import { describe, expect, it } from "vitest";
import { inContestoSicuro, statoDettatura, unaVoltaSola } from "../../src/lib/calcoli/voce";

// 🔴 IL DIFETTO CHE QUESTE PROVE CONGELANO, visto da Alessio sull'iPhone il
// 27/08/2026 alle 00:29: la schermata diceva «Su iPhone serve Safari» mentre
// lui era su Safari. La prima correzione dava la colpa all'icona della
// schermata Home — e anche quella era sbagliata.
//
// ✅ LA CAUSA VERA, misurata con le sue mani la stessa notte: stesso iPhone,
// stesso Safari, su `http://…:5173` il microfono non parte, su
// `https://….ts.net` detta. Cambia solo il protocollo. Il microfono lo dà
// solo un CONTESTO SICURO, e `localhost` è l'eccezione che ha tenuto nascosta
// la cosa finché si provava dal computer.
//
// ⚠️ Le frasi devono essere DIVERSE FRA LORO: se due casi dicessero la stessa
// cosa, la distinzione esisterebbe nel codice e non per chi legge.

const conIcona = (capacita) => ({
  SpeechRecognition: capacita ? function () {} : undefined,
  navigator: { standalone: true },
  matchMedia: () => ({ matches: true }),
  isSecureContext: true,
});

const nelBrowser = (capacita) => ({
  SpeechRecognition: capacita ? function () {} : undefined,
  navigator: {},
  matchMedia: () => ({ matches: false }),
  isSecureContext: true,
});

// Il caso di Alessio: Safari vero, indirizzo in chiaro sulla rete di casa.
const inChiaro = (extra = {}) => ({
  SpeechRecognition: undefined,
  navigator: {},
  matchMedia: () => ({ matches: false }),
  isSecureContext: false,
  location: { protocol: "http:", hostname: "192.168.1.42" },
  ...extra,
});

describe("perché il microfono non c'è: quattro casi, quattro frasi", () => {
  it("Safari normale col microfono: non si dice niente", () => {
    const s = statoDettatura(nelBrowser(true));
    expect(s.caso).toBe("c_e");
    expect(s.frase).toBeNull();
  });

  it("indirizzo in chiaro: dice CHE È L'INDIRIZZO, e manda a quello protetto", () => {
    const s = statoDettatura(inChiaro());
    expect(s.caso).toBe("non_cifrato");
    expect(s.frase).toMatch(/non protetto/i);
    // 🔴 I due difetti già fatti: non deve accusare il browser né l'icona.
    expect(s.frase).not.toMatch(/browser non sa/i);
    expect(s.frase).not.toMatch(/icona/i);
    expect(s.cosaFare).toMatch(/https/);
  });

  it("pagina aperta dall'icona (ma su indirizzo protetto): dice CHE È L'ICONA", () => {
    const s = statoDettatura(conIcona(false));
    expect(s.caso).toBe("da_icona");
    expect(s.frase).toMatch(/icona/i);
    expect(s.frase).not.toMatch(/browser/i);
    expect(s.cosaFare).toMatch(/nel browser/i);
  });

  it("browser che davvero non sa trascrivere: dice quello", () => {
    const s = statoDettatura(nelBrowser(false));
    expect(s.caso).toBe("browser");
    expect(s.frase).toMatch(/non sa trascrivere/i);
    expect(s.cosaFare).toMatch(/Safari/);
  });

  // 🔴 L'ORDINE È LA PARTE CHE SI PUÒ SBAGLIARE IN SILENZIO. Da icona E in
  // chiaro insieme è precisamente la condizione in cui Alessio si trovava:
  // se vincesse «da icona», il consiglio sarebbe «apri dal browser» — cioè
  // rifare lo stesso gesto con lo stesso esito.
  it("da icona E in chiaro insieme: comanda l'indirizzo, non l'icona", () => {
    const s = statoDettatura(
      inChiaro({ navigator: { standalone: true }, matchMedia: () => ({ matches: true }) }),
    );
    expect(s.caso).toBe("non_cifrato");
  });

  it("le tre frasi dei casi da spiegare sono diverse fra loro", () => {
    const frasi = [inChiaro(), conIcona(false), nelBrowser(false)].map(
      (f) => statoDettatura(f).frase,
    );
    expect(new Set(frasi).size).toBe(3);
  });

  it("in tutti i casi senza microfono si dice che la Scorciatoia funziona lo stesso", () => {
    // ⚠️ È la parte che toglie l'ansia: chi legge «non sa trascrivere la voce»
    // smette di provare anche la strada che funziona.
    for (const f of [inChiaro(), conIcona(false), nelBrowser(false)]) {
      expect(statoDettatura(f).cosaFare).toMatch(/Scorciatoia/);
    }
  });

  it("una pagina installata CHE HA il microfono non finisce fra i casi da spiegare", () => {
    // Android installata: la capacità c'è, quindi «da icona» non deve scattare.
    expect(statoDettatura(conIcona(true)).caso).toBe("c_e");
  });

  it("nessuna frase deduce il sistema operativo dal nome", () => {
    // ⚠️ Il difetto di quella notte nasce dall'aver dedotto invece di
    // guardare: la regola non deve nominare iPhone né iOS in nessun ramo.
    for (const f of [inChiaro(), conIcona(false), nelBrowser(false), nelBrowser(true)]) {
      const s = statoDettatura(f);
      expect(`${s.frase ?? ""} ${s.cosaFare ?? ""}`).not.toMatch(/iphone|ios|ipad/i);
    }
  });
});

// ⚠️ `localhost` è l'eccezione che ha tenuto il difetto nascosto per giorni:
// dal computer il microfono funzionava, e quindi «non funziona» sembrava un
// problema del telefono. Questa prova la congela.
describe("il contesto sicuro, e l'eccezione che nascondeva tutto", () => {
  it("crede a isSecureContext quando c'è", () => {
    expect(inContestoSicuro({ isSecureContext: true, location: { protocol: "http:" } })).toBe(true);
    expect(inContestoSicuro({ isSecureContext: false, location: { protocol: "https:" } })).toBe(false);
  });

  it("senza isSecureContext guarda il protocollo, e localhost resta sicuro", () => {
    expect(inContestoSicuro({ location: { protocol: "https:", hostname: "borgo58.it" } })).toBe(true);
    expect(inContestoSicuro({ location: { protocol: "http:", hostname: "localhost" } })).toBe(true);
    expect(inContestoSicuro({ location: { protocol: "http:", hostname: "127.0.0.1" } })).toBe(true);
    expect(inContestoSicuro({ location: { protocol: "http:", hostname: "192.168.1.42" } })).toBe(false);
  });
});

// =====================================================================
// IL DOPPIO INVIO — 27/08/2026
// =====================================================================
// 🔴 Alessio ha premuto «Sì, fallo» su un movimento di cassa, non ha visto
// succedere niente, e ha premuto di nuovo. Quella volta non ha scritto
// niente solo perché l'azione non esisteva ancora; col ramo costruito, lo
// stesso gesto scriverebbe **due uscite di cassa da trenta euro**.
//
// ⚠️ Un promemoria doppio si cancella; trenta euro registrati due volte si
// scoprono fra tre mesi, quando la cassa non torna.
describe("un gesto che tocca i soldi parte una volta sola", () => {
  it("il secondo tocco sulla stessa cosa non parte", () => {
    const g = unaVoltaSola();
    expect(g.prendi("a")).toBe(true);
    expect(g.prendi("a")).toBe(false);
    expect(g.prendi("a")).toBe(false);
  });

  it("dieci tocchi di fila producono un gesto solo", () => {
    const g = unaVoltaSola();
    const partiti = Array.from({ length: 10 }, () => g.prendi("cassa")).filter(Boolean);
    expect(partiti).toHaveLength(1);
  });

  it("due cose diverse non si bloccano fra loro", () => {
    const g = unaVoltaSola();
    expect(g.prendi("a")).toBe(true);
    expect(g.prendi("b")).toBe(true);
  });

  it("quando il primo è finito si può rifare", () => {
    // ⚠️ Serve: se la conferma fallisce davvero (rete caduta), il gesto
    //    deve poter essere rifatto — altrimenti la guardia diventa un
    //    vicolo cieco, che in questo progetto è un difetto a sé.
    const g = unaVoltaSola();
    g.prendi("a");
    g.lascia("a");
    expect(g.prendi("a")).toBe(true);
  });
});
