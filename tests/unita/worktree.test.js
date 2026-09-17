// =====================================================================
// LE REGOLE PER CHIUDERE UN WORKTREE — e il caso che le ha fatte nascere
// =====================================================================
//
// 🔴 QUESTA PROVA NASCE DA UN DANNO VERO, il 17/09/2026: una pulizia
//    automatica ha svuotato `.codex/worktrees/7282/Borgo58-App`, che era
//    **pulito** e **interamente contenuto in master** — e per quei due soli
//    motivi era stato classificato eliminabile. Era in uso da un altro
//    strumento. Le prove qui sotto sono quel caso, scritto in modo che non
//    possa ripresentarsi in silenzio.

import { describe, it, expect } from "vitest";
import { problemaNelChiudere, diUnAltroStrumento } from "../../scripts/worktree.mjs";

const pulito = (extra = {}) => ({
  percorso: "C:/Users/User/Documents/lavoro/Borgo58-App-b10",
  modifiche: 0,
  nonInMaster: 0,
  principale: false,
  esiste: true,
  ...extra,
});

describe("di chi e' questa cartella", () => {
  it("riconosce le cartelle di Codex", () => {
    expect(diUnAltroStrumento("C:/Users/User/.codex/worktrees/7282/Borgo58-App")).toBe(true);
  });

  it("riconosce le cartelle temporanee, con le barre in tutti e due i versi", () => {
    expect(diUnAltroStrumento("C:/Users/User/AppData/Local/Temp/claude/x")).toBe(true);
    expect(diUnAltroStrumento("C:\\Users\\User\\AppData\\Local\\Temp\\claude\\x")).toBe(true);
  });

  it("una cartella di lavoro normale non e' di nessun altro", () => {
    expect(diUnAltroStrumento("C:/Users/User/Documents/lavoro/Borgo58-App-b10")).toBe(false);
  });
});

describe("si puo' chiudere?", () => {
  it("un worktree normale, pulito e gia' in master, si chiude", () => {
    expect(problemaNelChiudere(pulito())).toBeNull();
  });

  it("🔴 IL CASO DEL 17/09: pulito, in master, ma di un altro strumento — NON si chiude", () => {
    const w = pulito({ percorso: "C:/Users/User/.codex/worktrees/7282/Borgo58-App" });
    // era esattamente questa la combinazione che la vecchia pulizia chiamava
    // «ridondante»: nessuna modifica, nessun commit fuori da master.
    expect(w.modifiche).toBe(0);
    expect(w.nonInMaster).toBe(0);
    expect(problemaNelChiudere(w)).toMatch(/un altro strumento/);
  });

  it("con modifiche non salvate non si chiude, e lo dice col numero", () => {
    expect(problemaNelChiudere(pulito({ modifiche: 3 }))).toMatch(/3 modifiche/);
  });

  it("con commit fuori da master non si chiude, e lo dice col numero", () => {
    expect(problemaNelChiudere(pulito({ nonInMaster: 26 }))).toMatch(/26 commit/);
  });

  it("la copia principale non si chiude mai", () => {
    expect(problemaNelChiudere(pulito({ principale: true }))).toMatch(/principale/);
  });

  it("⚠️ il lavoro non salvato viene PRIMA di ogni altra ragione", () => {
    // Se un worktree e' insieme sporco e di un altro strumento, il messaggio
    // deve nominare la cosa irreparabile, non quella recuperabile.
    const w = pulito({ percorso: "C:/Users/User/.codex/x", modifiche: 2 });
    expect(problemaNelChiudere(w)).toMatch(/2 modifiche/);
  });

  it("una cartella sparita chiede una potatura, non una chiusura", () => {
    const w = pulito({ percorso: "C:/percorso/che/non/esiste/mai", esiste: false });
    expect(problemaNelChiudere(w)).toMatch(/potatura/);
  });
});
