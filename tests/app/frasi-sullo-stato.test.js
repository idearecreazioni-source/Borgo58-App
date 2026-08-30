import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// 🔴 IL CLIENT SI COSTRUISCE, non si importa: `aiuto.js` non esporta nessun
//    `titolare`, quindi questa riga dava `undefined`. Non aveva mai fatto
//    danno perche la prova usciva PRIMA di usarlo — finche nessun documento
//    vivo diceva «non ancora in produzione», il controllo tornava subito.
//    ⚠️ Cioe la rete nata oggi non poteva scattare: al primo caso vero
//    sarebbe morta con «Cannot read properties of undefined» invece di
//    nominare la frase falsa. L hanno fatta arrivare fin li le frasi scritte
//    stanotte, che sono il primo caso vero.
import { clientAutenticato, credenziali } from "./aiuto";

const titolare = await clientAutenticato(credenziali().titolare);

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
// stato marcisce. Il primo setaccio non distingueva i due, e per questo
// contava anche le 369 righe «non è stato verificato» delle riletture — che
// parlano di un atto passato e devono restare.
//
// LA REGOLA: quelle frasi non si scrivono a mano, si chiedono al gestionale.
// Dove non si può, la frase porta accanto **la data in cui era vera**.
//
// ⚠️ QUESTA PROVA COPRE LA FAMIGLIA PIÙ AFFILATA, non tutte: «non ancora in
// produzione» detto di una migrazione che si può nominare. Le altre forme —
// «zero prodotti», «nessun conto» — non hanno un nome da confrontare col
// database, e restano affidate alla regola scritta. Il limite è dichiarato.

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
function promesseDaControllare(testo) {
  const fuori = [];
  testo.split("\n").forEach((riga, i) => {
    if (!/non ancora in produzione|non (è|e') ancora in produzione/i.test(riga)) return;
    for (const v of riga.match(/\b20\d{12}\b/g) ?? []) fuori.push({ riga: i + 1, versione: v });
  });
  return fuori;
}

describe("i documenti vivi non dicono «non ancora in produzione» di una migrazione che c'è", () => {
  it("nessuna frase è smentita dal database", async () => {
    const daControllare = [];
    for (const f of VIVI) {
      let testo;
      try {
        testo = readFileSync(f, "utf8");
      } catch {
        continue; // un documento che non c'è non è un difetto di questa prova
      }
      for (const p of promesseDaControllare(testo)) daControllare.push({ file: f, ...p });
    }

    if (daControllare.length === 0) return; // niente da smentire

    const { data, error } = await titolare
      .from("applied_migrations")
      .select("version")
      .in("version", [...new Set(daControllare.map((d) => d.versione))]);
    expect(error).toBeNull();
    const applicate = new Set((data ?? []).map((r) => r.version));

    const bugie = daControllare.filter((d) => applicate.has(d.versione));
    expect(
      bugie.map((b) => `${b.file}:${b.riga} dice «non ancora in produzione» di ${b.versione}, che c'è`),
      "Queste frasi sono smentite dal database. Correggile dicendo il vero e\n" +
        "mettici accanto la data in cui l'hai guardato."
    ).toEqual([]);
  });

  it("e il setaccio riconosce la forma, altrimenti non proverebbe niente", () => {
    // 🔴 LA PROVA AL CONTRARIO. Senza, «zero bugie» sarebbe indistinguibile da
    //    «il setaccio non trova niente», che è il verso in cui questa prova
    //    fallirebbe in silenzio.
    const finto = "la migrazione `20260828000008` è **non ancora in produzione**.";
    expect(promesseDaControllare(finto)).toEqual([{ riga: 1, versione: "20260828000008" }]);
    expect(promesseDaControllare("una frase qualunque senza promesse")).toEqual([]);
    // ⚠️ E una frase che porta la data NON è esente: la data non rende vera una
    //    bugia, serve solo dove il gestionale non può rispondere.
    expect(promesseDaControllare("al 30/08: `20260828000008` non ancora in produzione")).toHaveLength(1);
  });
});
