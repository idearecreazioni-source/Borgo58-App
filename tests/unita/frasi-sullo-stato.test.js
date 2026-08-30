import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 🔴 UNA FRASE SCRITTA A MANO CHE DICHIARA UNO STATO È DESTINATA A DIVENTARE
// FALSA — regola approvata da Alessio il 30/08/2026, e nasce da due casi
// dello stesso giorno:
//   · `docs/DECISIONI.md` diceva «Migrazione 20260828000008 — non ancora in
//     produzione», e quella migrazione era in produzione da due giorni;
//   · i quattro riepiloghi del 30/08 dicevano «nessuna migrazione applicata»,
//     ed è diventato falso **cinque minuti dopo**, appena applicate.
//
// ⚠️ IL TELAIO, misurato prima di correggere. Nei **documenti vivi** — quelli
// che dichiarano cosa vale ADESSO — le frasi che dicono cosa c'è o non c'è in
// produzione erano **22**, di cui **12 senza la data accanto**. Di quelle,
// **sei** dicevano «non ancora in produzione» di una migrazione che invece
// c'era: sei su sei false, verificate una per una sul database vero.
//
// ⚠️ E LA DISTINZIONE CHE FA IL SETACCIO ONESTO — trovata perché il primo
// conteggio dava **602** ed era chiaramente gonfio. Un **riepilogo di
// consegna** ha la data nel nome del file: le sue frasi sono una fotografia
// **per costruzione**, e «aspetta il push» scritto il 18/08 è un fatto del
// 18/08, non una bugia di oggi. Un **documento vivo** no: lì una frase sullo
// stato marcisce.
//
// ---------------------------------------------------------------------
// 🔴 31/08/2026 — LA RETE NON CHIEDE PIÙ AL DATABASE, ED È UNA DECISIONE
//    DI ALESSIO fra le due strade che gli erano state poste.
// ---------------------------------------------------------------------
// Il limite dichiarato il 30/08 era che questa rete interrogava il progetto
// di **PROVA**: nella finestra fra i due — una migrazione applicata alla
// prova e non ancora in produzione — avrebbe accusato di bugia una frase
// **vera**. *Un guardiano che grida su chi ha ragione si impara a spegnere.*
//
// Le due strade erano: (a) farle interrogare la produzione, (b) scrivere
// nella regola che quella frase non si scrive mai e chiedere al gestionale.
// Alessio ha scelto la (b), e regge meglio per tre ragioni:
//   1. **Non c'è nessuna finestra**: la frase è sbagliata sempre, non a
//      seconda di quando la si guarda.
//   2. La (a) avrebbe messo le credenziali della PRODUZIONE dentro una
//      prova automatica — e in questo progetto le prove hanno un controllo
//      apposta che le tiene lontane dal database vero.
//   3. Senza database questa smette di essere una prova sull'app e diventa
//      una **prova pura**: gira a ogni commit, dentro il gancio, invece
//      che solo con `npm run test:app`.
//
// ⚠️ COSA SI PERDE, dichiarato: prima la rete diceva *«questa frase è
// FALSA»*, adesso dice *«questa frase non si scrive»*. È più severa e sa
// meno: non distingue più una frase vera da una falsa, perché la regola è
// che non si scriva comunque. Chi vuole sapere cosa c'è in produzione lo
// chiede al gestionale con `npm run migra`, che guarda il database vero.
//
// ⚠️ E RESTA IL LIMITE DI SEMPRE: questa prova copre la famiglia più
// affilata — «non ancora in produzione» detto di una migrazione che si può
// nominare. Le altre forme — «zero prodotti», «nessun conto» — non hanno un
// nome da riconoscere e restano affidate alla regola scritta.

const VIVI = [
  "CLAUDE.md",
  "docs/DECISIONI.md",
  "docs/RICHIESTE.md",
  "docs/CODA_E_DECISIONI.md",
  "docs/ARCHITETTURA.md",
  "docs/CONTRATTO.md",
];

// «… `20260820000003`, non ancora in produzione» — la versione e la frase
// possono stare nell'ordine che vogliono, purché sulla stessa riga.
//
// ⚠️ LA VERSIONE SULLA RIGA È CIÒ CHE DISTINGUE UNA DICHIARAZIONE DA UNA
//    CITAZIONE, e non è un dettaglio: questo stesso commento e la regola in
//    `DECISIONI.md` nominano la frase per spiegarla. Senza il numero
//    accanto, una riga la sta raccontando; con il numero, la sta
//    affermando. Misurato il 31/08: in `DECISIONI.md` ci sono due righe che
//    citano la frase, e nessuna delle due porta un numero.
export function promesseDaControllare(testo) {
  const fuori = [];
  testo.split("\n").forEach((riga, i) => {
    if (!/non ancora in produzione|non (è|e') ancora in produzione/i.test(riga)) return;
    for (const v of riga.match(/\b20\d{12}\b/g) ?? []) fuori.push({ riga: i + 1, versione: v });
  });
  return fuori;
}

describe("nei documenti vivi non si scrive «non ancora in produzione»", () => {
  it("nessun documento vivo dichiara lo stato di una migrazione", () => {
    const trovate = [];
    for (const f of VIVI) {
      let testo;
      try {
        testo = readFileSync(f, "utf8");
      } catch {
        continue; // un documento che non c'è non è un difetto di questa prova
      }
      for (const p of promesseDaControllare(testo)) trovate.push({ file: f, ...p });
    }

    expect(
      trovate.map((b) => `${b.file}:${b.riga} dichiara lo stato di ${b.versione}`),
      "Questa frase non si scrive a mano in un documento vivo: invecchia da\n" +
        "sola e nessuno se ne accorge. Toglila, e chiedi al gestionale cosa c'è\n" +
        "in produzione con `npm run migra`. Se proprio deve restare, va in un\n" +
        "riepilogo di consegna — che ha la data nel nome ed è una fotografia\n" +
        "per costruzione."
    ).toEqual([]);
  });

  it("e il setaccio riconosce la forma, altrimenti non proverebbe niente", () => {
    // 🔴 LA PROVA AL CONTRARIO. Senza, «zero trovate» sarebbe indistinguibile
    //    da «il setaccio non trova niente», che è il verso in cui questa
    //    prova fallirebbe in silenzio.
    const finto = "la migrazione `20260828000008` è **non ancora in produzione**.";
    expect(promesseDaControllare(finto)).toEqual([{ riga: 1, versione: "20260828000008" }]);
    expect(promesseDaControllare("una frase qualunque senza promesse")).toEqual([]);
    // ⚠️ E una frase che porta la data NON è esente: la data non rende
    //    scrivibile una frase che la regola vieta.
    expect(promesseDaControllare("al 30/08: `20260828000008` non ancora in produzione")).toHaveLength(1);
    // ⚠️ Una riga che CITA la frase senza nominare una migrazione non è una
    //    dichiarazione: è così che questa regola può essere scritta.
    expect(promesseDaControllare("la frase «non ancora in produzione» non si scrive")).toEqual([]);
  });
});
