import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getFiscalSettings, upsertFiscalSettings } from "../../lib/api/fiscal";
import { getEntities } from "../../lib/api/entities";
import { formatEUR } from "../../lib/constants";

export default function SimulatoreFiscale() {
  const [entities, setEntities] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [settings, setSettings] = useState({ annual_revenue_estimate: "", ires_rate: 24, irap_rate: 3.9 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [error, setError] = useState("");

  // Input del simulatore (non persistiti: sono ipotesi "what-if")
  const [salesTaxable, setSalesTaxable] = useState("");
  const [salesVatRate, setSalesVatRate] = useState(10);
  const [purchasesTaxable, setPurchasesTaxable] = useState("");
  const [purchasesVatRate, setPurchasesVatRate] = useState(10);
  const [estimatedProfit, setEstimatedProfit] = useState("");

  useEffect(() => {
    getEntities()
      .then((ent) => {
        setEntities(ent);
        setEntityId(ent.srls.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    getFiscalSettings(entityId)
      .then((s) => {
        if (s) setSettings({ annual_revenue_estimate: s.annual_revenue_estimate ?? "", ires_rate: s.ires_rate, irap_rate: s.irap_rate });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [entityId]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleSaveSettings = async () => {
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      await upsertFiscalSettings(entityId, {
        annualRevenueEstimate: settings.annual_revenue_estimate ? Number(settings.annual_revenue_estimate) : null,
        iresRate: Number(settings.ires_rate),
        irapRate: Number(settings.irap_rate),
      });
      setSavedMsg("Impostazioni salvate.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const iva = useMemo(() => {
    const debito = (Number(salesTaxable) || 0) * (Number(salesVatRate) || 0) / 100;
    const credito = (Number(purchasesTaxable) || 0) * (Number(purchasesVatRate) || 0) / 100;
    return { debito, credito, saldo: debito - credito };
  }, [salesTaxable, salesVatRate, purchasesTaxable, purchasesVatRate]);

  // ⚠️ L'IRES sull'utile è corretta. L'IRAP no: ha una base sua — il
  // valore della produzione netta — in cui alcune voci non si scalano
  // come per l'IRES, a partire dagli interessi e da parte del costo del
  // lavoro. Per un'osteria con dipendenti quella base è tipicamente più
  // ALTA dell'utile, quindi il numero qui sotto è ottimista in modo
  // sistematico: non «approssimato», storto sempre nella stessa
  // direzione. Non si inventa una formula: si dichiara e si chiede a
  // Laura (rilievo 2 del referto del 13/08/2026).
  const imposte = useMemo(() => {
    const profit = Number(estimatedProfit) || 0;
    const ires = profit * (Number(settings.ires_rate) || 0) / 100;
    const irap = profit * (Number(settings.irap_rate) || 0) / 100;
    return { ires, irap, totale: ires + irap };
  }, [estimatedProfit, settings.ires_rate, settings.irap_rate]);

  if (loading) {
    return <p className="text-sm text-b58-charcoal-soft max-w-4xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/fiscale" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Proiezione fiscale
        </Link>
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
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-1">Simulatore fiscale</h1>
      <p className="text-xs text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 my-4">
        Stima trasparente basata sugli importi che inserisci tu — non un dato certo estratto dalla contabilità.
        Serve a farsi un'idea degli ordini di grandezza. I numeri veri li determina Laura sulla contabilità
        reale (§6).
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* Impostazioni (persistite) */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Parametri</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className={labelClass}>Ricavi annui stimati €</label>
            <input
              type="number"
              step="0.01"
              value={settings.annual_revenue_estimate}
              onChange={(e) => setSettings((s) => ({ ...s, annual_revenue_estimate: e.target.value }))}
              className={inputClass}
            />
            <p className="text-[11px] text-b58-charcoal-soft/70 mt-1">Base del plafond rappresentanza (deduzioni).</p>
          </div>
          <div>
            <label className={labelClass}>Aliquota IRES %</label>
            <input
              type="number"
              step="0.1"
              value={settings.ires_rate}
              onChange={(e) => setSettings((s) => ({ ...s, ires_rate: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Aliquota IRAP %</label>
            <input
              type="number"
              step="0.1"
              value={settings.irap_rate}
              onChange={(e) => setSettings((s) => ({ ...s, irap_rate: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
          >
            {saving ? "Salvo…" : "Salva parametri"}
          </button>
          {savedMsg && <span className="text-xs text-b58-olive-dark">{savedMsg}</span>}
        </div>
      </div>

      {/* Simulatore IVA */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">IVA di periodo (stima)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className={labelClass}>Imponibile vendite €</label>
            <input type="number" step="0.01" value={salesTaxable} onChange={(e) => setSalesTaxable(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Aliquota vendite %</label>
            <input type="number" step="0.1" value={salesVatRate} onChange={(e) => setSalesVatRate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Imponibile acquisti €</label>
            <input type="number" step="0.01" value={purchasesTaxable} onChange={(e) => setPurchasesTaxable(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Aliquota acquisti %</label>
            <input type="number" step="0.1" value={purchasesVatRate} onChange={(e) => setPurchasesVatRate(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="text-sm space-y-1">
          <div className="flex justify-between text-b58-charcoal-soft">
            <span>IVA a debito (sulle vendite)</span><span>{formatEUR(iva.debito)}</span>
          </div>
          <div className="flex justify-between text-b58-charcoal-soft">
            <span>IVA a credito (sugli acquisti)</span><span>−{formatEUR(iva.credito)}</span>
          </div>
          <div className="flex justify-between text-b58-charcoal font-medium pt-1 border-t border-b58-charcoal/10">
            <span>{iva.saldo >= 0 ? "IVA da versare (stima)" : "Credito IVA (stima)"}</span>
            <span>{formatEUR(Math.abs(iva.saldo))}</span>
          </div>
        </div>
        <p className="text-[11px] text-b58-charcoal-soft/70 mt-3">
          Semplificazione: una sola aliquota media per lato. La ristorazione ha aliquote diverse (10% sul cibo,
          22% su alcolici e altro) e regole di detraibilità/pro-rata che qui non sono modellate. Per l'IVA reale
          serve la contabilità completa.
        </p>
      </div>

      {/* Simulatore IRES/IRAP */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">IRES / IRAP (stima)</h2>
        <div className="mb-4 max-w-xs">
          <label className={labelClass}>Utile imponibile stimato €</label>
          <input type="number" step="0.01" value={estimatedProfit} onChange={(e) => setEstimatedProfit(e.target.value)} className={inputClass} />
        </div>
        <div className="text-sm space-y-1">
          <div className="flex justify-between text-b58-charcoal-soft">
            <span>IRES ({settings.ires_rate}%)</span><span>{formatEUR(imposte.ires)}</span>
          </div>
          <div className="flex justify-between text-b58-charcoal-soft">
            <span>IRAP ({settings.irap_rate}%)</span><span>{formatEUR(imposte.irap)}</span>
          </div>
          <p className="text-[11px] text-b58-terracotta-dark bg-b58-terracotta/10 rounded px-2 py-1.5">
            <strong>L&apos;IRAP qui è calcolata sull&apos;utile, come l&apos;IRES: è una
            semplificazione.</strong> L&apos;IRAP ha una base sua, in cui alcune voci — interessi e
            parte del costo del lavoro — non si scalano come per l&apos;IRES. Con dipendenti quella
            base è di solito più alta dell&apos;utile, quindi <strong>questo numero tende a essere
            più basso del vero</strong>. Da chiarire con Laura prima di usarlo per decidere
            qualcosa.
          </p>
          <div className="flex justify-between text-b58-charcoal font-medium pt-1 border-t border-b58-charcoal/10">
            <span>Totale imposte stimate</span><span>{formatEUR(imposte.totale)}</span>
          </div>
        </div>
        <p className="text-[11px] text-b58-charcoal-soft/70 mt-3">
          Semplificazione forte: l'IRAP non si calcola sull'utile ma sul valore della produzione (con basi e
          deduzioni proprie), e l'imponibile IRES parte dall'utile civilistico con variazioni fiscali. Questa è
          solo una proiezione di massima.
        </p>
      </div>
    </div>
  );
}
