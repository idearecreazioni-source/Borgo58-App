import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// I PREVENTIVI PER GLI EVENTI — blocco 1 del mandato (20/08/2026).
//
// 🔴 UN PREVENTIVO CONSERVA DUE NUMERI DIVERSI, e non vanno mai confusi:
// il **prezzo promesso** al cliente, che è una promessa e non cambia più, e
// il **costo del momento in cui è stato fatto**, che invecchia perché i
// prezzi si muovono. Mescolandoli, fra due mesi nessuno saprebbe se
// «costava 14» era il costo di allora o di adesso.
//
// ⚠️ E il costo NON si calcola qui: lo dice il database, con la stessa
// funzione che usa il magazzino per scaricare davvero. Se il numero mostrato
// al cliente e quello del magazzino nascessero in due posti, prima o poi
// divergerebbero — e la differenza la vedrebbe un ospite.

// ⚠️ Il nome del piatto arriva INSIEME alle righe, non con una seconda
// interrogazione: due elenchi che si incontrano nel browser sono due letture
// che possono raccontare stati diversi. E se l incorporamento smettesse di
// funzionare non ci sarebbe nessun errore rosso — comparirebbe un trattino
// su ogni riga, cioe una schermata che dice con calma che il menu e vuoto.
const RIGHE = "*, righe:preventivo_righe(*, recipe:recipe_id(id, name))";

export async function listPreventivi({ dal, al } = {}) {
  let query = supabase
    .from("preventivi")
    .select(RIGHE)
    .order("data_evento", { ascending: false })
    .limit(200);
  if (dal) query = query.gte("data_evento", dal);
  if (al) query = query.lte("data_evento", al);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getPreventivo(id) {
  const { data, error } = await supabase
    .from("preventivi")
    .select(RIGHE)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// ⚠️ Passa dal corridoio: testata e righe si scrivono insieme o non si
// scrivono. A metà resterebbe un preventivo col nome del cliente e senza
// dentro niente — e un costo di zero euro che sembra un numero.
export async function salvaPreventivo({ id, testata, righe }) {
  return eseguiOperazione("salva_preventivo", {
    p_preventivo_id: id ?? null,
    p_testata: testata,
    p_righe: righe ?? [],
  });
}

// Dopo l'accettazione non si sovrascrive: si crea una versione NUOVA
// collegata alla vecchia. ⚠️ Con un acconto versato e un prezzo concordato,
// sapere cosa era stato promesso e quando è la cosa che conta.
export async function nuovaVersionePreventivo(id) {
  return eseguiOperazione("nuova_versione_preventivo", { p_preventivo_id: id });
}

export async function fabbisognoPreventivo(id) {
  const { data, error } = await supabase.rpc("fabbisogno_preventivo", { p_preventivo_id: id });
  if (error) throw error;
  return data ?? [];
}

// ⚠️ Restituisce il prezzo E l'avvertenza che ne dichiara il limite: il
// ricarico si applica al SOLO cibo, e gli extra si sommano dopo. Viaggiano
// insieme perché un avviso scritto nel testo di una schermata non protegge
// la seconda schermata che mostra lo stesso numero.
export async function prezzoPreventivo(id) {
  const { data, error } = await supabase.rpc("prezzo_preventivo", { p_preventivo_id: id });
  if (error) throw error;
  return data?.[0] ?? null;
}

// I TRE GESTI DEL FOGLIO (20/08/2026, blocco 3) — e sono TRE COSE DIVERSE,
// non tre pulsanti dello stesso tipo:
//   · il foglio si produce e basta — reversibile, non esce di qui;
//   · la mail parte davvero — **irreversibile**;
//   · WhatsApp apre un messaggio che manda Alessio con le sue mani.
//
// ⚠️ Mai un tocco che manda tutto: il giorno che di un cliente si ha solo il
// telefono, un invio unico spedirebbe una mail a un indirizzo inventato pur
// di partire.
//
// ⚠️ E il CONTENUTO lo compone il database, in un posto solo: il foglio
// viaggia, e tre schermate che se lo costruiscono per conto proprio sono tre
// occasioni di lasciarci dentro un costo.

export async function foglioPreventivo(id) {
  const { data, error } = await supabase.rpc("foglio_preventivo", { p_preventivo_id: id });
  if (error) throw error;
  return data;
}

// Fotografa cosa diceva il foglio, e lo restituisce. ⚠️ Serve quando si farà
// una versione nuova: ricostruirlo dai dati di allora è impossibile, perché
// nel frattempo i prezzi si sono mossi.
export async function registraFoglioPreventivo(id, canale, destinatario) {
  const { data, error } = await supabase.rpc("registra_foglio_preventivo", {
    p_preventivo_id: id,
    p_canale: canale,
    p_destinatario: destinatario ?? null,
  });
  if (error) throw error;
  return data;
}

// 🔴 L'UNICO DEI TRE CHE È IRREVERSIBILE.
export async function inviaPreventivoPerEmail(id) {
  const { data, error } = await supabase.rpc("invia_preventivo_per_email", { p_preventivo_id: id });
  if (error) throw error;
  return data;
}
