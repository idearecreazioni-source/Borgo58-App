import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createCession, deleteCession, listCessions } from "../../lib/api/agricolo";
import { getEntities } from "../../lib/api/entities";
import { listIngredients } from "../../lib/api/ingredients";
import { UNITS, formatDate, formatEUR, oggiLocale } from "../../lib/constants";

const today = oggiLocale;

const emptyForm = {
  ingredient_id: "", product_description: "", quantity: "", unit: "kg", unit_price: "",
  vat_rate: "", cession_date: today(), fiscal_document_type: "", invoice_reference: "", notes: "",
  update_cost: true,
};

export default function Cessioni() {
  const [entities, setEntities] = useState(null);
  const [cessions, setCessions] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEntities().then(setEntities).catch((e) => setError(e.message));
  }, []);

  const reload = () => Promise.all([listCessions(), listIngredients()]).then(([c, i]) => {
    setCessions(c);
    setIngredients(i);
  });

  useEffect(() => {
    setLoading(true);
    reload().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const total = useMemo(
    () => (Number(form.quantity) || 0) * (Number(form.unit_price) || 0),
    [form.quantity, form.unit_price]
  );

  // ⚠️ Togliere una cessione STORNA anche il costo che aveva aggiornato:
  // sparisce la riga dello storico prezzi e l'ingrediente torna
  // all'ultimo prezzo rimasto. Prima l'errore non era nemmeno mostrato —
  // la cancellazione era un `.then(reload)` senza via d'uscita: se
  // falliva, la riga restava lì e nessuno sapeva perché.
  const rimuovi = async (id) => {
    setError("");
    try {
      await deleteCession(id);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleAdd = async () => {
    if (!entities || !form.product_description.trim() || !form.quantity || !form.unit_price) return;
    setSaving(true);
    setError("");
    try {
      await createCession(
        {
          sellerEntityId: entities.agricola.id,
          buyerEntityId: entities.srls.id,
          ingredientId: form.ingredient_id || null,
          productDescription: form.product_description.trim(),
          quantity: form.quantity,
          unit: form.unit,
          unitPrice: form.unit_price,
          vatRate: form.vat_rate,
          cessionDate: form.cession_date,
          fiscalDocumentType: form.fiscal_document_type,
          invoiceReference: form.invoice_reference,
          notes: form.notes,
        },
        { updateIngredientCost: form.update_cost }
      );
      setForm(emptyForm);
      setShowForm(false);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/agricolo" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Agricolo / Orto
        </Link>
        <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment text-sm font-medium px-4 py-2">
          {showForm ? "Annulla" : "+ Nuova cessione"}
        </button>
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-1">Cessioni intercompany</h1>
      <p className="text-xs text-b58-charcoal-soft/80 mb-4">
        L'azienda agricola cede il raccolto alla S.r.l.s. con fattura. Il prezzo di trasferimento diventa il
        costo dell'ingrediente a produzione interna. <strong>Da validare con Laura</strong>: il sistema non
        emette il documento fiscale, ne registra i dati (§1, §6).
      </p>

      {error && <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {showForm && entities && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-6">
          <div className="text-xs text-b58-charcoal-soft mb-3">
            Da <span className="text-b58-charcoal font-medium">{entities.agricola.name}</span> a <span className="text-b58-charcoal font-medium">{entities.srls.name}</span>
          </div>
          <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <input value={form.product_description} onChange={(e) => setForm((f) => ({ ...f, product_description: e.target.value }))} placeholder="Descrizione prodotto ceduto" className={`${inputClass} sm:col-span-2`} />
              <select value={form.ingredient_id} onChange={(e) => setForm((f) => ({ ...f, ingredient_id: e.target.value }))} className={inputClass}>
                <option value="">Ingrediente collegato (opz.)</option>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className={labelClass}>Quantità</label>
                <input type="number" step="0.001" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Unità</label>
                <select value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} className={inputClass}>
                  {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Prezzo unitario €</label>
                <input type="number" step="0.0001" value={form.unit_price} onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>IVA %</label>
                <input type="number" step="0.1" value={form.vat_rate} onChange={(e) => setForm((f) => ({ ...f, vat_rate: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className={labelClass}>Data cessione</label>
                <input type="date" value={form.cession_date} onChange={(e) => setForm((f) => ({ ...f, cession_date: e.target.value }))} className={inputClass} />
              </div>
              <input value={form.fiscal_document_type} onChange={(e) => setForm((f) => ({ ...f, fiscal_document_type: e.target.value }))} placeholder='Tipo doc. (es. "TD01")' className={`${inputClass} self-end`} />
              <input value={form.invoice_reference} onChange={(e) => setForm((f) => ({ ...f, invoice_reference: e.target.value }))} placeholder="Rif. fattura (opz.)" className={`${inputClass} self-end`} />
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-b58-charcoal">Imponibile: <span className="font-medium">{formatEUR(total)}</span></div>
              <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
                {/* Senza ingrediente collegato la casella è spenta E vuota:
                    prima restava disegnata "spuntata" pur essendo inerte —
                    prometteva un aggiornamento che non sarebbe avvenuto
                    (trovato da Alessio alla prova dal vivo del 09/08). */}
                <input type="checkbox" checked={Boolean(form.update_cost && form.ingredient_id)} onChange={(e) => setForm((f) => ({ ...f, update_cost: e.target.checked }))} disabled={!form.ingredient_id} />
                Aggiorna il costo dell'ingrediente collegato a questo prezzo
              </label>
              <button type="button" disabled={saving || !form.product_description.trim() || !form.quantity || !form.unit_price} onClick={handleAdd} className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60">
                {saving ? "Registro…" : "+ Registra cessione"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : cessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">Nessuna cessione registrata. Compariranno qui quando l'agricola inizierà a cedere il raccolto.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {cessions.map((c) => (
            <li key={c.id} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-b58-charcoal font-medium">{c.product_description}</div>
                <div className="text-xs text-b58-charcoal-soft mt-0.5">
                  {formatDate(c.cession_date)} · {c.quantity} {c.unit} × {formatEUR(c.unit_price)}
                  {c.ingredient && <> · → {c.ingredient.name}</>}
                  {c.invoice_reference && <> · {c.invoice_reference}</>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-b58-charcoal font-medium">{formatEUR(c.total_amount)}</span>
                <button onClick={() => rimuovi(c.id)} className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark">Rimuovi</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
