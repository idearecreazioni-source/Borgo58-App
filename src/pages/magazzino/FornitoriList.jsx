import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createSupplier, listSuppliers } from "../../lib/api/suppliers";
import { getEntities } from "../../lib/api/entities";
import { SUPPLIER_CATEGORIES, labelFor } from "../../lib/constants";

const emptyNew = { name: "", category: "", contactPhone: "", isOccasional: false };

export default function FornitoriList() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newSupplier, setNewSupplier] = useState(emptyNew);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const load = () =>
    getEntities()
      // ⚠️ Anche i disattivati: senza, un fornitore spento per sbaglio
      // non ha nessuna schermata da cui tornare (Blocco 5.2).
      .then((e) => listSuppliers(e.srls.id, { includiDisattivati: true }))
      .then(setSuppliers);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = suppliers.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.tax_code || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const entities = await getEntities();
      const created = await createSupplier({
        entityId: entities.srls.id,
        name: newSupplier.name,
        category: newSupplier.category || null,
        contactPhone: newSupplier.contactPhone,
        isOccasional: newSupplier.isOccasional,
      });
      setNewSupplier(emptyNew);
      setShowNew(false);
      navigate(`/magazzino/fornitori/${created.id}`);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  const inputClass =
    "rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/magazzino" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Magazzino
      </Link>

      <div className="flex items-center justify-between gap-4 flex-wrap mt-1 mb-6">
        <h1 className="font-display text-2xl text-b58-charcoal">Fornitori</h1>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment font-medium px-4 py-2 text-sm"
        >
          {showNew ? "Annulla" : "+ Nuovo fornitore"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {showNew && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-4 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              required
              value={newSupplier.name}
              onChange={(e) => setNewSupplier((s) => ({ ...s, name: e.target.value }))}
              placeholder="Ragione sociale"
              className={inputClass}
            />
            <select
              value={newSupplier.category}
              onChange={(e) => setNewSupplier((s) => ({ ...s, category: e.target.value }))}
              className={inputClass}
            >
              <option value="">Categoria</option>
              {SUPPLIER_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              value={newSupplier.contactPhone}
              onChange={(e) => setNewSupplier((s) => ({ ...s, contactPhone: e.target.value }))}
              placeholder="Telefono (opz.)"
              className={inputClass}
            />
          </div>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={newSupplier.isOccasional}
              onChange={(e) => setNewSupplier((s) => ({ ...s, isOccasional: e.target.checked }))}
              className="mt-0.5 shrink-0"
            />
            <span>
              <span className="text-sm text-b58-charcoal">Fornitore occasionale</span>
              <span className="block text-xs text-b58-charcoal-soft/70 mt-0.5">
                Per acquisti non abituali (es. un supermercato in emergenza) — niente condizioni
                di pagamento o giorni di consegna da compilare, solo il minimo per la tracciabilità.
              </span>
            </span>
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-60 transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
          >
            {saving ? "Creo…" : "Crea scheda"}
          </button>
        </form>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cerca per nome o P.IVA…"
        className={`${inputClass} w-full max-w-sm mb-4`}
      />

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">
            {search ? "Nessun fornitore corrisponde alla ricerca." : "Nessun fornitore ancora."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Contatto</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/magazzino/fornitori/${s.id}`)}
                  className={`border-b border-b58-charcoal/5 last:border-0 hover:bg-b58-cream-dark cursor-pointer ${s.active ? "" : "opacity-55"}`}
                >
                  <td className="px-4 py-3 text-b58-charcoal font-medium">
                    {s.name}
                    {!s.active && (
                      <span className="text-[11px] text-b58-charcoal-soft bg-b58-charcoal/10 rounded-full px-2 py-0.5 ml-2">
                        disattivato
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">
                    {s.category ? labelFor(SUPPLIER_CATEGORIES, s.category) : "—"}
                  </td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">
                    {s.contact_phone || s.contact_email || "—"}
                  </td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">
                    {s.is_occasional ? "Occasionale" : "Abituale"}
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
