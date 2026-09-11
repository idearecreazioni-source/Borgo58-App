// =====================================================================
// LA SETTIMANA DELL'AGENDA — le regole pure (11/09/2026)
// =====================================================================
// 🔴 Mandato notturno «Agenda settimanale»: una vista da lunedì a domenica
//    sugli STESSI impegni del mese. Qui non si decide niente sugli impegni
//    — scadenze, ricorrenze, promemoria restano quelli che sono — si decide
//    soltanto quali giorni sono una settimana e in che ordine si leggono.
//
// ⚠️ LE DATE SI CONTANO A MEZZOGIORNO DI GREENWICH, e non è pignoleria: la
//    settimana del 19 ottobre 2026 contiene il cambio dell'ora (il 25). Un
//    giorno sommato a mezzanotte locale può saltare o ripetere una data
//    proprio in quella settimana; a mezzogiorno UTC un giorno è sempre un
//    giorno. Le date entrano e escono come testo «AAAA-MM-GG», già nel
//    fuso del locale (`oggiLocale()`).

const aMezzogiorno = (iso) => new Date(`${iso}T12:00:00Z`);
const testo = (d) => d.toISOString().slice(0, 10);

/** La data `n` giorni dopo (o prima, con `n` negativo). */
export function spostaGiorni(iso, n) {
  const d = aMezzogiorno(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return testo(d);
}

/** Il lunedì della settimana che contiene quel giorno. La domenica è l'ultimo giorno. */
export function lunediDi(iso) {
  const giornoDellaSettimana = (aMezzogiorno(iso).getUTCDay() + 6) % 7; // lunedì = 0
  return spostaGiorni(iso, -giornoDellaSettimana);
}

/** I sette giorni, da lunedì a domenica. */
export function giorniDellaSettimana(lunedi) {
  return Array.from({ length: 7 }, (_, i) => spostaGiorni(lunedi, i));
}

/** La settimana prima (`-1`) o dopo (`+1`). */
export const spostaSettimana = (lunedi, quante) => spostaGiorni(lunedi, 7 * quante);

const NOMI = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const CORTI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

/** Come si chiama un giorno: «Lunedì», «Lun», 7, «settembre». */
export function nomeDelGiorno(iso) {
  const d = aMezzogiorno(iso);
  const i = (d.getUTCDay() + 6) % 7;
  return { nome: NOMI[i], corto: CORTI[i], numero: d.getUTCDate(), mese: MESI[d.getUTCMonth()] };
}

/**
 * Il titolo della settimana: «7 – 13 settembre 2026».
 *
 * ⚠️ Il mese e l'anno si ripetono solo quando cambiano dentro la settimana
 * («28 settembre – 4 ottobre 2026», «28 dicembre 2026 – 3 gennaio 2027»):
 * scriverli sempre allunga il titolo su un telefono senza dire niente in più.
 */
export function etichettaSettimana(lunedi) {
  const a = aMezzogiorno(lunedi);
  const b = aMezzogiorno(spostaGiorni(lunedi, 6));
  const [ga, ma, aa] = [a.getUTCDate(), MESI[a.getUTCMonth()], a.getUTCFullYear()];
  const [gb, mb, ab] = [b.getUTCDate(), MESI[b.getUTCMonth()], b.getUTCFullYear()];
  if (aa !== ab) return `${ga} ${ma} ${aa} – ${gb} ${mb} ${ab}`;
  if (ma !== mb) return `${ga} ${ma} – ${gb} ${mb} ${ab}`;
  return `${ga} – ${gb} ${mb} ${ab}`;
}

/** L'ora di un impegno come si legge («18:30»), oppure `null` se non ce l'ha. */
export function oraBreve(t) {
  const v = t?.due_time;
  return typeof v === "string" && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : null;
}

/**
 * L'ORDINE DENTRO UN GIORNO.
 *
 * ⚠️ SENZA ORA PRIMA, poi per ora, a pari ora per titolo. Un impegno senza
 * ora vale per tutta la giornata — come la «giornata intera» dei calendari —
 * e metterlo in fondo lo farebbe sembrare l'ultima cosa della sera. È una
 * scelta dichiarata nel riepilogo: il mandato dice «ordinati per ora», e
 * non dice dove vanno quelli che un'ora non ce l'hanno.
 */
function ordine(a, b) {
  const oa = oraBreve(a);
  const ob = oraBreve(b);
  if (oa !== ob) {
    if (oa === null) return -1;
    if (ob === null) return 1;
    return oa < ob ? -1 : 1;
  }
  return String(a?.title ?? "").localeCompare(String(b?.title ?? ""), "it");
}

/**
 * Gli impegni divisi nei sette giorni, ognuno in ordine.
 *
 * ⚠️ Un giorno senza impegni c'è lo stesso, con l'elenco vuoto: la
 * settimana è sempre di sette giorni, e un giorno che sparisce si legge
 * «l'ho saltato» invece che «è libero».
 */
export function impegniDellaSettimana(righe, giorni) {
  const per = Object.fromEntries(giorni.map((g) => [g, []]));
  for (const t of righe ?? []) {
    if (t?.due_date && per[t.due_date]) per[t.due_date].push(t);
  }
  return giorni.map((g) => ({ giorno: g, impegni: [...per[g]].sort(ordine) }));
}
