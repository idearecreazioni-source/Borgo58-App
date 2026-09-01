// =====================================================================
// IL CANCELLO FRA UN COMMIT E borgo58.it — 01/09/2026
// =====================================================================
//
// 🔴 IL TEST NEGATIVO CHIESTO DAL VALIDATORE: *un commit con i controlli
//    rossi non deve poter produrre una pubblicazione di produzione.*
//
// ⚠️ E' un test sulla FORMA del lavoro, non sul suo comportamento, e va
//    detto perche' e' precisamente il limite: quello che si prova qui e' che
//    il cancello e' scritto dove GitHub lo fa rispettare da se' — un
//    `needs:` sui due lavori dei controlli, che salta il lavoro dipendente
//    se uno dei due fallisce. Non si prova facendo davvero fallire un giro
//    su `master`, perche' l'unico modo sarebbe rompere apposta il ramo
//    principale. Il giro vero si prova col valore `prova` della variabile,
//    che pubblica un'anteprima invece del sito (docs/CLOUDFLARE.md, § 9).
//
// ⚠️ E LA FORMA E' LA COSA CHE SI PUO' PERDERE IN SILENZIO: togliendo
//    `needs`, o allargando la condizione, il lavoro comincerebbe a
//    pubblicare **senza nessun errore da nessuna parte**. E' lo stesso
//    motivo per cui questo progetto sorveglia i portieri delle funzioni.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { problemaDelRamo, problemaDellAccount, accountDalRepository, RAMO_DI_PRODUZIONE } from "../../scripts/cloudflare-verifica.mjs";

const workflow = readFileSync(".github/workflows/controlli.yml", "utf8");
const lavoro = workflow.slice(workflow.indexOf("\n  pubblica:"));

describe("la pubblicazione non parte se i controlli sono rossi", () => {
  it("dipende da TUTTI E DUE i lavori dei controlli", () => {
    // Non basta `needs: codice`: le 459 prove contro il database stanno nel
    // secondo, ed e' quello che il 31/08 era rosso mentre il sito andava
    // online lo stesso.
    expect(lavoro).toMatch(/needs:\s*\[\s*codice\s*,\s*database\s*\]/);
  });

  it("gira solo sul ramo principale", () => {
    // Un ramo di lavoro ha le sue anteprime e non deve poter toccare il sito
    // nemmeno con la variabile accesa.
    expect(lavoro).toMatch(/github\.ref == 'refs\/heads\/master'/);
  });

  it("resta spento finche' qualcuno non lo accende apposta", () => {
    // 🔴 E' cio' che rende sicuro unire questo lavoro: appena unito non
    //    cambia niente, perche' la variabile non esiste. Senza questa
    //    condizione, il merge stesso sarebbe la finestra di pubblicazione
    //    non controllata che il piano esiste per non aprire.
    expect(lavoro).toMatch(/vars\.PUBBLICAZIONE_DA_GITHUB == 'si'/);
    expect(lavoro).toMatch(/vars\.PUBBLICAZIONE_DA_GITHUB == 'prova'/);
  });

  it("il numero dell'account NON passa dai segreti", () => {
    // Non e' un segreto (sta in chiaro nel repository), e messo fra i
    // segreti arriva vuoto quando il segreto non c'e' — spegnendo il lavoro
    // in silenzio, che e' il difetto misurato il 01/09 sulla pulizia.
    expect(lavoro).toMatch(/CLOUDFLARE_ACCOUNT_ID: \$\{\{ vars\.CLOUDFLARE_ACCOUNT_ID \}\}/);
    expect(lavoro).not.toMatch(/CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\./);
  });

  it("la chiave invece SI'", () => {
    expect(lavoro).toMatch(/CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  });
});

describe("il comando che prova la chiave non puo' toccare la produzione", () => {
  it("rifiuta un'anteprima sul ramo di produzione", () => {
    expect(problemaDelRamo(RAMO_DI_PRODUZIONE)).toMatch(/ramo di produzione/);
  });

  it("accetta un ramo qualunque", () => {
    expect(problemaDelRamo("claude/una-cosa")).toBeNull();
  });

  it("senza ramo non fa niente", () => {
    expect(problemaDelRamo("")).toMatch(/Serve il nome del ramo/);
  });
});

describe("il numero dell'account viene dal repository ed e' controllato", () => {
  it("quello scritto in .env.example ha la forma giusta", () => {
    expect(problemaDellAccount(accountDalRepository())).toBeNull();
  });

  it("un numero di lunghezza sbagliata e' respinto", () => {
    expect(problemaDellAccount("124e479908976a117d12b1daadde0d9")).toMatch(/32 caratteri/);
  });

  it("le maiuscole sono respinte", () => {
    // ⚠️ Cloudflare lo scrive minuscolo. Accettare le maiuscole vorrebbe dire
    //    accettare una copia ricopiata a mano che l'API poi rifiuta, con un
    //    rifiuto che parla d'altro.
    expect(problemaDellAccount("124E479908976A117D12B1DAADDE0D97")).toMatch(/32 caratteri/);
  });

  it("vuoto lo dice, invece di andare avanti con niente", () => {
    expect(problemaDellAccount("")).toMatch(/Manca il numero/);
  });
});
