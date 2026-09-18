// =====================================================================
// IL CANCELLO NON DEVE POTERSI IMITARE — 18/09/2026
// =====================================================================
//
// 🔴 PERCHE' QUESTE RIGHE ESISTONO. Un controllo obbligatorio si riconosce
//    dal NOME. Se il workflow che porta quel nome venisse letto dalla
//    PROPOSTA invece che dalla BASE, chiunque apra un ramo potrebbe
//    riscriverlo perche' dica sempre di si': la chiave la fabbricherebbe chi
//    bussa. `pull_request_target` e' cio' che lo impedisce, e queste prove
//    sono l'unica cosa che se ne accorgerebbe se qualcuno lo togliesse.
//
// ⚠️ LIMITE DICHIARATO, e non lo copre nessuna prova. GitHub sa fissare il
//    workflow fidato con la regola «Required workflows» dei ruleset, che
//    punta a un file e a un ref precisi: su questo repository la chiamata
//    viene RIFIUTATA (misurato il 18/09: HTTP 422), perche' e' una funzione
//    di organizzazione e qui il proprietario e' un utente. Finche' e' cosi',
//    un ramo che aggiungesse `pull_request` a questo file produrrebbe un
//    secondo giro con lo STESSO nome, e fra due giri omonimi vince l'ultimo
//    che finisce. Oggi l'unico account con accesso in scrittura e' uno solo
//    — cioe' chi potrebbe comunque cambiare le regole — quindi l'esposizione
//    e' nulla in pratica; il giorno che entrasse una seconda persona questo
//    torna un buco vero. *Si scrive invece di far finta che sia chiuso.*

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const cancello = readFileSync(".github/workflows/cancello-filiera.yml", "utf8");

describe("la definizione del cancello si legge dalla base", () => {
  it("🔴 si attiva con `pull_request_target`", () => {
    expect(cancello).toMatch(/^\s*pull_request_target:/m);
  });

  it("🔴 e NON con `pull_request`: quello lo leggerebbe dalla proposta", () => {
    // Durante il passaggio del 18/09 i due trigger sono convissuti per una
    // proposta sola, perche' altrimenti quella che faceva il cambio non
    // avrebbe trovato nessun controllo. Finita la transizione, resta uno.
    expect(cancello).not.toMatch(/^\s*pull_request:/m);
  });

  it("copre le proposte verso master e verso slave", () => {
    expect(cancello).toMatch(/branches: \[master, slave\]/);
  });
});

describe("che cosa guarda", () => {
  it("valuta esplicitamente la base e la testa", () => {
    expect(cancello).toMatch(/github\.base_ref/);
    expect(cancello).toMatch(/github\.head_ref/);
  });

  it("🔴 verso master pretende esattamente `slave`", () => {
    expect(cancello).toMatch(/BASE" = "master"/);
    expect(cancello).toMatch(/TESTA" != "slave"/);
  });

  it("rifiuta le proposte che arrivano da un fork", () => {
    expect(cancello).toMatch(/head\.repo\.full_name == github\.repository/);
    expect(cancello).toMatch(/fork non entra/);
  });

  it("pretende che slave contenga per intero master", () => {
    expect(cancello).toMatch(/compare\/master\.\.\.slave/);
    expect(cancello).toMatch(/behind_by/);
  });

  it("pretende un rilascio RIUSCITO su Prova per lo stesso commit", () => {
    expect(cancello).toMatch(/environment=anteprima&sha=\$SHA/);
    expect(cancello).toMatch(/riuscito/);
  });

  it("⚠️ dichiara i permessi che gli servono, incluso leggere i rilasci", () => {
    // Senza `deployments: read` la domanda su Prova torna 403 e il cancello
    // fallirebbe sul percorso LECITO: bloccherebbe tutto invece del solo abuso.
    expect(cancello).toMatch(/deployments: read/);
  });

  it("🔴 non fa checkout della proposta: gira col token del repository", () => {
    // E' il prezzo di `pull_request_target`. Eseguire codice che arriva dal
    // ramo proposto, con quel token, sarebbe peggio del buco che chiude.
    expect(cancello).not.toMatch(/actions\/checkout/);
  });

  it("il nome del lavoro e' stabile: un nome che cambia non si puo' richiedere", () => {
    expect(cancello).toMatch(/name: Cancello della filiera/);
    expect(cancello).not.toMatch(/name:.*\$\{\{\s*matrix\./);
  });
});
