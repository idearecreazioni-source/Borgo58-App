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

// --- IL PRODOTTO FERMO (23/08/2026, blocco 3 del mandato) ---
//
// Domanda diversa dallo scadenziario, e servono tutte e due: quello
// guarda la SCADENZA, questo guarda **da quanto una partita non viene
// toccata**. Un barattolo aperto un mese fa, con scadenza fra un anno, lo
// vede solo questo.
//
// ⚠️ Nessun `.limit()`, per la stessa ragione scritta in cima al file.
export async function listPartiteFerme() {
  const { data, error } = await supabase.rpc("partite_ferme");
  if (error) throw error;
  return data ?? [];
}

// «Ancora qui, ricordamelo fra N giorni».
//
// ⚠️ Esiste perché senza, l'unica via d'uscita per un prodotto ancora
// buono è mentire — dire «consumato» o «buttato» per far tacere l'avviso.
// E un avviso a cui devi mentire smette di funzionare in una settimana.
export async function rimandaPartita({ lottoId, giorni }) {
  return eseguiOperazione("rimanda_partita", {
    p_lotto_id: lottoId,
    p_giorni: giorni,
  });
}

// «Abbattuto»: l'orologio riparte, e la scadenza nuova la scrive Alessio.
//
// ⚠️ La data è obbligatoria, e il database la pretende: senza, si
// spegnerebbe l'avviso invece di rimandarlo. Quando la biologa darà la
// tabella delle durate dopo abbattimento, il gestionale la proporrà — ma
// proporre non è decidere, e finché non c'è nessuno la inventa.
export async function abbattiPartita({ lottoId, nuovaScadenza, note }) {
  return eseguiOperazione("abbatti_partita", {
    p_lotto_id: lottoId,
    p_nuova_scadenza: nuovaScadenza,
    p_note: note || null,
  });
}

// «Trasformato»: il prodotto vive nella preparazione che lo include.
//
// 🔴 NON SCALA IL MAGAZZINO, ed è la regola di Alessio: lo scaricherà la
// registrazione della preparazione, e scalare anche qui vorrebbe dire
// scalare due volte — con nessuno dei due scarichi che sembra sbagliato.
//
// ⚠️ E vuole la quantità (può esserne stata trasformata solo una parte) e
// **in cosa** è finita: senza, la catena di rintracciabilità si spezza lì.
export async function dichiaraTrasformazione({
  lottoId, quantita, ricettaId, descrizione, scadeIl, note,
}) {
  return eseguiOperazione("dichiara_trasformazione", {
    p_lotto_id: lottoId,
    p_quantita: quantita,
    p_ricetta_id: ricettaId || null,
    p_descrizione: descrizione || null,
    p_scade_il: scadeIl || null,
    p_note: note || null,
  });
}

// Tutte le partite ancora in casa, nella stessa forma delle ferme.
//
// 🔴 Serve a chi arriva dalle Scadenze con una partita in mano: là le
// risposte sono due, qui sono sei, e prima quel collegamento portava a
// una schermata che rispondeva «Niente fermo». Un collegamento che porta
// in un vicolo cieco è peggio di un collegamento che manca: promette una
// strada.
//
// ⚠️ Il filtro per nome si fa nel DATABASE, non nel browser: 203 partite
// oggi, e quel numero cresce. Una lettura senza limite torna al massimo
// di mille righe senza dirlo.
export async function listPartiteInGiacenza(cerca = null) {
  const { data, error } = await supabase.rpc("partite_in_giacenza", { p_cerca: cerca });
  if (error) throw error;
  return data ?? [];
}
