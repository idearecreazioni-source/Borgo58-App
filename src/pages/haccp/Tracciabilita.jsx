import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listStockLots, listStockLotsDisplay } from "../../lib/api/stock";
import { formatDate, formatQta} from "../../lib/constants";
import ElencoAdattivo from "../../components/ElencoAdattivo";
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
        <Link to="/haccp" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
          ← HACCP
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6">
        <h1 className="titolo-documento font-display text-2xl md:text-3xl text-b58-charcoal">Tracciabilità lotti</h1>
        <p className="text-b58-charcoal-soft mt-1">
          Ogni consegna registrata, con fornitore, numero di lotto e scadenza.
        </p>
      </div>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4 print:hidden">
          {error}
        </p>
      )}

      {loading ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
      ) : lots.length === 0 ? (
        <p className="testo-sala-grande text-b58-charcoal-soft/60">Nessun lotto registrato ancora.</p>
      ) : (
        <ElencoAdattivo
          righe={lots}
          chiave={(l) => l.id}
          titolo={(l) => l.ingredient?.name}
          intestazioneTitolo="Ingrediente"
          campi={(l) => [
            { chiave: "fornitore", etichetta: "Fornitore", valore: l.supplier?.name ?? "" },
            { chiave: "lotto", etichetta: "N. lotto", valore: l.supplier_batch_number ?? "" },
            { chiave: "ricevuto", etichetta: "Ricevuto", valore: formatDate(l.received_at) },
            {
              chiave: "quantita",
              etichetta: "Quantità",
              valore: `${formatQta(l.quantity_received)} ${l.ingredient?.unit ?? ""}`,
            },
            {
              chiave: "rimanente",
              etichetta: "Rimanente",
              valore: `${formatQta(l.quantity_remaining)} ${l.ingredient?.unit ?? ""}`,
            },
            { chiave: "scadenza", etichetta: "Scadenza", valore: formatDate(l.expiry_date) },
          ]}
        />
      )}
    </div>
  );
}
