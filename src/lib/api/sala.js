import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";

// La sala: le sagome, la pianta di una giornata, gli orari, il sold out.
//
// Dal 14/08/2026 questo file non contiene più nessun conteggio di posti.
// La capienza non si calcola: la sala è una pianta che Alessio muove con
// le mani, e chi entra lo decide lui guardandola. Il calcolo dei coperti
// liberi è stato RIMOSSO dal database, non spento — una funzione che non
// fa niente, fra tre mesi, qualcuno la riaccende credendo di riparare
// qualcosa.
//
// Spostare una sagoma scrive su UNA tabella: categoria A del Contratto,
// chiamata diretta. Un viaggio di rete verso una Edge Function a ogni
// movimento non guadagnerebbe niente e si sentirebbe tutto.
// Promuovere una disposizione a base ne tocca DUE: B4, corridoio.

export const GIORNI = [
  { weekday: 1, nome: "Lunedì" },
  { weekday: 2, nome: "Martedì" },
  { weekday: 3, nome: "Mercoledì" },
  { weekday: 4, nome: "Giovedì" },
  { weekday: 5, nome: "Venerdì" },
  { weekday: 6, nome: "Sabato" },
  { weekday: 0, nome: "Domenica" },
];

// --- Le sagome (pianta base) ---

export async function listSagome() {
  const { data, error } = await supabase
    .from("dining_tables")
    .select(
      "id, label, tipo, forma, zona, larghezza_cm, profondita_cm, spostabile, posti_fissi, x, y, active, position"
    )
    .order("position");
  if (error) throw error;
  return data;
}

// La sala com'è in una certa data: pianta base + scostamenti di quel
// giorno. UN solo calcolo, nel database, per la schermata del calendario
// e per le Comande — due schermate che ricostruiscono la pianta per conto
// proprio finirebbero per disegnare due sale diverse.
export async function getPiantaDelGiorno(data) {
  const { data: righe, error } = await supabase.rpc("pianta_del_giorno", { p_data: data });
  if (error) throw error;
  return righe ?? [];
}

// Come sta una sagoma per UNA giornata: dov'è e da che verso. Si salva
// solo lo scostamento, mai una copia dell'intera pianta — se una data non
// ha scostamenti non esiste nessuna riga per quella data, e il giorno
// dopo si riparte dalla base senza che nessuno rimetta niente a posto.
//
// ⚠️ POSIZIONE E VERSO SI SCRIVONO INSIEME, sempre tutti e due. Salvando
// solo quello che si è appena toccato, la prima volta che si trascina un
// tavolo girato nascerebbe una riga nuova col verso a "diritto" — e il
// tavolo si raddrizzerebbe da solo, senza errori e senza avvisi, come
// conseguenza di uno spostamento. È la stessa forma del difetto del
// 12/08, quando ricaricare una schermata buttava via ciò che l'utente
// stava scrivendo altrove.
// 🔴 «AGGIORNATO IL» NON SI SCRIVE PIÙ DA QUI (25/08/2026), e la ragione
// vale per ogni colonna dello stesso genere: fino a oggi ci si metteva
// `new Date().toISOString()`, cioè **l'orologio del tablet** — non quello
// del database. Questo progetto lo sa già dal 20/08 (*un istante si
// chiede al database; i due orologi non sono lo stesso orologio*), e lì
// bastarono pochi millisecondi di scarto a far sbagliare un confronto.
//
// ⚠️ E il difetto peggiore non era l'ora, era **da chi dipendeva**: la
// data la scriveva chi si ricordava di scriverla, quindi una scrittura
// nuova — o una funzione SQL, che di qui non passa affatto — la lasciava
// indietro **senza nessun errore**. Adesso la scrive un trigger
// (`20260825000003`), che vale da qualunque porta si entri.
export async function salvaSagoma({ data, sagomaId, x, y, ruotato }) {
  const { error } = await supabase.from("disposizioni_giornaliere").upsert(
    {
      data,
      dining_table_id: sagomaId,
      x: Math.round(x),
      y: Math.round(y),
      ruotato: Boolean(ruotato),
    },
    { onConflict: "data,dining_table_id" }
  );
  if (error) throw error;
}

// Rimette una sagoma dov'è nella pianta base, per quel giorno.
export async function riportaSagomaAllaBase({ data, sagomaId }) {
  const { error } = await supabase
    .from("disposizioni_giornaliere")
    .delete()
    .eq("data", data)
    .eq("dining_table_id", sagomaId);
  if (error) throw error;
}

// «Questa diventa la disposizione base». Senza questo comando non si
// capisce più quale sia la sala vera. Due tabelle → corridoio.
export async function promuoviDisposizione(data) {
  return eseguiOperazione("promuovi_disposizione", { p_data: data });
}

