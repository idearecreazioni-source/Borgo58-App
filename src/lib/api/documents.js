import { supabase } from "../supabase";
import { eseguiOperazione } from "../operazioni";
import { filtroRicerca } from "../calcoli/ricerca";

const BUCKET = "documents";

// `conStatoFattura`: aggiunge `fattura: { status }` per i documenti collegati a una
// fattura fornitore (colonna `supplier_invoice_id`); gli altri hanno `fattura: null`.
export async function listDocuments({ search, conStatoFattura = false } = {}) {
  let query = supabase
    .from("documents")
    .select(conStatoFattura ? "*, fattura:supplier_invoices!supplier_invoice_id(status)" : "*")
    .order("document_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (search) query = query.or(filtroRicerca(["title", "doc_type", "counterparties"], search));
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// 🔴 LE SEZIONI DELL'ARCHIVIO (30/08/2026). Prima `doc_type` era testo
// libero, quindi «Fattura», «fattura» e «Fatture» erano tre sezioni diverse.
//
// ⚠️ SI PASSA SEMPRE IL VALORE CORRENTE, e non e' un di piu': un menu a
//    tendina che riceve un valore fuori elenco **mostra la prima opzione**,
//    senza nessun errore (trappola del 27/08, vista a schermo). Chi apre un
//    documento vecchio e salva cambierebbe la sua sezione senza saperlo.
//    La funzione del database aggiunge la sezione corrente anche se spenta.
export async function sezioniArchivio(corrente = null) {
  const { data, error } = await supabase.rpc("sezioni_archivio_per", { p_corrente: corrente });
  if (error) throw error;
  return data ?? [];
}

// Quante ne ha ogni sezione — comprese le VUOTE, che sono un'informazione:
// «qui non c'e' ancora niente» non e' «questa sezione non esiste».
export async function documentiPerSezione() {
  const { data, error } = await supabase.rpc("documenti_per_sezione");
  if (error) throw error;
  return data ?? [];
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

// 🔴 PRIMA IL FILE, POI LA RIGA — ordine INVERTITO il 20/08/2026, e la
// ragione vecchia era misurabile e sbagliata.
//
// Diceva: *«un file orfano è invisibile e innocuo»*. Misurato il 20/08: nel
// deposito ci sono **tre file che nessun documento nomina più**. Non sono
// innocui — sono documenti che Alessio ha cancellato dall'app **credendo di
// averli tolti**, e che nessuna schermata può più raggiungere per toglierli.
// E la parola che li descriveva meglio era proprio «invisibile»: è il motivo
// per cui ci sono voluti dieci giorni per accorgersene.
//
// ⚠️ E NON ESISTE UNA TRANSAZIONE FRA DATABASE E DEPOSITO: sono due sistemi
// diversi, quindi se il secondo passo fallisce qualcosa resta a metà **in
// tutti e due gli ordini**. Non si sceglie fra «tutto o niente» e «metà»: si
// sceglie **quale metà**.
//
//   · ordine vecchio → riga via, file rimasto: **invisibile**, e non si
//     ripara mai, perché dall'app quel file non si nomina più;
//   · ordine nuovo → file via, riga rimasta: **si vede** (il documento è in
//     elenco e non si apre) e **si ripara da sé** al tentativo successivo,
//     perché togliere un file già assente non dà errore.
//
// È lo stesso criterio del blocco A: un difetto che si vede batte uno che
// tace, e uno che si ripara batte uno che resta.
//
// ⚠️ E IL FALLIMENTO NON SI INGOIA PIÙ: se il file non si toglie, la riga
// NON si cancella e chi ha premuto lo sa. Prima l'app diceva «fatto» con
// metà lavoro svolto.
export async function deleteDocument(doc) {
  if (doc.storage_path) {
    const { error } = await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    if (error) {
      throw new Error(
        "Non sono riuscito a togliere il file dal deposito, quindi non ho tolto neanche il documento: " +
          "resta tutto com'era. Riprova fra poco. (" + error.message + ")"
      );
    }
  }
  await eseguiOperazione("delete_document", { p_document_id: doc.id });
}

// Toglie solo il file dal deposito (nessuna riga): serve a chi ha caricato un
// file e poi non è riuscito a creare il documento, per non lasciare orfani.
export async function removeDocumentFile(storagePath) {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw error;
}

// 🔴 ANNULLARE UN LOTTO DI IMPORT DAL DRIVE (22/11/2026, 20261122000001).
// Stesso ordine di `deleteDocument`: PRIMA i file dal deposito, POI le righe. Se il file non si toglie ci si
// ferma e non si tocca niente; se si ferma il passo dopo, restano documenti senza file — si vedono, e riprovando
// si riparano (togliere un file già assente non dà errore).
export async function percorsiLottoImport(lottoId) {
  const { data, error } = await supabase.rpc("import_lotto_percorsi", { p_lotto: lottoId });
  if (error) throw error;
  return data ?? [];
}

// Si può annullare? Risposta { puo, motivo }. La pagina la chiede PRIMA di toccare i file.
export async function lottoImportPuoAnnullare(lottoId) {
  const { data, error } = await supabase.rpc("import_lotto_puo_annullare", { p_lotto: lottoId });
  if (error) throw error;
  const riga = Array.isArray(data) ? data[0] : data;
  return { puo: riga?.puo === true, motivo: riga?.motivo ?? null };
}

// Restituisce quanti documenti ha tolto dall'Archivio.
// ⚠️ Prima si chiede se si può annullare: tolti i file dal deposito, un annullamento che si ferma (lotto già
// annullato, documento usato altrove) lascerebbe documenti senza file.
export async function annullaLottoImport(lottoId) {
  const { puo, motivo } = await lottoImportPuoAnnullare(lottoId);
  if (!puo) throw new Error(motivo ?? "Questo lotto non si può annullare.");
  const percorsi = await percorsiLottoImport(lottoId);
  if (percorsi.length > 0) {
    const { error } = await supabase.storage.from(BUCKET).remove(percorsi.map((p) => p.storage_path));
    if (error) {
      throw new Error(
        "Non sono riuscito a togliere i file dal deposito, quindi non ho annullato il lotto: " +
          "resta tutto com'era. Riprova fra poco. (" + error.message + ")"
      );
    }
  }
  return eseguiOperazione("import_lotto_annulla", { p_lotto: lottoId });
}
