import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getOrder,
  getServiceSettings,
  listOpenOrders,
  listRepartoTickets,
  setItemsPrepared,
} from "../../lib/api/orders";
import { formatEUR } from "../../lib/constants";
import CloseOrderModal from "./CloseOrderModal";
import PrecontoModal from "./PrecontoModal";

// Schermata BAR — tablet 11" in orizzontale, su supporto fisso (§3.2.1).
//
// Doppio ruolo, ed e' il motivo per cui il layout e' a due colonne e non
// una sola come in Sala: a sinistra le bevande da preparare, a destra la
// cassa. Il Bar puo' chiudere il conto di QUALUNQUE tavolo, non solo dei
// propri ordini — richiesta esplicita di Alessio: in un momento tranquillo,
// con poco personale, non si deve essere costretti a spostarsi.
//
// Il ticket di carta esce comunque dalla stampante del bar: questo schermo
// serve al colpo d'occhio e a segnare "evaso", non a sostituirlo.
const POLL_MS = 10000;

export default function Bar() {
  const [tickets, setTickets] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [copertoPrice, setCopertoPrice] = useState(null);
  const [order, setOrder] = useState(null);
  const [mode, setMode] = useState(null); // "precon" | "close"
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    Promise.all([listRepartoTickets("bar"), listOpenOrders()])
      .then(([t, o]) => {
        setTickets(t);
        setOpenOrders(o);
        setError("");
      })
      // Un errore qui non va ingoiato: uno schermo vuoto per un problema di
      // rete e' indistinguibile da un bar senza ordini.
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    getServiceSettings()
      .then((s) => setCopertoPrice(Number(s.coperto_price)))
      .catch((e) => setError(e.message));
  }, []);

  // Un "ticket" e' un invio: tutte le righe partite dalla sala nello stesso
  // momento per lo stesso tavolo. E' l'unita' con cui si lavora al banco —
  // e coincide con lo scontrino che esce dalla stampante.
  const gruppi = Object.values(
    tickets.reduce((acc, item) => {
      const key = `${item.order_id}__${item.sent_at}`;
      if (!acc[key]) {
        acc[key] = {
          key,
          table: item.order?.table_label ?? "—",
          sentAt: item.sent_at,
          items: [],
        };
      }
      acc[key].items.push(item);
      return acc;
    }, {})
  ).sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));

  const daPreparare = gruppi.filter((g) => g.items.some((i) => !i.prepared_at));
  const evasi = gruppi.filter((g) => g.items.every((i) => i.prepared_at));

  const toggleGruppo = async (g, pronto) => {
    setBusy(true);
    try {
      await setItemsPrepared(g.items.map((i) => i.id), pronto);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const apriConto = async (orderId, azione) => {
    setError("");
    try {
      setOrder(await getOrder(orderId));
      setMode(azione);
    } catch (e) {
      setError(e.message);
    }
  };

  const chiudiModale = () => {
    setMode(null);
    setOrder(null);
  };

  const ora = (iso) =>
    new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const Ticket = ({ g, evaso }) => (
    <div
      className={`rounded-xl bg-white ring-1 p-3 mb-2 ${
        evaso ? "ring-b58-charcoal/5 opacity-50" : "ring-b58-charcoal/15"
      }`}
    >
      <div className="flex items-center justify-between border-b border-dashed border-b58-charcoal/20 pb-1.5 mb-1.5">
        <span className="font-display text-lg text-b58-charcoal">{g.table}</span>
        <span className="text-xs text-b58-charcoal-soft">{ora(g.sentAt)}</span>
      </div>
      {g.items.map((i) => (
        <div key={i.id} className="text-sm text-b58-charcoal py-0.5">
          <b>{i.quantity}×</b> {i.recipe?.name || i.free_text_name}
          {i.note && <div className="text-xs italic text-b58-charcoal-soft pl-4">↳ {i.note}</div>}
        </div>
      ))}
      <button
        type="button"
        disabled={busy}
        onClick={() => toggleGruppo(g, !evaso)}
        className={`tocco-azione w-full mt-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${
          evaso
            ? "border border-b58-charcoal/15 text-b58-charcoal-soft"
            : "bg-b58-olive hover:bg-b58-olive-dark text-b58-parchment"
        }`}
      >
        {evaso ? "↺ Riapri" : "✓ Evaso"}
      </button>
    </div>
  );

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3 shrink-0">
        <div>
          <h1 className="font-display text-2xl text-b58-charcoal leading-none">Bar</h1>
          <p className="text-xs text-b58-charcoal-soft/70 mt-1">
            {daPreparare.length === 0
              ? "Niente da preparare"
              : `${daPreparare.length} ${daPreparare.length === 1 ? "ticket" : "ticket"} da preparare`}
          </p>
        </div>
        <Link
          to="/comande"
          className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
        >
          Sala
        </Link>
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3 shrink-0">
          Elenco non aggiornato: {error}. Quello che vedi potrebbe essere incompleto.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* DA PREPARARE ---------------------------------------------- */}
        <div className="flex flex-col min-h-0">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-b58-charcoal-soft/70 mb-1.5">
            Da preparare
          </p>
          <div className="overflow-y-auto flex-1 pr-1">
            {daPreparare.length === 0 && evasi.length === 0 ? (
              <p className="text-sm text-b58-charcoal-soft/60 text-center py-10 border border-dashed border-b58-charcoal/15 rounded-xl">
                Nessuna comanda al bar.
              </p>
            ) : (
              <>
                {daPreparare.map((g) => (
                  <Ticket key={g.key} g={g} evaso={false} />
                ))}
                {evasi.length > 0 && (
                  <p className="text-[11px] uppercase tracking-wide text-b58-charcoal-soft/50 mt-3 mb-1">
                    Evasi
                  </p>
                )}
                {evasi.map((g) => (
                  <Ticket key={g.key} g={g} evaso />
                ))}
              </>
            )}
          </div>
        </div>

        {/* CASSA ------------------------------------------------------ */}
        <div className="flex flex-col min-h-0">
          <p className="text-[11px] uppercase tracking-wide font-semibold text-b58-charcoal-soft/70 mb-1.5">
            Conti aperti — preconto e chiusura
          </p>
          <div className="overflow-y-auto flex-1 pr-1">
            {openOrders.length === 0 ? (
              <p className="text-sm text-b58-charcoal-soft/60 text-center py-10 border border-dashed border-b58-charcoal/15 rounded-xl">
                Nessun conto aperto.
              </p>
            ) : (
              openOrders.map((o) => {
                const righe = (o.items ?? []).filter((i) => !i.voided_at);
                const totaleRighe = righe.reduce(
                  (s, i) => s + i.quantity * Number(i.unit_price),
                  0
                );
                const coperti = o.coperti ?? 0;
                const totale = totaleRighe + coperti * Number(copertoPrice ?? 0);
                return (
                  <div key={o.id} className="rounded-xl bg-white ring-1 ring-b58-charcoal/15 p-3 mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-display text-lg text-b58-charcoal">{o.table_label}</span>
                      <span className="text-base font-semibold text-b58-charcoal">
                        {formatEUR(totale)}
                      </span>
                    </div>
                    <p className="text-xs text-b58-charcoal-soft mb-2">
                      {righe.length} {righe.length === 1 ? "riga" : "righe"}
                      {coperti > 0 && ` · ${coperti} coperti`} · aperto alle {ora(o.opened_at)}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => apriConto(o.id, "precon")}
                        className="tocco-azione flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark text-b58-charcoal text-sm font-medium"
                      >
                        Preconto
                      </button>
                      <button
                        type="button"
                        onClick={() => apriConto(o.id, "close")}
                        className="tocco-azione flex-1 rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark text-b58-parchment text-sm font-semibold"
                      >
                        Chiudi conto
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <p className="text-[11px] text-b58-charcoal-soft/70 leading-relaxed bg-b58-cream-dark/40 rounded-lg px-3 py-2 mt-2 shrink-0">
            Il Bar è anche punto cassa: può chiudere il conto di qualunque tavolo, non
            solo dei propri ordini.
          </p>
        </div>
      </div>

      {mode === "precon" && order && (
        <PrecontoModal order={order} copertoPrice={copertoPrice} onClose={chiudiModale} />
      )}

      {mode === "close" && order && (
        <CloseOrderModal
          order={order}
          copertoPrice={copertoPrice}
          onClose={chiudiModale}
          onDone={() => {
            chiudiModale();
            load();
          }}
        />
      )}
    </div>
  );
}
