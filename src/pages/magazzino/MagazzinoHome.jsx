import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listStockLevels, recordStockConsumption } from "../../lib/api/stock";
import { CONSUMPTION_REASONS, formatDate } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";

const emptyConsumptionForm = { quantity: "", reason: "consumo", note: "" };

// Evidenzia le scadenze vicine: entro 3 giorni rosso, entro 7 giallo.
const expiryUrgency = (dateStr) => {
  if (!dateStr) return "neutral";
  const days = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
  if (days < 3) return "danger";
  if (days < 7) return "warning";
  return "neutral";
};

export default function MagazzinoHome() {
  const { isTitolare } = useAuth();
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openRow, setOpenRow] = useState(null);
  const [consumptionForm, setConsumptionForm] = useState(emptyConsumptionForm);
  const [saving, setSaving] = useState(false);

  const load = () => listStockLevels().then(setLevels);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleRow = (ingredientId) => {
    setOpenRow((r) => (r === ingredientId ? null : ingredientId));
    setConsumptionForm(emptyConsumptionForm);
    setError("");
  };

  const handleConsumption = async (ingredientId) => {
    if (!consumptionForm.quantity) return;
    setSaving(true);
    setError("");
    try {
      await recordStockConsumption({
        ingredientId,
        quantity: Number(consumptionForm.quantity),
        reason: consumptionForm.reason,
        note: consumptionForm.note || null,
      });
      setOpenRow(null);
      setConsumptionForm(emptyConsumptionForm);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">Magazzino</h1>
          <p className="text-b58-charcoal-soft mt-1">
            Giacenze, soglie minime, scadenze.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/magazzino/lista-spesa"
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
          >
            Lista della spesa
          </Link>
          <Link
            to="/magazzino/carico"
            className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
          >
            + Registra carico
          </Link>
        </div>
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : levels.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">
            Nessun ingrediente ancora. Aggiungili dal Ricettario, poi registra qui i carichi.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="px-4 py-3 font-medium">Ingrediente</th>
                <th className="px-4 py-3 font-medium">Giacenza</th>
                <th className="px-4 py-3 font-medium">Soglia minima</th>
                <th className="px-4 py-3 font-medium">Scade prima</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {levels.map((l) => {
                const urgency = expiryUrgency(l.nearest_expiry);
                return (
                  <Fragment key={l.ingredient_id}>
                    <tr className="border-b border-b58-charcoal/5 last:border-0">
                      <td className="px-4 py-3 text-b58-charcoal font-medium">
                        {l.ingredient_name}
                        {l.below_threshold && (
                          <span className="text-[11px] text-b58-terracotta-dark bg-b58-terracotta/10 rounded-full px-2 py-0.5 ml-1.5">
                            sotto soglia
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-b58-charcoal-soft">
                        {l.current_quantity} {l.unit}
                      </td>
                      <td className="px-4 py-3 text-b58-charcoal-soft">
                        {l.stock_minimum_threshold != null ? `${l.stock_minimum_threshold} ${l.unit}` : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 ${
                          urgency === "danger"
                            ? "text-b58-terracotta-dark font-medium"
                            : urgency === "warning"
                            ? "text-b58-gold-dark font-medium"
                            : "text-b58-charcoal-soft"
                        }`}
                      >
                        {formatDate(l.nearest_expiry)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggleRow(l.ingredient_id)}
                          disabled={l.current_quantity <= 0}
                          className="text-b58-charcoal-soft hover:text-b58-terracotta-dark text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {openRow === l.ingredient_id ? "Annulla" : "Scarico"}
                        </button>
                      </td>
                    </tr>
                    {openRow === l.ingredient_id && (
                      <tr className="bg-white">
                        <td colSpan={5} className="px-4 py-3">
                          <div className="flex flex-wrap gap-2 items-end">
                            <div className="w-28">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={l.current_quantity}
                                value={consumptionForm.quantity}
                                onChange={(e) =>
                                  setConsumptionForm((f) => ({ ...f, quantity: e.target.value }))
                                }
                                placeholder={`Qtà (${l.unit})`}
                                className={inputClass}
                              />
                            </div>
                            <div className="w-48">
                              <select
                                value={consumptionForm.reason}
                                onChange={(e) =>
                                  setConsumptionForm((f) => ({ ...f, reason: e.target.value }))
                                }
                                className={inputClass}
                              >
                                {CONSUMPTION_REASONS.map((r) => (
                                  <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-1 min-w-[160px]">
                              <input
                                value={consumptionForm.note}
                                onChange={(e) =>
                                  setConsumptionForm((f) => ({ ...f, note: e.target.value }))
                                }
                                placeholder="Nota (opzionale)"
                                className={inputClass}
                              />
                            </div>
                            <button
                              type="button"
                              disabled={saving || !consumptionForm.quantity}
                              onClick={() => handleConsumption(l.ingredient_id)}
                              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
                            >
                              {saving ? "Salvo…" : "Conferma"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isTitolare && (
        <p className="text-xs text-b58-charcoal-soft/70 mt-4">
          Giacenze e scadenze, senza valore economico.
        </p>
      )}
    </div>
  );
}
