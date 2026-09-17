// =====================================================================
// I WORKTREE: CENSIRLI, E CHIUDERLI SENZA FARE DANNI — 18/09/2026
// =====================================================================
//
// PERCHE' ESISTE, e non e' una comodita'. Il 17/09/2026 una pulizia
// automatica ha rimosso 16 worktree su 25. Due di quelli erano cartelle di
// lavoro di un altro strumento (`.codex/worktrees/...`), e uno era **in uso**.
//
// 🔴 IL DANNO NON E' STATO LA CANCELLAZIONE: e' stato che il programma ha
//    DETTO IL CONTRARIO DI QUELLO CHE ERA SUCCESSO. `git worktree remove` su
//    Windows ha tolto il contenuto e la registrazione, poi non e' riuscito a
//    togliere la cartella vuota e ha restituito un codice di errore. Chi
//    guardava ha letto «RIFIUTATO: resta», e la cartella era gia' svuotata.
//    *Un esito riassunto dal codice di uscita invece che dai fatti.*
//
// 🔴 E LA CLASSIFICAZIONE ERA SBAGLIATA ALLA RADICE: «pulito e interamente
//    contenuto in master» diceva soltanto che non si perdeva **codice**. Non
//    diceva niente su chi stesse **lavorando** li' dentro. Un worktree di un
//    altro processo e' in uso anche quando e' pulito — anzi: e' pulito
//    *perche'* quel processo ha appena finito di committare.
//
// Da qui le due regole di questo programma:
//   1. un worktree che appartiene a uno strumento NON si chiude mai da qui;
//   2. dopo ogni chiusura si RIGUARDA lo stato, invece di credere al codice
//      di uscita.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

// ⚠️ I PERCORSI CHE APPARTENGONO A QUALCUN ALTRO. Non e' un elenco di gusti:
//    e' l'elenco delle cartelle in cui un altro programma crea e distrugge
//    worktree per conto suo, e dove una nostra pulizia gli toglie il tavolo
//    da sotto le mani mentre ci lavora.
export const CARTELLE_DI_ALTRI = [".codex", "AppData/Local/Temp", "AppData\\Local\\Temp", "/tmp/"];

/** Questo percorso e' il campo di un altro strumento? */
export function diUnAltroStrumento(percorso) {
  const p = String(percorso || "").replace(/\\/g, "/");
  return CARTELLE_DI_ALTRI.some((c) => p.includes(String(c).replace(/\\/g, "/")));
}

/**
 * Si puo' chiudere questo worktree?
 *
 * 🔴 RISPONDE «no» PER UNA RAGIONE SOLA ALLA VOLTA, e la ragione e' il
 *    messaggio: un rifiuto che non dice perche' viene aggirato al secondo giro.
 * ⚠️ L'ordine conta: prima cio' che e' irreparabile (lavoro non salvato),
 *    poi cio' che e' recuperabile ma altrui (un altro strumento), infine il
 *    caso ovvio (e' la copia principale).
 */
export function problemaNelChiudere(w) {
  if (w.principale) return "e' la copia di lavoro principale: non si chiude.";
  if (w.modifiche > 0)
    return `ha ${w.modifiche} modifiche non salvate. Prima si committano o si mettono da parte.`;
  if (w.nonInMaster > 0)
    return `ha ${w.nonInMaster} commit che non stanno in master. Prima si uniscono o si spingono.`;
  if (diUnAltroStrumento(w.percorso))
    return "sta nella cartella di un altro strumento: potrebbe essere in uso proprio adesso, e «pulito» non vuol dire «libero». Chiudilo da li'.";
  if (!existsSync(w.percorso)) return "la cartella non c'e' piu': serve una potatura, non una chiusura.";
  return null;
}

const git = (...a) => {
  const r = spawnSync("git", a, { encoding: "utf8" });
  return (r.stdout || "").trim();
};

