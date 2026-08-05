import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createCrop, deleteCrop, listCrops, updateCrop } from "../../lib/api/agricolo";
import { getEntities } from "../../lib/api/entities";
import { listIngredients } from "../../lib/api/ingredients";
import { CROP_STATUSES, UNITS, formatDate } from "../../lib/constants";

const STATUS_BADGE = {
  pianificato: "bg-b58-charcoal-soft/50",
  seminato: "bg-b58-gold",
  in_crescita: "bg-b58-olive",
  raccolto: "bg-b58-terracotta",
  chiuso: "bg-b58-charcoal-soft/40",
};

const emptyForm = {
  name: "", variety: "", plot: "", sowing_date: "", expected_harvest_date: "", ingredient_id: "",
};

const daysTo = (d) => Math.round((new Date(d) - new Date()) / 86400000);

export default function AgricoloHome() {
  const [entities, setEntities] = useState(null);
  const [crops, setCrops] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [harvestFor, setHarvestFor] = useState(null);
  const [harvest, setHarvest] = useState({ actual_harvest_date: "", harvested_quantity: "", unit: "kg" });

  useEffect(() => {
    getEntities().then(setEntities).catch((e) => setError(e.message));
  }, []);

  const reload = () => Promise.all([listCrops(), listIngredients()]).then(([c, i]) => {
    setCrops(c);
    setIngredients(i);
  });

  useEffect(() => {
    setLoading(true);
    reload().catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass = "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const handleAdd = async () => {
    if (!form.name.trim() || !entities) return;
    setSaving(true);
    setError("");
    try {
      await createCrop({
        entity_id: entities.agricola.id,
        name: form.name.trim(),
        variety: form.variety || null,
        plot: form.plot || null,
        sowing_date: form.sowing_date || null,
        expected_harvest_date: form.expected_harvest_date || null,
        ingredient_id: form.ingredient_id || null,
        status: form.sowing_date ? "seminato" : "pianificato",
      });
      setForm(emptyForm);
      setShowForm(false);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (crop, status) => {
    try {
      await updateCrop(crop.id, { status });
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const saveHarvest = async (crop) => {
    if (!harvest.harvested_quantity) return;
    try {
      await updateCrop(crop.id, {
        status: "raccolto",
        actual_harvest_date: harvest.actual_harvest_date || new Date().toISOString().slice(0, 10),
        harvested_quantity: Number(harvest.harvested_quantity),
        unit: harvest.unit,
      });
      setHarvestFor(null);
      setHarvest({ actual_harvest_date: "", harvested_quantity: "", unit: "kg" });
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const upcoming = useMemo(
    () => crops.filter((c) => c.expected_harvest_date && c.status !== "raccolto" && c.status !== "chiuso" && daysTo(c.expected_harvest_date) <= 30),
    [crops]
  );

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">Agricolo / Orto</h1>
          <p className="text-b58-charcoal-soft mt-1">Colture, semine e raccolti dell'azienda agricola.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/agricolo/cessioni" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
            Cessioni alla S.r.l.s.
          </Link>
          <button onClick={() => setShowForm((v) => !v)} className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment text-sm font-medium px-4 py-2">
            {showForm ? "Annulla" : "+ Nuova coltura"}
          </button>
        </div>
      </div>

      {entities && !entities.agricola?.is_active && (
        <p className="text-xs text-b58-gold-dark bg-b58-gold/10 rounded-lg px-3 py-2 mb-4">
          L'azienda agricola non è ancora attiva: puoi già pianificare le colture, la struttura è pronta per quando aprirà.
        </p>
      )}

      {error && <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>}

      {showForm && (
        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder='Coltura, es. "Aglione della Valdichiana"' className={`${inputClass} sm:col-span-2`} />
            <input value={form.variety} onChange={(e) => setForm((f) => ({ ...f, variety: e.target.value }))} placeholder="Varietà (opz.)" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <label className={labelClass}>Semina</label>
              <input type="date" value={form.sowing_date} onChange={(e) => setForm((f) => ({ ...f, sowing_date: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Raccolto previsto</label>
              <input type="date" value={form.expected_harvest_date} onChange={(e) => setForm((f) => ({ ...f, expected_harvest_date: e.target.value }))} className={inputClass} />
            </div>
            <input value={form.plot} onChange={(e) => setForm((f) => ({ ...f, plot: e.target.value }))} placeholder="Appezzamento (opz.)" className={`${inputClass} self-end`} />
            <select value={form.ingredient_id} onChange={(e) => setForm((f) => ({ ...f, ingredient_id: e.target.value }))} className={`${inputClass} self-end`}>
              <option value="">Ingrediente collegato (opz.)</option>
              {ingredients.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <button type="button" disabled={saving || !form.name.trim()} onClick={handleAdd} className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60">
              {saving ? "Salvo…" : "+ Aggiungi coltura"}
            </button>
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="rounded-xl bg-b58-olive/5 ring-1 ring-b58-olive/30 p-5 mb-6">
          <h2 className="font-display text-base text-b58-charcoal mb-3">Raccolti in arrivo (30 giorni)</h2>
          <ul className="space-y-1.5">
            {upcoming.map((c) => (
              <li key={c.id} className="text-sm flex items-center justify-between gap-2">
                <span className="text-b58-charcoal">{c.name}</span>
                <span className="text-b58-olive-dark">{formatDate(c.expected_harvest_date)} ({daysTo(c.expected_harvest_date)}gg)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : crops.length === 0 ? (
        <div className="rounded-xl border border-dashed border-b58-charcoal/20 p-10 text-center">
          <p className="text-b58-charcoal-soft">Nessuna coltura ancora.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="px-4 py-3 font-medium">Coltura</th>
                <th className="px-4 py-3 font-medium">Semina</th>
                <th className="px-4 py-3 font-medium">Raccolto</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {crops.map((c) => (
                <Fragment key={c.id}>
                  <tr className="border-b border-b58-charcoal/5 last:border-0">
                    <td className="px-4 py-3 text-b58-charcoal font-medium">
                      {c.name}
                      {c.variety && <span className="text-xs text-b58-charcoal-soft"> · {c.variety}</span>}
                      {c.plot && <div className="text-xs text-b58-charcoal-soft">{c.plot}</div>}
                      {c.ingredient && <div className="text-[11px] text-b58-olive-dark">→ {c.ingredient.name}</div>}
                    </td>
                    <td className="px-4 py-3 text-b58-charcoal-soft">{formatDate(c.sowing_date)}</td>
                    <td className="px-4 py-3 text-b58-charcoal-soft">
                      {c.actual_harvest_date
                        ? `${formatDate(c.actual_harvest_date)} · ${c.harvested_quantity} ${c.unit ?? ""}`
                        : c.expected_harvest_date ? `prev. ${formatDate(c.expected_harvest_date)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={c.status}
                        onChange={(e) => changeStatus(c, e.target.value)}
                        className={`text-[11px] rounded-full ${STATUS_BADGE[c.status]} text-b58-parchment font-medium px-2 py-1 border-0 focus:outline-none`}
                      >
                        {CROP_STATUSES.map((s) => (
                          <option key={s.value} value={s.value} className="text-b58-charcoal bg-white">{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => { setHarvestFor(harvestFor === c.id ? null : c.id); setHarvest({ actual_harvest_date: "", harvested_quantity: "", unit: c.unit ?? "kg" }); }} className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta">
                        {harvestFor === c.id ? "Annulla" : "Raccolto"}
                      </button>
                      <button onClick={() => deleteCrop(c.id).then(reload)} className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark ml-3">
                        Rimuovi
                      </button>
                    </td>
                  </tr>
                  {harvestFor === c.id && (
                    <tr className="bg-white">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 items-end">
                          <input type="date" value={harvest.actual_harvest_date} onChange={(e) => setHarvest((h) => ({ ...h, actual_harvest_date: e.target.value }))} className={inputClass + " w-40"} />
                          <input type="number" step="0.001" value={harvest.harvested_quantity} onChange={(e) => setHarvest((h) => ({ ...h, harvested_quantity: e.target.value }))} placeholder="Quantità raccolta" className={inputClass + " w-40"} />
                          <select value={harvest.unit} onChange={(e) => setHarvest((h) => ({ ...h, unit: e.target.value }))} className={inputClass + " w-28"}>
                            {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                          </select>
                          <button type="button" onClick={() => saveHarvest(c)} disabled={!harvest.harvested_quantity} className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60">
                            Registra raccolto
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
