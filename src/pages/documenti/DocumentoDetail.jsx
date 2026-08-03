import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { deleteDocument, getDocument, getDocumentUrl, updateDocument } from "../../lib/api/documents";
import { formatDate } from "../../lib/constants";

export default function DocumentoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    getDocument(id)
      .then(setDoc)
      .catch((e) => {
        if (e.code === "PGRST116") setNotFound(true);
        else setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const setField = (field, value) => setDoc((d) => ({ ...d, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const saved = await updateDocument(id, {
        title: doc.title,
        doc_type: doc.doc_type,
        document_date: doc.document_date || null,
        counterparties: doc.counterparties,
        amount: doc.amount === "" ? null : doc.amount,
        expiry_date: doc.expiry_date || null,
        note: doc.note,
      });
      setDoc(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openFile = async () => {
    try {
      const url = await getDocumentUrl(doc.storage_path);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await deleteDocument(doc);
      navigate("/documenti");
    } catch (e) {
      setError(e.message);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (notFound) return <Navigate to="/documenti" replace />;
  if (loading || !doc) {
    return <p className="text-sm text-b58-charcoal-soft max-w-2xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <Link to="/documenti" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Archivio documenti
      </Link>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 my-4">{error}</p>
      )}

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mt-3">
        <input
          value={doc.title}
          onChange={(e) => setField("title", e.target.value)}
          className="font-display text-xl text-b58-charcoal bg-transparent border-b border-transparent hover:border-b58-charcoal/20 focus:border-b58-terracotta focus:outline-none w-full mb-4"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass}>Tipo</label>
            <input value={doc.doc_type ?? ""} onChange={(e) => setField("doc_type", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Controparti</label>
            <input value={doc.counterparties ?? ""} onChange={(e) => setField("counterparties", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Data documento</label>
            <input type="date" value={doc.document_date ?? ""} onChange={(e) => setField("document_date", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Scadenza</label>
            <input type="date" value={doc.expiry_date ?? ""} onChange={(e) => setField("expiry_date", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Importo €</label>
            <input type="number" step="0.01" value={doc.amount ?? ""} onChange={(e) => setField("amount", e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="mb-4">
          <label className={labelClass}>Nota</label>
          <textarea value={doc.note ?? ""} onChange={(e) => setField("note", e.target.value)} rows={2} className={inputClass} />
        </div>

        {doc.storage_path ? (
          <div className="mb-4 text-sm">
            <span className="text-b58-charcoal-soft">File: </span>
            <button onClick={openFile} className="text-b58-terracotta hover:text-b58-terracotta-dark">
              {doc.file_name || "apri"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-b58-charcoal-soft/60 mb-4">Nessun file allegato (solo metadati).</p>
        )}

        {doc.task_id && doc.expiry_date && (
          <p className="text-[11px] text-b58-charcoal-soft/70 mb-4">
            Promemoria di scadenza attivo in Agenda per il {formatDate(doc.expiry_date)}.
          </p>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          {confirmDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-b58-terracotta-dark">Eliminare documento e file?</span>
              <button onClick={handleDelete} disabled={deleting} className="rounded-lg bg-b58-terracotta text-b58-parchment px-3 py-1.5 disabled:opacity-60">
                {deleting ? "Elimino…" : "Sì, elimina"}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-b58-charcoal-soft hover:text-b58-charcoal px-2 py-1.5">Annulla</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark">
              Elimina documento
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2">
            {saving ? "Salvo…" : "Salva modifiche"}
          </button>
        </div>
      </div>
    </div>
  );
}
