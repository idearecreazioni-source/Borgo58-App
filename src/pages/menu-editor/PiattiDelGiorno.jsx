import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDailyMenuItem,
  createDailyMenu,
  deleteDailyMenu,
  listDailyMenuItems,
  listDailyMenus,
  removeDailyMenuItem,
} from "../../lib/api/dailyMenu";
import { listRecipes } from "../../lib/api/recipes";
import { RECIPE_CATEGORIES, formatDate, formatEUR, labelFor } from "../../lib/constants";
import PrintButton from "../../components/PrintButton";

const today = () => new Date().toISOString().slice(0, 10);

const CATEGORY_LABELS = {
  antipasto: "Antipasti",
  primo: "Primi",
  secondo: "Secondi",
  dolce: "Dolci",
};

export default function PiattiDelGiorno() {
  const [dailyMenus, setDailyMenus] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [items, setItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newForm, setNewForm] = useState({ service_date: today(), title: "Piatti del giorno" });
  const [itemForm, setItemForm] = useState({ mode: "recipe", recipe_id: "", custom_name: "", category: "", price: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([listDailyMenus(), listRecipes()])
      .then(([dm, rec]) => {
        setDailyMenus(dm);
        setRecipes(rec);
        if (dm[0]) setSelectedId(dm[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) { setItems([]); return; }
    listDailyMenuItems(selectedId).then(setItems).catch((e) => setError(e.message));
  }, [selectedId]);

  const selected = useMemo(() => dailyMenus.find((d) => d.id === selectedId), [dailyMenus, selectedId]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleCreate = async () => {
    setBusy(true);
    setError("");
    try {
      const dm = await createDailyMenu({ serviceDate: newForm.service_date, title: newForm.title });
      setDailyMenus(await listDailyMenus());
      setSelectedId(dm.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteMenu = async (id) => {
    try {
      await deleteDailyMenu(id);
      const dm = await listDailyMenus();
      setDailyMenus(dm);
      if (selectedId === id) setSelectedId(dm[0]?.id ?? null);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAddItem = async () => {
    const isRecipe = itemForm.mode === "recipe";
    if (isRecipe && !itemForm.recipe_id) return;
    if (!isRecipe && !itemForm.custom_name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const chosen = recipes.find((r) => r.id === itemForm.recipe_id);
      await addDailyMenuItem(selectedId, {
        recipe_id: isRecipe ? itemForm.recipe_id : null,
        custom_name: isRecipe ? null : itemForm.custom_name.trim(),
        category: itemForm.category || (isRecipe ? chosen?.category : null) || null,
        price: itemForm.price ? Number(itemForm.price) : null,
      });
      setItemForm({ mode: itemForm.mode, recipe_id: "", custom_name: "", category: "", price: "" });
      setItems(await listDailyMenuItems(selectedId));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveItem = async (id) => {
    try {
      await removeDailyMenuItem(id);
      setItems(await listDailyMenuItems(selectedId));
    } catch (e) {
      setError(e.message);
    }
  };

  const itemName = (it) => it.recipe?.name ?? it.custom_name;

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Controlli — non stampati */}
      <div className="print:hidden">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <Link to="/editor-menu" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
            ← Editor menu
          </Link>
          {selected && items.length > 0 && <PrintButton label="Stampa inserto / PDF" />}
        </div>

        <h1 className="font-display text-2xl text-b58-charcoal mb-1">Piatti del giorno</h1>
        <p className="text-xs text-b58-charcoal-soft/80 mb-6">
          Inserto leggero e separato dal menu principale, legato a una data. Puoi usarlo anche per provare
          piatti "pronti per la carta" prima di metterli in carta stabile.
        </p>

        {error && <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>}

        {/* Nuovo menu del giorno */}
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-4 flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs text-b58-charcoal-soft mb-1">Data</label>
            <input type="date" value={newForm.service_date} onChange={(e) => setNewForm((f) => ({ ...f, service_date: e.target.value }))} className={inputClass + " w-40"} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-b58-charcoal-soft mb-1">Titolo</label>
            <input value={newForm.title} onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))} className={inputClass} />
          </div>
          <button type="button" disabled={busy} onClick={handleCreate} className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60">
            + Crea
          </button>
        </div>

        {/* Elenco menu del giorno */}
        {loading ? (
          <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
        ) : dailyMenus.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60 mb-4">Nessun menu del giorno ancora.</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-6">
            {dailyMenus.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  selectedId === d.id
                    ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                    : "border-b58-charcoal/15 text-b58-charcoal-soft hover:bg-b58-cream-dark"
                }`}
              >
                {formatDate(d.service_date)}
              </button>
            ))}
          </div>
        )}

        {/* Editor del menu selezionato */}
        {selected && (
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-base text-b58-charcoal">{selected.title || "Piatti del giorno"} · {formatDate(selected.service_date)}</h2>
              <button onClick={() => handleDeleteMenu(selected.id)} className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark">
                Elimina questo giorno
              </button>
            </div>

            {items.length > 0 && (
              <ul className="space-y-1 mb-3">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-b58-charcoal">
                      {itemName(it)}
                      {it.category && <span className="text-xs text-b58-charcoal-soft"> · {labelFor(RECIPE_CATEGORIES, it.category)}</span>}
                      {it.price != null && <span className="text-b58-charcoal-soft"> · {formatEUR(it.price)}</span>}
                    </span>
                    <button onClick={() => handleRemoveItem(it.id)} className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark">Rimuovi</button>
                  </li>
                ))}
              </ul>
            )}

            <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
              <div className="flex gap-2 mb-2">
                <button type="button" onClick={() => setItemForm((f) => ({ ...f, mode: "recipe" }))} className={`rounded-full text-xs px-3 py-1.5 border ${itemForm.mode === "recipe" ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark" : "border-b58-charcoal/15 text-b58-charcoal-soft"}`}>Dal ricettario</button>
                <button type="button" onClick={() => setItemForm((f) => ({ ...f, mode: "custom" }))} className={`rounded-full text-xs px-3 py-1.5 border ${itemForm.mode === "custom" ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark" : "border-b58-charcoal/15 text-b58-charcoal-soft"}`}>Piatto libero</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {itemForm.mode === "recipe" ? (
                  <select value={itemForm.recipe_id} onChange={(e) => setItemForm((f) => ({ ...f, recipe_id: e.target.value }))} className={`${inputClass} col-span-2`}>
                    <option value="">Seleziona ricetta…</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                ) : (
                  <input value={itemForm.custom_name} onChange={(e) => setItemForm((f) => ({ ...f, custom_name: e.target.value }))} placeholder="Nome piatto" className={`${inputClass} col-span-2`} />
                )}
                <select value={itemForm.category} onChange={(e) => setItemForm((f) => ({ ...f, category: e.target.value }))} className={inputClass}>
                  <option value="">Categoria…</option>
                  {RECIPE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <input type="number" step="0.01" value={itemForm.price} onChange={(e) => setItemForm((f) => ({ ...f, price: e.target.value }))} placeholder="Prezzo €" className={inputClass} />
              </div>
              <div className="flex justify-end mt-2">
                <button type="button" disabled={busy} onClick={handleAddItem} className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60">
                  + Aggiungi piatto
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Anteprima inserto — stampata */}
      {selected && items.length > 0 && (
        <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-8 print:ring-0 print:p-0 max-w-md mx-auto">
          <div className="text-center mb-6">
            <h2 className="font-display text-2xl text-b58-charcoal">{selected.title || "Piatti del giorno"}</h2>
            <p className="text-xs tracking-widest uppercase text-b58-charcoal-soft mt-1">{formatDate(selected.service_date)}</p>
          </div>
          <ul className="space-y-3">
            {items.map((it) => (
              <li key={it.id} className="flex items-baseline justify-between gap-3">
                <span className="text-b58-charcoal">
                  {itemName(it)}
                  {it.category && <span className="text-xs text-b58-charcoal-soft/70"> · {labelFor(RECIPE_CATEGORIES, it.category)}</span>}
                </span>
                {it.price != null && <span className="text-b58-charcoal-soft whitespace-nowrap">{formatEUR(it.price)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
