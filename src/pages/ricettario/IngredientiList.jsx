import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listIngredients } from "../../lib/api/ingredients";
import { INGREDIENT_CATEGORIES } from "../../lib/constants";
import { campiIngrediente } from "../../lib/calcoli/ingredienti";

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
            className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta"
          >
            ← Ricettario
          </Link>
          <h1 className="font-display text-2xl text-b58-charcoal mt-1">
            Ingredienti
          </h1>
        </div>
        <Link
          to="/ricettario/ingredienti/nuovo"
          className="tocco-campo rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4 py-2 testo-sala-grande"
        >
          + Nuovo ingrediente
        </Link>
      </div>

      {/* ⚠️ `min-w-0` sui campi: le due tendine prendono la larghezza
          della voce piu lunga che contengono, e a 390 punti quella
          dellordinamento sforava di 17. Andare a capo non bastava —
          il pezzo era piu largo della riga intera. */}
      <div className="flex flex-wrap gap-3 mb-4 [&>*]:min-w-0 [&>*]:max-w-full">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome…"
          className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta flex-1 min-w-[200px]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
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
          className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
        >
          <option value="name">Ordina: nome</option>
          <option value="price">Ordina: prezzo</option>
          <option value="updated">Ordina: aggiornati di recente</option>
        </select>

        {/* ⚠️ Una casella, non un terzo menu: è uno stato acceso o spento,
            e i due menu accanto sono scelte fra molte. */}
        <label className="tocco-bottone inline-flex items-center gap-2 testo-sala-grande text-b58-charcoal-soft">
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
        <p className="testo-sala-grande text-b58-terracotta-dark mb-4">
          Errore nel caricamento: {error}
        </p>
      )}

      {loading ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">
            {search || category
              ? "Nessun ingrediente corrisponde ai filtri."
              : "Nessun ingrediente ancora. Aggiungi il primo."}
          </p>
        </div>
      ) : (
        <>
          {/* SUL TELEFONO: un blocchetto per ingrediente, coi dati a capo.
              Sei colonne in 390 punti facevano sbordare la pagina di 646:
              il Ricettario si guarda in cucina, e lì lo schermo è quello. */}
          <div className="md:hidden space-y-3">
            {sorted.map((ing) => (
              <button
                key={ing.id}
                type="button"
                onClick={() => navigate(`/ricettario/ingredienti/${ing.id}`)}
                className="w-full text-left rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4"
              >
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-b58-charcoal font-medium testo-sala-grande">
                    {ing.name}
                  </span>
                  {/* ⚠️ Si vede QUALE e' messo da parte: senza il segno,
                      accendendo la casella l'elenco si allunga e non si
                      capisce quali righe sono comparse. */}
                  {ing.active === false && (
                    <span className="testo-sala font-normal text-b58-charcoal-soft bg-b58-charcoal/10 rounded-full px-2.5 py-1 shrink-0">
                      messo da parte
                    </span>
                  )}
                </div>
                {campiIngrediente(ing).map((c) => (
                  <p key={c.chiave} className="testo-sala-grande">
                    <span className="text-b58-charcoal-soft">{c.etichetta}: </span>
                    {c.valore ? (
                      <span
                        className={c.forte ? "text-b58-charcoal font-medium" : "text-b58-charcoal"}
                      >
                        {c.valore}
                      </span>
                    ) : (
                      <span className="text-b58-charcoal-soft/70 italic">{c.vuoto ?? "—"}</span>
                    )}
                  </p>
                ))}
              </button>
            ))}
          </div>

          {/* SUL COMPUTER: la tabella resta — lì funziona, e si cura dove fa
              male (stessa distinzione del Calendario Eventi). */}
          <div className="hidden md:block rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 overflow-hidden overflow-x-auto">
            <table className="w-full testo-sala-grande">
              <thead>
                <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  {campiIngrediente(sorted[0]).map((c) => (
                    <th key={c.chiave} className="px-4 py-3 font-medium">
                      {c.etichetta}
                    </th>
                  ))}
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
                      {ing.active === false && (
                        <span className="ml-2 testo-sala font-normal text-b58-charcoal-soft bg-b58-charcoal/10 rounded-full px-2 py-0.5">
                          messo da parte
                        </span>
                      )}
                    </td>
                    {campiIngrediente(ing).map((c) => (
                      <td
                        key={c.chiave}
                        className={`px-4 py-3 ${c.forte ? "text-b58-charcoal font-medium" : "text-b58-charcoal-soft"}`}
                      >
                        {c.valore || (
                          <span className="text-b58-charcoal-soft/70 italic">{c.vuoto ?? "—"}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
