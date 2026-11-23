import { supabase } from "../supabase";
import { removeDocumentFile, uploadDocumentFile } from "./documents";

// L'IMPORT DAL DRIVE — parlare col database (22/11/2026, pezzo C2).
//
// 🔴 QUI NON C'È NESSUN MODELLO: nessuna lettura AI, nessuna chiamata alle funzioni che leggono i documenti con un modello.
//    Un file importato entra come scheda + file nel deposito e basta; il suo contenuto si legge dopo, solo se Alessio lo
//    chiede dalla scheda del documento (e solo se non è bloccato dal segno «non far leggere all'AI»).
//    (Lo garantisce tests/unita/import-drive-c2.test.js.)
// ⚠️ Le tabelle sono del solo titolare (RLS): la pagina sta dietro RequireTitolare.
// ⚠️ Ogni lettura fallita LANCIA: un elenco vuoto per un errore si leggerebbe «non ci sono doppioni».

const A_BLOCCHI = 100;

// Le impronte già in Archivio, fra quelle date: mappa impronta → titolo.
export async function impronteInArchivio(impronte) {
  const gia = new Map();
  const uniche = [...new Set(impronte.filter(Boolean))];
  for (let i = 0; i < uniche.length; i += A_BLOCCHI) {
    const { data, error } = await supabase
      .from("documents")
      .select("title, impronta_sha256")
      .in("impronta_sha256", uniche.slice(i, i + A_BLOCCHI));
    if (error) throw error;
    for (const d of data ?? []) gia.set(d.impronta_sha256, d.title);
  }
  return gia;
}

// Apre un lotto: un carico = una riga. `creato_da` lo mette il database.
export async function apriLottoImport(nota = null) {
  const { data, error } = await supabase.from("lotti_import").insert({ nota }).select("id").single();
  if (error) throw error;
  return data.id;
}

// Un documento importato: prima il file nel deposito, poi la riga (come `deleteDocument` al contrario: se la riga non
// si scrive, il file appena caricato si toglie, per non lasciare orfani). Restituisce l'id del documento.
// ⚠️ `doc_type` e `document_date` vanno INSIEME (vincolo documents_ha_identita).
// 🔴 `entityId`: la società a cui il documento appartiene (Borgo 58 S.r.l.s.). Senza, le proposte della Scheda lo
//    ignorano (guardano solo i documenti della S.r.l.s.): è quanto trovò la revisione del 23/11 sui primi 27 file.
// 🔴 `dataDaVerificare`: la data è l'ultima modifica del file, non quella vera: il segno resta sul documento.
export async function importaDocumento({ file, titolo, sezione, data, dataDaVerificare, sensibile, noAi, impronta, lottoId, entityId }) {
  const { storage_path, file_name } = await uploadDocumentFile(file);
  const { data: nato, error } = await supabase
    .from("documents")
    .insert({
      title: titolo,
      entity_id: entityId ?? null,
      doc_type: sezione,
      document_date: data,
      data_da_verificare: dataDaVerificare === true,
      storage_path,
      file_name,
      impronta_sha256: impronta ?? null,
      sensibile: sensibile ?? null,
      no_ai: noAi === true,
      lotto_import_id: lottoId,
    })
    .select("id")
    .single();
  if (error) {
    try {
      await removeDocumentFile(storage_path);
    } catch {
      // Il file resta nel deposito senza documento: lo dice l'errore che segue, non si finge che sia tutto a posto.
      throw new Error(`${error.message} (e il file caricato non si è potuto togliere dal deposito)`);
    }
    throw error;
  }
  return nato.id;
}

// I link già nell'elenco del Drive.
export async function linkElencoDrive() {
  const { data, error } = await supabase.from("elenco_drive").select("link");
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.link));
}

// Scrive le righe nuove nell'elenco. Un link già presente non si duplica (indice unico sul link): `ignoreDuplicates`.
export async function scriviElencoDrive(righe) {
  let scritte = 0;
  for (let i = 0; i < righe.length; i += A_BLOCCHI) {
    const blocco = righe.slice(i, i + A_BLOCCHI);
    const { data, error } = await supabase
      .from("elenco_drive")
      .upsert(blocco, { onConflict: "link", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    scritte += (data ?? []).length;
  }
  return scritte;
}

// «La data è giusta»: toglie il segno «da verificare» senza cambiare la data. Si scrive il segno apertamente (il
// database lo spegne da solo solo quando la data cambia).
export async function confermaDataDocumento(documentoId) {
  const { data, error } = await supabase
    .from("documents")
    .update({ data_da_verificare: false })
    .eq("id", documentoId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// Il segno «non far leggere all'AI» di un documento, dalla sua scheda.
export async function impostaNoAi(documentoId, noAi) {
  const { data, error } = await supabase
    .from("documents")
    .update({ no_ai: noAi === true })
    .eq("id", documentoId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
