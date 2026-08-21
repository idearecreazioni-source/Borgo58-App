// =====================================================================
// QUANDO LA RICHIESTA NON PARTE PROPRIO
// =====================================================================
// 🔴 TROVATO DA ALESSIO col telefono in modalità aereo, 21/08/2026: al posto
// di una riga in italiano compariva **«Failed to send a request to the Edge
// Function»**, in cima alla pagina e senza dire quale gesto fosse fallito.
// Riprodotto e misurato sulla schermata viva prima di correggere.
//
// ⚠️ E LE QUATTRO CHIAMATE ALLE FUNZIONI ONLINE NON ERANO SCRITTE MALE.
// Tutte e quattro leggono già la frase italiana che ci scriviamo noi nel
// corpo della risposta. **Il ramo che mancava è un altro**: quando la rete è
// staccata la richiesta *non parte*, quindi non esiste nessun corpo da
// leggere, e tutte e quattro ricadono sul messaggio della libreria.
//
// ⚠️ È LA TERZA PORTA DELLA STESSA FAMIGLIA, e le tre insieme dicono qual era
// il buco:
//   · blocco A (20/08) — i `.catch` che ingoiavano: la schermata si disegnava
//     serena su una lettura fallita;
//   · difetto 2 (21/08) — gli `?.` su un dato obbligatorio: un buco invece di
//     un errore;
//   · questo — l'errore **arriva**, ma nella lingua della libreria.
// La differenza: là il difetto era che *non si sapeva*, qui che *si sa e non
// si capisce*. È più piccolo, e per questo più facile da lasciare lì.

/** Le tre cose che possono andare storte, e sono davvero tre. */
export const NON_PARTITA = "non-partita";
export const NESSUNA_RISPOSTA = "nessuna-risposta";
export const HA_RISPOSTO = "ha-risposto";

/**
 * Che genere di guasto è.
 *
 * 🔴 IL PRIMO DISCRIMINANTE CHE AVEVO SCRITTO ERA SBAGLIATO, e l'ho scoperto
 * **guardando la schermata**, non rileggendo: avevo dato per scontato che
 * `context` ci fosse solo quando il server ha risposto. Non è così — la
 * libreria avvolge anche il fallimento della rete e gli allega comunque un
 * `context`. Risultato: col telefono staccato la frase diceva «Non sono
 * riuscito ad aprire il conto» **e ci appiccicava l'inglese fra parentesi**,
 * cioè metà cura.
 *
 * ⚠️ Il discriminante buono è **come si chiama il guasto e cosa dice**, non
 * cosa la libreria gli ha allegato: `FunctionsFetchError` e «failed to
 * send / failed to fetch» sono la richiesta che non parte. È anche più
 * onesto — il messaggio *descrive* il guasto, il `context` dice solo che
 * qualcosa è stato allegato.
 */
export function genereDelGuasto(errore) {
  if (!errore) return null;
  const nome = String(errore.name || "");
  const m = String(errore.message || "").toLowerCase();
  if (
    nome === "FunctionsFetchError" ||
    m.includes("failed to send") ||
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network error")
  )
    return NON_PARTITA;
  if (errore.context) return HA_RISPOSTO;
  return NESSUNA_RISPOSTA;
}

/**
 * La frase da mostrare a chi sta lavorando.
 *
 * @param errore      quello che ha sollevato `functions.invoke`
 * @param cosa        che cosa si stava facendo, in italiano e al passato
 *                    prossimo implicito: «aprire il conto», «leggere il
 *                    documento». ⚠️ **Serve**: «Failed to send a request»
 *                    non distingue *le schede prodotto non sono arrivate* da
 *                    *il conto non si è aperto*, e chi legge deve sapere che
 *                    cosa è rimasto indietro.
 * @param dalCorpo    la frase italiana letta dalla risposta, se c'era
 */
export function fraseDelGuasto(errore, cosa, dalCorpo = null) {
  const genere = genereDelGuasto(errore);
  // ⚠️ «a aprire» si legge male e si nota: davanti a vocale ci vuole «ad».
  // Trovato leggendo la frase vera a schermo, non scrivendola.
  const gesto = cosa ? `${/^[aeiou]/i.test(cosa) ? "d" : ""} ${cosa}` : "";

  // Il caso normale: il server ha risposto e ci ha detto lui cosa non va.
  // Quella frase è scritta per chi sta in sala e non si tocca.
  if (dalCorpo) return dalCorpo;

  if (genere === NON_PARTITA)
    return `Non sono riuscito a${gesto}: sembra che manchi la connessione. Riprova appena torna.`;

  if (genere === NESSUNA_RISPOSTA)
    return `Non sono riuscito a${gesto}: il gestionale non ha risposto. Riprova.`;

  // Ha risposto ma senza una frase nostra: si tiene quello che ha detto, e
  // si dice almeno che cosa non è riuscito.
  const originale = errore?.message ? ` (${errore.message})` : "";
  return `Non sono riuscito a${gesto}.${originale}`;
}
