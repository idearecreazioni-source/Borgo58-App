import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getQuadraturaFiscale, listContiDaFiscalizzare } from "../../lib/api/cash";
import { listContiFiscalizzati, setDocumentoFiscale } from "../../lib/api/orders";
import { getEntities } from "../../lib/api/entities";
import { formatDate, formatEUR, oggiLocale, primoDelMeseLocale } from "../../lib/constants";
import ConfermaDistruttiva from "../../components/ConfermaDistruttiva";

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
    ]).then(([q, c, f]) => {
      setQuadratura(q);
      setConti(c);
      setFiscalizzati(f);
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
        emessoIl: oggiLocale(),
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
          <input type="date" value={dal} onChange={(e) => setDal(e.target.value)} className={inputClass} />
          <input type="date" value={al} onChange={(e) => setAl(e.target.value)} className={inputClass} />
        </div>
      </div>

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