/** L'elenco vero, letto da git e non da una lista tenuta a mano. */
export function censimento() {
  const grezzo = git("worktree", "list", "--porcelain");
  const blocchi = grezzo.split(/\n\n+/).filter(Boolean);
  const principale = git("rev-parse", "--path-format=absolute", "--show-toplevel");
  return blocchi.map((b) => {
    const percorso = (b.match(/^worktree (.+)$/m) || [])[1] || "";
    const testa = (b.match(/^HEAD (.+)$/m) || [])[1] || "";
    const ramo = (b.match(/^branch refs\/heads\/(.+)$/m) || [])[1] || null;
    const esiste = existsSync(percorso);
    const modifiche = esiste
      ? git("-C", percorso, "status", "--porcelain").split("\n").filter(Boolean).length
      : 0;
    const nonInMaster = testa
      ? Number(git("rev-list", "--count", `origin/master..${testa}`) || 0)
      : 0;
    return {
      percorso,
      testa,
      ramo,
      esiste,
      vuota: esiste && readdirSync(percorso).length === 0,
      modifiche,
      nonInMaster,
      principale: percorso.replace(/\\/g, "/") === principale.replace(/\\/g, "/"),
      diAltri: diUnAltroStrumento(percorso),
    };
  });
}

function stampa(elenco) {
  console.log(`Worktree registrati: ${elenco.length}`);
  for (const w of elenco) {
    const etichette = [
      w.principale ? "PRINCIPALE" : null,
      w.diAltri ? "DI UN ALTRO STRUMENTO" : null,
      !w.esiste ? "CARTELLA ASSENTE" : null,
      w.vuota ? "CARTELLA VUOTA" : null,
      w.modifiche > 0 ? `${w.modifiche} modifiche` : null,
      w.nonInMaster > 0 ? `${w.nonInMaster} commit fuori da master` : null,
    ].filter(Boolean);
    const problema = problemaNelChiudere(w);
    console.log(`\n  ${w.ramo || "(staccato)"} — ${w.testa.slice(0, 7)}`);
    console.log(`    ${w.percorso}`);
    if (etichette.length) console.log(`    ${etichette.join(" · ")}`);
    console.log(`    chiudibile da qui: ${problema ? "NO — " + problema : "si"}`);
  }
}

function chiudi(percorso) {
  const prima = censimento().find(
    (w) => w.percorso.replace(/\\/g, "/") === String(percorso).replace(/\\/g, "/"),
  );
  if (!prima) {
    console.error(`Non risulta registrato nessun worktree in ${percorso}.`);
    process.exit(1);
  }
  const problema = problemaNelChiudere(prima);
  if (problema) {
    console.error(`Non lo chiudo: ${problema}`);
    process.exit(1);
  }
  spawnSync("git", ["worktree", "remove", percorso], { encoding: "utf8" });

  // 🔴 QUI STA LA LEZIONE DEL 17/09: NON SI CREDE AL CODICE DI USCITA.
  //    Si riguarda lo stato e si dice quello che si vede.
  const dopo = censimento().find(
    (w) => w.percorso.replace(/\\/g, "/") === String(percorso).replace(/\\/g, "/"),
  );
  const cartella = existsSync(percorso);
  if (!dopo && !cartella) {
    console.log(`Chiuso: ${percorso}`);
    return;
  }
  if (!dopo && cartella) {
    console.log(
      `Chiuso a meta': la registrazione non c'e' piu', la cartella e' rimasta (${percorso}).`,
    );
    console.log("    Il contenuto e' stato tolto. Se serviva, si ricrea con: git worktree add");
    process.exit(2);
  }
  console.log(`Non e' stato chiuso: risulta ancora registrato (${percorso}).`);
  process.exit(1);
}

// ⚠️ LA PARTE CHE PARLA GIRA SOLO SE IL PROGRAMMA E' STATO LANCIATO, non
//    quando le sue regole vengono IMPORTATE da una prova. Senza questa
//    guardia, `npm run test` aprirebbe git a ogni import — e una prova che
//    fa partire il programma che dovrebbe esaminare non e' una prova.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const argomenti = process.argv.slice(2);
  if (argomenti[0] === "--chiudi") {
    if (!argomenti[1]) {
      console.error("Serve il percorso: npm run worktree -- --chiudi <percorso>");
      process.exit(1);
    }
    chiudi(argomenti[1]);
  } else {
    stampa(censimento());
  }
}
