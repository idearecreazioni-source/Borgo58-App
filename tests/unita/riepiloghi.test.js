import { describe, expect, it } from "vitest";
import { PRIMA_CON_RIEPILOGO, versioniNonNominate } from "../../scripts/comune.mjs";

// LA RETE DEI RIEPILOGHI, E IL MOMENTO IN CUI GUARDA — 28/08/2026.
//
// 🔴 PERCHE' QUESTE PROVE ESISTONO. Il 16/08 Alessio ha deciso una rete:
// lo script che applica le migrazioni si rifiuta di toccare la produzione
// se non esiste un file in `docs/consegne/` che nomina quella migrazione.
// Il 27/08 cinque migrazioni sono entrate in produzione senza quel file,
// e la rete non le ha fermate.
//
// 🔴 MISURATO IL 28/08, ed e' la parte che vale piu' della correzione:
// **la rete non e' stata aggirata e non e' rotta.** Guarda cio' che e'
// GIA' applicato — scelta deliberata e documentata, perche' il riepilogo
// contiene i numeri veri dell'applicazione, che si conoscono solo dopo.
// Per come e' fatta **non puo' fermare la prima applicazione non
// documentata**: fa scattare il blocco al giro successivo, ed e'
// esattamente quello che e' successo (il 27/08 ha bloccato la macchina, e
// l'arretrato e' stato scritto).
//
//   · la rete esiste nel codice?          si'
//   · controlla al momento sbagliato?     si', per quello che le si chiede
//   · e' aggirabile dal comando?          no — `--salta` e `--fino-a`
//                                         cambiano COSA si applica, non se
//                                         il controllo gira
//
// 🔴 E C'ERA UN SECONDO BUCO, mai misurato prima: **la forma abbreviata.**
// Un riepilogo che scrive «da …026 a …032» nomina i due estremi e lascia
// mute le cinque in mezzo. Il 28/08 quattro migrazioni su quindici in
// attesa erano in quello stato. ⚠️ La trappola era gia' DESCRITTA nel
// commento della soglia — e' il motivo per cui le migrazioni fra il 10/08
// e il 15/08 non passerebbero il controllo — e non era mai stata chiusa
// per il futuro.
describe("una migrazione senza riepilogo si vede prima di applicarla", () => {
  it("una versione che nessun riepilogo nomina viene segnalata", () => {
    expect(versioniNonNominate(["20260828000009"], "un riepilogo che parla d'altro")).toEqual([
      "20260828000009",
    ]);
  });

  it("e con il suo riepilogo passa", () => {
    expect(
      versioniNonNominate(["20260828000009"], "Migrazioni: `20260828000009` — nessuna in produzione")
    ).toEqual([]);
  });

  it("🔴 l'intervallo nomina gli estremi e lascia mute quelle in mezzo", () => {
    // È il difetto vero del 28/08, detto come prova. Il riepilogo del
    // 27/08 scriveva esattamente questa forma, e quattro migrazioni su
    // quindici stavano per entrare in produzione senza che nessun
    // documento le nominasse.
    const abbreviato = "| **Migrazioni** | `20260827000026` → `20260827000032` |";
    const tutte = [
      "20260827000026",
      "20260827000027",
      "20260827000028",
      "20260827000029",
      "20260827000030",
      "20260827000031",
      "20260827000032",
    ];
    expect(versioniNonNominate(tutte, abbreviato)).toEqual([
      "20260827000027",
      "20260827000028",
      "20260827000029",
      "20260827000030",
      "20260827000031",
    ]);
  });

  it("scritte per intero passano tutte", () => {
    // ⚠️ La controprova nel verso opposto: senza, la prova qui sopra
    // sarebbe verde anche se la ricerca non trovasse MAI niente.
    const perIntero = ["20260827000026", "20260827000027", "20260827000028"];
    expect(versioniNonNominate(perIntero, perIntero.join(" e poi "))).toEqual([]);
  });

  it("le migrazioni prima della soglia restano fuori", () => {
    // ⚠️ La soglia non e' un'indulgenza: prima del 10/08 la convenzione dei
    // riepiloghi non esisteva, e fra il 10/08 e il 15/08 i riepiloghi
    // nominano le versioni in forma abbreviata. Applicare il controllo
    // all'indietro darebbe decine di falsi allarmi, e un controllo che
    // grida sempre viene spento.
    expect(versioniNonNominate(["20260801000001"], "")).toEqual([]);
    expect(versioniNonNominate([PRIMA_CON_RIEPILOGO], "")).toEqual([PRIMA_CON_RIEPILOGO]);
  });

  it("l'elenco torna ordinato, perche' chi lo legge deve poterlo seguire", () => {
    expect(versioniNonNominate(["20260828000003", "20260828000001"], "")).toEqual([
      "20260828000001",
      "20260828000003",
    ]);
  });
});
