// QUALE SERA È QUESTA — il posto solo, e nominato.
//
// ⚠️ IL PROBLEMA, detto da Alessio il 18/08/2026: *«se voglio sapere quanto
// ho incassato ieri e un conto è stato emesso dopo la mezzanotte, non va
// conteggiato nel giorno dopo»*. Una serata comincia alle 19 e finisce
// all'una: **non coincide col giorno di calendario**, e finché quel concetto
// non esiste nel programma la stessa trappola ricompare ogni volta che
// qualcuno scrive una data in un posto nuovo. È già successo cinque volte
// (audit dell'08/08 su 14 punti JavaScript, lo scenario di collaudo del
// 17/08, e i 18 punti SQL misurati il 18/08).
//
// ⚠️ E ATTENZIONE A COSA NON RISOLVE `oggiLocale()`. Quella funzione cura la
// trappola del fuso — la data UTC che fra mezzanotte e le due dà ieri — ed è
// giusta per il **giorno di calendario**. Ma alle 00:30, col locale ancora
// aperto, `oggiLocale()` dice **domani**: è il difetto che questo file
// chiude in Comande, dove la sala cambiava sotto le mani dei camerieri a
// mezzanotte.
//
// ⚠️ L'ORA NON STA QUI: è un dato di Alessio (`service_settings.ora_fine_serata`,
// oggi le 05:00). Scriverla qui e poi ricopiarla in una funzione del
// database darebbe **due orologi che possono divergere** — ed è il motivo
// per cui questa è una funzione PURA che riceve il numero invece di
// contenerlo. Quando gli 11 punti SQL verranno convertiti leggeranno lo
// stesso valore, e la prova d'ingresso di quel lavoro è che sullo stesso
// istante le due strade diano la stessa serata.

/**
 * Che sera è, in un certo istante.
 *
 * @param adesso        Date — il momento da interpretare
 * @param oraFineSerata "HH:MM" o "HH:MM:SS" — da service_settings
 * @returns "AAAA-MM-GG" — la serata di servizio, non il giorno di calendario
 */
export function serataDiServizio(adesso, oraFineSerata) {
  const confine = minutiDa(oraFineSerata);
  const minutiAdesso = adesso.getHours() * 60 + adesso.getMinutes();
  // Prima del confine è ancora la sera prima: si torna indietro di un
  // giorno. Il calcolo è sulle componenti LOCALI della data, mai su
  // toISOString() — che è il fuso di Greenwich e sbaglia da solo.
  const g = new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate());
  if (minutiAdesso < confine) g.setDate(g.getDate() - 1);
  return `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, "0")}-${String(g.getDate()).padStart(2, "0")}`;
}

function minutiDa(ora) {
  if (!ora) return 0;
  const [h, m] = String(ora).split(":");
  return Number(h) * 60 + Number(m ?? 0);
}

// Le tre fasce, coi nomi che usa il database (`turni_del_giorno`).
//
// ⚠️ I confini NON sono qui: vengono dagli orari di **quel servizio** —
// `service_hours.ora_primo_turno` e `service_hours.ultimo_ingresso`. La
// domenica è pranzo, e tre fasce calcolate sugli orari della cena
// direbbero «può servire una seconda volta» a chiunque pranzi.
export const FASCE = {
  presto: {
    etichetta: "primo giro",
    spiega: "arriva presto: il tavolo può servire una seconda volta",
  },
  pieno: {
    etichetta: "occupa la serata",
    spiega: "arriva a servizio avviato: il tavolo resta suo",
  },
  tardi: {
    etichetta: "ultimo giro",
    spiega: "arriva dopo l'ultimo ingresso: è l'ultimo turno del tavolo",
  },
};
