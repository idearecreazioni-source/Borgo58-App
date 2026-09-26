// =====================================================================
// CHE ORA È ADESSO, PER MEMO — 16/09/2026
// =====================================================================
// 🔴 IL DIFETTO: «mandami una notifica Telegram fra cinque minuti» non
//    poteva funzionare. Al modello si diceva **solo il giorno** — «Oggi è
//    mercoledì 16 settembre 2026 (2026-09-16)» — e mai l'ora. Senza sapere
//    che ore sono, «fra cinque minuti», «fra mezz'ora», «stasera alle otto»
//    non hanno un punto di partenza: il modello risponde che non conosce
//    l'ora attuale, ed è una risposta corretta a una domanda a cui non gli
//    era stato dato modo di rispondere.
//
// ⚠️ PERCHÉ UNA FUNZIONE A SÉ, e non due righe dentro `index.ts`: così si
//    può PROVARE. Dentro la funzione online, il riferimento temporale
//    nascerebbe da `new Date()` e nessuna prova potrebbe fissarlo; qui si
//    passa l'istante e la risposta è sempre la stessa. Le prove stanno in
//    `tests/unita/adesso-a-voce.test.js` e coprono anche i due casi che si
//    sbagliano in silenzio: la mezzanotte e l'ora legale.
//
// ⚠️ IL FUSO È QUELLO DEL LOCALE, NON QUELLO DEL SERVER. Le funzioni online
//    girano a Greenwich: chiedere l'ora al server senza dichiarare il fuso
//    darebbe, d'estate, **due ore indietro** — e «fra cinque minuti»
//    diventerebbe un avviso già passato, che il database rifiuta. Il passaggio
//    da ora legale a solare lo fa `Intl` col database dei fusi, non un +1/+2
//    scritto a mano che sarebbe falso per metà anno.
//
// ⚠️ E NON È UN DATO SENSIBILE: è l'ora del giorno, quella che si legge da
//    qualunque orologio. Non finisce nei registri e non porta con sé niente
//    di riservato.

const FUSO = "Europe/Rome";

/** Le parti di un istante, lette nel fuso del locale. */
function pezzi(istante: Date): Record<string, string> {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const p of f.formatToParts(istante)) out[p.type] = p.value;
  // ⚠️ A mezzanotte `hour` può arrivare «24» invece di «00» (è ammesso dallo
  //    standard con `hour12: false`): lasciarlo passare produrrebbe «24:03»,
  //    che non è un'ora e che il database butterebbe via — cioè l'avviso
  //    sparirebbe proprio nel caso che questa funzione esiste per salvare.
  if (out.hour === "24") out.hour = "00";
  return out;
}

/**
 * Il riferimento temporale da dare a MEMO: giorno e ora **del locale**.
 *
 * @param istante quando si sta parlando (il chiamante passa `new Date()`).
 * @returns `{ iso, ora, giorno }` — la data come AAAA-MM-GG, l'ora come
 *          HH:MM in ventiquattr'ore, e il giorno scritto in italiano.
 */
export function riferimentoTemporale(istante: Date): {
  iso: string;
  ora: string;
  giorno: string;
} {
  const p = pezzi(istante);
  return {
    iso: `${p.year}-${p.month}-${p.day}`,
    ora: `${p.hour}:${p.minute}`,
    giorno: new Intl.DateTimeFormat("it-IT", {
      timeZone: FUSO,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(istante),
  };
}

/**
 * La frase che apre il messaggio al modello.
 *
 * ⚠️ Dice il giorno E l'ora, e lo dice in modo che il modello non debba
 * indovinare il fuso: è l'ora del locale, non quella del server.
 */
export function fraseDiAdesso(istante: Date): string {
  const r = riferimentoTemporale(istante);
  return `Oggi è ${r.giorno} (${r.iso}) e in questo momento in Italia sono le ${r.ora}.`;
}
