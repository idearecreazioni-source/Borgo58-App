import { describe, expect, it } from "vitest";
import {
  ANTEPRIME_PER_RAMO,
  PRODUZIONI_DA_TENERE,
  anteprimeDaTogliere,
  anteprimeDelRamo,
  anteprimeOrfane,
  produzioniDaTogliere,
  ramoDi,
} from "../../scripts/cloudflare.mjs";

// LA PULIZIA DELLE COSTRUZIONI SU CLOUDFLARE — 31/08/2026.
//
// Si prova qui, senza chiamare nessuno, perche' la parte che puo' fare danno
// e' la DECISIONE — «quali si tolgono» — non la telefonata che le toglie. Una
// prova che chiamasse Cloudflare per davvero potrebbe solo cancellare roba.
//
// ⚠️ I casi sono scelti perche' DISCRIMINANO: con tre costruzioni e due da
// tenere, «tieni le prime due» e «tieni le piu' recenti» darebbero lo stesso
// risultato. Qui l'elenco arriva in ordine sparso apposta.

function costruzione(id, { ambiente = "production", quando, ramo = "master" } = {}) {
  return {
    id,
    environment: ambiente,
    created_on: quando,
    deployment_trigger: { metadata: { branch: ramo } },
  };
}

describe("quali versioni di produzione si tolgono", () => {
  it("tiene le piu' RECENTI, non le prime dell'elenco", () => {
    // ⚠️ L'ordine in cui arrivano e' sbagliato apposta: la piu' vecchia e'
    //    prima. Un codice che si fidasse dell'ordine terrebbe quella.
    const elenco = [
      costruzione("vecchia", { quando: "2026-01-01T10:00:00Z" }),
      costruzione("nuova", { quando: "2026-08-31T10:00:00Z" }),
      costruzione("media", { quando: "2026-05-01T10:00:00Z" }),
    ];
    const via = produzioniDaTogliere(elenco, { tieni: 2 }).map((c) => c.id);
    expect(via).toEqual(["vecchia"]);
  });

  it("ne tiene esattamente quante gliene dici", () => {
    const elenco = Array.from({ length: 25 }, (_, i) =>
      costruzione(`p${i}`, { quando: `2026-08-${String(i + 1).padStart(2, "0")}T10:00:00Z` })
    );
    expect(produzioniDaTogliere(elenco, { tieni: 10 })).toHaveLength(15);
    expect(produzioniDaTogliere(elenco, { tieni: 25 })).toHaveLength(0);
    expect(produzioniDaTogliere(elenco, { tieni: 40 })).toHaveLength(0);
  });

  it("🔴 NON tocca MAI la versione che serve il sito, nemmeno se e' vecchissima", () => {
    // Il caso vero: dopo un ritorno indietro, il sito vivo NON e' il piu'
    // recente. Un codice che desse per scontato «il vivo e' il primo»
    // cancellerebbe il sito pubblico.
    const elenco = [
      costruzione("antica", { quando: "2020-01-01T10:00:00Z" }),
      costruzione("a", { quando: "2026-08-29T10:00:00Z" }),
      costruzione("b", { quando: "2026-08-30T10:00:00Z" }),
      costruzione("c", { quando: "2026-08-31T10:00:00Z" }),
    ];
    const via = produzioniDaTogliere(elenco, { tieni: 2, vivo: "antica" }).map((c) => c.id);
    expect(via).toEqual(["a"]);
    expect(via).not.toContain("antica");
  });

  it("le anteprime dei rami non le sfiora: la produzione si governa da se'", () => {
    const elenco = [
      costruzione("p1", { quando: "2026-08-31T10:00:00Z" }),
      costruzione("p2", { quando: "2026-08-30T10:00:00Z" }),
      costruzione("r1", { ambiente: "preview", quando: "2020-01-01T10:00:00Z", ramo: "un-ramo" }),
    ];
    const via = produzioniDaTogliere(elenco, { tieni: 1 }).map((c) => c.id);
    expect(via).toEqual(["p2"]);
  });

  it("il numero deciso e' dieci", () => {
    expect(PRODUZIONI_DA_TENERE).toBe(10);
  });
});

describe("le anteprime di un ramo", () => {
  const elenco = [
    costruzione("a1", { ambiente: "preview", quando: "2026-08-31T10:00:00Z", ramo: "mio-ramo" }),
    costruzione("a2", { ambiente: "preview", quando: "2026-08-30T10:00:00Z", ramo: "mio-ramo" }),
    costruzione("altro", { ambiente: "preview", quando: "2026-08-30T10:00:00Z", ramo: "altro-ramo" }),
    costruzione("prod", { quando: "2026-08-31T10:00:00Z", ramo: "master" }),
  ];

  it("prende tutte quelle di quel ramo, e solo quelle", () => {
    expect(anteprimeDelRamo(elenco, "mio-ramo").map((c) => c.id)).toEqual(["a1", "a2"]);
  });

  it("🔴 con «master» NON restituisce la produzione", () => {
    // Il gesto pericoloso: se qualcuno lanciasse la pulizia col ramo
    // predefinito, la produzione non deve finirci dentro.
    expect(anteprimeDelRamo(elenco, "master")).toEqual([]);
  });

  it("senza nome non prende niente", () => {
    expect(anteprimeDelRamo(elenco, "")).toEqual([]);
    expect(anteprimeDelRamo(elenco, null)).toEqual([]);
  });
});