export async function rinominaSagoma(id, label) {
  const { error } = await supabase.from("dining_tables").update({ label: label.trim() }).eq("id", id);
  if (error) throw error;
}

// Le sagome si disattivano, mai si cancellano: uno storico che punta a un
// tavolo sparito non si legge più.
export async function attivaSagoma(id, attiva) {
  const { error } = await supabase.from("dining_tables").update({ active: attiva }).eq("id", id);
  if (error) throw error;
}

// --- I coperti (18/08/2026, giro B del mandato sala) ---
//
// ⚠️ Dal 18/08 questo file torna ad avere un conteggio di posti, e il
// commento in testa va letto insieme a questo. Non è il ritorno del
// secchio unico rimosso il 14/08: i posti stanno DENTRO il tavolo, il
// totale della serata si ricalcola sulla disposizione di quel giorno, e
// accostando due tavoli il totale SCENDE. Quello che resta rimosso — e
// deve restare rimosso — è la capienza della sala indipendente da come è
// messa.
//
// Il calcolo non è qui: sta nel database, sopra `pianta_del_giorno()`, che
// è già l'unico posto dove la pianta base e lo scostamento del giorno si
// sommano. Rifarlo in JavaScript darebbe due numeri diversi alla pianta e
// a «c'è posto?».

export async function getCopertiDelGiorno(data) {
  const { data: righe, error } = await supabase.rpc("coperti_del_giorno", { p_data: data });
  if (error) throw error;
  return righe ?? [];
}

// --- Le fasce e il turno (18/08/2026, giro C) ---
//
// Per ogni prenotazione: in che fascia cade e, se sul suo tavolo c'è
// qualcuno dopo, entro che ora va liberato.
//
// ⚠️ «Da liberare entro le…» è una CONSEGUENZA, non un dato scritto a
// mano: si legge dalla prenotazione successiva. Se quella si sposta la
// nota la segue, se sparisce la nota sparisce — senza che nessuno debba
// ricordarsene. Un secondo posto dove scriverla resterebbe indietro.
export async function getTurniDelGiorno(data) {
  const { data: righe, error } = await supabase.rpc("turni_del_giorno", { p_data: data });
  if (error) throw error;
  return righe ?? [];
}

export async function getPostoPerLaSerata(data) {
  const { data: righe, error } = await supabase.rpc("posto_per_la_serata", { p_data: data });
  if (error) throw error;
  return righe?.[0] ?? null;
}

// La correzione a mano: una sola, e la chiave è l'insieme di tavoli che
// formano quel rettangolo in quella giornata (un tavolo singolo è un
// insieme di uno). Scrive su UNA tabella → categoria A, chiamata diretta.
//
// ⚠️ Non esiste un meccanismo separato «contro il muro»: sarebbero due
// strade per lo stesso numero, e potendo contraddirsi servirebbe una
// regola di precedenza inventata. Il muro si scrive nella ragione.
export async function salvaCorrezioneCoperti({ data, tavoli, coperti, ragione }) {
  const { error } = await supabase.from("correzioni_coperti").upsert(
    {
      data,
      tavoli,
      coperti,
      ragione: ragione?.trim() || null,
    },
    { onConflict: "data,tavoli" }
  );
  if (error) throw error;
}

export async function rimuoviCorrezioneCoperti({ data, tavoli }) {
  const { error } = await supabase
    .from("correzioni_coperti")
    .delete()
    .eq("data", data)
    .eq("tavoli", `{${tavoli.join(",")}}`);
  if (error) throw error;
}

// --- I formati di tavolo: quanti ne tiene, e cosa si accosta con cosa ---
//
// ⚠️ La capacità è un dato di Alessio, non una costante nel codice:
// cambiare «un 90x90 ne tiene 4» è un UPDATE, non una migrazione. E il
// formato è anche la regola dell'accostamento — due tavoli si accostano
// solo se sono dello stesso formato, perché la ragione che ha dato lui è
// lo STILE, non la misura.

export async function listFormatiTavolo() {
  const { data, error } = await supabase
    .from("formati_tavolo")
    .select("id, nome, coperti_base, attivo")
    .order("nome");
  if (error) throw error;
  return data;
}

