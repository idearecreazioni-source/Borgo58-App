import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getCashBalance,
  listCashMovements,
  listDiscountsGiftsMonthly,
  listQuadraturaPagamenti,
} from "../../lib/api/cash";
import { getEntities } from "../../lib/api/entities";
import { formatDate, formatEUR, labelFor, primoDelMeseLocale } from "../../lib/constants";
import { CASH_DIRECTIONS } from "../../lib/constants";

// Primo del mese in ora locale: la versione precedente passava per
// toISOString() e restituiva l'ULTIMO giorno del mese prima (mezzanotte
// italiana e' ancora il giorno prima in UTC), quindi il riepilogo di cassa
// includeva sempre una giornata di troppo.
const currentMonthStart = primoDelMeseLocale;

export default function CassaHome() {
  const [entities, setEntities] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [balance, setBalance] = useState(null);
  const [quadratura, setQuadratura] = useState([]);
  const [monthMovements, setMonthMovements] = useState([]);
  const [recent, setRecent] = useState([]);
  const [monthlyDG, setMonthlyDG] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getEntities()
      .then((ent) => {
        setEntities(ent);
        setEntityId(ent.srls.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    const monthStart = currentMonthStart();
    Promise.all([
      getCashBalance(entityId),
      listCashMovements({ entityId, from: monthStart }),
      listCashMovements({ entityId }),
      listDiscountsGiftsMonthly(entityId),
      listQuadraturaPagamenti(),
    ])
      .then(([bal, monthMov, allMov, dg, quad]) => {
        setBalance(bal);
        setMonthMovements(monthMov);
        setRecent(allMov.slice(0, 8));
        setMonthlyDG(dg);
        setQuadratura(quad);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [entityId]);

  const monthIn = useMemo(
    () => monthMovements.filter((m) => m.direction === "entrata").reduce((s, m) => s + Number(m.amount), 0),
    [monthMovements]
  );
  const monthOut = useMemo(
    () => monthMovements.filter((m) => m.direction === "uscita").reduce((s, m) => s + Number(m.amount), 0),
    [monthMovements]
  );

  // Omaggi del mese corrente = base TD27 (§6).
  const currentMonthKey = currentMonthStart();
  const giftsThisMonth = monthlyDG.find((r) => r.month === currentMonthKey && r.type === "omaggio");
  const discountsThisMonth = monthlyDG.find((r) => r.month === currentMonthKey && r.type === "sconto");

  const negativeBalance = balance && Number(balance.balance) < 0;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-b58-charcoal">Cassa, Banca e Prima Nota</h1>
          <p className="text-b58-charcoal-soft mt-1">
            Prima nota manuale — la riconciliazione POS automatica arriverà con la scelta del sistema di cassa (§3.2).
          </p>
        </div>
        {entities && (
          <select
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta"
          >
            <option value={entities.srls.id}>{entities.srls.name}</option>
            {entities.agricola && <option value={entities.agricola.id}>{entities.agricola.name}</option>}
          </select>
        )}
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-b58-charcoal-soft">Caricamento…</p>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className={`rounded-xl p-5 ring-1 ${negativeBalance ? "bg-b58-terracotta/10 ring-b58-terracotta/40" : "bg-b58-parchment ring-b58-charcoal/10"}`}>
              <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft mb-1">Contante in cassa</div>
              <div className={`text-2xl font-medium ${negativeBalance ? "text-b58-terracotta-dark" : "text-b58-charcoal"}`}>
                {balance ? formatEUR(balance.balance) : "—"}
              </div>
              {balance && (
                <div className="text-[11px] text-b58-charcoal-soft mt-1">
                  fondo {formatEUR(balance.owner_float)} + incassi {formatEUR(balance.declared_takings)} − uscite {formatEUR(balance.total_out)}
                </div>
              )}
              {/* Il conto corrente sta accanto e NON si somma: sono due
                  posti diversi, e il totale non serve a niente finché
                  nessuno ha detto a cosa dovrebbe rispondere. */}
              {balance && (
                <div className="text-[11px] text-b58-charcoal-soft mt-2 border-t border-b58-charcoal/10 pt-2">
                  Banca: <span className="font-medium text-b58-charcoal">{formatEUR(balance.saldo_banca)}</span>
                  {" — "}entrate {formatEUR(balance.entrate_banca)} · uscite {formatEUR(balance.uscite_banca)}
                </div>
              )}
              {negativeBalance && (
                <div className="text-[11px] text-b58-terracotta-dark mt-1 font-medium">
                  Saldo negativo: un'uscita senza provenienza. Verifica versamenti/incassi mancanti.
                </div>
              )}
            </div>

            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5">
              <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft mb-1">Questo mese</div>
              <div className="text-lg text-b58-olive-dark font-medium">+{formatEUR(monthIn)}</div>
              <div className="text-lg text-b58-terracotta-dark font-medium">−{formatEUR(monthOut)}</div>
            </div>

            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-5">
              <div className="text-xs uppercase tracking-wide text-b58-charcoal-soft mb-1">Sconti/omaggi del mese</div>
              <div className="text-sm text-b58-charcoal">
                Sconti: {discountsThisMonth ? formatEUR(discountsThisMonth.total_forgone) : formatEUR(0)}
              </div>
              <div className="text-sm text-b58-charcoal">
                Omaggi (base TD27): {giftsThisMonth ? formatEUR(giftsThisMonth.total_full) : formatEUR(0)}
              </div>
            </div>
          </div>

          {/* Quadratura: si vede solo quando c'è qualcosa che non torna.
              Un riquadro che dice «tutto a posto» ogni giorno si impara a
              non guardare — stessa ragione per cui il messaggio delle
              scadenze non parte quando non c'è niente da dire. */}
          {quadratura.length > 0 && (
            <div className="rounded-xl bg-b58-terracotta/10 ring-1 ring-b58-terracotta/40 p-5 mb-6">
              <h2 className="font-display text-lg text-b58-terracotta-dark mb-1">
                Non torna ({quadratura.length})
              </h2>
              <p className="text-xs text-b58-charcoal-soft mb-3">
                Differenze fra le fatture fornitore e la prima nota. Non sono errori certi: sono
                le cose che meritano un&apos;occhiata.
              </p>
              <ul className="space-y-2">
                {quadratura.map((r, i) => (
                  <li key={`${r.genere}-${i}`} className="text-sm">
                    <span className="text-b58-charcoal font-medium">{formatEUR(r.importo)}</span>
                    {r.quando && <span className="text-b58-charcoal-soft"> · {formatDate(r.quando)}</span>}
                    <span className="text-b58-charcoal"> — {r.descrizione}</span>
                    <div className="text-[11px] text-b58-charcoal-soft">{r.perche}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Navigazione sezioni */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Link to="/comande" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
              Comande
            </Link>
            <Link to="/cassa/prima-nota" className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment text-sm font-medium px-4 py-2">
              Prima nota
            </Link>
            <Link to="/cassa/sconti-omaggi" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
              Sconti e omaggi
            </Link>
            <Link to="/cassa/causali" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
              Causali
            </Link>
          </div>

          {/* Movimenti recenti */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-b58-charcoal">Movimenti recenti</h2>
              <Link to="/cassa/prima-nota" className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta">
                Vedi tutti →
              </Link>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-b58-charcoal-soft/60">Nessun movimento ancora.</p>
            ) : (
              <ul className="space-y-1.5">
                {recent.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-b58-charcoal-soft">
                      {formatDate(m.movement_date)} · {m.causale?.label ?? labelFor(CASH_DIRECTIONS, m.direction)}
                    </span>
                    <span className={m.direction === "entrata" ? "text-b58-olive-dark" : "text-b58-terracotta-dark"}>
                      {m.direction === "entrata" ? "+" : "−"}{formatEUR(m.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
