import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  CHIAVE_DELLA_PROVA,
  MESSAGGIO_DI_PROVA,
  REF_PROVA,
  chiaveGiusta,
  eseguiLaProva,
  siamoSuProva,
} from "../../supabase/functions/telegram-prova-test/prova";

// La memoria delle consegne, com'e' fatta la vera: la presa e' una scrittura
// con chiave primaria, quindi «manda» esce una volta sola per chiave.
function memoria() {
  const righe = new Map();
  return {
    righe,
    prendi: async (c) => {
      if (!righe.has(c)) {
        righe.set(c, "presa");
        return "manda";
      }
      return righe.get(c) === "consegnata" ? "gia_consegnata" : "in_corso";
    },
    conferma: async (c) => void righe.set(c, "consegnata"),
    rilascia: async (c) => void (righe.get(c) === "presa" && righe.delete(c)),
  };
}

const URL_PROVA = `https://${REF_PROVA}.supabase.co`;
const base = (o = {}) => {
  const m = memoria();
  const manda = vi.fn(async () => ({ riuscito: true }));
  return {
    m,
    manda,
    opz: {
      metodo: "POST",
      supabaseUrl: URL_PROVA,
      chiaveAttesa: "chiave-di-prova",
      chiaveRicevuta: "chiave-di-prova",
      botPresente: true,
      memoriaPresente: true,
      prendi: m.prendi,
      conferma: m.conferma,
      rilascia: m.rilascia,
      manda,
      ...o,
    },
  };
};

describe("il testo e' fisso e comincia con TEST PROVA", () => {
  it("il messaggio inviabile comincia con il prefisso", () =>
    expect(MESSAGGIO_DI_PROVA.startsWith("TEST PROVA")).toBe(true));

  it("quello che parte e' esattamente il testo fisso", async () => {
    const { opz, manda } = base();
    const r = await eseguiLaProva(opz);
    expect(r.stato).toBe(200);
    expect(manda).toHaveBeenCalledTimes(1);
    expect(manda).toHaveBeenCalledWith(MESSAGGIO_DI_PROVA);
  });

  it("🔴 il testo del client e' ignorato: la funzione non ne riceve nemmeno la possibilita'", async () => {
    // L'interfaccia non ha nessun campo per un testo, un titolo o una prenotazione:
    // anche passandone di estranei, quello che parte resta il testo fisso.
    const { opz, manda } = base({ testo: "ciao", titolo: "x", record: { customer_name: "y" }, corpo: { text: "z" } });
    await eseguiLaProva(opz);
    expect(manda.mock.calls[0]).toEqual([MESSAGGIO_DI_PROVA]);
  });

  it("l'entrata della funzione non legge mai il corpo della richiesta", () => {
    const sorgente = readFileSync("supabase/functions/telegram-prova-test/index.ts", "utf8");
    expect(sorgente).not.toMatch(/req\.(json|text|formData|arrayBuffer|body)/);
  });
});

describe("gira solo su Borgo58-Prova", () => {
  it("il progetto di Prova e' riconosciuto", () => expect(siamoSuProva(URL_PROVA)).toBe(true));

  it.each([
    ["produzione", "https://oudjuqbqszisdtwzbxdo.supabase.co"],
    ["un altro progetto", "https://abcdefghij.supabase.co"],
    ["un nome che contiene il riferimento", `https://${REF_PROVA}.supabase.co.esempio.it`],
    ["un prefisso", `https://x${REF_PROVA}.supabase.co`],
    ["vuoto", ""],
    ["assente", undefined],
    ["non un indirizzo", "boh"],
  ])("rifiuta %s", (_n, url) => expect(siamoSuProva(url)).toBe(false));

  it("fuori da Prova non manda e non scrive niente", async () => {
    const { opz, manda, m } = base({ supabaseUrl: "https://oudjuqbqszisdtwzbxdo.supabase.co" });
    const r = await eseguiLaProva(opz);
    expect(r.stato).toBe(403);
    expect(manda).not.toHaveBeenCalled();
    expect(m.righe.size).toBe(0);
  });
});

