import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  calendarioImposte,
  confrontoColFoglio,
  congelaScenario,
  getScenario,
  ingressiScenario,
  lineeDellaPrevisione,
  listaScenari,
  pareggioPrevisione,
  proiezioneScenario,
  riepilogoScenario,
} from "../../lib/api/proiezione";
import { formatEUR, formatPercento, FORME_LINEA } from "../../lib/constants";
import { leggi, nonLetto } from "../../lib/calcoli/letture";
import Didascalia from "../../components/Didascalia";

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
  const [pareggio, setPareggio] = useState(null);
  const [confronto, setConfronto] = useState([]);
  const [costiFissi, setCostiFissi] = useState([]);
  const [linee, setLinee] = useState([]);
  const [calendario, setCalendario] = useState([]);
  const [annoPrima, setAnnoPrima] = useState(null);
  // ⚠️ «Non c'è una previsione dell'anno prima» e «non sono riuscito a
  // cercarla» dicevano la stessa frase, e la prima è una risposta mentre
  // la seconda è la sua assenza.
  const [precedentiNonLette, setPrecedentiNonLette] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [congelando, setCongelando] = useState(false);

  const carica = useCallback(async () => {
    const s = await getScenario(id);
    setScenario(s);
    const [m, r, c, p, ing, lin] = await Promise.all([
      proiezioneScenario(id),
      riepilogoScenario(id),
      confrontoColFoglio(id),
      pareggioPrevisione(id),
      ingressiScenario(id),
      lineeDellaPrevisione(id),
    ]);
    setMesi(m);
    setRiepilogo(r);
    setConfronto(c);
    setPareggio(p);
    setCostiFissi(ing.costiFissi ?? []);
    setLinee(lin);
    if (r?.imposte != null) {
      // ⚠️ IL QUARTO PARAMETRO — il difetto n. 15. Sopra la tabella c'è
      // scritto «è la cassa di giugno che tradisce, quando il saldo
      // dell'anno prima e il primo acconto cadono insieme», e il saldo
      // dell'anno prima non veniva mai passato: la funzione del database
      // ha il ramo apposta, e restava spento. Cioè la schermata
      // annunciava un pericolo e poi non lo mostrava.
      //
      // Da dove viene: dalla previsione dell'anno precedente della stessa
      // società, preferendo quella chiusa — una previsione congelata è
      // l'unica che non cambierà più. Se non ce n'è, resta `null` e la
      // schermata lo DICHIARA invece di far sembrare giugno leggero.
      // ⚠️ Se l'elenco non arriva, «non c'è una previsione dell'anno prima»
      // e «non sono riuscito a cercarla» si leggono uguali — e la seconda
      // farebbe sembrare giugno leggero, che è proprio ciò che il commento
      // qui sopra vuole evitare.
      const precedenti = await leggi(listaScenari(s.entity_id));
      const anteriore = nonLetto(precedenti)
        ? null
        : precedenti.filter((x) => x.anno === s.anno - 1).sort((a, b) => (b.congelato_il ? 1 : 0) - (a.congelato_il ? 1 : 0))[0] ?? null;
      const rPrec = anteriore ? await leggi(riepilogoScenario(anteriore.id)) : null;
      setPrecedentiNonLette(nonLetto(precedenti) || nonLetto(rPrec));
      setAnnoPrima(rPrec?.imposte != null ? { nome: anteriore.nome, imposte: rPrec.imposte } : null);
      setCalendario(await calendarioImposte(s.entity_id, s.anno, r.imposte, rPrec?.imposte ?? null));
    } else {
      setCalendario([]);
      setAnnoPrima(null);
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

  if (loading) return <p className="testo-sala-grande text-b58-charcoal-soft max-w-5xl mx-auto">Caricamento…</p>;
  if (!scenario) return <p className="testo-sala-grande text-b58-charcoal-soft max-w-5xl mx-auto">Non trovata.</p>;

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
      <Link to="/fiscale/previsioni" className="tocco-bottone inline-flex items-center testo-sala-grande text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Le previsioni
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap mt-1 mb-4">
        <div>
          <h1 className="font-display text-2xl text-b58-charcoal">{scenario.nome}</h1>
          <p className="testo-sala text-b58-charcoal-soft mt-0.5">
            {scenario.anno} · {scenario.tipo === "partenza" ? "previsione di partenza" : "riproiezione"}
            {scenario.versione_foglio && <> · {scenario.versione_foglio}</>}
          </p>
        </div>
        {scenario.congelato_il ? (
          <span className="testo-sala text-b58-olive-dark bg-b58-olive/10 rounded-lg px-3 py-1.5">
            Chiusa il {new Date(scenario.congelato_il).toLocaleDateString("it-IT")} — non si cambia più
          </span>
        ) : (
          <button
            onClick={chiudi}
            disabled={congelando}
            className="tocco-campo rounded-lg bg-b58-terracotta text-b58-parchment testo-sala-grande px-4 py-2 disabled:opacity-60"
          >
            {congelando ? "Chiudo…" : "Chiudi questa previsione"}
          </button>
        )}
      </div>

      {error && (
        <p className="testo-sala-grande text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {/* --- Il confronto col foglio --- */}
      {confronto.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5 mb-6">
          <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-1">Torna col tuo foglio?</h2>
          {differenze.length === 0 ? (
            <p className="testo-sala-grande text-b58-olive-dark">
              Sì: tutti e {confronto.length} i totali del foglio sono riprodotti esattamente, EBITDA e
              pareggio compresi.
            </p>
          ) : (
            <>
              <p className="testo-sala-grande text-b58-terracotta-dark mb-2">
                No: {differenze.length} {differenze.length === 1 ? "totale non torna" : "totali non tornano"}.
                Finché non torna, questa previsione non descrive il tuo piano.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full testo-sala-grande">
                  <thead>
                    <tr className="testo-sala uppercase tracking-wide text-b58-charcoal-soft">
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
              </div>
            </>
          )}
        </div>
      )}

      {/* --- Il riepilogo dell'anno --- */}
      {riepilogo && (
        <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-6">
          <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-3">L&apos;anno</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 testo-sala-grande">
            <div>
              <p className="testo-sala text-b58-charcoal-soft">Ricavi totali</p>
              <p className="text-b58-charcoal">{formatEUR(riepilogo.ricavi_totali)}</p>
            </div>
            <div>
              <p className="testo-sala text-b58-charcoal-soft">EBITDA</p>
              <p className="text-b58-charcoal">{formatEUR(riepilogo.ebitda)}</p>
            </div>
            {/* 🔴 IL PAREGGIO SI DICE IN EURO (24/08/2026, decisione di
                Alessio): *«non più "servono 2915 coperti": con sei linee a
                scontrini diversi quel numero non vuol dire niente»*. Un
                euro di barattoli e un euro di coperti non lasciano lo
                stesso margine, e sommarli in coperti è sommare cose
                diverse.
                ⚠️ Il numero in coperti resta, sotto e più piccolo, CON la
                frase che lo dichiara condizionato — vale solo se le altre
                linee vanno come previsto. La frase arriva dal database
                insieme al numero, così i due non possono separarsi: è la
                stessa forma di `calcola_imposte()`. */}
            <div className="col-span-2">
              <p className="testo-sala text-b58-charcoal-soft">Pareggio</p>
              {pareggio?.pareggio_euro == null ? (
                <p className="text-b58-charcoal-soft">{pareggio?.frase ?? "—"}</p>
              ) : (
                <>
                  <p className="text-b58-charcoal">
                    {formatEUR(pareggio.pareggio_euro)} di ricavo
                    {pareggio.margine_su_ricavi != null && (
                      <span className="text-b58-charcoal-soft">
                        {" "}
                        · margine {formatPercento(pareggio.margine_su_ricavi)} dei ricavi
                      </span>
                    )}
                  </p>
                  {pareggio.coperti_sala_se_altre != null && (
                    <p className="testo-sala text-b58-charcoal-soft mt-0.5">
                      Sono {pareggio.coperti_sala_se_altre} coperti di sala se le altre linee vanno
                      come previsto.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-b58-charcoal/10 grid grid-cols-2 sm:grid-cols-3 gap-4 testo-sala-grande">
            <div>
              <p className="testo-sala text-b58-charcoal-soft">Risultato prima delle imposte</p>
              <p className="text-b58-charcoal">{formatEUR(riepilogo.ante_imposte)}</p>
            </div>
            <div>
              <p className="testo-sala text-b58-charcoal-soft">Imposte stimate</p>
              <p className="text-b58-charcoal">
                {riepilogo.imposte == null ? "—" : formatEUR(riepilogo.imposte)}
              </p>
            </div>
            <div>
              <p className="testo-sala text-b58-charcoal-soft">Utile netto</p>
              <p className="text-b58-charcoal">
                {riepilogo.utile_netto == null ? "—" : formatEUR(riepilogo.utile_netto)}
              </p>
            </div>
          </div>
          <p className="testo-sala text-b58-terracotta-dark bg-b58-terracotta/10 rounded px-2 py-1.5 mt-3">
            {riepilogo.avvertenza_imposte}
          </p>
        </div>
      )}

      {/* --- Il calendario degli esborsi --- */}
      {calendario.length > 0 && (
        <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-6">
          <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-3">
            Quando escono i soldi
            <Didascalia>
              Non basta sapere quanto: è la cassa di giugno che tradisce, quando il
              saldo dell&apos;anno prima e il primo acconto cadono insieme.
            </Didascalia>
          </h2>
          {/* ⚠️ Il limite viaggia col numero: senza le imposte dell'anno
              prima, giugno sembra più leggero di quello che sarà. */}
          <p className="testo-sala text-b58-charcoal-soft bg-white/70 rounded-lg px-3 py-2 ring-1 ring-b58-charcoal/10 mb-3">
            {annoPrima
              ? `Il saldo dell'anno prima è compreso, e viene dalla previsione «${annoPrima.nome}».`
              : precedentiNonLette
                ? "Il saldo dell'anno prima NON è compreso, e non so dirti se una previsione dell'anno precedente esista: non sono riuscito a leggerla. Giugno potrebbe essere più pesante di così."
                : "Il saldo dell'anno prima NON è compreso: non c'è nessuna previsione dell'anno precedente da cui prenderlo. Giugno sarà più pesante di così."}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full testo-sala-grande">
              <tbody>
                {calendario.map((c) => (
                  <tr key={c.voce} className="border-t border-b58-charcoal/5">
                    <td className="py-1.5 text-b58-charcoal-soft w-24">
                      {new Date(c.scadenza).toLocaleDateString("it-IT")}
                    </td>
                    <td className="py-1.5 text-b58-charcoal">
                      {c.voce}
                      <span className="block testo-sala text-b58-charcoal-soft/70">{c.nota}</span>
                    </td>
                    <td className="py-1.5 text-right text-b58-charcoal tabular-nums">{formatEUR(c.importo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Le voci di costo fisso ---
          🔴 NASCE DA UN DATO CHE ESISTEVA E NON SI POTEVA GUARDARE
          (25/08/2026, richiesta di Alessio: *«un dato che esiste e non si
          può guardare è un dato che non c'è»*). Su una previsione
          **congelata** le quindici voci di costo fisso non comparivano da
          nessuna parte: qui c'era solo il totale, e il modulo di modifica
          si rifiuta di aprirsi. Per sapere di cosa è fatto quel totale
          bisognava chiederlo al database.
          ⚠️ E LA PROTEZIONE RIGUARDA LA MODIFICA, NON LA LETTURA: la
          previsione resta impossibile da ritoccare — lo impediscono i
          trigger, non questa schermata — ma quello che dichiara si deve
          poter leggere. Un sigillo che rende anche illeggibile non
          protegge di più: nasconde. */}
      {costiFissi.length > 0 && (
        <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-6">
          <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-3">
            Di cosa sono fatti i costi fissi
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full testo-sala-grande">
              <thead>
                <tr className="text-left testo-sala text-b58-charcoal-soft">
                  <th className="pb-2 font-normal">Voce</th>
                  <th className="pb-2 font-normal text-right">al mese</th>
                  <th className="pb-2 font-normal text-right">all&apos;anno</th>
                </tr>
              </thead>
              <tbody>
                {/* Dalla più cara: è l'ordine in cui si cerca una voce che
                    non torna col proprio foglio. */}
                {[...costiFissi]
                  .sort((a, b) => Number(b.euro_mese ?? 0) - Number(a.euro_mese ?? 0))
                  .map((f) => (
                    <tr key={f.id} className="border-t border-b58-charcoal/5">
                      <td className="py-2 text-b58-charcoal">{f.voce}</td>
                      <td className="py-2 text-right text-b58-charcoal">{formatEUR(f.euro_mese)}</td>
                      <td className="py-2 text-right text-b58-charcoal-soft">
                        {formatEUR(Number(f.euro_mese ?? 0) * 12)}
                      </td>
                    </tr>
                  ))}
                {/* ⚠️ Il totale si RICALCOLA dalle righe qui sopra e non si
                    legge dal riepilogo: se un giorno i due numeri
                    divergessero, chi guarda lo vedrebbe. Un totale preso da
                    un'altra parte nasconde proprio la differenza che questa
                    tabella serve a trovare. */}
                <tr className="border-t-2 border-b58-charcoal/15 font-semibold">
                  <td className="py-2 text-b58-charcoal">
                    Totale ({costiFissi.length} voci)
                  </td>
                  <td className="py-2 text-right text-b58-charcoal">
                    {formatEUR(costiFissi.reduce((s, f) => s + Number(f.euro_mese ?? 0), 0))}
                  </td>
                  <td className="py-2 text-right text-b58-charcoal">
                    {formatEUR(costiFissi.reduce((s, f) => s + Number(f.euro_mese ?? 0), 0) * 12)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🔴 LE LINEE ACCESSORIE, CHE PRIMA NON SI VEDEVANO DA NESSUNA PARTE
          (25/08/2026). I loro ricavi erano dentro i totali, dentro il
          pareggio e dentro le imposte, e la schermata non diceva **quali
          fossero**: su una previsione vera valevano 143.464 € su 418.214.
          Non era il disegno vecchio a non riconoscerle — `lineeDellaPrevisione`
          esisteva già nel database e nessuna schermata la chiamava.
          Un numero grande senza il suo perché è la stessa famiglia della
          sala disegnata vuota del 18/08: plausibile, e muto. */}
      {linee.length > 0 && (
        <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 mb-6">
          <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-1">
            Di cosa sono fatti i ricavi accessori
          </h2>
          <p className="testo-sala text-b58-charcoal-soft mb-3">
            Sono le linee oltre alla sala. I loro ricavi stanno già dentro i totali qui sotto,
            nel pareggio e nella stima delle imposte.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full testo-sala-grande">
              <thead>
                <tr className="text-left testo-sala text-b58-charcoal-soft">
                  <th className="pb-2 font-normal">Linea</th>
                  <th className="pb-2 font-normal">come si conta</th>
                  <th className="pb-2 font-normal text-right">quanti</th>
                  <th className="pb-2 font-normal text-right">a quanto</th>
                  <th className="pb-2 font-normal text-right">costa</th>
                </tr>
              </thead>
              <tbody>
                {linee.map((l) => (
                  <tr key={l.id} className="border-t border-b58-charcoal/5">
                    <td className="py-2 text-b58-charcoal">
                      {l.linea}
                      {/* ⚠️ «A zero» È un'informazione, non un buco: chef table e
                          barattoli non partono da subito, e zero previsto con zero
                          reale è un allineamento perfetto. Lo dice già il database
                          (`a_zero`), qui si mostra. */}
                      {l.a_zero && (
                        <span className="block testo-sala text-b58-charcoal-soft">
                          non parte quest&apos;anno
                        </span>
                      )}
                    </td>
                    {/* ⚠️ LA FORMA LA RISOLVE IL DATABASE, anche quando la
                        previsione è del disegno vecchio e il campo è vuoto:
                        `forma_della_linea` la deduce dalla base. Le previsioni
                        già chiuse hanno quei campi a null e non si toccano —
                        questa colonna non si rompe, deduce. */}
                    <td className="py-2 text-b58-charcoal-soft">
                      {FORME_LINEA.find((f) => f.value === l.forma)?.label ?? l.forma ?? "—"}
                    </td>
                    <td className="py-2 text-right text-b58-charcoal">
                      <Numero v={l.quantita} decimali={0} />
                    </td>
                    <td className="py-2 text-right text-b58-charcoal">{formatEUR(l.prezzo_medio)}</td>
                    <td className="py-2 text-right text-b58-charcoal-soft">
                      {l.costo_percento == null
                        ? "—"
                        : formatPercento(Number(l.costo_percento) * 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- I dodici mesi --- */}
      <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-5 overflow-x-auto">
        <h2 className="font-display testo-sala-titolo text-b58-charcoal mb-3">I dodici mesi</h2>
        <table className="w-full testo-sala min-w-[720px]">
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
