import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientAutenticato, credenziali } from "./aiuto";
import * as costanti from "../../src/lib/constants";
// ⚠️ La REGOLA della rete non sta qui: sta in `vocabolari.js`, dove una prova
// pura la esercita al contrario (`tests/unita/vocabolari.test.js`). Questo
// file le passa i dati veri del database. Se la regola vivesse dentro queste
// asserzioni, l'unico modo di vederla scattare sarebbe rompere l'app.
import {
  GUARDIE_ESENTI,
  SPECCHIATI,
  guardieSospette,
  problemiVocabolari,
  specchiNonDichiarati,
} from "../../src/lib/calcoli/vocabolari";

// LA RETE SUI VOCABOLARI CHIUSI.
//
// Terza ricomparsa in due giorni della stessa trappola: un elenco chiuso di
// valori ammessi vive in più di un posto, e nessuno controlla che i posti
// dicano la stessa cosa.
//   · 16/08 — gli scarichi di magazzino: aperto il vocabolario nella
//     funzione e non nel vincolo della tabella;
//   · 17/08 — i metodi di pagamento: identico;
//   · 17/08 — e costruendo questa rete: «Assegno» offerto nel menu della
//     lista della spesa, dove il database lo rifiuta. Era vivo in
//     produzione.
//
// ⚠️ I POSTI SONO TRE. Il database decide (enum o vincolo), una funzione
// ridice l'elenco per dare un messaggio leggibile, e `constants.js` lo
// ridice per riempire un menu. Fra i primi due l'errore è rumoroso ma
// incomprensibile; fra il primo e il terzo può essere **silenzioso** — un
// valore legittimo che non si può scegliere.
//
// ⚠️ E I DUE ELENCHI SE LI COSTRUISCE IL DATABASE, non questo file:
// `vocabolari_chiusi()` legge dai cataloghi e `guardie_vocabolario()` dai
// corpi delle funzioni. Un vocabolario nuovo compare da solo, e la prova
// diventa rossa finché qualcuno non dichiara se una schermata lo rispecchia.
// È la forma di `funzioni_aperte_ad_anon()` (13/08) e di `prova:stato`
// (16/08): un elenco scritto a mano invecchia in silenzio, uno che si
// costruisce da solo chiede di più man mano che il gestionale cresce.

describe("i vocabolari chiusi dicono la stessa cosa in tutti i posti dove vivono", () => {
  let titolare;
  let vocabolari;
  let guardie;

  beforeAll(async () => {
    titolare = await clientAutenticato(credenziali().titolare);
    const [v, g] = await Promise.all([
      titolare.rpc("vocabolari_chiusi"),
      titolare.rpc("guardie_vocabolario"),
    ]);
    if (v.error || g.error) {
      throw new Error(
        `Gli elenchi non arrivano dal database: ${v.error?.message ?? g.error?.message}. ` +
          "Manca la migrazione 20260817000003?"
      );
    }
    vocabolari = v.data;
    guardie = g.data;
  });

  afterAll(async () => {
    await titolare.auth.signOut({ scope: "local" });
  });

  it("il database ne ha da dire: gli elenchi non sono vuoti", () => {
    // ⚠️ Senza questo, tutto il resto passerebbe su due elenchi vuoti — che
    // è la trappola del caso vuoto (CLAUDE.md §8): una prova che gira sul
    // niente dimostra che il codice non esplode, non che funziona.
    expect(vocabolari.length).toBeGreaterThan(40);
    expect(guardie.length).toBeGreaterThan(4);
  });

  it("ogni elenco di etichette dichiara quale colonna rispecchia", () => {
    expect(
      specchiNonDichiarati(costanti, SPECCHIATI),
      "elenchi di etichette non dichiarati in src/lib/calcoli/vocabolari.js: " +
        "vanno agganciati alla loro colonna, oppure la rete non li copre"
    ).toEqual([]);
  });

  it("ogni elenco di etichette combacia col vocabolario del database", () => {
    expect(problemiVocabolari(SPECCHIATI, vocabolari)).toEqual([]);
  });

  it("ogni guardia di una funzione dice esattamente quello che dice il database", () => {
    // ⚠️ È il controllo che avrebbe preso i due morsi del 16 e del 17/08.
    expect(
      guardieSospette(guardie, vocabolari, GUARDIE_ESENTI),
      "guardie che non combaciano con nessun vocabolario del database: " +
        "o una funzione è stata allargata senza il suo vincolo, o è un'eccezione da dichiarare " +
        "in GUARDIE_ESENTI con la sua ragione"
    ).toEqual([]);
  });

  it("le esenzioni dichiarate esistono ancora, e ognuna porta la sua ragione", () => {
    // ⚠️ Un'eccezione che sopravvive alla cosa che escludeva è un pezzo di
    // rete spento senza che nessuno l'abbia deciso: lo stesso motivo per cui
    // il 14/08 una colonna spenta è stata rimossa invece di lasciata lì.
    for (const g of GUARDIE_ESENTI) {
      expect(g.perche?.length, `l'esenzione di ${g.funzione} non dice perché`).toBeGreaterThan(20);
      expect(
        guardie.some((x) => x.funzione === g.funzione && x.parametro === g.parametro),
        `${g.funzione}(${g.parametro}) è dichiarata esente ma non esiste più: l'esenzione va tolta`
      ).toBe(true);
    }
  });

  it("e il difetto trovato costruendo la rete resta chiuso", () => {
    // I due metodi di pagamento sono DUE vocabolari e devono restare
    // diversi. Finché coincidevano un elenco solo bastava e il difetto non
    // si vedeva; è tornando a coincidere che ricomparirebbe.
    const fatture = vocabolari.find(
      (v) => v.tabella === "supplier_invoices" && v.colonna === "payment_method"
    );
    const spesa = vocabolari.find(
      (v) => v.tabella === "shopping_list_items" && v.colonna === "payment_method"
    );
    expect(fatture.valori).toContain("assegno");
    expect(spesa.valori).not.toContain("assegno");
    // E la schermata della spesa non lo offre.
    expect(costanti.PAYMENT_METHODS_SPESA.map((p) => p.value)).not.toContain("assegno");
    expect(costanti.PAYMENT_METHODS.map((p) => p.value)).toContain("assegno");
  });
});
