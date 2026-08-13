import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getEntities } from "../../lib/api/entities";
import { listSuppliers, createSupplier } from "../../lib/api/suppliers";
import { collegaArticoli, variantiIngrediente } from "../../lib/api/assistente";
import {
  createIngredient,
  getIngredient,
  listPriceHistory,
  updateIngredientFields,
  updateIngredientPrice,
} from "../../lib/api/ingredients";
import {
  ALLERGENS,
  INGREDIENT_CATEGORIES,
  MONTHS,
  STORAGE_TYPES,
  SUPPLIER_CATEGORIES,
  UNITS,
  formatDate,
  formatEUR,
} from "../../lib/constants";

const emptyForm = {
  name: "",
  category: "",
  unit: "kg",
  source_type: "fornitore_esterno",
  supplier_id: "",
  current_price: "",
  allergens: [],
  seasonality: [],
  storage_type: "",
  shelf_life_days: "",
  waste_percentage_default: "0",
  stock_minimum_threshold: "",
  haccp_receiving_temp: "",
  haccp_notes: "",
  // Acceso di partenza: il silenzio si compra prodotto per prodotto, non
  // con una percentuale. Un fornitore che alza del 3% ogni mese non
  // supererebbe mai una soglia, e fa +42% in un anno.
  avvisa_rincari: true,
  alimentare: true,
};

