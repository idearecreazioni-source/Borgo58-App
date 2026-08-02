import { useEffect, useMemo, useState } from "react";
import { createSupplierInvoice, deleteSupplierInvoice, listSupplierInvoices, markInvoicePaid } from "../../lib/api/supplierInvoices";
import { listSuppliers } from "../../lib/api/suppliers";
import { getEntities } from "../../lib/api/entities";
import { PAYMENT_METHODS, formatDate, formatEUR, labelFor } from "../../lib/constants";

const emptyForm = {
  entity_id: "",
  supplier_id: "",
  invoice_number: "",
  invoice_date: "",
  due_date: "",
  amount: "",
  document_reference: "",
  note: "",
};

// Stesso criterio di urgenza già usato in Magazzino per le scadenze.
const dueUrgency = (dateStr) => {
  if (!dateStr) return "neutral";
  const days = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
  if (days < 3) return "danger";
  if (days < 7) return "warning";
  return "neutral";
};

export default function FattureFornitoriHome() {
  const [invoices, setInvoices] = useState([]);
  const [entities, setEntities] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [payingId, setPayingId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("bonifico");
  const [paying, setPaying] = useState(false);

  const load = async () => {
    const ent = await getEntities();
    setEntities(ent);
    setForm((f) => (f.entity_id ? f : { ...f, entity_id: ent.srls.id }));
    const [inv, sup] = await Promise.all([listSupplierInvoices(), listSuppliers(ent.srls.id)]);
    setInvoices(inv);
    setSuppliers(sup);
  };

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const daPagare = useMemo(() => invoices.filter((i) => i.status === "da_pagare"), [invoices]);
  const pagate = useMemo(() => invoices.filter((i) => i.status === "pagata"), [invoices]);
  const totaleDaPagare = useMemo(() => daPagare.reduce((sum, i) => sum + Number(i.amount), 0), [daPagare]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleEntityChange = async (entityId) => {
    setForm((f) => ({ ...f, entity_id: entityId, supplier_id: "" }));
    setSuppliers(await listSuppliers(entityId));
  };

  const handleAdd = async () => {
    if (!form.supplier_id || !form.invoice_date || !form.amount) return;
    setSaving(true);
    setError("");
    try {
      await createSupplierInvoice({
        entityId: form.entity_id,
        supplierId: form.supplier_id,
        invoiceNumber: form.invoice_number,
        invoiceDate: form.invoice_date,
        dueDate: form.due_date,
        amount: Number(form.amount),
        documentReference: form.document_reference,
        note: form.note,
      });
      setForm((f) => ({ ...emptyForm, entity_id: f.entity_id }));
      setInvoices(await listSupplierInvoices());
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async (id) => {
    setPaying(true);
    setError("");
    try {
      await markInvoicePaid(id, { paymentMethod });
      setPayingId(null);
      setInvoices(await listSupplierInvoices());
    } catch (e) {
      setError(e.message);
    } finally {
      setPaying(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteSupplierInvoice(id);
      setInvoices(await listSupplierInvoices());
    } catch (e) {
      setError(e.message);
    }
  };

  if (loading) {
    return <p className="text-sm text-b58-charcoal-soft max-w-4xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">Fatture Fornitori</h1>
          <p className="text-b58-charcoal-soft mt-1">
            Inserimento manuale — sincronizzazione automatica da attivare in futuro (§3.1).
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl text-b58-charcoal font-medium">{formatEUR(totaleDaPagare)}</div>
          <div className="text-xs text-b58-charcoal-soft">totale da pagare</div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {entities && (
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Nuova fattura</h2>
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <select
              value={form.entity_id}
              onChange={(e) => handleEntityChange(e.target.value)}
              className={inputClass}
            >
              <option value={entities.srls.id}>{entities.srls.name}</option>
              {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
            </select>
            <select
              value={form.supplier_id}
              onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
              className={inputClass}
            >
              <option value="">Fornitore…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              value={form.invoice_number}
              onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
              placeholder="Numero fattura (opz.)"
              className={inputClass}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="Importo €"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <div>
              <label className="block text-[11px] text-b58-charcoal-soft mb-1">Data fattura</label>
              <input
                type="date"
                value={form.invoice_date}
                onChange={(e) => setForm((f) => ({ ...f, invoice_date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-[11px] text-b58-charcoal-soft mb-1">Scadenza (opz.)</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                className={inputClass}
              />
            </div>
            <input
              value={form.document_reference}
              onChange={(e) => setForm((f) => ({ ...f, document_reference: e.target.value }))}
              placeholder="Rif. documento (opz.)"
              className={`${inputClass} self-end`}
            />
            <input
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Nota (opz.)"
              className={`${inputClass} self-end`}
            />
          </div>
          <p className="text-xs text-b58-charcoal-soft/70 mb-2">
            Con una scadenza, viene creato automaticamente un promemoria in Agenda.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving || !form.supplier_id || !form.invoice_date || !form.amount}
              onClick={handleAdd}
              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
            >
              {saving ? "Registro…" : "+ Registra fattura"}
            </button>
          </div>
        </div>
      </div>
      )}

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Da pagare</h2>
        {daPagare.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60">Nessuna fattura da pagare.</p>
        ) : (
          <ul className="space-y-2">
            {daPagare.map((inv) => {
              const urgency = dueUrgency(inv.due_date);
              return (
                <li key={inv.id} className="bg-white rounded-lg border border-b58-charcoal/10 p-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <span className="text-sm text-b58-charcoal font-medium">{inv.supplier.name}</span>
                      {inv.invoice_number && (
                        <span className="text-xs text-b58-charcoal-soft ml-1.5">#{inv.invoice_number}</span>
                      )}
                      <div className="text-xs text-b58-charcoal-soft">
                        {formatDate(inv.invoice_date)}
                        {inv.due_date && (
                          <span
                            className={
                              urgency === "danger"
                                ? "text-b58-terracotta-dark font-medium"
                                : urgency === "warning"
                                ? "text-b58-gold-dark font-medium"
                                : ""
                            }
                          >
                            {" "}
                            · scade {formatDate(inv.due_date)}
                          </span>
                        )}
                      </div>
                      {inv.note && <p className="text-xs text-b58-charcoal-soft mt-1">{inv.note}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-b58-charcoal font-medium">{formatEUR(inv.amount)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setPayingId((id) => (id === inv.id ? null : inv.id));
                          setPaymentMethod("bonifico");
                        }}
                        className="text-xs text-b58-terracotta hover:text-b58-terracotta-dark"
                      >
                        {payingId === inv.id ? "Annulla" : "Segna pagata"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(inv.id)}
                        className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                      >
                        Rimuovi
                      </button>
                    </div>
                  </div>
                  {payingId === inv.id && (
                    <div className="mt-3 pt-3 border-t border-b58-charcoal/10 flex flex-wrap gap-2 items-end">
                      <div className="w-40">
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className={inputClass}
                        >
                          {PAYMENT_METHODS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        disabled={paying}
                        onClick={() => handlePay(inv.id)}
                        className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
                      >
                        {paying ? "Confermo…" : "Conferma pagamento"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pagate.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
          <h2 className="font-display text-lg text-b58-charcoal mb-4">Pagate di recente</h2>
          <ul className="space-y-1.5">
            {pagate.map((inv) => (
              <li key={inv.id} className="text-sm text-b58-charcoal-soft flex items-center justify-between gap-2">
                <span>
                  <span className="text-b58-charcoal">{inv.supplier.name}</span>
                  {inv.invoice_number && ` #${inv.invoice_number}`}
                  {inv.paid_at && ` — ${formatDate(inv.paid_at)}`}
                  {inv.payment_method && ` · ${labelFor(PAYMENT_METHODS, inv.payment_method)}`}
                </span>
                <span className="text-b58-charcoal">{formatEUR(inv.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
