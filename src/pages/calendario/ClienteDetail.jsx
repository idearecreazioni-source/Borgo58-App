import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  deleteCustomer,
  getCustomer,
  listCustomerReservations,
  listCustomers,
  mergeCustomers,
  updateCustomer,
} from "../../lib/api/customers";
import { RESERVATION_STATUSES, formatDate, labelFor } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";

export default function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isTitolare } = useAuth();

  const [customer, setCustomer] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showMerge, setShowMerge] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeOptions, setMergeOptions] = useState([]);
  const [merging, setMerging] = useState(false);

  const load = () =>
    Promise.all([getCustomer(id), listCustomerReservations(id)]).then(([c, res]) => {
      setCustomer(c);
      setReservations(res);
    });

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => {
        if (e.code === "PGRST116") setNotFound(true);
        else setError(e.message);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!showMerge) return;
    listCustomers({ search: mergeSearch || undefined })
      .then((rows) => setMergeOptions(rows.filter((c) => c.id !== id)))
      .catch((e) => setError(e.message));
  }, [showMerge, mergeSearch, id]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleChange = (field, value) => setCustomer((c) => ({ ...c, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await updateCustomer(id, {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        notes: customer.notes,
      });
      setCustomer((c) => ({ ...c, ...updated }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCustomer(id);
      navigate("/calendario-eventi/clienti");
    } catch (e) {
      setError(e.message);
    }
  };

  const handleMerge = async (mergeIntoThisId) => {
    setMerging(true);
    setError("");
    try {
      await mergeCustomers(id, mergeIntoThisId);
      setShowMerge(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setMerging(false);
    }
  };

  if (notFound) return <Navigate to="/calendario-eventi/clienti" replace />;
  if (loading || !customer) {
    return <p className="text-sm text-b58-charcoal-soft max-w-2xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <Link to="/calendario-eventi/clienti" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Clienti
      </Link>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 my-4">
          {error}
        </p>
      )}

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mt-3 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <input
            value={customer.name || ""}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Nome cliente"
            className="font-display text-2xl text-b58-charcoal bg-transparent border-b border-transparent hover:border-b58-charcoal/20 focus:border-b58-terracotta focus:outline-none flex-1 min-w-[200px]"
          />
          <div className="text-right">
            <div className="text-xl text-b58-charcoal font-medium">
              {customer.stats?.reservation_count ?? 0}
            </div>
            <div className="text-xs text-b58-charcoal-soft">prenotazioni</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass}>Telefono</label>
            <input
              value={customer.phone || ""}
              onChange={(e) => handleChange("phone", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              value={customer.email || ""}
              onChange={(e) => handleChange("email", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className={labelClass}>Note (preferenze, allergie, occasioni speciali)</label>
          <textarea
            value={customer.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>

        {customer.stats?.first_reservation_date && (
          <p className="text-xs text-b58-charcoal-soft mb-4">
            Cliente dal {formatDate(customer.stats.first_reservation_date)} · ultima visita{" "}
            {formatDate(customer.stats.last_reservation_date)}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            {isTitolare && (
              <>
                <button
                  type="button"
                  onClick={() => setShowMerge((v) => !v)}
                  className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                >
                  {showMerge ? "Annulla unione" : "Unisci con un'altra scheda"}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                >
                  Elimina scheda
                </button>
              </>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
          >
            {saving ? "Salvo…" : "Salva modifiche"}
          </button>
        </div>

        {showMerge && (
          <div className="mt-4 pt-4 border-t border-b58-charcoal/10">
            <p className="text-xs text-b58-charcoal-soft/70 mb-2">
              Le prenotazioni della scheda scelta passano qui, e quella scheda viene eliminata. Operazione non reversibile.
            </p>
            <input
              value={mergeSearch}
              onChange={(e) => setMergeSearch(e.target.value)}
              placeholder="Cerca la scheda da unire…"
              className={`${inputClass} mb-2`}
            />
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {mergeOptions.map((opt) => (
                <li key={opt.id} className="flex items-center justify-between gap-2 bg-white rounded-lg border border-b58-charcoal/10 px-3 py-2">
                  <span className="text-sm text-b58-charcoal">
                    {opt.name || "—"} <span className="text-b58-charcoal-soft">· {opt.phone}</span>
                  </span>
                  <button
                    type="button"
                    disabled={merging}
                    onClick={() => handleMerge(opt.id)}
                    className="text-xs text-b58-terracotta hover:text-b58-terracotta-dark disabled:opacity-60"
                  >
                    Unisci qui
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Storico prenotazioni</h2>
        {reservations.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60">Nessuna prenotazione ancora.</p>
        ) : (
          <ul className="space-y-1.5">
            {reservations.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/calendario-eventi/${r.id}`}
                  className="text-sm text-b58-charcoal hover:text-b58-terracotta flex items-center justify-between"
                >
                  <span>
                    {formatDate(r.reservation_date)} · {r.reservation_time?.slice(0, 5)} · {r.party_size} coperti
                  </span>
                  <span className="text-xs text-b58-charcoal-soft">{labelFor(RESERVATION_STATUSES, r.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
