import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createEmployee, listEmployees, listExpiringDocuments } from "../../lib/api/personale";
import { getEntities } from "../../lib/api/entities";
import { CONTRACT_TYPES, EMPLOYEE_STATUSES, COMPLIANCE_DOC_TYPES, formatDate, labelFor } from "../../lib/constants";

const emptyForm = { first_name: "", last_name: "", role: "", contract_type: "indeterminato" };

const daysTo = (dateStr) => Math.round((new Date(dateStr) - new Date()) / 86400000);

export default function PersonaleHome() {
  const navigate = useNavigate();
  const [entities, setEntities] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEntities().then(setEntities).catch((e) => setError(e.message));
  }, []);

  const reload = () =>
    Promise.all([listEmployees({ includeInactive }), listExpiringDocuments(60)]).then(([emp, exp]) => {
      setEmployees(emp);
      setExpiring(exp);
    });

  useEffect(() => {
    setLoading(true);
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleAdd = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !entities) return;
    setSaving(true);
    setError("");
    try {
      const emp = await createEmployee({
        entity_id: entities.srls.id,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        role: form.role || null,
        contract_type: form.contract_type,
      });
      navigate(`/personale/${emp.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">Personale & Buste Paga</h1>
          <p className="text-b58-charcoal-soft mt-1">Anagrafica, documenti, ferie, buste paga, mance.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/personale/mance"
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
          >
            Mance
          </Link>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
          >
            {showForm ? "Annulla" : "+ Nuovo dipendente"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {showForm && (
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4 mb-6 flex flex-wrap gap-2 items-end">
          <input
            value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            placeholder="Nome"
            className={`${inputClass} flex-1 min-w-[120px]`}
          />
          <input
            value={form.last_name}
            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            placeholder="Cognome"
            className={`${inputClass} flex-1 min-w-[120px]`}
          />
          <input
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            placeholder="Mansione (opz.)"
            className={`${inputClass} flex-1 min-w-[120px]`}
          />
          <select
            value={form.contract_type}
            onChange={(e) => setForm((f) => ({ ...f, contract_type: e.target.value }))}
            className={inputClass}
          >
            {CONTRACT_TYPES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
            onClick={handleAdd}
            className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
          >
            {saving ? "Creo…" : "Crea"}
          </button>
        </div>
      )}

      {/* Documenti in scadenza */}
      {expiring.length > 0 && (
        <div className="rounded-xl bg-b58-terracotta/5 ring-1 ring-b58-terracotta/30 p-5 mb-6">
          <h2 className="font-display text-base text-b58-charcoal mb-3">Documenti in scadenza (60 giorni)</h2>
          <ul className="space-y-1.5">
            {expiring.map((d) => {
              const days = daysTo(d.expiry_date);
              return (
                <li key={d.id} className="text-sm flex items-center justify-between gap-2">
                  <Link to={`/personale/${d.employee?.id}`} className="text-b58-charcoal hover:text-b58-terracotta">
                    {d.employee?.first_name} {d.employee?.last_name} — {labelFor(COMPLIANCE_DOC_TYPES, d.doc_type)}
                  </Link>
                  <span className={days < 0 ? "text-b58-terracotta-dark font-medium" : "text-b58-charcoal-soft"}>
                    {days < 0 ? `scaduto (${formatDate(d.expiry_date)})` : `${formatDate(d.expiry_date)} (${days}gg)`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg text-b58-charcoal">Dipendenti</h2>
        <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
          Mostra anche cessati
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : employees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">Nessun dipendente ancora.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Mansione</th>
                <th className="px-4 py-3 font-medium">Contratto</th>
                <th className="px-4 py-3 font-medium">Stato</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => navigate(`/personale/${e.id}`)}
                  className="border-b border-b58-charcoal/5 last:border-0 hover:bg-b58-cream-dark/40 cursor-pointer"
                >
                  <td className="px-4 py-3 text-b58-charcoal font-medium">{e.last_name} {e.first_name}</td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">{e.role ?? "—"}</td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">{e.contract_type ? labelFor(CONTRACT_TYPES, e.contract_type) : "—"}</td>
                  <td className="px-4 py-3 text-b58-charcoal-soft">{labelFor(EMPLOYEE_STATUSES, e.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