describe("le anteprime rimaste senza ramo", () => {
  const elenco = [
    costruzione("viva", { ambiente: "preview", quando: "2026-08-31T10:00:00Z", ramo: "ramo-aperto" }),
    costruzione("morta", { ambiente: "preview", quando: "2026-08-30T10:00:00Z", ramo: "ramo-cancellato" }),
    costruzione("prod", { quando: "2026-08-31T10:00:00Z", ramo: "master" }),
    { id: "muta", environment: "preview", created_on: "2026-08-01T10:00:00Z" },
  ];

  it("toglie solo quelle dei rami spariti", () => {
    const via = anteprimeOrfane(elenco, ["master", "ramo-aperto"]).map((c) => c.id);
    expect(via).toEqual(["morta"]);
  });

  it("🔴 una costruzione di cui non si sa il ramo NON viene toccata", () => {
    // «Non so da dove viene» non e' «viene da un ramo morto». Nel dubbio resta:
    // una pulizia che cancella quello che non ha capito e' peggio di una che
    // lascia qualcosa in giro.
    const via = anteprimeOrfane(elenco, ["master"]).map((c) => c.id);
    expect(via).not.toContain("muta");
    expect(via).not.toContain("prod");
  });

  it("legge il ramo da dove lo scrive Cloudflare, e regge se manca", () => {
    expect(ramoDi(elenco[0])).toBe("ramo-aperto");
    expect(ramoDi({ id: "x", environment: "preview" })).toBe("");
    expect(ramoDi(null)).toBe("");
  });
});

describe("le anteprime oltre le ultime due di ogni ramo", () => {
  it("🔴 conta PER RAMO, non in tutto", () => {
    // ⚠️ Il caso che discrimina: un ramo molto lavorato e uno fermo. Un tetto
    //    complessivo terrebbe le piu' recenti in assoluto — cioe' tutte del
    //    ramo caldo — e cancellerebbe l'unica anteprima del ramo fermo.
    const elenco = [
      costruzione("caldo1", { ambiente: "preview", quando: "2026-08-31T10:00:00Z", ramo: "caldo" }),
      costruzione("caldo2", { ambiente: "preview", quando: "2026-08-30T10:00:00Z", ramo: "caldo" }),
      costruzione("caldo3", { ambiente: "preview", quando: "2026-08-29T10:00:00Z", ramo: "caldo" }),
      costruzione("caldo4", { ambiente: "preview", quando: "2026-08-28T10:00:00Z", ramo: "caldo" }),
      costruzione("fermo1", { ambiente: "preview", quando: "2026-01-01T10:00:00Z", ramo: "fermo" }),
    ];
    const via = anteprimeDaTogliere(elenco, { tieni: 2 }).map((c) => c.id).sort();
    expect(via).toEqual(["caldo3", "caldo4"]);
    // L'unica del ramo fermo resta, benche' sia la piu' vecchia di tutte.
    expect(via).not.toContain("fermo1");
  });

  it("tiene le due PIU' RECENTI di ogni ramo, non le prime dell'elenco", () => {
    const elenco = [
      costruzione("vecchia", { ambiente: "preview", quando: "2026-01-01T10:00:00Z", ramo: "r" }),
      costruzione("media", { ambiente: "preview", quando: "2026-05-01T10:00:00Z", ramo: "r" }),
      costruzione("nuova", { ambiente: "preview", quando: "2026-08-31T10:00:00Z", ramo: "r" }),
    ];
    expect(anteprimeDaTogliere(elenco, { tieni: 2 }).map((c) => c.id)).toEqual(["vecchia"]);
  });

  it("🔴 non tocca MAI la produzione", () => {
    const elenco = [
      costruzione("p1", { quando: "2026-08-31T10:00:00Z" }),
      costruzione("p2", { quando: "2026-08-30T10:00:00Z" }),
      costruzione("p3", { quando: "2026-08-29T10:00:00Z" }),
    ];
    expect(anteprimeDaTogliere(elenco, { tieni: 2 })).toEqual([]);
  });

  it("un'anteprima senza ramo non finisce in nessun gruppo, quindi resta", () => {
    const elenco = [
      { id: "muta1", environment: "preview", created_on: "2026-01-01T10:00:00Z" },
      { id: "muta2", environment: "preview", created_on: "2026-02-01T10:00:00Z" },
      { id: "muta3", environment: "preview", created_on: "2026-03-01T10:00:00Z" },
    ];
    expect(anteprimeDaTogliere(elenco, { tieni: 2 })).toEqual([]);
  });

  it("il numero deciso e' due", () => {
    expect(ANTEPRIME_PER_RAMO).toBe(2);
  });
});
