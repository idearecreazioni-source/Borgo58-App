import { supabase } from "./supabase";

// Corridoio unico per le operazioni "tutto o niente" (Contratto
// Architetturale v2, regola B4 — confermato da Alessio il 09/08/2026).
//
// Il client non chiama MAI direttamente la RPC di un'operazione
// multi-tabella: passa dalla Edge Function `operazioni-atomiche`, che
// verifica la sessione e inoltra il token dell'utente reale. Dentro,
// l'operazione resta una singola funzione Postgres: una chiamata = una
// transazione = o tutto o niente.
//
// Le scritture su UNA sola tabella senza conseguenze altrove restano
// invece dirette (categoria A del contratto): questo modulo non le
// riguarda.
export async function eseguiOperazione(operazione, parametri) {
  const { data, error } = await supabase.functions.invoke("operazioni-atomiche", {
    body: { operazione, parametri },
  });

  if (error) {
    // La Edge Function risponde con { errore: { messaggio } } e il
    // messaggio è quello scritto per l'operatore dalla funzione Postgres
    // (es. "Questo conto è già stato chiuso"): va mostrato intatto, non
    // sostituito da un generico "Edge Function returned a non-2xx".
    let messaggio = error.message;
    try {
      const corpo = await error.context?.json();
      if (corpo?.errore?.messaggio) messaggio = corpo.errore.messaggio;
    } catch {
      // risposta senza corpo JSON: si tiene il messaggio generico
    }
    throw new Error(messaggio);
  }

  return data?.risultato ?? null;
}
