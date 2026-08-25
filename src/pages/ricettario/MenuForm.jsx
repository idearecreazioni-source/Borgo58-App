import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createMenu } from "../../lib/api/menus";

export default function MenuForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const menu = await createMenu({
        name: name.trim(),
        valid_from: validFrom || null,
      });
      navigate(`/ricettario/menu/${menu.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Link to="/ricettario/menu" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Menu
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">Nuovo menu</h1>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 space-y-4">
        <div>
          <label className={labelClass}>Nome</label>
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Es. "Menu Estate 2026"'
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>In vigore dal (opzionale)</label>
          <input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment font-medium px-5 py-2.5 testo-sala-grande"
        >
          {saving ? "Creo…" : "Crea menu"}
        </button>
      </form>
    </div>
  );
}