describe("serve la chiave di attivazione della prova", () => {
  it("confronto: uguale passa, diversa, vuota o assente no", () => {
    expect(chiaveGiusta("abc", "abc")).toBe(true);
    expect(chiaveGiusta("abc", "abd")).toBe(false);
    expect(chiaveGiusta("abc", "abcd")).toBe(false);
    expect(chiaveGiusta("abc", "")).toBe(false);
    expect(chiaveGiusta("abc", null)).toBe(false);
    expect(chiaveGiusta("", "")).toBe(false);
    expect(chiaveGiusta(undefined, undefined)).toBe(false);
  });

  it.each([
    ["senza chiave", { chiaveRicevuta: null }],
    ["con chiave sbagliata", { chiaveRicevuta: "altra" }],
    ["con chiave vuota", { chiaveRicevuta: "" }],
    ["con la funzione non configurata", { chiaveAttesa: undefined, chiaveRicevuta: "" }],
  ])("rifiuta %s, senza mandare ne' scrivere", async (_n, o) => {
    const { opz, manda, m } = base(o);
    const r = await eseguiLaProva(opz);
    expect(r.stato).toBe(401);
    expect(manda).not.toHaveBeenCalled();
    expect(m.righe.size).toBe(0);
  });

  it("solo POST", async () => {
    const { opz, manda } = base({ metodo: "GET" });
    expect((await eseguiLaProva(opz)).stato).toBe(405);
    expect(manda).not.toHaveBeenCalled();
  });

  it("senza bot o senza memoria delle consegne non si manda", async () => {
    for (const o of [{ botPresente: false }, { memoriaPresente: false }]) {
      const { opz, manda } = base(o);
      expect((await eseguiLaProva(opz)).stato).toBe(500);
      expect(manda).not.toHaveBeenCalled();
    }
  });
});

describe("🔴 una consegna sola, anche se la prova viene richiamata", () => {
  it("la seconda chiamata non manda: risponde gia' consegnato", async () => {
    const { opz, manda } = base();
    expect((await eseguiLaProva(opz)).corpo).toEqual({ ok: true });
    const seconda = await eseguiLaProva(opz);
    expect(seconda.stato).toBe(200);
    expect(seconda.corpo).toEqual({ ok: true, gia_consegnato: true });
    expect(manda).toHaveBeenCalledTimes(1);
  });

  it("due chiamate insieme: una sola manda", async () => {
    const { opz, manda } = base();
    const [a, b] = await Promise.all([eseguiLaProva(opz), eseguiLaProva(opz)]);
    expect(manda).toHaveBeenCalledTimes(1);
    expect([a.stato, b.stato].sort()).toEqual([200, 409]);
  });

  it("la chiave e' una sola e fissa", async () => {
    const { opz, m } = base();
    await eseguiLaProva(opz);
    expect([...m.righe.keys()]).toEqual([CHIAVE_DELLA_PROVA]);
  });

  it("se Telegram risponde di no, la chiave si libera e si puo' riprovare", async () => {
    const { opz, m } = base({ manda: vi.fn(async () => ({ riuscito: false })) });
    expect((await eseguiLaProva(opz)).stato).toBe(502);
    expect(m.righe.size).toBe(0);
  });

  it("🔴 se l'invio si interrompe a meta', NON si rilascia: mai un doppione silenzioso", async () => {
    const { opz, m } = base({
      manda: vi.fn(async () => {
        throw new Error("rete caduta");
      }),
    });
    const r = await eseguiLaProva(opz);
    expect(r.stato).toBe(502);
    expect(r.corpo.esito).toBe("ignoto");
    expect(m.righe.get(CHIAVE_DELLA_PROVA)).toBe("presa");
    const riprova = base({ ...opz, prendi: opz.prendi });
    expect((await eseguiLaProva({ ...riprova.opz, manda: riprova.manda })).stato).toBe(409);
    expect(riprova.manda).not.toHaveBeenCalled();
  });
});

describe("non e' richiamabile dal resto del sistema", () => {
  it("nessuna migrazione, nessun workflow e nessuna funzione la nomina", () => {
    const cerca = (percorso) => readFileSync(percorso, "utf8");
    const funzioneEsistente = cerca("supabase/functions/notify-telegram-reservation/index.ts");
    expect(funzioneEsistente).not.toMatch(/telegram-prova-test/);
    expect(cerca(".github/workflows/controlli.yml")).not.toMatch(/telegram-prova-test/);
  });
});
