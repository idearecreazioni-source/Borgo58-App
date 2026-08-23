// Quanta della roba servita è stata regalata.
//
// Regola di Alessio (23/08/2026), scritta com'è stata data:
//
//     omaggi «altro» ÷ (incassato + omaggi a listino)
//
// «90 € incassati e 10 € di omaggi danno 10%.»
//
// ⚠️ IL DENOMINATORE È LA ROBA SERVITA, non l'incasso. Un conto omaggiato
// incassa zero, quindi dividere per il solo incassato direbbe che si è
// regalato più del 100% delle sere in cui si è regalato tanto. Il valore a
// listino degli omaggi torna dentro perché quella roba è uscita dalla
// cucina come tutto il resto.
//
// ⚠️ E AL NUMERATORE CI SONO SOLO GLI OMAGGI «ALTRO», al denominatore
// TUTTI: è voluto. Cortesia, cliente ricorrente e recupero disservizio
// hanno una ragione che li spiega — sono un investimento o una riparazione;
// «Altro» è quello che resta, ed è quello che Alessio vuole vedere crescere
// o no. Ma tutto ciò che è uscito dalla cucina conta come roba servita.
//
// ⚠️ GLI SCONTI NON ENTRANO, né sopra né sotto: la parte incassata di un
// conto scontato è già dentro «incassato», e la parte rinunciata non è un
// omaggio. Sconti e omaggi restano distinti ovunque nel gestionale.

/**
 * @param {object} n
 * @param {number} n.omaggiAltro   valore a listino degli omaggi con causale «Altro»
 * @param {number} n.incassato     quanto è entrato davvero dai conti chiusi
 * @param {number} n.omaggiTotali  valore a listino di TUTTI gli omaggi
 * @returns {number|null} la percentuale, oppure null quando non si sa
 */
export function percentualeOmaggi({ omaggiAltro, incassato, omaggiTotali }) {
  const sopra = Number(omaggiAltro) || 0;
  const sotto = (Number(incassato) || 0) + (Number(omaggiTotali) || 0);
  // ⚠️ Zero servito NON fa zero per cento: fa «non lo so». Un mese senza
  // nessun conto chiuso e nessun omaggio non ha una percentuale, e uno
  // 0,0% si legge «non abbiamo regalato niente» — che è un'altra cosa
  // (regola: assenza di informazione ≠ informazione di assenza).
  if (sotto <= 0) return null;
  return (sopra / sotto) * 100;
}

/**
 * Somma il valore a listino degli omaggi di un elenco, filtrando per
 * causale quando serve.
 *
 * ⚠️ Il confronto sulla causale è sull'ETICHETTA in minuscolo, e il perché
 * va detto: le causali sono dati di Alessio (`cash_causali`), non un
 * vocabolario del codice — non esiste un identificativo stabile da
 * nominare qui. Se un giorno rinominasse «Altro», il riquadro si
 * svuoterebbe **in silenzio**: è il prezzo, ed è il motivo per cui il
 * riquadro dichiara la causale che sta guardando invece di darla per
 * scontata.
 */
export function omaggiAListino(righe, etichettaCausale = null) {
  const cercata = etichettaCausale?.trim().toLowerCase() ?? null;
  return (righe ?? [])
    .filter((r) => r.type === "omaggio")
    .filter((r) => cercata === null || (r.causale?.label ?? "").trim().toLowerCase() === cercata)
    .reduce((somma, r) => somma + (Number(r.full_amount) || 0), 0);
}

/** L'etichetta della causale che il riquadro degli omaggi guarda. */
export const CAUSALE_ALTRO = "Altro";
