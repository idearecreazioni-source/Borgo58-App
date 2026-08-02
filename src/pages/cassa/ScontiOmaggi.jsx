import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createDiscountGift,
  deleteDiscountGift,
  listCausali,
  listDiscountsGifts,
  listDiscountsGiftsMonthly,
} from "../../lib/api/cash";
import { listCustomers } from "../../lib/api/customers";
import { getEntities } from "../../lib/api/entities";
import { DISCOUNT_GIFT_TYPES, formatDate, formatEUR, labelFor } from "../../lib/constants";

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  type: "omaggio",
  full_amount: "",
  collected_amount: "",
  causale_id: "",
  causale_note: "",
  customer_id: "",
  movement_date: today(),
  note: "",
};

const monthLabel = (isoMonth) => {
  const d = new Date(isoMonth);
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(d);
};

export default function ScontiOmaggi() {
  const [entities, setEntities] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [items, setItems] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [causali, setCausali] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getEntities(), listCausali("sconto_omaggio"), listCustomers()])
      .then(([ent, caus, cust]) => {
        setEntities(ent);
        setEntityId(ent.srls.id);
        setCausali(caus);
        setCustomers(cust);
      })
      .catch((e) => setError(e.message));
  }, []);

  const reload = () => {
    if (!entityId) return Promise.resolve();
    return Promise.all([listDiscountsGifts({ entityId }), listDiscountsGiftsMonthly(entityId)]).then(
      ([list, agg]) => {
        setItems(list);
        setMonthly(agg);
      }
    );
  };

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  const isOmaggio = form.type === "omaggio";

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleAdd = async () => {
    if (!form.full_amount || Number(form.full_amount) < 0) return;
    setSaving(true);
    setError("");
    try {
      await createDiscountGift({
        entity_id: entityId,
        type: form.type,
        full_amount: Number(form.full_amount),
        collected_amount: isOmaggio ? 0 : Number(form.collected_amount) || 0,
        causale_id: form.causale_id || null,
        causale_note: form.causale_note || null,
        customer_id: form.customer_id || null,
        movement_date: form.movement_date,
        note: form.note || null,
      });
      setForm({ ...emptyForm, type: form.type, movement_date: form.movement_date });
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDiscountGift(id);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  // Raggruppa l'aggregazione mensile per mese (sconto + omaggio insieme).
  const monthsMap = {};
  monthly.forEach((r) => {
    (monthsMap[r.month] ??= {})[r.type] = r;
  });
  const months = Object.keys(monthsMap).sort().reverse();

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/cassa" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Cassa
        </Link>
        {entities && (
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 text-sm text-b58-charcoal"
          >
            <option value={entities.srls.id}>{entities.srls.name}</option>
            {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
          </select>
        )}
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-2">Sconti e omaggi</h1>
      <p className="text-xs text-b58-charcoal-soft/80 mb-6">
        Sconto e omaggio sono operazioni fiscalmente distinte (§6). L'omaggio di cibo/bevande è una cessione
        gratuita: il totale mensile a valore di listino è la base dell'autofattura TD27 cumulativa mensile —
        da validare con Laura, il sistema non emette il documento.
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* Riepilogo mensile (TD27) */}
      {months.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
          <h2 className="font-display text-lg text-b58-charcoal mb-4">Riepilogo mensile</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="py-2 font-medium">Mese</th>
                <th className="py-2 font-medium text-right">Sconti (mancato incasso)</th>
                <th className="py-2 font-medium text-right">Omaggi — base TD27</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m} className="border-b border-b58-charcoal/5 last:border-0">
                  <td className="py-2 text-b58-charcoal capitalize">{monthLabel(m)}</td>
                  <td className="py-2 text-right text-b58-charcoal-soft">
                    {monthsMap[m].sconto ? formatEUR(monthsMap[m].sconto.total_forgone) : "—"}
                  </td>
                  <td className="py-2 text-right text-b58-charcoal font-medium">
                    {monthsMap[m].omaggio ? formatEUR(monthsMap[m].omaggio.total_full) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Nuovo */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Nuovo sconto / omaggio</h2>
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
          <div className="flex gap-2 mb-3">
            {DISCOUNT_GIFT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  form.type === t.value
                    ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                    : "border-b58-charcoal/15 text-b58-charcoal-soft"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <label className={labelClass}>Valore a listino €</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.full_amount}
                onChange={(e) => setForm((f) => ({ ...f, full_amount: e.target.value }))}
                className={inputClass}
              />
            </div>
            {!isOmaggio && (
              <div>
                <label className={labelClass}>Incassato €</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.collected_amount}
                  onChange={(e) => setForm((f) => ({ ...f, collected_amount: e.target.value }))}
                  className={inputClass}
                />
              </div>
            )}
            <div>
              <label className={labelClass}>Data</label>
              <input
                type="date"
                value={form.movement_date}
                onChange={(e) => setForm((f) => ({ ...f, movement_date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Causale</label>
              <select
                value={form.causale_id}
                onChange={(e) => setForm((f) => ({ ...f, causale_id: e.target.value }))}
                className={inputClass}
              >
                <option value="">—</option>
                {causali.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <select
              value={form.customer_id}
              onChange={(e) => setForm((f) => ({ ...f, customer_id: e.target.value }))}
              className={inputClass}
            >
              <option value="">Cliente (opz.)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name || c.phone}</option>
              ))}
            </select>
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Nota (opz.)"
              className={inputClass}
            />
          </div>

          {isOmaggio && (
            <p className="text-xs text-b58-charcoal-soft/70 mb-3">
              Un omaggio non incassa nulla: l'incassato è 0 e concorre alla base TD27 del mese.
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving || !form.full_amount}
              onClick={handleAdd}
              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
            >
              {saving ? "Registro…" : "+ Registra"}
            </button>
          </div>
        </div>
      </div>

      {/* Elenco */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Registro</h2>
        {loading ? (
          <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60">Nessuno sconto o omaggio registrato.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-3 text-sm bg-white rounded-lg border border-b58-charcoal/10 px-3 py-2">
                <div>
                  <span className="text-b58-charcoal font-medium">{labelFor(DISCOUNT_GIFT_TYPES, it.type)}</span>
                  <span className="text-b58-charcoal-soft"> · {formatDate(it.movement_date)}</span>
                  {it.causale?.label && <span className="text-b58-charcoal-soft"> · {it.causale.label}</span>}
                  {it.customer && (
                    <span className="text-b58-charcoal-soft"> · {it.customer.name || it.customer.phone}</span>
                  )}
                  {it.note && <div className="text-xs text-b58-charcoal-soft">{it.note}</div>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-b58-charcoal">
                    {formatEUR(it.full_amount)}
                    {it.type === "sconto" && (
                      <span className="text-b58-charcoal-soft"> (incassato {formatEUR(it.collected_amount)})</span>
                    )}
                  </span>
                  <button
                    onClick={() => handleDelete(it.id)}
                    className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                  >
                    Rimuovi
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
