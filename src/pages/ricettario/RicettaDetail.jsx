import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  getRecipe,
  getRecipeAllergens,
  getRecipeCost,
  listRecipeStatusHistory,
  updateRecipe,
} from "../../lib/api/recipes";
import {
  addRecipeIngredient,
  listRecipeIngredients,
  removeRecipeIngredient,
  updateRecipeIngredient,
} from "../../lib/api/recipeIngredients";
import {
  addRecipeStep,
  listRecipeSteps,
  removeRecipeStep,
  swapStepOrder,
} from "../../lib/api/recipeSteps";
import { listIngredients } from "../../lib/api/ingredients";
import {
  ALLERGENS,
  COOKING_TECHNIQUES,
  RECIPE_CATEGORIES,
  SEASONS,
  STEP_PHASES,
  UNITS,
  formatDate,
  formatEUR,
  labelFor,
  recipeStatusLabel,
} from "../../lib/constants";

const emptyIngredientForm = {
  ingredient_id: "",
  quantity: "",
  unit: "",
  waste_percentage: "",
  prep_note: "",
  is_optional: false,
};

const emptyStepForm = {
  phase: "mise_en_place",
  description: "",
  technique: "",
  duration_min: "",
  is_active_time: true,
  temperature_c: "",
  is_haccp_ccp: false,
  haccp_limit: "",
  haccp_action: "",
  equipment: "",
};