export async function updateFormatoTavolo(id, payload) {
  const { error } = await supabase
    .from("formati_tavolo")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

// --- Giornate al completo ---

export async function listSoldOut({ da } = {}) {
  let query = supabase.from("giornate_sold_out").select("data").order("data");
  if (da) query = query.gte("data", da);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function isSoldOut(data) {
  const { data: riga, error } = await supabase
    .from("giornate_sold_out")
    .select("data")
    .eq("data", data)
    .maybeSingle();
  if (error) throw error;
  return Boolean(riga);
}

export async function setSoldOut(data, pieno) {
  if (pieno) {
    const { error } = await supabase.from("giornate_sold_out").upsert({ data }, { onConflict: "data" });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("giornate_sold_out").delete().eq("data", data);
  if (error) throw error;
}

// --- Orari di servizio ---

export async function listServiceHours() {
  const { data, error } = await supabase
    .from("service_hours")
    .select("id, weekday, servizio, apertura, ultimo_ingresso, ora_primo_turno, ora_ultimi_arrivi, attivo")
    .order("weekday")
    .order("apertura");
  if (error) throw error;
  return data;
}

export async function updateServiceHour(id, payload) {
  const { error } = await supabase
    .from("service_hours")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}

// --- Chiusure straordinarie ---
// ⚠️ Non sono i giorni «al completo»: quelle sono un'altra tabella, e la
// differenza deve restare leggibile anche fra un anno. Una sera chiusa e
// una sera piena sono due fatti diversi.

export async function listClosures() {
  const { data, error } = await supabase
    .from("service_closures")
    .select("id, dal, al, motivo, si_lavora_in_cucina")
    .order("dal", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createClosure({ dal, al, motivo, siLavoraInCucina }) {
  const { error } = await supabase
    .from("service_closures")
    .insert({
      dal,
      al: al || dal,
      motivo: motivo?.trim() || null,
      // ⚠️ Vuoto = «vale la settimana tipo», e NON «no»: durante due
      // settimane di ferie probabilmente non si cucina, ma e' Alessio a
      // doverlo dire. Un no messo qui da noi spegnerebbe le preparazioni
      // ricorrenti in silenzio.
      si_lavora_in_cucina: siLavoraInCucina ?? null,
    });
  if (error) throw error;
}

// LA SETTIMANA DELLA CUCINA — 29/08/2026.
// ⚠️ E' una domanda DIVERSA da «il locale e' aperto»: il giorno di chiusura
// e' spesso proprio quello delle preparazioni lunghe (decisione di Alessio).
// Sette righe, una per giorno; `si_lavora` puo' essere vuoto e vuoto vuol
// dire «non l'ha ancora detto», che e' una risposta diversa da no.
export async function listSettimanaCucina() {
  const { data, error } = await supabase
    .from("settimana_cucina")
    .select("weekday, si_lavora")
    .order("weekday");
  if (error) throw error;
  return data;
}

export async function setGiornoCucina(weekday, siLavora) {
  const { error } = await supabase
    .from("settimana_cucina")
    .update({ si_lavora: siLavora, aggiornato_il: new Date().toISOString() })
    .eq("weekday", weekday);
  if (error) throw error;
}

// PERCHE' UN GIORNO E' CHIUSO — 29/08/2026, punto 1b del mandato.
//
// ⚠️ **Non serve a nascondere niente.** Un giorno chiuso per cui c'erano
// gia' delle prenotazioni non le fa sparire: sono clienti da chiamare, e
// farle sparire e' precisamente la scelta che Alessio ha escluso. Questa
// risposta serve a SCRIVERLO in cima alla giornata, con le prenotazioni
// che restano sotto.
//
// Risposta: { chiuso, riposo, chiusura_a_date, motivo }
//   · `riposo` = in quel giorno della settimana non si fa servizio;
//   · `chiusura_a_date` = c'e' una chiusura scritta che copre quella data.
// Possono valere tutti e due, e la frase da leggere e' diversa.
export async function getPercheChiuso(data) {
  const { data: r, error } = await supabase.rpc("perche_chiuso", { p_data: data });
  if (error) throw error;
  return r;
}

export async function deleteClosure(id) {
  const { error } = await supabase.from("service_closures").delete().eq("id", id);
  if (error) throw error;
}

// --- Regole di prenotazione (la riga unica di service_settings) ---
// Restano solo quelle che NON sono capienza: da quanto tempo prima si
// prenota e fin quando in là. La durata del tavolo e il tetto dei coperti
// contemporanei sono stati rimossi dalla tabella.

export async function getRegolePrenotazione() {
  const { data, error } = await supabase
    .from("service_settings")
    .select(
      // ⚠️ `minuti_tolleranza_ritardo` esisteva nel database dal giro D1 e
      // NESSUNO LO LEGGEVA: la colonna c'era, il valore era il suo (30), e da
      // nessuna schermata si poteva né vedere né cambiare. È la forma
      // silenziosa del parametro spento — un dato che sembra governare
      // qualcosa e non governa niente.
      "giorni_prenotabili, preavviso_minuti, prenotazioni_online_attive, email_conferma_attiva, soglia_coperti_serata, minuti_fra_turni, ora_fine_serata, passo_prenotazioni_minuti, minuti_tolleranza_ritardo"
    )
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data;
}

export async function updateRegolePrenotazione(payload) {
  const { error } = await supabase
    .from("service_settings")
    .update(payload)
    .eq("id", 1);
  if (error) throw error;
}
