import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDocument, getDocumentUrl, listDocuments, uploadDocumentFile } from "../../lib/api/documents";
import { getEntities } from "../../lib/api/entities";
import { contaPostaInAttesa } from "../../lib/api/posta";
import { formatDate, formatEUR } from "../../lib/constants";

// Suggerimenti di tipo (nessuna categoria fissa, §3.13: è testo libero).
const TYPE_SUGGESTIONS = [
  "Contratto d'affitto", "Licenza / SCIA", "Assicurazione", "Atto societario",
  "Contratto fornitura", "Utenza", "Certificazione", "Altro",
];

const emptyForm = {
  title: "", doc_type: "", document_date: "", counterparties: "", amount: "", expiry_date: "", note: "",
};

const daysTo = (d) => Math.round((new Date(d) - new Date()) / 86400000);

export default function ArchivioDocumentiHome() {
  const navigate = useNavigate();
  const [entities, setEntities] = useState(null);
  // Quanta posta aspetta una decisione. Il numero sta qui perché è qui
  // che si viene a cercare un documento: il momento giusto per accorgersi
  // che ce n'è dell'altro da guardare.
  const [postaInAttesa, setPostaInAttesa] = useState(0);
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEntities().then(setEntities).catch(() => {});
    contaPostaInAttesa().then(setPostaInAttesa).catch(() => {});
  }, []);

  const reload = () => listDocuments({ search: search || undefined }).then(setDocuments);

  useEffect(() => {
    setLoading(true);
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setError("");
    try {
      let fileInfo = {};
      if (file) fileInfo = await uploadDocumentFile(file);
      await createDocument({
        entity_id: form.entity_id || null,
        title: form.title.trim(),
        doc_type: form.doc_type || null,
        document_date: form.document_date || null,
        counterparties: form.counterparties || null,
        amount: form.amount ? Number(form.amount) : null,
        expiry_date: form.expiry_date || null,
        note: form.note || null,
        ...fileInfo,
      });
      setForm(emptyForm);
      setFile(null);
      setShowForm(false);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const openFile = async (doc) => {
    try {
      const url = await getDocumentUrl(doc.storage_path);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(e.message);
    }
  };

  const expiringSoon = useMemo(
    () => documents.filter((d) => d.expiry_date && daysTo(d.expiry_date) <= 60),
    [documents]
  );

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">Archivio Documenti</h1>
          <p className="text-b58-charcoal-soft mt-1">Contratti, licenze, assicurazioni, atti — con scadenze in Agenda.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/documenti/chiedi")}
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
          >
            Chiedi all'archivio
          </button>
          <button
            onClick={() => navigate("/documenti/posta")}
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
          >
            Posta in arrivo
            {postaInAttesa > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-b58-gold text-b58-parchment text-[11px] font-medium px-2 py-0.5">
                {postaInAttesa}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
          >
            {showForm ? "Annulla" : "+ Nuovo documento"}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-b58-charcoal-soft/70 mb-4">
        I documenti che arrivano dalla posta vengono letti da soli; quelli caricati a mano si
        compilano a mano. «Chiedi all'archivio» risponde a domande sul contenuto dei documenti
        letti. I file sono conservati in modo privato su server UE, solo per te.
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {showForm && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
          <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Titolo del documento" className={`${inputClass} sm:col-span-2`} />
              <input list="doc-type-suggestions" value={form.doc_type} onChange={(e) => setForm((f) => ({ ...f, doc_type: e.target.value }))} placeholder="Tipo (libero)" className={inputClass} />
              <datalist id="doc-type-suggestions">
                {TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className={labelClass}>Data documento</label>
                <input type="date" value={form.document_date} onChange={(e) => setForm((f) => ({ ...f, document_date: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Scadenza</label>
                <input type="date" value={form.expiry_date} onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Importo €</label>
                <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={inputClass} />
              </div>
              {entities && (
                <div>
                  <label className={labelClass}>Entità</label>
                  <select value={form.entity_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, entity_id: e.target.value }))} className={inputClass}>
                    <option value="">—</option>
                    <option value={entities.srls.id}>{entities.srls.name}</option>
                    {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
                  </select>
                </div>
              )}
            </div>
            <input value={form.counterparties} onChange={(e) => setForm((f) => ({ ...f, counterparties: e.target.value }))} placeholder="Controparti (opz., es. locatore, assicurazione)" className={`${inputClass} mb-3`} />
            <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Nota (opz.)" className={`${inputClass} mb-3`} />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm text-b58-charcoal-soft" />
              <button type="button" disabled={saving || !form.title.trim()} onClick={handleAdd} className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60">
                {saving ? "Carico…" : "+ Salva documento"}
              </button>
            </div>
            <p className="text-[11px] text-b58-charcoal-soft/70 mt-2">Il file è opzionale: puoi anche registrare solo i metadati. Con una scadenza, viene creato un promemoria in Agenda.</p>
          </div>
        </div>
      )}

      {/* In scadenza */}
      {expiringSoon.length > 0 && (
        <div className="rounded-xl bg-b58-terracotta/5 ring-1 ring-b58-terracotta/30 p-5 mb-6">
          <h2 className="font-display text-base text-b58-charcoal mb-3">In scadenza (60 giorni)</h2>
          <ul className="space-y-1.5">
            {expiringSoon.map((d) => {
              const days = daysTo(d.expiry_date);
              return (
                <li key={d.id} className="text-sm flex items-center justify-between gap-2">
                  <button onClick={() => navigate(`/documenti/${d.id}`)} className="text-b58-charcoal hover:text-b58-terracotta text-left">
                    {d.title}
                  </button>
                  <span className={days < 0 ? "text-b58-terracotta-dark font-medium" : "text-b58-gold-dark"}>
                    {days < 0 ? `scaduto (${formatDate(d.expiry_date)})` : `${formatDate(d.expiry_date)} (${days}gg)`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca per titolo, tipo, controparti…"
        className={`${inputClass} max-w-sm mb-4`}
      />

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">{search ? "Nessun documento corrisponde." : "Nessun documento ancora."}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 flex items-start justify-between gap-3">
              <button onClick={() => navigate(`/documenti/${d.id}`)} className="text-left min-w-0">
                <div className="text-b58-charcoal font-medium">{d.title}</div>
                <div className="text-xs text-b58-charcoal-soft mt-0.5">
                  {d.doc_type && <>{d.doc_type} · </>}
                  {d.document_date && <>{formatDate(d.document_date)} · </>}
                  {d.counterparties && <>{d.counterparties} · </>}
                  {d.amount != null && <>{formatEUR(d.amount)} · </>}
                  {d.expiry_date && <>scade {formatDate(d.expiry_date)}</>}
                </div>
              </button>
              <div className="flex items-center gap-3 shrink-0">
                {d.storage_path && (
                  <button onClick={() => openFile(d)} className="text-xs text-b58-terracotta hover:text-b58-terracotta-dark">
                    Apri file
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
