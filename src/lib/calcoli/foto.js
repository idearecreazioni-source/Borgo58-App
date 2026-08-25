// Le regole di una foto mandata all'assistente.
//
// ⚠️ STANNO QUI E NON DENTRO LA SCHERMATA per la ragione di sempre: una
//    regola dentro un componente si prova solo aprendo quel componente, e
//    in questo progetto nessuna prova automatica guarda una schermata.
//    Qui invece si provano al contrario — con una foto piu' grande del
//    tetto, con una gia' piccola, con una lunga e stretta.

// ⚠️ MILLECINQUECENTOSESSANTOTTO PUNTI SUL LATO LUNGO, e non e' un numero
//    tondo scelto a caso: e' la misura oltre la quale chi legge le
//    immagini le rimpicciolisce comunque per conto suo. Mandarne una piu'
//    grande costa piu' tempo di rete e piu' soldi senza aggiungere un solo
//    dettaglio leggibile.
//    ⚠️ E rimpicciolire ha un limite che va nella direzione opposta: la
//    scritta piccola di un elenco ingredienti deve restare leggibile.
//    Sotto questa misura si comincerebbe a perdere proprio la parte per
//    cui la foto viene scattata.
export const LATO_MASSIMO = 1568;

// Oltre questo peso la richiesta non arriva: la rete che sta nella
// funzione online rifiuta, e qui si rimpicciolisce prima invece di farsi
// rifiutare dopo.
export const BYTES_MASSIMI = 4 * 1024 * 1024;

// La qualita' di partenza. Si abbassa a scalini solo se il file resta
// troppo pesante — mai sotto MINIMA, perche' sotto quella soglia le
// scritte piccole si impastano e l'elenco ingredienti diventa illeggibile,
// che e' il contrario di quello che serve.
export const QUALITA_INIZIALE = 0.82;
export const QUALITA_MINIMA = 0.5;

/**
 * Quanto deve diventare grande una foto prima di partire.
 *
 * ⚠️ NON INGRANDISCE MAI. Una foto piccola resta com'e': ingrandirla
 *    aggiungerebbe punti inventati, cioe' peserebbe di piu' senza
 *    contenere nulla di piu'. E' il caso di una foto gia' ritagliata.
 */
export function misureRidotte(larghezza, altezza, latoMassimo = LATO_MASSIMO) {
  if (!larghezza || !altezza) return null;
  const lato = Math.max(larghezza, altezza);
  if (lato <= latoMassimo) return { larghezza, altezza, ridotta: false };
  const fattore = latoMassimo / lato;
  return {
    larghezza: Math.max(1, Math.round(larghezza * fattore)),
    altezza: Math.max(1, Math.round(altezza * fattore)),
    ridotta: true,
  };
}

/** Quanto pesa davvero una stringa base64, in byte. */
export function bytesDelBase64(base64) {
  if (!base64) return 0;
  const imbottitura = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - imbottitura);
}

/**
 * La prossima qualita' da provare quando il file e' ancora troppo pesante.
 * Restituisce null quando non si puo' scendere oltre: a quel punto la foto
 * va rifatta, e la schermata lo dice invece di mandare qualcosa che verra'
 * rifiutato.
 */
export function qualitaSuccessiva(qualita) {
  const prossima = Math.round((qualita - 0.12) * 100) / 100;
  return prossima < QUALITA_MINIMA ? null : prossima;
}

/**
 * Il tipo di immagine che si puo' mandare. Quello che arriva da una
 * fotocamera e' sempre jpeg; il resto puo' arrivare dalla galleria.
 */
export const TIPI_AMMESSI = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function tipoAmmesso(tipo) {
  return TIPI_AMMESSI.includes(String(tipo || "").toLowerCase());
}