export default function RicettaDetail() {
  const { id } = useParams();

  const [recipe, setRecipe] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [steps, setSteps] = useState([]);
  const [cost, setCost] = useState(null);
  const [allergens, setAllergens] = useState([]);
  const [allIngredients, setAllIngredients] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const [savingHeader, setSavingHeader] = useState(false);
  const [ingredientForm, setIngredientForm] = useState(emptyIngredientForm);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [addingIngredient, setAddingIngredient] = useState(false);
  const [stepForm, setStepForm] = useState(emptyStepForm);
  const [addingStep, setAddingStep] = useState(false);

  const loadAll = async () => {
    const [rec, ri, st, c, al, hist] = await Promise.all([
      getRecipe(id),
      listRecipeIngredients(id),
      listRecipeSteps(id),
      getRecipeCost(id),
      getRecipeAllergens(id),
      listRecipeStatusHistory(id),
    ]);
    setRecipe(rec);
    setRecipeIngredients(ri);
    setSteps(st);
    setCost(c);
    setAllergens(al);
    setStatusHistory(hist);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([loadAll(), listIngredients().then(setAllIngredients)])
      .catch((e) => {
        if (e.code === "PGRST116") setNotFound(true);
        else if (!cancelled) setError(e.message);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const totalPrepMin = useMemo(
    () => steps.reduce((sum, s) => sum + (s.duration_min || 0), 0),
    [steps]
  );
  const totalActiveMin = useMemo(
    () => steps.filter((s) => s.is_active_time).reduce((sum, s) => sum + (s.duration_min || 0), 0),
    [steps]
  );

  const filteredIngredients = useMemo(() => {
    if (!ingredientSearch) return allIngredients;
    const q = ingredientSearch.toLowerCase();
    return allIngredients.filter((i) => i.name.toLowerCase().includes(q));
  }, [allIngredients, ingredientSearch]);

  if (notFound) return <Navigate to="/ricettario/ricette" replace />;
  if (loading || !recipe) {
    return <p className="text-sm text-b58-charcoal-soft max-w-4xl mx-auto">Caricamento…</p>;
  }

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleHeaderChange = (field, value) => setRecipe((r) => ({ ...r, [field]: value }));

  const toggleSeasonality = (value) => {
    setRecipe((r) => ({
      ...r,
      seasonality: r.seasonality.includes(value)
        ? r.seasonality.filter((v) => v !== value)
        : [...r.seasonality, value],
    }));
  };

  const saveHeader = async () => {
    setSavingHeader(true);
    setError("");
    try {
      const saved = await updateRecipe(id, {
        name: recipe.name,
        category: recipe.category,
        subcategory: recipe.subcategory,
        seasonality: recipe.seasonality,
        portions_yield: Number(recipe.portions_yield),
        pronta_per_carta: recipe.pronta_per_carta,
        in_carta: recipe.in_carta,
        tags: recipe.tags,
        notes: recipe.notes,
      });
      setRecipe(saved);
      setCost(await getRecipeCost(id));
      setStatusHistory(await listRecipeStatusHistory(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingHeader(false);
    }
  };

  // in_carta richiede pronta_per_carta (vincolo del DB, coerenza lato UI).
  const togglePronta = () => {
    setRecipe((r) => {
      const pronta = !r.pronta_per_carta;
      return { ...r, pronta_per_carta: pronta, in_carta: pronta ? r.in_carta : false };
    });
  };
  const toggleInCarta = () => {
    setRecipe((r) => {
      if (!r.pronta_per_carta) return r; // non attivabile finché non è pronta
      return { ...r, in_carta: !r.in_carta };
    });
  };

  const handleAddIngredient = async () => {
    if (!ingredientForm.ingredient_id || !ingredientForm.quantity) return;
    setAddingIngredient(true);
    setError("");
    try {
      await addRecipeIngredient(id, {
        ingredient_id: ingredientForm.ingredient_id,
        quantity: Number(ingredientForm.quantity),
        unit: ingredientForm.unit,
        waste_percentage: ingredientForm.waste_percentage
          ? Number(ingredientForm.waste_percentage)
          : null,
        prep_note: ingredientForm.prep_note || null,
        is_optional: ingredientForm.is_optional,
      });
      setIngredientForm(emptyIngredientForm);
      setIngredientSearch("");
      setRecipeIngredients(await listRecipeIngredients(id));
      setCost(await getRecipeCost(id));
      setAllergens(await getRecipeAllergens(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingIngredient(false);
    }
  };

  const handleQuantityChange = async (ri, newQuantity) => {
    if (Number(newQuantity) === Number(ri.quantity)) return;
    try {
      await updateRecipeIngredient(ri.id, { quantity: Number(newQuantity) || 0 });
      setRecipeIngredients(await listRecipeIngredients(id));
      setCost(await getRecipeCost(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRemoveIngredient = async (riId) => {
    try {
      await removeRecipeIngredient(riId);
      setRecipeIngredients(await listRecipeIngredients(id));
      setCost(await getRecipeCost(id));
      setAllergens(await getRecipeAllergens(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddStep = async () => {
    if (!stepForm.description.trim()) return;
    setAddingStep(true);
    setError("");
    try {
      await addRecipeStep(id, {
        step_number: steps.length + 1,
        phase: stepForm.phase,
        description: stepForm.description.trim(),
        technique: stepForm.technique || null,
        duration_min: stepForm.duration_min ? Number(stepForm.duration_min) : null,
        is_active_time: stepForm.is_active_time,
        temperature_c: stepForm.temperature_c || null,
        is_haccp_ccp: stepForm.is_haccp_ccp,
        haccp_limit: stepForm.is_haccp_ccp ? stepForm.haccp_limit || null : null,
        haccp_action: stepForm.is_haccp_ccp ? stepForm.haccp_action || null : null,
        equipment: stepForm.equipment || null,
      });
      setStepForm(emptyStepForm);
      setSteps(await listRecipeSteps(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingStep(false);
    }
  };

  const handleRemoveStep = async (stepId) => {
    try {
      await removeRecipeStep(stepId);
      setSteps(await listRecipeSteps(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleMoveStep = async (index, direction) => {
    const other = steps[index + direction];
    if (!other) return;
    try {
      await swapStepOrder(steps[index], other);
      setSteps(await listRecipeSteps(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const ccpSteps = steps.filter((s) => s.is_haccp_ccp);

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Link to="/ricettario/ricette" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Ricette
      </Link>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 my-4">
          {error}
        </p>
      )}

      {/* Intestazione */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mt-3 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <input
            value={recipe.name}
            onChange={(e) => handleHeaderChange("name", e.target.value)}
            className="font-display text-2xl text-b58-charcoal bg-transparent border-b border-transparent hover:border-b58-charcoal/20 focus:border-b58-terracotta focus:outline-none flex-1 min-w-[240px]"
          />
          <div className="text-right">
            <div className="text-2xl text-b58-charcoal font-medium">
              {cost ? formatEUR(cost.food_cost_portion) : "—"}
              <span className="text-sm text-b58-charcoal-soft"> / porzione</span>
            </div>
            <div className="text-xs text-b58-charcoal-soft">
              {cost ? formatEUR(cost.food_cost_base) : "—"} totale ricetta base
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass}>Categoria</label>
            <select
              value={recipe.category}
              onChange={(e) => handleHeaderChange("category", e.target.value)}
              className={inputClass}
            >
              {RECIPE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Porzioni base</label>
            <input
              type="number"
              min="1"
              value={recipe.portions_yield}
              onChange={(e) => handleHeaderChange("portions_yield", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className={labelClass}>Stato</label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={togglePronta}
              className={`rounded-full text-xs px-3 py-1.5 border transition-colors ${
                recipe.pronta_per_carta
                  ? "bg-b58-gold text-b58-parchment border-b58-gold"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              {recipe.pronta_per_carta ? "✓ " : ""}Pronta per carta
            </button>
            <button
              type="button"
              onClick={toggleInCarta}
              disabled={!recipe.pronta_per_carta}
              title={!recipe.pronta_per_carta ? "Serve prima segnarla come pronta" : undefined}
              className={`rounded-full text-xs px-3 py-1.5 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                recipe.in_carta
                  ? "bg-b58-olive text-b58-parchment border-b58-olive"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              {recipe.in_carta ? "✓ " : ""}In carta
            </button>
            <span className="text-xs text-b58-charcoal-soft ml-1">
              {recipeStatusLabel(recipe.pronta_per_carta, recipe.in_carta).label}
            </span>
            {statusHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="text-xs text-b58-charcoal-soft underline hover:text-b58-terracotta ml-auto"
              >
                {showHistory ? "Nascondi storico" : "Mostra storico"}
              </button>
            )}
          </div>
          {showHistory && (
            <ul className="mt-2 space-y-1 text-xs text-b58-charcoal-soft">
              {statusHistory.map((h) => (
                <li key={h.id}>
                  {formatDate(h.changed_at)} — {recipeStatusLabel(h.pronta_per_carta, h.in_carta).label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mb-4">
          <label className={labelClass}>Stagionalità</label>
          <div className="flex flex-wrap gap-2">
            {SEASONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleSeasonality(s.value)}
                className={`rounded-full text-xs px-3 py-1.5 border transition-colors ${
                  recipe.seasonality.includes(s.value)
                    ? "bg-b58-olive text-b58-parchment border-b58-olive"
                    : "border-b58-charcoal/15 text-b58-charcoal-soft"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {steps.length > 0 && (
              <span className="text-xs text-b58-charcoal-soft">
                ⏱ {totalPrepMin} min totali · {totalActiveMin} min attivi
              </span>
            )}
          </div>
          <button
            onClick={saveHeader}
            disabled={savingHeader}
            className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
          >
            {savingHeader ? "Salvo…" : "Salva modifiche"}
          </button>
        </div>
      </div>

      {/* Ingredienti */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Ingredienti</h2>

        {recipeIngredients.length > 0 && (
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="py-2 font-medium">Ingrediente</th>
                <th className="py-2 font-medium">Quantità</th>
                <th className="py-2 font-medium">% scarto</th>
                <th className="py-2 font-medium text-right">Costo</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {recipeIngredients.map((ri) => {
                const waste = ri.waste_percentage ?? ri.ingredient.waste_percentage_default ?? 0;
                const rowCost =
                  ri.quantity * ri.ingredient.current_price * (1 + waste / 100);
                return (
                  <tr key={ri.id} className="border-b border-b58-charcoal/5 last:border-0">
                    <td className="py-2 text-b58-charcoal">
                      <Link
                        to={`/ricettario/ingredienti/${ri.ingredient.id}`}
                        className="hover:text-b58-terracotta"
                      >
                        {ri.ingredient.name}
                      </Link>
                      {ri.is_optional && (
                        <span className="text-xs text-b58-charcoal-soft ml-1.5">(opzionale)</span>
                      )}
                      {ri.prep_note && (
                        <div className="text-xs text-b58-charcoal-soft">{ri.prep_note}</div>
                      )}
                    </td>
                    <td className="py-2">
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={ri.quantity}
                        onBlur={(e) => handleQuantityChange(ri, e.target.value)}
                        className="w-20 rounded border border-b58-charcoal/15 px-2 py-1 text-sm"
                      />
                      <span className="text-b58-charcoal-soft ml-1">{ri.unit}</span>
                    </td>
                    <td className="py-2 text-b58-charcoal-soft">{waste}%</td>
                    <td className="py-2 text-right text-b58-charcoal">
                      {ri.is_optional ? (
                        <span className="text-b58-charcoal-soft/60">escluso</span>
                      ) : (
                        formatEUR(rowCost)
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleRemoveIngredient(ri.id)}
                        className="text-b58-charcoal-soft hover:text-b58-terracotta-dark text-xs"
                      >
                        Rimuovi
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <div className="col-span-2 sm:col-span-1">
              <input
                value={ingredientSearch}
                onChange={(e) => setIngredientSearch(e.target.value)}
                placeholder="Cerca ingrediente…"
                className={inputClass}
              />
              <select
                value={ingredientForm.ingredient_id}
                onChange={(e) => {
                  const chosen = allIngredients.find((i) => i.id === e.target.value);
                  setIngredientForm((f) => ({
                    ...f,
                    ingredient_id: e.target.value,
                    unit: chosen?.unit ?? f.unit,
                  }));
                }}
                className={`${inputClass} mt-2`}
              >
                <option value="">Seleziona…</option>
                {filteredIngredients.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              value={ingredientForm.quantity}
              onChange={(e) => setIngredientForm((f) => ({ ...f, quantity: e.target.value }))}
              placeholder="Quantità"
              className={inputClass}
            />
            <select
              value={ingredientForm.unit}
              onChange={(e) => setIngredientForm((f) => ({ ...f, unit: e.target.value }))}
              className={inputClass}
            >
              <option value="">Unità</option>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={ingredientForm.waste_percentage}
              onChange={(e) => setIngredientForm((f) => ({ ...f, waste_percentage: e.target.value }))}
              placeholder="% scarto (default ingrediente)"
              className={inputClass}
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
              <input
                type="checkbox"
                checked={ingredientForm.is_optional}
                onChange={(e) => setIngredientForm((f) => ({ ...f, is_optional: e.target.checked }))}
              />
              Guarnizione opzionale (esclusa dal food cost)
            </label>
            <button
              type="button"
              disabled={addingIngredient || !ingredientForm.ingredient_id || !ingredientForm.quantity}
              onClick={handleAddIngredient}
              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
            >
              {addingIngredient ? "Aggiungo…" : "+ Aggiungi ingrediente"}
            </button>
          </div>
        </div>
      </div>

      {/* Fasi di preparazione */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Fasi di preparazione</h2>

        {steps.length > 0 && (
          <ol className="space-y-2 mb-4">
            {steps.map((s, idx) => (
              <li
                key={s.id}
                className={`rounded-lg border p-3 ${
                  s.is_haccp_ccp ? "border-b58-terracotta bg-b58-terracotta/5" : "border-b58-charcoal/10 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-medium text-b58-charcoal-soft">
                        {idx + 1}. {labelFor(STEP_PHASES, s.phase)}
                      </span>
                      {s.technique && (
                        <span className="text-[11px] text-b58-charcoal-soft bg-b58-cream-dark rounded-full px-2 py-0.5">
                          {labelFor(COOKING_TECHNIQUES, s.technique)}
                        </span>
                      )}
                      {s.is_haccp_ccp && (
                        <span className="text-[11px] text-b58-terracotta-dark bg-b58-terracotta/10 rounded-full px-2 py-0.5 font-medium">
                          CCP HACCP
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-b58-charcoal">{s.description}</p>
                    <p className="text-xs text-b58-charcoal-soft mt-1">
                      {s.duration_min ? `${s.duration_min} min` : ""}
                      {s.temperature_c ? ` · ${s.temperature_c}` : ""}
                      {s.equipment ? ` · ${s.equipment}` : ""}
                      {!s.is_active_time ? " · cottura passiva/riposo" : ""}
                    </p>
                    {s.is_haccp_ccp && (s.haccp_limit || s.haccp_action) && (
                      <p className="text-xs text-b58-terracotta-dark mt-1">
                        {s.haccp_limit && <>Limite: {s.haccp_limit}. </>}
                        {s.haccp_action && <>Azione correttiva: {s.haccp_action}.</>}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs">
                    <div className="flex gap-1">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMoveStep(idx, -1)}
                        className="text-b58-charcoal-soft hover:text-b58-terracotta disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        disabled={idx === steps.length - 1}
                        onClick={() => handleMoveStep(idx, 1)}
                        className="text-b58-charcoal-soft hover:text-b58-terracotta disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      onClick={() => handleRemoveStep(s.id)}
                      className="text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                    >
                      Rimuovi
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select
              value={stepForm.phase}
              onChange={(e) => setStepForm((f) => ({ ...f, phase: e.target.value }))}
              className={inputClass}
            >
              {STEP_PHASES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              value={stepForm.technique}
              onChange={(e) => setStepForm((f) => ({ ...f, technique: e.target.value }))}
              className={inputClass}
            >
              <option value="">Tecnica (opzionale)</option>
              {COOKING_TECHNIQUES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              value={stepForm.duration_min}
              onChange={(e) => setStepForm((f) => ({ ...f, duration_min: e.target.value }))}
              placeholder="Durata (min)"
              className={inputClass}
            />
            <input
              value={stepForm.temperature_c}
              onChange={(e) => setStepForm((f) => ({ ...f, temperature_c: e.target.value }))}
              placeholder='Temperatura, es. "63°C"'
              className={inputClass}
            />
          </div>
          <textarea
            value={stepForm.description}
            onChange={(e) => setStepForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Descrizione della fase…"
            rows={2}
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={stepForm.equipment}
              onChange={(e) => setStepForm((f) => ({ ...f, equipment: e.target.value }))}
              placeholder='Attrezzatura, es. "Roner"'
              className={inputClass}
            />
            <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
              <input
                type="checkbox"
                checked={stepForm.is_active_time}
                onChange={(e) => setStepForm((f) => ({ ...f, is_active_time: e.target.checked }))}
              />
              Richiede presidio (tempo attivo)
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
            <input
              type="checkbox"
              checked={stepForm.is_haccp_ccp}
              onChange={(e) => setStepForm((f) => ({ ...f, is_haccp_ccp: e.target.checked }))}
            />
            Punto Critico di Controllo HACCP
          </label>

          {stepForm.is_haccp_ccp && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={stepForm.haccp_limit}
                onChange={(e) => setStepForm((f) => ({ ...f, haccp_limit: e.target.value }))}
                placeholder='Limite critico, es. "T ≥ 75°C per 15 sec"'
                className={inputClass}
              />
              <input
                value={stepForm.haccp_action}
                onChange={(e) => setStepForm((f) => ({ ...f, haccp_action: e.target.value }))}
                placeholder="Azione correttiva"
                className={inputClass}
              />
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={addingStep || !stepForm.description.trim()}
              onClick={handleAddStep}
              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
            >
              {addingStep ? "Aggiungo…" : "+ Aggiungi fase"}
            </button>
          </div>
        </div>
      </div>

      {/* HACCP e Allergeni */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">HACCP e Allergeni</h2>

        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
            Allergeni (auto-calcolati dagli ingredienti)
          </p>
          {allergens.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60">Nessuno.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allergens.map((a) => (
                <span
                  key={a}
                  className="text-xs bg-b58-terracotta/10 text-b58-terracotta-dark rounded-full px-2.5 py-1"
                >
                  {labelFor(ALLERGENS, a)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
            Punti Critici di Controllo
          </p>
          {ccpSteps.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft/60">
              Nessun CCP definito nelle fasi.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {ccpSteps.map((s) => (
                <li key={s.id} className="text-sm text-b58-charcoal-soft">
                  <span className="text-b58-charcoal">{s.description}</span>
                  {s.haccp_limit && <> — limite: {s.haccp_limit}</>}
                  {s.haccp_action && <>, azione: {s.haccp_action}</>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
