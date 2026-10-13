import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listStockLots, listStockLotsDisplay } from "../../lib/api/stock";
import { formatDate, formatQta} from "../../lib/constants";
import ElencoAdattivo from "../../components/ElencoAdattivo";
import { useAuth } from "../../context/AuthContext";
import PrintButton from "../../components/PrintButton";
import { filtraLotti } from "../../lib/calcoli/lotti";

export default function Tracciabilita() {
  const { isTitolare } = useAuth();
  const navigate = useNavigate();
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cerca, setCerca] = useState("");

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
          {isTitolare && " Tocca un lotto per vedere dove è finito."}
        </p>
      </div>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4 print:hidden">
          {error}
        </p>
      )}

      <input
        type="search"
        value={cerca}
        onChange={(e) => setCerca(e.target.value)}
        placeholder="Cerca per prodotto, fornitore o numero di lotto…"
        aria-label="Cerca fra i lotti"
        className="tocco-bottone w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 mb-4 testo-sala-grande print:hidden"
      />
      {/* ⚠️ Un foglio stampato con la ricerca accesa NON è l'elenco intero:
          lo dice, sul foglio — chi lo riceve non vede la casella. */}
      {cerca.trim() && (
        <p className="hidden print:block testo-sala mb-2">
          Elenco ristretto alla ricerca «{cerca.trim()}»: non sono tutti i lotti.
        </p>
      )}

      {loading ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
      ) : lots.length === 0 ? (
        <p className="testo-sala-grande text-b58-charcoal-soft/60">Nessun lotto registrato ancora.</p>
      ) : filtraLotti(lots, cerca).length === 0 ? (
        <p className="testo-sala-grande text-b58-charcoal-soft/60">Nessun lotto per «{cerca.trim()}».</p>
      ) : (
        <ElencoAdattivo
          righe={filtraLotti(lots, cerca)}
          chiave={(l) => l.id}
          titolo={(l) => l.ingredient?.name}
          intestazioneTitolo="Ingrediente"
          // DOVE È FINITO (12/10/2026, N6): solo il titolare, perché dice per
          // quali conti è uscita la merce — il database rifiuta lo staff.
          onTocco={isTitolare ? (l) => navigate(`/haccp/tracciabilita/${l.id}`) : undefined}
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
