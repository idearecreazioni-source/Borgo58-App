import { supabase } from "../supabase";
import { createTask, updateTask } from "./tasks";

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
export async function createDocument(payload) {
  const { data: doc, error } = await supabase.from("documents").insert(payload).select().single();
  if (error) throw error;

  if (payload.expiry_date) {
    // Riservato al titolare: la visibilità la decide il trigger dal valore di
    // origine_modulo (§3.18, migrazione 20260804000001), non questa chiamata.
    const task = await createTask({
      title: `Scadenza documento: ${payload.title}`,
      due_date: payload.expiry_date,
      category: "Documenti",
      origine_modulo: "archivio_documenti",
    });
    const { data: updated, error: upErr } = await supabase
      .from("documents")
      .update({ task_id: task.id })
      .eq("id", doc.id)
      .select()
      .single();
    if (upErr) throw upErr;
    return updated;
  }
  return doc;
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
