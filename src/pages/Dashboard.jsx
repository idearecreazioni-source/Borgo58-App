import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listDashboardTasks, updateTask } from "../lib/api/tasks";
import { TASK_PRIORITIES, formatDate, labelFor, oggiLocale } from "../lib/constants";
import { useAuth } from "../context/AuthContext";

const PRIORITY_BADGE = {
  alta: "bg-b58-terracotta",
  media: "bg-b58-gold",
  bassa: "bg-b58-charcoal-soft/50",
};

// Dashboard home (§3.12): non più una griglia di moduli (già nella sidebar,
// era una navigazione duplicata) — vista viva sull'Agenda, task di oggi +
// task senza data specifica da incastrare nella giornata.
export default function Dashboard() {
  const { isStaff } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () =>
    listDashboardTasks()
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleComplete = async (task) => {
    try {
      await updateTask(task.id, { status: "completato" });
      setTasks((ts) => ts.filter((t) => t.id !== task.id));
    } catch (e) {
      setError(e.message);
    }
  };

  const today = tasks.filter((t) => t.due_date);
  const undated = tasks.filter((t) => !t.due_date);
  const todayLabel = formatDate(oggiLocale());

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">
            {isStaff ? "Benvenuto." : "Bentornato, Alessio."}
          </h1>
          <p className="text-b58-charcoal-soft mt-1">Oggi, {todayLabel}</p>
        </div>
        <Link
          to="/agenda"
          className="text-sm text-b58-terracotta hover:text-b58-terracotta-dark font-medium"
        >
          Agenda completa →
        </Link>
      </div>

      {error && <p className="text-sm text-b58-terracotta-dark mb-4">Errore: {error}</p>}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
              Task di oggi
            </h2>
            {today.length === 0 ? (
              <p className="text-sm text-b58-charcoal-soft/60">Nessun task con scadenza oggi.</p>
            ) : (
              <TaskGroup tasks={today} onComplete={toggleComplete} />
            )}
          </section>

          <section>
            <h2 className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
              Senza data — da incastrare
            </h2>
            {undated.length === 0 ? (
              <p className="text-sm text-b58-charcoal-soft/60">Nessuno.</p>
            ) : (
              <TaskGroup tasks={undated} onComplete={toggleComplete} />
            )}
          </section>

          <Link
            to="/agenda/nuovo"
            className="inline-block rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4 py-2 text-sm"
          >
            + Nuovo task
          </Link>
        </div>
      )}
    </div>
  );
}

function TaskGroup({ tasks, onComplete }) {
  return (
    <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/5">
      {tasks.map((t) => (
        <div key={t.id} className="flex items-center gap-3 px-4 py-3">
          <input
            type="checkbox"
            checked={false}
            onChange={() => onComplete(t)}
            className="shrink-0"
          />
          <Link to={`/agenda/${t.id}`} className="flex-1 min-w-0 text-sm text-b58-charcoal">
            {t.title}
            {t.category && <span className="text-b58-charcoal-soft ml-2">· {t.category}</span>}
          </Link>
          <span
            className={`shrink-0 inline-flex items-center rounded-full ${PRIORITY_BADGE[t.priority]} text-b58-parchment text-[10px] font-medium px-2 py-0.5`}
          >
            {labelFor(TASK_PRIORITIES, t.priority)}
          </span>
        </div>
      ))}
    </div>
  );
}
