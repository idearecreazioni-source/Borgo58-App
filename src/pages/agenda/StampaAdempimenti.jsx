import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listTasks } from "../../lib/api/tasks";
import { TASK_STATUSES, formatDate, labelFor } from "../../lib/constants";
import PrintButton from "../../components/PrintButton";

export default function StampaAdempimenti() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listTasks({ category: "Adempimenti societari" })
      .then(setTasks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(
    () => [...tasks].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")),
    [tasks]
  );

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2 print:hidden">
        <Link to="/agenda" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Agenda
        </Link>
        <PrintButton />
      </div>

      <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">
        Calendario adempimenti societari — Borgo 58 S.r.l.s.
      </h1>
      <p className="text-b58-charcoal-soft mt-1">Generato il {formatDate(new Date().toISOString())}.</p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mt-4 print:hidden">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft mt-6">Caricamento…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-b58-charcoal-soft/60 mt-6">Nessun adempimento registrato.</p>
      ) : (
        <table className="w-full text-sm mt-6">
          <thead>
            <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
              <th className="py-2 font-medium">Scadenza</th>
              <th className="py-2 font-medium">Adempimento</th>
              <th className="py-2 font-medium">Stato</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id} className="border-b border-b58-charcoal/5">
                <td className="py-2 text-b58-charcoal-soft">{t.due_date ? formatDate(t.due_date) : "da verificare"}</td>
                <td className="py-2 text-b58-charcoal">
                  {t.title}
                  {t.description && <div className="text-xs text-b58-charcoal-soft">{t.description}</div>}
                </td>
                <td className="py-2 text-b58-charcoal-soft">{labelFor(TASK_STATUSES, t.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
