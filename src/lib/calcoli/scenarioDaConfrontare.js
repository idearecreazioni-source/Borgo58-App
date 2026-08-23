// Con quale previsione si confronta l'anno in corso.
//
// 🔴 PERCHE' ESISTE (24/08/2026, seconda metà del difetto della Proiezione).
// «Come sta andando» apriva con la previsione più recente **di qualunque
// anno**: sul progetto di prova c'era un piano del 2027 scritto a mano
// durante il collaudo, e la schermata confrontava i coperti veri del 2026
// con quel piano — mostrando un risultato d'anno di 25,9 milioni di euro
// senza che una sola riga dicesse che quel piano era di un altro anno.
//
// ⚠️ E NON SBAGLIAVA RUMOROSAMENTE: la metà alta della tabella restava
// perfettamente sana (coperti reali, incassato reale, scontrino medio), e
// solo il fondo diventava assurdo. Un numero enorme si nota; un numero
// leggermente diverso, no — ed è quello che sarebbe successo con due
// previsioni di due anni consecutivi scritte con cura.
//
// ⚠️ QUANDO NON C'E' NIENTE DELL'ANNO GIUSTO NON SI RIPIEGA SU UN ALTRO:
// si resta senza. Confrontarsi col piano sbagliato è peggio che non
// confrontarsi — il primo dà numeri falsi con l'aria di essere veri, il
// secondo dice «non lo so», che è la verità.

/**
 * @param {Array<{id: string, anno: number, congelato_il: ?string}>} scenari
 * @param {number} anno l'anno che si sta guardando
 * @returns {?string} l'identificativo da usare, oppure null
 */
export function scegliScenario(scenari, anno) {
  const dellAnno = (scenari ?? []).filter((s) => Number(s.anno) === Number(anno));
  if (dellAnno.length === 0) return null;
  // Fra quelle dell'anno giusto vince una CHIUSA: è la rotta contro cui ha
  // senso confrontarsi, perché nessuno l'ha più ritoccata dopo aver visto
  // com'era andata.
  const congelata = dellAnno.find((s) => s.congelato_il);
  return (congelata ?? dellAnno[0]).id;
}

/**
 * La previsione scelta parla di un altro anno? Serve a DIRLO, non a
 * impedirlo: guardare il 2026 col piano del 2027 può avere senso una
 * volta, per curiosità — quello che non deve succedere è farlo senza
 * saperlo.
 */
export function annoDiverso(scenari, scenarioId, anno) {
  if (!scenarioId) return null;
  const s = (scenari ?? []).find((x) => x.id === scenarioId);
  if (!s) return null;
  return Number(s.anno) === Number(anno) ? null : Number(s.anno);
}
