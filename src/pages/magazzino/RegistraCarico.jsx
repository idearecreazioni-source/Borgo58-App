import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listStockLevels, registerStockDelivery } from "../../lib/api/stock";
import { listSuppliers, listSuppliersDisplay } from "../../lib/api/suppliers";
import { getEntities } from "../../lib/api/entities";
import { useAuth } from "../../context/AuthContext";

const emptyForm = {
  ingredient_id: "",
  quantity: "",
  supplier_id: "",
  expiry_date: "",
  unit_cost: "",
  note: "",
};

export default function RegistraCarico() {
  const navigate = useNavigate();
  const { isTitolare } = useAuth();
  const [ingredients, setIngredients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listStockLevels(),
      isTitolare ? getEntities().then((e) => listSuppliers(e.srls.id)) : listSuppliersDisplay(),
    ])
      .then(([levels, sup]) => {
        if (cancelled) return;
        setIngredients(levels);
        setSuppliers(sup);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isTitolare]);

  const selectedIngredient = ingredients.find((i) => i.ingredient_id === form.ingredient_id);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.ingredient_id || !form.quantity) return;
    setSaving(true);
    setError("");
    try {
      await registerStockDelivery({
        ingredientId: form.ingredient_id,
        quantity: Number(form.quantity),
        supplierId: form.supplier_id || null,
        expiryDate: form.expiry_date || null,
        note: form.note || null,
        unitCost: isTitolare && form.unit_cost ? Number(form.unit_cost) : null,
      });
      navigate("/magazzino");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-b58-charcoal-soft max-w-xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-xl mx-auto">
      <Link to="/magazzino" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Magazzino
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">Registra carico</h1>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 space-y-4">
        <div>
          <label className={labelClass}>Ingrediente</label>
          <select
            required
            value={form.ingredient_id}
            onChange={(e) => setForm((f) => ({ ...f, ingredient_id: e.target.value }))}
            className={inputClass}
          >
            <option value="" disabled>Seleziona…</option>
            {ingredients.map((i) => (
              <option key={i.ingredient_id} value={i.ingredient_id}>{i.ingredient_name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Quantità{selectedIngredient ? ` (${selectedIngredient.unit})` : ""}</label>
            <input
              required
              type="number"
              step="0.01"
              min="0"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Scadenza (opzionale)</label>
            <input
              type="date"
              value={form.expiry_date}
              onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Fornitore (opzionale)</label>
          <select
            value={form.supplier_id}
            onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
            className={inputClass}
          >
            <option value="">Nessuno</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {isTitolare && (
          <div>
            <label className={labelClass}>Costo unitario, IVA esclusa (opzionale)</label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={form.unit_cost}
              onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))}
              placeholder="€"
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label className={labelClass}>Nota (opzionale)</label>
          <input
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={saving || !form.ingredient_id || !form.quantity}
          className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment font-medium px-5 py-2.5 text-sm"
        >
          {saving ? "Registro…" : "Registra carico"}
        </button>
      </form>
    </div>
  );
}
