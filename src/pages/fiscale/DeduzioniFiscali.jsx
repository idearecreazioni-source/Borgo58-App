import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createDeductibleExpense,
  deleteDeductibleExpense,
  updateDeductibleExpense,
} from "../../lib/api/fiscal";
import { listRegoleDeducibilita, listSpeseValorizzate } from "../../lib/api/deducibilita";
import { getEntities } from "../../lib/api/entities";
import { FISCAL_PAYMENT_METHODS, formatDate, formatEUR, labelFor, oggiLocale } from "../../lib/constants";
import { downloadCsv } from "../../lib/csv";
import PrintButton from "../../components/PrintButton";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";

// ⚠️ Questa schermata NON calcola più nessuna quota (15/08/2026). Le regole
// e il calcolo vivono nel database: `listSpeseValorizzate` restituisce ogni
// spesa già valorizzata, con il motivo. Prima le regole stavano in
// `src/lib/constants.js` e il conto in `src/lib/deducibility.js` — cioè in
// JavaScript, nel bundle pubblico, con sopra scritto «unica fonte di
// verità»; costruirci accanto l'attributo del mandato avrebbe dato al
// gestionale due risposte alla stessa domanda.

const currentYear = new Date().getFullYear();
const today = oggiLocale;

const emptyForm = {
  regola_deducibilita_id: "",
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
  const [regole, setRegole] = useState([]);
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
    // ⚠️ Le regole si ricaricano insieme alle spese: se ne nasce una nuova
    // in «Deducibilità», il menu qui non deve restare quello di prima
    // (trappola del 12/08, la lista caricata una volta sola).
    return Promise.all([
      listSpeseValorizzate(entityId, year),
      listRegoleDeducibilita({ soloAttive: true }),
    ]).then(([exp, reg]) => {
      setExpenses(exp);
      setRegole(reg);
      setForm((f) => (f.regola_deducibilita_id ? f : { ...f, regola_deducibilita_id: reg[0]?.id ?? "" }));
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

  const regolaScelta = regole.find((r) => r.id === form.regola_deducibilita_id);

  // Gli avvisi in tempo reale mostrano cosa succederà, ma la quota vera la
  // dice il database quando la riga è salvata — qui non si anticipa un
  // numero, si spiega una regola.
  const avvisoContante =
    regolaScelta?.vieta_contante &&
    form.payment_method === "contante" &&
    !form.exempt_from_cash_rule;
  const avvisoDocumento = !form.document_reference.trim();

  const totali = useMemo(() => {
    const speso = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const deducibile = expenses.reduce((s, e) => s + Number(e.quota), 0);
    const daClassificare = expenses.filter((e) => e.stato === "da_classificare").length;
    return { speso, deducibile, daClassificare };
  }, [expenses]);

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
        regola_deducibilita_id: form.regola_deducibilita_id || null,
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
      setForm({
        ...emptyForm,
        regola_deducibilita_id: form.regola_deducibilita_id,
        expense_date: form.expense_date,
      });
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ⚠️ Correggere invece di «cancella e rifai» (Blocco 5.2): una riga
  // rifatta perde la sua data di registrazione, e quella cancellata resta
  // comunque nel registro delle cancellazioni a raccontare una spesa che
  // non è mai esistita.
  const correggi = async (id, patch) => {
    setError("");
    try {
      await updateDeductibleExpense(id, patch);
      await reload();
    } catch (e) {
      setError(e.message);
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
      { label: "Regola", value: (e) => e.regola ?? "non classificata" },
      { label: "Descrizione", value: (e) => e.description },
      { label: "Importo", value: (e) => e.amount },
      { label: "Pagamento", value: (e) => labelFor(FISCAL_PAYMENT_METHODS, e.payment_method) },
      { label: "Quota deducibile", value: (e) => Number(e.quota).toFixed(2) },
      { label: "Perché", value: (e) => e.motivo },
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
        <Link to="/fiscale" className="tocco-bottone inline-flex items-center text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
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
        regola deriva; il sistema non presenta nessun numero come certo (§6). Le regole si governano da{" "}
        <Link to="/fiscale/deducibilita" className="underline print:hidden">Deducibilità dei costi</Link>.
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4 print:hidden">{error}</p>
      )}

      {/* Riepilogo */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Riepilogo {year}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-b58-charcoal/10">
            <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft">Speso</div>
            <div className="text-lg text-b58-charcoal">{formatEUR(totali.speso)}</div>
          </div>
          <div className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-b58-charcoal/10">
            <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft">Deducibile (stima)</div>
            <div className="text-lg text-b58-charcoal">{formatEUR(totali.deducibile)}</div>
          </div>
          {totali.daClassificare > 0 && (
            <div className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-b58-gold-dark/40">
              <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft">Da classificare</div>
              <div className="text-lg text-b58-gold-dark">{totali.daClassificare}</div>
              <div className="text-xs text-b58-charcoal-soft/70 mt-0.5">non contate nel deducibile</div>
            </div>
          )}
        </div>
        {expenses.length === 0 && (
          <p className="text-sm text-b58-charcoal-soft/60 mt-3">Nessuna spesa registrata per il {year}.</p>
        )}
      </div>

      {/* Nuova spesa */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6 print:hidden">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Nuova spesa</h2>
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <label className={labelClass}>Regola</label>
              <select
                value={form.regola_deducibilita_id}
                onChange={(e) => setForm((f) => ({ ...f, regola_deducibilita_id: e.target.value }))}
                className={inputClass}
              >
                <option value="">— da classificare —</option>
                {regole.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.etichetta} ({Number(r.percentuale_deducibile)}%)
                  </option>
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

          {regolaScelta?.nota && (
            <p className="text-xs text-b58-charcoal-soft/70 mb-3">{regolaScelta.nota}</p>
          )}
          {regolaScelta && !regolaScelta.verificata_il && (
            <p className="text-xs text-b58-gold-dark mb-3">
              Questa regola non è ancora stata confermata dalla commercialista.
            </p>
          )}

          {avvisoContante && (
            <p className="text-xs text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3">
              Pagata in contanti: con questa regola la spesa è <strong>indeducibile</strong>. Se è un biglietto
              di trasporto pubblico di linea o un&apos;indennità chilometrica, spunta l&apos;esenzione qui
              sotto; altrimenti paga con metodo tracciato per poterla dedurre.
            </p>
          )}

          {avvisoDocumento && (
            <p className="text-xs text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3">
              Senza il riferimento al documento questa spesa <strong>non si deduce</strong>, qualunque regola
              le assegni. Puoi registrarla lo stesso — resterà indeducibile finché non aggiungi il documento.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            {regolaScelta?.vieta_contante && (
              <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
                <input
                  type="checkbox"
                  checked={form.exempt_from_cash_rule}
                  onChange={(e) => setForm((f) => ({ ...f, exempt_from_cash_rule: e.target.checked }))}
                  className="accent-b58-terracotta"
                />
                Esente regola contanti (biglietto di linea / km)
              </label>
            )}
            {regolaScelta?.soggetta_a_plafond && (
              <input
                type="number"
                min="1"
                value={form.people_count}
                onChange={(e) => setForm((f) => ({ ...f, people_count: e.target.value }))}
                placeholder="N. persone (annotazione)"
                className={inputClass}
              />
            )}
            <input
              value={form.document_reference}
              onChange={(e) => setForm((f) => ({ ...f, document_reference: e.target.value }))}
              placeholder="Rif. documento"
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
                  <th className="py-2 pr-6 font-medium text-right">Importo</th>
                  <th className="py-2 font-medium text-right">Deducibile</th>
                  <th className="py-2 print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-b58-charcoal/5 last:border-0 align-top">
                    <td className="py-2 text-b58-charcoal-soft whitespace-nowrap">{formatDate(e.expense_date)}</td>
                    <td className="py-2 text-b58-charcoal">
                      {/* Correggibile sul posto: rifarla le cambierebbe la
                          data di registrazione, e la cancellata resterebbe
                          nel registro a raccontare una spesa mai esistita. */}
                      <input
                        defaultValue={e.description}
                        onBlur={(ev) =>
                          ev.target.value.trim() &&
                          ev.target.value.trim() !== e.description &&
                          correggi(e.id, { description: ev.target.value.trim() })
                        }
                        className="w-full max-w-[16rem] rounded border border-transparent hover:border-b58-charcoal/15 focus:border-b58-terracotta px-1 py-0.5 bg-transparent print:border-0"
                      />
                      <span className="text-xs text-b58-charcoal-soft"> · {e.regola ?? "non classificata"}</span>
                      {/* Il motivo arriva dal database insieme alla quota:
                          un numero senza la sua ragione è una scatola nera. */}
                      <div className="text-xs text-b58-charcoal-soft/70">{e.motivo}</div>
                    </td>
                    <td className="py-2 text-b58-charcoal-soft text-xs">
                      {labelFor(FISCAL_PAYMENT_METHODS, e.payment_method)}
                    </td>
                    <td className="py-2 pr-6 text-right text-b58-charcoal-soft whitespace-nowrap">{formatEUR(e.amount)}</td>
                    <td
                      className={`py-2 text-right whitespace-nowrap ${
                        e.stato === "da_classificare"
                          ? "text-b58-gold-dark"
                          : e.stato === "indeducibile"
                            ? "text-b58-terracotta-dark"
                            : "text-b58-charcoal"
                      }`}
                    >
                      {e.stato === "da_classificare" ? "—" : formatEUR(e.quota)}
                    </td>
                    <td className="py-2 text-right print:hidden">
                      <ConfermaDistruttiva
                        etichetta="Rimuovi"
                        cosaSparisce={`la spesa «${e.description}» del ${formatDate(e.expense_date)} da ${formatEUR(e.amount)}`}
                        onConferma={() => handleDelete(e.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-b58-charcoal-soft/70 mt-3">
              La colonna «Deducibile» la calcola il database, non questa pagina. Un trattino vuol dire{" "}
              <strong>non classificata</strong>: non è zero, è che nessuno ha ancora detto se si deduce — e
              infatti non è contata da nessuna parte.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
