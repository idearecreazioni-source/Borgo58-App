import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  deactivateSupplier,
  riattivaSupplier,
  getSupplier,
  listSupplierDeliveries,
  listSupplierPriceHistory,
  updateSupplier,
} from "../../lib/api/suppliers";
import { listRegoleDeducibilita, setRegolaFornitore } from "../../lib/api/deducibilita";
import { SUPPLIER_CATEGORIES, formatDate, formatEUR } from "../../lib/constants";

export default function FornitoreDetail() {
  const { id } = useParams();
  const [supplier, setSupplier] = useState(null);
  const [prices, setPrices] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [regole, setRegole] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getSupplier(id),
      listSupplierPriceHistory(id),
      listSupplierDeliveries(id),
      listRegoleDeducibilita({ soloAttive: true }).catch(() => []),
    ])
      .then(([s, p, d, r]) => {
        setSupplier(s);
        setPrices(p);
        setDeliveries(d);
        setRegole(r);
      })
      .catch((e) => {
        if (e.code === "PGRST116") setNotFound(true);
        else setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleChange = (field, value) => setSupplier((s) => ({ ...s, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await updateSupplier(id, {
        name: supplier.name,
        category: supplier.category,
        contactPhone: supplier.contact_phone,
        contactEmail: supplier.contact_email,
        contactPerson: supplier.contact_person,
        taxCode: supplier.tax_code,
        paymentTerms: supplier.payment_terms,
        deliveryDays: supplier.delivery_days,
        isOccasional: supplier.is_occasional,
        notes: supplier.notes,
        canaleOrdine: supplier.canale_ordine,
      });
      setSupplier((s) => ({ ...s, ...updated }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      await deactivateSupplier(id);
      setSupplier((s) => ({ ...s, active: false }));
    } catch (e) {
      setError(e.message);
    }
  };

  // ⚠️ La via di ritorno che mancava (Blocco 5.2 del mandato di
  // correzione): l'elenco dei fornitori mostra solo gli attivi, quindi
  // uno disattivato per sbaglio non aveva NESSUNA schermata da cui
  // tornare. L'unico rimedio sarebbe stato crearne uno nuovo con lo
  // stesso nome — e da lì in poi lo storico dei prezzi sarebbe rimasto
  // spezzato fra due fornitori, cioè la sorveglianza dei rincari avrebbe
  // smesso di funzionare su di lui senza dirlo. I tavoli quel ritorno ce
  // l'hanno dal 14/08, i fornitori no.
  const handleReactivate = async () => {
    setError("");
    try {
      await riattivaSupplier(id);
      setSupplier((s) => ({ ...s, active: true }));
    } catch (e) {
      setError(e.message);
    }
  };

  if (notFound) return <Navigate to="/magazzino/fornitori" replace />;
  if (loading || !supplier) {
    return <p className="text-sm text-b58-charcoal-soft max-w-2xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <Link to="/magazzino/fornitori" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Fornitori
      </Link>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 my-4">
          {error}
        </p>
      )}

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mt-3 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <input
            value={supplier.name || ""}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="Ragione sociale"
            className="font-display text-2xl text-b58-charcoal bg-transparent border-b border-transparent hover:border-b58-charcoal/20 focus:border-b58-terracotta focus:outline-none flex-1 min-w-[200px]"
          />
          {!supplier.active && (
            <span className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-b58-charcoal-soft bg-b58-charcoal/10 rounded-full px-2.5 py-1">
                Disattivato
              </span>
              <button
                type="button"
                onClick={handleReactivate}
                className="text-xs text-b58-olive-dark hover:text-b58-charcoal"
              >
                Riaccendilo
              </button>
            </span>
          )}
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={!!supplier.is_occasional}
            onChange={(e) => handleChange("is_occasional", e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>
            <span className="text-sm text-b58-charcoal">Fornitore occasionale</span>
            <span className="block text-xs text-b58-charcoal-soft/70 mt-0.5">
              Niente condizioni di pagamento/giorni di consegna da compilare — solo il minimo per
              la tracciabilità (§3.11). Salvando con la spunta attiva, quei due campi vengono
              azzerati.
            </span>
          </span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass}>Categoria</label>
            <select
              value={supplier.category || ""}
              onChange={(e) => handleChange("category", e.target.value)}
              className={inputClass}
            >
              <option value="">—</option>
              {SUPPLIER_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>P.IVA / Codice fiscale</label>
            <input
              value={supplier.tax_code || ""}
              onChange={(e) => handleChange("tax_code", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Telefono</label>
            <input
              value={supplier.contact_phone || ""}
              onChange={(e) => handleChange("contact_phone", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              value={supplier.contact_email || ""}
              onChange={(e) => handleChange("contact_email", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Referente</label>
            <input
              value={supplier.contact_person || ""}
              onChange={(e) => handleChange("contact_person", e.target.value)}
              className={inputClass}
            />
          </div>
          {/* Come preferisce ricevere gli ordini. Si scrive una volta e non
              lo si chiede più: per lo stesso fornitore la risposta è sempre
              la stessa. Lasciato vuoto, la schermata degli ordini offre
              entrambe le strade invece di sceglierne una in silenzio. */}
          <div>
            <label className={labelClass}>Come vuole gli ordini</label>
            <select
              value={supplier.canale_ordine || ""}
              onChange={(e) => handleChange("canale_ordine", e.target.value || null)}
              className={inputClass}
            >
              <option value="">non l&apos;ha detto</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="telefono">Telefono (glielo leggo io)</option>
            </select>
          </div>
          {/* La deducibilità ABITUALE delle sue fatture: le nuove la
              ereditano, e su una singola fattura si può sempre dire
              diversamente. Si salva da sé, senza toccare il resto del
              modulo: ricaricare la scheda butterebbe via ciò che si sta
              scrivendo negli altri campi (trappola del 12/08). */}
          <div>
            <label className={labelClass}>Deducibilità abituale</label>
            <select
              value={supplier.regola_deducibilita_id || ""}
              onChange={async (e) => {
                const v = e.target.value || null;
                setSupplier((s) => ({ ...s, regola_deducibilita_id: v }));
                try {
                  await setRegolaFornitore(id, v);
                } catch (err) {
                  setError(err.message);
                }
              }}
              className={inputClass}
            >
              <option value="">da dire</option>
              {regole.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.etichetta} ({Number(r.percentuale_deducibile)}%)
                </option>
              ))}
            </select>
          </div>
        </div>

        {!supplier.is_occasional && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={labelClass}>Condizioni di pagamento</label>
              <input
                value={supplier.payment_terms || ""}
                onChange={(e) => handleChange("payment_terms", e.target.value)}
                placeholder='Es. "30 gg data fattura"'
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Giorni di consegna abituali</label>
              <input
                value={supplier.delivery_days || ""}
                onChange={(e) => handleChange("delivery_days", e.target.value)}
                placeholder='Es. "Lunedì e giovedì"'
                className={inputClass}
              />
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className={labelClass}>Note</label>
          <textarea
            value={supplier.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            rows={2}
            className={inputClass}
          />
        </div>

        <div className="flex items-center justify-between">
          {supplier.active && (
            <button
              type="button"
              onClick={handleDeactivate}
              className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
            >
              Disattiva fornitore
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2 ml-auto"
          >
            {saving ? "Salvo…" : "Salva modifiche"}
          </button>
        </div>
      </div>

      {/* Storico automatico (§3.11): letto da price_history e stock_lots,
          mai inserito a mano qui. */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Consegne recenti</h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60">Nessuna consegna registrata ancora.</p>
        ) : (
          <ul className="space-y-1.5">
            {deliveries.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-b58-charcoal">
                  {d.ingredient?.name} <span className="text-b58-charcoal-soft">· {d.quantity_received} {d.ingredient?.unit}</span>
                </span>
                <span className="text-b58-charcoal-soft shrink-0">
                  {formatDate(d.received_at)}
                  {d.unit_cost != null && ` · ${formatEUR(d.unit_cost)}/${d.ingredient?.unit}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Storico prezzi</h2>
        {prices.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60">Nessun prezzo registrato ancora.</p>
        ) : (
          <ul className="space-y-1.5">
            {prices.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-b58-charcoal">{p.ingredient?.name}</span>
                <span className="text-b58-charcoal-soft shrink-0">
                  {formatEUR(p.price)}/{p.ingredient?.unit} · {formatDate(p.recorded_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* §3.11 chiede anche l'affidabilità (ritardi, resi, problemi,
          accumulata nel tempo): non esiste oggi alcun tracciamento di
          incidenti di consegna nell'app — dichiarato qui invece di essere
          inventato o lasciato silenzioso. */}
      <p className="text-xs text-b58-charcoal-soft/60 px-1">
        L'affidabilità del fornitore (ritardi, resi, problemi) non è ancora tracciata: richiede un
        nuovo modo di registrare gli incidenti di consegna, non ancora costruito.
      </p>
    </div>
  );
}
