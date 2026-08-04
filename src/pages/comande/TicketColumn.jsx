import { useEffect, useState } from "react";
import { listRepartoTickets, setItemPrepared } from "../../lib/api/orders";
import { ORDER_DESTINATIONS, labelFor } from "../../lib/constants";

// Colonna Cucina/Bar dentro lo schermo unico Comande (§3.2, ridisegno). Poll
// invece di realtime — nessuna infrastruttura Supabase Realtime nell'app
// oggi, e per 20-25 coperti/servizio un aggiornamento ogni 10s basta.
const POLL_MS = 10000;

const HEAD_COLOR = {
  cucina: "bg-b58-terracotta",
  bar: "bg-b58-charcoal",
};

export default function TicketColumn({ destination, refreshKey }) {
  const [tickets, setTickets] = useState([]);

  const load = () => listRepartoTickets(destination).then(setTickets).catch(() => {});

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  // Un invio dalla colonna Sala aggiorna subito questa colonna, senza
  // aspettare il prossimo giro di poll.
  useEffect(() => {
    if (refreshKey) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const togglePrepared = (item) =>
    setItemPrepared(item.id, !item.prepared_at).then(load);

  const open = tickets.filter((t) => !t.prepared_at);
  const done = tickets.filter((t) => t.prepared_at);

  return (
    <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 overflow-hidden flex flex-col h-full">
      <div className={`${HEAD_COLOR[destination]} text-b58-parchment px-4 py-2.5 flex items-center justify-between shrink-0`}>
        <span className="font-display text-sm uppercase tracking-wide">{labelFor(ORDER_DESTINATIONS, destination)}</span>
        <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{open.length}</span>
      </div>
      <div className="p-3 space-y-2 overflow-y-auto flex-1">
        {tickets.length === 0 ? (
          <p className="text-xs text-b58-charcoal-soft/60 text-center py-8">Nessuna comanda in attesa.</p>
        ) : (
          [...open, ...done].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => togglePrepared(t)}
              className={`w-full text-left rounded-lg border px-3 py-2 transition-opacity ${
                t.prepared_at ? "opacity-45 border-b58-charcoal/10 bg-b58-cream-dark" : "border-b58-charcoal/15 bg-b58-parchment"
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-b58-charcoal">{t.order.table_label}</span>
                <span className="text-b58-charcoal-soft">
                  {new Date(t.sent_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <div className="text-sm text-b58-charcoal mt-0.5">
                {t.quantity}× {t.recipe?.name || t.free_text_name}
              </div>
              {t.note && <div className="text-[11px] text-b58-charcoal-soft italic">{t.note}</div>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
