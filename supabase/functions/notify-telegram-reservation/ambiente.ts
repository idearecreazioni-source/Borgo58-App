// =====================================================================
// DA QUALE PROGETTO PARTE UN MESSAGGIO — 19/09/2026
// =====================================================================
// 🔴 PERCHE' SERVE. Durante le prove Borgo58-Prova usa, per scelta di
//    Alessio, LO STESSO bot e LO STESSO canale personale della produzione.
//    Un promemoria di Prova e uno vero arriverebbero identici sullo stesso
//    telefono: chi lo legge in servizio non avrebbe modo di distinguerli.
//
// ⚠️ QUINDI OGNI MESSAGGIO CHE PARTE DA PROVA COMINCIA CON «TEST PROVA», e
//    la regola sta in UN PUNTO SOLO: `sendTelegram` in `index.ts` passa ogni
//    testo da qui. Promemoria, prenotazioni e allarmi insieme — marcarne uno
//    solo lascerebbe gli altri indistinguibili.
//
// ⚠️ IL PROGETTO SI RICONOSCE DALL'AMBIENTE DELLA FUNZIONE (`SUPABASE_URL`,
//    che Supabase imposta da se'), MAI DA QUALCOSA CHE MANDA IL CHIAMANTE:
//    un campo del corpo si potrebbe dimenticare o falsificare.
//
// ⚠️ IN PRODUZIONE IL TESTO NON CAMBIA DI UN CARATTERE: il prefisso esiste
//    solo quando l'indirizzo e' esattamente quello di Prova.

export const REF_PROVA = "bnwqgpuyzmzujxfbtyvs";
export const PREFISSO_PROVA = "TEST PROVA";

/** Questa funzione gira su Borgo58-Prova? Si guarda l'ambiente, mai il chiamante. */
export function siamoSuProva(supabaseUrl: string | undefined | null): boolean {
  try {
    return new URL(String(supabaseUrl ?? "")).hostname === `${REF_PROVA}.supabase.co`;
  } catch {
    return false;
  }
}

/** Il testo come deve arrivare su Telegram da questo progetto. */
export function testoPerIlProgetto(testo: string, supabaseUrl: string | undefined | null): string {
  if (!siamoSuProva(supabaseUrl)) return testo;
  return `${PREFISSO_PROVA} — Borgo58-Prova, non il locale vero\n\n${testo}`;
}
