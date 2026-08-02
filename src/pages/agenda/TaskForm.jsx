import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { createTask, deleteTask, getTask, updateTask } from "../../lib/api/tasks";
import { TASK_PRIORITIES, TASK_STATUSES } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";

const emptyForm = {
  title: "",
  description: "",
  due_date: "",
  due_time: "",
  priority: "media",
  status: "da_fare",
  category: "",
};

export default function TaskForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { isTitolare } = useAuth();

  const [form, setForm] = useState(emptyForm);
  const [origineModulo, setOrigineModulo] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    getTask(id)
      .then((t) => {
        if (cancelled) return;
        setForm({
          title: t.title,
          description: t.description ?? "",
          due_date: t.due_date ?? "",
          due_time: t.due_time?.slice(0, 5) ?? "",
          priority: t.priority,
          status: t.status,
          category: t.category ?? "",
        });
        setOrigineModulo(t.origine_modulo);
      })
      .catch((e) => {
        if (e.code === "PGRST116") setNotFound(true);
        else if (!cancelled) setError(e.message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  if (notFound) return <Navigate to="/agenda" replace />;
  if (loading) {
    return <p className="text-sm text-b58-charcoal-soft max-w-xl mx-auto">Caricamento…</p>;
  }

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        due_date: form.due_date || null,
        due_time: form.due_time || null,
        priority: form.priority,
        status: form.status,
        category: form.category || null,
      };
      if (isEdit) {
        await updateTask(id, payload);
        navigate("/agenda");
      } else {
        await createTask(payload);
        navigate("/agenda");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await deleteTask(id);
      navigate("/agenda");
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <Link to="/agenda" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Agenda
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">
        {isEdit ? "Modifica task" : "Nuovo task"}
      </h1>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {origineModulo && (
        <p className="text-xs text-b58-charcoal-soft bg-b58-olive/5 rounded-lg px-3 py-2 mb-4">
          Generato automaticamente da: {origineModulo}
        </p>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 space-y-4">
        <div>
          <label className={labelClass}>Titolo</label>
          <input
            required
            autoFocus
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Descrizione (opzionale)</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Data (opzionale)</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Ora (opzionale)</label>
            <input
              type="time"
              value={form.due_time}
              onChange={(e) => setForm((f) => ({ ...f, due_time: e.target.value }))}
              className={inputClass}
              disabled={!form.due_date}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Priorità</label>
            <select
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className={inputClass}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Stato</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className={inputClass}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Categoria (opzionale)</label>
          <input
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder='Es. "Adempimenti societari", "Cucina", "Manutenzione"'
            className={inputClass}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment font-medium px-5 py-2.5 text-sm"
          >
            {saving ? "Salvo…" : isEdit ? "Salva modifiche" : "Crea task"}
          </button>
          {isEdit && isTitolare && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta-dark"
            >
              Elimina
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
