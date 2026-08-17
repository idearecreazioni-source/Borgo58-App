// L'esito di un ricevimento merci: una definizione sola.
//
// 🔴 IL DIFETTO CHE QUESTA FUNZIONE CHIUDE (collaudo del 17/08). Il manuale
// HACCP **si contraddiceva da solo**: nella sezione «Ricevimento merci» una
// consegna risultava «conforme», e due sezioni più sotto la stessa consegna
// compariva fra le non conformità — imballaggio non integro, respinta e
// sostituita.
//
// La colonna «Esito» guardava solo `conformity`, cioè la casella «merce
// conforme», e ignorava `packaging_ok` — che è proprio ciò che aveva aperto
// la non conformità. Lo stesso errore era nella schermata: la pastiglia
// «non conforme» compariva solo su `!conformity`, quindi una consegna con
// l'imballaggio rotto sembrava una consegna normale.
//
// ⚠️ Perché è più grave di quanto sembri: **il manuale è il documento che
// si mostra a un ispettore.** Una contraddizione lì dentro vale meno di
// zero — toglie credito a entrambe le righe, anche a quella giusta.
//
// ⚠️ E LA REGOLA VERA NON È «guarda anche l'imballaggio»: è che il verdetto
// deve essere **la stessa condizione con cui il database apre la non
// conformità**, né più né meno. `registra_ricevimento_merci` calcola
//     v_male := not conformity or not packaging_ok
// e apre la non conformità su quella. Se qui si aggiungesse anche la
// temperatura — che il database registra ma NON usa per aprire niente — la
// contraddizione tornerebbe, solo girata: il manuale direbbe «non conforme»
// su consegne per cui non esiste nessuna non conformità.
//
// Sta in un modulo puro apposta: la usano il manuale, la schermata e
// l'esportazione, e tre posti che rifanno il confronto per conto proprio
// sono tre posti che possono tornare a contraddirsi.

/**
 * @param {{conformity?: boolean, packaging_ok?: boolean}} riga
 * @returns {{conforme: boolean, motivi: string[], etichetta: string}}
 */
export function esitoRicevimento(riga) {
  const motivi = [];
  // `=== false` e non `!valore`: le due colonne hanno un valore predefinito
  // vero, ma un `null` che arrivasse da un dato vecchio non deve diventare
  // «non conforme» per caso — una non conformità inventata su un registro
  // sanitario è un difetto quanto una taciuta.
  if (riga?.conformity === false) motivi.push("prodotto non conforme");
  if (riga?.packaging_ok === false) motivi.push("imballaggio non integro");

  return {
    conforme: motivi.length === 0,
    motivi,
    // La frase che va nel registro. «Non conforme» senza il perché
    // costringe chi legge a cercarlo in un'altra sezione — che è
    // esattamente il giro che ha prodotto la contraddizione.
    etichetta: motivi.length === 0 ? "conforme" : motivi.join(", "),
  };
}
