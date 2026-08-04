import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createOrder, listOpenOrders, listRecentTableLabels } from "../../lib/api/orders";
import { formatEUR } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";

const orderTotal = (order) =>
  order.items
    .filter((i) => !i.voided_at)
    .reduce((s, i) => s + i.quantity * Number(i.unit_price), 0);

export default function OrdersList() {
  const { isTitolare } = useAuth();
  const [orders, setOrders] = useState([]);
  const [recentLabels, setRecentLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [tableLabel, setTableLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const load = () => Promise.all([listOpenOrders(), listRecentTableLabels()]).then(([o, l]) => {
    setOrders(o);
    setRecentLabels(l);
  });

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (label) => {
    const value = (label ?? tableLabel).trim();
    if (!value) return;
    setSaving(true);
    setError("");
    try {
      const created = await createOrder({ tableLabel: value });
      navigate(`/cassa/comande/${created.id}`);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const inputClass =
    "rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <h1 className="font-display text-2xl text-b58-charcoal">Comande</h1>
        <div className="flex gap-2 flex-wrap">
          <Link to="/cassa/cucina" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
            Cucina
          </Link>
          <Link to="/cassa/bar" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
            Bar
          </Link>
          {isTitolare && (
            <Link to="/cassa" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
              Gestione cassa
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {!showNew ? (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4 py-2 text-sm mb-6"
        >
          + Nuovo tavolo
        </button>
      ) : (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-6">
          {recentLabels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {recentLabels.map((l) => (
                <button
                  key={l}
                  type="button"
                  disabled={saving}
                  onClick={() => handleCreate(l)}
                  className="text-xs rounded-full border border-b58-charcoal/15 hover:bg-b58-cream-dark px-3 py-1.5 text-b58-charcoal disabled:opacity-60"
                >
                  {l}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              autoFocus
              value={tableLabel}
              onChange={(e) => setTableLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder='Tavolo, es. "12" o "Chef table"'
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={saving || !tableLabel.trim()}
              onClick={() => handleCreate()}
              className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
            >
              {saving ? "Apro…" : "Apri"}
            </button>
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta-dark px-2"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">Nessun tavolo aperto.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {orders.map((o) => {
            const count = o.items.filter((i) => !i.voided_at).reduce((s, i) => s + i.quantity, 0);
            return (
              <Link
                key={o.id}
                to={`/cassa/comande/${o.id}`}
                className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 hover:ring-b58-terracotta/40 transition-shadow p-4"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-display text-lg text-b58-charcoal">{o.table_label}</span>
                  <span className="text-b58-charcoal font-medium">{formatEUR(orderTotal(o))}</span>
                </div>
                <div className="text-xs text-b58-charcoal-soft">
                  {count === 0 ? "Nessun piatto ancora" : `${count} ${count === 1 ? "piatto/bevanda" : "piatti/bevande"}`}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
