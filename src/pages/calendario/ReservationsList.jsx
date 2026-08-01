import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listReservations } from "../../lib/api/reservations";
import { RESERVATION_STATUSES, RESERVATION_TYPES, formatDate, labelFor } from "../../lib/constants";

const STATUS_BADGE = {
  richiesta_in_attesa: "bg-b58-gold",
  confermata: "bg-b58-olive",
  rifiutata: "bg-b58-terracotta",
  annullata: "bg-b58-charcoal-soft/50",
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ReservationsList() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  // Default: prenotazioni di oggi — la vista utile per preparare la sala.
  const [date, setDate] = useState(todayISO());
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    listReservations({
      search: search || undefined,
      status: status || undefined,
      type: type || undefined,
      date: date || undefined,
    })
      .then(setReservations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, status, type, date]);

  // Totale coperti del giorno filtrato (escluse rifiutate/annullate) — utile
  // per dimensionare la sala.
  const totalCovers = useMemo(
    () =>
      reservations
        .filter((r) => r.status === "confermata" || r.status === "richiesta_in_attesa")
        .reduce((sum, r) => sum + (r.party_size || 0), 0),
    [reservations]
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <h1 className="font-display text-2xl text-b58-charcoal">Calendario Eventi</h1>
        <Link
          to="/calendario-eventi/nuova"
          className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4 py-2 text-sm"
        >
          + Nuova prenotazione
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
        />
        <button
          type="button"
          onClick={() => setDate(todayISO())}
          className="rounded-lg border border-b58-charcoal/15 px-3 py-2 text-sm text-b58-charcoal-soft hover:bg-b58-cream-dark transition-colors"
        >
          Oggi
        </button>
        <button
          type="button"
          onClick={() => setDate("")}
          className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
            date
              ? "border-b58-charcoal/15 text-b58-charcoal-soft hover:bg-b58-cream-dark"
              : "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
          }`}
        >
          Tutte le date
        </button>
        {date && (
          <span className="text-sm text-b58-charcoal-soft">
            {reservations.length} prenotazion{reservations.length === 1 ? "e" : "i"} ·{" "}
            <span className="text-b58-charcoal font-medium">{totalCovers} coperti</span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca cliente (nome, telefono, email)…"
          className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta flex-1 min-w-[220px]"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
        >
          <option value="">Tutti i tipi</option>
          {RESERVATION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
        >
          <option value="">Tutti gli stati</option>
          {RESERVATION_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-b58-terracotta-dark mb-4">Errore: {error}</p>}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : reservations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">
            {date
              ? `Nessuna prenotazione per il ${formatDate(date)}.`
              : search || status || type
                ? "Nessuna prenotazione corrisponde ai filtri."
                : "Nessuna prenotazione ancora."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Ora</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Coperti</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Stato</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/calendario-eventi/${r.id}`)}
                  className="border-b border-b58-charcoal/5 last:border-0 hover:bg-b58-cream-dark/40 cursor-pointer"
                >
                  <td className="px-4 py-3 text-b58-charcoal font-medium">{formatDate(r.reservation_date)}</td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">{r.reservation_time?.slice(0, 5)}</td>
                  <td className="px-4 py-3 text-b58-charcoal">{r.customer_name}</td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">{r.party_size}</td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">{labelFor(RESERVATION_TYPES, r.type)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full ${STATUS_BADGE[r.status]} text-b58-parchment text-[11px] font-medium px-2.5 py-1`}
                    >
                      {labelFor(RESERVATION_STATUSES, r.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
