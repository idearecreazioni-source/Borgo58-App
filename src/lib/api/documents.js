import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";
import { updateTask } from "./tasks";

const BUCKET = "documents";

export async function listDocuments({ search } = {}) {
  let query = supabase
    .from("documents")
    .select("*")
    .order("document_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (search) query = query.or(`title.ilike.%${search}%,doc_type.ilike.%${search}%,counterparties.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getDocument(id) {
  const { data, error } = await supabase.from("documents").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

// Carica il file nel bucket privato e restituisce il percorso salvato.
export async function uploadDocumentFile(file) {
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const path = `${crypto.randomUUID()}-${safeName}`;
  // Dichiara il contentType: così il browser sa che PDF/immagini vanno aperti
  // in linea (altrimenti li scarica come file generico).
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  return { storage_path: path, file_name: file.name };
}

// URL firmato a tempo per scaricare/vedere un file privato.
export async function getDocumentUrl(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// Con una scadenza, crea anche il promemoria in Agenda (§3.13).
// Documento + eventuale promemoria di scadenza nella STESSA transazione,
// dentro la funzione Postgres create_document (Contratto B4, 09/08/2026).
// Prima erano tre scritture separate dal browser: un fallimento a metà
// lasciava un documento senza promemoria o un promemoria scollegato.
// Il file va caricato nello storage PRIMA (uploadDocumentFile): prima il
// file, poi la riga — un file orfano è innocuo, una riga senza file no.
// Restituisce l'id del documento.
export async function createDocument(payload) {
  return eseguiOperazione("create_document", {
    p_title: payload.title,
    p_entity_id: payload.entity_id ?? null,
    p_doc_type: payload.doc_type ?? null,
    p_document_date: payload.document_date ?? null,
    p_counterparties: payload.counterparties ?? null,
    p_amount: payload.amount ?? null,
    p_expiry_date: payload.expiry_date ?? null,
    p_note: payload.note ?? null,
    p_storage_path: payload.storage_path ?? null,
    p_file_name: payload.file_name ?? null,
  });
}

export async function updateDocument(id, patch) {
  const { data, error } = await supabase.from("documents").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteDocument(doc) {
  // chiudi il promemoria Agenda collegato
  if (doc.task_id) {
    try {
      await updateTask(doc.task_id, { status: "completato" });
    } catch {
      /* task già rimosso: non bloccare */
    }
  }
  // rimuovi il file dal bucket
  if (doc.storage_path) {
    try {
      await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    } catch {
      /* file già assente: non bloccare la cancellazione del record */
    }
  }
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) throw error;
}
