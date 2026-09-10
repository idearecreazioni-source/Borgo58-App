// =====================================================================
// COSA RESTA DA COMPRARE — la regola della spesa spicciola, in un posto solo
// =====================================================================
// 10/09/2026, dal collaudo col telefono.
//
// 🔴 IL DIFETTO: il riquadro della schermata iniziale contava TUTTE le
//    righe della spesa spicciola, comprese quelle già messe nel carrello,
//    mentre la pagina della spesa spicciola conta come «da prendere» solo
//    quelle che nel carrello non ci sono. Due numeri diversi per la stessa
//    domanda: col carrello vuoto coincidevano, e al primo articolo messo nel
//    carrello si sarebbero separati — **senza nessun errore**.
//
// ⚠️ LA CURA NON È CORREGGERE IL RIQUADRO: è che la regola viva UNA VOLTA
//    SOLA e che tutti e due la chiedano. Una regola ricopiata in due
//    schermate diverge alla prima correzione che ne tocca una sola — che è
//    esattamente come è nato questo difetto.

/** Le righe che restano da comprare: quelle che nel carrello non ci sono. */
export const daComprare = (righe) => (righe ?? []).filter((r) => !r.nel_carrello);

/** Le righe già nel carrello. */
export const nelCarrello = (righe) => (righe ?? []).filter((r) => r.nel_carrello);
