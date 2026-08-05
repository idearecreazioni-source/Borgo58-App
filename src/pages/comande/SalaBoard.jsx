import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDraftItem,
  createDiningTables,
  createOrder,
  deactivateDiningTable,
  getOrder,
  listDiningTables,
  listMenuForOrder,
  listOpenOrders,
  removeDraftItem,
  sendDraftItems,
  updateDraftItemQuantity,
  voidSentItem,
} from "../../lib/api/orders";
import { formatEUR } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";
import TicketColumn from "./TicketColumn";
import CloseOrderModal from "./CloseOrderModal";

const lineLabel = (item) => item.recipe?.name || item.free_text_name;
const lineTotal = (item) => item.quantity * Number(item.unit_price);

// Schermo unico Comande (§3.2, ridisegno su richiesta esplicita di Alessio,
// dopo aver provato la prima versione a pagine separate): Sala, Cucina e
// Bar visibili insieme, come nel prototipo UX di Cowork — pensato per
// restare aperto tutto il servizio su un tablet, non per essere consultato
// ogni tanto come il resto del gestionale.
export default function SalaBoard() {
  const { isTitolare } = useAuth();
  const [tables, setTables] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [order, setOrder] = useState(null); // ordine aperto in sala, con items
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showClose, setShowClose] = useState(false);

  const [addMode, setAddMode] = useState("menu");
  const [freeForm, setFreeForm] = useState({ name: "", price: "", destination: "bar", quantity: 1 });
  const [draftNote, setDraftNote] = useState("");

  const [showManageTables, setShowManageTables] = useState(false);
  const [newTable, setNewTable] = useState("");
  const [savingTable, setSavingTable] = useState(false);

  const loadBoard = () =>
    Promise.all([listDiningTables(), listOpenOrders()]).then(([t, o]) => {
      setTables(t);
      setOpenOrders(o);
    });

  useEffect(() => {
    loadBoard().catch((e) => setError(e.message));
    listMenuForOrder().then(setMenu).catch((e) => setError(e.message));
  }, []);

  const orderForLabel = (label) => openOrders.find((o) => o.table_label === label);

  const openTable = async (label) => {
    setError("");
    setLoadingOrder(true);
    try {
      let existing = orderForLabel(label);
      if (!existing) {
        existing = await createOrder({ tableLabel: label });
        await loadBoard();
      }
      const full = await getOrder(existing.id);
      setOrder(full);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingOrder(false);
    }
  };

  const reloadCurrentOrder = () => (order ? getOrder(order.id).then(setOrder) : Promise.resolve());

  const withBusy = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reloadCurrentOrder();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAddMenuItem = (mi) =>
    withBusy(() => addDraftItem(order.id, { recipeId: mi.recipe_id, destination: "cucina", quantity: 1, unitPrice: mi.selling_price }));

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

  const handleSend = () =>
    withBusy(() => sendDraftItems(order.id)).then(() => {
      setDraftNote("");
      setRefreshKey((k) => k + 1);
      loadBoard();
    });

  const handleVoid = (itemId) => {
    const reason = window.prompt("Motivo dell'annullamento (obbligatorio):");
    if (reason === null) return;
    if (!reason.trim()) return setError("Serve un motivo per annullare una riga già inviata.");
    withBusy(() => voidSentItem(itemId, reason.trim()));
  };

  const handleCloseDone = () => {
    setShowClose(false);
    setOrder(null);
    loadBoard();
  };

  // Un tavolo per riga, tutti aggiunti in un colpo solo — la prima versione
  // (un input, un click per tavolo) era un fastidio inutile con una decina
  // di tavoli veri da configurare, segnalato da Alessio.
  const handleAddTables = async (e) => {
    e.preventDefault();
    const labels = newTable
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (labels.length === 0) return;
    setSavingTable(true);
    setError("");
    try {
      await createDiningTables(labels, tables.length);
      setNewTable("");
      await loadBoard();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingTable(false);
    }
  };

  const handleRemoveTable = (id) => withBusy(() => deactivateDiningTable(id)).then(loadBoard);

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";

  const draftItems = order?.items.filter((i) => !i.sent_at) ?? [];
  const sentItems = order?.items.filter((i) => i.sent_at && !i.voided_at) ?? [];
  const total = order?.items.filter((i) => !i.voided_at).reduce((s, i) => s + lineTotal(i), 0) ?? 0;

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex items-center justify-between gap-4 mb-4 shrink-0">
        <h1 className="font-display text-2xl text-b58-charcoal">Comande</h1>
        {isTitolare && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowManageTables((v) => !v)}
              className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2"
            >
              {showManageTables ? "Chiudi" : "Gestisci tavoli"}
            </button>
            <Link to="/cassa" className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-sm font-medium px-4 py-2">
              Gestione cassa
            </Link>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3 shrink-0">{error}</p>
      )}

      {showManageTables && (
        <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 mb-4 shrink-0">
          <form onSubmit={handleAddTables} className="mb-3">
            <p className="text-xs text-b58-charcoal-soft/70 mb-1.5">
              Un tavolo per riga — li aggiunge tutti insieme.
            </p>
            <textarea
              value={newTable}
              onChange={(e) => setNewTable(e.target.value)}
              placeholder={'T1\nT2\nT3\nChef Table\nDivano 1'}
              rows={4}
              className={`${inputClass} font-mono mb-2`}
            />
            <button type="submit" disabled={savingTable} className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2">
              {savingTable ? "Aggiungo…" : "+ Aggiungi tutti"}
            </button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {tables.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5 text-xs bg-white rounded-full border border-b58-charcoal/15 pl-3 pr-1.5 py-1">
                {t.label}
                <button type="button" onClick={() => handleRemoveTable(t.id)} className="text-b58-charcoal-soft hover:text-b58-terracotta-dark">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr] gap-4 flex-1 min-h-0">
        {/* SALA */}
        <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 flex flex-col overflow-hidden">
          <div className="bg-b58-olive text-b58-parchment px-4 py-2.5 shrink-0">
            <span className="font-display text-sm uppercase tracking-wide">Sala — Presa ordini</span>
          </div>
          <div className="p-3 overflow-y-auto flex-1 space-y-3">
            {tables.length === 0 ? (
              <p className="text-xs text-b58-charcoal-soft/60 text-center py-6">
                Nessun tavolo configurato.{isTitolare && ' Usa "Gestisci tavoli" qui sopra.'}
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {tables.map((t) => {
                  const existing = orderForLabel(t.label);
                  const isSelected = order?.table_label === t.label;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openTable(t.label)}
                      className={`relative text-xs rounded-lg py-2 px-1 text-center transition-colors ${
                        isSelected
                          ? "bg-b58-terracotta text-b58-parchment"
                          : "bg-b58-cream-dark/60 text-b58-charcoal hover:bg-b58-cream-dark"
                      }`}
                    >
                      {t.label}
                      {existing && !isSelected && (
                        <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-b58-terracotta" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {loadingOrder ? (
              <p className="text-xs text-b58-charcoal-soft">Apro il tavolo…</p>
            ) : order ? (
              <>
                <div className="flex gap-2">
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
                    Voce libera
                  </button>
                </div>

                {addMode === "menu" ? (
                  <div className="max-h-32 overflow-y-auto space-y-0.5">
                    {menu.length === 0 ? (
                      <p className="text-xs text-b58-charcoal-soft/60">Nessun menu attivo.</p>
                    ) : (
                      menu.map((mi) => (
                        <button
                          key={mi.id}
                          type="button"
                          disabled={busy}
                          onClick={() => handleAddMenuItem(mi)}
                          className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded-lg hover:bg-b58-cream-dark disabled:opacity-60"
                        >
                          <span className="text-b58-charcoal">{mi.recipe_name}</span>
                          <span className="text-b58-charcoal-soft">{formatEUR(mi.selling_price)}</span>
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleAddFree} className="space-y-1.5">
                    <input
                      required
                      value={freeForm.name}
                      onChange={(e) => setFreeForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder='Es. "Calice vino rosso"'
                      className={inputClass}
                    />
                    <div className="flex gap-1.5">
                      <input
                        required
                        type="number"
                        step="0.01"
                        min="0"
                        value={freeForm.price}
                        onChange={(e) => setFreeForm((f) => ({ ...f, price: e.target.value }))}
                        placeholder="€"
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
                    </div>
                    <button type="submit" disabled={busy} className="w-full rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-60 text-b58-charcoal text-xs font-medium px-3 py-1.5">
                      + Aggiungi
                    </button>
                  </form>
                )}

                <div className="border-t border-b58-charcoal/10 pt-2">
                  {order.items.length === 0 ? (
                    <p className="text-xs text-b58-charcoal-soft/60">Comanda vuota.</p>
                  ) : (
                    <ul className="space-y-1 mb-2">
                      {draftItems.map((it) => (
                        <li key={it.id} className="flex items-center justify-between gap-1.5 text-xs">
                          <span className="text-b58-charcoal flex-1 min-w-0 truncate">{lineLabel(it)}</span>
                          <button type="button" onClick={() => withBusy(() => updateDraftItemQuantity(it.id, it.quantity - 1))} className="w-5 h-5 rounded border border-b58-charcoal/15">−</button>
                          <b className="w-3 text-center">{it.quantity}</b>
                          <button type="button" onClick={() => withBusy(() => updateDraftItemQuantity(it.id, it.quantity + 1))} className="w-5 h-5 rounded border border-b58-charcoal/15">+</button>
                          <span className="text-b58-charcoal-soft w-10 text-right shrink-0">{formatEUR(lineTotal(it))}</span>
                          <button type="button" onClick={() => withBusy(() => removeDraftItem(it.id))} className="text-b58-charcoal-soft hover:text-b58-terracotta-dark">✕</button>
                        </li>
                      ))}
                      {sentItems.map((it) => (
                        <li key={it.id} className="flex items-center justify-between gap-1.5 text-xs opacity-70">
                          <span className="text-b58-charcoal flex-1 min-w-0 truncate">{it.quantity}× {lineLabel(it)} <span className="text-b58-charcoal-soft">· inviata</span></span>
                          <span className="text-b58-charcoal-soft w-10 text-right shrink-0">{formatEUR(lineTotal(it))}</span>
                          <button type="button" onClick={() => handleVoid(it.id)} className="text-b58-charcoal-soft hover:text-b58-terracotta-dark text-[10px]">annulla</button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {draftItems.length > 0 && (
                    <>
                      <input
                        value={draftNote}
                        onChange={(e) => setDraftNote(e.target.value)}
                        placeholder="Nota (allergie, senza cipolla…)"
                        className={`${inputClass} mb-1.5`}
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleSend}
                        className="w-full rounded-lg bg-b58-olive hover:bg-b58-olive-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-3 py-2 mb-1.5"
                      >
                        Invia comanda a cucina/bar
                      </button>
                    </>
                  )}

                  <div className="flex items-center justify-between text-sm font-medium text-b58-charcoal py-1">
                    <span>Totale</span>
                    <span>{formatEUR(total)}</span>
                  </div>
                  <button
                    type="button"
                    disabled={sentItems.length === 0}
                    onClick={() => setShowClose(true)}
                    className="w-full rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-40 transition-colors text-b58-parchment text-sm font-medium px-3 py-2"
                  >
                    Chiudi conto tavolo
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-b58-charcoal-soft/60 text-center py-6">Seleziona un tavolo.</p>
            )}
          </div>
        </div>

        {/* CUCINA */}
        <TicketColumn destination="cucina" refreshKey={refreshKey} />

        {/* BAR */}
        <TicketColumn destination="bar" refreshKey={refreshKey} />
      </div>

      {showClose && order && (
        <CloseOrderModal order={order} onClose={() => setShowClose(false)} onDone={handleCloseDone} />
      )}
    </div>
  );
}
