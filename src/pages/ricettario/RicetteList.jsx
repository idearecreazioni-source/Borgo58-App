import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listRecipes, listAllRecipeCosts } from "../../lib/api/recipes";
import { RECIPE_CATEGORIES, RECIPE_STATUSES, labelFor, formatEUR } from "../../lib/constants";

const STATUS_BADGE = {
  in_sviluppo: "bg-b58-gold",
  attiva: "bg-b58-olive",
  in_pausa: "bg-b58-charcoal-soft",
  archiviata: "bg-b58-charcoal-soft/50",
};

export default function RicetteList() {
  const [recipes, setRecipes] = useState([]);
  const [costs, setCosts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      listRecipes({ search: search || undefined, category: category || undefined, status: status || undefined }),
      listAllRecipeCosts(),
    ])
      .then(([recipeData, costData]) => {
        setRecipes(recipeData);
        setCosts(Object.fromEntries(costData.map((c) => [c.recipe_id, c])));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, category, status]);

  const sorted = useMemo(
    () => [...recipes].sort((a, b) => a.name.localeCompare(b.name)),
    [recipes]
  );

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <Link to="/ricettario" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
            ← Ricettario
          </Link>
          <h1 className="font-display text-2xl text-b58-charcoal mt-1">Ricette</h1>
        </div>
        <Link
          to="/ricettario/ricette/nuova"
          className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4 py-2 text-sm"
        >
          + Nuova ricetta
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome…"
          className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta flex-1 min-w-[200px]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
        >
          <option value="">Tutte le categorie</option>
          {RECIPE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
        >
          <option value="">Tutti gli stati</option>
          {RECIPE_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-b58-terracotta-dark mb-4">Errore: {error}</p>}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">
            {search || category || status
              ? "Nessuna ricetta corrisponde ai filtri."
              : "Nessuna ricetta ancora. Crea la prima."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Porzioni</th>
                <th className="px-4 py-3 font-medium text-right">Food cost / porzione</th>
                <th className="px-4 py-3 font-medium">Stato</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const cost = costs[r.id];
                return (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/ricettario/ricette/${r.id}`)}
                    className="border-b border-b58-charcoal/5 last:border-0 hover:bg-b58-cream-dark/40 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-b58-charcoal font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-b58-charcoal-soft">
                      {labelFor(RECIPE_CATEGORIES, r.category)}
                    </td>
                    <td className="px-4 py-3 text-b58-charcoal-soft">{r.portions_yield}</td>
                    <td className="px-4 py-3 text-right text-b58-charcoal">
                      {cost ? formatEUR(cost.food_cost_portion) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full ${STATUS_BADGE[r.status]} text-b58-parchment text-[11px] font-medium px-2.5 py-1`}
                      >
                        {labelFor(RECIPE_STATUSES, r.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
