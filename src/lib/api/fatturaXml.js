import { supabase } from "../supabase";
import { createDocument, deleteDocument, uploadDocumentFile } from "./documents";
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
  const { data: inv, error } = await supabase
    .from("supplier_invoices")
    .select("id, documenti:documents!supplier_invoice_id(id, file_name)")
    .eq("file_sdi", nomeFile)
    .maybeSingle();
  if (error) throw new Error(`Non riesco a ritrovare la fattura registrata: ${error.message}`);
  if (!inv) throw new Error("Non trovo la fattura registrata da questo file: il file XML non è stato collegato.");

  const nome = nomeFileXml(nomeFile);
  if ((inv.documenti ?? []).some((d) => d.file_name === nome)) return "gia_presente";

  const file = new File([xml], nome, { type: "text/xml" });
  const { storage_path } = await uploadDocumentFile(file);
  const docId = await createDocument(documentoDellaFattura(fattura, entityId, nomeFile, storage_path));
  try {
    await collegaDocumentoAFattura(docId, inv.id);
  } catch (e) {
    try {
      await deleteDocument({ id: docId, storage_path });
    } catch {
      // già stiamo segnalando il guasto vero: il riprovo non peggiora nulla
    }
    throw e;
  }
  return "salvato";
}
