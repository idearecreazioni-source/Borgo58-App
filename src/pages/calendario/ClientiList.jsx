import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createCustomer, listCustomers } from "../../lib/api/customers";
import { formatDate } from "../../lib/constants";
import ElencoAdattivo from "../../components/ElencoAdattivo";

const emptyNew = { name: "", phone: "", email: "" };

export default function ClientiList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newCustomer, setNewCustomer] = useState(emptyNew);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    listCustomers({ search: search || undefined })
      .then(setCustomers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search]);

  // Secondo ingresso previsto da §3.14: finora esisteva solo quello automatico
  // dalla prenotazione, ma un cliente abituale che entra senza prenotare non
  // avrebbe alcuna scheda — e senza scheda non gli si può collegare uno
  // sconto/omaggio (§3.4).
  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await createCustomer(newCustomer);
      setNewCustomer(emptyNew);
      setShowNew(false);
      navigate(`/calendario-eventi/clienti/${created.id}`);
    } catch (e) {
      // Il telefono è la chiave di identificazione (§3.14): un duplicato viola
      // il vincolo unique, e vale la pena dirlo in italiano invece di mostrare
      // il messaggio grezzo di Postgres.
      setError(
        e.code === "23505"
          ? "Esiste già una scheda con questo numero di telefono."
          : e.message
      );
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/calendario-eventi" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Calendario Eventi
      </Link>
      <div className="flex items-center justify-between gap-4 flex-wrap mt-1 mb-6">
        <h1 className="font-display text-2xl text-b58-charcoal">Clienti</h1>
        <div className="flex flex-wrap gap-2">
        <Link
          to="/calendario-eventi/comunicazioni"
          className="tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal font-medium px-4 py-2 testo-sala-grande"
        >
          Scrivere a più clienti
        </Link>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="tocco-campo rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4 py-2 testo-sala-grande"
        >
          {showNew ? "Annulla" : "+ Nuovo cliente"}
        </button>
        </div>
      </div>

      {showNew && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
        >
          <div className="sm:col-span-3">
            <p className="testo-sala text-b58-charcoal-soft/70">
              Per i clienti che non arrivano da una prenotazione. Il numero di telefono è la chiave
              di identificazione: se torna con lo stesso numero, la scheda si riaggancia da sola.
            </p>
          </div>
          <input
            value={newCustomer.name}
            onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))}
            placeholder="Nome"
            className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
          />
          <input
            required
            value={newCustomer.phone}
            onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))}
            placeholder="Telefono"
            className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
          />
          <button
            type="submit"
            disabled={saving}
            className="tocco-campo rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-60 transition-colors text-b58-charcoal testo-sala-grande font-medium px-4 py-2"
          >
            {saving ? "Creo…" : "Crea scheda"}
          </button>
        </form>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca per nome o telefono…"
        className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta w-full max-w-sm mb-4"
      />

      {error && <p className="testo-sala-grande text-b58-terracotta-dark mb-4">Errore: {error}</p>}

      {loading ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
      ) : customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">
            {search
              ? "Nessun cliente corrisponde alla ricerca."
              : "Nessun cliente ancora — le schede si creano da sole alla prima prenotazione con un numero di telefono, oppure a mano qui sopra."}
          </p>
        </div>
      ) : (
        <ElencoAdattivo
          righe={customers}
          chiave={(c) => c.id}
          titolo={(c) => c.name || "—"}
          intestazioneTitolo="Nome"
          onTocco={(c) => navigate(`/calendario-eventi/clienti/${c.id}`)}
          campi={(c) => [
            { chiave: "telefono", etichetta: "Telefono", valore: c.phone },
            {
              chiave: "prenotazioni",
              etichetta: "Prenotazioni",
              valore: String(c.stats?.reservation_count ?? 0),
            },
            {
              chiave: "ultima",
              etichetta: "Ultima",
              valore: c.stats?.last_reservation_date
                ? formatDate(c.stats.last_reservation_date)
                : "",
            },
          ]}
        />
      )}
    </div>
  );
}
