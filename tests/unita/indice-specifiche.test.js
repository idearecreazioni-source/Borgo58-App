import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

// L'INDICE DELLE SPECIFICHE NON RESTA INDIETRO — 06/09/2026.
//
// 🔴 PERCHE' ESISTE. Chiudendo SPEC-0005 lo stato e' stato aggiornato nel
//    file della specifica e l'indice ha continuato a dire «Bozza —
//    correzione». Nessuno se n'e' accorto leggendo: due documenti che si
//    contraddicono non danno nessun errore, e chi apre l'indice — che e'
//    il posto da cui si guarda l'archivio — legge la versione vecchia.
//    *La disciplina si degrada, l'automazione no.*
//
// ⚠️ LA REGOLA E' STATA MISURATA, NON DECISA A TAVOLINO. Chiedendo ai dieci
//    file quale stato dichiarano e confrontandolo con l'indice, **nessuno
//    dei dieci combaciava alla lettera**: l'indice scrive sempre una
//    versione piu' corta («Bozza — in attesa di conferma» contro «Bozza —
//    in attesa di conferma di Alessio»). Pretendere l'uguaglianza avrebbe
//    prodotto dieci allarmi il primo giorno, e *un controllo che grida
//    sempre viene spento*. Quello che vale per tutte e nove le righe sane,
//    e che SPEC-0005 violava, e' un'altra cosa: **l'indice puo' essere piu'
//    corto, mai diverso**.

const CARTELLA = "docs/specifiche";

function leggi(nome) {
  return readFileSync(`${CARTELLA}/${nome}`, "utf8").replace(/\r\n/g, "\n");
}

function righeIndice() {
  return leggi("INDICE.md")
    .split("\n")
    .map((r) => r.match(/^\|\s*\[(SPEC-\d{4})\]\(([^)]+)\)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/))
    .filter(Boolean)
    // ⚠️ Le colonne sono cinque — ID, titolo, priorità, stato, decisioni —
    // e lo stato è la QUARTA dopo il collegamento, cioè `m[5]`. Scritta
    // `m[4]` questa riga leggeva la priorità: il controllo diventava rosso
    // su tutte e dieci le righe, comprese le nove sane. *Un misuratore
    // nuovo si prova prima su un caso di cui si conosce già la risposta* —
    // qui la risposta nota era che nove righe su dieci erano a posto.
    .map((m) => ({ id: m[1], file: m[2], stato: m[5].trim() }));
}

function statoDelFile(nome) {
  const m = leggi(nome).match(/^\|\s*Stato\s*\|([^|]*)\|/m);
  return m ? m[1].trim() : null;
}

const fileSpec = readdirSync(CARTELLA).filter((n) => /^SPEC-\d{4}.*\.md$/.test(n));
const righe = righeIndice();

describe("l'indice delle specifiche e i file che elenca", () => {
  it("ogni specifica della cartella compare nell'indice", () => {
    // Una specifica nuova che nessuno aggiunge all'indice e' una specifica
    // che, per chi guarda l'archivio, non esiste.
    const elencate = righe.map((r) => r.file).sort();
    expect(elencate).toEqual(fileSpec.sort());
  });

  it("ogni riga dell'indice punta a un file che esiste", () => {
    const mancanti = righe.filter((r) => !fileSpec.includes(r.file));
    expect(mancanti.map((r) => r.id)).toEqual([]);
  });

  it("ogni specifica dichiara il proprio stato", () => {
    const senza = fileSpec.filter((n) => statoDelFile(n) === null);
    expect(senza).toEqual([]);
  });

  it("lo stato dell'indice può essere più corto, mai diverso", () => {
    // ⚠️ Il messaggio nomina TUTTE le righe che non tornano, non la prima:
    //    scoprirne una per volta fa risolvere la prima e ricominciare.
    const storte = righe
      .filter((r) => !(statoDelFile(r.file) ?? "").startsWith(r.stato))
      .map((r) => `${r.id}: indice «${r.stato}» — file «${statoDelFile(r.file)}»`);
    expect(storte).toEqual([]);
  });

  it("nessuno stato è vuoto: «non l'ha detto nessuno» non è uno stato", () => {
    expect(righe.filter((r) => r.stato === "").map((r) => r.id)).toEqual([]);
  });

  it("l'indice non è vuoto — se lo fosse, tutti i controlli qui sopra passerebbero", () => {
    // La trappola del caso vuoto: senza questa riga, un indice svuotato per
    // sbaglio renderebbe verde ogni confronto e nessuno se ne accorgerebbe.
    expect(righe.length).toBeGreaterThanOrEqual(fileSpec.length);
    expect(fileSpec.length).toBeGreaterThan(0);
  });
});
