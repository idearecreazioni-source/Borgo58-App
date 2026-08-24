import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getEntities } from "../../lib/api/entities";
import {
  andamentoAnno,
  budgetOmaggi,
  chiudiMese,
  listaConsuntivi,
  listaScenari,
  misureDelMese,
  omaggiPerCausale,
  imposteEFiscalizzato,
  proiezioneFineAnno,
  scostamentoMensile,
  cancellaConsuntivo,
  cancellaPeriodoAnomalo,
  creaPeriodoAnomalo,
  listaPeriodiAnomali,
  statoConfrontoMensile,
} from "../../lib/api/proiezione";
import { formatDate, formatEUR, oggiLocale } from "../../lib/constants";
import DatoNonLetto from "../../components/DatoNonLetto";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import { annoDiverso, scegliScenario } from "../../lib/calcoli/scenarioDaConfrontare";
import { senzaRipetizioni } from "../../lib/calcoli/avvertenze";
import Didascalia from "../../components/Didascalia";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

function Valore({ v, euro = true }) {
  if (v == null) return <span className="text-b58-charcoal-soft/50">non misurato</span>;
  return <>{euro ? formatEUR(v) : Number(v).toLocaleString("it-IT")}</>;
}

export default function AndamentoMensile() {
  const oggi = new Date(oggiLocale());
  const [entities, setEntities] = useState(null);
  const [scenari, setScenari] = useState([]);
  const [scenarioId, setScenarioId] = useState("");
  const [anno, setAnno] = useState(oggi.getFullYear());
  const [mese, setMese] = useState(oggi.getMonth() + 1);
  const [misure, setMisure] = useState(null);
  const [stato, setStato] = useState(null);
  const [scostamento, setScostamento] = useState([]);
  const [budget, setBudget] = useState(null);
  const [omaggi, setOmaggi] = useState([]);
  const [consuntivi, setConsuntivi] = useState([]);
  const [periodi, setPeriodi] = useState([]);
  const [nuovoPeriodo, setNuovoPeriodo] = useState({ dal: "", al: "", tipo: "chiusura", nota: "" });
  const [anno_, setAnno_] = useState([]);
  const [fineAnno, setFineAnno] = useState(null);
  const [dueImposte, setDueImposte] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [chiudendo, setChiudendo] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ent = await getEntities();
        setEntities(ent);
        const s = await listaScenari(ent.srls.id);
        setScenari(s);
        // 🔴 SI PARTE DA UNA PREVISIONE DELL'ANNO CHE SI STA GUARDANDO
        // (24/08/2026). Prima si prendeva «la chiusa più recente, oppure
        // la prima della lista»: e la lista è ordinata per anno
        // decrescente, quindi con un piano del 2027 in casa la schermata
        // apriva confrontando i numeri veri del 2026 con quello — un
        // risultato d'anno di 25,9 milioni di euro, e **nessuna riga che
        // dicesse che il piano era di un altro anno**.
        // ⚠️ Senza previsioni dell'anno giusto non si ripiega su un altro:
        // si resta senza. La regola sta in un posto solo, con le sue prove.
        const scelto = scegliScenario(s, anno);
        if (scelto) setScenarioId(scelto);
      } catch (e) {
        setError(e.message);
      }
    })();
    // Gira una volta sola, all'apertura: l'anno di partenza è quello di
    // oggi. Cambiandolo a mano la scelta NON si sposta da sé — cambiare in
    // silenzio quello che l'utente ha scelto è il difetto del 12/08. Se
    // resta di un altro anno, la riga qui sotto lo dice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entityId = entities?.srls?.id;
  const annoAltrove = annoDiverso(scenari, scenarioId, anno);

  // 🔴 LA STESSA NOTA COMPARIVA DUE VOLTE (misurato a schermo il 24/08).
  // Non per una svista: le due avvertenze arrivano dal database e
  // **contengono entrambe** la frase sull'IRAP, perché
  // `calcola_imposte()` restituisce il numero e la frase che ne dichiara
  // il limite — scelta del 15/08, ed è giusta. Il difetto nasce quando le
  // due schermate che mostrano quel numero sono la stessa.
  // ⚠️ La prima resta INTERA: togliere la frase a tutte e due lascerebbe
  // il numero senza il suo limite dichiarato in nessun punto.
  const [avvisoImposte, avvisoFineAnno, avvisoBudget] = senzaRipetizioni([
    dueImposte?.avvertenza,
    fineAnno?.avvertenza,
    budget?.avvertenza,
  ]);

  const carica = useCallback(async () => {
    if (!entityId) return;
    const [m, st, cons, per] = await Promise.all([
      misureDelMese(entityId, anno, mese),
      statoConfrontoMensile(entityId, anno, mese),
      listaConsuntivi(entityId),
      listaPeriodiAnomali(entityId),
    ]);
    setMisure(m);
    setStato(st);
    setConsuntivi(cons);
    setPeriodi(per);
    setOmaggi(await omaggiPerCausale(entityId, anno, mese));
    if (scenarioId) {
      const [sc, bo, aa, fa] = await Promise.all([
        scostamentoMensile(entityId, anno, mese, scenarioId),
        budgetOmaggi(entityId, anno, mese, scenarioId),
        andamentoAnno(entityId, anno, scenarioId),
        proiezioneFineAnno(entityId, anno, scenarioId),
      ]);
      setScostamento(sc);
      setBudget(bo);
      setAnno_(aa);
      setFineAnno(fa);
      // Le due cifre delle imposte: su tutto l'incassato e sul solo
      // fiscalizzato. Si chiedono sull'imponibile proiettato, cioè sullo
      // stesso numero da cui esce la stima mostrata accanto.
      setDueImposte(
        fa?.ante_imposte_proiettato == null
          ? null
          : await leggi(imposteEFiscalizzato(entityId, anno, fa.ante_imposte_proiettato))
      );
    } else {
      setScostamento([]);
      setBudget(null);
      setAnno_([]);
      setFineAnno(null);
    }
  }, [entityId, anno, mese, scenarioId]);

  useEffect(() => {
    setLoading(true);
    carica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [carica]);

  const inputClass =
    "rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  // ⚠️ DUE GESTI SEPARATI, non «cancella e rifai» in un colpo solo
  // (decisione di Alessio, 16/08): prima si cancella, poi si rifotografa.
  // Così non si sovrascrive per inerzia. La fotografia cancellata resta
  // nel registro delle cancellazioni, ed è da lì che la prossima saprà di
  // essere una seconda — nessuno deve ricordarsi di segnarlo.
  const cancella = async (id) => {
    setError("");
    try {
      await cancellaConsuntivo(id);
      await carica();
    } catch (e) {
      setError(e.message);
    }
  };

  const aggiungiPeriodo = async () => {
    setError("");
    try {
      await creaPeriodoAnomalo({
        entity_id: entityId,
        dal: nuovoPeriodo.dal,
        al: nuovoPeriodo.al,
        tipo: nuovoPeriodo.tipo,
        nota: nuovoPeriodo.nota.trim() || null,
      });
      setNuovoPeriodo({ dal: "", al: "", tipo: "chiusura", nota: "" });
      await carica();
    } catch (e) {
      setError(e.message);
    }
  };

  const togliPeriodo = async (id) => {
    setError("");
    try {
      await cancellaPeriodoAnomalo(id);
      await carica();
    } catch (e) {
      setError(e.message);
    }
  };

  const chiudi = async () => {
    if (!confirm(`Chiudere ${MESI[mese - 1]} ${anno}? La fotografia non si potrà più rifare.`)) return;
    setChiudendo(true);
    setError("");
    try {
      await chiudiMese(entityId, anno, mese);
      await carica();
    } catch (e) {
      setError(e.message);
    } finally {
      setChiudendo(false);
    }
  };

  const misurati = scostamento.filter((s) => s.misurato && s.scostamento != null);
  const spiegato = misurati.reduce((t, s) => t + Number(s.scostamento), 0);

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <Link to="/fiscale" className="tocco-bottone inline-flex items-center text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Proiezione fiscale
      </Link>
      <h1 className="font-display text-2xl text-b58-charcoal mt-1 mb-4">Come sta andando</h1>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <div className="flex flex-wrap gap-2 items-end mb-6">
        <div>
          <label className="block text-xs text-b58-charcoal-soft mb-1">Mese</label>
          <select value={mese} onChange={(e) => setMese(Number(e.target.value))} className={inputClass}>
            {MESI.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-b58-charcoal-soft mb-1">Anno</label>
          <input type="number" value={anno} onChange={(e) => setAnno(Number(e.target.value))} className={`${inputClass} w-24`} />
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-b58-charcoal-soft mb-1">Confrontato con</label>
          <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)} className={`${inputClass} w-full`}>
            <option value="">— nessuna previsione —</option>
            {scenari.map((s) => (
              <option key={s.id} value={s.id}>
                {/* ⚠️ L'ANNO SI VEDE. Senza, due previsioni di due anni
                    diversi con nomi simili sono indistinguibili nel menu,
                    e sceglierne una per l'altra non dà nessun segnale. */}
                {s.nome} · {s.anno} {s.congelato_il ? "(chiusa)" : "(aperta)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 🔴 IL PIANO E' DI UN ALTRO ANNO, E SI DICE. Non si impedisce —
          guardare il 2026 col piano del 2027 può avere senso una volta —
          ma non deve poter succedere senza saperlo: i numeri del fondo
          tabella diventano quelli di un altro anno, e la metà alta resta
          perfettamente sana. È il modo peggiore di sbagliare. */}
      {annoAltrove != null && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          <strong>Attenzione:</strong> stai guardando il {anno} confrontato con una previsione del{" "}
          {annoAltrove}. I numeri del piano, la stima a dicembre e le imposte qui sotto sono quelli
          del {annoAltrove}, non del {anno}.
        </p>
      )}

      {stato?.parziale && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">
          <strong>Mese in corso:</strong> {stato.giorni_trascorsi} giorni su {stato.giorni_mese}. Il
          confronto è rapportato ai giorni passati, quindi è una fotografia parziale — non un mese andato
          male.
        </p>
      )}
      {stato?.periodo_anomalo && (
        <p className="text-sm text-b58-charcoal-soft bg-b58-cream-dark rounded-lg px-3 py-2 mb-4">
          In questo mese c&apos;è un periodo segnato come <strong>{stato.periodo_anomalo}</strong>: il
          confronto con lo stesso mese di un altro anno non varrebbe.
        </p>
      )}

      {/* ⚠️ Il filo scollegato (Blocco 5.2 del mandato di correzione):
          l'app mostrava l'avviso «periodo anomalo» qui sopra, le funzioni
          per crearli esistevano dal 14/08 — e NESSUNA schermata li
          creava. Un avviso che non può mai comparire è peggio di nessun
          avviso: dice che il gestionale se ne occupa, e non è vero. */}
      <details className="mb-6 rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 px-4 py-3">
        <summary className="text-sm text-b58-charcoal cursor-pointer">
          Periodi da non confrontare ({periodi.length})
        </summary>
        <p className="text-xs text-b58-charcoal-soft/80 mt-2 mb-3">
          Apertura, chiusure, lavori: mesi che non si possono confrontare con lo stesso
          mese di un altro anno. Vanno segnati <strong>quando succedono</strong> — fra un
          anno nessuno si ricorderà perché quel mese è andato così.
        </p>
        {periodi.length > 0 && (
          <ul className="space-y-1 mb-3 text-sm">
            {periodi.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="text-b58-charcoal-soft">
                  {formatDate(p.dal)} → {formatDate(p.al)} · <strong>{p.tipo}</strong>
                  {p.nota ? ` · ${p.nota}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => togliPeriodo(p.id)}
                  className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                >
                  togli
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 items-end">
          <input
            type="date"
            value={nuovoPeriodo.dal}
            onChange={(e) => setNuovoPeriodo((p) => ({ ...p, dal: e.target.value }))}
            className={inputClass}
          />
          <input
            type="date"
            value={nuovoPeriodo.al}
            onChange={(e) => setNuovoPeriodo((p) => ({ ...p, al: e.target.value }))}
            className={inputClass}
          />
          <select
            value={nuovoPeriodo.tipo}
            onChange={(e) => setNuovoPeriodo((p) => ({ ...p, tipo: e.target.value }))}
            className={inputClass}
          >
            <option value="apertura">apertura</option>
            <option value="chiusura">chiusura</option>
            <option value="lavori">lavori</option>
            <option value="altro">altro</option>
          </select>
          <input
            value={nuovoPeriodo.nota}
            onChange={(e) => setNuovoPeriodo((p) => ({ ...p, nota: e.target.value }))}
            placeholder="perché (opz.)"
            className={inputClass}
          />
          <button
            type="button"
            disabled={!nuovoPeriodo.dal || !nuovoPeriodo.al}
            onClick={aggiungiPeriodo}
            className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
          >
            + Segna
          </button>
        </div>
      </details>

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          {/* --- Cosa si è potuto misurare --- */}
          <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-6">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <h2 className="font-display text-lg text-b58-charcoal">Il mese vero</h2>
              {!stato?.mese_chiuso && !stato?.parziale && (
                <button
                  onClick={chiudi}
                  disabled={chiudendo}
                  className="rounded-lg bg-b58-terracotta text-b58-parchment text-sm px-4 py-2 disabled:opacity-60"
                >
                  {chiudendo ? "Chiudo…" : "Fotografa questo mese"}
                </button>
              )}
              {stato?.mese_chiuso && (
                <span className="text-xs text-b58-olive-dark bg-b58-olive/10 rounded-lg px-3 py-1.5">
                  Mese chiuso — questi numeri non cambiano più
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-b58-charcoal-soft">Conti chiusi</p>
                <p className="text-b58-charcoal">{misure?.conti_chiusi ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-b58-charcoal-soft">Coperti</p>
                <p className="text-b58-charcoal"><Valore v={misure?.coperti} euro={false} /></p>
              </div>
              <div>
                <p className="text-xs text-b58-charcoal-soft">Incassato</p>
                <p className="text-b58-charcoal"><Valore v={misure?.ricavi} /></p>
              </div>
              <div>
                <p className="text-xs text-b58-charcoal-soft">Food cost reale</p>
                <p className="text-b58-charcoal"><Valore v={misure?.food_cost} /></p>
              </div>
            </div>
            <p className="text-[11px] text-b58-charcoal-soft/70 mt-3">
              «Non misurato» vuol dire che quel numero non c&apos;è ancora — non che è zero. Il food cost
              arriva dalle ricette, i costi fissi dalle causali di prima nota che hai segnato come tali.
            </p>
          </div>

          {/* --- Il piano sovrapposto ai numeri veri --- */}
          {anno_.length > 0 && (
            <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-6 overflow-x-auto">
              <h2 className="font-display text-lg text-b58-charcoal mb-4">
                In che direzione stiamo andando — {anno}
                <Didascalia>
                  Dall&apos;inizio dell&apos;anno a oggi, voce per voce, e dove si arriva a dicembre se
                  da domani tieni la rotta. I mesi che restano valgono quello che avevi previsto tu:
                  un mese buono non viene moltiplicato per dodici.
                </Didascalia>
              </h2>
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-b58-charcoal-soft">
                    <th className="text-left font-medium py-1">Voce</th>
                    <th className="text-right font-medium py-1">Previsto a oggi</th>
                    <th className="text-right font-medium py-1">Reale a oggi</th>
                    <th className="text-right font-medium py-1">Scarto</th>
                    <th className="text-right font-medium py-1">Piano anno</th>
                    <th className="text-right font-medium py-1">Stima a dicembre</th>
                  </tr>
                </thead>
                <tbody>
                  {anno_.map((r) => {
                    const q = (v) =>
                      v == null ? "—" :
                      r.unita === "euro" ? formatEUR(v) :
                      r.unita === "percento" ? `${Number(v).toLocaleString("it-IT", { maximumFractionDigits: 1 })}%` :
                      Number(v).toLocaleString("it-IT", { maximumFractionDigits: 0 });
                    return (
                      <tr key={r.indicatore} className="border-t border-b58-charcoal/5 align-top">
                        <td className="py-1.5 text-b58-charcoal">
                          {r.indicatore}
                          {/* La spiegazione non sparisce: si apre dal segno.
                              Sei righe con sei spiegazioni sotto sono sei
                              righe che nessuno rilegge dopo il primo
                              giorno, e intanto raddoppiano l'altezza della
                              tabella su un tablet da 8 pollici. */}
                          {r.spiegazione && <Didascalia>{r.spiegazione}</Didascalia>}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-b58-charcoal-soft">{q(r.previsto_a_oggi)}</td>
                        <td className="py-1.5 text-right tabular-nums text-b58-charcoal">
                          {r.misurato ? q(r.reale_a_oggi)
                            : <span className="text-b58-charcoal-soft/50 text-xs">non misurato</span>}
                        </td>
                        <td className={`py-1.5 text-right tabular-nums ${r.peggiora ? "text-b58-terracotta-dark font-medium" : "text-b58-olive-dark"}`}>
                          {r.scarto_percento == null ? "—"
                            : r.unita === "percento"
                              ? `${Number(r.scarto_percento) > 0 ? "+" : ""}${Number(r.scarto_percento).toLocaleString("it-IT", { maximumFractionDigits: 1 })} punti`
                              : `${Number(r.scarto_percento) > 0 ? "+" : ""}${Number(r.scarto_percento).toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-b58-charcoal-soft">{q(r.previsto_anno)}</td>
                        <td className="py-1.5 text-right tabular-nums text-b58-charcoal font-medium">
                          {q(r.proiettato_anno)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {fineAnno && (
                <div className="mt-5 pt-4 border-t border-b58-charcoal/10">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-b58-charcoal-soft">Risultato — piano</p>
                      <p className="text-b58-charcoal">{formatEUR(fineAnno.ante_imposte_piano)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-b58-charcoal-soft">Risultato — stima</p>
                      <p className="text-b58-charcoal font-medium">{formatEUR(fineAnno.ante_imposte_proiettato)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-b58-charcoal-soft">Imposte — piano</p>
                      <p className="text-b58-charcoal">
                        {fineAnno.imposte_piano == null ? "—" : formatEUR(fineAnno.imposte_piano)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-b58-charcoal-soft">Imposte — stima</p>
                      <p className="text-b58-charcoal font-medium">
                        {fineAnno.imposte_proiettate == null ? "—" : formatEUR(fineAnno.imposte_proiettate)}
                      </p>
                    </div>
                  </div>
                  {/* ⚠️ Le DUE cifre delle imposte (16/08/2026, decisione di
                      Alessio). I ricavi restano interi — se li riducessimo,
                      scontrino medio, food cost in percentuale e scostamento
                      direbbero il falso — e la distinzione vive qui, dove è
                      pertinente. La cifra vera sta fra le due, e si sposta
                      verso la prima man mano che i conti in sospeso vengono
                      regolarizzati. */}
                  {/* 🔴 Senza questa riga, «non ho potuto leggerle» si legge
                      come «non ci sono conti da sistemare»: cioè come una
                      stima delle imposte già affidabile. */}
                  {nonLetto(dueImposte) && (
                    <DatoNonLetto
                      cosa="quanta parte dell'incassato è già scontrinata"
                      nonVuolDire="Non vuol dire che è tutto a posto: vuol dire che non lo so. La stima qui sopra potrebbe essere più bassa del dovuto."
                      className="mt-3"
                    />
                  )}
                  {!nonLetto(dueImposte) && dueImposte && Number(dueImposte.conti_sospesi) > 0 && (
                    <div className="mt-4 rounded-lg bg-b58-gold/10 ring-1 ring-b58-gold-dark/30 px-3 py-2.5">
                      <p className="text-xs font-medium text-b58-charcoal mb-1.5">
                        Imposte: la cifra vera sta fra queste due
                      </p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-b58-charcoal-soft">Su tutto l&apos;incassato</p>
                          <p className="text-b58-charcoal font-medium">
                            {formatEUR(dueImposte.su_tutto_incassato)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-b58-charcoal-soft">Sul solo fiscalizzato</p>
                          <p className="text-b58-charcoal font-medium">
                            {formatEUR(dueImposte.su_solo_fiscalizzato)}
                          </p>
                        </div>
                      </div>
                      {avvisoImposte && (
                        <p className="text-[11px] text-b58-charcoal-soft mt-2 leading-relaxed">
                          {avvisoImposte}
                        </p>
                      )}
                      <Link
                        to="/cassa/scontrinato"
                        className="text-[11px] text-b58-terracotta-dark underline mt-1 inline-block"
                      >
                        Vedi i {dueImposte.conti_sospesi} conti da sistemare →
                      </Link>
                    </div>
                  )}
                  <p className={`text-[11px] rounded px-2 py-1.5 mt-3 ${fineAnno.voci_misurate > 0 ? "text-b58-charcoal-soft bg-b58-cream-dark" : "text-b58-terracotta-dark bg-b58-terracotta/10"}`}>
                    {fineAnno.voci_misurate} voci misurate su {fineAnno.voci_totali}. {avvisoFineAnno}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* --- Lo scostamento --- */}
          {scostamento.length > 0 && (
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-6">
              <h2 className="font-display text-lg text-b58-charcoal mb-3">
                Da dove viene lo scostamento
                <Didascalia>
                  «Sotto di tanto» non basta a decidere cosa fare: coperti, scontrino
                  medio, food cost e costi fissi si correggono in quattro modi diversi.
                </Didascalia>
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-b58-charcoal-soft">
                    <th className="text-left font-medium py-1">Voce</th>
                    <th className="text-right font-medium py-1">Previsto</th>
                    <th className="text-right font-medium py-1">Reale</th>
                    <th className="text-right font-medium py-1">Effetto</th>
                  </tr>
                </thead>
                <tbody>
                  {scostamento.map((s) => (
                    <tr key={s.voce} className="border-t border-b58-charcoal/5 align-top">
                      <td className="py-1.5 text-b58-charcoal">
                        {s.voce}
                        <span className="block text-[11px] text-b58-charcoal-soft/70">{s.spiegazione}</span>
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-b58-charcoal-soft">
                        {s.previsto == null ? "—" : Number(s.previsto).toLocaleString("it-IT")}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-b58-charcoal">
                        {s.misurato ? (s.reale == null ? "—" : Number(s.reale).toLocaleString("it-IT"))
                          : <span className="text-b58-charcoal-soft/50 text-xs">non misurato</span>}
                      </td>
                      <td className={`py-1.5 text-right tabular-nums ${Number(s.scostamento) < 0 ? "text-b58-terracotta-dark" : "text-b58-olive-dark"}`}>
                        {s.scostamento == null ? "—" : formatEUR(s.scostamento)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-b58-charcoal/20">
                    <td className="py-1.5 text-b58-charcoal font-medium" colSpan={3}>
                      Quanto si spiega con ciò che è misurato
                      <span className="block text-[11px] font-normal text-b58-charcoal-soft/70">
                        {misurati.length} voci su {scostamento.length}
                      </span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-b58-charcoal font-medium">
                      {formatEUR(spiegato)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* --- Il budget degli omaggi --- */}
          {budget && (
            <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-6">
              <h2 className="font-display text-lg text-b58-charcoal mb-3">Quanti omaggi puoi permetterti</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-xs text-b58-charcoal-soft">Margine sopra il pareggio</p>
                  <p className="text-b58-charcoal">{formatEUR(budget.margine_disponibile)}</p>
                </div>
                <div>
                  <p className="text-xs text-b58-charcoal-soft">Costo di un coperto</p>
                  <p className="text-b58-charcoal">
                    {budget.costo_per_coperto == null ? "—" : formatEUR(budget.costo_per_coperto)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-b58-charcoal-soft">Te ne puoi permettere</p>
                  <p className="text-b58-charcoal">{budget.omaggi_possibili ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-b58-charcoal-soft">Già fatti questo mese</p>
                  <p className="text-b58-charcoal">
                    {budget.omaggi_fatti} · {formatEUR(budget.costo_omaggi_fatti ?? 0)}
                  </p>
                </div>
              </div>
              {avvisoBudget && (
                <p className={`text-[11px] rounded px-2 py-1.5 mt-3 ${budget.misurato ? "text-b58-olive-dark bg-b58-olive/10" : "text-b58-terracotta-dark bg-b58-terracotta/10"}`}>
                  {avvisoBudget}
                </p>
              )}

              {omaggi.length > 0 && (
                <table className="w-full text-sm mt-4">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-b58-charcoal-soft">
                      <th className="text-left font-medium py-1">Perché</th>
                      <th className="text-right font-medium py-1">Quanti</th>
                      <th className="text-right font-medium py-1">Costo ingredienti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {omaggi.map((o) => (
                      <tr key={o.causale} className="border-t border-b58-charcoal/5">
                        <td className="py-1 text-b58-charcoal">{o.causale}</td>
                        <td className="py-1 text-right tabular-nums">{o.quanti}</td>
                        <td className="py-1 text-right tabular-nums">{formatEUR(o.costo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* --- I mesi già chiusi --- */}
          {consuntivi.length > 0 && (
            <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5">
              <h2 className="font-display text-lg text-b58-charcoal mb-3">I mesi già fotografati</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-b58-charcoal-soft">
                    <th className="text-left font-medium py-1">Mese</th>
                    <th className="text-right font-medium py-1">Coperti</th>
                    <th className="text-right font-medium py-1">Incassato</th>
                    <th className="text-right font-medium py-1">Food cost</th>
                    <th className="py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {consuntivi.map((c) => (
                    <tr key={c.id} className="border-t border-b58-charcoal/5">
                      <td className="py-1 text-b58-charcoal">
                        {MESI[c.mese - 1]} {c.anno}
                        {/* ⚠️ Condizione di Alessio (16/08): un mese rifatto
                            DEVE vedersi. Un numero che cambia in silenzio è
                            la famiglia di difetti contro cui è nato questo
                            lavoro. */}
                        {c.chiusure_precedenti > 0 && (
                          <span className="text-[11px] text-b58-gold-dark bg-b58-gold/15 rounded-full px-2 py-0.5 ml-2">
                            rifatta
                            {c.chiusure_precedenti > 1 ? ` ${c.chiusure_precedenti} volte` : ""}
                            {c.prima_chiusura_il
                              ? ` — la prima era del ${formatDate(c.prima_chiusura_il)}`
                              : ""}
                          </span>
                        )}
                      </td>
                      <td className="py-1 text-right tabular-nums"><Valore v={c.coperti} euro={false} /></td>
                      <td className="py-1 text-right tabular-nums"><Valore v={c.ricavi} /></td>
                      <td className="py-1 text-right tabular-nums"><Valore v={c.food_cost} /></td>
                      <td className="py-1 text-right">
                        <ConfermaDistruttiva
                          etichetta="Rifalla"
                          domanda={`Cancello la fotografia di ${MESI[c.mese - 1]} ${c.anno}? Dopo dovrai rifotografare il mese.`}
                          etichettaConferma="Sì, cancella"
                          onConferma={() => cancella(c.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
