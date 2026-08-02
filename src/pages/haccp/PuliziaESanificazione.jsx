import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  addCleaningLog,
  addPestControlLog,
  createCleaningTask,
  listCleaningLogs,
  listCleaningTasks,
  listPestControlLogs,
} from "../../lib/api/haccp";
import { CLEANING_FREQUENCIES, PEST_CONTROL_TYPES, formatDate, labelFor } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";

const emptyTaskForm = { name: "", area: "", frequency: "giornaliera" };
const emptyPestForm = { performed_by: "", type: "ispezione", findings: "", note: "" };

export default function PuliziaESanificazione() {
  const { isTitolare } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [cleaningLogs, setCleaningLogs] = useState([]);
  const [pestLogs, setPestLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

  const [openTaskId, setOpenTaskId] = useState(null);
  const [logNote, setLogNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [pestForm, setPestForm] = useState(emptyPestForm);
  const [addingPest, setAddingPest] = useState(false);

  const load = () =>
    Promise.all([listCleaningTasks(), listCleaningLogs(), listPestControlLogs()]).then(
      ([t, cl, pl]) => {
        setTasks(t);
        setCleaningLogs(cl);
        setPestLogs(pl);
      }
    );

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const lastCompletedFor = (taskId) => cleaningLogs.find((l) => l.task_id === taskId)?.completed_at;

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleAddTask = async () => {
    if (!taskForm.name.trim()) return;
    setAddingTask(true);
    setError("");
    try {
      await createCleaningTask({
        name: taskForm.name.trim(),
        area: taskForm.area || null,
        frequency: taskForm.frequency,
      });
      setTaskForm(emptyTaskForm);
      setShowTaskForm(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingTask(false);
    }
  };

  const handleAddCleaningLog = async (taskId) => {
    setSaving(true);
    setError("");
    try {
      await addCleaningLog({ taskId, note: logNote });
      setOpenTaskId(null);
      setLogNote("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPest = async () => {
    setAddingPest(true);
    setError("");
    try {
      await addPestControlLog({
        performedBy: pestForm.performed_by,
        type: pestForm.type,
        findings: pestForm.findings,
        note: pestForm.note,
      });
      setPestForm(emptyPestForm);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingPest(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-b58-charcoal-soft max-w-3xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link to="/haccp" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← HACCP
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">Pulizia e disinfestazione</h1>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-b58-charcoal">Attività di pulizia e sanificazione</h2>
          {isTitolare && (
            <button
              type="button"
              onClick={() => setShowTaskForm((v) => !v)}
              className="text-xs text-b58-terracotta hover:text-b58-terracotta-dark"
            >
              {showTaskForm ? "Annulla" : "+ Nuova attività"}
            </button>
          )}
        </div>

        {isTitolare && showTaskForm && (
          <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <input
                value={taskForm.name}
                onChange={(e) => setTaskForm((f) => ({ ...f, name: e.target.value }))}
                placeholder='Es. "Sanificazione banco pesce"'
                className={`${inputClass} col-span-2 sm:col-span-1`}
              />
              <input
                value={taskForm.area}
                onChange={(e) => setTaskForm((f) => ({ ...f, area: e.target.value }))}
                placeholder="Area (opzionale)"
                className={inputClass}
              />
              <select
                value={taskForm.frequency}
                onChange={(e) => setTaskForm((f) => ({ ...f, frequency: e.target.value }))}
                className={inputClass}
              >
                {CLEANING_FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end mt-2">
              <button
                type="button"
                disabled={addingTask || !taskForm.name.trim()}
                onClick={handleAddTask}
                className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
              >
                {addingTask ? "Aggiungo…" : "+ Aggiungi"}
              </button>
            </div>
          </div>
        )}

        {tasks.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60">
            Nessuna attività ancora.{isTitolare ? " Aggiungine una per iniziare." : ""}
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {tasks.map((t) => {
                const last = lastCompletedFor(t.id);
                return (
                  <Fragment key={t.id}>
                    <tr className="border-b border-b58-charcoal/5 last:border-0">
                      <td className="py-2 text-b58-charcoal font-medium">
                        {t.name}
                        <span className="text-xs text-b58-charcoal-soft ml-1.5">
                          ({labelFor(CLEANING_FREQUENCIES, t.frequency)}{t.area ? ` · ${t.area}` : ""})
                        </span>
                        <div className="text-xs text-b58-charcoal-soft">
                          {last ? `Ultima: ${formatDate(last)}` : "Mai eseguita"}
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => {
                            setOpenTaskId((id) => (id === t.id ? null : t.id));
                            setLogNote("");
                          }}
                          className="text-b58-charcoal-soft hover:text-b58-terracotta-dark text-xs"
                        >
                          {openTaskId === t.id ? "Annulla" : "+ Segna eseguita"}
                        </button>
                      </td>
                    </tr>
                    {openTaskId === t.id && (
                      <tr className="bg-white">
                        <td colSpan={2} className="py-3">
                          <div className="flex flex-wrap gap-2 items-end">
                            <div className="flex-1 min-w-[160px]">
                              <input
                                value={logNote}
                                onChange={(e) => setLogNote(e.target.value)}
                                placeholder="Nota (opzionale)"
                                className={inputClass}
                              />
                            </div>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => handleAddCleaningLog(t.id)}
                              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
                            >
                              {saving ? "Salvo…" : "Conferma"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Disinfestazione</h2>

        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
            <input
              value={pestForm.performed_by}
              onChange={(e) => setPestForm((f) => ({ ...f, performed_by: e.target.value }))}
              placeholder="Ditta / operatore"
              className={inputClass}
            />
            <select
              value={pestForm.type}
              onChange={(e) => setPestForm((f) => ({ ...f, type: e.target.value }))}
              className={inputClass}
            >
              {PEST_CONTROL_TYPES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <input
              value={pestForm.findings}
              onChange={(e) => setPestForm((f) => ({ ...f, findings: e.target.value }))}
              placeholder="Esito (opzionale)"
              className={inputClass}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <input
              value={pestForm.note}
              onChange={(e) => setPestForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Nota (opzionale)"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={addingPest}
              onClick={handleAddPest}
              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60 shrink-0"
            >
              {addingPest ? "Registro…" : "+ Registra"}
            </button>
          </div>
        </div>

        {pestLogs.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60">Nessun intervento registrato ancora.</p>
        ) : (
          <ul className="space-y-1.5">
            {pestLogs.map((p) => (
              <li key={p.id} className="text-sm text-b58-charcoal-soft">
                <span className="text-b58-charcoal">{labelFor(PEST_CONTROL_TYPES, p.type)}</span>
                {p.performed_by && ` · ${p.performed_by}`} — {formatDate(p.performed_at)}
                {p.findings && ` · ${p.findings}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
