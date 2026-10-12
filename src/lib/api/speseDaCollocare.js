// Le spese «Da collocare» — il lato del gestionale (11/10/2026, C12).
//
// 🔴 UN APPUNTO NON È CONTABILITÀ: lo diventa una volta sola, con
//    `collocaSpesa`, che passa dal corridoio perché scrive il dato
//    definitivo e il segno sull'appunto insieme.
//
// ⚠️ LA FOTO: prima il file, poi la riga — un file orfano lo trova
//    `npm run deposito:orfani`, una riga che nomina un file mai caricato
//    non si apre. E alla fine il contrario: prima si toglie il file, poi si
//    svuota la colonna (stessa ragione di `deleteDocument`).

import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";
import { giaCaricata } from "../calcoli/daCollocare";

const BUCKET = "documents";
const CARTELLA = "da-collocare";

export async function listSpeseDaCollocare() {
  const { data, error } = await supabase
    .from("spese_da_collocare")
    .select("*")
    .eq("stato", "da_collocare")
    .order("creata_il", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Le ultime collocate o ignorate: per vedere dove sono finite.
export async function listSpeseCollocate(quante = 20) {
  const { data, error } = await supabase
    .from("spese_da_collocare")
    .select("*")
    .neq("stato", "da_collocare")
    .order("collocata_il", { ascending: false })
    .limit(quante);
  if (error) throw error;
  return data ?? [];
}

/** Quante aspettano: per il segno in Cassa. */
export async function contaSpeseDaCollocare() {
  const { count, error } = await supabase
    .from("spese_da_collocare")
    .select("id", { count: "exact", head: true })
    .eq("stato", "da_collocare");
  if (error) throw error;
  return count ?? 0;
}

function blobDaBase64(base64, tipo) {
  const binario = atob(base64);
  const byte = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) byte[i] = binario.charCodeAt(i);
  return new Blob([byte], { type: tipo });
}

/**
 * Una foto letta da MEMO diventa un appunto da collocare.
 * `pronta` è la foto già rimpicciolita (preparaFoto), `campi` ciò che MEMO
 * ha capito (appuntoDaLettura).
 *
 * 🔴 `chiave` SI GENERA UNA VOLTA PER FOTO E SI RIPASSA A OGNI «RIPROVA»
 *    (20261011000004). Se la rete cade dopo che il database ha scritto, la
 *    seconda chiamata riceve lo stesso appunto invece di scriverne un altro;
 *    e il file ha un nome che dipende dalla chiave, quindi riprovando non ne
 *    nasce una seconda copia.
 */
export async function annotaSpesaDaFoto(campi, pronta, chiave = crypto.randomUUID()) {
  let fotoPath = null;
  if (pronta?.base64) {
    fotoPath = `${CARTELLA}/${chiave}.jpg`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fotoPath, blobDaBase64(pronta.base64, pronta.tipo || "image/jpeg"), {
        upsert: false,
        contentType: pronta.tipo || "image/jpeg",
      });
    // ⚠️ «Esiste già» vuol dire che il giro di prima l'aveva caricata: è la
    //    stessa foto, e si va avanti. Ogni altro rifiuto ferma.
    if (error && !giaCaricata(error)) {
      throw new Error("Non sono riuscito a conservare la foto: " + error.message);
    }
  }
  const { data, error } = await supabase.rpc("annota_spesa_da_collocare", {
    p_campi: { ...campi, chiave, foto_path: fotoPath, foto_nome: fotoPath ? "ricevuta.jpg" : null },
  });
  if (error) throw error;
  return data;
}

export async function urlFotoSpesa(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function collocaSpesa(id, dove, campi) {
  return eseguiOperazione("colloca_spesa", { p_id: id, p_dove: dove, p_campi: campi });
}

/**
 * La via di ritorno: toglie il movimento, l'anticipo o il documento e
 * riporta la spesa fra quelle da collocare. Restituisce la frase che dice
 * cosa è stato tolto.
 */
export async function annullaCollocazione(id) {
  return eseguiOperazione("annulla_collocazione_spesa", { p_id: id });
}

/**
 * Toglie un appunto mai diventato contabilità (da collocare o ignorato).
 * Prima la riga, poi il file: se il secondo passo fallisce il file resta
 * orfano e lo trova `npm run deposito:orfani`.
 */
export async function eliminaSpesa(id) {
  const esito = await eseguiOperazione("elimina_spesa_da_collocare", { p_id: id });
  const path = esito?.foto_da_togliere;
  if (path) {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) {
      return {
        fotoRimasta:
          "La spesa è tolta, ma la sua foto è rimasta nel deposito: non dà fastidio, e la trova il controllo dei file orfani.",
      };
    }
  }
  return {};
}

/** Dopo la collocazione la foto se ne va (tranne che in Archivio). */
export async function togliFotoSpesa(id, path) {
  if (path) {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) {
      throw new Error(
        "La spesa è collocata, ma la foto non si è tolta dal deposito: riprova con «Togli la foto». (" +
          error.message +
          ")"
      );
    }
  }
  const { error } = await supabase.rpc("togli_foto_spesa", { p_id: id });
  if (error) throw error;
}
