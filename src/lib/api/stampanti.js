import { supabase } from "../supabase";

// LE STAMPANTI, IL REGISTRATORE E LA CODA — 28/10/2026.
// Il gestionale non parla con gli apparecchi: scrive i lavori nella coda e
// il ponte sul mini-PC li porta alla stampante (migrazione 20261028000005,
// ARCHITETTURA §4.2). Qui solo il titolare: lo staff non vede gli indirizzi.

const COLONNE =
  "id, nome, tipo, protocollo, indirizzo, porta, reparto, attivo, matricola, ultimo_contatto_il, ultimo_stato, ultimo_stato_testo";

export async function elencoDispositivi() {
  const { data, error } = await supabase.from("dispositivi").select(COLONNE).order("nome");
  if (error) throw error;
  return data ?? [];
}

/** Scrive un apparecchio nuovo, o corregge quello con `id`. */
export async function salvaDispositivo({ id, nome, tipo, protocollo, indirizzo, porta, reparto, attivo, matricola }) {
  const riga = {
    nome: nome.trim(),
    tipo,
    protocollo,
    indirizzo: indirizzo.trim(),
    porta: Number(porta),
    reparto: tipo === "stampante_comande" ? reparto : null,
    // La matricola ce l'ha solo il registratore (04/11): maiuscola, senza spazi.
    matricola: tipo === "registratore_fiscale" && matricola?.trim() ? matricola.replace(/\s+/g, "").toUpperCase() : null,
    attivo,
  };
  const q = id
    ? supabase.from("dispositivi").update(riga).eq("id", id)
    : supabase.from("dispositivi").insert(riga);
  const { error } = await q;
  if (error) throw error;
}

export async function togliDispositivo(id) {
  const { error } = await supabase.from("dispositivi").delete().eq("id", id);
  if (error) throw error;
}

/** Accoda una prova di stampa (`prova`) o una lettura di stato (`stato`). */
export async function chiediLavoro(dispositivoId, tipo) {
  const { data, error } = await supabase.rpc("chiedi_lavoro_dispositivo", {
    p_dispositivo_id: dispositivoId,
    p_tipo: tipo,
  });
  if (error) throw error;
  return data;
}

export async function annullaLavoro(id) {
  const { error } = await supabase.rpc("annulla_lavoro_stampa", { p_id: id });
  if (error) throw error;
}

export async function ultimiLavori(limite = 20) {
  const { data, error } = await supabase
    .from("lavori_stampa")
    .select("id, dispositivo_id, tipo, stato, tentativi, creato_il, finito_il, errore_codice, errore_testo, esito")
    .order("creato_il", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data ?? [];
}

export async function chiaviPonte() {
  const { data, error } = await supabase.rpc("chiavi_ponte_elenco");
  if (error) throw error;
  return data ?? [];
}

/** Crea la chiave del ponte e la restituisce IN CHIARO — una volta sola. */
export async function creaChiavePonte(nome) {
  const { data, error } = await supabase.rpc("crea_chiave_ponte", { p_nome: nome });
  if (error) throw error;
  return data;
}

export async function revocaChiavePonte(id) {
  const { error } = await supabase.rpc("revoca_chiave_ponte", { p_id: id });
  if (error) throw error;
}

// --- Le pagine Cucina e Bar (29/10 e 31/10/2026) ---
// ⚠️ Queste due sono per chiunque lavori, non solo per il titolare: lo
//    staff non legge la coda, ma deve sapere se il foglio è uscito
//    (migrazioni 20261029000001 e 20261031000001).

/** La stampante attiva del reparto («cucina» o «bar», o null), se il ponte è acceso, e i fogli dei conti aperti nella coda. */
export async function statoStampa(reparto) {
  const { data, error } = await supabase.rpc("stato_stampa", { p_reparto: reparto });
  if (error) throw error;
  return data;
}

/** Rimette in coda un foglio: le sue righe, oppure un biglietto del turno. */
export async function mandaAllaStampante({ righe = null, chiamata = null, aggiunta = false }) {
  const { data, error } = await supabase.rpc("manda_alla_stampante", {
    p_righe: righe,
    p_chiamata: chiamata,
    p_aggiunta: aggiunta,
  });
  if (error) throw error;
  return data;
}

// LO SCONTRINO FISCALE DI UN CONTO CHIUSO (04/11/2026, migrazione
// 20261104000001). Righe e pagamenti li scrive il database, non il browser;
// al massimo uno per conto, anche con un doppio clic.

/** Se c'è un registratore acceso e com'è andato lo scontrino di questo conto (solo frasi fisse). */
export async function statoScontrino(orderId) {
  const { data, error } = await supabase.rpc("stato_scontrino", { p_order: orderId });
  if (error) throw error;
  return data;
}

/** Chiede lo scontrino del conto al registratore. */
export async function chiediScontrino(orderId) {
  const { data, error } = await supabase.rpc("accoda_scontrino", { p_order: orderId });
  if (error) throw error;
  return data;
}

// L'ANNULLO DI UNO SCONTRINO E LA CHIUSURA GIORNALIERA (04/11/2026,
// migrazione 20261104000002). Solo il titolare; uno alla volta.

/** Gli ultimi scontrini, con il loro annullo se c'è. */
export async function scontriniRecenti(limite = 20) {
  const { data, error } = await supabase.rpc("scontrini_recenti", { p_limite: limite });
  if (error) throw error;
  return data ?? [];
}

/** Chiede l'annullo dello scontrino uscito di un conto. */
export async function annullaScontrino(orderId) {
  const { data, error } = await supabase.rpc("accoda_annullo", { p_order: orderId });
  if (error) throw error;
  return data;
}

/** Chiede la chiusura fiscale giornaliera (Z) al registratore. */
export async function chiediChiusura(dispositivoId) {
  const { data, error } = await supabase.rpc("chiedi_chiusura", { p_dispositivo: dispositivoId });
  if (error) throw error;
  return data;
}

/** Le comande dei conti aperti che non sono uscite (04/11/2026): per la Sala, frasi fisse. */
export async function avvisiStampa() {
  const { data, error } = await supabase.rpc("avvisi_stampa");
  if (error) throw error;
  return data ?? [];
}
