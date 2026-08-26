import { useEffect, useMemo, useState } from "react";
import Didascalia from "../../components/Didascalia";
import { Link } from "react-router-dom";
import { getFiscalSettings, upsertFiscalSettings } from "../../lib/api/fiscal";
import { getEntities } from "../../lib/api/entities";
import { calcolaImposte } from "../../lib/api/proiezione";
import { formatEUR } from "../../lib/constants";

const VUOTE = {
  annual_revenue_estimate: "",
  ires_rate: 24,
  irap_rate: 3.9,
  maxideduzione_attiva: false,
  maxideduzione_percento: 20,
  acconto_percento: 100,
  acconto_prima_rata_percento: 40,
  parametri_confermati_da_laura: "",
};

export default function SimulatoreFiscale() {
  const [entities, setEntities] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [settings, setSettings] = useState(VUOTE);
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
  const [costoLavoro, setCostoLavoro] = useState("");
  // ⚠️ Le imposte NON si calcolano qui dentro: arrivano dal motore unico
  // del database, lo stesso che usa la Proiezione. Prima questa schermata
  // le calcolava da sé, e sarebbe bastato che la Proiezione facesse
  // altrettanto per avere due risposte diverse alla stessa domanda.
  const [imposte, setImposte] = useState(null);

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
        setSettings(s ? { ...VUOTE, ...s, annual_revenue_estimate: s.annual_revenue_estimate ?? "",
                          parametri_confermati_da_laura: s.parametri_confermati_da_laura ?? "" } : VUOTE);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [entityId]);

  // Il conto si chiede al database mentre si scrive, ma non a ogni tasto.
  useEffect(() => {
    if (!entityId) return;
    const t = setTimeout(() => {
      calcolaImposte(entityId, Number(estimatedProfit) || 0, Number(costoLavoro) || 0)
        .then(setImposte)
        .catch((e) => setError(e.message));
    }, 400);
    return () => clearTimeout(t);
  }, [entityId, estimatedProfit, costoLavoro, savedMsg]);

  const inputClass =
    "w-full tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleSaveSettings = async () => {
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      await upsertFiscalSettings(entityId, {
        annualRevenueEstimate: settings.annual_revenue_estimate ? Number(settings.annual_revenue_estimate) : null,
        iresRate: Number(settings.ires_rate),
        irapRate: Number(settings.irap_rate),
        maxideduzioneAttiva: Boolean(settings.maxideduzione_attiva),
        maxideduzionePercento: Number(settings.maxideduzione_percento),
        accontoPercento: Number(settings.acconto_percento),
        accontoPrimaRataPercento: Number(settings.acconto_prima_rata_percento),
        parametriConfermatiDaLaura: settings.parametri_confermati_da_laura || null,
      });
      setSavedMsg(`Impostazioni salvate alle ${new Date().toLocaleTimeString("it-IT")}.`);
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

  if (loading) {
    return <p className="testo-sala-grande text-b58-charcoal-soft max-w-4xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/fiscale" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Proiezione fiscale
        </Link>
        {entities && (
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="tocco-campo rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 testo-sala-grande text-b58-charcoal"
          >
            <option value={entities.srls.id}>{entities.srls.name}</option>
            {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
          </select>
        )}
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-1">Simulatore fiscale</h1>
      <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 my-4">
        Stima trasparente basata sugli importi che inserisci tu — non un dato certo estratto dalla contabilità.
        Serve a farsi un'idea degli ordini di grandezza. I numeri veri li determina Laura sulla contabilità
        reale.
      </p>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* Impostazioni (persistite) */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">Parametri</h2>
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
            <p className="testo-sala text-b58-charcoal-soft/70 mt-1">Base del plafond rappresentanza (deduzioni).</p>
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

        {/* Agevolazioni e acconti: vivono qui, con le aliquote, perché
            il motore fiscale è uno solo. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3 pt-3 border-t border-b58-charcoal/10">
          <div>
            <label className={labelClass}>Maxi-deduzione del costo del lavoro</label>
            <label className="tocco-campo flex items-center gap-2 testo-sala-grande text-b58-charcoal">
              <input
                type="checkbox"
                checked={Boolean(settings.maxideduzione_attiva)}
                onChange={(e) => setSettings((s) => ({ ...s, maxideduzione_attiva: e.target.checked }))}
                className="accent-b58-terracotta"
              />
              applicala
            </label>
            <p className="testo-sala text-b58-charcoal-soft/70 mt-1">
              Nasce spenta: un&apos;agevolazione applicata da sola abbassa le imposte stimate sempre nella
              stessa direzione. Accendila dopo Laura.
            </p>
          </div>
          <div>
            <label className={labelClass}>Deduzione extra %</label>
            <input
              type="number"
              step="1"
              value={settings.maxideduzione_percento}
              onChange={(e) => setSettings((s) => ({ ...s, maxideduzione_percento: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Confermati da Laura il</label>
            <input
              type="date"
              value={settings.parametri_confermati_da_laura || ""}
              onChange={(e) => setSettings((s) => ({ ...s, parametri_confermati_da_laura: e.target.value }))}
              className={inputClass}
            />
            <p className="testo-sala text-b58-charcoal-soft/70 mt-1">
              Finché è vuota, ogni schermata scrive che è una semplificazione.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <label className={labelClass}>Acconto % dell&apos;imposta</label>
            <input
              type="number"
              step="1"
              value={settings.acconto_percento}
              onChange={(e) => setSettings((s) => ({ ...s, acconto_percento: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Prima rata %</label>
            <input
              type="number"
              step="1"
              value={settings.acconto_prima_rata_percento}
              onChange={(e) => setSettings((s) => ({ ...s, acconto_prima_rata_percento: e.target.value }))}
              className={inputClass}
            />
            <p className="testo-sala text-b58-charcoal-soft/70 mt-1">Il resto va alla seconda scadenza.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60"
          >
            {saving ? "Salvo…" : "Salva parametri"}
          </button>
          {savedMsg && <span className="testo-sala text-b58-olive-dark">{savedMsg}</span>}
        </div>
      </div>

      {/* Simulatore IVA */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">
          IVA di periodo (stima)
          <Didascalia>
            Il conto è imponibile per aliquota, da una parte e dall'altra: quello
            che incassi meno quello che paghi. La ristorazione però ha aliquote
            diverse — 10% sul cibo, 22% su alcolici e altro — e regole di
            detraibilità e pro-rata che qui non sono modellate.
          </Didascalia>
        </h2>
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
        <div className="testo-sala-grande space-y-1">
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
        <p className="testo-sala text-b58-charcoal-soft mt-3">
          ⚠️ Una sola aliquota media per lato: per l'IVA vera serve la contabilità completa.
        </p>
      </div>

      {/* Simulatore IRES/IRAP */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-4">
          IRES / IRAP (stima)
          <Didascalia>
            Il conto lo fa il database, ed è lo stesso che usa la Proiezione:
            non esistono due stime diverse della stessa imposta. Cambiando un
            parametro qui cambia anche là, perché il motore è uno solo.
          </Didascalia>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 max-w-xl">
          <div>
            <label className={labelClass}>Utile imponibile stimato €</label>
            <input type="number" step="0.01" value={estimatedProfit} onChange={(e) => setEstimatedProfit(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Costo del lavoro incrementale €</label>
            <input type="number" step="0.01" value={costoLavoro} onChange={(e) => setCostoLavoro(e.target.value)} className={inputClass} />
            <p className="testo-sala text-b58-charcoal-soft/70 mt-1">
              Serve solo se la maxi-deduzione è accesa.
            </p>
          </div>
        </div>
        {!imposte ? (
          <p className="testo-sala-grande text-b58-charcoal-soft">Calcolo…</p>
        ) : (
        <div className="testo-sala-grande space-y-1">
          {Number(imposte.deduzione_extra) > 0 && (
            <div className="flex justify-between text-b58-charcoal-soft">
              <span>Deduzione extra sul costo del lavoro</span><span>−{formatEUR(imposte.deduzione_extra)}</span>
            </div>
          )}
          <div className="flex justify-between text-b58-charcoal-soft">
            <span>IRES ({imposte.aliquota_ires}%)</span><span>{formatEUR(imposte.ires)}</span>
          </div>
          <div className="flex justify-between text-b58-charcoal-soft">
            <span>IRAP ({imposte.aliquota_irap}%)</span><span>{formatEUR(imposte.irap)}</span>
          </div>
          {/* La frase esce dal database insieme al numero: cosi' non
              possono separarsi, e ogni schermata dice la stessa cosa. */}
          <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded px-2 py-1.5">
            {imposte.avvertenza}
          </p>
          <div className="flex justify-between text-b58-charcoal font-medium pt-1 border-t border-b58-charcoal/10">
            <span>Totale imposte stimate</span><span>{formatEUR(imposte.totale)}</span>
          </div>
        </div>
        )}
        <p className="testo-sala text-b58-charcoal-soft mt-3">
          ⚠️ L&apos;imponibile parte dall&apos;utile civilistico: le variazioni fiscali qui non ci sono.
        </p>
      </div>
    </div>
  );
}
