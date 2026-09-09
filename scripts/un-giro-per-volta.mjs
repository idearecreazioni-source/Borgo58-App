// =====================================================================
// UN GIRO PER VOLTA — 10/09/2026
// =====================================================================
// 🔴 NON È UN SOSPETTO, È UN INCIDENTE GIÀ SUCCESSO. Il 27/08 un giro di
//    prove è stato lanciato in primo piano mentre un altro girava in
//    sottofondo **sullo stesso progetto di prova**: 41 file falliti e 223
//    prove saltate, che sembravano un disastro del codice. Rilanciato da
//    solo: tutte verdi.
//
// ⚠️ E LA REGOLA C'ERA GIÀ, SCRITTA: *«le prove sull'app girano in fila,
//    mai in parallelo: il database è uno solo»*. Era una regola che viveva
//    nella memoria di chi lancia il comando — e la memoria, in una giornata
//    lunga, si degrada. Qui diventa una porta chiusa.
//
// ⚠️ COSA COPRE E COSA NO, detto perché non si creda protetto più di
//    quanto sia: copre due giri **su questa macchina**. NON copre un giro
//    locale mentre la coda di GitHub sta girando sullo stesso progetto —
//    per quello servirebbe un lucchetto nel database, cioè una migrazione,
//    e nessuno ha ancora misurato che quel caso sia davvero capitato.
//
// ⚠️ IL LUCCHETTO SCADE. Un giro ucciso a metà lascerebbe il file lì per
//    sempre, e da domani nessuno potrebbe più lanciare le prove: dopo
//    `MINUTI_DI_SCADENZA` il lucchetto si considera abbandonato e si
//    prende. La scadenza è più lunga del tetto di un giro (40 minuti),
//    altrimenti un giro lento si vedrebbe rubare il posto da se stesso.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const MINUTI_DI_SCADENZA = 50;

export const dovStaIlLucchetto = () =>
  path.join(os.tmpdir(), "borgo58-prove-app.lock");

/** Chi lo tiene, se qualcuno lo tiene ancora. */
export function chiLoTiene(ora = Date.now(), dove = dovStaIlLucchetto()) {
  if (!fs.existsSync(dove)) return null;
  let dentro;
  try {
    dentro = JSON.parse(fs.readFileSync(dove, "utf8"));
  } catch {
    // Un lucchetto illeggibile è un lucchetto abbandonato: non si eredita
    // un divieto da un file che non si riesce nemmeno a leggere.
    return null;
  }
  const da = Number(dentro?.quando ?? 0);
  if (!Number.isFinite(da) || ora - da > MINUTI_DI_SCADENZA * 60_000) return null;
  // ⚠️ Se il processo che l'aveva preso non c'è più, il lucchetto è di
  //    nessuno: succede a ogni Ctrl+C, e senza questo controllo il primo
  //    giro interrotto bloccherebbe tutti gli altri fino alla scadenza.
  if (dentro?.pid && !processoVivo(dentro.pid)) return null;
  return { pid: dentro.pid, quando: da, minuti: Math.round((ora - da) / 60_000) };
}

export function processoVivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM: esiste ma è di un altro utente. Esiste è quello che conta.
    return e?.code === "EPERM";
  }
}

/** Prende il lucchetto, o dice chi lo tiene. */
export function prendi(pid = process.pid, ora = Date.now(), dove = dovStaIlLucchetto()) {
  const altrui = chiLoTiene(ora, dove);
  if (altrui) return { preso: false, altrui };
  fs.writeFileSync(dove, JSON.stringify({ pid, quando: ora }), "utf8");
  return { preso: true, altrui: null };
}

/** Lo lascia, ma solo se è ancora suo. */
export function lascia(pid = process.pid, dove = dovStaIlLucchetto()) {
  try {
    const dentro = JSON.parse(fs.readFileSync(dove, "utf8"));
    if (dentro?.pid !== pid) return false;
    fs.rmSync(dove);
    return true;
  } catch {
    return false;
  }
}

/** La frase che si legge quando il posto è occupato. */
export function frasePerChiAspetta(altrui) {
  return [
    "FERMO: c'e' gia' un giro di prove in corso su questo computer.",
    `  lo tiene il processo ${altrui.pid}, da ${altrui.minuti} minuti.`,
    "",
    "Il database di prova e' uno solo: due giri insieme si cancellano le righe",
    "a vicenda, e il risultato sembra un disastro del codice invece che una",
    "collisione. E' successo il 27/08: 41 file falliti, tutte verdi al rilancio.",
    "",
    "Aspetta che finisca, oppure — se quel giro non esiste piu' — cancella:",
    `  ${dovStaIlLucchetto()}`,
  ].join("\n");
}
