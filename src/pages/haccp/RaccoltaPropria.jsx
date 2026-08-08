import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createForagedItem, deleteForagedItem, listForagedItems } from "../../lib/api/haccp";
import { listIngredients } from "../../lib/api/ingredients";
import { formatDate, oggiLocale } from "../../lib/constants";

const today = oggiLocale;

const emptyForm = {
  species: "",
  harvest_date: today(),
  harvest_location: "",
  forager_name: "",
  identification_method: "",
  contamination_risk_note: "",
  ingredient_id: "",
  note: "",
};

export default function RaccoltaPropria() {
  const [items, setItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const reload = () => Promise.all([listForagedItems(), listIngredients()]).then(([it, ing]) => {
    setItems(it);
    setIngredients(ing);
  });

  useEffect(() => {
    setLoading(true);
    reload().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleAdd = async () => {
    if (!form.species.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createForagedItem({
        species: form.species.trim(),
        harvest_date: form.harvest_date,
        harvest_location: form.harvest_location || null,
        forager_name: form.forager_name || null,
        identification_method: form.identification_method || null,
        contamination_risk_note: form.contamination_risk_note || null,
        ingredient_id: form.ingredient_id || null,
        note: form.note || null,
      });
      setForm(emptyForm);
      setShowForm(false);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteForagedItem(id);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/haccp" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← HACCP
        </Link>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment text-sm font-medium px-4 py-2">
          {showForm ? "Annulla" : "+ Nuova raccolta"}
        </button>
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-1">Raccolta propria</h1>
      <p className="text-xs text-b58-charcoal-soft/80 mb-6">
        Erbe spontanee e prodotti autoraccolti (§3.17): zona grigia normativa in Italia, nessun documento
        fiscale coinvolto — pura tracciabilità HACCP. <strong>Da validare con un consulente alimentare/tecnico
        HACCP</strong> prima di un uso in produzione.
      </p>

      {error && <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {showForm && (
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <input value={form.species} onChange={(e) => setForm((f) => ({ ...f, species: e.target.value }))} placeholder="Specie raccolta" className={`${inputClass} sm:col-span-2`} />
            <div>
              <label className={labelClass}>Data raccolta</label>
              <input type="date" value={form.harvest_date} onChange={(e) => setForm((f) => ({ ...f, harvest_date: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input value={form.harvest_location} onChange={(e) => setForm((f) => ({ ...f, harvest_location: e.target.value }))} placeholder="Luogo di raccolta" className={inputClass} />
            <input value={form.forager_name} onChange={(e) => setForm((f) => ({ ...f, forager_name: e.target.value }))} placeholder="Chi ha raccolto" className={inputClass} />
          </div>
          <input value={form.identification_method} onChange={(e) => setForm((f) => ({ ...f, identification_method: e.target.value }))} placeholder="Metodo di verifica dell'identificazione" className={`${inputClass} mb-3`} />
          <input value={form.contamination_risk_note} onChange={(e) => setForm((f) => ({ ...f, contamination_risk_note: e.target.value }))} placeholder="Nota sul rischio di contaminazione (opz.)" className={`${inputClass} mb-3`} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <select value={form.ingredient_id} onChange={(e) => setForm((f) => ({ ...f, ingredient_id: e.target.value }))} className={inputClass}>
              <option value="">Ingrediente collegato (opz.)</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
            <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Nota (opz.)" className={inputClass} />
          </div>
          <div className="flex justify-end">
            <button type="button" disabled={saving || !form.species.trim()} onClick={handleAdd} className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60">
              {saving ? "Registro…" : "+ Registra raccolta"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">Nessuna raccolta registrata ancora.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-b58-charcoal font-medium">
                  {it.species}
                  <span className="text-xs text-b58-charcoal-soft font-normal ml-1.5">· lotto {it.internal_lot}</span>
                </div>
                <div className="text-xs text-b58-charcoal-soft mt-0.5">
                  {formatDate(it.harvest_date)}
                  {it.harvest_location && <> · {it.harvest_location}</>}
                  {it.forager_name && <> · raccolto da {it.forager_name}</>}
                  {it.ingredient && <> · → {it.ingredient.name}</>}
                </div>
                {it.identification_method && (
                  <div className="text-xs text-b58-charcoal-soft mt-1">Identificazione: {it.identification_method}</div>
                )}
                {it.contamination_risk_note && (
                  <div className="text-xs text-b58-terracotta-dark mt-1">Rischio: {it.contamination_risk_note}</div>
                )}
              </div>
              <button onClick={() => handleDelete(it.id)} className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark shrink-0">
                Rimuovi
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
