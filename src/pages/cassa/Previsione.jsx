import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  chiudiScadenzaPrevista,
  createScadenzaPrevista,
  getImpostazioniTesoreria,
  getPosInTransito,
  getPrevisioneCassa,
  listMovimentiAttesi,
  listScadenzePreviste,
  salvaImpostazioniTesoreria,
} from "../../lib/api/cash";
import { getEntities } from "../../lib/api/entities";
import { formatDate, formatEUR, oggiLocale, traGiorniLocale } from "../../lib/constants";

// «Ce la faccio al 16?» — Blocco 6b del mandato.
//
// La domanda che chiude i ristoranti non è «quanto ho» ma «arrivo alla
// scadenza con i soldi sul conto». Chi guarda solo la cassa crede che
// agosto sia leggerissimo e settembre un disastro; chi guarda solo il
// conto economico sa se guadagna ma non se ce la fa il 16.
//
// ⚠️ Il caricamento dell'estratto conto NON c'è, ed è una decisione di
// Alessio del 15/08: il conto non è ancora aperto e non sappiamo che
// formato esporti l'home banking. Ma la riconciliazione che serve davvero
// funziona già senza: una fattura sparisce dalle uscite attese nel momento
// in cui la si registra pagata.

const ORIZZONTI = [
  { giorni: 7, label: "7 giorni" },
  { giorni: 30, label: "30 giorni" },
  { giorni: 60, label: "60 giorni" },
  { giorni: 90, label: "90 giorni" },
];

const formaVuota = { descrizione: "", importo: "", scadeIl: oggiLocale(), ogniMesi: "0", mezzo: "banca" };

