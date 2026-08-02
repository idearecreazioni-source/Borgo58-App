import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createRecipe } from "../../lib/api/recipes";
import { RECIPE_CATEGORIES } from "../../lib/constants";

export default function RicettaForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    category: "",
    subcategory: "",
    portions_yield: 4,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const recipe = await createRecipe({
        name: form.name.trim(),
        category: form.category,
        subcategory: form.subcategory || null,
        portions_yield: Number(form.portions_yield) || 1,
        // Ogni ricetta nuova parte "in sviluppo" — la promozione a pronta/in
        // carta è sempre manuale, dalla scheda ricetta.
      });
      navigate(`/ricettario/ricette/${recipe.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <Link to="/ricettario/ricette" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Ricette
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">Nuova ricetta</h1>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 space-y-4">
        <div>
          <label className={labelClass}>Nome</label>
          <input
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder='Es. "Risotto zucca e provola affumicata"'
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Categoria</label>
            <select
              required
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={inputClass}
            >
              <option value="" disabled>Seleziona…</option>
              {RECIPE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Porzioni (ricetta base)</label>
            <input
              type="number"
              min="1"
              value={form.portions_yield}
              onChange={(e) => setForm((f) => ({ ...f, portions_yield: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Sottocategoria (opzionale)</label>
          <input
            value={form.subcategory}
            onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
            placeholder='Es. "pesce", "vegetariano"'
            className={inputClass}
          />
        </div>

        <p className="text-xs text-b58-charcoal-soft/70">
          Ingredienti, fasi, allergeni e HACCP si aggiungono nella scheda dopo la creazione.
        </p>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment font-medium px-5 py-2.5 text-sm"
        >
          {saving ? "Creo…" : "Crea ricetta"}
        </button>
      </form>
    </div>
  );
}
