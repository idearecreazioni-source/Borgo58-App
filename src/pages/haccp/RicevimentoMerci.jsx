import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { addGoodsReceiving, listGoodsReceiving } from "../../lib/api/haccp";
import { esitoRicevimento } from "../../lib/calcoli/haccp";
import { listSuppliers, listSuppliersDisplay } from "../../lib/api/suppliers";
import { getEntities } from "../../lib/api/entities";
import { useAuth } from "../../context/AuthContext";
import { formatDate } from "../../lib/constants";
import { downloadCsv } from "../../lib/csv";

const emptyForm = {
  supplier_id: "",
  product_description: "",
  temperature_c: "",
  packaging_ok: true,
  conformity: true,
  note: "",
  azione: "",
};

export default function RicevimentoMerci() {
  const { isTitolare } = useAuth();
  const [logs, setLogs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [avviso, setAvviso] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () =>
    Promise.all([
      listGoodsReceiving(),
      isTitolare ? getEntities().then((e) => listSuppliers(e.srls.id)) : listSuppliersDisplay(),
    ]).then(([lg, sup]) => {
      setLogs(lg);
      setSuppliers(sup);
    });

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTitolare]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleAdd = async () => {
    if (!form.product_description.trim()) return;
    setSaving(true);
    setError("");
    try {
      const esito = await addGoodsReceiving({
        supplierId: form.supplier_id || null,
        productDescription: form.product_description.trim(),
        temperatureC: form.temperature_c ? Number(form.temperature_c) : null,
        packagingOk: form.packaging_ok,
        conformity: form.conformity,
        note: form.note,
        azione: form.azione,
      });
      setAvviso(
        esito?.da_chiudere
          ? "Merce non conforme: è stata aperta una non conformità, e resta APERTA finché non scrivi cosa hai deciso (respinta, accettata con riserva, sostituita). La trovi in HACCP → Non conformità."
          : esito?.non_conforme
            ? "Merce non conforme: registrata insieme a cosa hai deciso, la non conformità è già chiusa."
            : ""
      );
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    downloadCsv("ricevimento_merci.csv", logs, [
      { label: "Fornitore", value: (r) => r.supplier?.name },
      { label: "Prodotto", value: (r) => r.product_description },
      { label: "Data/ora", value: (r) => formatDate(r.received_at) },
      { label: "Temperatura (°C)", value: (r) => r.temperature_c },
      { label: "Imballaggio OK", value: (r) => (r.packaging_ok ? "Sì" : "No") },
      { label: "Merce conforme", value: (r) => (r.conformity ? "Sì" : "No") },
      // ⚠️ L'esito complessivo, dalla stessa funzione del manuale: le due
      // colonne qui sopra restano perché in un registro serve sapere
      // QUALE delle due cose non andava, ma senza una colonna di sintesi
      // chi legge il foglio deve rifare il confronto a mano — ed è così
      // che si ricomincia a sbagliarlo.
      { label: "Esito", value: (r) => esitoRicevimento(r).etichetta },
      { label: "Nota", value: (r) => r.note },
    ]);
  };

  if (loading) {
    return <p className="text-sm text-b58-charcoal-soft max-w-3xl mx-auto">Caricamento…</p>;
  }

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link to="/haccp" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← HACCP
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap mt-1 mb-6">
        <h1 className="font-display text-2xl text-b58-charcoal">Ricevimento merci</h1>
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

      <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          <input
            value={form.product_description}
            onChange={(e) => setForm((f) => ({ ...f, product_description: e.target.value }))}
            placeholder='Es. "Cassa di pesce fresco"'
            className={`${inputClass} col-span-2 sm:col-span-2`}
          />
          <select
            value={form.supplier_id}
            onChange={(e) => setForm((f) => ({ ...f, supplier_id: e.target.value }))}
            className={inputClass}
          >
            <option value="">Fornitore</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.1"
            value={form.temperature_c}
            onChange={(e) => setForm((f) => ({ ...f, temperature_c: e.target.value }))}
            placeholder="Temp. °C (opz.)"
            className={inputClass}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 mb-2">
          <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
            <input
              type="checkbox"
              checked={form.packaging_ok}
              onChange={(e) => setForm((f) => ({ ...f, packaging_ok: e.target.checked }))}
            />
            Imballaggio integro
          </label>
          <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft">
            <input
              type="checkbox"
              checked={form.conformity}
              onChange={(e) => setForm((f) => ({ ...f, conformity: e.target.checked }))}
            />
            Conforme
          </label>
        </div>
        {/* ⚠️ Il campo che mancava. L'api accettava «azione» dal 13/08, il
            database la sa registrare e ci chiude da sola la non
            conformità — ma nessuna schermata gliela mandava: un filo
            attaccato da una parte sola.
            Compare solo quando serve, cioè quando qualcosa non va: un
            campo sempre visibile su una consegna normale è un campo che
            si impara a saltare. È lo stesso gesto della temperatura fuori
            range, e la stessa regola — si registra comunque, anche senza
            rimedio: una consegna non registrata è irrecuperabile, un
            rimedio scritto dopo è ancora un rimedio. */}
        {(!form.conformity || !form.packaging_ok) && (
          <input
            value={form.azione}
            onChange={(e) => setForm((f) => ({ ...f, azione: e.target.value }))}
            placeholder="Cosa hai deciso? (respinta, accettata con riserva, sostituita…)"
            className={`${inputClass} mb-2`}
          />
        )}
        <div className="flex items-center justify-between gap-2">
          <input
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Nota (opzionale)"
            className={`${inputClass} flex-1`}
          />
          <button
            type="button"
            disabled={saving || !form.product_description.trim()}
            onClick={handleAdd}
            className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60 shrink-0"
          >
            {saving ? "Registro…" : "+ Registra"}
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-b58-charcoal-soft/60">Nessun ricevimento registrato ancora.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((l) => (
            <li key={l.id} className="rounded-lg bg-b58-parchment ring-1 ring-b58-charcoal/10 p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="text-sm text-b58-charcoal font-medium">{l.product_description}</span>
                  {l.supplier?.name && (
                    <span className="text-xs text-b58-charcoal-soft ml-1.5">· {l.supplier.name}</span>
                  )}
                  {/* ⚠️ Stesso difetto del manuale, in un secondo posto:
                      questa pastiglia compariva solo su «merce non
                      conforme», quindi una consegna con l'imballaggio
                      rotto si leggeva come una consegna normale. Ora
                      l'esito lo dice `esitoRicevimento()`, e dice anche
                      il perché. */}
                  {!esitoRicevimento(l).conforme && (
                    <span className="text-[11px] text-b58-terracotta-dark bg-b58-terracotta/10 rounded-full px-2 py-0.5 ml-1.5">
                      {esitoRicevimento(l).etichetta}
                    </span>
                  )}
                </div>
                <span className="text-xs text-b58-charcoal-soft">{formatDate(l.received_at)}</span>
              </div>
              {l.note && <p className="text-xs text-b58-charcoal-soft mt-1">{l.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
