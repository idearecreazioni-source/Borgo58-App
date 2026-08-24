import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listIngredients } from "../../lib/api/ingredients";
import { INGREDIENT_CATEGORIES, labelFor, formatEUR } from "../../lib/constants";

export default function IngredientiList() {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState("name");
  // ⚠️ Senza un modo di VEDERE quelli messi da parte non si potrebbero più
  // rimettere — e un gesto che non si può disfare non è «mettere da
  // parte», è cancellare con un altro nome.
  const [conMessiDaParte, setConMessiDaParte] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    listIngredients({
      search: search || undefined,
      category: category || undefined,
      includiNonAttivi: conMessiDaParte,
    })
      .then(setIngredients)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, category, conMessiDaParte]);

  const sorted = useMemo(() => {
    const list = [...ingredients];
    if (sortBy === "price") return list.sort((a, b) => b.current_price - a.current_price);
    if (sortBy === "updated")
      return list.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredients, sortBy]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <Link
            to="/ricettario"
            className="tocco-bottone inline-flex items-center text-sm text-b58-charcoal-soft hover:text-b58-terracotta"
          >
            ← Ricettario
          </Link>
          <h1 className="font-display text-2xl text-b58-charcoal mt-1">
            Ingredienti
          </h1>
        </div>
        <Link
          to="/ricettario/ingredienti/nuovo"
          className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4 py-2 text-sm"
        >
          + Nuovo ingrediente
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
          {INGREDIENT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
        >
          <option value="name">Ordina: nome</option>
          <option value="price">Ordina: prezzo</option>
          <option value="updated">Ordina: aggiornati di recente</option>
        </select>

        {/* ⚠️ Una casella, non un terzo menu: è uno stato acceso o spento,
            e i due menu accanto sono scelte fra molte. */}
        <label className="tocco-bottone inline-flex items-center gap-2 text-sm text-b58-charcoal-soft">
          <input
            type="checkbox"
            checked={conMessiDaParte}
            onChange={(e) => setConMessiDaParte(e.target.checked)}
            className="w-4 h-4 accent-b58-terracotta"
          />
          Mostra anche quelli messi da parte
        </label>
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark mb-4">
          Errore nel caricamento: {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">
            {search || category
              ? "Nessun ingrediente corrisponde ai filtri."
              : "Nessun ingrediente ancora. Aggiungi il primo."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Provenienza</th>
                <th className="px-4 py-3 font-medium text-right">Prezzo</th>
                <th className="px-4 py-3 font-medium">Unità</th>
                <th className="px-4 py-3 font-medium">Allergeni</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((ing) => (
                <tr
                  key={ing.id}
                  onClick={() => navigate(`/ricettario/ingredienti/${ing.id}`)}
                  className="border-b border-b58-charcoal/5 last:border-0 hover:bg-b58-cream-dark/40 cursor-pointer"
                >
                  <td className="px-4 py-3 text-b58-charcoal font-medium">
                    {ing.name}
                    {/* ⚠️ Si vede QUALE e' messo da parte: senza il segno,
                        accendendo la casella l'elenco si allunga e non si
                        capisce quali righe sono comparse. */}
                    {ing.active === false && (
                      <span className="ml-2 text-xs font-normal text-b58-charcoal-soft bg-b58-charcoal/10 rounded-full px-2 py-0.5">
                        messo da parte
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">
                    {labelFor(INGREDIENT_CATEGORIES, ing.category)}
                  </td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">
                    {ing.source_type === "produzione_interna"
                      ? "Produzione interna"
                      : ing.supplier?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-b58-charcoal">
                    {formatEUR(ing.current_price)}
                    <span className="text-b58-charcoal-soft">/{ing.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">{ing.unit}</td>
                  <td className="px-4 py-3">
                    {ing.allergens?.length > 0 ? (
                      <span className="text-xs text-b58-terracotta-dark">
                        {ing.allergens.length} allergen{ing.allergens.length === 1 ? "e" : "i"}
                      </span>
                    ) : (
                      <span className="text-xs text-b58-charcoal-soft/50">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
