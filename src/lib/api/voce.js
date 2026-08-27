// I comandi vocali — il lato del gestionale.
//
// 🔴 L'AUDIO NON LASCIA MAI IL DISPOSITIVO. Il riconoscimento vocale gira
//    nel browser (o, dal telefono, nella Scorciatoia di iOS): quello che
//    parte da qui è già TESTO. Non c'è nessun file da caricare, nessuna
//    registrazione conservata, niente da cancellare dopo.
//
// ⚠️ Le regole di come si legge un riscontro stanno in
//    `calcoli/voce.js`, così si provano senza aprire una schermata.

import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";
import { chiamaFunzione } from "../chiamaFunzione";
import { nonAncoraAccesa } from "../calcoli/voce";

/**
 * Manda quello che è stato detto e restituisce com'è finita.
 *
 * ⚠️ Non è il browser a decidere cosa si salva da sé: decide il database,
 * dentro la funzione online. Qui si manda il testo e si legge il risultato.
 */
export async function mandaDettato(testo) {
  return chiamaFunzione("ascolta-voce", { testo }, "capire quello che hai detto");
}

/** Com'è finita una dettatura, azione per azione. */
export async function azioniDellaDettatura(dettaturaId) {
  const { data, error } = await supabase.rpc("azioni_della_dettatura", { p_id: dettaturaId });
  if (error) throw error;
  return data ?? [];
}

/**
 * Tutto quello che aspetta Alessio, con da quanti giorni.
 *
 * 🔴 NIENTE SCADE. Questa lista non si svuota da sola e non butta via
 * niente: buttare una dettatura fatta in cella è la cosa che gli farebbe
 * smettere di usare la voce.
 */
export async function azioniInAttesa() {
  const { data, error } = await supabase.rpc("azioni_dettate_in_attesa");
  if (error) throw error;
  return data ?? [];
}

/**
 * Quante cose aspettano — per il segno in Dashboard.
 *
 * 🔴 «LA VOCE NON C'È ANCORA» NON È «NON SONO RIUSCITO A LEGGERE», e qui
 * la distinzione va fatta perché il codice arriva online **prima** della
 * migrazione che crea questa funzione: fra il push di Alessio e
 * l'applicazione passa del tempo, ed è giusto che passi.
 *
 * ⚠️ Senza questa riga, in quelle ore la schermata che lui apre ogni
 * mattina mostrerebbe un avviso rosso — «non sono riuscito a leggere le
 * cose che hai dettato» — per una funzionalità che semplicemente non è
 * ancora accesa. Un allarme che grida su una cosa normale è un allarme
 * che si impara a spegnere.
 *
 * ⚠️ E NON È IL SILENZIO CHE QUESTO PROGETTO VIETA: si tace su un caso
 * **riconosciuto per nome** — PostgREST risponde `PGRST202`/`42883`
 * quando la funzione non esiste — e su nient'altro. Qualunque altro
 * guasto continua a risalire e la Dashboard lo dichiara.
 */
export async function quanteAspettano() {
  const { data, error } = await supabase.rpc("voce_da_guardare");
  if (error) {
    if (nonAncoraAccesa(error)) return { quante: 0, laPiuVecchia: 0, nonAncoraAccesa: true };
    throw error;
  }
  const r = Array.isArray(data) ? data[0] : data;
  return { quante: r?.quante ?? 0, laPiuVecchia: r?.la_piu_vecchia ?? 0 };
}

// ⚠️ Passano dal corridoio (B4): confermare una cosa dettata la fa
//    succedere davvero — una giacenza si muove, una temperatura entra nel
//    registro HACCP — e insieme aggiorna la riga che la teneva in attesa.
export async function confermaAzione(id) {
  return eseguiOperazione("esegui_azione_dettata", { p_id: id });
}

export async function annullaAzione(id) {
  return eseguiOperazione("annulla_azione_dettata", { p_id: id });
}

/** Le ultime dettature, per vedere cosa si è detto e quanto è costato. */
export async function dettatureRecenti(giorni = 7) {
  const { data, error } = await supabase.rpc("dettature_recenti", { p_giorni: giorni });
  if (error) throw error;
  return data ?? [];
}

// --- Le chiavi della Scorciatoia ---------------------------------------

export async function chiaviVoce() {
  const { data, error } = await supabase.rpc("chiavi_voce_elenco");
  if (error) throw error;
  return data ?? [];
}

/**
 * Crea una chiave e la restituisce IN CHIARO — una volta sola.
 *
 * 🔴 Da qui in poi il database ne conserva la sola impronta. Se si perde
 * non si recupera: se ne fa un'altra e si revoca la vecchia, che è anche
 * quello che si fa se il telefono viene smarrito.
 */
export async function creaChiaveVoce(nome) {
  const { data, error } = await supabase.rpc("crea_chiave_voce", { p_nome: nome });
  if (error) throw error;
  return data;
}

export async function revocaChiaveVoce(id) {
  const { data, error } = await supabase.rpc("revoca_chiave_voce", { p_id: id });
  if (error) throw error;
  return data;
}

/**
 * Sceglie fra i candidati che il gestionale ha proposto, ED ESEGUE.
 *
 * 🔴 Un gesto solo, non due: chi ha appena detto QUALE ha già detto anche
 * sì. Due passaggi separati sarebbero il difetto che questo chiude — un
 * pulsante che risponde a una domanda che non è stata fatta — con in più
 * un tocco.
 */
export async function scegliPerAzione(id, sceltaId) {
  return eseguiOperazione("scegli_per_azione_dettata", { p_id: id, p_scelta: sceltaId });
}
