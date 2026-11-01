import { supabase } from "../supabase";
import { createDocument, deleteDocument, removeDocumentFile, uploadDocumentFile } from "./documents";
import { collegaDocumentoAFattura } from "./supplierInvoices";

// IL FILE XML RESTA ATTACCATO ALLA FATTURA (01/11/2026).
//
// Registrata la fattura elettronica, il file originale va in Archivio
// (sezione «Fatture ricevute») e si collega con `supplier_invoice_id`: così
// si apre dalle Fatture fornitori senza ricaricarlo a mano. Nessuna
// migrazione: la colonna e la sezione esistevano già.
//
// ⚠️ Non esiste una transazione fra deposito e database, e la fattura è già
// registrata quando si arriva qui. Se qualcosa fallisce la fattura RESTA, e
// chi chiama dice chiaramente che manca il file: lo si riprova dallo stesso
// pulsante, anche dopo un nuovo import («già registrata»). L'ordine è lo
// stesso dell'Archivio: prima il file, poi la riga, poi il collegamento; se
// il collegamento fallisce la riga appena nata si toglie, così il riprovo non
// lascia doppioni.
//
// ⚠️ Un .p7m si conserva come XML estratto (è quello che l'app ha letto); la
// busta firmata originale non viene tenuta.

export const SEZIONE_FATTURE = "fatture_ricevute";

export function nomeFileXml(nomeFile) {
  const senza = String(nomeFile ?? "fattura").replace(/\.p7m$/i, "");
  return /\.xml$/i.test(senza) ? senza : `${senza}.xml`;
}

// ⚠️ Niente `expiry_date`: una scadenza farebbe nascere un promemoria e il
// documento comparirebbe fra gli «In scadenza» dell'Archivio.
export function documentoDellaFattura(f, entityId, nomeFile, storagePath) {
  const fornitore = f?.fornitore?.denominazione ?? null;
  const titolo = ["Fattura elettronica", f?.numero ?? null, fornitore].filter(Boolean).join(" - ");
  return {
    title: titolo,
    entity_id: entityId,
    doc_type: SEZIONE_FATTURE,
    document_date: f?.data ?? null,
    counterparties: fornitore,
    amount: f?.totaleCentesimi == null ? null : f.totaleCentesimi / 100,
    expiry_date: null,
    note: `File originale ${nomeFile}.`,
    storage_path: storagePath,
    file_name: nomeFileXml(nomeFile),
  };
}

/**
 * Cerca la fattura registrata da quel file SDI e le attacca l'XML, se non ce
 * l'ha già. Restituisce "salvato" | "gia_presente"; lancia se non riesce.
 */
export async function allegaXmlPerFile({ entityId, nomeFile, xml, fattura }) {
  // ⚠️ Le fatture di un lotto hanno lo stesso file SDI: si sceglie quella con
  // lo stesso numero e la stessa data, mai la prima che capita.
  const { data: trovate, error } = await supabase
    .from("supplier_invoices")
    .select("id, invoice_number, invoice_date, documenti:documents!supplier_invoice_id(id, file_name)")
    .eq("file_sdi", nomeFile);
  if (error) throw new Error(`Non riesco a ritrovare la fattura registrata: ${error.message}`);
  const elenco = Array.isArray(trovate) ? trovate : trovate ? [trovate] : [];
  if (elenco.length === 0) throw new Error("Non trovo la fattura registrata da questo file: il file XML non è stato collegato.");
  const uguale = (a, b) => String(a ?? "").trim() === String(b ?? "").trim();
  const inv = elenco.find((x) => uguale(x.invoice_number, fattura?.numero) && uguale(x.invoice_date, fattura?.data));
  if (!inv) {
    const e = new Error(
      "La fattura registrata da questo file ha un altro numero o un'altra data: il file XML non è stato collegato a questa riga."
    );
    e.nonCorrisponde = true;
    throw e;
  }

  const nome = nomeFileXml(nomeFile);
  if ((inv.documenti ?? []).some((d) => d.file_name === nome)) return "gia_presente";

  const file = new File([xml], nome, { type: "text/xml" });
  const { storage_path } = await uploadDocumentFile(file);
  let docId;
  try {
    docId = await createDocument(documentoDellaFattura(fattura, entityId, nomeFile, storage_path));
  } catch (e) {
    // il file appena caricato non ha nessuna riga: si toglie, o resta orfano
    try {
      await removeDocumentFile(storage_path);
    } catch (e2) {
      throw new Error(`${e.message} Inoltre il file caricato non si è potuto togliere dal deposito (${e2.message}): resta un file senza documento.`);
    }
    throw e;
  }
  try {
    await collegaDocumentoAFattura(docId, inv.id);
  } catch (e) {
    try {
      await deleteDocument({ id: docId, storage_path });
    } catch (e2) {
      throw new Error(`${e.message} Inoltre non ho potuto togliere il documento appena creato (${e2.message}): in Archivio ce ne può essere uno scollegato da eliminare.`);
    }
    throw e;
  }
  return "salvato";
}
