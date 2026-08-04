import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listRepartoTickets, setItemPrepared } from "../../lib/api/orders";
import { ORDER_DESTINATIONS, labelFor } from "../../lib/constants";

// Sostituto della stampante ESC/POS finché non c'è la postazione locale
// (§3.6): un tablet aperto qui invece di un rotolo di carta. Poll invece di
// realtime — nessuna infrastruttura Supabase Realtime nell'app oggi, e per
// 20-25 coperti/servizio (§3.2) un aggiornamento ogni 10 secondi è più che
// sufficiente.
const POLL_MS = 10000;

export default function RepartoView({ destination }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => listRepartoTickets(destination).then(setTickets).catch((e) => setError(e.message));

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  const togglePrepared = (item) =>
    setItemPrepared(item.id, !item.prepared_at)
      .then(load)
      .catch((e) => setError(e.message));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <Link to="/cassa/comande" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
            ← Comande
          </Link>
          <h1 className="font-display text-2xl text-b58-charcoal mt-1">{labelFor(ORDER_DESTINATIONS, destination)}</h1>
        </div>
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">Nessuna comanda in attesa.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tickets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => togglePrepared(t)}
              className={`text-left rounded-xl ring-1 p-4 transition-opacity ${
                t.prepared_at
                  ? "bg-b58-charcoal/5 ring-b58-charcoal/10 opacity-50"
                  : "bg-b58-parchment ring-b58-charcoal/10"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-base text-b58-charcoal">{t.order.table_label}</span>
                <span className="text-xs text-b58-charcoal-soft">
                  {new Date(t.sent_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="text-sm text-b58-charcoal">
                {t.quantity}× {t.recipe?.name || t.free_text_name}
              </div>
              {t.note && <div className="text-xs text-b58-charcoal-soft italic mt-1">{t.note}</div>}
              <div className="text-[11px] text-b58-charcoal-soft/70 mt-2">
                {t.prepared_at ? "Tocca per riaprire" : "Tocca quando è pronto"}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
