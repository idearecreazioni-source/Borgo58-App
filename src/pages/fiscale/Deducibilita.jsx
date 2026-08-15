import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createRegolaDeducibilita,
  getRettificheFiscali,
  listCostiDaClassificare,
  listRegoleDeducibilita,
  updateRegolaDeducibilita,
} from "../../lib/api/deducibilita";
import { getEntities } from "../../lib/api/entities";
import { formatDate, formatEUR } from "../../lib/constants";

const annoCorrente = new Date().getFullYear();

const formVuoto = {
  etichetta: "",
  percentuale_deducibile: "100",
  vieta_contante: false,
  soggetta_a_plafond: false,
  riferimento_normativo: "",
  nota: "",
};

export default function Deducibilita() {
  const [entities, setEntities] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [anno, setAnno] = useState(annoCorrente);
  const [regole, setRegole] = useState([]);
  const [rettifiche, setRettifiche] = useState(null);
  const [daClassificare, setDaClassificare] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(formVuoto);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEntities()
      .then((ent) => {
        setEntities(ent);
        setEntityId(ent.srls.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  // ⚠️ Le regole si ricaricano sempre, i totali solo se c'è un'entità: una
  // schermata che ricarica tutto butta via ciò che si sta scrivendo altrove
  // (trappola del 12/08), quindi si ricarica ciò che è cambiato sul server.
  const ricaricaRegole = () => listRegoleDeducibilita().then(setRegole);

  const ricaricaTotali = () => {
    if (!entityId) return Promise.resolve();
    return Promise.all([
      getRettificheFiscali(entityId, anno),
      listCostiDaClassificare(entityId, anno),
    ]).then(([r, c]) => {
      setRettifiche(r);
      setDaClassificare(c);
    });
  };

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    Promise.all([ricaricaRegole(), ricaricaTotali()])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, anno]);

  const nonConfermate = useMemo(
    () => regole.filter((r) => r.attiva && !r.verificata_il).length,
    [regole]
  );

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass =
    "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const aggiungiRegola = async () => {
    if (!form.etichetta.trim()) return;
    setSaving(true);
    setError("");
    try {
      await createRegolaDeducibilita(form);
      setForm(formVuoto);
      await ricaricaRegole();
      await ricaricaTotali();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const cambiaRegola = async (id, patch) => {
    try {
      await updateRegolaDeducibilita(id, patch);
      await ricaricaRegole();
      await ricaricaTotali();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/fiscale" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Proiezione fiscale
        </Link>
        <div className="flex items-center gap-2">
          {entities && (
            <select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 text-sm text-b58-charcoal"
            >
              <option value={entities.srls.id}>{entities.srls.name}</option>
              {entities.agricola && (
                <option value={entities.agricola.id}>{entities.agricola.name}</option>
              )}
            </select>
          )}
          <select
            value={anno}
            onChange={(e) => setAnno(Number(e.target.value))}
            className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 text-sm text-b58-charcoal"
          >
            {[annoCorrente + 1, annoCorrente, annoCorrente - 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-1">Deducibilità dei costi</h1>
      <p className="text-xs text-b58-charcoal-soft/80 mb-6">
        Non tutto quello che si spende si scarica. Qui si dice quali costi si deducono e quanto, una volta
        per tutte le schermate: la Proiezione ne ha bisogno perché <strong>l&apos;utile e l&apos;imponibile
        sono due numeri diversi</strong>.
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {/* ---- Le due basi ------------------------------------------- */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-1">I costi del {anno}</h2>
        <p className="text-[11px] text-b58-charcoal-soft/70 mb-4">
          Uscite di prima nota e fatture fornitori. Le spese del modulo <em>Deduzioni</em> non sono
          sommate qui: finché non generano il loro movimento di cassa, contarle sarebbe contarle due volte.
        </p>

        {loading ? (
          <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
        ) : !rettifiche ? (
          <p className="text-sm text-b58-charcoal-soft/60">Nessun dato.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Riquadro etichetta="Costi totali" valore={rettifiche.costi_totali} />
              <Riquadro etichetta="Quota deducibile" valore={rettifiche.quota_deducibile} />
              <Riquadro
                etichetta="Non si deduce"
                valore={rettifiche.rettifica_in_aumento}
                nota="si somma all'imponibile"
              />
              <Riquadro
                etichetta="Non classificato"
                valore={rettifiche.non_classificato}
                nota={`${rettifiche.righe_non_classificate} voci — fuori da entrambi`}
                allarme={Number(rettifiche.righe_non_classificate) > 0}
              />
            </div>

            {/* ⚠️ L'avvertenza arriva dal database insieme al numero, non
                dal testo di questa pagina: una seconda schermata che
                mostrasse lo stesso numero se la porterebbe dietro. */}
            <p className="text-xs text-b58-charcoal-soft bg-white/70 rounded-lg px-3 py-2 ring-1 ring-b58-charcoal/10">
              {rettifiche.avvertenza}
            </p>
          </>
        )}
      </div>

      {/* ---- Cosa manca da classificare ----------------------------- */}
      {daClassificare.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
          <h2 className="font-display text-lg text-b58-charcoal mb-1">Da classificare</h2>
          <p className="text-[11px] text-b58-charcoal-soft/70 mb-4">
            Il modo più veloce di non rivederle più è dare una regola alla <strong>causale</strong> (in{" "}
            <Link to="/cassa/causali" className="underline">Cassa → Causali</Link>) o al{" "}
            <strong>fornitore</strong>: da lì in poi le righe la ereditano da sole.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                  <th className="py-2 font-medium">Data</th>
                  <th className="py-2 font-medium">Voce</th>
                  <th className="py-2 font-medium text-right">Importo</th>
                  <th className="py-2 font-medium">Perché</th>
                </tr>
              </thead>
              <tbody>
                {daClassificare.map((c) => (
                  <tr key={`${c.origine}-${c.riga_id}`} className="border-b border-b58-charcoal/5 last:border-0">
                    <td className="py-2 text-b58-charcoal-soft whitespace-nowrap">{formatDate(c.data)}</td>
                    <td className="py-2 text-b58-charcoal">
                      {c.etichetta}
                      <span className="text-xs text-b58-charcoal-soft">
                        {" "}· {c.origine === "fattura" ? "fattura" : "prima nota"}
                      </span>
                    </td>
                    <td className="py-2 text-right text-b58-charcoal-soft whitespace-nowrap">
                      {formatEUR(c.importo)}
                    </td>
                    <td className="py-2 text-xs text-b58-charcoal-soft">{c.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Le regole ---------------------------------------------- */}
      <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
        <h2 className="font-display text-lg text-b58-charcoal mb-1">Le regole</h2>
        <p className="text-[11px] text-b58-charcoal-soft/70 mb-4">
          Le decidi tu, come le causali. Quelle qui sotto erano già dentro il programma e sono state
          spostate senza cambiarne le percentuali:{" "}
          <strong>nessuna è stata confermata dalla commercialista</strong> — quando lo saranno, scrivi la
          data e l&apos;avviso sparisce da tutte le schermate insieme.
          {nonConfermate > 0 && (
            <> Oggi ne mancano <strong>{nonConfermate}</strong> (domande L4 e L9 per Laura).</>
          )}
        </p>

        <div className="overflow-x-auto mb-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                <th className="py-2 font-medium">Regola</th>
                <th className="py-2 font-medium text-right">Deducibile</th>
                <th className="py-2 font-medium">Vincoli</th>
                <th className="py-2 font-medium">Confermata il</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {regole.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-b58-charcoal/5 last:border-0 align-top ${r.attiva ? "" : "opacity-50"}`}
                >
                  <td className="py-2 text-b58-charcoal font-medium">
                    {r.etichetta}
                    {r.nota && (
                      <div className="text-[11px] font-normal text-b58-charcoal-soft/80 mt-0.5 max-w-md">
                        {r.nota}
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-right text-b58-charcoal whitespace-nowrap">
                    {Number(r.percentuale_deducibile)}%
                  </td>
                  <td className="py-2 text-xs text-b58-charcoal-soft">
                    {r.vieta_contante && <div>Il contante la rende indeducibile.</div>}
                    {r.soggetta_a_plafond && <div>Entro il plafond sui ricavi.</div>}
                    {!r.vieta_contante && !r.soggetta_a_plafond && <span>—</span>}
                  </td>
                  <td className="py-2">
                    <input
                      type="date"
                      value={r.verificata_il || ""}
                      onChange={(e) => cambiaRegola(r.id, { verificata_il: e.target.value || null })}
                      className="rounded-lg border border-b58-charcoal/15 bg-white px-2 py-1 text-xs text-b58-charcoal"
                    />
                    {!r.verificata_il && (
                      <div className="text-[11px] text-b58-gold-dark mt-0.5">mai confermata</div>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => cambiaRegola(r.id, { attiva: !r.attiva })}
                      className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                    >
                      {r.attiva ? "Disattiva" : "Riattiva"}
                    </button>
                  </td>
                </tr>
              ))}
              {regole.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-3 text-sm text-b58-charcoal-soft/60">
                    Nessuna regola.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-3">
            Nuova regola
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>Come la chiami</label>
              <input
                value={form.etichetta}
                onChange={(e) => setForm((f) => ({ ...f, etichetta: e.target.value }))}
                placeholder="es. Multe e sanzioni"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>% deducibile</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.percentuale_deducibile}
                onChange={(e) => setForm((f) => ({ ...f, percentuale_deducibile: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Riferimento (opz.)</label>
              <input
                value={form.riferimento_normativo}
                onChange={(e) => setForm((f) => ({ ...f, riferimento_normativo: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mb-3">
            <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft cursor-pointer">
              <input
                type="checkbox"
                checked={form.vieta_contante}
                onChange={(e) => setForm((f) => ({ ...f, vieta_contante: e.target.checked }))}
                className="accent-b58-terracotta"
              />
              pagata in contanti non si deduce
            </label>
            <label className="flex items-center gap-2 text-xs text-b58-charcoal-soft cursor-pointer">
              <input
                type="checkbox"
                checked={form.soggetta_a_plafond}
                onChange={(e) => setForm((f) => ({ ...f, soggetta_a_plafond: e.target.checked }))}
                className="accent-b58-terracotta"
              />
              soggetta al plafond sui ricavi
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={form.nota}
              onChange={(e) => setForm((f) => ({ ...f, nota: e.target.value }))}
              placeholder="Nota — a cosa serve ricordarsi che si applica (opz.)"
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={saving || !form.etichetta.trim()}
              onClick={aggiungiRegola}
              className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60 shrink-0"
            >
              {saving ? "Salvo…" : "+ Aggiungi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Riquadro({ etichetta, valore, nota, allarme }) {
  return (
    <div
      className={`rounded-lg bg-white px-3 py-2.5 ring-1 ${
        allarme ? "ring-b58-gold-dark/40" : "ring-b58-charcoal/10"
      }`}
    >
      <div className="text-[11px] uppercase tracking-wide text-b58-charcoal-soft">{etichetta}</div>
      <div className={`text-lg ${allarme ? "text-b58-gold-dark" : "text-b58-charcoal"}`}>
        {formatEUR(valore)}
      </div>
      {nota && <div className="text-[11px] text-b58-charcoal-soft/70 mt-0.5">{nota}</div>}
    </div>
  );
}