export default function Previsione() {
  const [entities, setEntities] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [giorni, setGiorni] = useState(30);
  const [previsione, setPrevisione] = useState(null);
  const [pos, setPos] = useState(null);
  const [attesi, setAttesi] = useState([]);
  const [scadenze, setScadenze] = useState([]);
  const [impostazioni, setImpostazioni] = useState({ giorniAccredito: "", commissione: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(formaVuota);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getEntities()
      .then((ent) => {
        setEntities(ent);
        setEntityId(ent.srls.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  const finoAl = () => traGiorniLocale(giorni);

  const ricarica = () => {
    if (!entityId) return Promise.resolve();
    return Promise.all([
      getPrevisioneCassa(entityId, finoAl()),
      getPosInTransito(entityId),
      listMovimentiAttesi(entityId, finoAl()),
      listScadenzePreviste(entityId),
      getImpostazioniTesoreria(entityId),
    ]).then(([p, t, a, s, imp]) => {
      setPrevisione(p);
      setPos(t);
      setAttesi(a);
      setScadenze(s);
      setImpostazioni({
        giorniAccredito: imp?.giorni_accredito_pos ?? "",
        commissione: imp?.commissione_pos_percento ?? "",
      });
    });
  };

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    ricarica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, giorni]);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const labelClass =
    "block text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-1.5";

  const salvaPos = async () => {
    try {
      await salvaImpostazioniTesoreria(entityId, impostazioni);
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  const aggiungiScadenza = async () => {
    if (!form.descrizione.trim() || !form.importo) return;
    setSaving(true);
    setError("");
    try {
      await createScadenzaPrevista({ ...form, entityId });
      setForm({ ...formaVuota, scadeIl: form.scadeIl });
      await ricarica();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const chiudi = async (id) => {
    try {
      await chiudiScadenzaPrevista(id);
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  const negativo = previsione && Number(previsione.saldo_previsto) < 0;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/cassa" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
          ← Cassa, Banca e Prima Nota
        </Link>
        <div className="flex items-center gap-2">
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
          <select
            value={giorni}
            onChange={(e) => setGiorni(Number(e.target.value))}
            className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-1.5 text-sm text-b58-charcoal"
          >
            {ORIZZONTI.map((o) => (
              <option key={o.giorni} value={o.giorni}>fra {o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <h1 className="font-display text-2xl text-b58-charcoal mb-1">Ce la faccio?</h1>
      <p className="text-xs text-b58-charcoal-soft/80 mb-6">
        Sapere se guadagni è una domanda. Sapere se <strong>arrivi alla scadenza con i soldi sul
        conto</strong> è un&apos;altra, e non ha la stessa risposta: un costo di agosto può uscire a
        settembre.
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          {/* ---- La risposta ------------------------------------------ */}
          <div
            className={`rounded-xl p-6 ring-1 mb-6 ${
              negativo ? "bg-b58-terracotta/10 ring-b58-terracotta/40" : "bg-b58-parchment ring-b58-charcoal/10"
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft mb-1">
              Saldo previsto al {previsione ? formatDate(previsione.fino_al) : "—"}
            </div>
            <div
              className={`text-3xl font-medium mb-3 ${
                negativo ? "text-b58-terracotta-dark" : "text-b58-charcoal"
              }`}
            >
              {previsione ? formatEUR(previsione.saldo_previsto) : "—"}
            </div>

            {previsione && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-b58-charcoal-soft">
                <span>cassa {formatEUR(previsione.oggi_cassa)}</span>
                <span>+ banca {formatEUR(previsione.oggi_banca)}</span>
                <span>+ carta in arrivo {formatEUR(previsione.pos_in_arrivo)}</span>
                <span className="text-b58-terracotta-dark">
                  − da pagare {formatEUR(previsione.uscite_attese)} ({previsione.quante_uscite})
                </span>
              </div>
            )}

            {negativo && (
              <p className="text-sm text-b58-terracotta-dark mt-3 font-medium">
                Con quello che deve uscire, a quella data i soldi non bastano.
              </p>
            )}

            {/* ⚠️ L'avvertenza arriva dal database insieme al numero, e qui
                dichiara il buco più grosso: mancano gli stipendi, che sono
                la voce più pesante dell'anno. */}
            <p className="text-[11px] text-b58-charcoal-soft mt-3 bg-white/70 rounded-lg px-3 py-2 ring-1 ring-b58-charcoal/10 leading-relaxed">
              {previsione?.avvertenza}
            </p>
          </div>

          {/* ---- Cosa deve uscire ------------------------------------- */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <h2 className="font-display text-lg text-b58-charcoal mb-1">Cosa deve uscire</h2>
            <p className="text-[11px] text-b58-charcoal-soft/70 mb-4">
              Fatture e imposte non le scrivi tu: il gestionale le sa già. Una fattura{" "}
              <strong>sparisce da qui da sola</strong> quando la registri pagata.
            </p>
            {attesi.length === 0 ? (
              <p className="text-sm text-b58-charcoal-soft/60">
                Niente in scadenza entro quella data.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-b58-charcoal-soft border-b border-b58-charcoal/10">
                      <th className="py-2 font-medium">Quando</th>
                      <th className="py-2 font-medium">Cosa</th>
                      <th className="py-2 font-medium">Da dove</th>
                      <th className="py-2 pr-6 font-medium text-right">Importo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attesi.map((a, i) => (
                      <tr key={`${a.origine}-${a.riferimento ?? i}`} className="border-b border-b58-charcoal/5 last:border-0">
                        <td className="py-2 text-b58-charcoal-soft whitespace-nowrap">{formatDate(a.quando)}</td>
                        <td className="py-2 text-b58-charcoal">{a.descrizione}</td>
                        <td className="py-2 text-xs text-b58-charcoal-soft">
                          {a.origine === "fattura" ? "fattura fornitore" : a.origine === "imposta" ? "imposte" : "scritta da te"}
                          {" · "}
                          {a.mezzo}
                        </td>
                        <td className="py-2 pr-6 text-right text-b58-charcoal whitespace-nowrap">
                          {formatEUR(a.importo)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ---- Le scadenze che solo lui conosce --------------------- */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
            <h2 className="font-display text-lg text-b58-charcoal mb-1">Le tue scadenze fisse</h2>
            <p className="text-[11px] text-b58-charcoal-soft/70 mb-4">
              Affitto, rate, utenze: quello che il gestionale non può sapere da solo.{" "}
              <strong>Non scriverci le fatture dei fornitori</strong>: quelle le conta già, e finirebbero
              contate due volte.
            </p>

            {scadenze.length > 0 && (
              <ul className="space-y-1.5 mb-4">
                {scadenze.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-b58-charcoal">
                      {formatDate(s.scade_il)} · {s.descrizione}
                      {s.ogni_mesi > 0 && (
                        <span className="text-[11px] text-b58-charcoal-soft">
                          {" "}· ogni {s.ogni_mesi === 1 ? "mese" : `${s.ogni_mesi} mesi`}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="text-b58-charcoal-soft">{formatEUR(s.importo)}</span>
                      <button
                        onClick={() => chiudi(s.id)}
                        className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                      >
                        non serve più
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Cosa</label>
                  <input
                    value={form.descrizione}
                    onChange={(e) => setForm((f) => ({ ...f, descrizione: e.target.value }))}
                    placeholder="es. Affitto"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Importo €</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.importo}
                    onChange={(e) => setForm((f) => ({ ...f, importo: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Scade il</label>
                  <input
                    type="date"
                    value={form.scadeIl}
                    onChange={(e) => setForm((f) => ({ ...f, scadeIl: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className={labelClass}>Si ripete</label>
                  <select
                    value={form.ogniMesi}
                    onChange={(e) => setForm((f) => ({ ...f, ogniMesi: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="0">una volta sola</option>
                    <option value="1">ogni mese</option>
                    <option value="3">ogni 3 mesi</option>
                    <option value="12">ogni anno</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Esce da</label>
                  <select
                    value={form.mezzo}
                    onChange={(e) => setForm((f) => ({ ...f, mezzo: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="banca">banca</option>
                    <option value="cassa">cassa</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={saving || !form.descrizione.trim() || !form.importo}
                  onClick={aggiungiScadenza}
                  className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
                >
                  {saving ? "Salvo…" : "+ Aggiungi"}
                </button>
              </div>
            </div>
          </div>

          {/* ---- Il POS ------------------------------------------------ */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
            <h2 className="font-display text-lg text-b58-charcoal mb-1">Gli incassi con carta</h2>
            <p className="text-[11px] text-b58-charcoal-soft/70 mb-4">
              Quello che incassi col POS stasera <strong>non è in banca stasera</strong>: arriva dopo
              qualche giorno e al netto delle commissioni. Senza questa voce il saldo della banca non
              tornerebbe mai.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-b58-charcoal/10">
                <div className="text-[11px] uppercase tracking-wide text-b58-charcoal-soft">In arrivo (lordo)</div>
                <div className="text-lg text-b58-charcoal">{pos ? formatEUR(pos.lordo) : "—"}</div>
                <div className="text-[11px] text-b58-charcoal-soft/70">{pos?.conti ?? 0} conti</div>
              </div>
              <div className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-b58-charcoal/10">
                <div className="text-[11px] uppercase tracking-wide text-b58-charcoal-soft">Commissioni</div>
                <div className="text-lg text-b58-charcoal">
                  {pos?.commissioni != null ? formatEUR(pos.commissioni) : "—"}
                </div>
              </div>
              <div className="rounded-lg bg-white px-3 py-2.5 ring-1 ring-b58-charcoal/10">
                <div className="text-[11px] uppercase tracking-wide text-b58-charcoal-soft">Arriverà</div>
                <div className="text-lg text-b58-charcoal">
                  {pos?.netto_atteso != null ? formatEUR(pos.netto_atteso) : "—"}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-b58-charcoal-soft bg-white/70 rounded-lg px-3 py-2 ring-1 ring-b58-charcoal/10 mb-4 leading-relaxed">
              {pos?.avvertenza}
            </p>

            <div className="bg-white rounded-lg border border-b58-charcoal/10 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className={labelClass}>Accredita dopo (giorni)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={impostazioni.giorniAccredito}
                    onChange={(e) => setImpostazioni((i) => ({ ...i, giorniAccredito: e.target.value }))}
                    placeholder="non lo so"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Commissione %</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={impostazioni.commissione}
                    onChange={(e) => setImpostazioni((i) => ({ ...i, commissione: e.target.value }))}
                    placeholder="non lo so"
                    className={inputClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={salvaPos}
                  className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm px-4 py-2"
                >
                  Salva
                </button>
              </div>
              <p className="text-[11px] text-b58-charcoal-soft/70 mt-2">
                Lasciali vuoti finché non te lo dice la banca: <strong>vuoto vuol dire «non lo so»</strong>,
                e il gestionale lo scrive invece di inventare un numero.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