export default function IngredienteForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [entities, setEntities] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [priceHistory, setPriceHistory] = useState([]);
  const [varianti, setVarianti] = useState([]);
  const [newPrice, setNewPrice] = useState("");
  const [priceNote, setPriceNote] = useState("");
  const [updatingPrice, setUpdatingPrice] = useState(false);

  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", category: "" });
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ent = await getEntities();
        if (cancelled) return;
        setEntities(ent);
        setSuppliers(await listSuppliers(ent.srls.id));

        if (isEdit) {
          const ing = await getIngredient(id);
          if (cancelled) return;
          setForm({
            name: ing.name,
            category: ing.category,
            unit: ing.unit,
            source_type: ing.source_type,
            supplier_id: ing.supplier_id ?? "",
            current_price: ing.current_price,
            allergens: ing.allergens ?? [],
            seasonality: ing.seasonality ?? [],
            storage_type: ing.storage_type ?? "",
            shelf_life_days: ing.shelf_life_days ?? "",
            waste_percentage_default: ing.waste_percentage_default ?? "0",
            stock_minimum_threshold: ing.stock_minimum_threshold ?? "",
            haccp_receiving_temp: ing.haccp_receiving_temp ?? "",
            haccp_notes: ing.haccp_notes ?? "",
            avvisa_rincari: ing.avvisa_rincari !== false,
            alimentare: ing.alimentare !== false,
          });
          setPriceHistory(await listPriceHistory(id));
          setVarianti(await variantiIngrediente(id).catch(() => []));
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isEdit]);

  const priceAlert = useMemo(() => {
    if (priceHistory.length === 0) return null;
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const recent = priceHistory.filter(
      (h) => new Date(h.recorded_at) >= threeMonthsAgo
    );
    if (recent.length === 0) return null;
    const avg = recent.reduce((sum, h) => sum + Number(h.price), 0) / recent.length;
    if (avg === 0) return null;
    const variation = ((Number(form.current_price) - avg) / avg) * 100;
    if (Math.abs(variation) > 10) return variation;
    return null;
  }, [priceHistory, form.current_price]);

  const toggleArrayValue = (field, value) => {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value)
        ? f[field].filter((v) => v !== value)
        : [...f[field], value],
    }));
  };

  const handleCreateSupplier = async () => {
    if (!newSupplier.name.trim()) return;
    setCreatingSupplier(true);
    try {
      const created = await createSupplier({
        entityId: entities.srls.id,
        name: newSupplier.name.trim(),
        category: newSupplier.category || null,
      });
      setSuppliers((s) => [...s, created].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, supplier_id: created.id }));
      setShowNewSupplier(false);
      setNewSupplier({ name: "", category: "" });
    } catch (e) {
      setError(e.message);
    } finally {
      setCreatingSupplier(false);
    }
  };

  // «Queste due sono lo stesso prodotto». Lo dice Alessio, non il
  // gestionale: due diciture di fornitori diversi sono due stringhe, e
  // nessun confronto automatico può sapere che dentro c'è la stessa cosa.
  const collega = async (articoloId, stessoDi) => {
    setError("");
    try {
      await collegaArticoli(articoloId, stessoDi);
      setVarianti(await variantiIngrediente(id));
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        entity_id: entities.srls.id,
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        source_type: form.source_type,
        supplier_id: form.source_type === "fornitore_esterno" ? form.supplier_id || null : null,
        producer_entity_id:
          form.source_type === "produzione_interna" ? entities.agricola.id : null,
        allergens: form.allergens,
        seasonality: form.seasonality,
        storage_type: form.storage_type || null,
        shelf_life_days: form.shelf_life_days ? Number(form.shelf_life_days) : null,
        waste_percentage_default: Number(form.waste_percentage_default) || 0,
        // Vuoto e zero sono la stessa cosa qui: nessuna soglia. Zero
        // sarebbe una soglia che non scatta mai, e il database la rifiuta.
        stock_minimum_threshold:
          Number(form.stock_minimum_threshold) > 0
            ? Number(form.stock_minimum_threshold)
            : null,
        haccp_receiving_temp: form.haccp_receiving_temp || null,
        haccp_notes: form.haccp_notes || null,
        avvisa_rincari: form.avvisa_rincari,
        alimentare: form.alimentare,
      };

      if (isEdit) {
        await updateIngredientFields(id, payload);
        navigate(`/ricettario/ingredienti/${id}`);
      } else {
        const created = await createIngredient({
          ...payload,
          current_price: Number(form.current_price) || 0,
        });
        navigate(`/ricettario/ingredienti/${created.id}`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePrice = async () => {
    if (!newPrice) return;
    setUpdatingPrice(true);
    setError("");
    try {
      await updateIngredientPrice(id, Number(newPrice), { note: priceNote || undefined });
      setForm((f) => ({ ...f, current_price: Number(newPrice) }));
      setPriceHistory(await listPriceHistory(id));
      setNewPrice("");
      setPriceNote("");
    } catch (e) {
      setError(e.message);
    } finally {
      setUpdatingPrice(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-b58-charcoal-soft max-w-3xl mx-auto">Caricamento…</p>;
  }

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link
        to="/ricettario/ingredienti"
        className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta"
      >
        ← Ingredienti
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-6">
        {isEdit ? form.name || "Ingrediente" : "Nuovo ingrediente"}
      </h1>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Nome</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder='Es. "Pomodoro San Marzano DOP"'
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Categoria</label>
            <select
              required
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={inputClass}
            >
              <option value="" disabled>
                Seleziona…
              </option>
              {INGREDIENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Unità</label>
            <select
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              className={inputClass}
            >
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Provenienza */}
        <div>
          <label className={labelClass}>Provenienza</label>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, source_type: "fornitore_esterno" }))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                form.source_type === "fornitore_esterno"
                  ? "border-b58-terracotta bg-b58-terracotta/10 text-b58-terracotta-dark"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              Fornitore esterno
            </button>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, source_type: "produzione_interna" }))}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                form.source_type === "produzione_interna"
                  ? "border-b58-olive bg-b58-olive/10 text-b58-olive-dark"
                  : "border-b58-charcoal/15 text-b58-charcoal-soft"
              }`}
            >
              Produzione interna (orto)
            </button>
          </div>

          {form.source_type === "fornitore_esterno" ? (
            <div>
              <select
                value={form.supplier_id}
                onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
                className={inputClass}
              >
                <option value="">Nessun fornitore specifico</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {!showNewSupplier ? (
                <button
                  type="button"
                  onClick={() => setShowNewSupplier(true)}
                  className="text-sm text-b58-terracotta hover:text-b58-terracotta-dark mt-2"
                >
                  + Nuovo fornitore
                </button>
              ) : (
                <div className="mt-3 rounded-lg border border-b58-charcoal/15 p-3 space-y-2 bg-white">
                  <input
                    value={newSupplier.name}
                    onChange={(e) =>
                      setNewSupplier((s) => ({ ...s, name: e.target.value }))
                    }
                    placeholder="Nome fornitore"
                    className={inputClass}
                  />
                  <select
                    value={newSupplier.category}
                    onChange={(e) =>
                      setNewSupplier((s) => ({ ...s, category: e.target.value }))
                    }
                    className={inputClass}
                  >
                    <option value="">Categoria (opzionale)</option>
                    {SUPPLIER_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={creatingSupplier}
                      onClick={handleCreateSupplier}
                      className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-3 py-1.5 disabled:opacity-60"
                    >
                      {creatingSupplier ? "Salvo…" : "Salva fornitore"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewSupplier(false)}
                      className="text-sm text-b58-charcoal-soft px-3 py-1.5"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-b58-charcoal-soft bg-b58-olive/5 rounded-lg px-3 py-2">
              Prodotto dall'azienda agricola (non ancora operativa). Il prezzo qui
              sotto rappresenta il valore della cessione intercompany.
            </p>
          )}
        </div>

        {/* Prezzo — solo in creazione. In modifica si usa la sezione dedicata sotto. */}
        {!isEdit && (
          <div>
            <label className={labelClass}>Prezzo unitario (IVA esclusa)</label>
            <input
              required
              type="number"
              step="0.0001"
              min="0"
              value={form.current_price}
              onChange={(e) => setForm((f) => ({ ...f, current_price: e.target.value }))}
              className={inputClass}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Conservazione</label>
            <select
              value={form.storage_type}
              onChange={(e) => setForm((f) => ({ ...f, storage_type: e.target.value }))}
              className={inputClass}
            >
              <option value="">—</option>
              {STORAGE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Shelf life (giorni)</label>
            <input
              type="number"
              min="0"
              value={form.shelf_life_days}
              onChange={(e) => setForm((f) => ({ ...f, shelf_life_days: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>% scarto standard</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.waste_percentage_default}
              onChange={(e) =>
                setForm((f) => ({ ...f, waste_percentage_default: e.target.value }))
              }
              className={inputClass}
            />
          </div>
          {/* La scorta minima è quello che fa nascere una riga nella lista
              della spesa. Volutamente VUOTA di partenza e mai proposta dal
              sistema: senza mesi di consumi veri un numero inventato
              sarebbe credibile e sbagliato, e finirebbe in un ordine. */}
          <div>
            <label className={labelClass}>Scorta minima ({form.unit || "unità"})</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.stock_minimum_threshold}
              onChange={(e) =>
                setForm((f) => ({ ...f, stock_minimum_threshold: e.target.value }))
              }
              className={inputClass}
              placeholder="vuota = mai in lista da solo"
            />
            <p className="text-xs text-b58-charcoal-soft mt-1">
              Sotto questa quantità il prodotto entra da solo nella lista della
              spesa. Lasciala vuota se preferisci deciderlo tu ogni volta.
            </p>
          </div>
          {/* Due interruttori, e il secondo è quello che decide se questo
              prodotto ti farà squillare il telefono. Acceso di partenza:
              si spegne sui prodotti che ballano per stagione o per
              mercato, dove un avviso a ogni consegna si smette di
              leggere. */}
          <div className="sm:col-span-2 space-y-2">
            <label className="flex items-center gap-2 text-sm text-b58-charcoal">
              <input
                type="checkbox"
                checked={form.avvisa_rincari}
                onChange={(e) => setForm((f) => ({ ...f, avvisa_rincari: e.target.checked }))}
              />
              Avvisami se il prezzo sale
              <span className="text-xs text-b58-charcoal-soft">
                (qualunque aumento, anche piccolo — togli la spunta su ciò che varia sempre)
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-b58-charcoal">
              <input
                type="checkbox"
                checked={form.alimentare}
                onChange={(e) => setForm((f) => ({ ...f, alimentare: e.target.checked }))}
              />
              È un alimento
              <span className="text-xs text-b58-charcoal-soft">
                (togli la spunta per detersivi, carta, imballaggi: restano sotto controllo prezzi
                ma fuori dal Ricettario)
              </span>
            </label>
          </div>

          <div>
            <label className={labelClass}>Temperatura ricevimento (HACCP)</label>
            <input
              value={form.haccp_receiving_temp}
              onChange={(e) =>
                setForm((f) => ({ ...f, haccp_receiving_temp: e.target.value }))
              }
              placeholder="Es. ≤ 4°C"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Note HACCP</label>
          <textarea
            value={form.haccp_notes}
            onChange={(e) => setForm((f) => ({ ...f, haccp_notes: e.target.value }))}
            rows={2}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Allergeni</label>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => (
              <button
                type="button"
                key={a.value}
                onClick={() => toggleArrayValue("allergens", a.value)}
                className={`rounded-full text-xs px-3 py-1.5 border transition-colors ${
                  form.allergens.includes(a.value)
                    ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta"
                    : "border-b58-charcoal/15 text-b58-charcoal-soft"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Stagionalità</label>
          <div className="flex flex-wrap gap-2">
            {MONTHS.map((m) => (
              <button
                type="button"
                key={m.value}
                onClick={() => toggleArrayValue("seasonality", m.value)}
                className={`rounded-full text-xs px-3 py-1.5 border transition-colors ${
                  form.seasonality.includes(m.value)
                    ? "bg-b58-olive text-b58-parchment border-b58-olive"
                    : "border-b58-charcoal/15 text-b58-charcoal-soft"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment font-medium px-5 py-2.5 text-sm"
          >
            {saving ? "Salvo…" : isEdit ? "Salva modifiche" : "Crea ingrediente"}
          </button>
        </div>
      </form>

      {/* Le versioni comprate davvero: marca, formato, fornitore, prezzo
          per unità. È la tabella disegnata da Alessio il 12/08/2026 —
          «vedo tutte le versioni di olio che ho comprato e scelgo
          consapevolmente cosa continuare a comprare», e serve anche a
          vedere se un fornitore è più caro di un altro sullo stesso
          identico prodotto. */}
      {isEdit && varianti.length > 0 && (
        <div className="mt-6 rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
          <h2 className="font-display text-lg text-b58-charcoal mb-1">
            Versioni che compri
          </h2>
          <p className="text-xs text-b58-charcoal-soft mb-3">
            Dalla più conveniente. Il prezzo è sempre per {form.unit}, così formati diversi si
            possono confrontare.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-b58-charcoal-soft">
                  <th className="pb-2">Versione</th>
                  <th className="pb-2">Fornitore</th>
                  <th className="pb-2 text-right">€/{form.unit}</th>
                  <th className="pb-2 text-right">Ultima volta</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {varianti.map((v, i) => (
                  <tr key={v.articolo_id} className="border-t border-b58-charcoal/10">
                    <td className="py-1.5 text-b58-charcoal">
                      {v.descrizione}
                      {v.stesso_di && (
                        <span className="text-[11px] text-b58-charcoal-soft"> · stesso prodotto</span>
                      )}
                    </td>
                    <td className="py-1.5 text-b58-charcoal-soft">{v.fornitore ?? "—"}</td>
                    <td className="py-1.5 text-right text-b58-charcoal">
                      {v.prezzo ? Number(v.prezzo).toFixed(2) : "—"}
                      {i === 0 && v.prezzo && (
                        <span className="text-[11px] text-b58-olive"> ↓</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right text-b58-charcoal-soft text-xs">
                      {v.ultima_volta ? formatDate(v.ultima_volta) : "—"}
                    </td>
                    <td className="py-1.5 text-right">
                      {/* Il gestionale vede due stringhe e non può sapere che
                          dentro c'è la stessa cosa: glielo dice Alessio, una
                          volta, e da lì in poi le confronta da sole. */}
                      <select
                        value={v.stesso_di ?? ""}
                        onChange={(e) => collega(v.articolo_id, e.target.value || null)}
                        className="text-xs rounded border border-b58-charcoal/15 bg-white px-1.5 py-1"
                      >
                        <option value="">— versione a sé —</option>
                        {varianti
                          .filter((a) => a.articolo_id !== v.articolo_id)
                          .map((a) => (
                            <option key={a.articolo_id} value={a.articolo_id}>
                              = {a.descrizione}
                            </option>
                          ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-b58-charcoal-soft/70 mt-2">
            Se due righe sono lo stesso identico prodotto con nomi diversi, collegale: da lì in poi
            un aumento fra un fornitore e l{"'"}altro diventa un avviso invece di una cosa da
            notare a occhio.
          </p>
        </div>
      )}

      {isEdit && (
        <div className="mt-6 rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg text-b58-charcoal">Prezzo e storico</h2>
            <div className="text-right">
              <div className="text-xl text-b58-charcoal font-medium">
                {formatEUR(form.current_price)}
                <span className="text-sm text-b58-charcoal-soft">/{form.unit}</span>
              </div>
              {priceAlert !== null && (
                <span className="text-xs text-orange-700 bg-orange-100 rounded-full px-2 py-0.5">
                  {priceAlert > 0 ? "+" : ""}
                  {priceAlert.toFixed(1)}% vs media 3 mesi
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-end mb-5 bg-white rounded-lg p-3 border border-b58-charcoal/10">
            <div>
              <label className={labelClass}>Nuovo prezzo</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className={`${inputClass} w-32`}
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className={labelClass}>Nota (opzionale)</label>
              <input
                value={priceNote}
                onChange={(e) => setPriceNote(e.target.value)}
                placeholder='Es. "Aumento stagionale"'
                className={inputClass}
              />
            </div>
            <button
              type="button"
              disabled={updatingPrice || !newPrice}
              onClick={handleUpdatePrice}
              className="rounded-lg bg-b58-charcoal hover:bg-b58-charcoal-soft disabled:opacity-60 transition-colors text-b58-parchment text-sm px-4 py-2"
            >
              {updatingPrice ? "Aggiorno…" : "Aggiorna prezzo"}
            </button>
          </div>

          {priceHistory.length === 0 ? (
            <p className="text-sm text-b58-charcoal-soft">Nessuno storico ancora.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                  <th className="py-2 font-medium">Data</th>
                  <th className="py-2 font-medium text-right">Prezzo</th>
                  <th className="py-2 font-medium">Fonte</th>
                  <th className="py-2 font-medium">Nota</th>
                </tr>
              </thead>
              <tbody>
                {priceHistory.map((h) => (
                  <tr key={h.id} className="border-b border-b58-charcoal/5 last:border-0">
                    <td className="py-2 text-b58-charcoal-soft">{formatDate(h.recorded_at)}</td>
                    <td className="py-2 text-right text-b58-charcoal">{formatEUR(h.price)}</td>
                    <td className="py-2 text-b58-charcoal-soft">{h.source}</td>
                    <td className="py-2 text-b58-charcoal-soft">{h.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
