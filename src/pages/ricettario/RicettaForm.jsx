import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createRecipe } from "../../lib/api/recipes";
import { RECIPE_CATEGORIES, RECIPE_TYPES, UNITS } from "../../lib/constants";

export default function RicettaForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    category: "",
    subcategory: "",
    recipe_type: "piatto_finito",
    portions_yield: 4,
    yield_quantity: "",
    yield_unit: "kg",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isPreparazione = form.recipe_type === "preparazione";

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
        recipe_type: form.recipe_type,
        // Le preparazioni si costano per unità di resa (yield_quantity), non
        // per porzione — portions_yield resta 1 di default, non è il campo
        // rilevante per loro.
        portions_yield: isPreparazione ? 1 : Number(form.portions_yield) || 1,
        yield_quantity: isPreparazione ? Number(form.yield_quantity) || null : null,
        yield_unit: isPreparazione ? form.yield_unit : null,
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
          <label className={labelClass}>Tipo</label>
          <div className="flex gap-2">
            {RECIPE_TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                onClick={() => setForm((f) => ({ ...f, recipe_type: t.value }))}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  form.recipe_type === t.value
                    ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                    : "border-b58-charcoal/15 text-b58-charcoal-soft"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {isPreparazione && (
            <p className="text-xs text-b58-charcoal-soft/70 mt-1.5">
              Un semilavorato riutilizzabile in altre ricette (es. crema pasticcera).
            </p>
          )}
        </div>

        <div>
          <label className={labelClass}>Nome</label>
          <input
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={isPreparazione ? 'Es. "Crema pasticcera"' : 'Es. "Risotto zucca e provola affumicata"'}
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

          {isPreparazione ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Resa</label>
                <input
                  required
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.yield_quantity}
                  onChange={(e) => setForm((f) => ({ ...f, yield_quantity: e.target.value }))}
                  placeholder="Es. 1"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Unità</label>
                <select
                  value={form.yield_unit}
                  onChange={(e) => setForm((f) => ({ ...f, yield_unit: e.target.value }))}
                  className={inputClass}
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
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
          )}
        </div>
        {isPreparazione && (
          <p className="text-xs text-b58-charcoal-soft/70 -mt-2">
            Quanto produce la ricetta base — es. "1 kg" di crema. È la base per calcolare il
            costo quando la userai come componente in un'altra ricetta.
          </p>
        )}

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
