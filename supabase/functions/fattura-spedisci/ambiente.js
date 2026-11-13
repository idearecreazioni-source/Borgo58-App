// =====================================================================
// LA FATTURA PARTE DAVVERO SOLO DA work — 13/11/2026
// =====================================================================
// 🔴 Una fattura spedita allo SdI è un documento fiscale VERO: non si
//    ritira, si annulla solo con una nota di credito. Borgo58-Prova, il
//    gestionale di casa (home) e qualunque copia ricevono lo stesso codice:
//    nessuno di loro deve poter scrivere allo SdI.
//
// ⚠️ QUINDI LA REGOLA È AL CONTRARIO di quella dei messaggi Telegram
//    (`notify-telegram-reservation/ambiente.ts`, che marca Prova): qui si
//    spedisce SOLO quando l'indirizzo della funzione è esattamente quello
//    di produzione. Tutto il resto — Prova, casa, un indirizzo che non si
//    legge — SIMULA, e lo dice.
//
// ⚠️ Il progetto si riconosce da `SUPABASE_URL`, che imposta Supabase,
//    mai da qualcosa che manda il chiamante.

export const REF_PRODUZIONE = "oudjuqbqszisdtwzbxdo";

/** Questa funzione gira su work (produzione)? Solo lì la fattura parte davvero. */
export function siamoInProduzione(supabaseUrl) {
  try {
    return new URL(String(supabaseUrl ?? "")).hostname === `${REF_PRODUZIONE}.supabase.co`;
  } catch {
    return false;
  }
}
