import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getIncassiPerGiorno, getQuadraturaFiscale, listContiDaFiscalizzare } from "../../lib/api/cash";
import { listContiFiscalizzati, setDocumentoFiscale } from "../../lib/api/orders";
import { getEntities } from "../../lib/api/entities";
import { formatDate, formatEUR, oggiLocale, primoDelMeseLocale } from "../../lib/constants";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";
import { useGiornataOperativa } from "../../lib/giornataOperativa";

// Incassato e scontrinato — chiesto da Alessio il 15/08/2026.
//
// Due totali, non uno: quanto è entrato e quanto ha un documento fiscale.
// Un numero solo li nasconderebbe entrambi.
//
// ⚠️ La differenza NON sparisce da sola: i conti senza documento restano
// qui finché non si dice cosa è stato emesso. Un elenco che si svuota da
// solo è un elenco che non serve a niente.

export default function Scontrinato() {
  const [entities, setEntities] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [dal, setDal] = useState(primoDelMeseLocale());
  const [al, setAl] = useState(oggiLocale());
  const [quadratura, setQuadratura] = useState(null);
  const [conti, setConti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inCorso, setInCorso] = useState("");
  const [numeroFattura, setNumeroFattura] = useState({});
  const [fiscalizzati, setFiscalizzati] = useState([]);
  const [perGiorno, setPerGiorno] = useState([]);

  // 🔴 QUI SI CONTA A SERATE, NON A GIORNI DI CALENDARIO, e non è una
  // scelta di questa schermata: `quadratura_fiscale` e
  // `conti_da_fiscalizzare` confrontano gli estremi del periodo con
  // `serata_di_servizio(closed_at)`. Un «al» preso da `oggiLocale()` alle
  // 00:30 chiedeva al database una serata che non è ancora cominciata.
  //
  // ⚠️ E il documento fiscale si data alla SERATA del conto: sono la stessa
  // cosa, e datarli in due modi diversi vorrebbe dire avere un incasso su
  // una giornata e il suo scontrino su un'altra — che è precisamente ciò
  // che questa schermata serve a scoprire. ⚠️ Il giorno del registratore
  // telematico questa data va riconfrontata con la sua chiusura fiscale:
  // è la stessa voce aperta di «chi comanda sui ricavi».
  const { serata, oraFineSerata } = useGiornataOperativa();
  useEffect(() => {
    if (serata) setAl((a) => (a === oggiLocale() ? serata : a));
  }, [serata]);

  useEffect(() => {
    getEntities()
      .then((ent) => {
        setEntities(ent);
        setEntityId(ent.srls.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  const ricarica = () => {
    if (!entityId) return Promise.resolve();
    return Promise.all([
      getQuadraturaFiscale(entityId, dal, al),
      listContiDaFiscalizzare(entityId, dal, al),
      listContiFiscalizzati({ entityId, dal, al }),
      getIncassiPerGiorno(entityId, dal, al),
    ]).then(([q, c, f, g]) => {
      setQuadratura(q);
      setConti(c);
      setFiscalizzati(f);
      setPerGiorno(g);
    });
  };

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    ricarica()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, dal, al]);

  const segna = async (orderId, tipo) => {
    setInCorso(orderId);
    setError("");
    try {
      await setDocumentoFiscale(orderId, {
        tipo,
        numero: tipo === "fattura" ? numeroFattura[orderId] : null,
        emessoIl: serata ?? oggiLocale(),
      });
      await ricarica();
    } catch (e) {
      setError(e.message);
    } finally {
      setInCorso("");
    }
  };

  // ⚠️ `tipo: null` è un valore ammesso e vuol dire «non l'ho ancora
  // detto», che è diverso da «niente è stato emesso»: il conto torna
  // nell'elenco di quelli da sistemare invece di sparire dichiarando il
  // falso.
  const togliSegno = async (orderId) => {
    setError("");
    try {
      await setDocumentoFiscale(orderId, { tipo: null, numero: null, emessoIl: null });
      await ricarica();
    } catch (e) {
      setError(e.message);
    }
  };

  const inputClass =
    "rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const differenza = quadratura ? Number(quadratura.da_fiscalizzare) : 0;

  return (
    <div className="max-w-5xl mx-auto pb-16">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <Link to="/cassa" className="tocco-bottone inline-flex items-center text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
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
          <input type="date" value={dal} onChange={(e) => setDal(e.target.value)} className={inputClass} />
          <input type="date" value={al} onChange={(e) => setAl(e.target.value)} className={inputClass} />
        </div>
      </div>

      {/* ⚠️ La riga compare SOLO quando la serata e il calendario non
          coincidono — cioè fra mezzanotte e le 05:00. Una spiegazione che
          c'è sempre si smette di leggere; questa sta dove sta il dubbio. */}
      {serata && oraFineSerata && serata !== oggiLocale() && (
        <p className="text-xs text-b58-charcoal-soft mb-3">
          Si sta guardando fino alla serata di{" "}
          <strong className="text-b58-charcoal">{formatDate(serata)}</strong>: fino alle{" "}
          {String(oraFineSerata).slice(0, 5)} è ancora la sera prima.
        </p>
      )}

      <h1 className="font-display text-2xl text-b58-charcoal mb-1">Incassato e scontrinato</h1>
      <p className="text-xs text-b58-charcoal-soft/80 mb-6">
        Quanto è entrato e quanto ha un documento fiscale sono <strong>due numeri diversi</strong>. Qui
        si vede la differenza, e i conti che la compongono restano in elenco finché non li sistemi.
      </p>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          {/* ---- I due totali affiancati ------------------------------ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5">
              <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft mb-1">Incassato</div>
              <div className="text-2xl font-medium text-b58-charcoal">
                {quadratura ? formatEUR(quadratura.incassato) : "—"}
              </div>
            </div>
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5">
              <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft mb-1">Con documento</div>
              <div className="text-2xl font-medium text-b58-charcoal">
                {quadratura ? formatEUR(quadratura.fiscalizzato) : "—"}
              </div>
            </div>
            <div
              className={`rounded-xl p-5 ring-1 ${
                differenza > 0 ? "bg-b58-gold/10 ring-b58-gold-dark/40" : "bg-b58-parchment ring-b58-charcoal/10"
              }`}
            >
              <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft mb-1">Senza documento</div>
              <div className={`text-2xl font-medium ${differenza > 0 ? "text-b58-gold-dark" : "text-b58-charcoal"}`}>
                {quadratura ? formatEUR(quadratura.da_fiscalizzare) : "—"}
              </div>
              {quadratura && Number(quadratura.quante_fatture) > 0 && (
                <div className="text-[11px] text-b58-charcoal-soft mt-1">
                  di cui {formatEUR(quadratura.fatture_da_emettere)} sono fatture che hai promesso
                </div>
              )}
            </div>
          </div>

          {/* ⚠️ L'avvertenza arriva dal database insieme ai numeri, e qui
              dice la cosa che eviterebbe un falso allarme: senza
              registratore telematico è normale che risulti tutto da fare. */}
          <p className="text-xs text-b58-charcoal-soft bg-white/70 rounded-lg px-3 py-2 ring-1 ring-b58-charcoal/10 mb-6 leading-relaxed">
            {quadratura?.avvertenza}
          </p>

          {/* ---- Giorno per giorno (23/08/2026, blocco 4) --------------
              🔴 Fra il totale del periodo e il singolo conto non c'era
              niente, e Alessio lo cercava: «quanto abbiamo fatto martedì?»
              non aveva una risposta in nessuna schermata.

              ⚠️ DUE COLONNE come i totali in cima, non una — e il caso che
              lo dimostra è nei dati: il 02/06 fa 338,00 incassati contro
              189,50 scontrinati. Con un numero solo quel giorno sarebbe
              indistinguibile da uno in cui i due coincidono.

              ⚠️ Si conta a SERATE: un conto chiuso all'una di notte
              appartiene alla sera prima. */}
          {perGiorno.length > 0 && (
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mb-6">
              <h2 className="font-display text-lg text-b58-charcoal mb-1">Serata per serata</h2>
              <p className="text-[11px] text-b58-charcoal-soft/70 mb-4">
                La stessa cosa dei due numeri qui sopra, ma per serata di servizio.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-b58-charcoal-soft/70">
                      <th className="py-1 pr-3">Serata</th>
                      <th className="py-1 pr-3 text-right">Conti</th>
                      <th className="py-1 pr-3 text-right">Incassato</th>
                      <th className="py-1 pr-3 text-right">Scontrinato</th>
                      <th className="py-1 text-right">Da fare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perGiorno.map((g) => (
                      <tr key={g.serata} className="border-t border-b58-charcoal/10">
                        <td className="py-2 pr-3 whitespace-nowrap">{formatDate(g.serata)}</td>
                        <td className="py-2 pr-3 text-right">{g.quanti}</td>
                        <td className="py-2 pr-3 text-right">{formatEUR(g.incassato)}</td>
                        <td className="py-2 pr-3 text-right">{formatEUR(g.scontrinato)}</td>
                        {/* ⚠️ La differenza si evidenzia solo quando c'è:
                            un numero colorato che c'è sempre smette di
                            essere un segnale. */}
                        <td className="py-2 text-right">
                          {Number(g.da_fiscalizzare) > 0 ? (
                            <strong className="text-b58-terracotta-dark">
                              {formatEUR(g.da_fiscalizzare)}
                            </strong>
                          ) : (
                            <span className="text-b58-charcoal-soft/50">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ---- L'elenco --------------------------------------------- */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
            <h2 className="font-display text-lg text-b58-charcoal mb-1">Conti da sistemare</h2>
            <p className="text-[11px] text-b58-charcoal-soft/70 mb-4">
              Se batti lo scontrino dopo, o prepari la fattura il giorno seguente, segnalo qui e il
              conto esce dall&apos;elenco. <strong>È il caso normale, non l&apos;eccezione.</strong>
            </p>

            {conti.length === 0 ? (
              <p className="text-sm text-b58-charcoal-soft/60">
                Nessun conto in sospeso nel periodo.
              </p>
            ) : (
              <ul className="space-y-3">
                {conti.map((c) => (
                  <li key={c.order_id} className="border-b border-b58-charcoal/5 last:border-0 pb-3 last:pb-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <span className="text-sm text-b58-charcoal">
                        <span className="font-medium">{formatEUR(c.incasso)}</span>
                        <span className="text-b58-charcoal-soft">
                          {" "}· {formatDate(c.chiuso_il)} · {c.tavolo}
                          {c.coperti > 0 && ` · ${c.coperti} coperti`} · {c.pagamento}
                        </span>
                        <div className="text-[11px] text-b58-charcoal-soft">
                          {c.stato === "fattura_da_emettere"
                            ? "fattura promessa al cliente, ancora da fare"
                            : "nessuno ha detto cosa è stato emesso"}
                        </div>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <button
                          disabled={inCorso === c.order_id}
                          onClick={() => segna(c.order_id, "scontrino")}
                          className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-xs px-3 py-1.5 disabled:opacity-60"
                        >
                          Scontrino fatto
                        </button>
                        {c.stato !== "fattura_da_emettere" && (
                          <button
                            disabled={inCorso === c.order_id}
                            onClick={() => segna(c.order_id, "fattura_da_emettere")}
                            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-xs px-3 py-1.5 disabled:opacity-60"
                          >
                            Vuole fattura
                          </button>
                        )}
                        <input
                          value={numeroFattura[c.order_id] ?? ""}
                          onChange={(e) =>
                            setNumeroFattura((n) => ({ ...n, [c.order_id]: e.target.value }))
                          }
                          placeholder="n. fattura"
                          className="w-28 rounded-lg border border-b58-charcoal/15 bg-white px-2 py-1.5 text-xs text-b58-charcoal"
                        />
                        {/* ⚠️ Senza numero non è una fattura: è una riga
                            che dice di esserlo, e sparisce dall'elenco
                            portandosi via la differenza fra incassato e
                            fiscalizzato. Dal 16/08 lo rifiuta anche il
                            vincolo del database — qui l'errore arriva
                            prima di premere. */}
                        <button
                          disabled={inCorso === c.order_id || !(numeroFattura[c.order_id] ?? "").trim()}
                          onClick={() => segna(c.order_id, "fattura")}
                          className="rounded-lg bg-b58-terracotta text-b58-parchment text-xs px-3 py-1.5 disabled:opacity-60"
                        >
                          Fattura fatta
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ⚠️ La via di ritorno che mancava (Blocco 5.2 del mandato di
              correzione): una volta segnato, il conto spariva dall'elenco
              e non c'era più nessun posto da cui dire che era stato un
              errore. Un conto marcato scontrinato per sbaglio non è un
              dettaglio — è proprio la differenza fra incassato e
              fiscalizzato, cioè il numero che questa schermata esiste per
              far tornare. */}
          {fiscalizzati.length > 0 && (
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6 mt-6">
              <h2 className="font-display text-lg text-b58-charcoal mb-1">Già segnati</h2>
              <p className="text-xs text-b58-charcoal-soft/80 mb-4">
                Se uno di questi è stato segnato per sbaglio, togli il segno: il conto
                torna fra quelli da sistemare.
              </p>
              <ul className="space-y-1.5">
                {fiscalizzati.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-b58-charcoal-soft">
                      {formatDate(c.closed_at)} · {c.table_label} ·{" "}
                      {c.documento_fiscale === "fattura"
                        ? `fattura${c.documento_numero ? ` n. ${c.documento_numero}` : ""}`
                        : c.documento_fiscale === "fattura_da_emettere"
                        ? "fattura da fare"
                        : "scontrino"}
                    </span>
                    <ConfermaDistruttiva
                      etichetta="Non era così"
                      domanda="Tolgo il segno? Il conto torna fra quelli da sistemare."
                      etichettaConferma="Sì, togli"
                      onConferma={() => togliSegno(c.id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
