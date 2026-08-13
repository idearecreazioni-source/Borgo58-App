import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// Lo scadenziario.
//
// ⚠️ Nessun `.limit()` qui, e non aggiungerlo: questa lista è quello che
// Alessio guarda per decidere cosa buttare, e una lista tagliata sembra
// completa. Cresce come cresce il magazzino di una cucina piccola —
// decine di righe, non migliaia.
//
// La regola di cosa si segnala e cosa tace vive TUTTA nel database
// (`partite_in_scadenza`), perché è la stessa che usa il messaggio delle
// 10:00. Se la riscrivessimo qui, un giorno schermata e telefono
// direbbero due cose diverse — è già successo con i rincari, il 12/08.
export async function listPartiteInScadenza() {
  const { data, error } = await supabase.rpc("partite_in_scadenza");
  if (error) throw error;
  return data ?? [];
}

// Chiudere una partita tocca tre tabelle insieme (giacenza, movimenti e —
// se buttata — il registro HACCP): categoria B4, quindi passa dal
// corridoio, mai da scritture in sequenza dal browser.
export async function chiudiPartita({ lottoId, come, note }) {
  return eseguiOperazione("chiudi_partita", {
    p_lotto_id: lottoId,
    p_come: come,
    p_note: note || null,
  });
}
