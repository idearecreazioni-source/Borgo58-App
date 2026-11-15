import { supabase } from "../supabase";

function erroreDellaChat(corpo, ripiego) {
  const errore = new Error(corpo?.errore?.messaggio ?? ripiego);
  errore.codice = corpo?.errore?.codice ?? "rete";
  errore.esito = corpo?.esito ?? null;
  errore.conversazioneId = corpo?.conversazione_id ?? null;
  return errore;
}

// Una sola porta verso memo-chat: qui resta il contratto HTTP, cosi' il
// pannello non deve indovinare se il freno sia nel corpo o nello status.
export async function mandaMessaggioAMemo({ testo, conversazioneId = null, contesto }) {
  const body = {
    testo: String(testo ?? "").trim(),
    ...(conversazioneId ? { conversazione_id: conversazioneId } : {}),
    aperta_da_percorso: contesto?.aperta_da_percorso ?? null,
    aperta_da_modulo: contesto?.aperta_da_modulo ?? null,
  };
  const { data, error } = await supabase.functions.invoke("memo-chat", { body });

  if (error) {
    let corpo = null;
    try {
      corpo = await error.context?.json?.();
    } catch {
      corpo = null;
    }
    if (corpo?.esito === "tetto") return corpo;
    throw erroreDellaChat(corpo, "Non riesco a parlare con MEMO in questo momento. Riprova tra poco.");
  }

  if (data?.esito === "tetto") return data;
  if (!data?.risposta || !data?.conversazione_id) {
    throw erroreDellaChat(data, "MEMO ha risposto in una forma che non riesco a leggere. Riprova tra poco.");
  }
  return data;
}
