import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addNonConformity, listNonConformities, resolveNonConformity } from "../../lib/api/haccp";
import { NC_CATEGORIES, formatDate, labelFor } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";

const emptyForm = { category: "temperatura", description: "", note: "" };

export default function NonConformita() {
  const { isTitolare } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);

  const [resolvingId, setResolvingId] = useState(null);
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [resolving, setResolving] = useState(false);

  const load = () => listNonConformities().then(setItems);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const open = useMemo(() => items.filter((i) => !i.resolved), [items]);
  const resolved = useMemo(() => items.filter((i) => i.resolved), [items]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleAdd = async () => {
    if (!form.description.trim()) return;
    setAdding(true);
    setError("");
    try {
      await addNonConformity({ category: form.category, description: form.description.trim(), note: form.note });
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleResolve = async (id) => {
    setResolving(true);
    setError("");
    try {
      await resolveNonConformity(id, { correctiveAction });
      setResolvingId(null);
      setCorrectiveAction("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setResolving(false);
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
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">Non conformità</h1>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Aperte</h2>

        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={inputClass}
            >
              {NC_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Descrizione"
              className={`${inputClass} sm:col-span-2`}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Nota (opzionale)"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={adding || !form.description.trim()}
              onClick={handleAdd}
              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60 shrink-0"
            >
              {adding ? "Segnalo…" : "+ Segnala"}
            </button>
          </div>
        </div>

        {open.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60">Nessuna non conformità aperta.</p>
        ) : (
          <ul className="space-y-2">
            {open.map((item) => (
              <li key={item.id} className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-[11px] text-b58-terracotta-dark bg-b58-terracotta/10 rounded-full px-2 py-0.5 mr-1.5">
                      {labelFor(NC_CATEGORIES, item.category)}
                    </span>
                    <span className="text-sm text-b58-charcoal">{item.description}</span>
                    <div className="text-xs text-b58-charcoal-soft mt-0.5">{formatDate(item.detected_at)}</div>
                  </div>
                  {isTitolare && (
                    <button
                      type="button"
                      onClick={() => {
                        setResolvingId((id) => (id === item.id ? null : item.id));
                        setCorrectiveAction("");
                      }}
                      className="text-xs text-b58-terracotta hover:text-b58-terracotta-dark shrink-0"
                    >
                      {resolvingId === item.id ? "Annulla" : "Risolvi"}
                    </button>
                  )}
                </div>
                {resolvingId === item.id && (
                  <div className="mt-3 pt-3 border-t border-b58-charcoal/10 flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <input
                        value={correctiveAction}
                        onChange={(e) => setCorrectiveAction(e.target.value)}
                        placeholder="Azione correttiva"
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={resolving}
                      onClick={() => handleResolve(item.id)}
                      className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
                    >
                      {resolving ? "Confermo…" : "Conferma risoluzione"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {resolved.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
          <h2 className="font-display text-lg text-b58-charcoal mb-4">Risolte</h2>
          <ul className="space-y-1.5">
            {resolved.map((item) => (
              <li key={item.id} className="text-sm text-b58-charcoal-soft">
                <span className="text-b58-charcoal">{item.description}</span>
                {item.corrective_action && ` — ${item.corrective_action}`}
                {" · "}
                {formatDate(item.resolved_at)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
