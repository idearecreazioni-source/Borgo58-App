import { useEffect, useState } from "react";
import {
  cancelOrder,
  closeOrderAsDiscountGift,
  closeOrderPaid,
  orderTotals,
} from "../../lib/api/orders";
import { listCausali, listPosDevices } from "../../lib/api/cash";
import { listCustomers } from "../../lib/api/customers";
import {
  DISCOUNT_GIFT_TYPES,
  ORDER_PAYMENT_METHODS,
  formatEUR,
  labelFor,
} from "../../lib/constants";

const lineLabel = (item) => item.recipe?.name || item.free_text_name;
const lineTotal = (item) => item.quantity * Number(item.unit_price);

// Modale "chiudi conto" (§3.2), ripreso dal prototipo UX di Cowork: riepilogo
// raggruppato per piatto, poi pagato/sconto/omaggio/annullato.
export default function CloseOrderModal({ order, copertoPrice, onClose, onDone }) {
  const [mode, setMode] = useState(null); // null | "sconto" | "omaggio" | "annulla" | "romana"
  // Divisione alla romana con arrotondamento (§3.2.2, deciso da Alessio il
  // 09/08/2026): 25 € in 2 → si propone la cifra tonda (12), il conto si
  // chiude a 24 e il 1 € di differenza resta registrato come cortesia
  // (sconto) — sul meccanismo atomico che già esiste, nessun registro nuovo.
  const [persone, setPersone] = useState(2);
  const [aTesta, setATesta] = useState("");
  const [causali, setCausali] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    collectedAmount: "",
    causaleId: "",
    customerId: "",
    deviceId: "",
    note: "",
    cancelReason: "",
  });

  useEffect(() => {
    Promise.all([listCausali("sconto_omaggio"), listCustomers(), listPosDevices()]).then(
      ([c, cu, d]) => {
        setCausali(c);
        setCustomers(cu);
        setDevices(d);
      }
    );
  }, []);

  // Stesso calcolo del preconto e del totale a schermo — coperto incluso
  // (§3.2.1): il cliente non deve vedere due numeri diversi.
  const { items, coperti, copertoUnitPrice, copertoTotal, total } = orderTotals(order, copertoPrice);

  // Righe raggruppate per nome, come nello scontrino del prototipo — più
  // leggibile di una lista piatta quando ci sono più giri di comanda.
  const grouped = Object.values(
    items.reduce((acc, it) => {
      const key = lineLabel(it);
      if (!acc[key]) acc[key] = { name: key, quantity: 0, total: 0 };
      acc[key].quantity += it.quantity;
      acc[key].total += lineTotal(it);
      return acc;
    }, {})
  );

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const handlePaid = (method) => run(() => closeOrderPaid(order.id, method, copertoUnitPrice));

  // --- Alla romana ---
  const esattoATesta = persone > 0 ? total / persone : 0;
  const totaleRomana = Math.round((Number(aTesta) || 0) * persone * 100) / 100;
  const cortesia = Math.round((total - totaleRomana) * 100) / 100;

  const apriRomana = () => {
    const n = coperti > 0 ? coperti : 2;
    setPersone(n);
    // Proposta iniziale: la cifra tonda per difetto ("far pagare 12 a
    // testa facilmente"). L'esatto resta a un tocco.
    setATesta(String(Math.floor(total / n)));
    setMode("romana");
  };

  const cambiaPersone = (n) => {
    const p = Math.max(1, Number(n) || 1);
    setPersone(p);
    setATesta(String(Math.floor(total / p)));
  };

  const handleRomana = (method) => {
    if (totaleRomana <= 0 || totaleRomana > total) return;
    if (cortesia === 0) {
      // Cifra esatta: è un pagamento normale.
      run(() => closeOrderPaid(order.id, method, copertoUnitPrice));
    } else {
      // Arrotondato per difetto: la differenza è una cortesia, registrata
      // come sconto — passa dal corridoio e dalla funzione atomica.
      run(() =>
        closeOrderAsDiscountGift(order.id, {
          isGift: false,
          fullAmount: total,
          collectedAmount: totaleRomana,
          causaleNote: `Alla romana: ${persone} × ${formatEUR(Number(aTesta) || 0)}`,
        })
      );
    }
  };

  const handleCancel = () => {
    if (!form.cancelReason.trim()) return;
    run(() => cancelOrder(order.id, form.cancelReason.trim()));
  };

  const handleDiscountGift = () => {
    const isGift = mode === "omaggio";
    if (!isGift && !form.collectedAmount) return;
    run(() =>
      closeOrderAsDiscountGift(order.id, {
        isGift,
        fullAmount: total,
        collectedAmount: form.collectedAmount,
        causaleId: form.causaleId || null,
        customerId: form.customerId || null,
        deviceId: form.deviceId || null,
        note: form.note || null,
      })
    );
  };

  return (
    <div className="fixed inset-0 bg-b58-charcoal/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-sm w-full overflow-hidden">
        <div className="bg-b58-charcoal text-b58-parchment px-4 py-3 flex items-center justify-between">
          <span className="font-display text-base">Chiusura conto — {order.table_label}</span>
          <button type="button" onClick={onClose} className="text-b58-parchment/80 hover:text-b58-parchment text-lg leading-none">
            ×
          </button>
        </div>

        <div className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
          {error && (
            <p className="text-xs text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="font-mono text-xs bg-b58-cream-dark/40 border border-dashed border-b58-charcoal/20 rounded-lg p-3">
            {grouped.length === 0 ? (
              <p className="text-b58-charcoal-soft">Nessuna riga sul conto.</p>
            ) : (
              grouped.map((g) => (
                <div key={g.name} className="flex justify-between py-0.5">
                  <span>{g.quantity}× {g.name}</span>
                  <span>{formatEUR(g.total)}</span>
                </div>
              ))
            )}
            {coperti > 0 && (
              <div className="flex justify-between py-0.5">
                <span>{coperti}× Coperto ({formatEUR(copertoUnitPrice)})</span>
                <span>{formatEUR(copertoTotal)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-dashed border-b58-charcoal/30 mt-1.5 pt-1.5 font-bold">
              <span>TOTALE</span>
              <span>{formatEUR(total)}</span>
            </div>
          </div>

          {mode === null && (
            <>
              <div className="flex gap-2">
                {ORDER_PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.value}
                    type="button"
                    disabled={busy}
                    onClick={() => handlePaid(pm.value)}
                    className="flex-1 rounded-lg bg-b58-olive hover:bg-b58-olive-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-3 py-2"
                  >
                    Paga {pm.label.toLowerCase()}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={apriRomana} className="flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-3 py-2">
                  Alla romana
                </button>
                <button type="button" onClick={() => setMode("sconto")} className="flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-3 py-2">
                  Sconto
                </button>
                <button type="button" onClick={() => setMode("omaggio")} className="flex-1 rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-3 py-2">
                  Omaggio
                </button>
              </div>
              <button type="button" onClick={() => setMode("annulla")} className="w-full text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark py-1">
                Annulla tavolo
              </button>
              <p className="text-[11px] text-b58-charcoal-soft/70 leading-relaxed bg-b58-cream-dark/40 rounded-lg px-3 py-2">
                Nessun incasso viene registrato in cassa: l'integrazione con il registratore telematico (§3.2) arriverà con l'hardware.
              </p>
            </>
          )}

          {mode === "romana" && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-b58-charcoal">
                Alla romana — {formatEUR(total)} da dividere
              </h3>

              <div className="flex items-center gap-2">
                <span className="text-sm text-b58-charcoal-soft w-20">Persone</span>
                <button type="button" onClick={() => cambiaPersone(persone - 1)} className="tocco-bottone rounded-lg border border-b58-charcoal/15 text-b58-charcoal">−</button>
                <b className="w-8 text-center">{persone}</b>
                <button type="button" onClick={() => cambiaPersone(persone + 1)} className="tocco-bottone rounded-lg border border-b58-charcoal/15 text-b58-charcoal">+</button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-b58-charcoal-soft w-20">A testa</span>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={aTesta}
                  onChange={(e) => setATesta(e.target.value)}
                  className={`${inputClass} w-24 text-right`}
                />
                <button
                  type="button"
                  onClick={() => setATesta(String(Math.floor(esattoATesta)))}
                  className="text-xs rounded-full px-3 py-1.5 border border-b58-charcoal/15 text-b58-charcoal-soft"
                >
                  Tondo {Math.floor(esattoATesta)}
                </button>
                <button
                  type="button"
                  onClick={() => setATesta(String(Math.round(esattoATesta * 100) / 100))}
                  className="text-xs rounded-full px-3 py-1.5 border border-b58-charcoal/15 text-b58-charcoal-soft"
                >
                  Esatto {formatEUR(esattoATesta)}
                </button>
              </div>

              <div className="font-mono text-xs bg-b58-cream-dark/40 border border-dashed border-b58-charcoal/20 rounded-lg p-3">
                <div className="flex justify-between py-0.5">
                  <span>{persone} × {formatEUR(Number(aTesta) || 0)}</span>
                  <span>{formatEUR(totaleRomana)}</span>
                </div>
                {cortesia > 0 && (
                  <div className="flex justify-between py-0.5 text-b58-olive-dark">
                    <span>Cortesia (registrata come sconto)</span>
                    <span>−{formatEUR(cortesia)}</span>
                  </div>
                )}
                {cortesia < 0 && (
                  <div className="py-0.5 text-b58-terracotta-dark">
                    Supera il conto di {formatEUR(-cortesia)}: gli spicci in più sono
                    mance, si registrano nella sezione Mance — non qui.
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {ORDER_PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.value}
                    type="button"
                    disabled={busy || totaleRomana <= 0 || totaleRomana > total}
                    onClick={() => handleRomana(pm.value)}
                    className="flex-1 rounded-lg bg-b58-olive hover:bg-b58-olive-dark disabled:opacity-50 transition-colors text-b58-parchment text-sm font-medium px-3 py-2"
                  >
                    Chiudi a {formatEUR(totaleRomana)} — {pm.label.toLowerCase()}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setMode(null)} className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta-dark px-2">
                Indietro
              </button>
            </div>
          )}

          {(mode === "sconto" || mode === "omaggio") && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-b58-charcoal">
                {labelFor(DISCOUNT_GIFT_TYPES, mode)} — {formatEUR(total)} a listino
              </h3>
              {mode === "sconto" && (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={total}
                  value={form.collectedAmount}
                  onChange={(e) => setForm((f) => ({ ...f, collectedAmount: e.target.value }))}
                  placeholder="Importo effettivamente incassato €"
                  className={inputClass}
                />
              )}
              <select
                value={form.causaleId}
                onChange={(e) => setForm((f) => ({ ...f, causaleId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Causale —</option>
                {causali.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <select
                value={form.deviceId}
                onChange={(e) => setForm((f) => ({ ...f, deviceId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Device (opz.)</option>
                {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select
                value={form.customerId}
                onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Cliente (opz.)</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name || c.phone}</option>)}
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || (mode === "sconto" && !form.collectedAmount)}
                  onClick={handleDiscountGift}
                  className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
                >
                  Conferma
                </button>
                <button type="button" onClick={() => setMode(null)} className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta-dark px-2">
                  Indietro
                </button>
              </div>
            </div>
          )}

          {mode === "annulla" && (
            <div className="space-y-2">
              <input
                value={form.cancelReason}
                onChange={(e) => setForm((f) => ({ ...f, cancelReason: e.target.value }))}
                placeholder="Motivo dell'annullamento (obbligatorio)"
                className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || !form.cancelReason.trim()}
                  onClick={handleCancel}
                  className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
                >
                  Conferma annullamento
                </button>
                <button type="button" onClick={() => setMode(null)} className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta-dark px-2">
                  Indietro
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
