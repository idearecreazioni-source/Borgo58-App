import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  createEmployeeDocument,
  createEmployeeLeave,
  createPayslip,
  deleteEmployee,
  deleteEmployeeDocument,
  deleteEmployeeLeave,
  deletePayslip,
  getEmployee,
  listEmployeeDocuments,
  listEmployeeLeaves,
  listPayslips,
  updateEmployee,
} from "../../lib/api/personale";
import {
  COMPLIANCE_DOC_TYPES,
  CONTRACT_TYPES,
  EMPLOYEE_STATUSES,
  LEAVE_TYPES,
  formatDate,
  formatEUR,
  labelFor,
} from "../../lib/constants";
import PrintButton from "../../components/PrintButton";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";

const monthLabel = (iso) =>
  new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(iso));

export default function DipendenteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingHeader, setSavingHeader] = useState(false);

  const [docForm, setDocForm] = useState({ doc_type: "idoneita_sanitaria", description: "", expiry_date: "", document_reference: "" });
  const [leaveForm, setLeaveForm] = useState({ leave_type: "ferie", start_date: "", end_date: "", days: "", note: "" });
  const [payForm, setPayForm] = useState({ period_month: "", net_amount: "", gross_amount: "", document_reference: "" });
  const [busy, setBusy] = useState(false);

  const reload = () =>
    Promise.all([
      getEmployee(id),
      listEmployeeDocuments(id),
      listEmployeeLeaves(id),
      listPayslips(id),
    ]).then(([emp, docs, lv, ps]) => {
      setEmployee(emp);
      setDocuments(docs);
      setLeaves(lv);
      setPayslips(ps);
    });

  useEffect(() => {
    setLoading(true);
    reload()
      .catch((e) => {
        if (e.code === "PGRST116") setNotFound(true);
        else setError(e.message);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const setField = (field, value) => setEmployee((e) => ({ ...e, [field]: value }));

  const saveHeader = async () => {
    setSavingHeader(true);
    setError("");
    try {
      const saved = await updateEmployee(id, {
        first_name: employee.first_name,
        last_name: employee.last_name,
        role: employee.role,
        contract_type: employee.contract_type,
        hire_date: employee.hire_date || null,
        end_date: employee.end_date || null,
        status: employee.status,
        phone: employee.phone,
        email: employee.email,
        prior_year_income: employee.prior_year_income === "" ? null : employee.prior_year_income,
        note: employee.note,
      });
      setEmployee(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingHeader(false);
    }
  };

  const addDocument = async () => {
    if (!docForm.doc_type) return;
    setBusy(true);
    setError("");
    try {
      await createEmployeeDocument(id, `${employee.first_name} ${employee.last_name}`, {
        doc_type: docForm.doc_type,
        description: docForm.description || null,
        expiry_date: docForm.expiry_date || null,
        document_reference: docForm.document_reference || null,
      });
      setDocForm({ doc_type: "idoneita_sanitaria", description: "", expiry_date: "", document_reference: "" });
      setDocuments(await listEmployeeDocuments(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeDocument = async (doc) => {
    try {
      await deleteEmployeeDocument(doc.id, doc.task_id);
      setDocuments(await listEmployeeDocuments(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const addLeave = async () => {
    if (!leaveForm.start_date || !leaveForm.end_date) return;
    setBusy(true);
    setError("");
    try {
      await createEmployeeLeave({
        employee_id: id,
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        days: leaveForm.days ? Number(leaveForm.days) : null,
        note: leaveForm.note || null,
      });
      setLeaveForm({ leave_type: "ferie", start_date: "", end_date: "", days: "", note: "" });
      setLeaves(await listEmployeeLeaves(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeLeave = async (leaveId) => {
    try {
      await deleteEmployeeLeave(leaveId);
      setLeaves(await listEmployeeLeaves(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const addPayslip = async () => {
    if (!payForm.period_month) return;
    setBusy(true);
    setError("");
    try {
      await createPayslip({
        employee_id: id,
        period_month: `${payForm.period_month}-01`,
        net_amount: payForm.net_amount ? Number(payForm.net_amount) : null,
        gross_amount: payForm.gross_amount ? Number(payForm.gross_amount) : null,
        document_reference: payForm.document_reference || null,
      });
      setPayForm({ period_month: "", net_amount: "", gross_amount: "", document_reference: "" });
      setPayslips(await listPayslips(id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removePayslip = async (psId) => {
    try {
      await deletePayslip(psId);
      setPayslips(await listPayslips(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await deleteEmployee(id);
      navigate("/personale");
    } catch (e) {
      setError(e.message);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (notFound) return <Navigate to="/personale" replace />;
  if (loading || !employee) {
    return <p className="text-sm text-b58-charcoal-soft max-w-3xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link to="/personale" className="tocco-bottone inline-flex items-center text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Personale
        </Link>
        <PrintButton label="Esporta dossier PDF" />
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 my-4 print:hidden">{error}</p>
      )}

      {/* Anagrafica */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mt-3 mb-6">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <input
            value={employee.last_name}
            onChange={(e) => setField("last_name", e.target.value)}
            className="font-display text-xl text-b58-charcoal bg-transparent border-b border-transparent hover:border-b58-charcoal/20 focus:border-b58-terracotta focus:outline-none"
          />
          <input
            value={employee.first_name}
            onChange={(e) => setField("first_name", e.target.value)}
            className="font-display text-xl text-b58-charcoal bg-transparent border-b border-transparent hover:border-b58-charcoal/20 focus:border-b58-terracotta focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className={labelClass}>Mansione</label>
            <input value={employee.role ?? ""} onChange={(e) => setField("role", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Contratto</label>
            <select value={employee.contract_type ?? ""} onChange={(e) => setField("contract_type", e.target.value)} className={inputClass}>
              <option value="">—</option>
              {CONTRACT_TYPES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Stato</label>
            <select value={employee.status} onChange={(e) => setField("status", e.target.value)} className={inputClass}>
              {EMPLOYEE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <label className={labelClass}>Assunzione</label>
            <input type="date" value={employee.hire_date ?? ""} onChange={(e) => setField("hire_date", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Cessazione</label>
            <input type="date" value={employee.end_date ?? ""} onChange={(e) => setField("end_date", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Telefono</label>
            <input value={employee.phone ?? ""} onChange={(e) => setField("phone", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input value={employee.email ?? ""} onChange={(e) => setField("email", e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="mb-4 max-w-xs">
          <label className={labelClass}>Reddito anno precedente €</label>
          <input
            type="number"
            step="0.01"
            value={employee.prior_year_income ?? ""}
            onChange={(e) => setField("prior_year_income", e.target.value)}
            className={inputClass}
          />
          <p className="text-[11px] text-b58-charcoal-soft/70 mt-1">Per il regime mance (soglia 75.000€, tetto 30% — §6).</p>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
          {confirmDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-b58-terracotta-dark">Eliminare tutto (documenti, ferie, buste paga)?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-b58-terracotta text-b58-parchment px-3 py-1.5 disabled:opacity-60"
              >
                {deleting ? "Elimino…" : "Sì, elimina"}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-b58-charcoal-soft hover:text-b58-charcoal px-2 py-1.5">
                Annulla
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
            >
              Elimina dipendente
            </button>
          )}
          <button
            onClick={saveHeader}
            disabled={savingHeader}
            className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
          >
            {savingHeader ? "Salvo…" : "Salva anagrafica"}
          </button>
        </div>
      </div>

      {/* Documenti compliance */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Documenti e scadenze</h2>
        {documents.length > 0 && (
          <ul className="space-y-2 mb-4">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 text-sm bg-white rounded-lg border border-b58-charcoal/10 px-3 py-2">
                <div>
                  <span className="text-b58-charcoal font-medium">{labelFor(COMPLIANCE_DOC_TYPES, d.doc_type)}</span>
                  {d.description && <span className="text-b58-charcoal-soft"> · {d.description}</span>}
                  {d.expiry_date && <span className="text-b58-charcoal-soft"> · scade {formatDate(d.expiry_date)}</span>}
                  {d.document_reference && <div className="text-xs text-b58-charcoal-soft">Rif.: {d.document_reference}</div>}
                </div>
                <ConfermaDistruttiva
                  etichetta="Rimuovi"
                  cosaSparisce={`il documento «${labelFor(COMPLIANCE_DOC_TYPES, d.doc_type)}» e il suo promemoria in Agenda`}
                  className="shrink-0 print:hidden"
                  onConferma={() => removeDocument(d)}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 print:hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select value={docForm.doc_type} onChange={(e) => setDocForm((f) => ({ ...f, doc_type: e.target.value }))} className={inputClass}>
              {COMPLIANCE_DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input value={docForm.description} onChange={(e) => setDocForm((f) => ({ ...f, description: e.target.value }))} placeholder="Descrizione (opz.)" className={inputClass} />
            <input type="date" value={docForm.expiry_date} onChange={(e) => setDocForm((f) => ({ ...f, expiry_date: e.target.value }))} className={inputClass} />
            <input value={docForm.document_reference} onChange={(e) => setDocForm((f) => ({ ...f, document_reference: e.target.value }))} placeholder="Rif. file (opz.)" className={inputClass} />
          </div>
          <div className="flex justify-end mt-2">
            <button type="button" disabled={busy} onClick={addDocument} className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60">
              + Aggiungi documento
            </button>
          </div>
          <p className="text-[11px] text-b58-charcoal-soft/70 mt-2">Con una scadenza, viene creato un promemoria in Agenda.</p>
        </div>
      </div>

      {/* Ferie / permessi */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Ferie e permessi</h2>
        {leaves.length > 0 && (
          <ul className="space-y-1.5 mb-4">
            {leaves.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-b58-charcoal-soft">
                  <span className="text-b58-charcoal">{labelFor(LEAVE_TYPES, l.leave_type)}</span> · {formatDate(l.start_date)} → {formatDate(l.end_date)}
                  {l.days ? ` · ${l.days} gg` : ""}
                  {l.note ? ` · ${l.note}` : ""}
                </span>
                <ConfermaDistruttiva
                  etichetta="Rimuovi"
                  cosaSparisce={`${labelFor(LEAVE_TYPES, l.leave_type)} dal ${formatDate(l.start_date)} al ${formatDate(l.end_date)}`}
                  className="shrink-0 print:hidden"
                  onConferma={() => removeLeave(l.id)}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 print:hidden flex flex-wrap gap-2 items-end">
          <select value={leaveForm.leave_type} onChange={(e) => setLeaveForm((f) => ({ ...f, leave_type: e.target.value }))} className={inputClass + " w-32"}>
            {LEAVE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <input type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm((f) => ({ ...f, start_date: e.target.value }))} className={inputClass + " w-40"} />
          <input type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm((f) => ({ ...f, end_date: e.target.value }))} className={inputClass + " w-40"} />
          <input type="number" step="0.5" value={leaveForm.days} onChange={(e) => setLeaveForm((f) => ({ ...f, days: e.target.value }))} placeholder="Giorni" className={inputClass + " w-24"} />
          <button type="button" disabled={busy || !leaveForm.start_date || !leaveForm.end_date} onClick={addLeave} className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60">
            + Aggiungi
          </button>
        </div>
      </div>

      {/* Buste paga */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-1">Buste paga</h2>
        <p className="text-[11px] text-b58-charcoal-soft/70 mb-4">
          Archivio: le buste paga le calcola il Consulente del Lavoro, qui si conservano importi e riferimento.
        </p>
        {payslips.length > 0 && (
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="py-2 font-medium">Mese</th>
                <th className="py-2 font-medium text-right">Lordo</th>
                <th className="py-2 font-medium text-right">Netto</th>
                <th className="py-2 print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {payslips.map((p) => (
                <tr key={p.id} className="border-b border-b58-charcoal/5 last:border-0">
                  <td className="py-2 text-b58-charcoal capitalize">{monthLabel(p.period_month)}</td>
                  <td className="py-2 text-right text-b58-charcoal-soft">{p.gross_amount != null ? formatEUR(p.gross_amount) : "—"}</td>
                  <td className="py-2 text-right text-b58-charcoal">{p.net_amount != null ? formatEUR(p.net_amount) : "—"}</td>
                  <td className="py-2 text-right print:hidden">
                    <ConfermaDistruttiva
                      etichetta="Rimuovi"
                      cosaSparisce={`la busta paga di ${monthLabel(p.period_month)}`}
                      onConferma={() => removePayslip(p.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 print:hidden flex flex-wrap gap-2 items-end">
          <input type="month" value={payForm.period_month} onChange={(e) => setPayForm((f) => ({ ...f, period_month: e.target.value }))} className={inputClass + " w-44"} />
          <input type="number" step="0.01" value={payForm.gross_amount} onChange={(e) => setPayForm((f) => ({ ...f, gross_amount: e.target.value }))} placeholder="Lordo €" className={inputClass + " w-28"} />
          <input type="number" step="0.01" value={payForm.net_amount} onChange={(e) => setPayForm((f) => ({ ...f, net_amount: e.target.value }))} placeholder="Netto €" className={inputClass + " w-28"} />
          <input value={payForm.document_reference} onChange={(e) => setPayForm((f) => ({ ...f, document_reference: e.target.value }))} placeholder="Rif. file (opz.)" className={inputClass + " flex-1 min-w-[120px]"} />
          <button type="button" disabled={busy || !payForm.period_month} onClick={addPayslip} className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60">
            + Aggiungi
          </button>
        </div>
      </div>
    </div>
  );
}
