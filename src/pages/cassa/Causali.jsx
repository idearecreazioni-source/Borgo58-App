import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createCausale, deactivateCausale, listAllCausali, setCausaleNeiFissi } from "../../lib/api/cash";
import { listRegoleDeducibilita, setRegolaCausale } from "../../lib/api/deducibilita";

const KINDS = [
  { value: "uscita", label: "Uscite" },
  { value: "entrata", label: "Entrate" },
  { value: "sconto_omaggio", label: "Sconti / omaggi" },
];

export default function Causali() {
  const [causali, setCausali] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newKind, setNewKind] = useState("uscita");
  const [saving, setSaving] = useState(false);
  const [regole, setRegole] = useState([]);

  const reload = () =>
    Promise.all([listAllCausali(), listRegoleDeducibilita({ soloAttive: true })]).then(
      ([c, r]) => {
        setCausali(c);
        setRegole(r);
      }
    );

  useEffect(() => {
    reload()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const byKind = useMemo(() => {
    const map = { uscita: [], entrata: [], sconto_omaggio: [] };
    causali.filter((c) => c.active).forEach((c) => map[c.kind]?.push(c));
    return map;
  }, [causali]);

  const inputClass =
    "rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 testo-sala-grande text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createCausale({ label: newLabel, kind: newKind });
      setNewLabel("");
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id) => {
    try {
      await deactivateCausale(id);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleFissi = async (id, valore) => {
    try {
      await setCausaleNeiFissi(id, valore);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  // La regola di deducibilità ABITUALE: le uscite di prima nota con questa
  // causale la ereditano da sole. Classificarle una per una è una cosa che
  // nessuno fa per più di due settimane — stessa ragione per cui dal 14/08
  // il fornitore abituale sta sul prodotto e non su ogni riga della lista.
  const handleRegola = async (id, regolaId) => {
    try {
      await setRegolaCausale(id, regolaId);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link to="/cassa" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Cassa
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-2">Causali</h1>
      <p className="testo-sala text-b58-charcoal-soft mb-6">
        Sulle uscite c&apos;è una casella <strong>«è un costo fisso»</strong>: serve alla Proiezione per
        confrontare i costi fissi veri con quelli previsti. Finché non ne spunti nessuna, il confronto dice
        che i fissi non li ha misurati — non che sono zero.
      </p>
      <p className="testo-sala text-b58-charcoal-soft mb-6">
        Sotto c&apos;è anche <strong>la deducibilità abituale</strong>: le uscite registrate con quella causale
        la ereditano, e su una singola riga puoi sempre dire diversamente. Le regole si creano da{" "}
        <Link to="/fiscale/deducibilita" className="underline">Proiezione fiscale → Deducibilità dei costi</Link>.
      </p>
      <p className="testo-sala text-b58-charcoal-soft mb-6">
        Alcune causali le scrive <strong>il gestionale</strong>, non tu: quando conti il cassetto, versi in
        banca o ti rimborsi un anticipo. Le vedi qui per sapere che esistono, ma{" "}
        <strong>non compaiono quando registri un movimento a mano</strong> — sono spostamenti di denaro, non
        spese, e sceglierne una per una spesa vera la farebbe sparire dai costi.
      </p>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <div className="bg-white rounded-lg border border-b58-charcoal/10 p-3 mb-6 flex flex-wrap gap-2 items-end">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nuova causale…"
          className={`${inputClass} flex-1 min-w-[180px]`}
        />
        <select value={newKind} onChange={(e) => setNewKind(e.target.value)} className={inputClass}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={saving || !newLabel.trim()}
          onClick={handleAdd}
          className="rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60"
        >
          + Aggiungi
        </button>
      </div>

      {loading ? (
        <p className="testo-sala-grande text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {KINDS.map((k) => (
            <div key={k.value} className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4">
              <h2 className="testo-sala font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">{k.label}</h2>
              <ul className="space-y-1">
                {byKind[k.value].map((c) => (
                  <li key={c.id} className="testo-sala-grande text-b58-charcoal">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {c.label}
                        {c.di_sistema && (
                          <span className="block testo-sala text-b58-charcoal-soft/70">
                            la scrive il gestionale
                          </span>
                        )}
                      </span>
                      {/* ⚠️ Sulle causali di sistema il pulsante non c'è
                          invece di esserci e fallire: il database le
                          protegge, e un tasto che dà errore ogni volta
                          insegna solo a diffidare dei tasti. */}
                      {!c.di_sistema && (
                        <button
                          onClick={() => handleRemove(c.id)}
                          className="testo-sala text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                          title="Disattiva"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {k.value === "uscita" && !c.di_sistema && (
                      <>
                        <label className="flex items-center gap-1.5 testo-sala text-b58-charcoal-soft mt-0.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(c.conta_nei_fissi)}
                            onChange={(e) => handleFissi(c.id, e.target.checked)}
                            className="accent-b58-terracotta"
                          />
                          è un costo fisso
                        </label>
                        <select
                          value={c.regola_deducibilita_id || ""}
                          onChange={(e) => handleRegola(c.id, e.target.value)}
                          className="w-full mt-1 rounded-lg border border-b58-charcoal/15 bg-white px-2 py-1 testo-sala text-b58-charcoal"
                        >
                          <option value="">deducibilità: da dire</option>
                          {regole.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.etichetta} ({Number(r.percentuale_deducibile)}%)
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </li>
                ))}
                {byKind[k.value].length === 0 && (
                  <li className="testo-sala text-b58-charcoal-soft/60">Nessuna.</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
