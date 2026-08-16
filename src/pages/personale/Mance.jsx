import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createTipCollected,
  manceDaDistribuire,
  createTipDistribution,
  deleteTipCollected,
  deleteTipDistribution,
  getTipsBalance,
  listEmployees,
  listTipDistributions,
  listTipsCollected,
  listTipsPerEmployeeYear,
} from "../../lib/api/personale";
import { getEntities } from "../../lib/api/entities";
import {
  MANCE_CAP_RATE,
  MANCE_REGIME_INCOME_THRESHOLD,
  MANCE_SUBSTITUTE_TAX_RATE,
  TIP_MEZZI,
  formatDate,
  formatEUR,
  meseLocale,
  oggiLocale,
} from "../../lib/constants";

const today = oggiLocale;
const thisMonth = meseLocale;
const currentYear = new Date().getFullYear();
const monthLabel = (iso) => new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(new Date(iso));

export default function Mance() {
  const [entities, setEntities] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [balance, setBalance] = useState(null);
  const [collected, setCollected] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tipsYear, setTipsYear] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [collectForm, setCollectForm] = useState({ amount: "", collected_date: today(), mezzo: "contanti", note: "" });
  const [distMezzo, setDistMezzo] = useState("contanti");
  const [daDistribuire, setDaDistribuire] = useState(null);
  const [distMonth, setDistMonth] = useState(thisMonth());
  const [allocations, setAllocations] = useState({}); // employeeId -> amount string
  const [busy, setBusy] = useState(false);

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
      getTipsBalance(entityId),
      listTipsCollected(entityId),
      listTipDistributions(entityId),
      listEmployees(),
      listTipsPerEmployeeYear(currentYear),
      manceDaDistribuire(entityId),
    ]).then(([bal, coll, dist, emp, ty, dd]) => {
      setBalance(bal);
      setCollected(coll);
      setDistributions(dist);
      setEmployees(emp);
      setTipsYear(ty);
      setDaDistribuire(dd);
    });
  };

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  const tipsYearByEmployee = useMemo(() => {
    const map = {};
    tipsYear.forEach((r) => { map[r.employee_id] = Number(r.total_received); });
    return map;
  }, [tipsYear]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleCollect = async () => {
    if (!collectForm.amount || Number(collectForm.amount) <= 0) return;
    setBusy(true);
    setError("");
    try {
      // 🔴 Qui mancava `mezzo` (validazione del 16/08): il menu c'era e si
      // vedeva, ma il valore non arrivava al database, che applicava il
      // predefinito «contanti». Ogni mancia su carta entrava nel contante
      // atteso del cassetto senza esserci fisicamente. Ora l'elenco dei
      // campi vive in `payloadMancia`, dove una prova lo può controllare.
      await createTipCollected({
        entityId,
        amount: collectForm.amount,
        collectedDate: collectForm.collected_date,
        mezzo: collectForm.mezzo,
        note: collectForm.note,
      });
      setCollectForm({ amount: "", collected_date: today(), mezzo: collectForm.mezzo, note: "" });
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const distributeEqually = () => {
    const active = employees;
    if (active.length === 0) return;
    const pool = Number(balance?.balance) || 0;
    const each = Math.floor((pool / active.length) * 100) / 100;
    const next = {};
    active.forEach((e) => { next[e.id] = String(each); });
    setAllocations(next);
  };

  const allocationTotal = useMemo(
    () => Object.values(allocations).reduce((s, v) => s + (Number(v) || 0), 0),
    [allocations]
  );

  const handleRegisterDistribution = async () => {
    const lines = employees
      .map((e) => ({ employee_id: e.id, amount: allocations[e.id] }))
      .filter((l) => Number(l.amount) > 0);
    if (lines.length === 0) return;
    setBusy(true);
    setError("");
    try {
      await createTipDistribution({
        entityId,
        periodMonth: `${distMonth}-01`,
        lines,
        mezzo: distMezzo,
      });
      setAllocations({});
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDistribution = async (id) => {
    try {
      await deleteTipDistribution(id);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDeleteCollected = async (id) => {
    try {
      await deleteTipCollected(id);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  // Verifica regime (§6) per un dipendente, data l'allocazione proposta.
  const regimeCheck = (emp) => {
    const income = Number(emp.prior_year_income) || 0;
    const already = tipsYearByEmployee[emp.id] || 0;
    const proposed = Number(allocations[emp.id]) || 0;
    if (income === 0) return { level: "unknown", msg: "Reddito anno prec. non impostato: impossibile verificare tetto/soglia." };
    if (income > MANCE_REGIME_INCOME_THRESHOLD) {
      return { level: "danger", msg: `Reddito > ${formatEUR(MANCE_REGIME_INCOME_THRESHOLD)}: regime 5% non applicabile.` };
    }
    const cap = income * MANCE_CAP_RATE;
    const totalAfter = already + proposed;
    if (totalAfter > cap) {
      return { level: "warning", msg: `Oltre il tetto 30% (${formatEUR(cap)}): l'eccedenza non gode del 5%.` };
    }
    return { level: "ok", msg: `Entro il tetto 30% (${formatEUR(cap)}). Sostitutiva 5% ≈ ${formatEUR(proposed * MANCE_SUBSTITUTE_TAX_RATE)}.` };
  };

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/personale" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Personale
        </Link>
        {entities && (
          <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 text-sm text-b58-charcoal">
            <option value={entities.srls.id}>{entities.srls.name}</option>
            {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
          </select>
        )}
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-1">Mance</h1>
      <p className="text-xs text-b58-charcoal-soft/80 mb-6">
        Raccolta quotidiana → monte accumulato → distribuzione mensile. Le verifiche del regime (5%, soglia
        75.000€, tetto 30%) sono un aiuto: il sistema segnala, la decisione e la gestione fiscale restano tue e
        del Consulente del Lavoro (§6).
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          {/* Monte */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft mb-1">Monte mance da distribuire</div>
            <div className="text-2xl text-b58-charcoal font-medium">{balance ? formatEUR(balance.balance) : "—"}</div>
            {balance && (
              <div className="text-[11px] text-b58-charcoal-soft mt-1">
                raccolte {formatEUR(balance.collected)} − distribuite {formatEUR(balance.distributed)}
              </div>
            )}
          </div>

          {/* Raccolta */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <h2 className="font-display text-lg text-b58-charcoal mb-4">Raccolta</h2>
            <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 flex flex-wrap gap-2 items-end mb-4">
              <input type="number" step="0.01" min="0" value={collectForm.amount} onChange={(e) => setCollectForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Importo €" className={inputClass + " w-32"} />
              <input type="date" value={collectForm.collected_date} onChange={(e) => setCollectForm((f) => ({ ...f, collected_date: e.target.value }))} className={inputClass + " w-40"} />
              {/* ⚠️ Dove sono finiti quei soldi: in contanti restano nel
                  cassetto, su carta arrivano in banca con gli incassi.
                  Senza, il conteggio del cassetto mostrerebbe
                  un'eccedenza cronica. */}
              <select value={collectForm.mezzo} onChange={(e) => setCollectForm((f) => ({ ...f, mezzo: e.target.value }))} className={inputClass + " w-32"}>
                {TIP_MEZZI.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
              </select>
              <input value={collectForm.note} onChange={(e) => setCollectForm((f) => ({ ...f, note: e.target.value }))} placeholder="Nota (opz.)" className={inputClass + " flex-1 min-w-[120px]"} />
              <button type="button" disabled={busy || !collectForm.amount} onClick={handleCollect} className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60">
                + Registra raccolta
              </button>
            </div>
            {collected.length > 0 && (
              <ul className="space-y-1 text-sm max-h-40 overflow-y-auto">
                {collected.slice(0, 20).map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-b58-charcoal-soft">
                    <span>{formatDate(c.collected_date)} · {formatEUR(c.amount)}{c.note ? ` · ${c.note}` : ""}</span>
                    <button onClick={() => handleDeleteCollected(c.id)} className="text-xs hover:text-b58-terracotta-dark">Rimuovi</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ⚠️ Le mance non sono ricavi del locale: sono dei collaboratori,
              e finché non sono distribuite la società le TIENE. Quelle in
              contanti stanno fisicamente nel cassetto — per questo il saldo
              di cassa le comprende e dichiara che non sono sue. */}
          {daDistribuire && Number(daDistribuire.totale) > 0 && (
            <div className="rounded-xl bg-b58-gold/10 ring-1 ring-b58-gold-dark/30 p-6 mb-6">
              <h2 className="font-display text-lg text-b58-charcoal mb-1">Da distribuire</h2>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-b58-charcoal mb-2">
                <span>
                  Nel cassetto:{" "}
                  <strong>{formatEUR(daDistribuire.in_contanti)}</strong>
                </span>
                <span>
                  In arrivo dalla banca:{" "}
                  <strong>{formatEUR(daDistribuire.su_carta)}</strong>
                </span>
              </div>
              <p className="text-[11px] text-b58-charcoal-soft leading-relaxed">
                {daDistribuire.avvertenza}
              </p>
            </div>
          )}

          {/* Distribuzione */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <h2 className="font-display text-lg text-b58-charcoal mb-4">Distribuzione mensile</h2>
            {employees.length === 0 ? (
              <p className="text-sm text-b58-charcoal-soft/60">Aggiungi dei dipendenti attivi per distribuire le mance.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 items-end mb-4">
                  <div>
                    <label className="block text-xs text-b58-charcoal-soft mb-1">Mese</label>
                    <input type="month" value={distMonth} onChange={(e) => setDistMonth(e.target.value)} className={inputClass + " w-44"} />
                  </div>
                  <div>
                    {/* Con che soldi paghi: il gestionale non lo indovina,
                        perché un'ipotesi qui sposterebbe il saldo del
                        cassetto senza che nessuno l'abbia deciso. */}
                    <label className="block text-xs text-b58-charcoal-soft mb-1">Paghi con</label>
                    <select value={distMezzo} onChange={(e) => setDistMezzo(e.target.value)} className={inputClass + " w-36"}>
                      {TIP_MEZZI.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
                    </select>
                  </div>
                  <button type="button" onClick={distributeEqually} className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark text-b58-charcoal text-sm px-4 py-2">
                    Dividi equamente il monte
                  </button>
                </div>

                <div className="space-y-2 mb-4">
                  {employees.map((emp) => {
                    const check = allocations[emp.id] ? regimeCheck(emp) : null;
                    const checkColor =
                      check?.level === "danger" ? "text-b58-terracotta-dark"
                        : check?.level === "warning" ? "text-b58-gold-dark"
                          : check?.level === "ok" ? "text-b58-olive-dark"
                            : "text-b58-charcoal-soft";
                    return (
                      <div key={emp.id} className="bg-white rounded-lg border border-b58-charcoal/10 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-b58-charcoal">{emp.last_name} {emp.first_name}</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={allocations[emp.id] ?? ""}
                            onChange={(e) => setAllocations((a) => ({ ...a, [emp.id]: e.target.value }))}
                            placeholder="€"
                            className={inputClass + " w-28"}
                          />
                        </div>
                        {check && <div className={`text-[11px] mt-1 ${checkColor}`}>{check.msg}</div>}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-b58-charcoal-soft">
                    Totale da distribuire: <span className="text-b58-charcoal font-medium">{formatEUR(allocationTotal)}</span>
                    {balance && allocationTotal > Number(balance.balance) && (
                      <span className="text-b58-terracotta-dark"> · supera il monte disponibile</span>
                    )}
                  </span>
                  <button
                    type="button"
                    disabled={busy || allocationTotal <= 0}
                    onClick={handleRegisterDistribution}
                    className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
                  >
                    Registra distribuzione
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Storico distribuzioni */}
          {distributions.length > 0 && (
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
              <h2 className="font-display text-lg text-b58-charcoal mb-4">Distribuzioni effettuate</h2>
              <ul className="space-y-1.5">
                {distributions.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm text-b58-charcoal-soft">
                    <span className="capitalize">{monthLabel(d.period_month)} · {formatEUR(d.total_amount)} · {d.lines?.length ?? 0} dipendenti</span>
                    <button onClick={() => handleDeleteDistribution(d.id)} className="text-xs hover:text-b58-terracotta-dark">Rimuovi</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
