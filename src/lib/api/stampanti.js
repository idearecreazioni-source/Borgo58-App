import { supabase } from "../supabase";

// LE STAMPANTI, IL REGISTRATORE E LA CODA — 28/10/2026.
// Il gestionale non parla con gli apparecchi: scrive i lavori nella coda e
// il ponte sul mini-PC li porta alla stampante (migrazione 20261028000005,
// ARCHITETTURA §4.2). Qui solo il titolare: lo staff non vede gli indirizzi.

const COLONNE =
  "id, nome, tipo, protocollo, indirizzo, porta, reparto, attivo, ultimo_contatto_il, ultimo_stato, ultimo_stato_testo";

export async function elencoDispositivi() {
  const { data, error } = await supabase.from("dispositivi").select(COLONNE).order("nome");
  if (error) throw error;
  return data ?? [];
}

/** Scrive un apparecchio nuovo, o corregge quello con `id`. */
export async function salvaDispositivo({ id, nome, tipo, protocollo, indirizzo, porta, reparto, attivo }) {
  const riga = {
    nome: nome.trim(),
    tipo,
    protocollo,
    indirizzo: indirizzo.trim(),
    porta: Number(porta),
    reparto: tipo === "stampante_comande" ? reparto : null,
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
    .select("id, dispositivo_id, tipo, stato, tentativi, creato_il, finito_il, errore_codice, errore_testo")
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

// --- La pagina Cucina (29/10/2026) ---
// ⚠️ Queste due sono per chiunque lavori, non solo per il titolare: lo
//    staff non legge la coda, ma deve sapere se il foglio è uscito
//    (migrazione 20261029000001).

/** La stampante attiva della cucina (o null), se il ponte è acceso, e i fogli dei conti aperti nella coda. */
export async function statoStampaCucina() {
  const { data, error } = await supabase.rpc("stato_stampa_cucina");
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
