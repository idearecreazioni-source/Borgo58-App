import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listStockLots, listStockLotsDisplay } from "../../lib/api/stock";
import { formatDate, formatQta} from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";
import PrintButton from "../../components/PrintButton";

export default function Tracciabilita() {
  const { isTitolare } = useAuth();
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    (isTitolare ? listStockLots() : listStockLotsDisplay())
      .then(setLots)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isTitolare]);

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6 print:hidden">
        <Link to="/magazzino" className="tocco-bottone inline-flex items-center text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Magazzino
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">Tracciabilità lotti</h1>
        <p className="text-b58-charcoal-soft mt-1">
          Ogni consegna registrata, con fornitore, numero di lotto e scadenza (§4 modulo 4/7).
        </p>
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4 print:hidden">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : lots.length === 0 ? (
        <p className="text-sm text-b58-charcoal-soft/60">Nessun lotto registrato ancora.</p>
      ) : (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 overflow-hidden overflow-x-auto print:ring-0 print:bg-transparent">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="px-4 py-3 font-medium">Ingrediente</th>
                <th className="px-4 py-3 font-medium">Fornitore</th>
                <th className="px-4 py-3 font-medium">N. lotto</th>
                <th className="px-4 py-3 font-medium">Ricevuto</th>
                <th className="px-4 py-3 font-medium">Quantità</th>
                <th className="px-4 py-3 font-medium">Rimanente</th>
                <th className="px-4 py-3 font-medium">Scadenza</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((l) => (
                <tr key={l.id} className="border-b border-b58-charcoal/5 last:border-0">
                  <td className="px-4 py-3 text-b58-charcoal font-medium">{l.ingredient?.name}</td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">{l.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">{l.supplier_batch_number ?? "—"}</td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">{formatDate(l.received_at)}</td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">
                    {formatQta(l.quantity_received)} {l.ingredient?.unit}
                  </td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">
                    {formatQta(l.quantity_remaining)} {l.ingredient?.unit}
                  </td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">{formatDate(l.expiry_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
