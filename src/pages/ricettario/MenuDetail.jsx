import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  addMenuItem,
  getMenu,
  listMenuItemsFull,
  removeMenuItem,
  setActiveMenu,
  updateMenuItemPrice,
} from "../../lib/api/menus";
import { listRecipes, listAllRecipeCosts } from "../../lib/api/recipes";
import { listRecipeIngredientsForRecipes } from "../../lib/api/recipeIngredients";
import { listIngredients } from "../../lib/api/ingredients";
import { foodCostLevel, formatEUR } from "../../lib/constants";
import CampoAutosalvato from "../../components/CampoAutosalvato";

const SECTIONS = [
  { category: "antipasto", label: "Antipasti", target: 4 },
  { category: "primo", label: "Primi", target: 4 },
  { category: "secondo", label: "Secondi", target: 4 },
  { category: "dolce", label: "Dolci", target: 2 },
];

const LEVEL_CLASS = {
  ok: "text-b58-olive-dark",
  warning: "text-yellow-700",
  danger: "text-b58-terracotta-dark",
  neutral: "text-b58-charcoal-soft",
};

export default function MenuDetail() {
  const { id } = useParams();
  const [menu, setMenu] = useState(null);
  const [items, setItems] = useState([]);
  const [allRecipes, setAllRecipes] = useState([]);
  const [allRecipeCosts, setAllRecipeCosts] = useState({});
  const [allIngredients, setAllIngredients] = useState([]);
  const [recipeIngredientsByRecipe, setRecipeIngredientsByRecipe] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [activating, setActivating] = useState(false);

  const [addForms, setAddForms] = useState({}); // { [category]: { recipe_id, selling_price } }

  const load = async () => {
    const m = await getMenu(id);
    const its = await listMenuItemsFull(id);
    setMenu(m);
    setItems(its);
    const recipeIds = its.map((i) => i.recipe_id);
    if (recipeIds.length > 0) {
      const ri = await listRecipeIngredientsForRecipes(recipeIds);
      const grouped = {};
      ri.forEach((r) => {
        (grouped[r.recipe_id] ??= []).push(r);
      });
      setRecipeIngredientsByRecipe(grouped);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      load(),
      listRecipes().then(setAllRecipes),
      listAllRecipeCosts().then((c) =>
        setAllRecipeCosts(Object.fromEntries(c.map((x) => [x.recipe_id, x])))
      ),
      listIngredients().then(setAllIngredients),
    ])
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

  const itemsByCategory = useMemo(() => {
    const map = { antipasto: [], primo: [], secondo: [], dolce: [] };
    items.forEach((i) => map[i.category]?.push(i));
    return map;
  }, [items]);

  const categoryAverages = useMemo(() => {
    const result = {};
    SECTIONS.forEach(({ category }) => {
      const withPrice = itemsByCategory[category].filter((i) => i.economics?.food_cost_pct != null);
      if (withPrice.length === 0) {
        result[category] = null;
        return;
      }
      const avgPct =
        withPrice.reduce((s, i) => s + Number(i.economics.food_cost_pct), 0) / withPrice.length;
      const avgMargin =
        withPrice.reduce((s, i) => s + Number(i.economics.gross_margin), 0) / withPrice.length;
      result[category] = { avgPct, avgMargin };
    });
    return result;
  }, [itemsByCategory]);

  const summary = useMemo(() => {
    const present = SECTIONS.map((s) => categoryAverages[s.category]).filter(Boolean);
    if (present.length === 0) return null;
    const weightedFoodCost = present.reduce((s, c) => s + c.avgPct, 0) / present.length;
    const weightedMargin = present.reduce((s, c) => s + c.avgMargin, 0) / present.length;

    const priced = items.filter((i) => i.economics?.gross_margin != null);
    const best = priced.length
      ? priced.reduce((a, b) => (Number(a.economics.gross_margin) > Number(b.economics.gross_margin) ? a : b))
      : null;
    const worst = priced.length
      ? priced.reduce((a, b) => (Number(a.economics.gross_margin) < Number(b.economics.gross_margin) ? a : b))
      : null;
    const overThreshold = items.filter((i) => foodCostLevel(i.economics?.food_cost_pct) === "danger");

    return { weightedFoodCost, weightedMargin, best, worst, overThreshold };
  }, [categoryAverages, items]);

  // --- Simulatore what-if ---
  const [simMode, setSimMode] = useState("prezzo_ingrediente");
  const [simIngredientId, setSimIngredientId] = useState("");
  const [simPct, setSimPct] = useState("10");
  const [simSwapItemId, setSimSwapItemId] = useState("");
  const [simSwapRecipeId, setSimSwapRecipeId] = useState("");
  const [simSwapPrice, setSimSwapPrice] = useState("");
  const [simTargetItemId, setSimTargetItemId] = useState("");
  const [simTargetPct, setSimTargetPct] = useState("22");
  const [applyingPrice, setApplyingPrice] = useState(false);

  const usedIngredientIds = useMemo(() => {
    const ids = new Set();
    Object.values(recipeIngredientsByRecipe)
      .flat()
      .forEach((ri) => ids.add(ri.ingredient_id));
    return [...ids];
  }, [recipeIngredientsByRecipe]);

  const recipeFoodCostWithOverride = (recipeId, portionsYield, overrideIngredientId, overridePrice) => {
    const ris = recipeIngredientsByRecipe[recipeId] ?? [];
    const base = ris.reduce((sum, ri) => {
      if (ri.is_optional) return sum;
      const price = ri.ingredient_id === overrideIngredientId ? overridePrice : ri.ingredient.current_price;
      const waste = ri.waste_percentage ?? ri.ingredient.waste_percentage_default ?? 0;
      return sum + ri.quantity * price * (1 + waste / 100);
    }, 0);
    return portionsYield ? base / portionsYield : base;
  };

  const priceSimResults = useMemo(() => {
    if (simMode !== "prezzo_ingrediente" || !simIngredientId) return null;
    const ingredient = allIngredients.find((i) => i.id === simIngredientId);
    if (!ingredient) return null;
    const newPrice = ingredient.current_price * (1 + Number(simPct) / 100);

    return items
      .filter((item) => (recipeIngredientsByRecipe[item.recipe_id] ?? []).some((ri) => ri.ingredient_id === simIngredientId))
      .map((item) => {
        const newCost = recipeFoodCostWithOverride(
          item.recipe_id,
          item.recipe.portions_yield ?? 1,
          simIngredientId,
          newPrice
        );
        const newPct = item.selling_price > 0 ? (newCost / item.selling_price) * 100 : null;
        return { item, newCost, newPct };
      });
    // recipeFoodCostWithOverride è volutamente fuori dalle dipendenze: è una
    // funzione ricreata a ogni render, quindi inserirla farebbe ricalcolare la
    // simulazione ad ogni render annullando la memoizzazione. I dati che legge
    // (recipeIngredientsByRecipe) sono già nelle dipendenze, quindi non può
    // restare indietro. Analizzato durante la pulizia lint del 05/08/2026.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simMode, simIngredientId, simPct, items, allIngredients, recipeIngredientsByRecipe]);

  const swapCandidate = useMemo(() => {
    if (simMode !== "sostituzione" || !simSwapRecipeId) return null;
    const cost = allRecipeCosts[simSwapRecipeId];
    const price = Number(simSwapPrice) || 0;
    if (!cost || !price) return { cost, pct: null };
    return { cost, pct: (cost.food_cost_portion / price) * 100 };
  }, [simMode, simSwapRecipeId, simSwapPrice, allRecipeCosts]);

  const targetPriceResult = useMemo(() => {
    if (simMode !== "prezzo_target" || !simTargetItemId) return null;
    const item = items.find((i) => i.id === simTargetItemId);
    if (!item?.economics) return null;
    const target = Number(simTargetPct);
    if (!target) return null;
    return {
      item,
      targetPrice: item.economics.food_cost_portion / (target / 100),
    };
  }, [simMode, simTargetItemId, simTargetPct, items]);

  if (notFound) return <Navigate to="/ricettario/menu" replace />;
  if (loading || !menu) {
    return <p className="text-sm text-b58-charcoal-soft max-w-5xl mx-auto">Caricamento…</p>;
  }

  const inputClass =
    "rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleActivate = async () => {
    setActivating(true);
    try {
      const updated = await setActiveMenu(id);
      setMenu(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setActivating(false);
    }
  };

  const handleAddItem = async (category) => {
    const form = addForms[category];
    if (!form?.recipe_id) return;
    try {
      await addMenuItem(id, {
        recipe_id: form.recipe_id,
        category,
        selling_price: Number(form.selling_price) || 0,
        position: itemsByCategory[category].length,
      });
      setAddForms((f) => ({ ...f, [category]: { recipe_id: "", selling_price: "" } }));
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handlePriceChange = async (itemId, price) => {
    try {
      await updateMenuItemPrice(itemId, Number(price) || 0);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRemoveItem = async (itemId) => {
    try {
      await removeMenuItem(itemId);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const applyTargetPrice = async () => {
    if (!targetPriceResult) return;
    setApplyingPrice(true);
    try {
      await updateMenuItemPrice(targetPriceResult.item.id, targetPriceResult.targetPrice);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setApplyingPrice(false);
    }
  };

  // La stagionalità delle ricette è per stagione (§2.5), non per mese — qui
  // segnaliamo solo le ricette non marcate "tutto_anno", il controllo fine
  // (mese corrente vs stagione) resta a vista dello chef.
  const isOutOfSeason = (seasonality) =>
    seasonality?.length > 0 && !seasonality.includes("tutto_anno");

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <Link to="/ricettario/menu" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Menu
      </Link>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 my-4">
          {error}
        </p>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap mt-3 mb-6">
        <div>
          <h1 className="font-display text-2xl text-b58-charcoal">{menu.name}</h1>
          <p className="text-sm text-b58-charcoal-soft">Struttura {menu.structure}</p>
        </div>
        {menu.is_active ? (
          <span className="text-xs font-medium uppercase tracking-wide bg-b58-olive text-b58-parchment rounded-full px-3 py-1.5">
            Menu attivo
          </span>
        ) : (
          <button
            onClick={handleActivate}
            disabled={activating}
            className="rounded-lg bg-b58-charcoal hover:bg-b58-charcoal-soft disabled:opacity-60 transition-colors text-b58-parchment text-sm px-4 py-2"
          >
            {activating ? "Attivo…" : "Rendi attivo"}
          </button>
        )}
      </div>

      {/* Riepilogo */}
      {summary && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
          <h2 className="font-display text-lg text-b58-charcoal mb-4">Riepilogo</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-b58-charcoal-soft uppercase tracking-wide">Food cost medio</p>
              <p className={`text-xl font-medium ${LEVEL_CLASS[foodCostLevel(summary.weightedFoodCost)]}`}>
                {summary.weightedFoodCost.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-b58-charcoal-soft uppercase tracking-wide">Margine medio/coperto</p>
              <p className="text-xl font-medium text-b58-charcoal">{formatEUR(summary.weightedMargin)}</p>
            </div>
            <div>
              <p className="text-xs text-b58-charcoal-soft uppercase tracking-wide">Miglior margine</p>
              <p className="text-sm text-b58-charcoal">
                {summary.best ? `${summary.best.recipe.name} (${formatEUR(summary.best.economics.gross_margin)})` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-b58-charcoal-soft uppercase tracking-wide">Peggior margine</p>
              <p className="text-sm text-b58-charcoal">
                {summary.worst ? `${summary.worst.recipe.name} (${formatEUR(summary.worst.economics.gross_margin)})` : "—"}
              </p>
            </div>
          </div>
          {summary.overThreshold.length > 0 && (
            <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2">
              ⚠ {summary.overThreshold.length} piatt{summary.overThreshold.length === 1 ? "o" : "i"} sopra il 25% di food cost:{" "}
              {summary.overThreshold.map((i) => i.recipe.name).join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Sezioni 4-4-4-2 */}
      {SECTIONS.map(({ category, label, target }) => {
        const sectionItems = itemsByCategory[category];
        const catAvg = categoryAverages[category];
        const candidates = allRecipes.filter(
          (r) => r.category === category && !items.some((i) => i.recipe_id === r.id)
        );
        const form = addForms[category] ?? { recipe_id: "", selling_price: "" };

        return (
          <div key={category} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg text-b58-charcoal">
                {label}{" "}
                <span className="text-sm text-b58-charcoal-soft font-sans">
                  ({sectionItems.length}/{target})
                </span>
              </h2>
              {catAvg && (
                <span className={`text-sm font-medium ${LEVEL_CLASS[foodCostLevel(catAvg.avgPct)]}`}>
                  media {catAvg.avgPct.toFixed(1)}%
                </span>
              )}
            </div>

            {sectionItems.length > 0 && (
              <table className="w-full text-sm mb-3">
                <thead>
                  <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                    <th className="py-2 font-medium">Piatto</th>
                    <th className="py-2 font-medium text-right">Food cost</th>
                    <th className="py-2 font-medium text-right">Prezzo</th>
                    <th className="py-2 font-medium text-right">Food cost %</th>
                    <th className="py-2 font-medium text-right">Margine</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {sectionItems.map((item) => (
                    <tr key={item.id} className="border-b border-b58-charcoal/5 last:border-0">
                      <td className="py-2 text-b58-charcoal">
                        <Link to={`/ricettario/ricette/${item.recipe_id}`} className="hover:text-b58-terracotta">
                          {item.recipe.name}
                        </Link>
                        {isOutOfSeason(item.recipe.seasonality) && (
                          <span className="text-[11px] text-b58-charcoal-soft ml-1.5">
                            (stagione: {item.recipe.seasonality.join(", ")})
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-right text-b58-charcoal-soft">
                        {formatEUR(item.economics?.food_cost_portion)}
                      </td>
                      <td className="py-2 text-right">
                        <CampoAutosalvato
                          type="number"
                          step="0.5"
                          value={item.selling_price}
                          onSave={(v) => handlePriceChange(item.id, v)}
                          className="w-20 rounded border border-b58-charcoal/15 px-2 py-1 text-sm text-right"
                        />
                      </td>
                      <td className={`py-2 text-right font-medium ${LEVEL_CLASS[foodCostLevel(item.economics?.food_cost_pct)]}`}>
                        {item.economics?.food_cost_pct != null ? `${Number(item.economics.food_cost_pct).toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-2 text-right text-b58-charcoal">
                        {formatEUR(item.economics?.gross_margin)}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-b58-charcoal-soft hover:text-b58-terracotta-dark text-xs"
                        >
                          Rimuovi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {candidates.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center bg-white rounded-lg border border-b58-charcoal/10 p-2">
                <select
                  value={form.recipe_id}
                  onChange={(e) =>
                    setAddForms((f) => ({ ...f, [category]: { ...form, recipe_id: e.target.value } }))
                  }
                  className={`${inputClass} flex-1 min-w-[160px]`}
                >
                  <option value="">Aggiungi ricetta…</option>
                  {candidates.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.5"
                  placeholder="Prezzo €"
                  value={form.selling_price}
                  onChange={(e) =>
                    setAddForms((f) => ({ ...f, [category]: { ...form, selling_price: e.target.value } }))
                  }
                  className={`${inputClass} w-28`}
                />
                <button
                  onClick={() => handleAddItem(category)}
                  disabled={!form.recipe_id}
                  className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
                >
                  + Aggiungi
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Simulatore what-if */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Simulatore what-if</h2>

        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { value: "prezzo_ingrediente", label: "Aumento prezzo ingrediente" },
            { value: "sostituzione", label: "Sostituzione piatto" },
            { value: "prezzo_target", label: "Prezzo per food cost target" },
          ].map((m) => (
            <button
              key={m.value}
              onClick={() => setSimMode(m.value)}
              className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                simMode === m.value
                  ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {simMode === "prezzo_ingrediente" && (
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                value={simIngredientId}
                onChange={(e) => setSimIngredientId(e.target.value)}
                className={`${inputClass} flex-1 min-w-[180px]`}
              >
                <option value="">Seleziona ingrediente usato nel menu…</option>
                {allIngredients
                  .filter((i) => usedIngredientIds.includes(i.id))
                  .map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
              </select>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={simPct}
                  onChange={(e) => setSimPct(e.target.value)}
                  className={`${inputClass} w-20`}
                />
                <span className="text-sm text-b58-charcoal-soft">% variazione</span>
              </div>
            </div>

            {priceSimResults && (
              priceSimResults.length === 0 ? (
                <p className="text-sm text-b58-charcoal-soft">
                  Questo ingrediente non è usato in nessuna ricetta del menu.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                      <th className="py-2 font-medium">Piatto</th>
                      <th className="py-2 font-medium text-right">Food cost attuale</th>
                      <th className="py-2 font-medium text-right">Food cost simulato</th>
                      <th className="py-2 font-medium text-right">Food cost % simulato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceSimResults.map(({ item, newCost, newPct }) => (
                      <tr key={item.id} className="border-b border-b58-charcoal/5 last:border-0">
                        <td className="py-2 text-b58-charcoal">{item.recipe.name}</td>
                        <td className="py-2 text-right text-b58-charcoal-soft">
                          {formatEUR(item.economics?.food_cost_portion)}
                        </td>
                        <td className="py-2 text-right text-b58-charcoal">{formatEUR(newCost)}</td>
                        <td className={`py-2 text-right font-medium ${LEVEL_CLASS[foodCostLevel(newPct)]}`}>
                          {newPct != null ? `${newPct.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        )}

        {simMode === "sostituzione" && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
              <select
                value={simSwapItemId}
                onChange={(e) => {
                  setSimSwapItemId(e.target.value);
                  const item = items.find((i) => i.id === e.target.value);
                  setSimSwapPrice(item ? String(item.selling_price) : "");
                  setSimSwapRecipeId("");
                }}
                className={inputClass}
              >
                <option value="">Piatto da sostituire…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.recipe.name}</option>
                ))}
              </select>
              <select
                value={simSwapRecipeId}
                onChange={(e) => setSimSwapRecipeId(e.target.value)}
                disabled={!simSwapItemId}
                className={inputClass}
              >
                <option value="">Con quale ricetta…</option>
                {allRecipes
                  .filter((r) => {
                    const current = items.find((i) => i.id === simSwapItemId);
                    return current && r.category === current.category && r.id !== current.recipe_id;
                  })
                  .map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
              </select>
              <input
                type="number"
                step="0.5"
                value={simSwapPrice}
                onChange={(e) => setSimSwapPrice(e.target.value)}
                placeholder="Prezzo di vendita ipotetico"
                className={inputClass}
              />
            </div>

            {simSwapItemId && simSwapRecipeId && swapCandidate?.cost && (
              <div className="text-sm bg-white rounded-lg border border-b58-charcoal/10 p-3">
                {(() => {
                  const current = items.find((i) => i.id === simSwapItemId);
                  return (
                    <>
                      <p className="text-b58-charcoal-soft">
                        Attuale — {current.recipe.name}: food cost{" "}
                        {formatEUR(current.economics?.food_cost_portion)} (
                        {current.economics?.food_cost_pct != null ? `${Number(current.economics.food_cost_pct).toFixed(1)}%` : "—"})
                      </p>
                      <p className="text-b58-charcoal mt-1">
                        Sostituto — food cost {formatEUR(swapCandidate.cost.food_cost_portion)}
                        {swapCandidate.pct != null && (
                          <span className={`ml-1 font-medium ${LEVEL_CLASS[foodCostLevel(swapCandidate.pct)]}`}>
                            ({swapCandidate.pct.toFixed(1)}%)
                          </span>
                        )}
                      </p>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {simMode === "prezzo_target" && (
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                value={simTargetItemId}
                onChange={(e) => setSimTargetItemId(e.target.value)}
                className={`${inputClass} flex-1 min-w-[180px]`}
              >
                <option value="">Seleziona piatto…</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.recipe.name}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={simTargetPct}
                  onChange={(e) => setSimTargetPct(e.target.value)}
                  className={`${inputClass} w-20`}
                />
                <span className="text-sm text-b58-charcoal-soft">% food cost target</span>
              </div>
            </div>

            {targetPriceResult && (
              <div className="text-sm bg-white rounded-lg border border-b58-charcoal/10 p-3 flex items-center justify-between flex-wrap gap-2">
                <p className="text-b58-charcoal">
                  Prezzo di vendita necessario:{" "}
                  <span className="font-medium text-lg">{formatEUR(targetPriceResult.targetPrice)}</span>
                  <span className="text-b58-charcoal-soft">
                    {" "}(attuale {formatEUR(targetPriceResult.item.selling_price)})
                  </span>
                </p>
                <button
                  onClick={applyTargetPrice}
                  disabled={applyingPrice}
                  className="rounded-lg bg-b58-charcoal text-b58-parchment text-sm px-3 py-1.5 disabled:opacity-60"
                >
                  {applyingPrice ? "Applico…" : "Applica questo prezzo"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
