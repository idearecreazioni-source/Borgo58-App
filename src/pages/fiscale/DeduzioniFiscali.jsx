import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createDeductibleExpense,
  deleteDeductibleExpense,
  getFiscalSettings,
  listDeductibleExpenses,
} from "../../lib/api/fiscal";
import { getEntities } from "../../lib/api/entities";
import { computeDeducibility, expenseCashRuleFails, expenseEligibleAmount } from "../../lib/deducibility";
import {
  DEDUCTION_CATEGORIES,
  FISCAL_PAYMENT_METHODS,
  formatDate,
  formatEUR,
  labelFor,
} from "../../lib/constants";
import { downloadCsv } from "../../lib/csv";
import PrintButton from "../../components/PrintButton";

const currentYear = new Date().getFullYear();
const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  category: "trasferta",
  description: "",
  amount: "",
  expense_date: today(),
  payment_method: "carta",
  exempt_from_cash_rule: false,
  people_count: "",
  document_reference: "",
  business_purpose: "",
  note: "",
};

export default function DeduzioniFiscali() {
  const [entities, setEntities] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [year, setYear] = useState(currentYear);
  const [expenses, setExpenses] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEntities()
      .then((ent) => {
        setEntities(ent);
        setEntityId(ent.srls.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  const reload = () => {
    if (!entityId) return Promise.resolve();
    return Promise.all([
      listDeductibleExpenses({ entityId, year }),
      getFiscalSettings(entityId),
    ]).then(([exp, set]) => {
      setExpenses(exp);
      setSettings(set);
    });
  };

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, year]);

  const annualRevenue = settings?.annual_revenue_estimate ?? null;
  const result = useMemo(
    () => computeDeducibility(expenses, { annualRevenue }),
    [expenses, annualRevenue]
  );

  const currentCatRule = DEDUCTION_CATEGORIES.find((c) => c.value === form.category);
  // Avviso in tempo reale: la spesa che sto inserendo è indeducibile per contanti?
  const formCashWarning =
    currentCatRule?.cashRule && form.payment_method === "contante" && !form.exempt_from_cash_rule;

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleAdd = async () => {
    if (!form.description.trim() || !form.amount || Number(form.amount) <= 0) return;
    setSaving(true);
    setError("");
    try {
      await createDeductibleExpense({
        entity_id: entityId,
        category: form.category,
        description: form.description.trim(),
        amount: Number(form.amount),
        expense_date: form.expense_date,
        payment_method: form.payment_method,
        exempt_from_cash_rule: form.exempt_from_cash_rule,
        people_count: form.people_count ? Number(form.people_count) : null,
        document_reference: form.document_reference || null,
        business_purpose: form.business_purpose || null,
        note: form.note || null,
      });
      setForm({ ...emptyForm, category: form.category, expense_date: form.expense_date });
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDeductibleExpense(id);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleExport = () => {
    downloadCsv(`deduzioni_${year}.csv`, expenses, [
      { label: "Data", value: (e) => e.expense_date },
      { label: "Categoria", value: (e) => labelFor(DEDUCTION_CATEGORIES, e.category) },
      { label: "Descrizione", value: (e) => e.description },
      { label: "Importo", value: (e) => e.amount },
      { label: "Pagamento", value: (e) => labelFor(FISCAL_PAYMENT_METHODS, e.payment_method) },
      { label: "Quota deducibile stimata", value: (e) => expenseEligibleAmount(e).toFixed(2) },
      { label: "Rif. documento", value: (e) => e.document_reference },
      { label: "Finalità", value: (e) => e.business_purpose },
    ]);
  };

  const years = useMemo(() => {
    const set = new Set([currentYear]);
    expenses.forEach((e) => set.add(Number(e.expense_date.slice(0, 4))));
    return Array.from(set).sort((a, b) => b - a);
  }, [expenses]);

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4 print:hidden">
        <Link to="/fiscale" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Proiezione fiscale
        </Link>
        <div className="flex items-center gap-2">
          <PrintButton />
          <button
            onClick={handleExport}
            disabled={expenses.length === 0}
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2 disabled:opacity-40"
          >
            Esporta CSV
          </button>
          {entities && (
            <select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 text-sm text-b58-charcoal"
            >
              <option value={entities.srls.id}>{entities.srls.name}</option>
              {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
            </select>
          )}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 text-sm text-b58-charcoal"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-1">Deduzioni fiscali {year}</h1>
      <p className="text-xs text-b58-charcoal-soft/80 mb-6">
        Stima interna della quota deducibile, sempre da validare con Laura. Ogni importo mostra da quale
        regola deriva; il sistema non presenta nessun numero come certo (§6).
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4 print:hidden">{error}</p>
      )}

      {/* Riepilogo per categoria */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Riepilogo {year}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="py-2 font-medium">Categoria</th>
                <th className="py-2 font-medium text-right">Speso</th>
                <th className="py-2 font-medium text-right">Deducibile (stima)</th>
                <th className="py-2 font-medium">Nota</th>
              </tr>
            </thead>
            <tbody>
              {DEDUCTION_CATEGORIES.map((c) => {
                const b = result.byCat[c.value];
                if (!b || b.count === 0) return null;
                return (
                  <tr key={c.value} className="border-b border-b58-charcoal/5 last:border-0 align-top">
                    <td className="py-2 text-b58-charcoal font-medium">{c.label}</td>
                    <td className="py-2 text-right text-b58-charcoal-soft">{formatEUR(b.total)}</td>
                    <td className="py-2 text-right text-b58-charcoal">{formatEUR(b.deductible)}</td>
                    <td className="py-2 text-xs text-b58-charcoal-soft">
                      {c.rate < 1 && <div>Deducibile al {Math.round(c.rate * 100)}%.</div>}
                      {b.cashExcluded > 0 && (
                        <div className="text-b58-terracotta-dark">
                          {formatEUR(b.cashExcluded)} esclusi: pagati in contanti (regola 2025).
                        </div>
                      )}
                      {c.value === "rappresentanza" && b.plafond != null && (
                        <div>
                          Plafond {formatEUR(b.plafond)} (1,5% ricavi).
                          {b.overPlafond > 0 && (
                            <span className="text-b58-terracotta-dark"> {formatEUR(b.overPlafond)} oltre plafond.</span>
                          )}
                        </div>
                      )}
                      {c.value === "rappresentanza" && b.plafond == null && (
                        <div className="text-b58-gold-dark">Imposta i ricavi stimati nel simulatore per calcolare il plafond.</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-b58-charcoal/15">
                <td className="py-2 font-medium text-b58-charcoal">Totale</td>
                <td className="py-2 text-right text-b58-charcoal-soft">{formatEUR(result.totalSpent)}</td>
                <td className="py-2 text-right text-b58-charcoal font-medium">{formatEUR(result.totalDeductible)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        {expenses.length === 0 && (
          <p className="text-sm text-b58-charcoal-soft/60 mt-2">Nessuna spesa registrata per il {year}.</p>
        )}
      </div>

      {/* Nuova spesa */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6 print:hidden">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Nuova spesa</h2>
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <label className={labelClass}>Categoria</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className={inputClass}
              >
                {DEDUCTION_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Importo €</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Data</label>
              <input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Pagamento</label>
              <select
                value={form.payment_method}
                onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
                className={inputClass}
              >
                {FISCAL_PAYMENT_METHODS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Descrizione"
            className={`${inputClass} mb-3`}
          />

          <p className="text-xs text-b58-charcoal-soft/70 mb-3">{currentCatRule?.note}</p>

          {formCashWarning && (
            <p className="text-xs text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3">
              Pagata in contanti: dal 2025 questa spesa è <strong>indeducibile</strong>. Se è un biglietto di
              trasporto pubblico di linea o un'indennità chilometrica, spunta l'esenzione qui sotto; altrimenti
              paga con metodo tracciato per poterla dedurre.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            {currentCatRule?.cashRule && (
              <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
                <input
                  type="checkbox"
                  checked={form.exempt_from_cash_rule}
                  onChange={(e) => setForm((f) => ({ ...f, exempt_from_cash_rule: e.target.checked }))}
                />
                Esente regola contanti (biglietto di linea / km)
              </label>
            )}
            {form.category === "rappresentanza" && (
              <input
                type="number"
                min="1"
                value={form.people_count}
                onChange={(e) => setForm((f) => ({ ...f, people_count: e.target.value }))}
                placeholder="N. persone (soglia 50€/pers.)"
                className={inputClass}
              />
            )}
            <input
              value={form.document_reference}
              onChange={(e) => setForm((f) => ({ ...f, document_reference: e.target.value }))}
              placeholder="Rif. documento (opz.)"
              className={inputClass}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <input
              value={form.business_purpose}
              onChange={(e) => setForm((f) => ({ ...f, business_purpose: e.target.value }))}
              placeholder="Finalità aziendale (opz., utile in verifica)"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={saving || !form.description.trim() || !form.amount}
              onClick={handleAdd}
              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60 shrink-0"
            >
              {saving ? "Registro…" : "+ Registra"}
            </button>
          </div>
        </div>
      </div>

      {/* Elenco spese */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Spese {year}</h2>
        {loading ? (
          <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
        ) : expenses.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60">Nessuna spesa.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                  <th className="py-2 font-medium">Data</th>
                  <th className="py-2 font-medium">Descrizione</th>
                  <th className="py-2 font-medium">Pagamento</th>
                  <th className="py-2 font-medium text-right">Importo</th>
                  <th className="py-2 font-medium text-right">Deducibile</th>
                  <th className="py-2 print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => {
                  const fails = expenseCashRuleFails(e);
                  return (
                    <tr key={e.id} className="border-b border-b58-charcoal/5 last:border-0">
                      <td className="py-2 text-b58-charcoal-soft">{formatDate(e.expense_date)}</td>
                      <td className="py-2 text-b58-charcoal">
                        {e.description}
                        <span className="text-xs text-b58-charcoal-soft"> · {labelFor(DEDUCTION_CATEGORIES, e.category)}</span>
                      </td>
                      <td className="py-2 text-b58-charcoal-soft text-xs">
                        {labelFor(FISCAL_PAYMENT_METHODS, e.payment_method)}
                      </td>
                      <td className="py-2 text-right text-b58-charcoal-soft">{formatEUR(e.amount)}</td>
                      <td className={`py-2 text-right ${fails ? "text-b58-terracotta-dark" : "text-b58-charcoal"}`}>
                        {fails ? "0 (contanti)" : formatEUR(expenseEligibleAmount(e))}
                      </td>
                      <td className="py-2 text-right print:hidden">
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                        >
                          Rimuovi
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[11px] text-b58-charcoal-soft/70 mt-3">
              La colonna "Deducibile" mostra la quota per singola spesa (con la % di categoria e la regola
              contanti). Per la rappresentanza il plafond è applicato sul totale annuo, non riga per riga —
              vedi il riepilogo in alto.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
