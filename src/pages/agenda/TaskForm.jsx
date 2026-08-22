import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { createTask, deleteTask, getTask, updateTask } from "../../lib/api/tasks";
import { TASK_CATEGORIES, TASK_RICORRENZE, TASK_STATUSES } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";

const emptyForm = {
  title: "",
  description: "",
  due_date: "",
  due_time: "",
  priority: "media",
  status: "da_fare",
  category: "altro",
  preferito: false,
  ricorrenza: "",
  remind_date: "",
  remind_time: "",
  // §3.18: l'Agenda è condivisa, quindi un task nasce visibile. Il titolare
  // può riservarne uno singolo; per i task automatici decide il DB (trigger
  // trg_task_visibility), qualunque cosa mandi questo form.
  visibile_staff: true,
};

// Il DB salva remind_at come timestamptz (UTC); i campi data/ora del form
// lavorano in ora locale del browser — Date fa la conversione in entrambe
// le direzioni.
const splitLocal = (isoString) => {
  if (!isoString) return { date: "", time: "" };
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
};
const combineToISO = (date, time) =>
  date && time ? new Date(`${date}T${time}`).toISOString() : null;

export default function TaskForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { isTitolare } = useAuth();

  const [form, setForm] = useState(emptyForm);
  const [origineModulo, setOrigineModulo] = useState(null);
  const [reminderSentAt, setReminderSentAt] = useState(null);
  const [initialRemindAt, setInitialRemindAt] = useState(null);
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
        const remind = splitLocal(t.remind_at);
        setForm({
          title: t.title,
          description: t.description ?? "",
          due_date: t.due_date ?? "",
          due_time: t.due_time?.slice(0, 5) ?? "",
          priority: t.priority,
          status: t.status,
          category: t.category ?? "altro",
          preferito: t.preferito ?? false,
          ricorrenza: t.ricorrenza ?? "",
          remind_date: remind.date,
          remind_time: remind.time,
          visibile_staff: t.visibile_staff ?? true,
        });
        setOrigineModulo(t.origine_modulo);
        setReminderSentAt(t.reminder_sent_at);
        setInitialRemindAt(t.remind_at);
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
      const newRemindAt = combineToISO(form.remind_date, form.remind_time);
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        due_date: form.due_date || null,
        due_time: form.due_time || null,
        priority: form.priority,
        status: form.status,
        category: form.category || "altro",
        preferito: form.preferito,
        ricorrenza: form.ricorrenza || null,
        remind_at: newRemindAt,
        visibile_staff: form.visibile_staff,
        // Un promemoria nuovo o cambiato deve poter essere rimandato di nuovo.
        ...(newRemindAt !== initialRemindAt ? { reminder_sent_at: null } : {}),
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
      <Link to="/agenda" className="tocco-bottone inline-flex items-center text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
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
        <div className="text-xs text-b58-charcoal-soft bg-b58-olive/5 rounded-lg px-3 py-2 mb-4">
          <p>Generato automaticamente da: {origineModulo}</p>
          {isTitolare && (
            <p className="mt-1">
              {form.visibile_staff
                ? "Visibile anche allo staff."
                : "Riservato a te: lo staff non vede questo task in Agenda. La visibilità dei task automatici dipende dal modulo di origine e non è modificabile da qui."}
            </p>
          )}
        </div>
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
          {/* La priorità dichiarata a mano è sparita: a decidere quanto è
              urgente una cosa è la sua scadenza. Resta la stella, che è
              un'altra cosa e non si può calcolare. */}
          <div>
            <label className={labelClass}>Si ripete</label>
            <select
              value={form.ricorrenza}
              onChange={(e) => setForm((f) => ({ ...f, ricorrenza: e.target.value }))}
              className={inputClass}
            >
              {TASK_RICORRENZE.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <p className="text-xs text-b58-charcoal-soft mt-1">
              Chiudendolo ne nasce subito un altro alla scadenza successiva.
            </p>
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

        {/* Elenco chiuso: prima era testo libero, e su venti righe erano
            nate quattro convenzioni diverse. */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Categoria</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={inputClass}
            >
              {TASK_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-b58-charcoal">
              <input
                type="checkbox"
                checked={form.preferito}
                onChange={(e) => setForm((f) => ({ ...f, preferito: e.target.checked }))}
              />
              ★ Per me conta
            </label>
          </div>
        </div>

        {isTitolare && !origineModulo && (
          <div className="border-t border-b58-charcoal/10 pt-4">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.visibile_staff}
                onChange={(e) => setForm((f) => ({ ...f, visibile_staff: e.target.checked }))}
                className="mt-0.5 shrink-0"
              />
              <span>
                <span className="text-sm text-b58-charcoal">Visibile allo staff</span>
                <span className="block text-xs text-b58-charcoal-soft/70 mt-0.5">
                  L'Agenda è condivisa: di norma un task è visibile a tutti. Togli la
                  spunta per tenerlo solo per te.
                </span>
              </span>
            </label>
          </div>
        )}

        <div className="border-t border-b58-charcoal/10 pt-4">
          <label className={labelClass}>Promemoria Telegram (opzionale)</label>
          <p className="text-xs text-b58-charcoal-soft/70 mb-2">
            Scegli quando vuoi essere avvisato — indipendente dalla data di scadenza.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="date"
              value={form.remind_date}
              onChange={(e) => setForm((f) => ({ ...f, remind_date: e.target.value }))}
              className={inputClass}
            />
            <input
              type="time"
              value={form.remind_time}
              onChange={(e) => setForm((f) => ({ ...f, remind_time: e.target.value }))}
              className={inputClass}
              disabled={!form.remind_date}
            />
          </div>
          {form.remind_date && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, remind_date: "", remind_time: "" }))}
              className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark mt-1.5"
            >
              Rimuovi promemoria
            </button>
          )}
          {reminderSentAt && (
            <p className="text-xs text-b58-olive-dark mt-1.5">
              ✓ Promemoria già inviato il {new Date(reminderSentAt).toLocaleString("it-IT")}
            </p>
          )}
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
