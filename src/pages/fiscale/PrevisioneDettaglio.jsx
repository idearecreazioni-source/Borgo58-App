import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  calendarioImposte,
  confrontoColFoglio,
  congelaScenario,
  getScenario,
  proiezioneScenario,
  riepilogoScenario,
} from "../../lib/api/proiezione";
import { formatEUR } from "../../lib/constants";

const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

function Numero({ v, decimali = 0 }) {
  if (v == null) return <span className="text-b58-charcoal-soft/50">—</span>;
  return (
    <span className={Number(v) < 0 ? "text-b58-terracotta-dark" : undefined}>
      {Number(v).toLocaleString("it-IT", { minimumFractionDigits: decimali, maximumFractionDigits: decimali })}
    </span>
  );
}

export default function PrevisioneDettaglio() {
  const { id } = useParams();
  const [scenario, setScenario] = useState(null);
  const [mesi, setMesi] = useState([]);
  const [riepilogo, setRiepilogo] = useState(null);
  const [confronto, setConfronto] = useState([]);
  const [calendario, setCalendario] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [congelando, setCongelando] = useState(false);

  const carica = useCallback(async () => {
    const s = await getScenario(id);
    setScenario(s);
    const [m, r, c] = await Promise.all([
      proiezioneScenario(id),
      riepilogoScenario(id),
      confrontoColFoglio(id),
    ]);
    setMesi(m);
    setRiepilogo(r);
    setConfronto(c);
    if (r?.imposte != null) {
      setCalendario(await calendarioImposte(s.entity_id, s.anno, r.imposte));
    } else {
      setCalendario([]);
    }
  }, [id]);

  useEffect(() => {
    carica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [carica]);

  const chiudi = async () => {
    if (
      !confirm(
        "Chiudere questa previsione? Da adesso non si potrà più cambiare, e non c'è modo di riaprirla: " +
          "per cambiare rotta se ne crea una nuova, che resta confrontabile con questa."
      )
    )
      return;
    setCongelando(true);
    setError("");
    try {
      await congelaScenario(id);
      await carica();
    } catch (e) {
      setError(e.message);
    } finally {
      setCongelando(false);
    }
  };

  if (loading) return <p className="text-sm text-b58-charcoal-soft max-w-5xl mx-auto">Caricamento…</p>;
  if (!scenario) return <p className="text-sm text-b58-charcoal-soft max-w-5xl mx-auto">Non trovata.</p>;

  const differenze = confronto.filter((c) => Math.abs(Number(c.differenza)) > 0.01);
  const righe = [
    ["Coperti", "coperti", 0],
    ["Ricavi di sala", "ricavi_sala", 0],
    ["Costi variabili", "costi_variabili", 0],
    ["Margine di contribuzione", "margine_contribuzione", 0],
    ["Personale", "personale", 0],
    ["Costi fissi", "costi_fissi_totali", 0],
    ["EBITDA solo sala", "ebitda_sala", 0],
    ["Ricavi accessori", "ricavi_accessori", 0],
    ["Margine accessori", "margine_accessori", 0],
    ["Ricavi totali", "ricavi_totali", 0],
    ["EBITDA complessivo", "ebitda", 0],
    ["Ammortamenti", "ammortamenti", 0],
    ["EBIT", "ebit", 0],
  ];

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <Link to="/fiscale/previsioni" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Le previsioni
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap mt-1 mb-4">
        <div>
          <h1 className="font-display text-2xl text-b58-charcoal">{scenario.nome}</h1>
          <p className="text-xs text-b58-charcoal-soft mt-0.5">
            {scenario.anno} · {scenario.tipo === "partenza" ? "previsione di partenza" : "riproiezione"}
            {scenario.versione_foglio && <> · {scenario.versione_foglio}</>}
          </p>
        </div>
        {scenario.congelato_il ? (
          <span className="text-xs text-b58-olive-dark bg-b58-olive/10 rounded-lg px-3 py-1.5">
            Chiusa il {new Date(scenario.congelato_il).toLocaleDateString("it-IT")} — non si cambia più
          </span>
        ) : (
          <button
            onClick={chiudi}
            disabled={congelando}
            className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
          >
            {congelando ? "Chiudo…" : "Chiudi questa previsione"}
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* --- Il confronto col foglio --- */}
      {confronto.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-6">
          <h2 className="font-display text-lg text-b58-charcoal mb-1">Torna col tuo foglio?</h2>
          {differenze.length === 0 ? (
            <p className="text-sm text-b58-olive-dark">
              Sì: tutti e {confronto.length} i totali del foglio sono riprodotti esattamente, EBITDA e
              pareggio compresi.
            </p>
          ) : (
            <>
              <p className="text-sm text-b58-terracotta-dark mb-2">
                No: {differenze.length} {differenze.length === 1 ? "totale non torna" : "totali non tornano"}.
                Finché non torna, questa previsione non descrive il tuo piano.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-b58-charcoal-soft">
                    <th className="text-left font-medium py-1">Voce</th>
                    <th className="text-right font-medium py-1">Dal foglio</th>
                    <th className="text-right font-medium py-1">Qui</th>
                    <th className="text-right font-medium py-1">Differenza</th>
                  </tr>
                </thead>
                <tbody>
                  {differenze.map((d) => (
                    <tr key={d.voce} className="border-t border-b58-charcoal/5">
                      <td className="py-1 text-b58-charcoal">{d.voce}</td>
                      <td className="py-1 text-right tabular-nums"><Numero v={d.dal_foglio} decimali={2} /></td>
                      <td className="py-1 text-right tabular-nums"><Numero v={d.calcolato} decimali={2} /></td>
                      <td className="py-1 text-right tabular-nums"><Numero v={d.differenza} decimali={2} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* --- Il riepilogo dell'anno --- */}
      {riepilogo && (
        <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-6">
          <h2 className="font-display text-lg text-b58-charcoal mb-3">L&apos;anno</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-b58-charcoal-soft">Ricavi totali</p>
              <p className="text-b58-charcoal">{formatEUR(riepilogo.ricavi_totali)}</p>
            </div>
            <div>
              <p className="text-xs text-b58-charcoal-soft">EBITDA</p>
              <p className="text-b58-charcoal">{formatEUR(riepilogo.ebitda)}</p>
            </div>
            <div>
              <p className="text-xs text-b58-charcoal-soft">Pareggio (sola sala)</p>
              <p className="text-b58-charcoal">{riepilogo.bep_solo_sala} coperti</p>
            </div>
            <div>
              <p className="text-xs text-b58-charcoal-soft">Pareggio (con accessorie)</p>
              <p className="text-b58-charcoal">{riepilogo.bep_con_accessorie} coperti</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-b58-charcoal/10 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-b58-charcoal-soft">Risultato prima delle imposte</p>
              <p className="text-b58-charcoal">{formatEUR(riepilogo.ante_imposte)}</p>
            </div>
            <div>
              <p className="text-xs text-b58-charcoal-soft">Imposte stimate</p>
              <p className="text-b58-charcoal">
                {riepilogo.imposte == null ? "—" : formatEUR(riepilogo.imposte)}
              </p>
            </div>
            <div>
              <p className="text-xs text-b58-charcoal-soft">Utile netto</p>
              <p className="text-b58-charcoal">
                {riepilogo.utile_netto == null ? "—" : formatEUR(riepilogo.utile_netto)}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-b58-terracotta-dark bg-b58-terracotta/10 rounded px-2 py-1.5 mt-3">
            {riepilogo.avvertenza_imposte}
          </p>
        </div>
      )}

      {/* --- Il calendario degli esborsi --- */}
      {calendario.length > 0 && (
        <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-6">
          <h2 className="font-display text-lg text-b58-charcoal mb-1">Quando escono i soldi</h2>
          <p className="text-xs text-b58-charcoal-soft mb-3">
            Non basta sapere quanto: è la cassa di giugno che tradisce, quando il saldo dell&apos;anno prima
            e il primo acconto cadono insieme.
          </p>
          <table className="w-full text-sm">
            <tbody>
              {calendario.map((c) => (
                <tr key={c.voce} className="border-t border-b58-charcoal/5">
                  <td className="py-1.5 text-b58-charcoal-soft w-24">
                    {new Date(c.scadenza).toLocaleDateString("it-IT")}
                  </td>
                  <td className="py-1.5 text-b58-charcoal">
                    {c.voce}
                    <span className="block text-[11px] text-b58-charcoal-soft/70">{c.nota}</span>
                  </td>
                  <td className="py-1.5 text-right text-b58-charcoal tabular-nums">{formatEUR(c.importo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- I dodici mesi --- */}
      <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 overflow-x-auto">
        <h2 className="font-display text-lg text-b58-charcoal mb-3">I dodici mesi</h2>
        <table className="w-full text-xs min-w-[720px]">
          <thead>
            <tr className="text-b58-charcoal-soft">
              <th className="text-left font-medium py-1 pr-2 sticky left-0 bg-white">&nbsp;</th>
              {MESI.map((m) => (
                <th key={m} className="text-right font-medium py-1 px-1">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {righe.map(([etichetta, campo, dec]) => (
              <tr key={campo} className="border-t border-b58-charcoal/5">
                <td className="py-1 pr-2 text-b58-charcoal-soft whitespace-nowrap sticky left-0 bg-white">
                  {etichetta}
                </td>
                {mesi.map((m) => (
                  <td key={m.mese} className="py-1 px-1 text-right tabular-nums text-b58-charcoal">
                    <Numero v={m[campo]} decimali={dec} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
