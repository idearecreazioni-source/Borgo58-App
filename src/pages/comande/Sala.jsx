import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  addDraftItem,
  createDiningTables,
  deactivateDiningTable,
  getOrder,
  getServiceSettings,
  listDiningTables,
  listMenuForOrder,
  listOpenOrders,
  moveOrderTable,
  openOrderForTable,
  orderTotals,
  removeDraftItem,
  sendDraftItems,
  setOrderCoperti,
  updateCopertoPrice,
  updateDraftItemQuantity,
  updateItemNote,
  updateOrderNote,
  voidSentItem,
} from "../../lib/api/orders";
import { listBarItems } from "../../lib/api/barItems";
import { RECIPE_CATEGORIES, formatEUR } from "../../lib/constants";
import { useAuth } from "../../context/AuthContext";
import CalibrazioneTocco from "./CalibrazioneTocco";
import CloseOrderModal from "./CloseOrderModal";
import CampoAutosalvato from "../../components/CampoAutosalvato";
import PrecontoModal from "./PrecontoModal";

const lineLabel = (item) => item.recipe?.name || item.free_text_name;
const lineTotal = (item) => item.quantity * Number(item.unit_price);

// Schermata SALA — tablet 8,7" in verticale, tenuto in mano fra i tavoli
// (§3.2.1, disegno validato con Alessio sul simulatore a grandezza reale).
//
// Perche' e' una colonna sola e non le tre di prima: la Cucina non ha
// schermo (solo stampante, scelta deliberata) e il Bar ha un tablet suo,
// orizzontale, con un layout da cassa. Un'unica schermata a tre colonne
// non e' una versione compatta di quel disegno: e' un disegno diverso.
//
// Le misure dei tocchi sono in CENTIMETRI REALI (classi .tocco-*), non in
// pixel: durante un servizio pieno la differenza fra 1 cm e 6 mm e'
// mandare in cucina il piatto sbagliato.
export default function Sala() {
  const { isTitolare } = useAuth();

  const [tables, setTables] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [barItems, setBarItems] = useState([]);
  const [showWines, setShowWines] = useState(false);
  const [copertoPrice, setCopertoPrice] = useState(null);
  const [order, setOrder] = useState(null);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);

  const [showFreeForm, setShowFreeForm] = useState(false);
  const [freeForm, setFreeForm] = useState({ name: "", price: "", destination: "bar" });

  const [showPrecon, setShowPrecon] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showMove, setShowMove] = useState(false);

  const [panel, setPanel] = useState(null); // null | "tavoli" | "calibrazione"
  const [newTables, setNewTables] = useState("");
  const [savingTables, setSavingTables] = useState(false);
  const [priceDraft, setPriceDraft] = useState("");

  const loadBoard = () =>
    Promise.all([listDiningTables(), listOpenOrders()]).then(([t, o]) => {
      setTables(t);
      setOpenOrders(o);
    });

  useEffect(() => {
    loadBoard().catch((e) => setError(e.message));
    listMenuForOrder().then(setMenu).catch((e) => setError(e.message));
    listBarItems().then(setBarItems).catch((e) => setError(e.message));
    getServiceSettings()
      .then((s) => {
        setCopertoPrice(Number(s.coperto_price));
        setPriceDraft(String(s.coperto_price));
      })
      .catch((e) =>
        // Messaggio esplicito invece di un fallback silenzioso: un conto
        // calcolato senza coperto sembrerebbe giusto e sarebbe sbagliato.
        setError(
          `Impostazioni di sala non leggibili (${e.message}). Se la migrazione dei coperti non è ancora stata applicata, il coperto non verrà conteggiato.`
        )
      );
  }, []);

  const orderForLabel = (label) => openOrders.find((o) => o.table_label === label);

  // L'elenco dei tavoli occupati che ha in mano questa schermata puo'
  // essere vecchio di qualche secondo: openOrderForTable interroga il
  // database adesso e, se un altro tablet ha aperto il tavolo nel
  // frattempo, apre QUEL conto invece di crearne un secondo.
  const openTable = async (label) => {
    setError("");
    setLoadingOrder(true);
    try {
      const orderId = await openOrderForTable(label);
      const full = await getOrder(orderId);
      setOrder(full);
      await loadBoard();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingOrder(false);
    }
  };

  const reloadOrder = () => (order ? getOrder(order.id).then(setOrder) : Promise.resolve());

  const withBusy = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reloadOrder();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAddMenuItem = (mi) =>
    withBusy(() =>
      addDraftItem(order.id, {
        recipeId: mi.recipe_id,
        destination: "cucina",
        quantity: 1,
        unitPrice: mi.selling_price,
      })
    );

  // Vini e bevande non sono ricette: sulla riga della comanda finiscono
  // come testo, col formato accanto al nome ("Grillo · calice"), perche' in
  // cucina e al bar la differenza fra un calice e una bottiglia conta.
  const handleAddBarItem = (item) =>
    withBusy(() =>
      addDraftItem(order.id, {
        freeTextName: item.serving ? `${item.name} · ${item.serving}` : item.name,
        destination: "bar",
        quantity: 1,
        unitPrice: item.selling_price,
      })
    );

  const handleAddFree = (e) => {
    e.preventDefault();
    if (!freeForm.name.trim() || !freeForm.price) return;
    withBusy(() =>
      addDraftItem(order.id, {
        freeTextName: freeForm.name.trim(),
        destination: freeForm.destination,
        quantity: 1,
        unitPrice: Number(freeForm.price),
      })
    ).then(() => setFreeForm({ name: "", price: "", destination: "bar" }));
  };

  const handleCoperti = (n) => withBusy(() => setOrderCoperti(order.id, n));

  // Le note (del piatto e del tavolo) si salvano da sole mentre si scrive,
  // quindi qui non c'e' niente da ricordarsi di salvare prima dell'invio.
  // Si mandano SOLO le righe visibili su questo schermo: se il Bar sta
  // componendo un altro giro sullo stesso tavolo, il suo non parte.
  const handleSend = () =>
    withBusy(() => sendDraftItems(order.id, draftItems.map((i) => i.id))).then(loadBoard);

  const handleVoid = (itemId) => {
    const reason = window.prompt("Motivo dell'annullamento (obbligatorio):");
    if (reason === null) return;
    if (!reason.trim()) return setError("Serve un motivo per annullare una riga già inviata.");
    withBusy(() => voidSentItem(itemId, reason.trim()));
  };

  const handleAddTables = async (e) => {
    e.preventDefault();
    const labels = newTables.split("\n").map((l) => l.trim()).filter(Boolean);
    if (labels.length === 0) return;
    setSavingTables(true);
    setError("");
    try {
      await createDiningTables(labels, tables.length);
      setNewTables("");
      await loadBoard();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingTables(false);
    }
  };

  const handleSavePrice = () =>
    updateCopertoPrice(priceDraft)
      .then(() => setCopertoPrice(Number(priceDraft)))
      .catch((e) => setError(e.message));

  const draftItems = order?.items.filter((i) => !i.sent_at && !i.voided_at) ?? [];
  const sentItems = order?.items.filter((i) => i.sent_at && !i.voided_at) ?? [];
  const { coperti, copertoTotal, total } = orderTotals(order, copertoPrice);

  // Menu raggruppato per portata, nell'ordine in cui si mangia — non in
  // ordine alfabetico, che in sala non serve a nessuno.
  const menuByCategory = RECIPE_CATEGORIES.map((c) => ({
    ...c,
    items: menu.filter((mi) => mi.category === c.value),
  })).filter((c) => c.items.length > 0);

  // I vini stanno in una schermata separata (§3.2.1: incolonnati nel menu
  // lo allungavano troppo), le altre bevande restano nell'elenco
  // principale accanto ai piatti.
  const raggruppaPerCategoria = (voci) => {
    const categorie = [...new Set(voci.map((v) => v.category))];
    return categorie.map((nome) => ({ nome, voci: voci.filter((v) => v.category === nome) }));
  };
  const vini = raggruppaPerCategoria(barItems.filter((b) => b.section === "vini"));
  const bevande = raggruppaPerCategoria(barItems.filter((b) => b.section === "bevande"));

  // Riga di un vino o di una bevanda: stesso target di tocco dei piatti.
  const RigaBar = ({ v }) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => handleAddBarItem(v)}
      className="tocco-riga w-full flex items-center gap-2 px-2 rounded-lg text-left hover:bg-b58-cream-dark/70 active:bg-b58-cream-dark disabled:opacity-50 border-b border-b58-charcoal/5"
    >
      <span className="flex-1 min-w-0 text-sm text-b58-charcoal leading-tight">
        {v.name}
        {v.serving && <span className="text-b58-charcoal-soft"> · {v.serving}</span>}
        {v.producer && <span className="block text-[11px] text-b58-charcoal-soft/70">{v.producer}</span>}
      </span>
      <span className="text-xs text-b58-charcoal-soft shrink-0">{formatEUR(v.selling_price)}</span>
      <span className="tocco-bottone shrink-0 rounded-lg bg-b58-terracotta text-b58-parchment flex items-center justify-center text-lg pointer-events-none">
        +
      </span>
    </button>
  );

  const inputClass =
    "w-full rounded-lg border border-b58-charcoal/15 bg-white px-3 py-2 text-sm text-b58-charcoal focus:outline-none focus:ring-2 focus:ring-b58-terracotta";
  const sectionLabel =
    "text-[11px] uppercase tracking-wide font-semibold text-b58-charcoal-soft/70 mb-1.5";

  return (
    <div className="max-w-md mx-auto pb-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h1 className="font-display text-2xl text-b58-charcoal leading-none">Sala</h1>
          <p className="text-xs text-b58-charcoal-soft/70 mt-1">
            {order ? (
              <>
                Tavolo {order.table_label} aperto
                {" · "}
                <button
                  type="button"
                  onClick={() => setShowMove(true)}
                  className="underline hover:text-b58-terracotta-dark"
                >
                  sposta
                </button>
              </>
            ) : (
              "Nessun tavolo aperto"
            )}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Link
            to="/comande/bar"
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-xs font-medium px-3 py-2"
          >
            Bar
          </Link>
          <Link
            to="/comande/cucina"
            className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-xs font-medium px-3 py-2"
          >
            Cucina
          </Link>
          {isTitolare && (
            <button
              type="button"
              onClick={() => setPanel((p) => (p ? null : "tavoli"))}
              className="rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark transition-colors text-b58-charcoal text-xs font-medium px-3 py-2"
            >
              {panel ? "Chiudi" : "Impostazioni"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-b58-terracotta-dark bg-b58-terracotta/10 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      {panel && isTitolare && (
        <div className="space-y-3 mb-4">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPanel("tavoli")}
              className={`text-xs rounded-full px-3 py-1.5 border ${panel === "tavoli" ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta" : "border-b58-charcoal/15 text-b58-charcoal-soft"}`}
            >
              Tavoli e coperto
            </button>
            <button
              type="button"
              onClick={() => setPanel("calibrazione")}
              className={`text-xs rounded-full px-3 py-1.5 border ${panel === "calibrazione" ? "bg-b58-terracotta text-b58-parchment border-b58-terracotta" : "border-b58-charcoal/15 text-b58-charcoal-soft"}`}
            >
              Dimensione dei tocchi
            </button>
          </div>

          {panel === "calibrazione" && <CalibrazioneTocco onClose={() => setPanel(null)} />}

          {panel === "tavoli" && (
            <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-4 space-y-4">
              <div>
                <p className={sectionLabel}>Prezzo del coperto</p>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={priceDraft}
                    onChange={(e) => setPriceDraft(e.target.value)}
                    className={`${inputClass} w-28`}
                  />
                  <span className="text-sm text-b58-charcoal-soft">€ a persona</span>
                  <button
                    type="button"
                    onClick={handleSavePrice}
                    className="rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
                  >
                    Salva
                  </button>
                </div>
                <p className="text-[11px] text-b58-charcoal-soft/70 mt-1.5 leading-relaxed">
                  Vale dai conti aperti da adesso in poi: i conti già chiusi conservano
                  il prezzo che avevano quando sono stati pagati.
                </p>
              </div>

              <div>
                <p className={sectionLabel}>Tavoli</p>
                <form onSubmit={handleAddTables} className="mb-2">
                  <textarea
                    value={newTables}
                    onChange={(e) => setNewTables(e.target.value)}
                    placeholder={"T1\nT2\nChef Table"}
                    rows={3}
                    className={`${inputClass} font-mono mb-2`}
                  />
                  <button
                    type="submit"
                    disabled={savingTables}
                    className="rounded-lg bg-b58-olive hover:bg-b58-olive-dark disabled:opacity-60 transition-colors text-b58-parchment text-sm font-medium px-4 py-2"
                  >
                    {savingTables ? "Aggiungo…" : "+ Aggiungi (uno per riga)"}
                  </button>
                </form>
                <div className="flex flex-wrap gap-1.5">
                  {tables.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-1.5 text-xs bg-white rounded-full border border-b58-charcoal/15 pl-3 pr-1.5 py-1">
                      {t.label}
                      <button
                        type="button"
                        onClick={() => deactivateDiningTable(t.id).then(loadBoard).catch((e) => setError(e.message))}
                        className="text-b58-charcoal-soft hover:text-b58-terracotta-dark"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAVOLI ------------------------------------------------------- */}
      <p className={sectionLabel}>Tavolo</p>
      {tables.length === 0 ? (
        <p className="text-xs text-b58-charcoal-soft/60 py-4">
          Nessun tavolo configurato.{isTitolare && " Aprili da Impostazioni."}
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {tables.map((t) => {
            const occupato = Boolean(orderForLabel(t.label));
            const attivo = order?.table_label === t.label;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => openTable(t.label)}
                className={`tocco-riga relative rounded-lg text-sm px-1 transition-colors ${
                  attivo
                    ? "bg-b58-terracotta text-b58-parchment font-semibold"
                    : "bg-white ring-1 ring-b58-charcoal/10 text-b58-charcoal"
                }`}
              >
                {t.label}
                {occupato && !attivo && (
                  <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-b58-gold-dark" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {loadingOrder && <p className="text-xs text-b58-charcoal-soft">Apro il tavolo…</p>}

      {!loadingOrder && !order && (
        <p className="text-sm text-b58-charcoal-soft/70 text-center py-8">
          Tocca un tavolo per aprirlo.
          <br />
          <span className="text-xs">Il pallino dorato segnala i tavoli con un conto già aperto.</span>
        </p>
      )}

      {order && (
        <>
          {/* COPERTI --------------------------------------------------- */}
          <p className={sectionLabel}>Coperti</p>
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              disabled={busy || coperti === 0}
              onClick={() => handleCoperti(coperti - 1)}
              className="tocco-bottone rounded-lg bg-white ring-1 ring-b58-charcoal/15 text-lg text-b58-charcoal disabled:opacity-40"
            >
              −
            </button>
            <input
              type="number"
              min="0"
              value={coperti}
              onChange={(e) => handleCoperti(e.target.value)}
              className="tocco-bottone w-16 text-center rounded-lg border border-b58-charcoal/15 bg-white text-base"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => handleCoperti(coperti + 1)}
              className="tocco-bottone rounded-lg bg-white ring-1 ring-b58-charcoal/15 text-lg text-b58-charcoal disabled:opacity-40"
            >
              +
            </button>
            <span className="text-xs text-b58-charcoal-soft/70 ml-1">
              {copertoPrice != null ? `${formatEUR(copertoPrice)} a persona` : "prezzo non disponibile"}
            </span>
          </div>

          {/* CARTA DEI VINI ------------------------------------------- */}
          {/* Riquadro dedicato, non un elenco incolonnato nel menu: e' la
              correzione emersa dal simulatore. Compare solo se in carta
              c'e' davvero qualcosa. */}
          {vini.length > 0 && (
            <button
              type="button"
              onClick={() => setShowWines(true)}
              className="tocco-riga w-full flex items-center justify-between px-3 mb-4 rounded-lg bg-b58-gold/10 ring-1 ring-b58-gold-dark/25 text-b58-gold-dark font-semibold text-sm"
            >
              <span>🍷 Carta dei vini</span>
              <span className="text-lg">›</span>
            </button>
          )}

          {/* MENU ------------------------------------------------------ */}
          <p className={sectionLabel}>Menu</p>
          {menuByCategory.length === 0 ? (
            <p className="text-xs text-b58-charcoal-soft/60 mb-3">Nessun menu attivo.</p>
          ) : (
            <div className="mb-3">
              {menuByCategory.map((cat) => (
                <div key={cat.value} className="mb-2">
                  <p className="text-xs font-semibold text-b58-terracotta-dark border-b border-dashed border-b58-charcoal/15 pb-1 mb-0.5">
                    {cat.label}
                  </p>
                  {cat.items.map((mi) => (
                    // Riga INTERA tappabile, non un "+" da centrare: e' la
                    // correzione numero uno emersa dalla prova del simulatore.
                    <button
                      key={mi.id}
                      type="button"
                      disabled={busy}
                      onClick={() => handleAddMenuItem(mi)}
                      className="tocco-riga w-full flex items-center gap-2 px-2 rounded-lg text-left hover:bg-b58-cream-dark/70 active:bg-b58-cream-dark disabled:opacity-50 border-b border-b58-charcoal/5"
                    >
                      <span className="flex-1 text-sm text-b58-charcoal leading-tight">{mi.recipe_name}</span>
                      <span className="text-xs text-b58-charcoal-soft shrink-0">{formatEUR(mi.selling_price)}</span>
                      <span className="tocco-bottone shrink-0 rounded-lg bg-b58-terracotta text-b58-parchment flex items-center justify-center text-lg pointer-events-none">
                        +
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* BEVANDE --------------------------------------------------- */}
          {bevande.length > 0 && (
            <div className="mb-3">
              {bevande.map((cat) => (
                <div key={cat.nome} className="mb-2">
                  <p className="text-xs font-semibold text-b58-terracotta-dark border-b border-dashed border-b58-charcoal/15 pb-1 mb-0.5">
                    {cat.nome}
                  </p>
                  {cat.voci.map((v) => (
                    <RigaBar key={v.id} v={v} />
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* VOCE LIBERA ---------------------------------------------- */}
          {/* Finche' vini e bevande non vivono nell'Editor Menu (deciso
              l'08/08, ancora da costruire) questa e' l'unica strada per
              metterli in comanda: si tiene, ma chiusa. */}
          <button
            type="button"
            onClick={() => setShowFreeForm((v) => !v)}
            className="text-xs text-b58-charcoal-soft underline hover:text-b58-terracotta-dark mb-2"
          >
            {showFreeForm ? "Nascondi voce libera" : "+ Voce libera (bevande, fuori menu)"}
          </button>
          {showFreeForm && (
            <form onSubmit={handleAddFree} className="space-y-1.5 mb-3">
              <input
                required
                value={freeForm.name}
                onChange={(e) => setFreeForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={'Es. "Calice Nero d\'Avola"'}
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
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg border border-b58-charcoal/15 hover:bg-b58-cream-dark disabled:opacity-60 text-b58-charcoal text-sm font-medium py-2"
              >
                + Aggiungi alla comanda
              </button>
            </form>
          )}

          {/* COMANDA IN CORSO ----------------------------------------- */}
          <p className={sectionLabel}>Comanda in corso — {order.table_label}</p>
          <div className="rounded-xl bg-white ring-1 ring-b58-charcoal/10 p-3 mb-3">
            {draftItems.length === 0 && sentItems.length === 0 && (
              <p className="text-xs text-b58-charcoal-soft/60 text-center py-3">Nessun piatto selezionato.</p>
            )}

            {draftItems.map((it) => (
              <div key={it.id} className="border-b border-b58-charcoal/5 last:border-0 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="flex-1 min-w-0 text-sm text-b58-charcoal leading-tight">{lineLabel(it)}</span>
                  <button
                    type="button"
                    onClick={() => withBusy(() => updateDraftItemQuantity(it.id, it.quantity - 1))}
                    className="tocco-bottone rounded-lg ring-1 ring-b58-charcoal/15 text-b58-charcoal"
                  >
                    −
                  </button>
                  <b className="w-5 text-center text-sm">{it.quantity}</b>
                  <button
                    type="button"
                    onClick={() => withBusy(() => updateDraftItemQuantity(it.id, it.quantity + 1))}
                    className="tocco-bottone rounded-lg ring-1 ring-b58-charcoal/15 text-b58-charcoal"
                  >
                    +
                  </button>
                  <span className="w-14 text-right text-xs text-b58-charcoal-soft shrink-0">{formatEUR(lineTotal(it))}</span>
                  <button
                    type="button"
                    onClick={() => withBusy(() => removeDraftItem(it.id))}
                    className="text-b58-charcoal-soft hover:text-b58-terracotta-dark px-1"
                  >
                    ✕
                  </button>
                </div>
                {/* Nota del SINGOLO piatto, distinta da quella del tavolo:
                    "senza glutine" riguarda un piatto, non tutti. */}
                <CampoAutosalvato
                  value={it.note ?? ""}
                  onSave={(testo) =>
                    updateItemNote(it.id, testo).catch((err) => setError(err.message))
                  }
                  placeholder="nota per questo piatto (es. senza glutine)"
                  className="w-full mt-1 rounded-md border border-dashed border-b58-charcoal/20 bg-b58-cream/40 px-2 py-1.5 text-xs text-b58-charcoal-soft"
                />
              </div>
            ))}

            {sentItems.map((it) => (
              <div key={it.id} className="flex items-center gap-2 py-1.5 border-b border-b58-charcoal/5 last:border-0 opacity-70">
                <span className="flex-1 min-w-0 text-sm text-b58-charcoal leading-tight">
                  {it.quantity}× {lineLabel(it)}
                  <span className="text-xs text-b58-charcoal-soft"> · inviata</span>
                  {it.note && <span className="block text-xs italic text-b58-charcoal-soft">↳ {it.note}</span>}
                </span>
                <span className="text-xs text-b58-charcoal-soft shrink-0">{formatEUR(lineTotal(it))}</span>
                <button
                  type="button"
                  onClick={() => handleVoid(it.id)}
                  className="text-xs text-b58-charcoal-soft hover:text-b58-terracotta-dark px-1"
                >
                  annulla
                </button>
              </div>
            ))}

            <CampoAutosalvato
              key={order.id}
              value={order.note ?? ""}
              onSave={(testo) => updateOrderNote(order.id, testo).catch((e) => setError(e.message))}
              placeholder="Nota del tavolo (allergie, tempi…)"
              className={`${inputClass} mt-2`}
            />
          </div>

          {/* TOTALE E AZIONI ------------------------------------------ */}
          <div className="rounded-xl bg-b58-parchment ring-1 ring-b58-charcoal/10 p-3 space-y-2">
            {coperti > 0 && (
              <div className="flex justify-between text-xs text-b58-charcoal-soft">
                <span>{coperti} coperti</span>
                <span>{formatEUR(copertoTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-b58-charcoal">
              <span>Totale</span>
              <span>{formatEUR(total)}</span>
            </div>

            <button
              type="button"
              disabled={busy || draftItems.length === 0}
              onClick={handleSend}
              className="tocco-azione w-full rounded-lg bg-b58-olive hover:bg-b58-olive-dark disabled:opacity-40 transition-colors text-b58-parchment text-base font-semibold"
            >
              Invia comanda{draftItems.length > 0 && ` (${draftItems.length})`}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={sentItems.length === 0}
                onClick={() => setShowPrecon(true)}
                className="tocco-azione flex-1 rounded-lg border border-b58-charcoal/15 bg-white hover:bg-b58-cream-dark disabled:opacity-40 transition-colors text-b58-charcoal text-sm font-medium"
              >
                Preconto
              </button>
              <button
                type="button"
                disabled={sentItems.length === 0}
                onClick={() => setShowClose(true)}
                className="tocco-azione flex-1 rounded-lg bg-b58-terracotta hover:bg-b58-terracotta-dark disabled:opacity-40 transition-colors text-b58-parchment text-sm font-semibold"
              >
                Chiudi conto
              </button>
            </div>
          </div>
        </>
      )}

      {/* Schermata separata della carta dei vini: copre la sala senza
          farle perdere il tavolo selezionato, si torna indietro da una
          barra sempre visibile in alto. */}
      {showWines && order && (
        <div className="fixed inset-0 z-50 bg-b58-cream flex flex-col">
          <button
            type="button"
            onClick={() => setShowWines(false)}
            className="tocco-riga shrink-0 flex items-center gap-2 px-4 bg-b58-gold-dark text-b58-parchment font-semibold text-sm uppercase tracking-wide"
          >
            <span className="text-lg">‹</span> Torna al menu — {order.table_label}
          </button>
          <div className="flex-1 overflow-y-auto p-3 max-w-md mx-auto w-full">
            {vini.map((cat) => (
              <div key={cat.nome} className="mb-3">
                <p className="text-xs font-semibold text-b58-terracotta-dark border-b border-dashed border-b58-charcoal/15 pb-1 mb-0.5">
                  {cat.nome}
                </p>
                {cat.voci.map((v) => (
                  <RigaBar key={v.id} v={v} />
                ))}
              </div>
            ))}
          </div>
          <div className="shrink-0 p-3 border-t border-b58-charcoal/10 bg-b58-parchment">
            <button
              type="button"
              onClick={() => setShowWines(false)}
              className="tocco-azione w-full rounded-lg bg-b58-olive text-b58-parchment text-base font-semibold"
            >
              Fatto — torna alla comanda
            </button>
          </div>
        </div>
      )}

      {/* Sposta il conto su un altro tavolo (§3.2.2): si scelgono solo i
          tavoli liberi; se nel frattempo un altro tablet occupa la
          destinazione, il vincolo del database respinge e il messaggio
          arriva qui. */}
      {showMove && order && (
        <div className="fixed inset-0 bg-b58-charcoal/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-sm w-full overflow-hidden">
            <div className="bg-b58-charcoal text-b58-parchment px-4 py-3 flex items-center justify-between">
              <span className="font-display text-base">Sposta {order.table_label} su…</span>
              <button
                type="button"
                onClick={() => setShowMove(false)}
                className="text-b58-parchment/80 hover:text-b58-parchment text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-4 gap-1.5">
                {tables
                  .filter((t) => t.label !== order.table_label && !orderForLabel(t.label))
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        withBusy(async () => {
                          await moveOrderTable(order.id, t.label);
                        }).then(() => {
                          setShowMove(false);
                          loadBoard();
                        })
                      }
                      className="tocco-riga rounded-lg bg-b58-cream-dark/60 hover:bg-b58-cream-dark text-sm text-b58-charcoal disabled:opacity-50"
                    >
                      {t.label}
                    </button>
                  ))}
              </div>
              <p className="text-[11px] text-b58-charcoal-soft/70 mt-3 leading-relaxed">
                Il conto si porta dietro tutto: piatti, coperti e note. I tavoli
                occupati non compaiono.
              </p>
            </div>
          </div>
        </div>
      )}

      {showPrecon && order && (
        <PrecontoModal order={order} copertoPrice={copertoPrice} onClose={() => setShowPrecon(false)} />
      )}

      {showClose && order && (
        <CloseOrderModal
          order={order}
          copertoPrice={copertoPrice}
          onClose={() => setShowClose(false)}
          onDone={() => {
            setShowClose(false);
            setOrder(null);
            loadBoard();
          }}
        />
      )}
    </div>
  );
}
