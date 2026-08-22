import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createFiscalTool,
  deleteFiscalTool,
  listFiscalTools,
  updateFiscalTool,
} from "../../lib/api/fiscal";
import { FISCAL_TOOL_CATEGORIES, FISCAL_TOOL_STATUSES, formatDate, labelFor } from "../../lib/constants";

const STATUS_BADGE = {
  attivo: "bg-b58-olive",
  da_verificare: "bg-b58-gold",
  scaduto: "bg-b58-charcoal-soft/60",
  abolito: "bg-b58-terracotta",
};

const emptyForm = {
  name: "",
  category: "deduzione",
  description: "",
  applicability: "",
  status: "da_verificare",
  normative_reference: "",
  last_verified_date: "",
  in_use: false,
  deadline: "",
};

export default function CatalogoStrumenti() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const reload = () => listFiscalTools().then(setTools);

  useEffect(() => {
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createFiscalTool({
        name: form.name.trim(),
        category: form.category,
        description: form.description || null,
        applicability: form.applicability || null,
        status: form.status,
        normative_reference: form.normative_reference || null,
        last_verified_date: form.last_verified_date || null,
        in_use: form.in_use,
        deadline: form.deadline || null,
      });
      setForm(emptyForm);
      setShowForm(false);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleInUse = async (tool) => {
    try {
      await updateFiscalTool(tool.id, { in_use: !tool.in_use });
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (tool) => {
    try {
      await deleteFiscalTool(tool.id, tool.task_id);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/fiscale" className="tocco-bottone inline-flex items-center text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Proiezione fiscale
        </Link>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
        >
          {showForm ? "Annulla" : "+ Nuovo strumento"}
        </button>
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-1">Catalogo strumenti fiscali</h1>
      <p className="text-xs text-b58-charcoal-soft/80 mb-6">
        Deduzioni, crediti d'imposta, bandi e incentivi rilevanti per Borgo 58. Popolato a mano per ora; in
        futuro il modulo Ricerca ricorrente lo aggiornerà da solo (§3.7). Con una scadenza, viene creato un
        promemoria in Agenda.
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {showForm && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
          <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nome strumento"
                className={`${inputClass} sm:col-span-2`}
              />
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className={inputClass}
              >
                {FISCAL_TOOL_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Descrizione"
              rows={2}
              className={`${inputClass} mb-3`}
            />
            <textarea
              value={form.applicability}
              onChange={(e) => setForm((f) => ({ ...f, applicability: e.target.value }))}
              placeholder="Condizioni di applicabilità per Borgo 58"
              rows={2}
              className={`${inputClass} mb-3`}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className={labelClass}>Stato</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className={inputClass}
                >
                  {FISCAL_TOOL_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Ultima verifica</label>
                <input
                  type="date"
                  value={form.last_verified_date}
                  onChange={(e) => setForm((f) => ({ ...f, last_verified_date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Scadenza (opz.)</label>
                <input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Rif. normativo</label>
                <input
                  value={form.normative_reference}
                  onChange={(e) => setForm((f) => ({ ...f, normative_reference: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
                <input
                  type="checkbox"
                  checked={form.in_use}
                  onChange={(e) => setForm((f) => ({ ...f, in_use: e.target.checked }))}
                />
                Lo sto usando
              </label>
              <button
                type="button"
                disabled={saving || !form.name.trim()}
                onClick={handleAdd}
                className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
              >
                {saving ? "Salvo…" : "+ Aggiungi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : tools.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">Nessuno strumento in catalogo.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {tools.map((t) => (
            <li key={t.id} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-b58-charcoal font-medium">{t.name}</span>
                    <span className={`inline-flex items-center rounded-full ${STATUS_BADGE[t.status]} text-b58-parchment text-[10px] font-medium px-2 py-0.5`}>
                      {labelFor(FISCAL_TOOL_STATUSES, t.status)}
                    </span>
                    <span className="text-[11px] text-b58-charcoal-soft bg-b58-cream-dark rounded-full px-2 py-0.5">
                      {labelFor(FISCAL_TOOL_CATEGORIES, t.category)}
                    </span>
                    {t.in_use && (
                      <span className="text-[11px] text-b58-olive-dark bg-b58-olive/10 rounded-full px-2 py-0.5">
                        in uso
                      </span>
                    )}
                  </div>
                  {t.description && <p className="text-sm text-b58-charcoal-soft mt-1">{t.description}</p>}
                  {t.applicability && (
                    <p className="text-xs text-b58-charcoal-soft/80 mt-1">Applicabilità: {t.applicability}</p>
                  )}
                  <p className="text-[11px] text-b58-charcoal-soft/70 mt-1">
                    {t.normative_reference && <>Rif.: {t.normative_reference} · </>}
                    {t.last_verified_date && <>verificato {formatDate(t.last_verified_date)} · </>}
                    {t.deadline && <>scadenza {formatDate(t.deadline)}</>}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    onClick={() => toggleInUse(t)}
                    className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta"
                  >
                    {t.in_use ? "Segna non in uso" : "Segna in uso"}
                  </button>
                  <button
                    onClick={() => handleDelete(t)}
                    className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                  >
                    Rimuovi
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
