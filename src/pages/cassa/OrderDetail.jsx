import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  addDraftItem,
  cancelOrder,
  closeOrderAsDiscountGift,
  closeOrderPaid,
  getOrder,
  listMenuForOrder,
  removeDraftItem,
  sendDraftItems,
  updateDraftItemQuantity,
  voidSentItem,
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

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [menu, setMenu] = useState([]);
  const [causali, setCausali] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [addMode, setAddMode] = useState("menu"); // "menu" | "libera"
  const [freeForm, setFreeForm] = useState({ name: "", price: "", destination: "bar", quantity: 1 });
  const [draftNote, setDraftNote] = useState("");

  const [closeMode, setCloseMode] = useState(null); // null | "sconto" | "omaggio" | "annulla"
  const [closeForm, setCloseForm] = useState({
    collectedAmount: "",
    causaleId: "",
    causaleNote: "",
    customerId: "",
    deviceId: "",
    note: "",
    cancelReason: "",
  });

  const load = () =>
    getOrder(id).then((o) => {
      setOrder(o);
      return o;
    });

  useEffect(() => {
    setLoading(true);
    Promise.all([load(), listMenuForOrder(), listCausali("sconto_omaggio"), listCustomers(), listPosDevices()])
      .then(([, m, c, cu, d]) => {
        setMenu(m);
        setCausali(c);
        setCustomers(cu);
        setDevices(d);
      })
      .catch((e) => {
        if (e.code === "PGRST116") setNotFound(true);
        else setError(e.message);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const withBusy = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (notFound) return <Navigate to="/cassa/comande" replace />;
  if (loading || !order) {
    return <p className="text-sm text-b58-charcoal-soft max-w-2xl mx-auto">Caricamento…</p>;
  }

  const draftItems = order.items.filter((i) => !i.sent_at);
  const sentItems = order.items.filter((i) => i.sent_at && !i.voided_at);
  const total = order.items.filter((i) => !i.voided_at).reduce((s, i) => s + lineTotal(i), 0);
  const isOpen = order.status === "aperto";

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const handleAddMenuItem = (mi) =>
    withBusy(() =>
      addDraftItem(order.id, {
        recipeId: mi.recipe_id,
        destination: "cucina",
        quantity: 1,
        unitPrice: mi.selling_price,
      })
    );

  const handleAddFree = (e) => {
    e.preventDefault();
    if (!freeForm.name.trim() || !freeForm.price) return;
    withBusy(() =>
      addDraftItem(order.id, {
        freeTextName: freeForm.name.trim(),
        destination: freeForm.destination,
        quantity: Number(freeForm.quantity) || 1,
        unitPrice: Number(freeForm.price),
      })
    ).then(() => setFreeForm({ name: "", price: "", destination: "bar", quantity: 1 }));
  };

  const handleSend = () => withBusy(() => sendDraftItems(order.id));

  const handleVoid = (itemId) => {
    const reason = window.prompt("Motivo dell'annullamento (obbligatorio, per tracciabilità):");
    if (reason === null) return;
    if (!reason.trim()) {
      setError("Serve un motivo per annullare una riga già inviata.");
      return;
    }
    withBusy(() => voidSentItem(itemId, reason.trim()));
  };

  const handleClosePaid = (paymentMethod) => withBusy(() => closeOrderPaid(order.id, paymentMethod));

  const handleCancel = () => {
    if (!closeForm.cancelReason.trim()) return;
    withBusy(() => cancelOrder(order.id, closeForm.cancelReason.trim())).then(() => setCloseMode(null));
  };

  const handleDiscountGift = () => {
    const isGift = closeMode === "omaggio";
    if (!isGift && !closeForm.collectedAmount) return;
    withBusy(() =>
      closeOrderAsDiscountGift(order.id, {
        entityId: order.entity_id,
        isGift,
        fullAmount: total,
        collectedAmount: closeForm.collectedAmount,
        causaleId: closeForm.causaleId || null,
        causaleNote: closeForm.causaleNote || null,
        customerId: closeForm.customerId || null,
        deviceId: closeForm.deviceId || null,
        note: closeForm.note || null,
      })
    ).then(() => setCloseMode(null));
  };

  return (
    <div className="max-w-3xl mx-auto pb-16">
      <Link to="/cassa/comande" className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta">
        ← Comande
      </Link>

      <div className="flex items-center justify-between gap-4 flex-wrap mt-1 mb-6">
        <h1 className="font-display text-2xl text-b58-charcoal">{order.table_label}</h1>
        {!isOpen && (
          <span className="text-xs uppercase tracking-wide text-b58-charcoal-soft bg-b58-charcoal/10 rounded-full px-3 py-1">
            {order.status === "chiuso" && `Chiuso${order.payment_method ? " · " + labelFor(ORDER_PAYMENT_METHODS, order.payment_method) : ""}`}
            {order.status === "annullato" && `Annullato · ${order.cancel_reason}`}
            {order.status === "omaggiato" && "Omaggiato"}
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {isOpen && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-4">
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setAddMode("menu")}
              className={`text-xs rounded-full px-3 py-1.5 border ${addMode === "menu" ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta" : "border-b58-charcoal/15 text-b58-charcoal-soft"}`}
            >
              Dal menu
            </button>
            <button
              type="button"
              onClick={() => setAddMode("libera")}
              className={`text-xs rounded-full px-3 py-1.5 border ${addMode === "libera" ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta" : "border-b58-charcoal/15 text-b58-charcoal-soft"}`}
            >
              Voce libera (bevande, fuori menu)
            </button>
          </div>

          {addMode === "menu" ? (
            menu.length === 0 ? (
              <p className="text-sm text-b58-charcoal-soft/60">Nessun menu attivo — impostane uno da Editor Menu.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {menu.map((mi) => (
                  <button
                    key={mi.id}
                    type="button"
                    disabled={busy}
                    onClick={() => handleAddMenuItem(mi)}
                    className="w-full flex items-center justify-between gap-3 text-sm px-2 py-1.5 rounded-lg hover:bg-b58-cream-dark disabled:opacity-60"
                  >
                    <span className="text-b58-charcoal">{mi.recipe_name}</span>
                    <span className="text-b58-charcoal-soft shrink-0">{formatEUR(mi.selling_price)}</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <form onSubmit={handleAddFree} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
              <input
                required
                value={freeForm.name}
                onChange={(e) => setFreeForm((f) => ({ ...f, name: e.target.value }))}
                placeholder='Es. "Calice vino rosso"'
                className={`${inputClass} col-span-2`}
              />
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={freeForm.price}
                onChange={(e) => setFreeForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="Prezzo €"
                className={inputClass}
              />
              <select
                value={freeForm.destination}
                onChange={(e) => setFreeForm((f) => ({ ...f, destination: e.target.value }))}
                className={inputClass}
              >
                <option value="bar">Bar</option>
                <option value="cucina">Cucina</option>
              </select>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
              >
                Aggiungi
              </button>
            </form>
          )}
        </div>
      )}

      {isOpen && draftItems.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">
            Comanda in corso — non ancora inviata
          </h2>
          <ul className="space-y-1.5 mb-3">
            {draftItems.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-b58-charcoal flex-1 min-w-0 truncate">{lineLabel(it)}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => withBusy(() => updateDraftItemQuantity(it.id, it.quantity - 1))}
                    className="w-6 h-6 rounded border border-b58-charcoal/15 text-b58-charcoal-soft hover:bg-b58-cream-dark"
                  >
                    −
                  </button>
                  <b className="w-4 text-center">{it.quantity}</b>
                  <button
                    type="button"
                    onClick={() => withBusy(() => updateDraftItemQuantity(it.id, it.quantity + 1))}
                    className="w-6 h-6 rounded border border-b58-charcoal/15 text-b58-charcoal-soft hover:bg-b58-cream-dark"
                  >
                    +
                  </button>
                  <span className="text-b58-charcoal-soft w-14 text-right">{formatEUR(lineTotal(it))}</span>
                  <button
                    type="button"
                    onClick={() => withBusy(() => removeDraftItem(it.id))}
                    className="text-b58-charcoal-soft hover:text-b58-terracotta-dark ml-1"
                    title="Rimuovi"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <input
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
            placeholder="Nota per cucina/bar (es. allergie, senza cipolla…)"
            className={`${inputClass} mb-3`}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => withBusy(() => sendDraftItems(order.id)).then(() => setDraftNote(""))}
            className="w-full rounded-lg bg-b58-olive hover:bg-b58-olive-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
          >
            Invia comanda a cucina/bar
          </button>
        </div>
      )}

      {sentItems.length > 0 && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">Già inviato</h2>
          <ul className="space-y-1.5">
            {sentItems.map((it) => (
              <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-b58-charcoal">
                  {it.quantity}× {lineLabel(it)}
                  <span className="text-b58-charcoal-soft ml-1.5 text-xs">· {it.destination}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-b58-charcoal-soft">{formatEUR(lineTotal(it))}</span>
                  {isOpen && (
                    <button
                      type="button"
                      onClick={() => handleVoid(it.id)}
                      className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                    >
                      Annulla
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.items.some((i) => i.voided_at) && (
        <div className="rounded-xl bg-b58-parchment/60 ring-1 ring-b58-charcoal/10 p-4 mb-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-b58-charcoal-soft mb-2">Annullate</h2>
          <ul className="space-y-1">
            {order.items
              .filter((i) => i.voided_at)
              .map((it) => (
                <li key={it.id} className="text-xs text-b58-charcoal-soft line-through">
                  {it.quantity}× {lineLabel(it)} — {it.void_reason}
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl bg-b58-charcoal/5 px-4 py-3 mb-4">
        <span className="text-sm font-medium text-b58-charcoal">Totale</span>
        <span className="text-lg font-medium text-b58-charcoal">{formatEUR(total)}</span>
      </div>

      {isOpen && sentItems.length > 0 && closeMode === null && (
        <div className="flex flex-wrap gap-2">
          {ORDER_PAYMENT_METHODS.map((pm) => (
            <button
              key={pm.value}
              type="button"
              disabled={busy}
              onClick={() => handleClosePaid(pm.value)}
              className="rounded-lg bg-b58-olive hover:bg-b58-olive-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
            >
              Chiudi — paga {pm.label.toLowerCase()}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCloseMode("sconto")}
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
          >
            Sconto
          </button>
          <button
            type="button"
            onClick={() => setCloseMode("omaggio")}
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
          >
            Omaggio
          </button>
          <button
            type="button"
            onClick={() => setCloseMode("annulla")}
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-terracotta-dark text-sm font-medium px-4 py-2"
          >
            Annulla tavolo
          </button>
        </div>
      )}

      {isOpen && (closeMode === "sconto" || closeMode === "omaggio") && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 space-y-3">
          <h2 className="font-display text-base text-b58-charcoal">
            {labelFor(DISCOUNT_GIFT_TYPES, closeMode)} — {formatEUR(total)} a listino
          </h2>
          {closeMode === "sconto" && (
            <input
              type="number"
              step="0.01"
              min="0"
              max={total}
              value={closeForm.collectedAmount}
              onChange={(e) => setCloseForm((f) => ({ ...f, collectedAmount: e.target.value }))}
              placeholder="Importo effettivamente incassato €"
              className={inputClass}
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={closeForm.causaleId}
              onChange={(e) => setCloseForm((f) => ({ ...f, causaleId: e.target.value }))}
              className={inputClass}
            >
              <option value="">Causale —</option>
              {causali.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <select
              value={closeForm.deviceId}
              onChange={(e) => setCloseForm((f) => ({ ...f, deviceId: e.target.value }))}
              className={inputClass}
            >
              <option value="">Device (opz.)</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <select
            value={closeForm.customerId}
            onChange={(e) => setCloseForm((f) => ({ ...f, customerId: e.target.value }))}
            className={inputClass}
          >
            <option value="">Cliente (opz.)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name || c.phone}</option>
            ))}
          </select>
          <input
            value={closeForm.note}
            onChange={(e) => setCloseForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="Nota (opz.)"
            className={inputClass}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || (closeMode === "sconto" && !closeForm.collectedAmount)}
              onClick={handleDiscountGift}
              className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
            >
              Conferma
            </button>
            <button type="button" onClick={() => setCloseMode(null)} className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta-dark px-2">
              Annulla
            </button>
          </div>
        </div>
      )}

      {isOpen && closeMode === "annulla" && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 space-y-3">
          <input
            value={closeForm.cancelReason}
            onChange={(e) => setCloseForm((f) => ({ ...f, cancelReason: e.target.value }))}
            placeholder="Motivo dell'annullamento (obbligatorio)"
            className={inputClass}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !closeForm.cancelReason.trim()}
              onClick={handleCancel}
              className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
            >
              Conferma annullamento
            </button>
            <button type="button" onClick={() => setCloseMode(null)} className="text-sm text-b58-charcoal-soft hover:text-b58-terracotta-dark px-2">
              Indietro
            </button>
          </div>
        </div>
      )}

      {!isOpen && (
        <p className="text-xs text-b58-charcoal-soft/60 mt-4">
          Nessun incasso è stato registrato in cassa: l'integrazione con il registratore telematico (§3.2) è un
          pezzo futuro, in attesa dell'hardware.
        </p>
      )}
    </div>
  );
}
