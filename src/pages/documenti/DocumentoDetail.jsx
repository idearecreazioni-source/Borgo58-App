import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { deleteDocument, getDocument, getDocumentUrl, updateDocument } from "../../lib/api/documents";
import { leggiContenutoDocumento } from "../../lib/api/assistente";
import { formatDate } from "../../lib/constants";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";

export default function DocumentoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [leggendo, setLeggendo] = useState(false);
  const [esitoLettura, setEsitoLettura] = useState(null);

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

  // Il contenuto del file dentro il documento: è ciò che permette a
  // «Chiedi all'archivio» di rispondere su questo documento invece di
  // dire «ne conosco solo la scheda».
  const leggiContenuto = async (rileggi = false) => {
    setLeggendo(true);
    setError("");
    setEsitoLettura(null);
    try {
      const r = await leggiContenutoDocumento(id, { rileggi });
      setEsitoLettura(r);
      setDoc(await getDocument(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setLeggendo(false);
    }
  };

  // ⚠️ Niente `setDeleting`/`setConfirmDelete`: quello stato vive dentro
  // `<ConfermaDistruttiva>`, che gira il bottone in «Elimino…» e si
  // rimette a posto da sé anche quando l'azione fallisce. Qui resta solo
  // ciò che è di questa schermata: cancellare, e dove andare dopo.
  const handleDelete = async () => {
    setError("");
    try {
      await deleteDocument(doc);
      navigate("/documenti");
    } catch (e) {
      setError(e.message);
    }
  };

  if (notFound) return <Navigate to="/documenti" replace />;
  if (loading || !doc) {
    return <p className="text-sm text-b58-charcoal-soft max-w-2xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <Link to="/documenti" className="tocco-bottone inline-flex items-center text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
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

        {/* Il contenuto letto dentro il file. Senza, l'assistente conosce
            di questo documento solo i campi qui sopra. */}
        {doc.storage_path && (
          <div className="mb-4 rounded-lg bg-white border border-b58-charcoal/10 p-3">
            {doc.testo ? (
              <p className="text-xs text-b58-charcoal-soft">
                Contenuto letto: <strong>{doc.testo.length}</strong> caratteri. «Chiedi
                all'archivio» può rispondere su questo documento.
                <button
                  onClick={() => leggiContenuto(true)}
                  disabled={leggendo}
                  className="ml-2 underline hover:text-b58-charcoal disabled:opacity-40"
                >
                  {leggendo ? "rileggo…" : "rileggi"}
                </button>
              </p>
            ) : (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-b58-charcoal-soft">
                  Contenuto non ancora letto: l'assistente di questo documento conosce solo la
                  scheda qui sopra.
                </p>
                <button
                  onClick={() => leggiContenuto(false)}
                  disabled={leggendo}
                  className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-40 transition-colors text-b58-charcoal text-xs font-medium px-3 py-1.5"
                >
                  {leggendo ? "Leggo…" : "Leggi il contenuto"}
                </button>
              </div>
            )}
            {leggendo && (
              <p className="text-[11px] text-b58-charcoal-soft/70 mt-2">
                Un documento lungo può richiedere un minuto.
              </p>
            )}
            {esitoLettura && !leggendo && (
              <p className="text-[11px] text-b58-charcoal-soft/70 mt-2">
                {esitoLettura.gia_letto
                  ? "Il contenuto c'era già."
                  : `${esitoLettura.caratteri} caratteri, ${esitoLettura.come}.`}
                {esitoLettura.troncato && " Il documento era lungo: la lettura si è fermata prima della fine."}
              </p>
            )}
          </div>
        )}

        {doc.task_id && doc.expiry_date && (
          <p className="text-[11px] text-b58-charcoal-soft/70 mb-4">
            Promemoria di scadenza attivo in Agenda per il {formatDate(doc.expiry_date)}.
          </p>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* 🔴 ERA UNA CONFERMA RIFATTA A MANO (22/08). Faceva le stesse
              tre cose di `<ConfermaDistruttiva>` — il bottone che si gira
              in riga di conferma, «Sì, elimina», «Annulla» — ma con un
              `gap-2`, cioè **1,08 mm veri** fra il gesto irreversibile e
              il suo contrario. Il componente è stato portato a **5 mm**
              stamattina, e questa copia non l'ha saputo.
              ⚠️ È il doppione nella sua forma classica: due posti che
              dicono *esattamente* la stessa cosa, quindi non si sorveglia
              — si toglie. E c'era da vederlo dentro il commento del
              componente stesso, che dichiara *«la forma è quella che
              "Elimina dipendente" usa dal 09/08»*: la forma era stata
              estratta di qui, e i due originali erano rimasti indietro. */}
          <ConfermaDistruttiva
            etichetta="Elimina documento"
            domanda="Eliminare documento e file?"
            onConferma={handleDelete}
          />
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2">
            {saving ? "Salvo…" : "Salva modifiche"}
          </button>
        </div>
      </div>
    </div>
  );
}
