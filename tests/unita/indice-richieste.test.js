import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FILE,
  QUANDO,
  STATI,
  conteggio,
  fuoriVocabolario,
  generaConteggio,
  quandoFuoriVocabolario,
  richieste,
} from "../../scripts/indice-richieste.mjs";

// 🔴 IL CONTEGGIO DELLE RICHIESTE NON PUÒ PIÙ DISCORDARE DAL NUMERO DI RIGHE.
//
// Il 30/08/2026 Alessio ha misurato: **51 righe-richiesta** e un conteggio in
// cima che ne contava **50**. La riga che sfuggiva era T1, perché portava
// «fatta a metà» — uno stato che non è fra i quattro previsti. Una richiesta
// in uno stato inventato è **invisibile al conteggio**, ed è la stessa
// perdita per cui quel file è nato.
//
// ⚠️ QUESTA PROVA È IL GUARDIANO, non il comando: chi aggiunge una riga e
// dimentica `npm run richieste` la trova rossa prima del commit. Senza,
// sarebbe una disciplina — e le discipline si degradano.
describe("il conteggio delle richieste è allineato alle righe", () => {
  const testo = readFileSync(FILE, "utf8");

  it("ogni riga finisce in uno dei quattro stati", () => {
    const rotte = fuoriVocabolario(richieste(testo));
    expect(
      rotte.map((v) => `${v.id} → «${v.stato}»`),
      `Queste richieste hanno uno stato fuori dai quattro (${STATI.join(" · ")}): ` +
        "nessun gruppo le conterebbe, e sparirebbero dal totale senza che nessuno lo veda."
    ).toEqual([]);
  });

  it("ogni riga dice se si può fare adesso o se aspetta", () => {
    const rotte = quandoFuoriVocabolario(richieste(testo));
    expect(
      rotte.map((v) => `${v.id} → «${v.quando}»`),
      `La colonna «Quando» ammette solo ${QUANDO.join(" · ")}.`
    ).toEqual([]);
  });

  it("il blocco scritto nel file è quello che il gestionale genererebbe", () => {
    expect(generaConteggio(testo)).toBe(testo);
  });

  it("la somma dei quattro gruppi fa il numero delle righe", () => {
    // ⚠️ È la proprietà che il difetto del 30/08 violava, e si controlla da
    //    sé — non si legge dal testo del conteggio, si ricalcola.
    const voci = richieste(testo);
    const c = conteggio(voci);
    const somma = STATI.reduce((n, s) => n + c.per[s], 0);
    expect(somma).toBe(voci.length);
    expect(c.totale).toBe(voci.length);
  });

  it("e il conteggio SI RIFIUTA su uno stato inventato, invece di assorbirlo", () => {
    // 🔴 LA PROVA AL CONTRARIO, ed è quella che conta: un conteggio che
    //    mettesse gli stati sconosciuti in un gruppo «altro» rifarebbe il
    //    difetto con un nome diverso.
    const rotto = testo.replace(
      /^\| T1 \|(.*)\| fatta · /m,
      "| T1 |$1| fatta a metà · "
    );
    expect(rotto, "la riga T1 non è stata trovata: la prova non prova niente").not.toBe(testo);
    expect(() => generaConteggio(rotto)).toThrow(/T1/);
  });

  it("e si rifiuta anche se una riga non dice quando si può fare", () => {
    const rotto = testo.replace("| si può fare adesso | in attesa |", "|  | in attesa |");
    expect(rotto, "nessuna riga «si può fare adesso»: la prova non prova niente").not.toBe(testo);
    expect(() => generaConteggio(rotto)).toThrow(/Quando|adesso/i);
  });
});
