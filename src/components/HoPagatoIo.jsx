// I pezzi di «Ho pagato io» — 13/11/2026.
//
// 🔴 STANNO QUI E NON NELLE SCHERMATE perché da oggi «Ho pagato io» si fa da
//    DUE posti: il riquadro in /cassa/personale e la scelta «Come paghi →
//    Ho pagato io» in Fatture fornitori. Richiesta di Alessio: «UNA sola
//    logica, nessuna copia». Il salvataggio è uno (`createAnticipazione`),
//    e le parole che spiegano cosa succede sono queste, una volta sola: se
//    un giorno cambiano, cambiano in tutti e due i posti.

import { FONDI_ANTICIPO } from "../lib/constants";

/** «Con che soldi»: i tuoi contanti o il tuo conto, mai quelli della società. */
export function SceltaFondi({ valore, onCambia, className, id, disabilitata = false }) {
  return (
    <select
      id={id}
      value={valore}
      onChange={(e) => onCambia(e.target.value)}
      disabled={disabilitata}
      className={className}
      data-prova="scelta-fondi"
    >
      {FONDI_ANTICIPO.map((f) => (
        <option key={f.value} value={f.value}>{f.label}</option>
      ))}
    </select>
  );
}

/**
 * L'avviso del conto personale: pagando dal tuo conto, la nota finisce da
 * sola fra quelle da dire alla commercialista. Con i contanti non dice niente.
 */
export function AvvisoContoPersonale({ fondi, className = "" }) {
  if (fondi !== "conto_personale") return null;
  return (
    <p
      data-prova="avviso-conto-personale"
      className={`testo-sala text-b58-charcoal-soft bg-b58-gold/10 rounded-lg px-3 py-2 ${className}`}
    >
      Pagando dal tuo conto, nei registri la spesa risulta pagata da un conto che non è
      della società: questa nota <strong>entrerà da sola</strong> fra quelle da dire alla
      commercialista.
    </p>
  );
}

/**
 * Cosa succede alla fattura quando la paga l'anticipo: esce dalle scadenze
 * come «pagata (anticipo)», la cassa non si muove, il debito resta verso di te.
 */
export function FraseAnticipoPagaFattura({ className = "" }) {
  return (
    <p className={`testo-sala text-b58-charcoal-soft ${className}`} data-prova="anticipo-paga-fattura">
      La fattura risulterà <strong>pagata (anticipo)</strong> e uscirà dalle scadenze;
      la cassa non si muove e il debito verso di te resta fra le note da rimborsare.
    </p>
  );
}

/**
 * 🔴 IL RIFIUTO ACCANTO AL PULSANTE (13/11/2026). L'errore di «Ho pagato io»
 *    compariva in cima alla pagina, lontano dal gesto: è la stessa lezione
 *    del 17/08 — un rifiuto che non si vede è un rifiuto che non c'è, e
 *    l'istinto è premere di nuovo.
 * `role="alert"`: chi usa un lettore di schermo lo sente quando compare.
 */
export function ErroreDelGesto({ messaggio, className = "" }) {
  if (!messaggio) return null;
  return (
    <p
      role="alert"
      data-prova="errore-ho-pagato-io"
      className={`testo-sala text-b58-terracotta-dark-testo bg-b58-terracotta/10 rounded-lg px-3 py-2 ${className}`}
    >
      {messaggio}
    </p>
  );
}
