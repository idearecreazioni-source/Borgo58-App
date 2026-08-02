import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listCustomers } from "../../lib/api/customers";
import { formatDate } from "../../lib/constants";

export default function ClientiList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    listCustomers({ search: search || undefined })
      .then(setCustomers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/calendario-eventi" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Calendario Eventi
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">Clienti</h1>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca per nome o telefono…"
        className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta w-full max-w-sm mb-4"
      />

      {error && <p className="text-sm text-b58-terracotta-dark mb-4">Errore: {error}</p>}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">
            {search
              ? "Nessun cliente corrisponde alla ricerca."
              : "Nessun cliente ancora — le schede si creano da sole alla prima prenotazione con un numero di telefono."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Telefono</th>
                <th className="px-4 py-3 font-medium">Prenotazioni</th>
                <th className="px-4 py-3 font-medium">Ultima</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/calendario-eventi/clienti/${c.id}`)}
                  className="border-b border-b58-charcoal/5 last:border-0 hover:bg-b58-cream-dark/40 cursor-pointer"
                >
                  <td className="px-4 py-3 text-b58-charcoal font-medium">{c.name || "—"}</td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">{c.phone}</td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">{c.stats?.reservation_count ?? 0}</td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">
                    {c.stats?.last_reservation_date ? formatDate(c.stats.last_reservation_date) : "—"}
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
