import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listTasks, listTasksForMonth, updateTask } from "../../lib/api/tasks";
import { TASK_PRIORITIES, TASK_STATUSES, formatDate, labelFor } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";

const PRIORITY_BADGE = {
  alta: "bg-b58-terracotta",
  media: "bg-b58-gold",
  bassa: "bg-b58-charcoal-soft/50",
};

const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

function CalendarView({ tasks, loading, year, month, onPrev, onNext, selectedDay, onSelectDay }) {
  const firstOfMonth = new Date(year, month - 1, 1);
  // Lunedì=0 ... Domenica=6
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const tasksByDay = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const day = Number(t.due_date.slice(8, 10));
      (map[day] ??= []).push(t);
    });
    return map;
  }, [tasks]);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrev} className="text-b58-charcoal-soft hover:text-b58-terracotta px-2">←</button>
        <h3 className="font-display text-base text-b58-charcoal">
          {MONTH_NAMES[month - 1]} {year}
        </h3>
        <button onClick={onNext} className="text-b58-charcoal-soft hover:text-b58-terracotta px-2">→</button>
      </div>

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <div className="grid grid-cols-7 gap-1 text-center">
          {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
            <div key={d} className="text-[11px] text-b58-charcoal-soft/60 font-medium pb-1">{d}</div>
          ))}
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />;
            const dateISO = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayTasks = tasksByDay[day] ?? [];
            const isToday = dateISO === todayISO;
            const isSelected = dateISO === selectedDay;
            return (
              <button
                key={idx}
                onClick={() => onSelectDay(isSelected ? null : dateISO)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative ${
                  isSelected
                    ? "bg-b58-terracotta text-b58-parchment"
                    : isToday
                      ? "bg-b58-olive/15 text-b58-charcoal font-medium"
                      : "text-b58-charcoal hover:bg-b58-cream-dark"
                }`}
              >
                {day}
                {dayTasks.length > 0 && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                      isSelected ? "bg-b58-parchment" : "bg-b58-terracotta"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Solo il titolare vede i task riservati (la RLS li filtra per lo staff,
// §3.18) — per lui è utile sapere a colpo d'occhio quali lo sono, altrimenti
// non ha modo di distinguerli da quelli che lo staff sta leggendo davvero.
function RiservatoBadge() {
  return (
    <span
      title="Riservato: lo staff non vede questo task"
      className="shrink-0 inline-flex items-center rounded-full bg-b58-charcoal/10 text-b58-charcoal-soft text-[10px] font-medium px-2 py-0.5"
    >
      Riservato
    </span>
  );
}

export default function AgendaList() {
  const { isTitolare } = useAuth();
  const [view, setView] = useState("lista");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [monthTasks, setMonthTasks] = useState([]);
  const [monthLoading, setMonthLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    setLoading(true);
    listTasks({ status: status || undefined, priority: priority || undefined, search: search || undefined })
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, priority, search]);

  useEffect(() => {
    if (view !== "calendario") return;
    setMonthLoading(true);
    listTasksForMonth(year, month)
      .then(setMonthTasks)
      .catch((e) => setError(e.message))
      .finally(() => setMonthLoading(false));
  }, [view, year, month]);

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    setMonth(m);
    setYear(y);
    setSelectedDay(null);
  };

  const toggleComplete = async (task) => {
    try {
      const newStatus = task.status === "completato" ? "da_fare" : "completato";
      await updateTask(task.id, { status: newStatus });
      setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
      setMonthTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));
    } catch (e) {
      setError(e.message);
    }
  };

  const dayTasks = selectedDay ? monthTasks.filter((t) => t.due_date === selectedDay) : [];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="font-display text-2xl text-b58-charcoal">Agenda</h1>
        <div className="flex gap-2">
          {/* Adempimenti societari: materia riservata al titolare (§3.5). La
              barriera è la RLS — per lo staff l'export uscirebbe comunque
              vuoto — qui si evita solo di mostrargli una porta inutile. */}
          {isTitolare && (
            <Link
              to="/agenda/adempimenti"
              className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
            >
              Adempimenti (PDF)
            </Link>
          )}
          <Link
            to="/agenda/nuovo"
            className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4 py-2 text-sm"
          >
            + Nuovo task
          </Link>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { value: "lista", label: "Lista" },
          { value: "calendario", label: "Calendario" },
        ].map((v) => (
          <button
            key={v.value}
            onClick={() => setView(v.value)}
            className={`text-sm rounded-full px-3 py-1.5 border transition-colors ${
              view === v.value
                ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta"
                : "border-b58-charcoal/15 text-b58-charcoal-soft"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-b58-terracotta-dark mb-4">Errore: {error}</p>}

      {view === "lista" ? (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca task…"
              className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta flex-1 min-w-[200px]"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
            >
              <option value="">Tutte le priorità</option>
              {TASK_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
            >
              <option value="">Tutti gli stati</option>
              {TASK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
              <p className="text-b58-charcoal-soft">Nessun task.</p>
            </div>
          ) : (
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 divide-y divide-b58-charcoal/5">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={t.status === "completato"}
                    onChange={() => toggleComplete(t)}
                    className="shrink-0"
                  />
                  <button
                    onClick={() => navigate(`/agenda/${t.id}`)}
                    className="flex-1 text-left min-w-0"
                  >
                    <span
                      className={`text-sm ${
                        t.status === "completato"
                          ? "text-b58-charcoal-soft line-through"
                          : "text-b58-charcoal"
                      }`}
                    >
                      {t.title}
                    </span>
                    {t.category && (
                      <span className="text-xs text-b58-charcoal-soft ml-2">· {t.category}</span>
                    )}
                  </button>
                  {t.visibile_staff === false && <RiservatoBadge />}
                  {t.due_date && (
                    <span className="text-xs text-b58-charcoal-soft shrink-0">{formatDate(t.due_date)}</span>
                  )}
                  <span
                    className={`shrink-0 inline-flex items-center rounded-full ${PRIORITY_BADGE[t.priority]} text-b58-parchment text-[10px] font-medium px-2 py-0.5`}
                  >
                    {labelFor(TASK_PRIORITIES, t.priority)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <CalendarView
            tasks={monthTasks}
            loading={monthLoading}
            year={year}
            month={month}
            onPrev={() => changeMonth(-1)}
            onNext={() => changeMonth(1)}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
          {selectedDay && (
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mt-4">
              <h3 className="text-sm font-medium text-b58-charcoal mb-2">{formatDate(selectedDay)}</h3>
              {dayTasks.length === 0 ? (
                <p className="text-sm text-b58-charcoal-soft">Nessun task in questo giorno.</p>
              ) : (
                <div className="space-y-2">
                  {dayTasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/agenda/${t.id}`)}
                      className="w-full text-left flex items-center gap-2 text-sm"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_BADGE[t.priority]}`}
                      />
                      <span className="text-b58-charcoal flex-1">{t.title}</span>
                      {t.visibile_staff === false && <RiservatoBadge />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
