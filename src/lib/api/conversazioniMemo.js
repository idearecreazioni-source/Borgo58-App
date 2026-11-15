import { supabase } from "../supabase";

function erroreDelleConversazioni(error) {
  return new Error(error?.message || "Non riesco a leggere le conversazioni di MEMO. Riprova tra poco.");
}

// Sono sole letture dal browser: le policy RLS gia' presenti lasciano
// passare esclusivamente il titolare e non serve una nuova porta online.
export async function leggiConversazioniMemo() {
  const { data, error } = await supabase
    .from("memo_conversazioni")
    .select("id, titolo, creata_il, aperta_da_modulo, memo_messaggi(ruolo, testo, creato_il)")
    .order("creata_il", { ascending: false })
    .limit(30);
  if (error) throw erroreDelleConversazioni(error);
  return data ?? [];
}

export async function leggiMessaggiDellaConversazione(conversazioneId) {
  const { data, error } = await supabase
    .from("memo_messaggi")
    .select("ruolo, testo, risultati, stato, creato_il")
    .eq("conversazione_id", conversazioneId)
    .in("ruolo", ["alessio", "memo"])
    .order("creato_il", { ascending: true });
  if (error) throw erroreDelleConversazioni(error);
  return data ?? [];
}
