// =====================================================================
// LA CHIUSURA DELL'ANNO — LE REGOLE, SEPARATE DAL DISEGNO (C5, 23/09/2026)
// =====================================================================
// ⚠️ PERCHE' QUI E NON DENTRO LA SCHERMATA. In questo progetto le prove
//    pure non hanno un ambiente DOM: quello che si puo' provare e' **quale
//    delle tre cose la schermata dira'**, non come si vede. Separando la
//    decisione dal disegno, la parte dove il difetto vive resta provabile
//    — stesso taglio di `segnoDelTavolo()` per i colori della sala e di
//    `statoLettura()` per i dati non letti.
//
// 🔴 E IL FERMO SU L21 VIVE QUI DENTRO, non in una frase scritta a mano
//    dentro un JSX. Il quesito L21 alla commercialista e' APERTO: *un
//    conto dell'anno scorso regolarizzato dopo la chiusura, dove finisce?*
//    Il gestionale non lo decide — conta quei conti, li mostra, chiede
//    conferma, e **lo dichiara a chi guarda lo storico**. Se un giorno
//    qualcuno togliesse quella frase, `tests/unita/chiusura-anno.test.js`
//    diventa rosso: e' l'unico modo perche' una decisione aperta non si
//    nasconda dentro il codice.

import { formatEUR } from "../constants";

/** Il quesito aperto che questa schermata NON risolve. */
export const QUESITO_APERTO = "L21";

/**
 * I TRE STATI, e sono tre perche' due non bastano.
 *
 *   "anno_non_finito" → non si puo' ancora chiudere. Non e' un rifiuto per
 *                       mancanza di dati: e' che l'anno non e' passato.
 *   "gia_chiuso"      → c'e' gia' una fotografia per quel soggetto e
 *                       quell'anno. Non se ne fa una seconda accanto.
 *   "con_avviso"      → si puo' chiudere, ma restano conti senza
 *                       documento: serve una conferma esplicita.
 *   "pulita"          → si puo' chiudere e non c'e' niente da dichiarare.
 *
 * ⚠️ L'ordine dei casi NON e' indifferente, ed e' la parte che si puo'
 *    sbagliare senza che niente diventi rosso: «l'anno non e' finito» e
 *    «e' gia' chiuso» vengono PRIMA dell'avviso, perche' in quei due casi
 *    la conferma non serve a niente — chiedere una conferma per un gesto
 *    che verra' rifiutato comunque insegna a premere «sì» senza leggere.
 */
export function statoChiusura(misure, giaChiusa = false) {
  if (!misure) return "sconosciuto";
  if (!misure.anno_finito) return "anno_non_finito";
  if (giaChiusa) return "gia_chiuso";
  return Number(misure.conti_senza_documento ?? 0) > 0 ? "con_avviso" : "pulita";
}

/** Serve una conferma esplicita del titolare per procedere? */
export function serveConferma(misure, giaChiusa = false) {
  return statoChiusura(misure, giaChiusa) === "con_avviso";
}

/** Si puo' chiudere, con o senza conferma? */
export function siPuoChiudere(misure, giaChiusa = false) {
  const s = statoChiusura(misure, giaChiusa);
  return s === "pulita" || s === "con_avviso";
}

/**
 * LA FRASE DELL'AVVISO, e dice tre cose in quest'ordine: quanti sono,
 * quanto valgono, e che **restano dove sono**.
 *
 * ⚠️ La terza non e' una rassicurazione di cortesia: e' la sola cosa che
 *    impedisce a chi legge di credere che confermare significhi
 *    «sistemali». Confermare significa soltanto «li ho visti».
 */
export function fraseAvviso(quanti, importo) {
  const n = Number(quanti ?? 0);
  if (n <= 0) return "";
  const quale = n === 1 ? "1 conto" : `${n} conti`;
  return (
    `${quale} senza documento fiscale, per ${formatEUR(Number(importo ?? 0))}. ` +
    "Chiudendo restano esattamente dove sono: il gestionale non li sposta e non li classifica."
  );
}

/**
 * 🔴 LA FRASE CHE TIENE L21 APERTA NELLO STORICO.
 *
 * Compare **solo** dove il dubbio c'e' davvero — su una chiusura che ha
 * lasciato indietro dei conti — e non sopra la schermata, dove la si
 * leggerebbe il primo giorno e mai piu' (regola del 18/08).
 */
export function fraseRegolarizzazioneSuccessiva(quanti) {
  if (Number(quanti ?? 0) <= 0) return "";
  return (
    "Se li regolarizzi adesso, se finiscono nell'anno in cui il cliente ha mangiato " +
    "o in quello in cui esce il documento non l'ha ancora deciso nessuno: " +
    `è il quesito ${QUESITO_APERTO} alla commercialista, ancora aperto. ` +
    "Questa chiusura non l'ha deciso al posto suo."
  );
}

/**
 * Come si legge una riga dello storico: pulita o con avviso.
 *
 * ⚠️ NON C'E' UNA COLONNA «chiusa con avviso», ed e' voluto: sarebbe un
 *    secondo posto che dice la stessa cosa del conteggio e che potrebbe
 *    contraddirlo. *Quando due colonne direbbero la stessa cosa, la
 *    seconda e' un riflesso* — e un riflesso che si puo' ricavare non si
 *    scrive affatto.
 */
export function chiusuraConAvviso(riga) {
  return Number(riga?.conti_senza_documento ?? 0) > 0;
}

/** Il primo e l'ultimo giorno dell'anno, per chiedere l'elenco dei conti. */
export function estremiDellAnno(anno) {
  const a = Number(anno);
  return { dal: `${a}-01-01`, al: `${a}-12-31` };
}

/**
 * Quanti dei dodici mesi erano gia' fotografati, detto in italiano.
 *
 * ⚠️ Non e' un prerequisito e la frase non deve farlo sembrare tale: un
 *    anno si chiude anche con zero mesi chiusi. Dice **da dove viene** la
 *    fotografia, che e' un'altra cosa.
 */
export function fraseMesiFotografati(quanti) {
  const n = Number(quanti ?? 0);
  if (n === 0) return "Nessun mese è stato chiuso: l'anno è misurato tutto adesso.";
  if (n === 12) return "Tutti e dodici i mesi erano già chiusi: la fotografia viene da loro.";
  return `${n} mesi su 12 erano già chiusi: quelli restanti sono misurati adesso.`;
}
