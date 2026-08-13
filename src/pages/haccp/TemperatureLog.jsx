import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { addTemperatureLog, createEquipment, listEquipment, listTemperatureLogs } from "../../lib/api/haccp";
import { STORAGE_TYPES, formatDate } from "../../lib/constants";
import { downloadCsv } from "../../lib/csv";
import { useAuth } from "../../context/AuthContext";

const emptyEquipmentForm = { name: "", storageType: "", targetMinC: "", targetMaxC: "" };
const emptyReadingForm = { recordedTempC: "", note: "", correctiveAction: "" };

export default function TemperatureLog() {
  const { isTitolare } = useAuth();
  const [equipment, setEquipment] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [avviso, setAvviso] = useState("");

  const [equipmentForm, setEquipmentForm] = useState(emptyEquipmentForm);
  const [addingEquipment, setAddingEquipment] = useState(false);
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);

  const [openRow, setOpenRow] = useState(null);
  const [readingForm, setReadingForm] = useState(emptyReadingForm);
  const [saving, setSaving] = useState(false);

  const load = () => Promise.all([listEquipment(), listTemperatureLogs()]).then(([eq, lg]) => {
    setEquipment(eq);
    setLogs(lg);
  });

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleAddEquipment = async () => {
    if (!equipmentForm.name.trim()) return;
    setAddingEquipment(true);
    setError("");
    try {
      await createEquipment({
        name: equipmentForm.name.trim(),
        storageType: equipmentForm.storageType || null,
        targetMinC: equipmentForm.targetMinC ? Number(equipmentForm.targetMinC) : null,
        targetMaxC: equipmentForm.targetMaxC ? Number(equipmentForm.targetMaxC) : null,
      });
      setEquipmentForm(emptyEquipmentForm);
      setShowEquipmentForm(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingEquipment(false);
    }
  };

  const toggleRow = (equipmentId) => {
    setOpenRow((r) => (r === equipmentId ? null : equipmentId));
    setReadingForm(emptyReadingForm);
    setError("");
  };

  const handleAddReading = async (equipmentId) => {
    if (!readingForm.recordedTempC) return;
    setSaving(true);
    setError("");
    try {
      const esito = await addTemperatureLog({
        equipmentId,
        recordedTempC: Number(readingForm.recordedTempC),
        note: readingForm.note,
        correctiveAction: readingForm.correctiveAction,
      });
      // La lettura è salvata comunque. Se era fuori range senza rimedio,
      // resta una non conformità aperta — e va detto adesso, non scoperto
      // il giorno dell'ispezione.
      setAvviso(
        esito?.da_chiudere
          ? "Temperatura fuori range: è stata aperta una non conformità, e resta APERTA finché non scrivi cosa hai fatto. La trovi in HACCP → Non conformità."
          : esito?.fuori_range
            ? "Temperatura fuori range: registrata insieme all'azione correttiva."
            : ""
      );
      setOpenRow(null);
      setReadingForm(emptyReadingForm);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    downloadCsv("registro_temperature.csv", logs, [
      { label: "Attrezzatura", value: (r) => r.equipment_name },
      { label: "Temperatura (°C)", value: (r) => r.recorded_temp_c },
      { label: "Range target", value: (r) => (r.target_min_c != null ? `${r.target_min_c}/${r.target_max_c}` : "") },
      { label: "Conforme", value: (r) => (r.is_compliant ? "Sì" : "No") },
      { label: "Data/ora", value: (r) => formatDate(r.recorded_at) },
      { label: "Nota", value: (r) => r.note },
      { label: "Azione correttiva", value: (r) => r.corrective_action },
    ]);
  };

  if (loading) {
    return <p className="text-sm text-b58-charcoal-soft max-w-4xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Link to="/haccp" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← HACCP
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap mt-1 mb-6">
        <h1 className="font-display text-2xl text-b58-charcoal">Registro temperature</h1>
        {logs.length > 0 && (
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
          >
            Esporta CSV
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}
      {avviso && (
        <p className="text-sm text-b58-gold-dark bg-b58-gold/10 rounded-lg px-3 py-2 mb-4">{avviso}</p>
      )}

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-b58-charcoal">Attrezzature</h2>
          {isTitolare && (
            <button
              type="button"
              onClick={() => setShowEquipmentForm((v) => !v)}
              className="text-xs text-b58-terracotta hover:text-b58-terracotta-dark"
            >
              {showEquipmentForm ? "Annulla" : "+ Nuova attrezzatura"}
            </button>
          )}
        </div>

        {isTitolare && showEquipmentForm && (
          <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input
                value={equipmentForm.name}
                onChange={(e) => setEquipmentForm((f) => ({ ...f, name: e.target.value }))}
                placeholder='Es. "Frigo pesce"'
                className={`${inputClass} col-span-2 sm:col-span-1`}
              />
              <select
                value={equipmentForm.storageType}
                onChange={(e) => setEquipmentForm((f) => ({ ...f, storageType: e.target.value }))}
                className={inputClass}
              >
                <option value="">Tipo (opzionale)</option>
                {STORAGE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.1"
                value={equipmentForm.targetMinC}
                onChange={(e) => setEquipmentForm((f) => ({ ...f, targetMinC: e.target.value }))}
                placeholder="Min °C"
                className={inputClass}
              />
              <input
                type="number"
                step="0.1"
                value={equipmentForm.targetMaxC}
                onChange={(e) => setEquipmentForm((f) => ({ ...f, targetMaxC: e.target.value }))}
                placeholder="Max °C"
                className={inputClass}
              />
            </div>
            <div className="flex justify-end mt-2">
              <button
                type="button"
                disabled={addingEquipment || !equipmentForm.name.trim()}
                onClick={handleAddEquipment}
                className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
              >
                {addingEquipment ? "Aggiungo…" : "+ Aggiungi"}
              </button>
            </div>
          </div>
        )}

        {equipment.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60">
            Nessuna attrezzatura ancora.{isTitolare ? " Aggiungine una per iniziare a registrare le temperature." : ""}
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {equipment.map((eq) => (
                <Fragment key={eq.id}>
                  <tr className="border-b border-b58-charcoal/5 last:border-0">
                    <td className="py-2 text-b58-charcoal font-medium">
                      {eq.name}
                      {eq.target_min_c != null && (
                        <span className="text-xs text-b58-charcoal-soft ml-1.5">
                          ({eq.target_min_c}° / {eq.target_max_c}°)
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => toggleRow(eq.id)}
                        className="text-b58-charcoal-soft hover:text-b58-terracotta-dark text-xs"
                      >
                        {openRow === eq.id ? "Annulla" : "+ Registra temperatura"}
                      </button>
                    </td>
                  </tr>
                  {openRow === eq.id && (
                    <tr className="bg-white">
                      <td colSpan={2} className="py-3">
                        <div className="flex flex-wrap gap-2 items-end">
                          <div className="w-24">
                            <input
                              type="number"
                              step="0.1"
                              value={readingForm.recordedTempC}
                              onChange={(e) => setReadingForm((f) => ({ ...f, recordedTempC: e.target.value }))}
                              placeholder="°C"
                              className={inputClass}
                            />
                          </div>
                          <div className="flex-1 min-w-[140px]">
                            <input
                              value={readingForm.note}
                              onChange={(e) => setReadingForm((f) => ({ ...f, note: e.target.value }))}
                              placeholder="Nota (opzionale)"
                              className={inputClass}
                            />
                          </div>
                          <div className="flex-1 min-w-[160px]">
                            <input
                              value={readingForm.correctiveAction}
                              onChange={(e) => setReadingForm((f) => ({ ...f, correctiveAction: e.target.value }))}
                              placeholder="Azione correttiva (se fuori range)"
                              className={inputClass}
                            />
                          </div>
                          <button
                            type="button"
                            disabled={saving || !readingForm.recordedTempC}
                            onClick={() => handleAddReading(eq.id)}
                            className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
                          >
                            {saving ? "Salvo…" : "Conferma"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-4">Storico rilevazioni</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-b58-charcoal-soft/60">Nessuna rilevazione ancora.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="py-2 font-medium">Attrezzatura</th>
                <th className="py-2 font-medium">Temp.</th>
                <th className="py-2 font-medium">Data/ora</th>
                <th className="py-2 font-medium">Esito</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice(0, 50).map((l) => (
                <tr key={l.id} className="border-b border-b58-charcoal/5 last:border-0">
                  <td className="py-2 text-b58-charcoal">{l.equipment_name}</td>
                  <td className="py-2 text-b58-charcoal-soft">{l.recorded_temp_c}°C</td>
                  <td className="py-2 text-b58-charcoal-soft">{formatDate(l.recorded_at)}</td>
                  <td className="py-2">
                    {l.target_min_c == null ? (
                      <span className="text-xs text-b58-charcoal-soft/60">nessun range</span>
                    ) : l.is_compliant ? (
                      <span className="text-xs text-b58-olive-dark">Conforme</span>
                    ) : (
                      <span className="text-xs text-b58-terracotta-dark font-medium">Fuori range</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
