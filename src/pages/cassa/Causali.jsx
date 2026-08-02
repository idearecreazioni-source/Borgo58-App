import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createCausale, deactivateCausale, listAllCausali } from "../../lib/api/cash";

const KINDS = [
  { value: "uscita", label: "Uscite" },
  { value: "entrata", label: "Entrate" },
  { value: "sconto_omaggio", label: "Sconti / omaggi" },
];

export default function Causali() {
  const [causali, setCausali] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newKind, setNewKind] = useState("uscita");
  const [saving, setSaving] = useState(false);

  const reload = () => listAllCausali().then(setCausali);

  useEffect(() => {
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const byKind = useMemo(() => {
    const map = { uscita: [], entrata: [], sconto_omaggio: [] };
    causali.filter((c) => c.active).forEach((c) => map[c.kind]?.push(c));
    return map;
  }, [causali]);

  const inputClass =
    "rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createCausale({ label: newLabel, kind: newKind });
      setNewLabel("");
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id) => {
    try {
      await deactivateCausale(id);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link to="/cassa" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Cassa
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">Causali</h1>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-6 flex flex-wrap gap-2 items-end">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nuova causale…"
          className={`${inputClass} flex-1 min-w-[180px]`}
        />
        <select value={newKind} onChange={(e) => setNewKind(e.target.value)} className={inputClass}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={saving || !newLabel.trim()}
          onClick={handleAdd}
          className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
        >
          + Aggiungi
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {KINDS.map((k) => (
            <div key={k.value} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">{k.label}</h2>
              <ul className="space-y-1">
                {byKind[k.value].map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm text-b58-charcoal">
                    {c.label}
                    <button
                      onClick={() => handleRemove(c.id)}
                      className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                      title="Disattiva"
                    >
                      ✕
                    </button>
                  </li>
                ))}
                {byKind[k.value].length === 0 && (
                  <li className="text-xs text-b58-charcoal-soft/60">Nessuna.</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
